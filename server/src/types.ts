export type ModelChoice = "claude-haiku-4-5" | "claude-sonnet-5";

export type Sector =
  | "tech"
  | "finance"
  | "healthcare"
  | "energy"
  | "consumer"
  | "industrial";

export interface GuardrailSettings {
  investmentAmount: number;
  lossLimit: number;
  costLimitUsd: number;
  /** User-selected investment fields. Ignored when allSectorsDelegated is true. */
  sectors: Sector[];
  /** "전체 위임" — AI trades freely across every curated sector. */
  allSectorsDelegated: boolean;
  /** Explicit permission to sell held positions. Off by default — AI may only buy/hold. */
  allowSell: boolean;
  /** Resolved server-side from sectors/allSectorsDelegated — the actual fetch/reasoning universe. */
  watchSymbols: string[];
  model: ModelChoice;
  cycleIntervalMinutes: number;
  /** Auto-stop the agent this many hours after "시작" is pressed. null/0 = no limit. */
  maxRuntimeHours: number | null;
  /** Diversification cap — no single symbol's total exposure may exceed this % of investmentAmount. */
  maxPositionPct: number;
}

export type DecisionAction = "buy" | "sell" | "hold";

export interface AgentDecision {
  action: DecisionAction;
  symbol: string;
  quantity: number;
  rationale: string;
  confidence: number;
}

export interface DecisionLogRow {
  id: number;
  createdAt: string;
  snapshot: string;
  action: DecisionAction;
  symbol: string;
  quantity: number;
  rationale: string;
  confidence: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  model: string;
  approved: boolean;
  blockReason: string | null;
}

export interface PositionRow {
  symbol: string;
  quantity: number;
  avgPrice: number;
  updatedAt: string;
}

export interface AgentState {
  running: boolean;
  haltedReason: string | null;
  cumulativeCostUsd: number;
  realizedPnl: number;
  lastRunAt: string | null;
  /** Set when "시작" is pressed; used to enforce maxRuntimeHours. */
  startedAt: string | null;
}

export interface MarketSnapshot {
  symbol: string;
  price: number;
  changePercent: number;
  volume: number;
}

export interface HistoricalStats {
  symbol: string;
  /** 5-trading-day simple moving average of the close price. */
  sma5: number;
  /** 20-trading-day simple moving average of the close price. */
  sma20: number;
  /** % change in close price from the start to the end of the lookback window. */
  trendPercent: number;
  /** Annualized-ish daily-return volatility (%) over the lookback window. */
  volatilityPercent: number;
}

export interface RecentDecisionSummary {
  createdAt: string;
  action: DecisionAction;
  symbol: string;
  quantity: number;
  rationale: string;
  approved: boolean;
}

export interface TimeBudget {
  maxRuntimeHours: number | null;
  elapsedHours: number;
  remainingHours: number | null;
  percentTimeUsed: number | null;
  estimatedRemainingCycles: number | null;
}

export interface CostBudget {
  costLimitUsd: number;
  cumulativeCostUsd: number;
  remainingUsd: number;
}

export interface AllocationEntry {
  symbol: string;
  marketValueUsd: number;
  percentOfInvestment: number;
  /** Max additional USD you may still buy of THIS symbol before hitting maxPositionPct. */
  remainingCapacityUsd: number;
}

export interface PortfolioAllocation {
  positions: AllocationEntry[];
  cashUsd: number;
  cashPercentOfInvestment: number;
  maxPositionPct: number;
  /** investmentAmount * maxPositionPct / 100 — the ceiling for a symbol not in `positions`. */
  maxNewPositionNotionalUsd: number;
}

export interface FilingSnippet {
  symbol: string;
  title: string;
  filedAt: string;
  snippet: string;
  url: string;
}
