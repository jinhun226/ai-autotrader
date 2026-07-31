import type { Sector } from "./types.js";

export const ALL_SECTORS: Sector[] = [
  "tech",
  "finance",
  "healthcare",
  "energy",
  "consumer",
  "industrial",
];

export const SECTOR_LABELS: Record<Sector, string> = {
  tech: "기술",
  finance: "금융",
  healthcare: "헬스케어",
  energy: "에너지",
  consumer: "소비재",
  industrial: "산업재",
};

// Curated, bounded universe per sector — keeps market-data calls, filing
// lookups, and prompt tokens (= cost) predictable regardless of selection.
export const SECTOR_SYMBOLS: Record<Sector, string[]> = {
  tech: ["AAPL", "MSFT", "NVDA"],
  finance: ["JPM", "GS"],
  healthcare: ["JNJ", "UNH"],
  energy: ["XOM", "CVX"],
  consumer: ["AMZN", "TSLA"],
  industrial: ["BA", "CAT"],
};

// Human-readable names for the curated universe above — used to label
// positions in the UI ("AAPL" -> "Apple Inc.") without a paid symbol-lookup API.
export const SYMBOL_NAMES: Record<string, string> = {
  AAPL: "Apple Inc.",
  MSFT: "Microsoft Corporation",
  NVDA: "NVIDIA Corporation",
  JPM: "JPMorgan Chase & Co.",
  GS: "Goldman Sachs Group Inc.",
  JNJ: "Johnson & Johnson",
  UNH: "UnitedHealth Group Inc.",
  XOM: "Exxon Mobil Corporation",
  CVX: "Chevron Corporation",
  AMZN: "Amazon.com, Inc.",
  TSLA: "Tesla, Inc.",
  BA: "The Boeing Company",
  CAT: "Caterpillar Inc.",
};

const MAX_WATCH_SYMBOLS = 8;

/** Resolves the user's sector selection (or full delegation) into a bounded,
 * round-robin diversified symbol list for the agent loop to fetch/reason over. */
export function resolveWatchSymbols(
  sectors: Sector[],
  allSectorsDelegated: boolean
): string[] {
  const chosen = allSectorsDelegated ? ALL_SECTORS : sectors;
  if (chosen.length === 0) return [];

  const lists = chosen.map((s) => [...(SECTOR_SYMBOLS[s] ?? [])]);
  const result: string[] = [];
  let round = 0;
  while (
    result.length < MAX_WATCH_SYMBOLS &&
    lists.some((l) => l.length > round)
  ) {
    for (const list of lists) {
      if (result.length >= MAX_WATCH_SYMBOLS) break;
      const symbol = list[round];
      if (symbol && !result.includes(symbol)) result.push(symbol);
    }
    round++;
  }
  return result;
}
