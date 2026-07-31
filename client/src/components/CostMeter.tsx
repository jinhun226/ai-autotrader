interface Props {
  cumulativeCostUsd: number;
  costLimitUsd: number;
}

export function CostMeter({ cumulativeCostUsd, costLimitUsd }: Props) {
  const pct = costLimitUsd > 0 ? Math.min(100, (cumulativeCostUsd / costLimitUsd) * 100) : 0;
  const danger = pct >= 80;

  return (
    <div className="card">
      <h2>API 비용 Guardrail</h2>
      <p>
        누적 비용: ${cumulativeCostUsd.toFixed(4)} / 한도 ${costLimitUsd.toFixed(2)}
      </p>
      <div className="meter">
        <div
          className={`meter-fill ${danger ? "meter-danger" : ""}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
