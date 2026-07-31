import { Router } from "express";
import { listDecisions } from "../store.js";
import { asyncHandler } from "../asyncHandler.js";

export const decisionsRouter = Router();

decisionsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const limit = Number(req.query.limit ?? 50);
    res.json(await listDecisions(Number.isFinite(limit) ? limit : 50));
  })
);
