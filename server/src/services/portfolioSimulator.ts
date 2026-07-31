import { addRealizedPnl, getPosition, upsertPosition } from "../store.js";
import type { AgentDecision } from "../types.js";

/** Applies an approved decision to the simulated portfolio at the given fill price. */
export async function applyOrder(
  decision: AgentDecision,
  currentPrice: number
): Promise<void> {
  if (decision.action === "hold") return;

  const existing = await getPosition(decision.symbol);

  if (decision.action === "buy") {
    const existingQty = existing?.quantity ?? 0;
    const existingAvg = existing?.avgPrice ?? 0;
    const newQty = existingQty + decision.quantity;
    const newAvg =
      newQty > 0
        ? (existingQty * existingAvg + decision.quantity * currentPrice) / newQty
        : 0;
    await upsertPosition(decision.symbol, newQty, newAvg);
    return;
  }

  if (decision.action === "sell") {
    const existingQty = existing?.quantity ?? 0;
    const existingAvg = existing?.avgPrice ?? 0;
    const sellQty = Math.min(decision.quantity, existingQty);
    const realized = (currentPrice - existingAvg) * sellQty;
    await addRealizedPnl(realized);
    await upsertPosition(decision.symbol, existingQty - sellQty, existingAvg);
  }
}
