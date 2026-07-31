import { Router } from "express";
import { getGuardrailSettings, saveGuardrailSettings } from "../store.js";
import { ALL_SECTORS } from "../sectors.js";
import { asyncHandler } from "../asyncHandler.js";
import type { GuardrailSettings } from "../types.js";

export const guardrailRouter = Router();

guardrailRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json(await getGuardrailSettings());
  })
);

guardrailRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = req.body as Partial<GuardrailSettings>;

    if (
      typeof body.investmentAmount !== "number" ||
      typeof body.lossLimit !== "number" ||
      typeof body.costLimitUsd !== "number" ||
      !Array.isArray(body.sectors) ||
      !body.sectors.every((s) => (ALL_SECTORS as string[]).includes(s)) ||
      typeof body.allSectorsDelegated !== "boolean" ||
      typeof body.allowSell !== "boolean" ||
      typeof body.model !== "string" ||
      typeof body.cycleIntervalMinutes !== "number" ||
      (body.maxRuntimeHours !== null && typeof body.maxRuntimeHours !== "number") ||
      typeof body.maxPositionPct !== "number"
    ) {
      res.status(400).json({ error: "invalid guardrail settings payload" });
      return;
    }

    if (!body.allSectorsDelegated && body.sectors.length === 0) {
      res.status(400).json({ error: "최소 1개 분야를 선택하거나 전체 위임을 켜주세요" });
      return;
    }

    if (body.costLimitUsd > 10) {
      res.status(400).json({ error: "비용 한도는 $10을 초과할 수 없습니다" });
      return;
    }

    if (body.maxPositionPct <= 0 || body.maxPositionPct > 100) {
      res.status(400).json({ error: "종목당 최대 비중은 1~100% 사이여야 합니다" });
      return;
    }

    await saveGuardrailSettings(body as Omit<GuardrailSettings, "watchSymbols">);
    res.json(await getGuardrailSettings());
  })
);
