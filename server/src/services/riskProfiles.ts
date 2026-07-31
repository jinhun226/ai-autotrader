import type { RiskProfile } from "../types.js";

export const RISK_PROFILE_LABELS: Record<RiskProfile, string> = {
  conservative: "보수적",
  moderate: "중립",
  aggressive: "공격적",
};

/** Scales settings.maxPositionPct into the ceiling actually enforced this
 * cycle. This is a hard, deterministic effect (unlike prompt wording alone,
 * which Haiku 4.5 has proven unreliable at following for sizing math) — see
 * the DIVERSIFICATION note in reasoningAgent.ts for why the ceiling itself,
 * not a suggestion, is what drives AI behavior. Capped at 100% by the caller. */
export const RISK_PROFILE_POSITION_MULTIPLIER: Record<RiskProfile, number> = {
  conservative: 0.6,
  moderate: 1.0,
  aggressive: 1.5,
};

/** Single source of truth for the scaled cap — used by both the reasoning
 * context (agentLoop) and the deterministic backstop (guardrailEngine) so
 * they never diverge and an aggressive-profile order sized against the
 * wider ceiling isn't rejected by a check still enforcing the narrower one. */
export function effectivePositionCapPct(
  maxPositionPct: number,
  riskProfile: RiskProfile
): number {
  return Math.min(100, maxPositionPct * RISK_PROFILE_POSITION_MULTIPLIER[riskProfile]);
}

/** Qualitative nudge folded into the reasoning prompt — symbol preference and
 * confidence bar, which are judgment calls appropriate for the LLM itself. */
export const RISK_PROFILE_GUIDANCE: Record<RiskProfile, string> = {
  conservative:
    "RISK PROFILE: CONSERVATIVE. Prefer symbols with low volatilityPercent and a stable, established uptrend over high-momentum movers. Require higher conviction (roughly 75%+ confidence) before buying; when signals are mixed or volatility is elevated, prefer \"hold\". Your position-sizing ceiling this cycle is already tightened to reflect this profile — you do not need to additionally shrink it yourself.",
  moderate:
    "RISK PROFILE: MODERATE. Balance stability and momentum normally — no additional bias beyond the standard guidance above.",
  aggressive:
    "RISK PROFILE: AGGRESSIVE. You may favor higher-momentum, higher-volatility symbols with strong trendPercent, and act on moderate conviction (confidence around 60%+) rather than waiting for near-certainty. Your position-sizing ceiling this cycle is already widened to reflect this profile — high-conviction ideas may be sized closer to maxBuyQuantity.",
};
