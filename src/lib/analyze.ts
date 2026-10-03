import { normalizeAnalysis, parseAnalysis, analysisFromText } from "./rank-core.js";
import type { Analysis } from "./types";
import { xaiChat } from "./xai";

const PHOTO_NOT_CONFIGURED =
  "Photo recognition isn't configured on this server yet. Please type what the object is.";
const PHOTO_UNAVAILABLE =
  "Photo recognition is unavailable right now. Please type what the object is.";
const PHOTO_BUSY =
  "Photo recognition is busy right now (too many requests). Wait a minute and try again, or type what the object is.";
export const PHOTO_SKIPPED_NOTE =
  "The photo wasn't analyzed, so these results are based on your description.";

const ANALYSIS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "category",
    "specificName",
    "genericName",
    "distinguishingFeatures",
    "shape",
    "materialGuess",
    "kind",
    "isLikelyPrintable",
    "confidence",
    "searchQueries",
    "synonyms",
    "excludePhrases",
    "identificationNote",
    "starterIdeas",
  ],
  properties: {
    category: { type: "string" },
    specificName: { type: "string" },
    genericName: { type: "string" },
    distinguishingFeatures: {
      type: "array",
      items: { type: "string" },
      maxItems: 8,
    },
    shape: { type: "string" },
    materialGuess: { type: "string" },
    kind: {
      type: "string",
      enum: [
        "functional_part",
        "decorative",
        "toy_figure",
        "household",
        "tool",
        "electronic_device",
        "other",
      ],
    },
    isLikelyPrintable: { type: "boolean" },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    searchQueries: {
      type: "array",
      items: { type: "string" },
      minItems: 4,
      maxItems: 6,
    },
    synonyms: { type: "array", items: { type: "string" }, maxItems: 8 },
    excludePhrases: { type: "array", items: { type: "string" }, maxItems: 8 },
    identificationNote: { type: "string" },
    starterIdeas: {
      type: "array",
      items: { type: "string" },
      minItems: 2,
      maxItems: 4,
    },
  },
} as const;

export type AnalyzeOutcome =
  | { status: "ok"; analysis: Analysis; photoAnalyzed: boolean; photoNote: string }
  | { status: "needs_description"; message: string };

function promptFor(text: string): string {
  return `You identify an object in a photo and/or a short description so a maker can find a free 3D-printable model.

Rules:
- Identify the MAIN subject: the most prominent, centered, in-focus object. If the photo shows a large item with a prominent small part in the middle (a knob, handle, hook, clip, bracket on a cabinet, door, wall, or desk), the small part is what the user wants to print; do not name the furniture or wall.
- If several identical small objects are shown (a pile of clips), name the single object, as specifically as you can (e.g. "nail-in cable clip", not just "clip").
- If an object holds or displays something (a pot with flowers, a stand holding a phone), name the holder unless the contents are clearly the subject. Decorative flowers in a pot → search planters/flower pots.
- Name the object by its form and purpose, not its surface decoration: glued-on patterns, paint, stickers, or wrapping (e.g. hearts made of rice on a pot) don't change what it is ("flower pot", not "heart vase"). Mention decoration in distinguishingFeatures.
- Phone stand vs business-card holder: an angled back plate with a front lip/ledge, taller than it is wide (phone-sized, roughly 7-16 cm tall), is a phone stand (or tablet stand if large). Business-card holders are low, wider than tall, and hold a card stack. If unsure, prefer phone stand and mention the alternative in identificationNote.
- Famous 3D-printing test models count as specific objects: the small red/orange tugboat with a cabin and chimney is "3DBenchy" — lead the queries with "3DBenchy" / "Benchy". Likewise "calibration cube", "XYZ cube", "articulated dragon", "flexi rex".
- specificName is the most specific common name. genericName is the broader type ("cable clip", "phone").
- distinguishingFeatures: short visible traits. shape is a few words. materialGuess is a short guess or "unknown".
- kind is one of the enum values. A finished phone, laptop, tablet, headphones, camera, or similar gadget is electronic_device.
- isLikelyPrintable is true for parts, accessories, toys, replicas, household objects, tools, and figurines. False only for gibberish. A finished electronic device still counts as printable because people print an accessory for it.
- Finished electronic device: do not search for the device itself. Search for the most likely printable accessory (stand, dock, holder, hook, mount) unless the user text already names a part (case, stand, clip, mount, skin).
- User text always wins over the photo. "phone case" means cases. "phone stand" means stands. A bare phone with no extra text means stands and docks, not cases.
- Never use a single generic electronics noun as a search query ("phone", "laptop", "ipad", "headphones").
- Sports gear, toys, household objects, figurines, and simple nouns ARE the thing to search. For "baseball", search baseball. For "mug", search mug. For "cable clip", search cable clip. Do not replace a simple noun with only a "replica" query.
- searchQueries: 4 to 6 short maker phrases (1-3 words, what people type on Printables), best first, most specific then generic synonyms. Leave out materials, colors, and finishes (wooden, brass, red, clear, paper) because the print will differ anyway; put those in distinguishingFeatures. Include the plain generic name as one query. Example: "cable clip", "cord organizer", "desk cable holder", "cable management clip". When the user typed a printable thing, lead with their words.
- synonyms: other names for the same printable object.
- excludePhrases: common false positives. For a phone-stand hunt include case, cover, wallet. Empty array if none.
- identificationNote: empty string unless the user would be confused. If you redirected from a device to an accessory, one short sentence.
- starterIdeas: 2-4 beginner Tinkercad steps using box, cylinder, and the hole tool, for the printable thing.
- confidence: high when obvious, medium when reasonable, low when guessing or the object is unusual; when low, say so plainly in identificationNote.

User description: ${text || "(none — photo only)"}`;
}

export async function analyzeRequest(
  input: { text: string; imageDataUrl?: string },
  timeoutMs = 12_000,
): Promise<AnalyzeOutcome> {
  const text = input.text.trim();
  const image = input.imageDataUrl;
  const apiKey = process.env.XAI_API_KEY?.trim();

  if (!apiKey) {
    if (image && !text) {
      console.error("[analyze] XAI_API_KEY is not set; photo was not analyzed");
      return { status: "needs_description", message: PHOTO_NOT_CONFIGURED };
    }
    if (image) {
      console.error("[analyze] XAI_API_KEY is not set; photo was not analyzed");
    }
    return {
      status: "ok",
      analysis: normalizeAnalysis(analysisFromText(text), text),
      photoAnalyzed: false,
      photoNote: image ? PHOTO_SKIPPED_NOTE : "",
    };
  }

  const content: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string; detail?: "low" | "high" | "auto" } }
  > = [{ type: "text", text: promptFor(text) }];
  if (image) {
    content.unshift({
      type: "image_url",
      image_url: { url: image, detail: "auto" },
    });
  }

  const result = await xaiChat({
    content,
    schemaName: "print_analysis",
    schema: ANALYSIS_SCHEMA,
    maxTokens: 900,
    temperature: 0.15,
    timeoutMs,
  });

  if (!result.ok) {
    console.error("[analyze] recognition failed", result.reason, result.status ?? "");
    if (image && !text) {
      return {
        status: "needs_description",
        message: result.reason === "rate_limited" ? PHOTO_BUSY : PHOTO_UNAVAILABLE,
      };
    }
    return {
      status: "ok",
      analysis: normalizeAnalysis(analysisFromText(text), text),
      photoAnalyzed: false,
      photoNote: image ? PHOTO_SKIPPED_NOTE : "",
    };
  }

  const analysis = normalizeAnalysis(parseAnalysis(result.content, text), text);
  if (image && !text && !analysis.specificName && analysis.searchQueries.length === 0) {
    console.error("[analyze] model returned an empty identification");
    return { status: "needs_description", message: PHOTO_UNAVAILABLE };
  }

  return {
    status: "ok",
    analysis,
    photoAnalyzed: Boolean(image),
    photoNote: "",
  };
}
