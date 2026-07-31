import type { AgentState } from "../api";

interface Props {
  state: AgentState;
  busy: boolean;
  maxRuntimeHours: number | null;
  onStart: () => void;
  onStop: () => void;
  onRunOnce: () => void;
  onReset: () => void;
  onWipe: () => void;
}

export function AgentControls({
  state,
  busy,
  maxRuntimeHours,
  onStart,
  onStop,
  onRunOnce,
  onReset,
  onWipe,
}: Props) {
  const running = state.running;

  const elapsedHours = state.startedAt
    ? (Date.now() - new Date(state.startedAt).getTime()) / 3_600_000
    : null;

  return (
    <div className="card">
      <h2>Agent 제어</h2>
      <p>
        상태:{" "}
        <strong className={running ? "status-running" : "status-stopped"}>
          {running ? "실행 중" : "정지됨"}
        </strong>
      </p>
      {state.haltedReason && (
        <p className="error">⛔ 자동 중단: {state.haltedReason}</p>
      )}
      <p className="hint">
        마지막 실행: {state.lastRunAt ? new Date(state.lastRunAt).toLocaleString() : "-"}
      </p>
      {elapsedHours !== null && (
        <p className="hint">
          경과 시간: {elapsedHours.toFixed(1)}시간
          {maxRuntimeHours ? ` / 한도 ${maxRuntimeHours}시간` : " (무제한)"}
        </p>
      )}
      <div className="button-row">
        <button onClick={onStart} disabled={busy || running}>
          시작
        </button>
        <button onClick={onStop} disabled={busy || !running}>
          정지
        </button>
        <button onClick={onRunOnce} disabled={busy}>
          수동 1회 실행
        </button>
        <button onClick={onReset} disabled={busy} className="danger">
          초기화
        </button>
        <button
          onClick={() => {
            if (confirm("판단 로그를 포함한 모든 데이터를 삭제합니다. 계속할까요?")) {
              onWipe();
            }
          }}
          disabled={busy}
          className="danger"
        >
          전체 데이터 삭제
        </button>
      </div>
    </div>
  );
}
