import type { Analysis, Confidence, ObjectKind, Verdict } from "./rank-core.js";

export type { Analysis, Confidence, ObjectKind, Verdict };

export type SiteId = "printables" | "thingiverse" | "thangs" | "makerworld";

export type LinkSiteId = SiteId | "cults3d" | "myminifactory";

export type PrintableModel = {
  id: string;
  title: string;
  url: string;
  imageUrl: string | null;
  site: SiteId;
  likes: number | null;
  downloads: number | null;
  author: string | null;
};

export type RankedModel = PrintableModel & {
  matchScore: number;
  matchReason: string;
};

export type SiteSearchLink = {
  site: LinkSiteId;
  label: string;
  url: string;
};

export type SiteStatus = {
  site: SiteId;
  status: "ok" | "failed" | "timeout";
  count: number;
};

export type ObjectDescription = {
  category: string;
  specificName: string;
  genericName: string;
  features: string[];
  shape: string;
  materialGuess: string;
  kind: ObjectKind;
  confidence: Confidence;
  identificationNote: string;
};

export type TimingsMs = {
  analyze: number;
  search: number;
  rank: number;
  total: number;
};

export type SearchOutcome = {
  status: "ok" | "needs_description";
  verdict: Verdict;
  verdictTitle: string;
  verdictDetail: string;
  objectName: string;
  description: ObjectDescription;
  models: RankedModel[];
  siteStatus: SiteStatus[];
  siteSearches: SiteSearchLink[];
  queriesUsed: string[];
  starterIdeas: string[];
  usedVision: boolean;
  timingsMs: TimingsMs;
};

export type SearchInput = {
  text: string;
  imageDataUrl?: string;
};

export function emptyDescription(): ObjectDescription {
  return {
    category: "",
    specificName: "",
    genericName: "",
    features: [],
    shape: "",
    materialGuess: "",
    kind: "other",
    confidence: "low",
    identificationNote: "",
  };
}

export function descriptionFromAnalysis(analysis: Analysis): ObjectDescription {
  return {
    category: analysis.category,
    specificName: analysis.specificName,
    genericName: analysis.genericName,
    features: analysis.distinguishingFeatures,
    shape: analysis.shape,
    materialGuess: analysis.materialGuess,
    kind: analysis.kind,
    confidence: analysis.confidence,
    identificationNote: analysis.identificationNote,
  };
}
