import { NextResponse } from "next/server";
import { backendFetch, backendHeaders, readSessionCookie } from "@/features/online/server";

/**
 * Mints a short-lived, single-use socket-auth ticket. The browser then
 * connects its socket directly to apps/game-server, presenting this ticket
 * instead of a cookie -- see docs/SECURITY.md.
 */
export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const session = await readSessionCookie();
  if (!session) return NextResponse.json({ code: "SESSION_REQUIRED" }, { status: 401 });

  const { code } = await params;
  const upstream = await backendFetch("/internal/tickets", {
    method: "POST",
    headers: backendHeaders(request),
    body: { session, roomCode: code.toUpperCase() },
  });
  const data = await upstream.json().catch(() => ({}));
  return NextResponse.json(data, { status: upstream.status });
}
