import { NextResponse } from "next/server";
import { backendFetch, backendHeaders, readSessionCookie } from "@/features/online/server";

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const session = await readSessionCookie();
  if (!session) return NextResponse.json({ code: "SESSION_REQUIRED" }, { status: 401 });

  const { code } = await params;
  const body = await request.json().catch(() => ({}));
  const upstream = await backendFetch(`/rooms/${code.toUpperCase()}/members`, {
    method: "POST",
    headers: backendHeaders(request, { "x-guest-session": session }),
    body,
  });
  const data = await upstream.json().catch(() => ({}));
  return NextResponse.json(data, { status: upstream.status });
}
