import type { PrintableModel } from "./types";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": UA,
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

type PrintablesItem = {
  id?: string;
  name?: string;
  slug?: string;
  likesCount?: number;
  downloadCount?: number;
  image?: { filePath?: string } | null;
  user?: { publicUsername?: string } | null;
};

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

export async function searchPrintables(
  query: string,
  limit = 8,
): Promise<PrintableModel[]> {
  const data = (await fetchJson("https://api.printables.com/graphql/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      operationName: "SearchModels",
      query: PRINTABLES_QUERY,
      variables: { query, limit, ordering: "best_match" },
    }),
  })) as { data?: { result?: { items?: PrintablesItem[] } } };

  const items = data.data?.result?.items ?? [];
  return items
    .filter((item) => item.id && item.name)
    .map((item) => {
      const slug = item.slug ? `${item.id}-${item.slug}` : String(item.id);
      return {
        id: `printables-${item.id}`,
        title: item.name as string,
        url: `https://www.printables.com/model/${slug}`,
        imageUrl: item.image?.filePath
          ? `https://media.printables.com/${item.image.filePath}`
          : null,
        site: "printables" as const,
        likes: typeof item.likesCount === "number" ? item.likesCount : null,
        downloads: typeof item.downloadCount === "number" ? item.downloadCount : null,
        author: item.user?.publicUsername ?? null,
      };
    });
}

type ThangsItem = {
  modelId?: string;
  name?: string;
  modelPageUrl?: string;
  thumbnailUrl?: string;
  likesCount?: number;
  downloadCount?: number;
  ownerUsername?: string;
  marketplaceInfo?: unknown;
};

export async function searchThangs(
  query: string,
  limit = 8,
): Promise<PrintableModel[]> {
  const data = (await fetchJson(
    `https://thangs.com/api/models/v3/search-by-text?searchTerm=${encodeURIComponent(query)}&page=0`,
  )) as { results?: ThangsItem[] };

  return (data.results ?? [])
    .filter((item) => item.modelId && item.name && !item.marketplaceInfo)
    .slice(0, limit)
    .map((item) => ({
      id: `thangs-${item.modelId}`,
      title: item.name as string,
      url: item.modelPageUrl || `https://thangs.com/m/${item.modelId}`,
      imageUrl: item.thumbnailUrl ?? null,
      site: "thangs" as const,
      likes: typeof item.likesCount === "number" ? item.likesCount : null,
      downloads: typeof item.downloadCount === "number" ? item.downloadCount : null,
      author: item.ownerUsername ?? null,
    }));
}

function scoreModel(model: PrintableModel): number {
  const likes = model.likes ?? 0;
  const downloads = model.downloads ?? 0;
  const siteBonus = model.site === "printables" ? 180 : 0;
  return likes * 2 + downloads * 0.35 + siteBonus;
}

export async function searchCatalog(queries: string[]): Promise<PrintableModel[]> {
  const uniqueQueries = [...new Set(queries.map((q) => q.trim()).filter(Boolean))].slice(
    0,
    3,
  );
  if (uniqueQueries.length === 0) return [];

  const jobs = uniqueQueries.flatMap((q, index) => {
    const limit = index === 0 ? 12 : 8;
    return [
      searchPrintables(q, limit).catch(() => [] as PrintableModel[]),
      searchThangs(q, limit).catch(() => [] as PrintableModel[]),
    ];
  });

  const batches = await Promise.all(jobs);
  const seen = new Set<string>();
  const merged: PrintableModel[] = [];
  for (const batch of batches) {
    for (const model of batch) {
      const key = model.url.replace(/\/$/, "").toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(model);
    }
  }

  merged.sort((a, b) => scoreModel(b) - scoreModel(a));
  return merged.slice(0, 20);
}
