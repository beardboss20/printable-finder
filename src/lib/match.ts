import type { Analysis, PrintableModel } from "./types";

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

type Hint = {
  nouns: string[];
  queries: string[];
  requiredPhrases: string[];
  excludePhrases: string[];
  intent: string;
  note: string;
};

const FINISHED_GOODS: Record<string, Hint> = {
  phone: {
    nouns: ["phone", "iphone", "smartphone"],
    queries: ["phone stand", "phone dock", "phone holder"],
    requiredPhrases: ["stand", "dock", "holder", "mount"],
    excludePhrases: ["case", "cover", "wallet", "skin", "popsocket", "grip tape"],
    intent: "a stand, dock, or holder for a phone",
    note: "That's a phone — you can't print the phone itself. Here are stands and docks people print for one. Want a case instead? Add “case” to the description.",
  },
  smartphone: {
    nouns: ["phone", "iphone", "smartphone"],
    queries: ["phone stand", "phone dock", "phone holder"],
    requiredPhrases: ["stand", "dock", "holder", "mount"],
    excludePhrases: ["case", "cover", "wallet", "skin", "popsocket"],
    intent: "a stand, dock, or holder for a phone",
    note: "That's a phone — you can't print the phone itself. Here are stands and docks people print for one. Want a case instead? Add “case” to the description.",
  },
  iphone: {
    nouns: ["phone", "iphone"],
    queries: ["iphone stand", "phone stand", "phone dock"],
    requiredPhrases: ["stand", "dock", "holder", "mount"],
    excludePhrases: ["case", "cover", "wallet", "skin"],
    intent: "a stand or dock for an iPhone",
    note: "That's an iPhone — not something you print as a working device. Here are stands and docks. Add “case” if that's what you wanted.",
  },
  laptop: {
    nouns: ["laptop"],
    queries: ["laptop stand", "laptop riser"],
    requiredPhrases: ["stand", "riser", "holder"],
    excludePhrases: ["skin", "sticker", "decal"],
    intent: "a laptop stand or riser",
    note: "That's a laptop. You can't print the computer — here are stands and risers.",
  },
  tablet: {
    nouns: ["tablet", "ipad"],
    queries: ["tablet stand", "ipad stand"],
    requiredPhrases: ["stand", "holder", "mount"],
    excludePhrases: ["case", "cover", "folio", "skin"],
    intent: "a tablet stand or holder",
    note: "That's a tablet. Here are stands and holders people print for one.",
  },
  ipad: {
    nouns: ["ipad", "tablet"],
    queries: ["ipad stand", "tablet stand"],
    requiredPhrases: ["stand", "holder", "mount"],
    excludePhrases: ["case", "cover", "folio", "skin"],
    intent: "an iPad stand or holder",
    note: "That's an iPad. Here are stands and holders people print for one.",
  },
  headphones: {
    nouns: ["headphone", "headset"],
    queries: ["headphone stand", "headphone holder", "headphone hook"],
    requiredPhrases: ["stand", "holder", "hook", "hanger"],
    excludePhrases: [],
    intent: "a headphone stand or hook",
    note: "That's a pair of headphones. Here are stands and hooks people print for them.",
  },
  headset: {
    nouns: ["headset", "headphone"],
    queries: ["headset stand", "headphone holder"],
    requiredPhrases: ["stand", "holder", "hook"],
    excludePhrases: [],
    intent: "a headset stand or hook",
    note: "That's a headset. Here are stands and hooks people print for one.",
  },
};

function userNamedAFunction(text: string): boolean {
  return FUNCTION_WORDS.some((word) => new RegExp(`\\b${word}s?\\b`, "i").test(text));
}

function lookupHint(name: string): Hint | undefined {
  const key = name.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").trim();
  if (FINISHED_GOODS[key]) return FINISHED_GOODS[key];
  for (const [noun, hint] of Object.entries(FINISHED_GOODS)) {
    if (new RegExp(`\\b${noun}\\b`, "i").test(key)) return hint;
  }
  return undefined;
}

export function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9+]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOP.has(token));
}

function includesPhrase(haystack: string, phrase: string): boolean {
  const needle = phrase.trim().toLowerCase();
  if (!needle) return false;
  if (haystack.includes(needle)) return true;
  const words = tokenize(needle);
  if (words.length === 0) return false;
  const hay = new Set(tokenize(haystack));
  return words.every((word) => hay.has(word) || hay.has(`${word}s`));
}

export function normalizeAnalysis(analysis: Analysis, userText: string): Analysis {
  const named = userNamedAFunction(`${userText} ${analysis.searchQueries.join(" ")}`);
  if (named) {
    return seedUserTerms(analysis, userText);
  }

  const hint = lookupHint(analysis.objectName) ?? lookupHint(userText);
  if (!hint) return seedUserTerms(analysis, userText);

  const queriesLookGeneric = analysis.searchQueries.every((query) => {
    const tokens = tokenize(query);
    return tokens.length <= 2 && !tokens.some((token) => FUNCTION_WORDS.includes(token));
  });
  if (!queriesLookGeneric && analysis.requiredPhrases.length > 0) {
    return seedUserTerms(analysis, userText);
  }

  return seedUserTerms(
    {
      ...analysis,
      searchQueries: hint.queries,
      intent: analysis.intent || hint.intent,
      coreNouns: analysis.coreNouns.length ? analysis.coreNouns : hint.nouns,
      requiredPhrases: analysis.requiredPhrases.length
        ? analysis.requiredPhrases
        : hint.requiredPhrases,
      excludePhrases: analysis.excludePhrases.length
        ? analysis.excludePhrases
        : hint.excludePhrases,
      identificationNote: hint.note,
      objectName: hint.queries[0] ?? analysis.objectName,
      isLikelyPrintable: true,
      confidence: analysis.confidence === "low" ? "medium" : analysis.confidence,
    },
    userText,
  );
}

function seedUserTerms(analysis: Analysis, userText: string): Analysis {
  const extra = tokenize(userText).filter((token) => token.length >= 4);
  const coreNouns = [...analysis.coreNouns];
  for (const token of extra) {
    if (!coreNouns.some((noun) => noun.toLowerCase() === token)) coreNouns.push(token);
  }

  const searchQueries = [...analysis.searchQueries];
  const raw = userText.trim();
  const finishedGood = Boolean(lookupHint(raw));
  const named = userNamedAFunction(raw);
  if (
    raw &&
    (!finishedGood || named) &&
    !searchQueries.some((query) => query.toLowerCase() === raw.toLowerCase())
  ) {
    searchQueries.unshift(raw);
  }

  return { ...analysis, coreNouns, searchQueries: searchQueries.slice(0, 3) };
}

export function relevanceScore(
  model: PrintableModel,
  analysis: Analysis,
  mode: "strict" | "relaxed" | "loose" = "strict",
): number {
  const title = model.title.toLowerCase();
  if (analysis.excludePhrases.some((phrase) => includesPhrase(title, phrase))) {
    return -1;
  }

  const nouns =
    analysis.coreNouns.length > 0
      ? analysis.coreNouns
      : analysis.searchQueries.flatMap(tokenize);

  if (mode !== "loose" && nouns.length > 0) {
    const hasNoun = nouns.some((noun) => includesPhrase(title, noun));
    if (!hasNoun) return -1;
  }

  if (mode === "strict" && analysis.requiredPhrases.length > 0) {
    const hasRequired = analysis.requiredPhrases.some((phrase) =>
      includesPhrase(title, phrase),
    );
    if (!hasRequired) return -1;
  }

  if (mode === "loose") {
    const needles = [
      ...nouns,
      ...analysis.searchQueries,
      ...tokenize(analysis.objectName),
    ].filter((token) => tokenize(token).join("").length >= 4);
    const hit = needles.some((needle) => includesPhrase(title, needle));
    if (!hit) return -1;
  }

  const titleTokens = new Set(tokenize(model.title));
  const wanted = new Set(
    [
      ...analysis.searchQueries.flatMap(tokenize),
      ...analysis.coreNouns.flatMap(tokenize),
      ...analysis.requiredPhrases.flatMap(tokenize),
      ...tokenize(analysis.intent),
    ].filter(Boolean),
  );

  let overlap = 0;
  for (const token of wanted) {
    if (titleTokens.has(token) || titleTokens.has(`${token}s`)) overlap += 1;
  }

  const queryHit = analysis.searchQueries.some((query) => includesPhrase(title, query));
  const likes = model.likes ?? 0;
  const downloads = model.downloads ?? 0;
  const popularity = Math.log10(1 + likes * 2 + downloads * 0.35);
  const siteBonus = model.site === "printables" ? 0.4 : 0;
  return overlap * 3 + (queryHit ? 4 : 0) + popularity + siteBonus;
}

function mixBySite(scored: PrintableModel[], limit: number): PrintableModel[] {
  const picked: PrintableModel[] = [];
  const printables = scored.filter((model) => model.site === "printables");
  const others = scored.filter((model) => model.site !== "printables");
  while (picked.length < limit && (printables.length || others.length)) {
    if (printables.length) picked.push(printables.shift()!);
    if (picked.length >= limit) break;
    if (others.length) picked.push(others.shift()!);
  }
  return picked;
}

export function pickRelevantModels(
  models: PrintableModel[],
  analysis: Analysis,
  limit = 6,
): PrintableModel[] {
  const rank = (mode: "strict" | "relaxed" | "loose") =>
    models
      .map((model) => ({ model, score: relevanceScore(model, analysis, mode) }))
      .filter((row) => row.score >= 0)
      .sort((a, b) => b.score - a.score)
      .map((row) => row.model);

  const strict = rank("strict");
  if (strict.length >= 3) return mixBySite(strict, limit);

  const relaxed = rank("relaxed");
  if (relaxed.length >= 2) return mixBySite(relaxed, limit);

  return mixBySite(rank("loose"), limit);
}

export async function rerankWithGrok(
  models: PrintableModel[],
  analysis: Analysis,
): Promise<PrintableModel[] | null> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey || models.length <= 3) return null;

  const listed = models.slice(0, 16);
  const prompt = `You rank 3D printable model titles for relevance.

The user is looking for: ${analysis.intent || analysis.objectName}
Search phrases: ${analysis.searchQueries.join(", ")}

Keep models that are clearly about this topic — including replicas, toys, bats, trophies, fidgets, hooks, and nearby accessories.
Only drop titles that are clearly about something else.
Do not return an empty list if several titles mention the topic.
Prefer 4 to 6 items, best first.

Return JSON: {"keep":[ids]}.

${listed.map((model, index) => `${index + 1}. ${model.title}`).join("\n")}`;

  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        max_tokens: 220,
        temperature: 0,
        messages: [{ role: "user", content: prompt }],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "rerank",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["keep"],
              properties: {
                keep: {
                  type: "array",
                  items: { type: "integer" },
                  minItems: 0,
                  maxItems: 6,
                },
              },
            },
          },
        },
      }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = body.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? "null") as {
      keep?: unknown;
    } | null;
    if (!parsed || !Array.isArray(parsed.keep)) return null;
    const picked: PrintableModel[] = [];
    const seen = new Set<string>();
    for (const value of parsed.keep) {
      const index = typeof value === "number" ? value : Number(value);
      const model = listed[index - 1] ?? listed[index];
      if (!model || seen.has(model.id)) continue;
      seen.add(model.id);
      picked.push(model);
    }
    return picked.length ? picked.slice(0, 6) : null;
  } catch {
    return null;
  }
}

