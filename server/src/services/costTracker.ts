import type { ModelChoice } from "../types.js";

// $ per million tokens (input, output). Keep in sync with Anthropic pricing.
const PRICING: Record<ModelChoice, { input: number; output: number }> = {
  "claude-haiku-4-5": { input: 1.0, output: 5.0 },
  "claude-sonnet-5": { input: 3.0, output: 15.0 },
};

export function computeCostUsd(
  model: ModelChoice,
  inputTokens: number,
  outputTokens: number
): number {
  const rate = PRICING[model];
  return (
    (inputTokens / 1_000_000) * rate.input +
    (outputTokens / 1_000_000) * rate.output
  );
}
