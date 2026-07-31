import pg from "pg";
import "dotenv/config";

const { Pool } = pg;

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://localhost:5432/ai_autotrader_dev";

// Render (and most managed Postgres hosts) require SSL but present a
// self-signed-style chain the default Node TLS trust store won't validate.
const useSsl = /render\.com|amazonaws\.com|neon\.tech|supabase\.co/.test(
  connectionString
);

export const pool = new Pool({
  connectionString,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
});

export async function initSchema(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS guardrail_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      investment_amount DOUBLE PRECISION NOT NULL DEFAULT 1000,
      loss_limit DOUBLE PRECISION NOT NULL DEFAULT 100,
      cost_limit_usd DOUBLE PRECISION NOT NULL DEFAULT 8,
      sectors TEXT NOT NULL DEFAULT '["tech"]',
      all_sectors_delegated BOOLEAN NOT NULL DEFAULT false,
      allow_sell BOOLEAN NOT NULL DEFAULT false,
      watch_symbols TEXT NOT NULL DEFAULT '["AAPL","MSFT","NVDA"]',
      model TEXT NOT NULL DEFAULT 'claude-haiku-4-5',
      cycle_interval_minutes INTEGER NOT NULL DEFAULT 15,
      max_runtime_hours DOUBLE PRECISION,
      max_position_pct DOUBLE PRECISION NOT NULL DEFAULT 30
    );

    CREATE TABLE IF NOT EXISTS decisions (
      id SERIAL PRIMARY KEY,
      created_at TEXT NOT NULL,
      snapshot TEXT NOT NULL,
      action TEXT NOT NULL,
      symbol TEXT NOT NULL,
      quantity DOUBLE PRECISION NOT NULL,
      rationale TEXT NOT NULL,
      confidence DOUBLE PRECISION NOT NULL,
      input_tokens INTEGER NOT NULL,
      output_tokens INTEGER NOT NULL,
      cost_usd DOUBLE PRECISION NOT NULL,
      model TEXT NOT NULL,
      approved BOOLEAN NOT NULL,
      block_reason TEXT
    );

    CREATE TABLE IF NOT EXISTS positions (
      symbol TEXT PRIMARY KEY,
      quantity DOUBLE PRECISION NOT NULL,
      avg_price DOUBLE PRECISION NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS agent_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      running BOOLEAN NOT NULL DEFAULT false,
      halted_reason TEXT,
      cumulative_cost_usd DOUBLE PRECISION NOT NULL DEFAULT 0,
      realized_pnl DOUBLE PRECISION NOT NULL DEFAULT 0,
      last_run_at TEXT,
      started_at TEXT
    );
  `);

  await pool.query(
    `INSERT INTO guardrail_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING`
  );
  await pool.query(
    `INSERT INTO agent_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING`
  );
}
