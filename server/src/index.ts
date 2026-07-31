import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config, diagnoseEnv } from "./config.js";
import { initSchema } from "./db.js";
import { guardrailRouter } from "./routes/guardrail.js";
import { agentRouter } from "./routes/agent.js";
import { decisionsRouter } from "./routes/decisions.js";
import { portfolioRouter } from "./routes/portfolio.js";

const here = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  await initSchema();

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

  // Temporary diagnostic — never returns secret values, only length + the
  // position/code of a bad (non-printable-ASCII) character if one exists.
  app.get("/api/debug/env-check", (_req, res) => {
    res.json(diagnoseEnv());
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
