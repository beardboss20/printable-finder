export type Confidence = "high" | "medium" | "low";

export type ObjectKind =
  | "functional_part"
  | "decorative"
  | "toy_figure"
  | "household"
  | "tool"
  | "electronic_device"
  | "other";

export type Verdict = "exact" | "similar" | "none";

export type Analysis = {
  category: string;
  specificName: string;
  genericName: string;
  distinguishingFeatures: string[];
  shape: string;
  materialGuess: string;
  kind: ObjectKind;
  isLikelyPrintable: boolean;
  confidence: Confidence;
  searchQueries: string[];
  synonyms: string[];
  excludePhrases: string[];
  identificationNote: string;
  starterIdeas: string[];
};

export type CatalogModel = {
  id: string;
  title: string;
  url: string;
  imageUrl: string | null;
  site: "printables" | "thingiverse" | "thangs" | "makerworld";
  likes: number | null;
  downloads: number | null;
  author: string | null;
};

export type ScoreModel = {
  title: string;
  url?: string;
  imageUrl?: string | null;
  likes?: number | null;
  downloads?: number | null;
};

export function tokenize(value: string): string[];
export function normalizeTitleKey(title: string): string;
export function defaultStarterIdeas(name?: string): string[];
export function analysisFromText(text: string): Analysis;
export function parseAnalysis(raw: string, fallbackText: string): Analysis;
export function normalizeAnalysis(analysis: Analysis, userText: string): Analysis;
export function lexicalScore(model: ScoreModel, analysis: Analysis): number;
export function lexicalToTen(score: number): number;
export function compareLexical(a: ScoreModel, b: ScoreModel, analysis: Analysis): number;
export function prefilterCandidates<T extends ScoreModel>(
  models: readonly T[],
  analysis: Analysis,
  limit?: number,
): T[];
export function dedupeModels<T extends { url: string; title: string }>(
  models: readonly T[],
  limit?: number,
): T[];
export function mergeModels<T extends { url: string; title: string }>(
  groups: readonly (readonly T[])[],
  limit?: number,
): T[];
export function computeVerdict(input: { topScore10: number; usedVision: boolean }): {
  verdict: Verdict;
  verdictTitle: string;
  verdictDetail: string;
};
export function isUsableThumbnailUrl(url: unknown): boolean;
export function mapPrintablesPayload(data: unknown): CatalogModel[];
export function mapThangsPayload(data: unknown, limit?: number): CatalogModel[];
export function mapMakerWorldPayload(data: unknown, limit?: number): CatalogModel[];
export function mapThingiversePayload(data: unknown, limit?: number): CatalogModel[];
