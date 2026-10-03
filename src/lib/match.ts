import {
  isUsableThumbnailUrl,
  lexicalScore,
  lexicalToTen,
  prefilterCandidates,
} from "./rank-core.js";
import { SITE_LABEL } from "./sites";
import type { Analysis, PrintableModel, RankedModel } from "./types";
import { xaiChat } from "./xai";

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
        required: ["index", "score", "reason"],
        properties: {
          index: { type: "integer" },
          score: { type: "integer" },
          reason: { type: "string" },
        },
      },
    },
  },
} as const;

type ScoreRow = { score: number; reason: string };

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
      const record = row as { index?: unknown; score?: unknown; reason?: unknown };
      const index = typeof record.index === "number" ? record.index : Number(record.index);
      const score = clampScore(record.score);
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

function visionThumbnail(url: string | null): string | null {
  if (!url || !isUsableThumbnailUrl(url)) return null;
  if (url.startsWith("data:image/")) return url;
  if (url.startsWith("https://")) return url;
  return null;
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
    if (!row || row.score < 4) return;
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
    .sort((a, b) => b.ten - a.ten)
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
      text: `The first image is the user's photo.\n${intentText(analysis)}\n\nScore every candidate from 0 to 10 for how closely the 3D model matches the object in the photo (same object type and function, similar shape and style). 10 is the same kind of thing. 5 is related. 0-3 is a different object. If the note says the photo is a finished device and we are hunting an accessory, score the accessory, not whether the model looks like the device. Candidates without an image are judged by title only. Return one JSON score per candidate index, with a short reason.`,
    },
    { type: "image_url", image_url: { url: imageDataUrl, detail: "auto" } },
  ];

  candidates.forEach((model, index) => {
    const label = `Candidate ${index + 1}: ${model.title} (${SITE_LABEL[model.site]})`;
    const thumb = visionThumbnail(model.imageUrl);
    content.push({
      type: "text",
      text: thumb ? label : `${label}\n(no usable photo — judge by title only)`,
    });
    if (thumb) {
      content.push({ type: "image_url", image_url: { url: thumb, detail: "low" } });
    }
  });

  const result = await xaiChat({
    content,
    schemaName: "model_scores",
    schema: SCORE_SCHEMA,
    maxTokens: 900,
    temperature: 0,
    timeoutMs,
  });
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

Give each title an integer score from 0 to 10. 10 means the title is clearly that object or the accessory we are hunting. 5 means related. 0-3 means a different object. Drop nothing from the JSON; score every index. Reason is one short sentence.

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
}): Promise<{ models: RankedModel[]; usedVision: boolean }> {
  const shortlist = prefilterCandidates(input.models, input.analysis, 14);
  if (shortlist.length === 0) return { models: [], usedVision: false };

  const budget = Math.max(0, input.timeoutMs ?? 15_000);
  const started = Date.now();
  const hasKey = Boolean(process.env.XAI_API_KEY?.trim());
  const photo = input.imageDataUrl;

  if (hasKey && photo && budget >= 2_000) {
    const visionTimeout = Math.min(15_000, budget);
    const vision = await visionRank(shortlist, input.analysis, photo, visionTimeout);
    if (vision) return { models: vision, usedVision: true };
  }

  const elapsed = Date.now() - started;
  const remaining = budget - elapsed;
  if (hasKey && remaining >= 2_000) {
    const text = await textRank(shortlist, input.analysis, Math.min(8_000, remaining));
    if (text) return { models: text, usedVision: false };
  }

  return { models: lexicalRank(shortlist, input.analysis), usedVision: false };
}
