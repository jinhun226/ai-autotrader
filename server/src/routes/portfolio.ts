import { Router } from "express";
import { getAgentState, getPositions } from "../store.js";
import { asyncHandler } from "../asyncHandler.js";
import { fetchMarketSnapshots } from "../services/alpaca.js";
import { isMarketOpen } from "../services/marketHours.js";
import { SYMBOL_NAMES } from "../sectors.js";

export const portfolioRouter = Router();

portfolioRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const [positions, agentState] = await Promise.all([
      getPositions(),
      getAgentState(),
    ]);

    const symbols = positions.map((p) => p.symbol);
    // Live prices are best-effort — if Alpaca is briefly unreachable, fall
    // back to avgPrice rather than failing the whole portfolio view.
    const snapshots = symbols.length > 0 ? await fetchMarketSnapshots(symbols).catch(() => []) : [];
    const priceBySymbol = new Map(snapshots.map((s) => [s.symbol, s.price]));

    let totalUnrealizedPnl = 0;
    const enrichedPositions = positions.map((p) => {
      const currentPrice = priceBySymbol.get(p.symbol) ?? p.avgPrice;
      const marketValueUsd = p.quantity * currentPrice;
      const unrealizedPnl = (currentPrice - p.avgPrice) * p.quantity;
      const unrealizedPnlPercent =
        p.avgPrice > 0 ? ((currentPrice - p.avgPrice) / p.avgPrice) * 100 : 0;
      totalUnrealizedPnl += unrealizedPnl;
      return {
        ...p,
        name: SYMBOL_NAMES[p.symbol] ?? p.symbol,
        currentPrice,
        marketValueUsd,
        unrealizedPnl,
        unrealizedPnlPercent,
      };
    });

    res.json({
      positions: enrichedPositions,
      realizedPnl: agentState.realizedPnl,
      totalUnrealizedPnl,
      marketOpen: isMarketOpen(),
    });
  })
);
