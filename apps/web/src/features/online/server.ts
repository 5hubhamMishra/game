import { cookies } from "next/headers";

/**
 * Backend-for-frontend helpers: every guest-session/room HTTP call the
 * browser makes goes through this same-origin layer, never directly to
 * `apps/game-server`. Only these server-only route handlers hold the
 * service token and forward the guest session server-to-server.
 */

const GAME_SERVER_URL = process.env.GAME_SERVER_URL ?? "http://localhost:8787";
const SERVICE_TOKEN = process.env.GAME_SERVER_SERVICE_TOKEN ?? "dev-service-token";
export const SESSION_COOKIE = "bw_session";

export async function readSessionCookie(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(SESSION_COOKIE)?.value ?? null;
}

export function backendHeaders(request: Request, extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { "content-type": "application/json", "x-service-token": SERVICE_TOKEN, ...extra };
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) headers["x-forwarded-for"] = forwardedFor;
  return headers;
}

export function backendFetch(path: string, init: { method: string; headers: Record<string, string>; body?: unknown }) {
  return fetch(`${GAME_SERVER_URL}${path}`, {
    method: init.method,
    headers: init.headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
}
