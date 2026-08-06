import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";
import { computeCostUsd } from "./costTracker.js";
import { RISK_PROFILE_GUIDANCE } from "./riskProfiles.js";
import type {
  AgentDecision,
  CostBudget,
  FilingSnippet,
  GuardrailSettings,
  HistoricalStats,
  MarketSnapshot,
  PortfolioAllocation,
  PositionRow,
  RecentDecisionSummary,
  TimeBudget,
} from "../types.js";

const client = new Anthropic({ apiKey: config.anthropicApiKey });

function buildDecisionSchema(allowSell: boolean) {
  return {
    type: "json_schema" as const,
    schema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: allowSell ? ["buy", "sell", "hold"] : ["buy", "hold"],
        },
        symbol: { type: "string" },
        quantity: { type: "number" },
        rationale: { type: "string" },
        rationaleKo: { type: "string" },
        confidence: { type: "number" },
      },
      required: ["action", "symbol", "quantity", "rationale", "rationaleKo", "confidence"],
      additionalProperties: false,
    },
  };
}

function buildSystemPrompt(allowSell: boolean, riskProfile: GuardrailSettings["riskProfile"]): string {
  const authorityLine = allowSell
    ? 'You are authorized to take ONE action: "buy", "sell", or "hold" for a single symbol. You may sell only symbols shown in current_holdings, and never more than the held quantity.'
    : 'You are NOT authorized to sell — the user has not granted sell permission. You may only choose "buy" or "hold" for a single symbol, even if a position is currently at a loss.';

  return `You are the Reasoning Agent of an AI-native autonomous investing OS (simulated/paper trading only — no real money moves).
Analyze trading_candidates (live price + pre-computed buy ceiling per symbol), historical_trend (20-day SMA/momentum/volatility), recent SEC filing headlines, current holdings, and your own recent_decision_history for the watched symbols, then decide.
Use historical_trend to judge whether today's move is a continuation or a reversal (e.g. price above both SMA5 and SMA20 with positive trendPercent = sustained uptrend; a single-day drop against a rising SMA20 may be noise, not a signal) — do not react to the latest snapshot in isolation.
Check recent_decision_history before deciding: do not flip-flop (e.g. buy then immediately sell/rebuy the same symbol) without a genuinely new data point since your last decision on that symbol, and do not repeat a rationale that led to a blocked/rejected order.
${authorityLine}

${RISK_PROFILE_GUIDANCE[riskProfile]}

DIVERSIFICATION — DO NOT COMPUTE THIS YOURSELF: trading_candidates gives you, per symbol, a pre-computed "maxBuyQuantity" that already accounts for maxPositionPct AND available capital. If you choose "buy", your quantity for that symbol MUST be <= its maxBuyQuantity — treat this as a hard ceiling, not a target. It is already the correct answer to "how much can I buy here"; do not re-derive it from price/percentages yourself, and do not trust your own arithmetic over this number. A buy above it is rejected server-side regardless of your rationale. Actively spread capital across multiple symbols rather than concentrating in whichever one looks best today; all else being roughly equal, prefer a symbol at 0% current allocation over adding to one you already hold.

PACING: time_budget tells you how much of your allowed runtime has elapsed and roughly how many decision cycles remain (null fields = no time limit, no need to pace). cost_budget tells you how much of the API cost limit remains. When a time limit IS set, do not deploy most of available_capital_usd in the first few cycles — spread buys across the remaining cycles/time so you can react to how earlier picks perform and still be diversified near the end of the window. If remainingHours/estimatedRemainingCycles is small and you are still underinvested relative to a diversified target, it is reasonable to size a bit larger to finish deploying before time runs out.
Fractional share quantities are fully supported down to small dollar amounts (e.g. 0.12, 0.03, 1.5) — this mirrors Alpaca's real fractional-trading API for major US equities. Your quantity does not need to equal maxBuyQuantity — size it to your actual conviction (a smaller, high-conviction slice is fine), just never exceed it. Never describe available capital as "insufficient" or "capital-constrained" merely because it can't buy a whole share — with fractional trading, any maxBuyNotionalUsd above roughly $1 is enough to size a proportionate buy. Only choose "hold" because the investment signal itself is weak or mixed, never because the resulting position would be small in dollar terms.
Be conservative: prefer "hold" when the evidence is weak or mixed. Always explain your reasoning briefly (2-3 sentences) citing the specific data points you used.
Provide "rationaleKo": a natural, fluent Korean translation of "rationale" (not a literal word-for-word gloss) — same reasoning and data points, written for a Korean-speaking user of this trading dashboard.`;
}

export interface ReasoningResult {
  decision: AgentDecision;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  model: string;
}

export async function decide(params: {
  settings: GuardrailSettings;
  snapshots: MarketSnapshot[];
  historicalStats: HistoricalStats[];
  filings: FilingSnippet[];
  positions: PositionRow[];
  recentDecisions: RecentDecisionSummary[];
  availableCapital: number;
  timeBudget: TimeBudget;
  costBudget: CostBudget;
  portfolioAllocation: PortfolioAllocation;
}): Promise<ReasoningResult> {
  const {
    settings,
    snapshots,
    historicalStats,
    filings,
    positions,
    recentDecisions,
    availableCapital,
    timeBudget,
    costBudget,
    portfolioAllocation,
  } = params;

  const remainingCapacityBySymbol = new Map(
    portfolioAllocation.positions.map((p) => [p.symbol, p.remainingCapacityUsd])
  );
  const tradingCandidates = snapshots.map((s) => {
    const positionCapUsd =
      remainingCapacityBySymbol.get(s.symbol) ??
      portfolioAllocation.maxNewPositionNotionalUsd;
    const maxBuyNotionalUsd = Math.max(
      0,
      Math.min(positionCapUsd, availableCapital)
    );
    return {
      symbol: s.symbol,
      price: s.price,
      changePercent: s.changePercent,
      volume: s.volume,
      // Pre-computed hard ceiling — see DIVERSIFICATION note in the system prompt.
      maxBuyNotionalUsd,
      maxBuyQuantity: s.price > 0 ? maxBuyNotionalUsd / s.price : 0,
    };
  });

  const userContent = JSON.stringify(
    {
      mandate: settings.allSectorsDelegated
        ? "User has delegated full investment authority — you may freely pick the best opportunity among ALL symbols below, not restricted to any single sector."
        : `User has restricted trading to these sectors: ${settings.sectors.join(", ")}.`,
      sell_permission: settings.allowSell
        ? "GRANTED — you may sell any symbol listed in current_holdings."
        : "NOT GRANTED — you may only buy or hold, never sell.",
      watch_symbols: settings.watchSymbols,
      current_holdings: positions,
      portfolio_allocation: portfolioAllocation,
      available_capital_usd: availableCapital,
      time_budget: timeBudget,
      cost_budget: costBudget,
      trading_candidates: tradingCandidates,
      historical_trend: historicalStats,
      recent_filings: filings,
      recent_decision_history: recentDecisions,
    },
    null,
    2
  );

  const isSonnet = settings.model === "claude-sonnet-5";

  const response = await client.messages.create({
    model: settings.model,
    // Bumped from 512: rationale + rationaleKo (Korean translation) together
    // need more room, and truncated JSON output breaks JSON.parse below.
    max_tokens: 900,
    system: buildSystemPrompt(settings.allowSell, settings.riskProfile),
    // Sonnet 5 thinks by default (billed); disable it since this is a single
    // structured-decision call, not a task that benefits from extended reasoning.
    ...(isSonnet ? { thinking: { type: "disabled" as const } } : {}),
    output_config: { format: buildDecisionSchema(settings.allowSell) },
    messages: [
      {
        role: "user",
        content: `Here is today's data snapshot:\n${userContent}`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Reasoning agent returned no text content");
  }

  const decision = JSON.parse(textBlock.text) as AgentDecision;

  const inputTokens = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;
  const costUsd = computeCostUsd(settings.model, inputTokens, outputTokens);

  return {
    decision,
    inputTokens,
    outputTokens,
    costUsd,
    model: settings.model,
  };
}
