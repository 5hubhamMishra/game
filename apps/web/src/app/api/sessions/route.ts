import { NextResponse } from "next/server";
import { backendFetch, backendHeaders, SESSION_COOKIE } from "@/features/online/server";

export async function POST(request: Request) {
  const upstream = await backendFetch("/sessions", { method: "POST", headers: backendHeaders(request) });
  const data = (await upstream.json().catch(() => ({}))) as { playerId?: string; session?: string; code?: string };
  if (!upstream.ok || !data.session) return NextResponse.json(data, { status: upstream.status });

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
