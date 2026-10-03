/**
 * Where account data can live.
 * Neon when DATABASE_URL is set. Local dev uses in-memory PGLite.
 * Vercel without DATABASE_URL cannot: the PGLite wasm file is not in the
 * function bundle, and a fresh in-memory database per isolate would not
 * persist accounts anyway.
 */
export function deployedWithoutDatabase(): boolean {
  const url = typeof process !== "undefined" ? process.env.DATABASE_URL?.trim() : "";
  const onVercel = typeof process !== "undefined" && Boolean(process.env.VERCEL);
  return onVercel && !url;
}
