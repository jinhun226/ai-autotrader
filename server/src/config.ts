import "dotenv/config";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 8787),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  alpacaKeyId: process.env.ALPACA_API_KEY_ID ?? "",
  alpacaSecretKey: process.env.ALPACA_API_SECRET_KEY ?? "",
};

export function assertAnthropicConfigured(): void {
  requireEnv("ANTHROPIC_API_KEY");
}

export function assertAlpacaConfigured(): void {
  requireEnv("ALPACA_API_KEY_ID");
  requireEnv("ALPACA_API_SECRET_KEY");
}

export interface EnvVarDiagnosis {
  name: string;
  length: number;
  /** First character outside printable ASCII (32-126) — flags smart-quotes,
   * bullets, zero-width spaces, etc. that a UI autofill/paste can silently insert. */
  badChar: { index: number; code: number } | null;
  /** Char codes of the first 15 characters. Safe to expose: every Anthropic key
   * shares the same "sk-ant-api03-" prefix, so this reveals no secret content —
   * it's here purely to see the actual byte pattern instead of inferring it. */
  first15Codes: number[];
  /** Process start time, so we can tell whether this response came from a
   * freshly restarted process or one that's been running since before a fix. */
  processStartedAt: string;
}

function diagnoseEnvVar(name: string, value: string): EnvVarDiagnosis {
  let badChar: { index: number; code: number } | null = null;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 32 || code > 126) {
      badChar = { index: i, code };
      break;
    }
  }
  return {
    name,
    length: value.length,
    badChar,
    first15Codes: Array.from(value.slice(0, 15)).map((c) => c.charCodeAt(0)),
    processStartedAt: processStartedAt.toISOString(),
  };
}

const processStartedAt = new Date();

/** Never returns the secret values themselves — only length + the position/code
 * of the first non-printable-ASCII character, if any. Safe to expose over HTTP. */
export function diagnoseEnv(): EnvVarDiagnosis[] {
  return [
    diagnoseEnvVar("ANTHROPIC_API_KEY", config.anthropicApiKey),
    diagnoseEnvVar("ALPACA_API_KEY_ID", config.alpacaKeyId),
    diagnoseEnvVar("ALPACA_API_SECRET_KEY", config.alpacaSecretKey),
  ];
}
