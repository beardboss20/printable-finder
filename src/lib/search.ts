import { createServerFn } from "@tanstack/react-start";
import { analyzeRequest } from "./analyze";
import { searchCatalog } from "./catalog";
import { userFacingNote } from "./copy";
import { normalizeAnalysis, pickRelevantModels, rerankWithGrok } from "./match";
import { siteSearchLinks } from "./sites";
import type { SearchInput, SearchOutcome } from "./types";

const recentHits: number[] = [];

function allowRequest(): boolean {
  const now = Date.now();
  while (recentHits.length && now - recentHits[0]! > 60_000) recentHits.shift();
  if (recentHits.length >= 20) return false;
  recentHits.push(now);
  return true;
}

function validateInput(input: SearchInput): SearchInput {
  const text = typeof input.text === "string" ? input.text.trim().slice(0, 240) : "";
  let imageDataUrl: string | undefined;
  if (typeof input.imageDataUrl === "string" && input.imageDataUrl.startsWith("data:image/")) {
    if (input.imageDataUrl.length > 1_600_000) {
      throw new Error("Photo is too large. Try a smaller image.");
    }
    imageDataUrl = input.imageDataUrl;
  }
  if (!text && !imageDataUrl) {
    throw new Error("Add a photo or a short description first.");
  }
  return { text, imageDataUrl };
}

export const findPrintableModels = createServerFn({ method: "POST" })
  .validator((input: SearchInput) => validateInput(input))
  .handler(async ({ data }): Promise<SearchOutcome> => {
    if (!allowRequest()) {
      throw new Error("A lot of searches just ran. Wait a few seconds and try again.");
    }

    const rawAnalysis = await analyzeRequest(data);
    const analysis = normalizeAnalysis(rawAnalysis, data.text);
    const queries = analysis.searchQueries.length
      ? analysis.searchQueries
      : [analysis.objectName];
    const candidates = await searchCatalog(queries);
    const filtered = pickRelevantModels(candidates, analysis, 8);
    const reranked = await rerankWithGrok(filtered.length ? filtered : candidates, analysis);
    const models = (reranked && reranked.length ? reranked : filtered).slice(0, 6);

    const primaryQuery = data.text || queries[0] || analysis.objectName;
    const vague =
      /fictional|unknown|gibberish|unidentif|nonsense|not a real|no idea/i.test(
        `${analysis.objectName} ${analysis.identificationNote}`,
      );
    const showModels = models.length > 0 && !vague;

    let summary: string;
    if (showModels && analysis.confidence === "low") {
      summary = `Closest matches I could find for ${analysis.objectName}`;
    } else if (showModels) {
      summary = `Found ${models.length} strong match${models.length === 1 ? "" : "es"} for ${analysis.objectName}`;
    } else {
      summary = "No solid free printable match found for this.";
    }

    return {
      objectName: analysis.objectName,
      summary,
      note: userFacingNote(
        analysis.identificationNote,
        showModels ? "success" : "empty",
      ),
      confidence: analysis.confidence,
      isLikelyPrintable: analysis.isLikelyPrintable,
      models: showModels ? models : [],
      starterIdeas: analysis.starterIdeas,
      siteSearches: siteSearchLinks(primaryQuery),
      queriesUsed: queries,
    };
  });
