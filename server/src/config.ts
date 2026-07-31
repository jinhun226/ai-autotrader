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
