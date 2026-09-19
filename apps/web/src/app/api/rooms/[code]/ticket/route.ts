import { backendFetch, backendHeaders, forwardBackendJson, problemResponse, readSessionCookie } from "@/features/online/server";

/**
 * Mints a short-lived, single-use socket-auth ticket. The browser then
 * connects its socket directly to apps/game-server, presenting this ticket
 * instead of a cookie -- see docs/SECURITY.md.
 */
export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const session = await readSessionCookie();
  if (!session) return problemResponse(401, "SESSION_REQUIRED", request.url);

  const { code } = await params;
  const upstream = await backendFetch("/internal/tickets", {
    method: "POST",
    headers: backendHeaders(request),
    body: { session, roomCode: code.toUpperCase() },
  });
  return forwardBackendJson(upstream, request.url);
}
