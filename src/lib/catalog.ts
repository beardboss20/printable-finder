import {
  mapMakerWorldPayload,
  mapPrintablesPayload,
  mapThangsPayload,
  mapThingiversePayload,
  mergeModels,
  dedupeModels,
} from "./rank-core.js";
import type { PrintableModel, SiteId, SiteStatus } from "./types";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const PER_REQUEST_MS = 6_000;
const SEARCH_BUDGET_MS = 9_000;

const PRINTABLES_QUERY = `
query SearchModels($query: String!, $limit: Int, $ordering: SearchChoicesEnum) {
  result: searchPrints2(query: $query, printType: print, limit: $limit, ordering: $ordering) {
    items {
      id
      name
      slug
      likesCount
      downloadCount
      image { filePath }
      user { publicUsername }
    }
  }
}
`;

type SiteBatch = {
  status: "ok" | "failed" | "timeout";
  models: PrintableModel[];
};

export type CatalogResult = {
  models: PrintableModel[];
  siteStatus: SiteStatus[];
};

function isAbort(err: unknown): boolean {
  return err instanceof Error && err.name === "AbortError";
}

function childSignal(parent: AbortSignal, ms: number): { signal: AbortSignal; cancel: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  const onParent = () => controller.abort();
  if (parent.aborted) controller.abort();
  else parent.addEventListener("abort", onParent, { once: true });
  return {
    signal: controller.signal,
    cancel() {
      clearTimeout(timer);
      parent.removeEventListener("abort", onParent);
    },
  };
}

async function fetchJson(
  url: string,
  init: RequestInit | undefined,
  signal: AbortSignal,
): Promise<unknown> {
  const res = await fetch(url, {
    ...init,
    signal,
    headers: {
      Accept: "application/json",
      "User-Agent": UA,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function searchPrintables(
  query: string,
  limit: number,
  signal: AbortSignal,
): Promise<PrintableModel[]> {
  const data = await fetchJson(
    "https://api.printables.com/graphql/",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        operationName: "SearchModels",
        query: PRINTABLES_QUERY,
        variables: { query, limit, ordering: "best_match" },
      }),
    },
    signal,
  );
  return mapPrintablesPayload(data).slice(0, limit);
}

async function searchThangs(
  query: string,
  limit: number,
  signal: AbortSignal,
): Promise<PrintableModel[]> {
  const data = await fetchJson(
    `https://thangs.com/api/models/v3/search-by-text?searchTerm=${encodeURIComponent(query)}&page=0`,
    undefined,
    signal,
  );
  return mapThangsPayload(data, limit);
}

async function searchMakerWorld(
  query: string,
  limit: number,
  signal: AbortSignal,
): Promise<PrintableModel[]> {
  const data = await fetchJson(
    `https://makerworld.com/api/v1/search-service/select/design2?keyword=${encodeURIComponent(query)}&limit=${limit}&offset=0`,
    undefined,
    signal,
  );
  return mapMakerWorldPayload(data, limit);
}

async function searchThingiverse(
  query: string,
  limit: number,
  signal: AbortSignal,
): Promise<PrintableModel[]> {
  const token = process.env.THINGIVERSE_TOKEN?.trim();
  if (!token) return [];
  const data = await fetchJson(
    `https://api.thingiverse.com/search/${encodeURIComponent(query)}?type=things&per_page=${limit}`,
    { headers: { Authorization: `Bearer ${token}` } },
    signal,
  );
  return mapThingiversePayload(data, limit);
}

const SEARCHERS: Record<
  SiteId,
  (query: string, limit: number, signal: AbortSignal) => Promise<PrintableModel[]>
> = {
  printables: searchPrintables,
  thangs: searchThangs,
  makerworld: searchMakerWorld,
  thingiverse: searchThingiverse,
};

function activeSites(): SiteId[] {
  const sites: SiteId[] = ["printables", "thangs", "makerworld"];
  if (process.env.THINGIVERSE_TOKEN?.trim()) sites.push("thingiverse");
  return sites;
}

async function runBounded(
  site: SiteId,
  query: string,
  limit: number,
  parent: AbortSignal,
): Promise<SiteBatch> {
  const { signal, cancel } = childSignal(parent, PER_REQUEST_MS);
  try {
    if (signal.aborted) return { status: "timeout", models: [] };
    const models = await SEARCHERS[site](query, limit, signal);
    return { status: "ok", models };
  } catch (err) {
    const timeout = isAbort(err) || signal.aborted;
    console.error(`[catalog] ${site} ${timeout ? "timeout" : "failed"}`);
    return { status: timeout ? "timeout" : "failed", models: [] };
  } finally {
    cancel();
  }
}

export async function searchCatalog(queries: string[]): Promise<CatalogResult> {
  const uniqueQueries = [...new Set(queries.map((query) => query.trim()).filter(Boolean))].slice(
    0,
    4,
  );
  const sites = activeSites();
  if (uniqueQueries.length === 0) {
    return {
      models: [],
      siteStatus: sites.map((site) => ({ site, status: "ok", count: 0 })),
    };
  }

  const parent = new AbortController();
  const budget = setTimeout(() => parent.abort(), SEARCH_BUDGET_MS);
  const jobs: { site: SiteId; promise: Promise<SiteBatch> }[] = [];
  for (const [index, query] of uniqueQueries.entries()) {
    const limit = index === 0 ? 10 : 6;
    for (const site of sites) {
      jobs.push({ site, promise: runBounded(site, query, limit, parent.signal) });
    }
  }

  let settled: PromiseSettledResult<SiteBatch>[] = [];
  try {
    settled = await Promise.allSettled(jobs.map((job) => job.promise));
  } finally {
    clearTimeout(budget);
    parent.abort();
  }

  const buckets = new Map<SiteId, PrintableModel[]>(sites.map((site) => [site, []]));
  const statuses = new Map<SiteId, SiteBatch["status"][]>(sites.map((site) => [site, []]));

  settled.forEach((result, index) => {
    const site = jobs[index]!.site;
    if (result.status === "fulfilled") {
      statuses.get(site)?.push(result.value.status);
      buckets.get(site)?.push(...result.value.models);
    } else {
      console.error(`[catalog] ${site} failed`);
      statuses.get(site)?.push("failed");
    }
  });

  const siteStatus: SiteStatus[] = sites.map((site) => {
    const list = statuses.get(site) ?? [];
    const models = dedupeModels(buckets.get(site) ?? [], 80);
    let status: SiteStatus["status"] = "failed";
    if (list.some((entry) => entry === "ok")) status = "ok";
    else if (list.length > 0 && list.every((entry) => entry === "timeout")) status = "timeout";
    return {
      site,
      status,
      count: status === "ok" ? models.length : 0,
    };
  });

  return {
    models: mergeModels(
      sites.map((site) => buckets.get(site) ?? []),
      40,
    ),
    siteStatus,
  };
}
