import { config } from "../config.js";
import type { HistoricalStats, MarketSnapshot } from "../types.js";

const DATA_BASE_URL = "https://data.alpaca.markets/v2";

interface AlpacaBar {
  c: number; // close
  t: string; // timestamp
}

interface AlpacaBarsResponse {
  bars: Record<string, AlpacaBar[]>;
}

interface AlpacaSnapshotResponse {
  [symbol: string]: {
    latestTrade?: { p: number };
    dailyBar?: { c: number; o: number; v: number };
    prevDailyBar?: { c: number };
  };
}

export async function fetchMarketSnapshots(
  symbols: string[]
): Promise<MarketSnapshot[]> {
  if (symbols.length === 0) return [];

  const url = `${DATA_BASE_URL}/stocks/snapshots?symbols=${encodeURIComponent(
    symbols.join(",")
  )}`;

  const res = await fetch(url, {
    headers: {
      "APCA-API-KEY-ID": config.alpacaKeyId,
      "APCA-API-SECRET-KEY": config.alpacaSecretKey,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Alpaca snapshot request failed (${res.status}): ${body.slice(0, 300)}`
    );
  }

  const data = (await res.json()) as AlpacaSnapshotResponse;

  return symbols.map((symbol) => {
    const entry = data[symbol];
    const price = entry?.latestTrade?.p ?? entry?.dailyBar?.c ?? 0;
    const prevClose = entry?.prevDailyBar?.c ?? price;
    const changePercent =
      prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0;
    return {
      symbol,
      price,
      changePercent,
      volume: entry?.dailyBar?.v ?? 0,
    };
  });
}

function sma(closes: number[], window: number): number {
  const slice = closes.slice(-window);
  if (slice.length === 0) return 0;
  return slice.reduce((sum, c) => sum + c, 0) / slice.length;
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/** ~40 calendar days of free-tier (IEX) daily bars — enough for a 20-day SMA. */
export async function fetchHistoricalStats(
  symbols: string[]
): Promise<HistoricalStats[]> {
  if (symbols.length === 0) return [];

  const end = new Date();
  const start = new Date(end.getTime() - 40 * 24 * 60 * 60 * 1000);
  const url =
    `${DATA_BASE_URL}/stocks/bars?symbols=${encodeURIComponent(symbols.join(","))}` +
    `&timeframe=1Day&start=${start.toISOString().slice(0, 10)}&end=${end
      .toISOString()
      .slice(0, 10)}&limit=1000&feed=iex`;

  const res = await fetch(url, {
    headers: {
      "APCA-API-KEY-ID": config.alpacaKeyId,
      "APCA-API-SECRET-KEY": config.alpacaSecretKey,
    },
  });

  if (!res.ok) {
    // Non-fatal: historical trend is supplementary context, not required for a decision.
    return [];
  }

  const data = (await res.json()) as AlpacaBarsResponse;

  return symbols.map((symbol) => {
    const bars = data.bars?.[symbol] ?? [];
    const closes = bars.map((b) => b.c);
    if (closes.length === 0) {
      return { symbol, sma5: 0, sma20: 0, trendPercent: 0, volatilityPercent: 0 };
    }
    const returns = closes
      .slice(1)
      .map((c, i) => (c - closes[i]) / closes[i]);
    const first = closes[0];
    const last = closes[closes.length - 1];
    return {
      symbol,
      sma5: sma(closes, 5),
      sma20: sma(closes, 20),
      trendPercent: first > 0 ? ((last - first) / first) * 100 : 0,
      volatilityPercent: stddev(returns) * 100,
    };
  });
}
