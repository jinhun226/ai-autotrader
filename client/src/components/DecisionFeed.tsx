import type { DecisionLogRow } from "../api";

interface Props {
  decisions: DecisionLogRow[];
}

const ACTION_LABEL: Record<string, string> = {
  buy: "매수",
  sell: "매도",
  hold: "보류",
};

export function DecisionFeed({ decisions }: Props) {
  return (
    <div className="card">
      <h2>판단 로그 (Decision Log)</h2>
      {decisions.length === 0 ? (
        <p className="hint">아직 판단 기록이 없습니다.</p>
      ) : (
        <ul className="decision-list">
          {decisions.map((d) => (
            <li key={d.id} className={d.approved ? "decision-approved" : "decision-blocked"}>
              <div className="decision-header">
                <span className="decision-action">
                  {ACTION_LABEL[d.action] ?? d.action} {d.symbol} {d.quantity > 0 ? d.quantity : ""}
                </span>
                <span className="decision-time">
                  {new Date(d.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="decision-rationale">{d.rationale}</p>
              <div className="decision-meta">
                <span>신뢰도 {(d.confidence * 100).toFixed(0)}%</span>
                <span>모델 {d.model}</span>
                <span>비용 ${d.costUsd.toFixed(4)}</span>
                {!d.approved && <span className="error">차단: {d.blockReason}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
