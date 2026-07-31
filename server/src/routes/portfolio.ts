import { Router } from "express";
import { getAgentState, getPositions } from "../store.js";
import { asyncHandler } from "../asyncHandler.js";

export const portfolioRouter = Router();

portfolioRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const [positions, agentState] = await Promise.all([
      getPositions(),
      getAgentState(),
    ]);
    res.json({
      positions,
      realizedPnl: agentState.realizedPnl,
    });
  })
);
