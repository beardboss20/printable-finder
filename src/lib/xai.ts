type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail?: "low" | "high" | "auto" } };

export type XaiSuccess = { ok: true; content: string };
export type XaiFailure = {
  ok: false;
  reason: "missing_key" | "timeout" | "http" | "network" | "empty";
  status?: number;
};

type XaiResult = XaiSuccess | XaiFailure;

const ENDPOINT = "https://api.x.ai/v1/chat/completions";
const FALLBACK_MODEL = "grok-4.5";

function preferredModel(): string {
  const configured = process.env.XAI_MODEL?.trim();
  return configured || "grok-4.6";
}

function looksLikeUnknownModel(status: number, body: string): boolean {
  if (status !== 400 && status !== 404) return false;
  return (
    /model/i.test(body) &&
    /not found|unknown|does not exist|invalid|unsupported|unavailable|no such|is not available/i.test(
      body,
    )
  );
}

export async function xaiChat(options: {
  content: string | ContentPart[];
  schemaName: string;
  schema: object;
  maxTokens: number;
  temperature: number;
  timeoutMs: number;
}): Promise<XaiResult> {
  const apiKey = process.env.XAI_API_KEY?.trim();
  if (!apiKey) return { ok: false, reason: "missing_key" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1, options.timeoutMs));

  const post = (model: string) =>
    fetch(ENDPOINT, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: options.maxTokens,
        temperature: options.temperature,
        messages: [{ role: "user", content: options.content }],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: options.schemaName,
            schema: options.schema,
            strict: true,
          },
        },
      }),
    });

  try {
    const primary = preferredModel();
    let response = await post(primary);
    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      const retry = looksLikeUnknownModel(response.status, errText) && primary !== FALLBACK_MODEL;
      if (retry) {
        console.error("[xai] model unavailable, retrying once with grok-4.5", response.status);
        response = await post(FALLBACK_MODEL);
      } else {
        console.error("[xai] API error", response.status);
        return { ok: false, reason: "http", status: response.status };
      }
    }

    if (!response.ok) {
      console.error("[xai] API error", response.status);
      return { ok: false, reason: "http", status: response.status };
    }

    const body = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = body.choices?.[0]?.message?.content ?? "";
    if (!content.trim()) return { ok: false, reason: "empty", status: response.status };
    return { ok: true, content };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      console.error("[xai] request timed out");
      return { ok: false, reason: "timeout" };
    }
    console.error("[xai] request failed", err instanceof Error ? err.name : "error");
    return { ok: false, reason: "network" };
  } finally {
    clearTimeout(timer);
  }
}
