import type { Analysis, Confidence } from "./types";

const ANALYSIS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "objectName",
    "searchQueries",
    "confidence",
    "identificationNote",
    "isLikelyPrintable",
    "starterIdeas",
    "intent",
    "coreNouns",
    "requiredPhrases",
    "excludePhrases",
  ],
  properties: {
    objectName: { type: "string" },
    searchQueries: {
      type: "array",
      items: { type: "string" },
      minItems: 1,
      maxItems: 3,
    },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    identificationNote: { type: "string" },
    isLikelyPrintable: { type: "boolean" },
    starterIdeas: {
      type: "array",
      items: { type: "string" },
      minItems: 2,
      maxItems: 4,
    },
    intent: { type: "string" },
    coreNouns: {
      type: "array",
      items: { type: "string" },
      maxItems: 6,
    },
    requiredPhrases: {
      type: "array",
      items: { type: "string" },
      maxItems: 8,
    },
    excludePhrases: {
      type: "array",
      items: { type: "string" },
      maxItems: 8,
    },
  },
} as const;

function fallbackAnalysis(text: string): Analysis {
  const objectName = text.trim().slice(0, 80) || "3D printable object";
  return {
    objectName,
    searchQueries: objectName ? [objectName] : ["3d printable"],
    confidence: text.trim() ? "medium" : "low",
    identificationNote: "",
    isLikelyPrintable: true,
    starterIdeas: [
      "Start with a box the size of the object, then hollow it with the hole tool.",
      "Add cylinders for holes, posts, or rounded corners and group them when they look right.",
      "Keep walls around 2 mm so a typical 0.4 mm nozzle can print it cleanly.",
    ],
    intent: objectName,
    coreNouns: objectName ? [objectName] : [],
    requiredPhrases: [],
    excludePhrases: [],
  };
}

function asConfidence(value: unknown): Confidence {
  return value === "high" || value === "medium" || value === "low" ? value : "medium";
}

function asStringList(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim())
    .slice(0, limit);
}

function parseAnalysis(raw: string, fallbackText: string): Analysis {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return fallbackAnalysis(fallbackText);
  try {
    const parsed = JSON.parse(match[0]) as Partial<Analysis>;
    const objectName =
      typeof parsed.objectName === "string" && parsed.objectName.trim()
        ? parsed.objectName.trim()
        : fallbackText.trim() || "3D printable object";
    const searchQueries = asStringList(parsed.searchQueries, 3);
    const starterIdeas = asStringList(parsed.starterIdeas, 4);
    const intent =
      typeof parsed.intent === "string" && parsed.intent.trim()
        ? parsed.intent.trim()
        : objectName;
    return {
      objectName,
      searchQueries: searchQueries.length ? searchQueries : [objectName],
      confidence: asConfidence(parsed.confidence),
      identificationNote:
        typeof parsed.identificationNote === "string" && parsed.identificationNote.trim()
          ? parsed.identificationNote.trim()
          : fallbackAnalysis(fallbackText).identificationNote,
      isLikelyPrintable: parsed.isLikelyPrintable !== false,
      starterIdeas: starterIdeas.length
        ? starterIdeas
        : fallbackAnalysis(objectName).starterIdeas,
      intent,
      coreNouns: asStringList(parsed.coreNouns, 6),
      requiredPhrases: asStringList(parsed.requiredPhrases, 8),
      excludePhrases: asStringList(parsed.excludePhrases, 8),
    };
  } catch {
    return fallbackAnalysis(fallbackText);
  }
}

export async function analyzeRequest(input: {
  text: string;
  imageDataUrl?: string;
}): Promise<Analysis> {
  const apiKey = process.env.XAI_API_KEY;
  const text = input.text.trim();

  if (!apiKey) {
    return fallbackAnalysis(text);
  }

  const prompt = `You help people find free 3D-printable models.

Identify the object from the photo and/or description, then decide what they should actually search for.

Rules:
- Never use a single generic electronics noun as a search query ("phone", "laptop", "iPad", "headphones"). Those sites will dump cases and random junk.
- If the photo is a finished electronic device (phone, laptop, tablet, headphones), they usually cannot print the device. Search for the most likely printable accessory (stand, dock, holder, hook) unless the user already asked for a case or another part.
- Sports gear, toys, household objects, figurines, and simple nouns ARE printable. For “baseball”, search “baseball”. For “mug”, search “mug”.
- If the photo or text is already a printable part or a simple object (cable clip, fan duct, baseball, mug, cat), search for THAT exact thing.
- Do not invent extra required function words for a simple noun. For “baseball”, requiredPhrases should be empty.
- User text always wins. "phone case" means cases. "phone stand" means stands. A photo of a bare phone with no extra text means stands/docks, not cases.
- searchQueries: 1-3 maker phrases. Lead with the user’s own words when they typed something. Never replace “baseball” with only “baseball replica”.
- coreNouns: short nouns a good title should mention (baseball, clip, phone).
- requiredPhrases: only for accessory hunts (stand, dock, clip). Empty when the object name itself is enough.
- excludePhrases: common false positives (for a phone photo: case, cover, wallet). Empty if none.
- intent: one short phrase.
- objectName: the printable thing we are hunting.
- identificationNote: usually an empty string. Only write one short sentence if the user would otherwise be confused — e.g. the photo is a phone so we looked for stands.
- isLikelyPrintable is true whenever people print a replica, toy, or accessory of the thing. False only for gibberish.
- starterIdeas: 2-4 beginner Tinkercad steps using box, cylinder, hole tool.

User description: ${text || "(none — photo only)"}`;

  const content: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  > = [{ type: "text", text: prompt }];

  if (input.imageDataUrl) {
    content.unshift({
      type: "image_url",
      image_url: { url: input.imageDataUrl },
    });
  }

  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "grok-4.5",
      max_tokens: 750,
      temperature: 0.15,
      messages: [{ role: "user", content }],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "print_analysis",
          schema: ANALYSIS_SCHEMA,
          strict: true,
        },
      },
    }),
  });

  if (!res.ok) {
    if (text) return fallbackAnalysis(text);
    throw new Error(`xAI API error ${res.status}`);
  }

  const body = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const raw = body.choices?.[0]?.message?.content ?? "";
  return parseAnalysis(raw, text);
}
