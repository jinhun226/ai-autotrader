import { useCallback, useEffect, useState } from "react";
import { api, type AgentState, type DecisionLogRow, type GuardrailSettings, type PositionRow } from "./api";
import { GuardrailForm } from "./components/GuardrailForm";
import { AgentControls } from "./components/AgentControls";
import { CostMeter } from "./components/CostMeter";
import { PortfolioView } from "./components/PortfolioView";
import { DecisionFeed } from "./components/DecisionFeed";

export default function App() {
  const [settings, setSettings] = useState<GuardrailSettings | null>(null);
  const [agentState, setAgentState] = useState<AgentState | null>(null);
  const [decisions, setDecisions] = useState<DecisionLogRow[]>([]);
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [realizedPnl, setRealizedPnl] = useState(0);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [s, a, d, p] = await Promise.all([
        api.getGuardrail(),
        api.getAgentState(),
        api.getDecisions(),
        api.getPortfolio(),
      ]);
      setSettings(s);
      setAgentState(a);
      setDecisions(d);
      setPositions(p.positions);
      setRealizedPnl(p.realizedPnl);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 4000);
    return () => clearInterval(id);
  }, [refresh]);

  const runAction = async (fn: () => Promise<AgentState>) => {
    setBusy(true);
    try {
      await fn();
      await refresh();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  if (!settings || !agentState) {
    return (
      <div className="app">
        <h1>AI 자율투자 OS</h1>
        {loadError ? (
          <p className="error">서버 연결 실패: {loadError}</p>
        ) : (
          <p>불러오는 중...</p>
        )}
      </div>
    );
  }

  return (
    <div className="app">
      <h1>AI 자율투자 OS — 모의투자 MVP</h1>
      {loadError && <p className="error">{loadError}</p>}

      <div className="grid">
        <GuardrailForm
          settings={settings}
          disabled={agentState.running}
          onSave={async (next) => {
            const saved = await api.saveGuardrail(next);
            setSettings(saved);
          }}
        />

        <AgentControls
          state={agentState}
          busy={busy}
          maxRuntimeHours={settings.maxRuntimeHours}
          onStart={() => runAction(api.startAgent)}
          onStop={() => runAction(api.stopAgent)}
          onRunOnce={() => runAction(api.runOnce)}
          onReset={() => runAction(api.resetAgent)}
          onWipe={() => runAction(api.wipeAgent)}
        />

        <CostMeter
          cumulativeCostUsd={agentState.cumulativeCostUsd}
          costLimitUsd={settings.costLimitUsd}
        />

        <PortfolioView positions={positions} realizedPnl={realizedPnl} />
      </div>

      <DecisionFeed decisions={decisions} />
    </div>
  );
}
