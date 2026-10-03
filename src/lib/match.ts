import {
  compareLexical,
  isUsableThumbnailUrl,
  lexicalScore,
  lexicalToTen,
  prefilterCandidates,
} from "./rank-core.js";
import { SITE_LABEL } from "./sites";
import type { Analysis, PrintableModel, RankedModel } from "./types";
import { xaiChat, xaiCoolingDown } from "./xai";

const SCORE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["scores"],
  properties: {
    scores: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["index", "sameObjectType", "keyFeaturesMatch", "score", "reason"],
        properties: {
          index: { type: "integer" },
          sameObjectType: { type: "boolean" },
          keyFeaturesMatch: { type: "boolean" },
          score: { type: "integer" },
          reason: { type: "string" },
        },
      },
    },
  },
} as const;

type ScoreRow = { score: number; reason: string };

// Scores below this (0-10 scale) are dropped as weak matches.
const MIN_SCORE = 5;

const RUBRIC = `Scoring rubric (integers 0-10):
- 9-10: essentially the same object as the photo; printing it would give the user what they photographed.
- 7-8: same object type and function with a similar shape.
- 5-6: same object type but a noticeably different shape or style, or a very close relative (e.g. a plain coat hook for an ornate brass wall hook).
- 2-4: only loosely related (same broad category, or shares one feature).
- 0-1: a different object. Sharing a word is not enough: a "top hat" printer part is 0 for a figurine wearing a top hat.
Decide sameObjectType first: true only if the candidate is the same kind of object with the same purpose (a figurine/statue for a figurine, a hook for a hook, a planter/pot for a planter). Functional printer parts, tools, or brackets are never the same type as a decorative figure, and vice versa. If sameObjectType is false the score must be 0-3.
keyFeaturesMatch: true only if the candidate's own picture visibly has the photographed object's shape-defining features (ignore color, material, and finish). A plain knob does not match a star-shaped knob. Title-only candidates (no picture) are always false. Scores of 9-10 require keyFeaturesMatch true.
Be strict. Most candidates from a keyword search should score below 7.`;

function clampScore(value: unknown): number | null {
  const score = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(score)) return null;
  return Math.max(0, Math.min(10, score));
}

function parseScoreMap(raw: string, count: number): Map<number, ScoreRow> | null {
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as { scores?: unknown };
    if (!parsed || !Array.isArray(parsed.scores)) return null;
    const map = new Map<number, ScoreRow>();
    for (const row of parsed.scores) {
      if (!row || typeof row !== "object") continue;
      const record = row as {
        index?: unknown;
        score?: unknown;
        reason?: unknown;
        sameObjectType?: unknown;
        keyFeaturesMatch?: unknown;
      };
      const index = typeof record.index === "number" ? record.index : Number(record.index);
      let score = clampScore(record.score);
      // A different kind of object can never be a real match, whatever the score says.
      if (score != null && record.sameObjectType === false) score = Math.min(score, 3);
      // 9-10 ("essentially the same object") also needs the photo's shape-defining
      // features to be visible in the candidate; otherwise it is at best "similar".
      if (score != null && record.keyFeaturesMatch !== true) score = Math.min(score, 8);
      if (!Number.isInteger(index) || index < 1 || index > count || score == null) continue;
      const reason =
        typeof record.reason === "string"
          ? record.reason.replace(/\s+/g, " ").trim().slice(0, 180)
          : "";
      map.set(index, { score, reason });
    }
    return map.size ? map : null;
  } catch {
    return null;
  }
}

const THUMB_TIMEOUT_MS = 2_500;
const THUMB_MAX_BYTES = 600_000;

/** Ask each site's CDN for a small thumbnail instead of the full-size photo. */
export function smallThumbUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "media.printables.com" && !parsed.pathname.includes("/thumbs/")) {
      // media/prints/<id>/images/<dir>/<file>.jpg -> .../<dir>/thumbs/inside/320x240/jpg/<file>.jpg
      const parts = parsed.pathname.split("/");
      const file = parts.pop() || "";
      const base = file.replace(/\.[a-z0-9]+$/i, "");
      return `${parsed.origin}${parts.join("/")}/thumbs/inside/320x240/jpg/${base}.jpg`;
    }
    if (parsed.hostname.endsWith("bblmw.com") && !parsed.search) {
      return `${url}?x-oss-process=image/resize,w_320/format,png`;
    }
  } catch {
    /* fall through */
  }
  return url;
}

function sniffType(buf: Buffer): "image/jpeg" | "image/png" | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length > 8 && buf[0] === 0x89 && buf.toString("latin1", 1, 4) === "PNG")
    return "image/png";
  return null;
}

async function download(url: string, signal: AbortSignal): Promise<string | null> {
  const res = await fetch(url, {
    signal,
    headers: {
      Accept: "image/jpeg,image/png;q=0.9,*/*;q=0.5",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    },
  });
  if (!res.ok) return null;
  const declared = Number(res.headers.get("content-length") || 0);
  if (declared > THUMB_MAX_BYTES) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength === 0 || buf.byteLength > THUMB_MAX_BYTES) return null;
  // Some CDNs label images application/octet-stream (or serve WebP); xAI accepts only
  // JPEG/PNG, so trust the bytes, not the header.
  const type = sniffType(buf);
  if (!type) return null;
  return `data:${type};base64,${buf.toString("base64")}`;
}

/**
 * Download a candidate thumbnail ourselves and inline it as a data URL.
 * Passing remote URLs made xAI fetch them and occasionally fail the whole call
 * with a 400. Small CDN variants keep the rerank request (and latency) small.
 */
async function fetchThumbnail(url: string | null, signal: AbortSignal): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith("data:image/")) return isUsableThumbnailUrl(url) ? url : null;
  if (!url.startsWith("https://")) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), THUMB_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal.addEventListener("abort", onAbort, { once: true });
  try {
    const small = smallThumbUrl(url);
    const got = await download(small, controller.signal).catch(() => null);
    if (got || small === url || controller.signal.aborted) return got;
    return await download(url, controller.signal);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", onAbort);
  }
}

function toRanked(model: PrintableModel, score10: number, reason: string): RankedModel {
  const clamped = Math.max(0, Math.min(10, score10));
  return {
    ...model,
    matchScore: Math.round((clamped / 10) * 100) / 100,
    matchReason: reason || "Close to the object you described.",
  };
}

function applyScores(
  candidates: PrintableModel[],
  scores: Map<number, ScoreRow>,
  fallbackReason: string,
): RankedModel[] {
  const ranked: RankedModel[] = [];
  candidates.forEach((model, index) => {
    const row = scores.get(index + 1);
    if (!row || row.score < MIN_SCORE) return;
    ranked.push(toRanked(model, row.score, row.reason || fallbackReason));
  });
  ranked.sort((a, b) => b.matchScore - a.matchScore);
  return ranked.slice(0, 8);
}

function lexicalRank(candidates: PrintableModel[], analysis: Analysis): RankedModel[] {
  return candidates
    .map((model) => {
      const ten = lexicalToTen(lexicalScore(model, analysis));
      const reason =
        ten >= 6
          ? "Title matches the object name or a close search phrase."
          : "Title shares the object name or a synonym.";
      return { model, ten, reason };
    })
    .filter((row) => row.ten >= 4)
    .sort((a, b) => compareLexical(a.model, b.model, analysis))
    .slice(0, 8)
    .map((row) => toRanked(row.model, row.ten, row.reason));
}

function candidateLines(candidates: PrintableModel[]): string {
  return candidates
    .map((model, index) => `${index + 1}. ${model.title} (${SITE_LABEL[model.site]})`)
    .join("\n");
}

function intentText(analysis: Analysis): string {
  return [
    `Printable thing we are hunting: ${analysis.specificName || analysis.genericName}`,
    analysis.genericName ? `Generic name: ${analysis.genericName}` : "",
    `Kind: ${analysis.kind}`,
    analysis.shape ? `Shape: ${analysis.shape}` : "",
    analysis.distinguishingFeatures.length
      ? `Features: ${analysis.distinguishingFeatures.join(", ")}`
      : "",
    analysis.searchQueries.length ? `Search phrases: ${analysis.searchQueries.join("; ")}` : "",
    analysis.identificationNote ? `Note: ${analysis.identificationNote}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

async function visionRank(
  candidates: PrintableModel[],
  analysis: Analysis,
  imageDataUrl: string,
  timeoutMs: number,
): Promise<RankedModel[] | null> {
  const content: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string; detail?: "low" | "high" | "auto" } }
  > = [
    {
      type: "text",
      text: `The first image is the user's photo.\n${intentText(analysis)}\n\nScore every candidate for how closely the 3D model matches the object in the photo (same object type and function, similar shape and style).\n\n${RUBRIC}\n\nIf the note says the photo is a finished device and we are hunting an accessory, score the accessory, not whether the model looks like the device. Candidates without an image are judged by title only. Return one JSON score per candidate index, with a reason of at most 8 words.`,
    },
    { type: "image_url", image_url: { url: imageDataUrl, detail: "auto" } },
  ];

  const thumbAbort = new AbortController();
  const thumbStarted = Date.now();
  const thumbs = await Promise.all(
    candidates.map((model) => fetchThumbnail(model.imageUrl, thumbAbort.signal)),
  );
  const thumbMs = Date.now() - thumbStarted;
  const thumbBytes = thumbs.reduce((n, t) => n + (t ? t.length : 0), 0);
  candidates.forEach((model, index) => {
    const label = `Candidate ${index + 1}: ${model.title} (${SITE_LABEL[model.site]})`;
    const thumb = thumbs[index];
    content.push({
      type: "text",
      text: thumb ? label : `${label}\n(no usable photo — judge by title only)`,
    });
    if (thumb) {
      content.push({ type: "image_url", image_url: { url: thumb, detail: "low" } });
    }
  });

  const callStarted = Date.now();
  const result = await xaiChat({
    content,
    schemaName: "model_scores",
    schema: SCORE_SCHEMA,
    maxTokens: 900,
    temperature: 0,
    timeoutMs,
  });
  console.log(
    `[match] vision rerank thumbs=${thumbs.filter(Boolean).length}/${candidates.length} thumbKB=${Math.round(thumbBytes / 1024)} thumbMs=${thumbMs} xaiMs=${Date.now() - callStarted} ok=${result.ok}`,
  );
  if (!result.ok) {
    console.error("[match] vision rerank failed", result.reason, result.status ?? "");
    return null;
  }
  const scores = parseScoreMap(result.content, candidates.length);
  if (!scores) {
    console.error("[match] vision rerank returned no scores");
    return null;
  }
  return applyScores(candidates, scores, "Visually close to the object in your photo.");
}

async function textRank(
  candidates: PrintableModel[],
  analysis: Analysis,
  timeoutMs: number,
): Promise<RankedModel[] | null> {
  const prompt = `Score these 3D-printable model titles for the object below.

${intentText(analysis)}

Give each title an integer score from 0 to 10 using this rubric, judging by title only:
${RUBRIC}

Drop nothing from the JSON; score every index. Reason is at most 8 words.

${candidateLines(candidates)}`;

  const result = await xaiChat({
    content: prompt,
    schemaName: "model_scores",
    schema: SCORE_SCHEMA,
    maxTokens: 700,
    temperature: 0,
    timeoutMs,
  });
  if (!result.ok) {
    console.error("[match] text rerank failed", result.reason, result.status ?? "");
    return null;
  }
  const scores = parseScoreMap(result.content, candidates.length);
  if (!scores) return null;
  return applyScores(candidates, scores, "Title looks related to the object.");
}

export async function rankCandidates(input: {
  models: PrintableModel[];
  analysis: Analysis;
  imageDataUrl?: string;
  timeoutMs?: number;
}): Promise<{ models: RankedModel[]; usedVision: boolean; rateLimited: boolean }> {
  const shortlist = prefilterCandidates(input.models, input.analysis, 14);
  if (shortlist.length === 0) return { models: [], usedVision: false, rateLimited: false };

  const budget = Math.max(0, input.timeoutMs ?? 15_000);
  const started = Date.now();
  const hasKey = Boolean(process.env.XAI_API_KEY?.trim());
  const photo = input.imageDataUrl;

  if (hasKey && photo && budget >= 2_000) {
    const visionTimeout = Math.min(10_000, budget);
    const vision = await visionRank(shortlist, input.analysis, photo, visionTimeout);
    if (vision) return { models: vision, usedVision: true, rateLimited: false };
  }

  const elapsed = Date.now() - started;
  const remaining = budget - elapsed;
  if (hasKey && remaining >= 2_000 && !xaiCoolingDown()) {
    const text = await textRank(shortlist, input.analysis, Math.min(5_000, remaining));
    if (text) return { models: text, usedVision: false, rateLimited: false };
  }

  return {
    models: lexicalRank(shortlist, input.analysis),
    usedVision: false,
    rateLimited: hasKey && xaiCoolingDown(),
  };
}
