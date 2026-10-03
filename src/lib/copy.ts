const REASONING = [
  /the request is already/i,
  /search for that/i,
  /search for /i,
  /refine with/i,
  /directly[.;]/i,
  /\bI (identified|detected|think|will|would)\b/i,
  /user (text|description|asked)/i,
  /as (an? )?(query|search)/i,
];

export function userFacingNote(note: string, mode: "success" | "empty"): string {
  const trimmed = note.replace(/\s+/g, " ").trim();
  if (!trimmed) return "";
  if (REASONING.some((pattern) => pattern.test(trimmed))) return "";
  if (mode === "success" && trimmed.length > 280) return "";
  return trimmed;
}
