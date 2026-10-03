/**
 * Pure search/ranking helpers. No network and no TanStack runtime,
 * so node:test can import this file directly.
 */

const STOP = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "for",
  "to",
  "of",
  "in",
  "on",
  "with",
  "from",
  "this",
  "that",
  "3d",
  "print",
  "printable",
  "printed",
  "model",
  "stl",
  "3mf",
  "free",
  "no",
  "not",
  "needed",
  "remix",
  "v1",
  "v2",
  "v3",
]);

const FUNCTION_WORDS = [
  "stand",
  "dock",
  "holder",
  "mount",
  "clip",
  "hook",
  "duct",
  "bracket",
  "organizer",
  "case",
  "cover",
  "riser",
  "tray",
  "sleeve",
  "adapter",
  "guard",
  "spacer",
];

const KINDS = new Set([
  "functional_part",
  "decorative",
  "toy_figure",
  "household",
  "tool",
  "electronic_device",
  "other",
]);

const FINISHED_GOODS = {
  phone: hint({
    nouns: ["phone", "iphone", "smartphone"],
    queries: ["phone stand", "phone dock", "phone holder", "desk phone stand"],
    synonyms: ["smartphone stand", "phone cradle"],
    excludePhrases: ["case", "cover", "wallet", "skin", "popsocket", "grip tape"],
    specificName: "phone stand",
    note: "That's a phone — you can't print the phone itself. Showing stands and docks. Add “case” if you wanted a case.",
  }),
  smartphone: hint({
    nouns: ["phone", "iphone", "smartphone"],
    queries: ["phone stand", "phone dock", "phone holder", "desk phone stand"],
    synonyms: ["smartphone stand"],
    excludePhrases: ["case", "cover", "wallet", "skin", "popsocket"],
    specificName: "phone stand",
    note: "That's a phone — you can't print the phone itself. Showing stands and docks. Add “case” if you wanted a case.",
  }),
  iphone: hint({
    nouns: ["phone", "iphone"],
    queries: ["iphone stand", "phone stand", "phone dock", "iphone holder"],
    synonyms: ["iphone dock", "phone stand"],
    excludePhrases: ["case", "cover", "wallet", "skin"],
    specificName: "iphone stand",
    note: "That's an iPhone, not a working device you can print. Showing stands and docks. Add “case” if you wanted a case.",
  }),
  laptop: hint({
    nouns: ["laptop"],
    queries: ["laptop stand", "laptop riser", "laptop holder", "laptop dock"],
    synonyms: ["notebook stand", "laptop riser"],
    excludePhrases: ["skin", "sticker", "decal"],
    specificName: "laptop stand",
    note: "That's a laptop. You can't print the computer — showing stands and risers.",
  }),
  tablet: hint({
    nouns: ["tablet", "ipad"],
    queries: ["tablet stand", "ipad stand", "tablet holder", "tablet mount"],
    synonyms: ["tablet dock"],
    excludePhrases: ["case", "cover", "folio", "skin"],
    specificName: "tablet stand",
    note: "That's a tablet. Showing stands and holders people print for one.",
  }),
  ipad: hint({
    nouns: ["ipad", "tablet"],
    queries: ["ipad stand", "tablet stand", "ipad holder", "ipad mount"],
    synonyms: ["tablet stand"],
    excludePhrases: ["case", "cover", "folio", "skin"],
    specificName: "ipad stand",
    note: "That's an iPad. Showing stands and holders people print for one.",
  }),
  headphones: hint({
    nouns: ["headphone", "headphones", "headset"],
    queries: ["headphone stand", "headphone holder", "headphone hook", "headset hanger"],
    synonyms: ["headset stand", "headphone hanger"],
    excludePhrases: [],
    specificName: "headphone stand",
    note: "That's a pair of headphones. Showing stands and hooks people print for them.",
  }),
  headphone: hint({
    nouns: ["headphone", "headphones"],
    queries: ["headphone stand", "headphone holder", "headphone hook", "headset hanger"],
    synonyms: ["headset stand"],
    excludePhrases: [],
    specificName: "headphone stand",
    note: "That's a pair of headphones. Showing stands and hooks people print for them.",
  }),
  headset: hint({
    nouns: ["headset", "headphone"],
    queries: ["headset stand", "headphone holder", "headset hook", "headphone stand"],
    synonyms: ["headphone stand"],
    excludePhrases: [],
    specificName: "headset stand",
    note: "That's a headset. Showing stands and hooks people print for one.",
  }),
};

function hint(config) {
  return {
    nouns: config.nouns,
    queries: config.queries,
    synonyms: config.synonyms,
    excludePhrases: config.excludePhrases,
    specificName: config.specificName,
    genericName: config.specificName,
    category: "printable accessory",
    note: config.note,
  };
}

export function tokenize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9+]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOP.has(token));
}

export function normalizeTitleKey(title) {
  return String(title || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function defaultStarterIdeas(name) {
  const label = String(name || "").trim() || "the object";
  return [
    `Start with a box about the size of ${label}, then hollow it with the hole tool.`,
    "Add cylinders for holes, posts, or rounded corners and group them when they look right.",
    "Keep walls around 2 mm so a typical 0.4 mm nozzle can print it cleanly.",
  ];
}

function asString(value, limit) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, limit);
}

function asStringList(value, limit, itemLimit) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const item of value) {
    const text = asString(item, itemLimit);
    if (!text) continue;
    out.push(text);
    if (out.length >= limit) break;
  }
  return out;
}

function uniqueStrings(values) {
  const out = [];
  const seen = new Set();
  for (const value of values) {
    const trimmed = String(value || "").trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

function userNamedAFunction(text) {
  return FUNCTION_WORDS.some((word) => new RegExp(`\\b${word}s?\\b`, "i").test(text));
}

function lookupHint(name) {
  const key = String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!key) return undefined;
  if (FINISHED_GOODS[key]) return FINISHED_GOODS[key];
  for (const [noun, entry] of Object.entries(FINISHED_GOODS)) {
    if (new RegExp(`\\b${noun}\\b`, "i").test(key)) return entry;
  }
  return undefined;
}

function genericDeviceHint(analysis) {
  const base = asString(analysis.genericName || analysis.specificName, 48);
  if (!base) return undefined;
  const short = base.split(/\s+/).slice(0, 3).join(" ");
  return {
    nouns: [short],
    queries: [`${short} stand`, `${short} holder`, `${short} mount`, `${short} dock`],
    synonyms: [short, `${short} holder`],
    excludePhrases: ["case", "cover", "skin", "decal"],
    specificName: `${short} stand`,
    genericName: `${short} stand`,
    category: "printable accessory",
    note: "That's a finished device, so these are stands and holders rather than the device itself.",
  };
}

export function analysisFromText(text) {
  const name = asString(text, 120);
  return {
    category: name ? "described object" : "",
    specificName: name,
    genericName: name,
    distinguishingFeatures: [],
    shape: "",
    materialGuess: "",
    kind: "other",
    isLikelyPrintable: Boolean(name),
    confidence: name ? "medium" : "low",
    searchQueries: name ? [name] : [],
    synonyms: [],
    excludePhrases: [],
    identificationNote: "",
    starterIdeas: defaultStarterIdeas(name),
  };
}

function extractJsonObject(raw) {
  const text = String(raw || "");
  const start = text.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i += 1) {
    const char = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

export function parseAnalysis(raw, fallbackText) {
  const base = analysisFromText(fallbackText);
  const json = extractJsonObject(raw);
  if (!json) return base;
  try {
    const parsed = JSON.parse(json);
    const specificName =
      asString(parsed.specificName, 120) || asString(parsed.objectName, 120) || base.specificName;
    const genericName = asString(parsed.genericName, 120) || specificName;
    const name = specificName || genericName || base.specificName;
    const searchQueries = asStringList(parsed.searchQueries, 6, 80);
    const starterIdeas = asStringList(parsed.starterIdeas, 4, 240);
    const kind = KINDS.has(parsed.kind) ? parsed.kind : "other";
    const confidence =
      parsed.confidence === "high" || parsed.confidence === "medium" || parsed.confidence === "low"
        ? parsed.confidence
        : "medium";
    return {
      category: asString(parsed.category, 80) || base.category,
      specificName: name,
      genericName: genericName || name,
      distinguishingFeatures: asStringList(parsed.distinguishingFeatures, 8, 80),
      shape: asString(parsed.shape, 80),
      materialGuess: asString(parsed.materialGuess, 80),
      kind,
      isLikelyPrintable: parsed.isLikelyPrintable !== false,
      confidence,
      searchQueries: (searchQueries.length ? searchQueries : name ? [name] : []).slice(0, 6),
      synonyms: asStringList(parsed.synonyms, 8, 80),
      excludePhrases: asStringList(parsed.excludePhrases, 8, 60),
      identificationNote: asString(parsed.identificationNote, 280),
      starterIdeas: starterIdeas.length >= 2 ? starterIdeas : defaultStarterIdeas(name),
    };
  } catch {
    return base;
  }
}

function seedUserTerms(analysis, userText) {
  const raw = asString(userText, 80);
  const searchQueries = [...(analysis.searchQueries || [])];
  if (raw) {
    const already = searchQueries.some((query) => query.toLowerCase() === raw.toLowerCase());
    const accessoryHunt = searchQueries.some((query) => userNamedAFunction(query));
    const userWantsAccessory = userNamedAFunction(raw);
    if (!already && (userWantsAccessory || !accessoryHunt)) {
      searchQueries.unshift(raw);
    }
  }
  const excludePhrases = (analysis.excludePhrases || []).filter((phrase) => {
    if (!raw) return true;
    return !raw.toLowerCase().includes(String(phrase).toLowerCase());
  });
  return {
    ...analysis,
    searchQueries: uniqueStrings(searchQueries).slice(0, 6),
    excludePhrases,
  };
}

function queriesLookSpecific(queries) {
  return (queries || []).some((query) => userNamedAFunction(query));
}

function functionWordsIn(text) {
  return FUNCTION_WORDS.filter((word) => new RegExp(`\\b${word}s?\\b`, "i").test(text));
}

function withoutConflictingQueries(queries, userText) {
  const wanted = functionWordsIn(userText);
  if (!wanted.length) return queries;
  return (queries || []).filter((query) => {
    const found = functionWordsIn(query);
    if (!found.length) return true;
    return found.every((word) => wanted.includes(word));
  });
}

export function normalizeAnalysis(analysis, userText) {
  const text = String(userText || "");
  const safe = analysis || analysisFromText(text);
  if (userNamedAFunction(text)) {
    const specific = asString(text, 120) || safe.specificName;
    const queries = lookupHint(text)
      ? withoutConflictingQueries(safe.searchQueries, text)
      : safe.searchQueries;
    return seedUserTerms(
      {
        ...safe,
        specificName: specific,
        genericName: safe.genericName || specific,
        searchQueries: queries.length ? queries : specific ? [specific] : [],
      },
      text,
    );
  }
  if (safe.kind === "toy_figure" || safe.kind === "decorative") return seedUserTerms(safe, text);
  if (queriesLookSpecific(safe.searchQueries)) return seedUserTerms(safe, text);

  const deviceHint =
    lookupHint(safe.specificName) ||
    lookupHint(safe.genericName) ||
    lookupHint(text) ||
    (safe.kind === "electronic_device" ? genericDeviceHint(safe) : undefined);
  if (!deviceHint) return seedUserTerms(safe, text);

  return seedUserTerms(
    {
      ...safe,
      category: deviceHint.category || safe.category,
      specificName: deviceHint.specificName,
      genericName: deviceHint.genericName || safe.genericName,
      searchQueries: deviceHint.queries.slice(0, 6),
      synonyms: uniqueStrings([
        ...(safe.synonyms || []),
        ...deviceHint.synonyms,
        ...deviceHint.nouns,
      ]).slice(0, 8),
      excludePhrases: safe.excludePhrases?.length ? safe.excludePhrases : deviceHint.excludePhrases,
      identificationNote: deviceHint.note,
      kind: "functional_part",
      isLikelyPrintable: true,
      confidence: safe.confidence === "low" ? "medium" : safe.confidence,
      starterIdeas: defaultStarterIdeas(deviceHint.specificName),
    },
    text,
  );
}

function includesPhrase(haystack, phrase) {
  const needle = String(phrase || "")
    .trim()
    .toLowerCase();
  if (!needle) return false;
  const hay = String(haystack || "").toLowerCase();
  if (hay.includes(needle)) return true;
  const words = tokenize(needle);
  if (words.length === 0) return false;
  const tokens = new Set(tokenize(hay));
  return words.every((word) => {
    if (tokens.has(word) || tokens.has(`${word}s`)) return true;
    if (word.endsWith("s") && tokens.has(word.slice(0, -1))) return true;
    return false;
  });
}

export function lexicalScore(model, analysis) {
  const title = String(model?.title || "");
  const lower = title.toLowerCase();
  if ((analysis?.excludePhrases || []).some((phrase) => includesPhrase(lower, phrase))) {
    return -1;
  }

  let score = 0;
  const specific = String(analysis?.specificName || "").trim();
  const generic = String(analysis?.genericName || "").trim();
  if (specific && includesPhrase(lower, specific)) score += 8;
  else score += tokenOverlap(lower, tokenize(specific)) * 1.5;

  if (
    generic &&
    generic.toLowerCase() !== specific.toLowerCase() &&
    includesPhrase(lower, generic)
  ) {
    score += 3;
  }

  for (const synonym of analysis?.synonyms || []) {
    if (includesPhrase(lower, synonym)) score += 4;
  }
  for (const query of analysis?.searchQueries || []) {
    if (includesPhrase(lower, query)) score += 5;
  }

  const likes = typeof model?.likes === "number" ? model.likes : 0;
  const downloads = typeof model?.downloads === "number" ? model.downloads : 0;
  score += Math.min(0.4, Math.log10(1 + likes * 2 + downloads * 0.35) * 0.08);
  return Math.round(score * 100) / 100;
}

function tokenOverlap(haystack, tokens) {
  const hay = new Set(tokenize(haystack));
  let count = 0;
  const seen = new Set();
  for (const token of tokens) {
    if (seen.has(token)) continue;
    seen.add(token);
    if (
      hay.has(token) ||
      hay.has(`${token}s`) ||
      (token.endsWith("s") && hay.has(token.slice(0, -1)))
    ) {
      count += 1;
    }
  }
  return count;
}

/**
 * Map an unbounded lexical score onto 0–10.
 * Capped at 7 so a title-only judgment cannot become an "exact" verdict.
 */
export function lexicalToTen(score) {
  if (!(score > 0)) return 0;
  if (score >= 12) return 7;
  if (score >= 8) return 6.5;
  if (score >= 5) return 6;
  if (score >= 3.5) return 5.2;
  if (score >= 2) return 3;
  return Math.round(Math.min(2.5, score) * 10) / 10;
}

export function prefilterCandidates(models, analysis, limit = 14) {
  const scored = [];
  for (const model of models || []) {
    const score = lexicalScore(model, analysis);
    if (score < 0) continue;
    scored.push({ model, score, thumb: model?.imageUrl ? 1 : 0 });
  }
  // Thumbnail is only a tie-break. A stronger title still stays in the shortlist
  // so the vision call can judge it from the name when the image is missing.
  scored.sort((a, b) => b.score - a.score || b.thumb - a.thumb);
  return scored.slice(0, limit).map((row) => row.model);
}

export function dedupeModels(models, limit = 40) {
  const seenUrl = new Set();
  const seenTitle = new Set();
  const out = [];
  for (const model of models || []) {
    const urlKey = String(model?.url || "")
      .trim()
      .replace(/\/+$/, "")
      .toLowerCase()
      .split("?")[0];
    const titleKey = normalizeTitleKey(model?.title);
    if (!urlKey || seenUrl.has(urlKey)) continue;
    if (titleKey && seenTitle.has(titleKey)) continue;
    seenUrl.add(urlKey);
    if (titleKey) seenTitle.add(titleKey);
    out.push(model);
    if (out.length >= limit) break;
  }
  return out;
}

export function mergeModels(groups, limit = 40) {
  const flat = [];
  for (const group of groups || []) {
    if (Array.isArray(group)) flat.push(...group);
  }
  return dedupeModels(flat, limit);
}

export function computeVerdict({ topScore10, usedVision }) {
  const score = Number(topScore10);
  const vision = Boolean(usedVision);
  if (!Number.isFinite(score) || score < 5) {
    return {
      verdict: "none",
      verdictTitle: "Nothing close",
      verdictDetail:
        "Nothing on these sites scored as a close match. Try a clearer photo or a more specific description, or design a simple version in Tinkercad.",
    };
  }
  if (vision && score >= 8) {
    return {
      verdict: "exact",
      verdictTitle: "Yes — a printable match exists",
      verdictDetail: "A free model lines up with the object in your photo.",
    };
  }
  return {
    verdict: "similar",
    verdictTitle: "Similar designs exist",
    verdictDetail: vision
      ? "These are close in type or shape, but not a perfect match."
      : "These titles look related. Designs were not compared to a photo, so this is not marked as an exact match.",
  };
}

export function isUsableThumbnailUrl(url) {
  if (typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (/^data:image\/(jpe?g|png)(;|,)/i.test(trimmed)) return true;
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  const path = decodeURIComponent(parsed.pathname).toLowerCase();
  if (/\.(jpe?g|png)$/.test(path)) return true;
  const format = (
    parsed.searchParams.get("format") ||
    parsed.searchParams.get("fm") ||
    parsed.searchParams.get("ext") ||
    ""
  ).toLowerCase();
  return format === "jpg" || format === "jpeg" || format === "png";
}

function numberOrNull(value) {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : NaN;
  return Number.isFinite(numeric) ? numeric : null;
}

export function mapPrintablesPayload(data) {
  const items = data?.data?.result?.items;
  if (!Array.isArray(items)) return [];
  const models = [];
  for (const item of items) {
    if (!item?.id || !item?.name) continue;
    const slug = item.slug ? `${item.id}-${item.slug}` : String(item.id);
    const filePath = item.image?.filePath;
    models.push({
      id: `printables-${item.id}`,
      title: String(item.name),
      url: `https://www.printables.com/model/${slug}`,
      imageUrl: filePath ? `https://media.printables.com/${String(filePath)}` : null,
      site: "printables",
      likes: numberOrNull(item.likesCount),
      downloads: numberOrNull(item.downloadCount),
      author: item.user?.publicUsername ? String(item.user.publicUsername) : null,
    });
  }
  return models;
}

export function mapThangsPayload(data, limit = 8) {
  const results = Array.isArray(data?.results) ? data.results : [];
  const models = [];
  for (const item of results) {
    if (!item?.modelId || !item?.name || item.marketplaceInfo) continue;
    const thumb =
      (typeof item.thumbnailUrl === "string" && item.thumbnailUrl) ||
      (Array.isArray(item.thumbnails)
        ? item.thumbnails.find((entry) => typeof entry === "string")
        : "") ||
      "";
    models.push({
      id: `thangs-${item.modelId}`,
      title: String(item.name),
      url: item.modelPageUrl ? String(item.modelPageUrl) : `https://thangs.com/m/${item.modelId}`,
      imageUrl: thumb || null,
      site: "thangs",
      likes: numberOrNull(item.likesCount),
      downloads: numberOrNull(item.downloadCount),
      author: item.ownerUsername ? String(item.ownerUsername) : null,
    });
    if (models.length >= limit) break;
  }
  return models;
}

export function mapMakerWorldPayload(data, limit = 8) {
  const hits = Array.isArray(data?.hits) ? data.hits : [];
  const models = [];
  for (const hit of hits) {
    if (hit?.id == null || !hit?.title || hit.nsfw === true) continue;
    const slug =
      typeof hit.slug === "string" && /^[a-z0-9-]+$/i.test(hit.slug) ? `-${hit.slug}` : "";
    const creator = hit.designCreator || {};
    models.push({
      id: `makerworld-${hit.id}`,
      title: String(hit.title),
      url: `https://makerworld.com/en/models/${hit.id}${slug}`,
      imageUrl: typeof hit.cover === "string" ? hit.cover : null,
      site: "makerworld",
      likes: numberOrNull(hit.likeCount),
      downloads: numberOrNull(hit.downloadCount),
      author: creator.name ? String(creator.name) : creator.handle ? String(creator.handle) : null,
    });
    if (models.length >= limit) break;
  }
  return models;
}

export function mapThingiversePayload(data, limit = 8) {
  const hits = Array.isArray(data)
    ? data
    : Array.isArray(data?.hits)
      ? data.hits
      : Array.isArray(data?.things)
        ? data.things
        : [];
  const models = [];
  for (const hit of hits) {
    const title = hit?.name || hit?.title;
    if (hit?.id == null || !title) continue;
    const creator = hit.creator || {};
    const image = hit.thumbnail || hit.preview_image || hit.default_image?.url || null;
    models.push({
      id: `thingiverse-${hit.id}`,
      title: String(title),
      url:
        typeof hit.public_url === "string" && hit.public_url
          ? hit.public_url
          : `https://www.thingiverse.com/thing:${hit.id}`,
      imageUrl: typeof image === "string" ? image : null,
      site: "thingiverse",
      likes: numberOrNull(hit.like_count ?? hit.likes),
      downloads: numberOrNull(hit.download_count ?? hit.downloads),
      author: creator.name
        ? String(creator.name)
        : creator.username
          ? String(creator.username)
          : null,
    });
    if (models.length >= limit) break;
  }
  return models;
}
