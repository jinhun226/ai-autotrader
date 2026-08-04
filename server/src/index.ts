import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { initSchema } from "./db.js";
import { guardrailRouter } from "./routes/guardrail.js";
import { agentRouter } from "./routes/agent.js";
import { decisionsRouter } from "./routes/decisions.js";
import { portfolioRouter } from "./routes/portfolio.js";
import { getAgentState } from "./store.js";
import { startAgent } from "./services/agentLoop.js";

const here = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  await initSchema();

  // The interval loop lives only in process memory, so a redeploy or crash
  // silently stops trading even though the DB still says "running". Resume
  // it here so the agent survives restarts instead of going quietly idle.
  const agentState = await getAgentState();
  if (agentState.running) {
    console.log("[startup] agent_state.running was true — resuming agent loop");
    await startAgent();
  }

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.use("/api/guardrail", guardrailRouter);
  app.use("/api/agent", agentRouter);
  app.use("/api/decisions", decisionsRouter);
  app.use("/api/portfolio", portfolioRouter);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  // In production, this server also serves the built React client
  // (single Render Web Service instead of a separate static site).
  if (process.env.NODE_ENV === "production") {
    const clientDist = path.join(here, "..", "..", "client", "dist");
    app.use(express.static(clientDist));
    app.get(/^(?!\/api\/).*/, (_req, res) => {
      res.sendFile(path.join(clientDist, "index.html"));
    });
  }

  app.listen(config.port, () => {
    console.log(`AI 자율투자 server listening on http://localhost:${config.port}`);
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
