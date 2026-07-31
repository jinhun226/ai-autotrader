import { Router } from "express";
import { runCycle, startAgent, stopAgent } from "../services/agentLoop.js";
import {
  clearHalt,
  getAgentState,
  resetAgentState,
  wipeAllData,
} from "../store.js";
import { asyncHandler } from "../asyncHandler.js";

export const agentRouter = Router();

agentRouter.get(
  "/state",
  asyncHandler(async (_req, res) => {
    res.json(await getAgentState());
  })
);

agentRouter.post(
  "/start",
  asyncHandler(async (_req, res) => {
    await clearHalt();
    await startAgent();
    res.json(await getAgentState());
  })
);

agentRouter.post(
  "/stop",
  asyncHandler(async (_req, res) => {
    await stopAgent();
    res.json(await getAgentState());
  })
);

agentRouter.post(
  "/run-once",
  asyncHandler(async (_req, res) => {
    await runCycle();
    res.json(await getAgentState());
  })
);

agentRouter.post(
  "/reset",
  asyncHandler(async (_req, res) => {
    await stopAgent();
    await resetAgentState();
    res.json(await getAgentState());
  })
);

/** Full wipe — agent state, positions, AND the decision log. Distinct from
 * "/reset" (which keeps decision history) since this is a one-way, more
 * destructive action meant for "clean slate before a fresh deploy". */
agentRouter.post(
  "/wipe",
  asyncHandler(async (_req, res) => {
    await stopAgent();
    await wipeAllData();
    res.json(await getAgentState());
  })
);
