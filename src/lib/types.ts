export type SiteId = "printables" | "thingiverse" | "thangs" | "makerworld";

export type Confidence = "high" | "medium" | "low";

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

export type SiteSearchLink = {
  site: SiteId;
  label: string;
  url: string;
};

export type Analysis = {
  objectName: string;
  searchQueries: string[];
  confidence: Confidence;
  identificationNote: string;
  isLikelyPrintable: boolean;
  starterIdeas: string[];
  intent: string;
  coreNouns: string[];
  requiredPhrases: string[];
  excludePhrases: string[];
};

export type SearchOutcome = {
  objectName: string;
  summary: string;
  note: string;
  confidence: Confidence;
  isLikelyPrintable: boolean;
  models: PrintableModel[];
  starterIdeas: string[];
  siteSearches: SiteSearchLink[];
  queriesUsed: string[];
};

export type SearchInput = {
  text: string;
  imageDataUrl?: string;
};
