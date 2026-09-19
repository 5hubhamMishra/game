import { NextResponse } from "next/server";
import { backendFetch, backendHeaders, forwardBackendJson, problemResponse, SESSION_COOKIE } from "@/features/online/server";

export async function POST(request: Request) {
  const upstream = await backendFetch("/sessions", { method: "POST", headers: backendHeaders(request) });
  const data = (await upstream.json().catch(() => ({}))) as { playerId?: string; session?: string; code?: string };
  if (!upstream.ok) return forwardBackendJson(new Response(JSON.stringify(data), {
    status: upstream.status,
    headers: upstream.headers,
  }), request.url);
  if (!data.session) return problemResponse(502, "INVALID_BACKEND_RESPONSE", request.url);

  const response = NextResponse.json({ playerId: data.playerId }, { status: upstream.status });
  response.cookies.set(SESSION_COOKIE, data.session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
