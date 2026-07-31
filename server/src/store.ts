import { pool } from "./db.js";
import { resolveWatchSymbols } from "./sectors.js";
import type {
  AgentState,
  DecisionAction,
  DecisionLogRow,
  GuardrailSettings,
  PositionRow,
  RecentDecisionSummary,
  Sector,
} from "./types.js";

export async function getGuardrailSettings(): Promise<GuardrailSettings> {
  const { rows } = await pool.query(
    `SELECT investment_amount, loss_limit, cost_limit_usd, sectors, all_sectors_delegated,
            allow_sell, watch_symbols, model, cycle_interval_minutes, max_runtime_hours,
            max_position_pct, risk_profile
     FROM guardrail_settings WHERE id = 1`
  );
  const row = rows[0] as {
    investment_amount: number;
    loss_limit: number;
    cost_limit_usd: number;
    sectors: string;
    all_sectors_delegated: boolean;
    allow_sell: boolean;
    watch_symbols: string;
    model: string;
    cycle_interval_minutes: number;
    max_runtime_hours: number | null;
    max_position_pct: number;
    risk_profile: string;
  };
  return {
    investmentAmount: row.investment_amount,
    lossLimit: row.loss_limit,
    costLimitUsd: row.cost_limit_usd,
    sectors: JSON.parse(row.sectors),
    allSectorsDelegated: row.all_sectors_delegated,
    allowSell: row.allow_sell,
    watchSymbols: JSON.parse(row.watch_symbols),
    model: row.model as GuardrailSettings["model"],
    cycleIntervalMinutes: row.cycle_interval_minutes,
    maxRuntimeHours: row.max_runtime_hours,
    maxPositionPct: row.max_position_pct,
    riskProfile: row.risk_profile as GuardrailSettings["riskProfile"],
  };
}

/** Persists guardrail settings; watchSymbols is always recomputed server-side
 * from sectors/allSectorsDelegated so the client can't smuggle in an unbounded list. */
export async function saveGuardrailSettings(
  settings: Omit<GuardrailSettings, "watchSymbols">
): Promise<void> {
  const watchSymbols = resolveWatchSymbols(
    settings.sectors as Sector[],
    settings.allSectorsDelegated
  );
  await pool.query(
    `UPDATE guardrail_settings SET
      investment_amount = $1,
      loss_limit = $2,
      cost_limit_usd = $3,
      sectors = $4,
      all_sectors_delegated = $5,
      allow_sell = $6,
      watch_symbols = $7,
      model = $8,
      cycle_interval_minutes = $9,
      max_runtime_hours = $10,
      max_position_pct = $11,
      risk_profile = $12
     WHERE id = 1`,
    [
      settings.investmentAmount,
      settings.lossLimit,
      settings.costLimitUsd,
      JSON.stringify(settings.sectors),
      settings.allSectorsDelegated,
      settings.allowSell,
      JSON.stringify(watchSymbols),
      settings.model,
      settings.cycleIntervalMinutes,
      settings.maxRuntimeHours,
      settings.maxPositionPct,
      settings.riskProfile,
    ]
  );
}

export async function getAgentState(): Promise<AgentState> {
  const { rows } = await pool.query(
    `SELECT running, halted_reason, cumulative_cost_usd, realized_pnl, last_run_at, started_at
     FROM agent_state WHERE id = 1`
  );
  const row = rows[0] as {
    running: boolean;
    halted_reason: string | null;
    cumulative_cost_usd: number;
    realized_pnl: number;
    last_run_at: string | null;
    started_at: string | null;
  };
  return {
    running: row.running,
    haltedReason: row.halted_reason,
    cumulativeCostUsd: row.cumulative_cost_usd,
    realizedPnl: row.realized_pnl,
    lastRunAt: row.last_run_at,
    startedAt: row.started_at,
  };
}

/** Marks the agent running and stamps started_at (once) — the anchor maxRuntimeHours counts from. */
export async function setAgentRunning(running: boolean): Promise<void> {
  await pool.query(
    `UPDATE agent_state
     SET running = $1,
         started_at = CASE WHEN $1 THEN COALESCE(started_at, $2) ELSE started_at END
     WHERE id = 1`,
    [running, new Date().toISOString()]
  );
}

export async function haltAgent(reason: string): Promise<void> {
  await pool.query(
    `UPDATE agent_state SET running = false, halted_reason = $1 WHERE id = 1`,
    [reason]
  );
}

export async function clearHalt(): Promise<void> {
  await pool.query(`UPDATE agent_state SET halted_reason = NULL WHERE id = 1`);
}

export async function addCost(deltaUsd: number): Promise<number> {
  await pool.query(
    `UPDATE agent_state SET cumulative_cost_usd = cumulative_cost_usd + $1 WHERE id = 1`,
    [deltaUsd]
  );
  return (await getAgentState()).cumulativeCostUsd;
}

export async function addRealizedPnl(delta: number): Promise<number> {
  await pool.query(
    `UPDATE agent_state SET realized_pnl = realized_pnl + $1 WHERE id = 1`,
    [delta]
  );
  return (await getAgentState()).realizedPnl;
}

export async function touchLastRun(): Promise<void> {
  await pool.query(`UPDATE agent_state SET last_run_at = $1 WHERE id = 1`, [
    new Date().toISOString(),
  ]);
}

export async function resetAgentState(): Promise<void> {
  await pool.query(
    `UPDATE agent_state SET running = false, halted_reason = NULL, cumulative_cost_usd = 0,
       realized_pnl = 0, last_run_at = NULL, started_at = NULL WHERE id = 1`
  );
  await pool.query(`DELETE FROM positions`);
}

/** Full wipe: agent state, positions, AND the decision log itself — used for
 * "모든 데이터 지우기" before a fresh deployment. Guardrail settings are left
 * alone (the user reconfigures them deliberately, e.g. before starting a deploy). */
export async function wipeAllData(): Promise<void> {
  await resetAgentState();
  await pool.query(`DELETE FROM decisions`);
}

export async function getPositions(): Promise<PositionRow[]> {
  const { rows } = await pool.query(
    `SELECT symbol, quantity, avg_price, updated_at FROM positions ORDER BY symbol`
  );
  return (
    rows as { symbol: string; quantity: number; avg_price: number; updated_at: string }[]
  ).map((r) => ({
    symbol: r.symbol,
    quantity: r.quantity,
    avgPrice: r.avg_price,
    updatedAt: r.updated_at,
  }));
}

export async function getPosition(
  symbol: string
): Promise<PositionRow | undefined> {
  const { rows } = await pool.query(
    `SELECT symbol, quantity, avg_price, updated_at FROM positions WHERE symbol = $1`,
    [symbol]
  );
  const row = rows[0] as
    | { symbol: string; quantity: number; avg_price: number; updated_at: string }
    | undefined;
  if (!row) return undefined;
  return {
    symbol: row.symbol,
    quantity: row.quantity,
    avgPrice: row.avg_price,
    updatedAt: row.updated_at,
  };
}

export async function upsertPosition(
  symbol: string,
  quantity: number,
  avgPrice: number
): Promise<void> {
  await pool.query(
    `INSERT INTO positions (symbol, quantity, avg_price, updated_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (symbol) DO UPDATE SET
       quantity = $2, avg_price = $3, updated_at = $4`,
    [symbol, quantity, avgPrice, new Date().toISOString()]
  );
}

export async function insertDecision(row: {
  snapshot: unknown;
  action: DecisionAction;
  symbol: string;
  quantity: number;
  rationale: string;
  confidence: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  model: string;
  approved: boolean;
  blockReason: string | null;
  riskProfile: string;
}): Promise<void> {
  await pool.query(
    `INSERT INTO decisions
      (created_at, snapshot, action, symbol, quantity, rationale, confidence,
       input_tokens, output_tokens, cost_usd, model, approved, block_reason, risk_profile)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
    [
      new Date().toISOString(),
      JSON.stringify(row.snapshot),
      row.action,
      row.symbol,
      row.quantity,
      row.rationale,
      row.confidence,
      row.inputTokens,
      row.outputTokens,
      row.costUsd,
      row.model,
      row.approved,
      row.blockReason,
      row.riskProfile,
    ]
  );
}

export async function listDecisions(limit = 50): Promise<DecisionLogRow[]> {
  const { rows } = await pool.query(
    `SELECT id, created_at, snapshot, action, symbol, quantity, rationale, confidence,
            input_tokens, output_tokens, cost_usd, model, approved, block_reason, risk_profile
     FROM decisions ORDER BY id DESC LIMIT $1`,
    [limit]
  );
  return (
    rows as {
      id: number;
      created_at: string;
      snapshot: string;
      action: string;
      symbol: string;
      quantity: number;
      rationale: string;
      confidence: number;
      input_tokens: number;
      output_tokens: number;
      cost_usd: number;
      model: string;
      approved: boolean;
      block_reason: string | null;
      risk_profile: string;
    }[]
  ).map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    snapshot: r.snapshot,
    action: r.action as DecisionAction,
    symbol: r.symbol,
    quantity: r.quantity,
    rationale: r.rationale,
    confidence: r.confidence,
    inputTokens: r.input_tokens,
    outputTokens: r.output_tokens,
    costUsd: r.cost_usd,
    model: r.model,
    approved: r.approved,
    blockReason: r.block_reason,
    riskProfile: r.risk_profile as DecisionLogRow["riskProfile"],
  }));
}

/** Condensed decision history (no raw snapshot payload) for feeding back into
 * the reasoning agent's prompt context — keeps token cost bounded. */
export async function getRecentDecisionsSummary(
  limit = 5
): Promise<RecentDecisionSummary[]> {
  const { rows } = await pool.query(
    `SELECT created_at, action, symbol, quantity, rationale, approved
     FROM decisions ORDER BY id DESC LIMIT $1`,
    [limit]
  );
  return (
    rows as {
      created_at: string;
      action: string;
      symbol: string;
      quantity: number;
      rationale: string;
      approved: boolean;
    }[]
  ).map((r) => ({
    createdAt: r.created_at,
    action: r.action as DecisionAction,
    symbol: r.symbol,
    quantity: r.quantity,
    rationale: r.rationale,
    approved: r.approved,
  }));
}
