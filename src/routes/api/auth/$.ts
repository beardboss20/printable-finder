import { createFileRoute } from "@tanstack/react-router";
import { deployedWithoutDatabase } from "@/lib/db-availability";
import { auth } from "@/lib/auth/server";

function accountsUnavailable(request: Request): Response {
  const url = new URL(request.url);
  if (request.method === "GET" && url.pathname.endsWith("/get-session")) {
    return Response.json({ session: null, user: null });
  }
  return Response.json(
    { message: "Accounts are not available on this server." },
    { status: 503 },
  );
}

async function handleAuth(request: Request): Promise<Response> {
  if (deployedWithoutDatabase()) return accountsUnavailable(request);
  try {
    return await auth.handler(request);
  } catch (err) {
    const message = err instanceof Error ? err.message : "auth error";
    console.error("[auth] request failed:", message.slice(0, 180));
    return accountsUnavailable(request);
  }
}

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => handleAuth(request),
      POST: ({ request }) => handleAuth(request),
    },
  },
});
