import { cookies } from "next/headers";
import { NextResponse } from "next/server";

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
  }).catch(() => new Response(JSON.stringify({ code: "BACKEND_UNAVAILABLE" }), {
    status: 503,
    headers: { "content-type": "application/problem+json" },
  }));
}

function problem(status: number, code: string, instance: string) {
  return {
    type: `urn:between-words:error:${code.toLowerCase()}`,
    title: "Request failed",
    status,
    detail: status === 429 ? "Too many requests; try again later." : "The request could not be completed.",
    instance,
    code,
  };
}

export function problemResponse(status: number, code: string, instance: string) {
  return new NextResponse(JSON.stringify(problem(status, code, instance)), {
    status,
    headers: { "content-type": "application/problem+json" },
  });
}

export async function forwardBackendJson(upstream: Response, instance: string) {
  const data = await upstream.json().catch(() => ({}));
  if (upstream.ok) return NextResponse.json(data, { status: upstream.status });

  const code = typeof data?.code === "string" ? data.code : `HTTP_${upstream.status}`;
  const headers = new Headers({ "content-type": "application/problem+json" });
  for (const name of ["retry-after", "x-ratelimit-limit", "x-ratelimit-remaining"]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new NextResponse(JSON.stringify(problem(upstream.status, code, instance)), {
    status: upstream.status,
    headers,
  });
}
