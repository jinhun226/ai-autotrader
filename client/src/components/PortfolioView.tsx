import type { PositionRow } from "../api";

interface Props {
  positions: PositionRow[];
  realizedPnl: number;
}

export function PortfolioView({ positions, realizedPnl }: Props) {
  return (
    <div className="card">
      <h2>모의 포트폴리오</h2>
      <p>
        실현 손익:{" "}
        <strong className={realizedPnl >= 0 ? "pnl-positive" : "pnl-negative"}>
          ${realizedPnl.toFixed(2)}
        </strong>
      </p>
      {positions.length === 0 ? (
        <p className="hint">보유 포지션 없음</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>종목</th>
              <th>수량</th>
              <th>평단가</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((p) => (
              <tr key={p.symbol}>
                <td>{p.symbol}</td>
                <td>{p.quantity}</td>
                <td>${p.avgPrice.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
