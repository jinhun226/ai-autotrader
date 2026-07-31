import { fetchHistoricalStats, fetchMarketSnapshots } from "./alpaca.js";
import { fetchRecentFilings } from "./secEdgar.js";
import { decide } from "./reasoningAgent.js";
import {
  checkCostLimit,
  checkLossLimit,
  checkOrder,
  checkRuntimeLimit,
} from "./guardrailEngine.js";
import { applyOrder } from "./portfolioSimulator.js";
import {
  addCost,
  getAgentState,
  getGuardrailSettings,
  getPositions,
  getRecentDecisionsSummary,
  haltAgent,
  insertDecision,
  setAgentRunning,
  touchLastRun,
} from "../store.js";
import type {
  AgentState,
  CostBudget,
  GuardrailSettings,
  PortfolioAllocation,
  PositionRow,
  TimeBudget,
} from "../types.js";

let intervalHandle: NodeJS.Timeout | null = null;

function buildTimeBudget(
  settings: GuardrailSettings,
  agentState: AgentState
): TimeBudget {
  if (!settings.maxRuntimeHours || !agentState.startedAt) {
    return {
      maxRuntimeHours: null,
      elapsedHours: 0,
      remainingHours: null,
      percentTimeUsed: null,
      estimatedRemainingCycles: null,
    };
  }
  const elapsedHours =
    (Date.now() - new Date(agentState.startedAt).getTime()) / 3_600_000;
  const remainingHours = Math.max(0, settings.maxRuntimeHours - elapsedHours);
  return {
    maxRuntimeHours: settings.maxRuntimeHours,
    elapsedHours,
    remainingHours,
    percentTimeUsed: (elapsedHours / settings.maxRuntimeHours) * 100,
    estimatedRemainingCycles: Math.max(
      0,
      Math.floor((remainingHours * 60) / settings.cycleIntervalMinutes)
    ),
  };
}

function buildCostBudget(
  settings: GuardrailSettings,
  agentState: AgentState
): CostBudget {
  return {
    costLimitUsd: settings.costLimitUsd,
    cumulativeCostUsd: agentState.cumulativeCostUsd,
    remainingUsd: Math.max(
      0,
      settings.costLimitUsd - agentState.cumulativeCostUsd
    ),
  };
}

function buildPortfolioAllocation(
  settings: GuardrailSettings,
  positions: PositionRow[],
  currentPrices: Map<string, number>
): PortfolioAllocation {
  const positionCapUsd =
    settings.investmentAmount * (settings.maxPositionPct / 100);

  const entries = positions.map((p) => {
    const price = currentPrices.get(p.symbol) ?? p.avgPrice;
    const marketValueUsd = p.quantity * price;
    return {
      symbol: p.symbol,
      marketValueUsd,
      percentOfInvestment:
        settings.investmentAmount > 0
          ? (marketValueUsd / settings.investmentAmount) * 100
          : 0,
      remainingCapacityUsd: Math.max(0, positionCapUsd - marketValueUsd),
    };
  });
  const deployedUsd = entries.reduce((sum, e) => sum + e.marketValueUsd, 0);
  const cashUsd = Math.max(0, settings.investmentAmount - deployedUsd);
  return {
    positions: entries,
    cashUsd,
    cashPercentOfInvestment:
      settings.investmentAmount > 0
        ? (cashUsd / settings.investmentAmount) * 100
        : 0,
    maxPositionPct: settings.maxPositionPct,
    maxNewPositionNotionalUsd: positionCapUsd,
  };
}

export async function runCycle(): Promise<void> {
  const settings = await getGuardrailSettings();
  let agentState = await getAgentState();

  if (agentState.haltedReason) {
    console.log(`[agentLoop] halted: ${agentState.haltedReason} — skipping cycle`);
    return;
  }

  const runtimeCheck = checkRuntimeLimit(agentState, settings);
  if (!runtimeCheck.approved) {
    await haltAgent(runtimeCheck.reason ?? "runtime_limit_exceeded");
    await touchLastRun();
    return;
  }

  try {
    const [snapshots, historicalStats, filingsPerSymbol] = await Promise.all([
      fetchMarketSnapshots(settings.watchSymbols),
      fetchHistoricalStats(settings.watchSymbols),
      Promise.all(
        settings.watchSymbols.map((symbol) => fetchRecentFilings(symbol, 2))
      ),
    ]);
    const filings = filingsPerSymbol.flat();
    const recentDecisions = await getRecentDecisionsSummary(5);

    const positions = await getPositions();
    const deployedCapital = positions.reduce(
      (sum, p) => sum + p.quantity * p.avgPrice,
      0
    );
    const availableCapital =
      settings.investmentAmount + agentState.realizedPnl - deployedCapital;

    const currentPrices = new Map(snapshots.map((s) => [s.symbol, s.price]));
    const timeBudget = buildTimeBudget(settings, agentState);
    const costBudget = buildCostBudget(settings, agentState);
    const portfolioAllocation = buildPortfolioAllocation(
      settings,
      positions,
      currentPrices
    );

    const result = await decide({
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
    });

    await addCost(result.costUsd);
    agentState = await getAgentState();

    const costCheck = checkCostLimit(agentState, settings, 0);
    if (!costCheck.approved) {
      await insertDecision({
        snapshot: { snapshots, historicalStats, filings },
        action: result.decision.action,
        symbol: result.decision.symbol,
        quantity: result.decision.quantity,
        rationale: result.decision.rationale,
        confidence: result.decision.confidence,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        costUsd: result.costUsd,
        model: result.model,
        approved: false,
        blockReason: costCheck.reason,
      });
      await haltAgent(costCheck.reason ?? "cost_limit_exceeded");
      await touchLastRun();
      return;
    }

    const lossCheck = checkLossLimit(agentState, settings);
    if (!lossCheck.approved) {
      await insertDecision({
        snapshot: { snapshots, historicalStats, filings },
        action: result.decision.action,
        symbol: result.decision.symbol,
        quantity: result.decision.quantity,
        rationale: result.decision.rationale,
        confidence: result.decision.confidence,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        costUsd: result.costUsd,
        model: result.model,
        approved: false,
        blockReason: lossCheck.reason,
      });
      await haltAgent(lossCheck.reason ?? "loss_limit_exceeded");
      await touchLastRun();
      return;
    }

    const currentPrice =
      snapshots.find((s) => s.symbol === result.decision.symbol)?.price ?? 0;

    const orderCheck = checkOrder(
      result.decision,
      settings,
      positions,
      agentState,
      currentPrice
    );

    if (orderCheck.approved) {
      await applyOrder(result.decision, currentPrice);
    }

    await insertDecision({
      snapshot: { snapshots, historicalStats, filings },
      action: result.decision.action,
      symbol: result.decision.symbol,
      quantity: result.decision.quantity,
      rationale: result.decision.rationale,
      confidence: result.decision.confidence,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      costUsd: result.costUsd,
      model: result.model,
      approved: orderCheck.approved,
      blockReason: orderCheck.reason,
    });

    await touchLastRun();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[agentLoop] cycle failed:", message);
    await haltAgent(`실행 오류: ${message}`);
    await touchLastRun();
  }
}

export async function startAgent(): Promise<void> {
  const settings = await getGuardrailSettings();
  await setAgentRunning(true);
  if (intervalHandle) clearInterval(intervalHandle);
  // fire immediately, then on the configured interval
  void runCycle();
  intervalHandle = setInterval(
    () => void runCycle(),
    settings.cycleIntervalMinutes * 60 * 1000
  );
}

export async function stopAgent(): Promise<void> {
  await setAgentRunning(false);
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

export function isLoopScheduled(): boolean {
  return intervalHandle !== null;
}
