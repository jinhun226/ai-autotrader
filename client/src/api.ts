export type ModelChoice = "claude-haiku-4-5" | "claude-sonnet-5";

export type RiskProfile = "conservative" | "moderate" | "aggressive";

export const ALL_RISK_PROFILES: RiskProfile[] = ["conservative", "moderate", "aggressive"];

export const RISK_PROFILE_LABELS: Record<RiskProfile, string> = {
  conservative: "보수적",
  moderate: "중립",
  aggressive: "공격적",
};

export const RISK_PROFILE_HINTS: Record<RiskProfile, string> = {
  conservative: "종목당 한도의 60%만 사용, 변동성 낮은 종목 선호, 확신 낮으면 보류",
  moderate: "종목당 한도를 그대로 사용, 균형 잡힌 판단",
  aggressive: "종목당 한도의 최대 150%(상한 100%)까지 사용, 모멘텀 강한 종목 선호",
};

export type Sector =
  | "tech"
  | "finance"
  | "healthcare"
  | "energy"
  | "consumer"
  | "industrial";

export const ALL_SECTORS: Sector[] = [
  "tech",
  "finance",
  "healthcare",
  "energy",
  "consumer",
  "industrial",
];

export const SECTOR_LABELS: Record<Sector, string> = {
  tech: "기술",
  finance: "금융",
  healthcare: "헬스케어",
  energy: "에너지",
  consumer: "소비재",
  industrial: "산업재",
};

export interface GuardrailSettings {
  investmentAmount: number;
  lossLimit: number;
  costLimitUsd: number;
  sectors: Sector[];
  allSectorsDelegated: boolean;
  allowSell: boolean;
  watchSymbols: string[];
  model: ModelChoice;
  cycleIntervalMinutes: number;
  maxRuntimeHours: number | null;
  maxPositionPct: number;
  riskProfile: RiskProfile;
}

export interface AgentState {
  running: boolean;
  haltedReason: string | null;
  cumulativeCostUsd: number;
  realizedPnl: number;
  lastRunAt: string | null;
  startedAt: string | null;
}

export interface DecisionLogRow {
  id: number;
  createdAt: string;
  snapshot: string;
  action: "buy" | "sell" | "hold";
  symbol: string;
  quantity: number;
  rationale: string;
  rationaleKo: string;
  confidence: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  model: string;
  approved: boolean;
  blockReason: string | null;
  riskProfile: RiskProfile;
}

export interface PositionRow {
  symbol: string;
  quantity: number;
  avgPrice: number;
  updatedAt: string;
  name: string;
  currentPrice: number;
  marketValueUsd: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  getGuardrail: () => request<GuardrailSettings>("/guardrail"),
  saveGuardrail: (settings: GuardrailSettings) =>
    request<GuardrailSettings>("/guardrail", {
      method: "POST",
      body: JSON.stringify(settings),
    }),
  getAgentState: () => request<AgentState>("/agent/state"),
  startAgent: () => request<AgentState>("/agent/start", { method: "POST" }),
  stopAgent: () => request<AgentState>("/agent/stop", { method: "POST" }),
  runOnce: () => request<AgentState>("/agent/run-once", { method: "POST" }),
  resetAgent: () => request<AgentState>("/agent/reset", { method: "POST" }),
  wipeAgent: () => request<AgentState>("/agent/wipe", { method: "POST" }),
  getDecisions: () => request<DecisionLogRow[]>("/decisions?limit=50"),
  getPortfolio: () =>
    request<{
      positions: PositionRow[];
      realizedPnl: number;
      totalUnrealizedPnl: number;
      marketOpen: boolean;
    }>("/portfolio"),
};
