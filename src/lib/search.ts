import { createServerFn } from "@tanstack/react-start";
import { analyzeRequest } from "./analyze";
import { searchCatalog } from "./catalog";
import { userFacingNote } from "./copy";
import { rankCandidates } from "./match";
import { computeVerdict } from "./rank-core.js";
import { siteSearchLinks } from "./sites";
import {
  descriptionFromAnalysis,
  emptyDescription,
  type SearchInput,
  type SearchOutcome,
  type TimingsMs,
} from "./types";

const recentHits: number[] = [];
const DEADLINE_MS = 35_000;

function allowRequest(): boolean {
  const now = Date.now();
  while (recentHits.length && now - recentHits[0]! > 60_000) recentHits.shift();
  if (recentHits.length >= 20) return false;
  recentHits.push(now);
  return true;
}

function validateInput(input: SearchInput): SearchInput {
  const text = typeof input?.text === "string" ? input.text.trim().slice(0, 240) : "";
  let imageDataUrl: string | undefined;
  if (typeof input?.imageDataUrl === "string" && input.imageDataUrl.startsWith("data:image/")) {
    if (input.imageDataUrl.length > 2_400_000) {
      throw new Error("Photo is too large. Try a smaller image.");
    }
    if (!/^data:image\/(?:jpeg|png)[;,]/i.test(input.imageDataUrl)) {
      throw new Error("Couldn't read this photo format — try a JPG/PNG or a screenshot");
    }
    imageDataUrl = input.imageDataUrl;
  }
  if (!text && !imageDataUrl) {
    throw new Error("Add a photo or a short description first.");
  }
  return { text, imageDataUrl };
}

function needsDescription(message: string, timings: TimingsMs): SearchOutcome {
  const configured = message.includes("isn't configured");
  return {
    status: "needs_description",
    verdict: "none",
    verdictTitle: configured
      ? "Photo recognition isn't configured on this server yet"
      : "Photo recognition is unavailable right now",
    verdictDetail: "Please type what the object is.",
    objectName: "",
    description: emptyDescription(),
    models: [],
    siteStatus: [],
    siteSearches: [],
    queriesUsed: [],
    starterIdeas: [],
    usedVision: false,
    timingsMs: timings,
  };
}

async function runSearch(data: SearchInput): Promise<SearchOutcome> {
  const started = Date.now();
  const left = () => DEADLINE_MS - (Date.now() - started);

  const analyzeStarted = Date.now();
  const analyzed = await analyzeRequest(data, Math.min(12_000, Math.max(1_000, left() - 1_000)));
  const analyzeMs = Date.now() - analyzeStarted;
  if (analyzed.status === "needs_description") {
    return needsDescription(analyzed.message, {
      analyze: analyzeMs,
      search: 0,
      rank: 0,
      total: Date.now() - started,
    });
  }

  const queries = analyzed.analysis.searchQueries.filter(Boolean).slice(0, 4);
  if (!queries.length && data.text) queries.push(data.text);
  if (!queries.length) {
    return needsDescription(
      "Photo recognition is unavailable right now. Please type what the object is.",
      {
        analyze: analyzeMs,
        search: 0,
        rank: 0,
        total: Date.now() - started,
      },
    );
  }

  const searchStarted = Date.now();
  const catalog = await searchCatalog(queries);
  const searchMs = Date.now() - searchStarted;

  const rankStarted = Date.now();
  let ranked: Awaited<ReturnType<typeof rankCandidates>> = { models: [], usedVision: false };
  if (catalog.models.length && left() > 1_200) {
    ranked = await rankCandidates({
      models: catalog.models,
      analysis: analyzed.analysis,
      imageDataUrl: analyzed.photoAnalyzed ? data.imageDataUrl : undefined,
      timeoutMs: Math.min(15_000, Math.max(0, left() - 400)),
    });
  }
  const rankMs = Date.now() - rankStarted;

  const top10 = ranked.models[0] ? ranked.models[0].matchScore * 10 : 0;
  const verdict = computeVerdict({ topScore10: top10, usedVision: ranked.usedVision });
  const note = userFacingNote(
    analyzed.analysis.identificationNote,
    ranked.models.length ? "success" : "empty",
  );
  const detail = [verdict.verdictDetail, analyzed.photoNote, note].filter(Boolean).join(" ");
  const bestQuery = queries[0] || analyzed.analysis.specificName || data.text;

  return {
    status: "ok",
    verdict: verdict.verdict,
    verdictTitle: verdict.verdictTitle,
    verdictDetail: detail,
    objectName: analyzed.analysis.specificName || data.text,
    description: descriptionFromAnalysis(analyzed.analysis),
    models: ranked.models,
    siteStatus: catalog.siteStatus,
    siteSearches: siteSearchLinks(bestQuery),
    queriesUsed: queries,
    starterIdeas: analyzed.analysis.starterIdeas,
    usedVision: ranked.usedVision,
    timingsMs: {
      analyze: analyzeMs,
      search: searchMs,
      rank: rankMs,
      total: Date.now() - started,
    },
  };
}

export const findPrintableModels = createServerFn({ method: "POST" })
  .validator((input: SearchInput) => validateInput(input))
  .handler(async ({ data }): Promise<SearchOutcome> => {
    if (!allowRequest()) {
      throw new Error("A lot of searches just ran. Wait a few seconds and try again.");
    }

    const work = runSearch(data);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        work,
        new Promise<SearchOutcome>((_, reject) => {
          timer = setTimeout(() => reject(new Error("DEADLINE")), DEADLINE_MS);
        }),
      ]);
    } catch (err) {
      if (err instanceof Error && err.message === "DEADLINE") {
        void work.catch(() => {});
        console.error("[search] deadline exceeded");
        throw new Error("That search took too long. Try again in a moment.");
      }
      if (err instanceof Error && err.message) {
        console.error("[search] failed", err.message.slice(0, 180));
      } else {
        console.error("[search] failed");
      }
      throw new Error("Something went sideways. Try again.");
    } finally {
      if (timer) clearTimeout(timer);
    }
  });
