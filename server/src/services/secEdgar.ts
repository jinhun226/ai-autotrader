import type { FilingSnippet } from "../types.js";

interface EdgarHit {
  _id: string;
  _source: {
    display_names: string[];
    file_date: string;
    root_forms: string[];
    adsh: string;
  };
}

interface EdgarSearchResponse {
  hits: { hits: EdgarHit[] };
}

const USER_AGENT = "AI-AutoTrader-MVP (contact: local-test@example.com)";

// SEC EDGAR full-text search (free, no API key). One symbol/company name per call.
export async function fetchRecentFilings(
  symbol: string,
  limit = 3
): Promise<FilingSnippet[]> {
  const url = `https://efts.sec.gov/LATEST/search-index?q=%22${encodeURIComponent(
    symbol
  )}%22&forms=8-K,10-Q,10-K`;

  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
  });

  if (!res.ok) {
    // Non-fatal: filings are supplementary context, not required for a decision.
    return [];
  }

  const data = (await res.json()) as EdgarSearchResponse;
  const hits = data.hits?.hits ?? [];

  return hits.slice(0, limit).map((hit) => {
    const [accession, filePath] = hit._id.split(":");
    const cik = hit._source.adsh.split("-")[0];
    return {
      symbol,
      title: `${hit._source.root_forms.join("/")} - ${
        hit._source.display_names[0] ?? symbol
      }`,
      filedAt: hit._source.file_date,
      snippet: `${hit._source.root_forms.join(",")} filing on ${
        hit._source.file_date
      }`,
      url: `https://www.sec.gov/Archives/edgar/data/${cik}/${accession.replace(
        /-/g,
        ""
      )}/${filePath}`,
    };
  });
}
