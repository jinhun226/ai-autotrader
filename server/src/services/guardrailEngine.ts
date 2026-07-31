import type { AgentDecision, AgentState, GuardrailSettings, PositionRow } from "../types.js";

export interface GuardrailCheckResult {
  approved: boolean;
  reason: string | null;
  /** Set when the whole agent should stop running, not just this one order. */
  haltAgent: boolean;
}

export function checkCostLimit(
  agentState: AgentState,
  settings: GuardrailSettings,
  incomingCallCostUsd: number
): GuardrailCheckResult {
  const projected = agentState.cumulativeCostUsd + incomingCallCostUsd;
  if (projected >= settings.costLimitUsd) {
    return {
      approved: false,
      reason: `API 비용 한도 초과 ($${projected.toFixed(4)} / $${settings.costLimitUsd})`,
      haltAgent: true,
    };
  }
  return { approved: true, reason: null, haltAgent: false };
}

export function checkLossLimit(
  agentState: AgentState,
  settings: GuardrailSettings
): GuardrailCheckResult {
  if (agentState.realizedPnl <= -settings.lossLimit) {
    return {
      approved: false,
      reason: `손실 한도 초과 (실현손익 $${agentState.realizedPnl.toFixed(2)} / 한도 -$${settings.lossLimit})`,
      haltAgent: true,
    };
  }
  return { approved: true, reason: null, haltAgent: false };
}

export function checkRuntimeLimit(
  agentState: AgentState,
  settings: GuardrailSettings
): GuardrailCheckResult {
  if (!settings.maxRuntimeHours || !agentState.startedAt) {
    return { approved: true, reason: null, haltAgent: false };
  }
  const elapsedHours =
    (Date.now() - new Date(agentState.startedAt).getTime()) / 3_600_000;
  if (elapsedHours >= settings.maxRuntimeHours) {
    return {
      approved: false,
      reason: `실행 시간 한도 도달 (${elapsedHours.toFixed(1)}시간 / ${settings.maxRuntimeHours}시간)`,
      haltAgent: true,
    };
  }
  return { approved: true, reason: null, haltAgent: false };
}

export function checkOrder(
  decision: AgentDecision,
  settings: GuardrailSettings,
  positions: PositionRow[],
  agentState: AgentState,
  currentPrice: number
): GuardrailCheckResult {
  if (decision.action === "hold") {
    return { approved: true, reason: null, haltAgent: false };
  }

  const position = positions.find((p) => p.symbol === decision.symbol);
  const deployedCapital = positions.reduce(
    (sum, p) => sum + p.quantity * p.avgPrice,
    0
  );
  const availableCapital =
    settings.investmentAmount + agentState.realizedPnl - deployedCapital;

  if (decision.action === "buy") {
    const notional = decision.quantity * currentPrice;
    if (notional > availableCapital) {
      return {
        approved: false,
        reason: `투자 한도 초과: 주문금액 $${notional.toFixed(2)} > 가용자금 $${availableCapital.toFixed(2)}`,
        haltAgent: false,
      };
    }

    const existingSymbolNotional = position
      ? position.quantity * currentPrice
      : 0;
    const projectedSymbolNotional = existingSymbolNotional + notional;
    const positionCap =
      settings.investmentAmount * (settings.maxPositionPct / 100);
    if (projectedSymbolNotional > positionCap) {
      return {
        approved: false,
        reason: `분산 투자 한도 초과: ${decision.symbol} 총비중 $${projectedSymbolNotional.toFixed(2)} > 종목당 한도 $${positionCap.toFixed(2)} (${settings.maxPositionPct}%)`,
        haltAgent: false,
      };
    }
  }

  if (decision.action === "sell") {
    if (!settings.allowSell) {
      return {
        approved: false,
        reason: "매도 권한 없음: Guardrail 설정에서 매도 권한을 부여해야 합니다",
        haltAgent: false,
      };
    }
    if (!position || position.quantity < decision.quantity) {
      return {
        approved: false,
        reason: `매도 불가: 보유수량(${position?.quantity ?? 0}) 부족`,
        haltAgent: false,
      };
    }
  }

  return { approved: true, reason: null, haltAgent: false };
}
