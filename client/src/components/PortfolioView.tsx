import type { PositionRow } from "../api";

interface Props {
  positions: PositionRow[];
  realizedPnl: number;
  totalUnrealizedPnl: number;
}

/** Snaps tiny floating-point noise (e.g. -3.6e-14) to a clean 0 so the UI
 * never shows "$-0.00". */
function clean(value: number): number {
  return Math.abs(value) < 0.005 ? 0 : value;
}

function pnlClass(value: number): string {
  return clean(value) >= 0 ? "pnl-positive" : "pnl-negative";
}

function formatPnl(value: number): string {
  const v = clean(value);
  const sign = v > 0 ? "+" : "";
  return `${sign}$${v.toFixed(2)}`;
}

function formatQuantity(value: number): string {
  return value.toFixed(4).replace(/\.?0+$/, "");
}

export function PortfolioView({ positions, realizedPnl, totalUnrealizedPnl }: Props) {
  return (
    <div className="card">
      <h2>모의 포트폴리오</h2>
      <div className="pnl-summary">
        <div>
          <span className="field-label">실현 손익</span>
          <strong className={pnlClass(realizedPnl)}>${clean(realizedPnl).toFixed(2)}</strong>
        </div>
        <div>
          <span className="field-label">평가 손익</span>
          <strong className={pnlClass(totalUnrealizedPnl)}>
            {formatPnl(totalUnrealizedPnl)}
          </strong>
        </div>
      </div>
      {positions.length === 0 ? (
        <p className="hint">보유 포지션 없음</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>종목</th>
              <th>수량</th>
              <th>평단가</th>
              <th>현재가</th>
              <th>평가손익</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((p) => (
              <tr key={p.symbol}>
                <td>
                  <div className="position-symbol">{p.symbol}</div>
                  <div className="position-name">{p.name}</div>
                </td>
                <td>{formatQuantity(p.quantity)}</td>
                <td>${p.avgPrice.toFixed(2)}</td>
                <td>${p.currentPrice.toFixed(2)}</td>
                <td className={pnlClass(p.unrealizedPnl)}>
                  {formatPnl(p.unrealizedPnl)}
                  <div className="position-pnl-pct">
                    ({clean(p.unrealizedPnlPercent) > 0 ? "+" : ""}
                    {clean(p.unrealizedPnlPercent).toFixed(1)}%)
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
