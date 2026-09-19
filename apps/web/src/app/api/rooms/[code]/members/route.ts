import { backendFetch, backendHeaders, forwardBackendJson, problemResponse, readSessionCookie } from "@/features/online/server";

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const session = await readSessionCookie();
  if (!session) return problemResponse(401, "SESSION_REQUIRED", request.url);

  const { code } = await params;
  const body = await request.json().catch(() => ({}));
  const upstream = await backendFetch(`/rooms/${code.toUpperCase()}/members`, {
    method: "POST",
    headers: backendHeaders(request, { "x-guest-session": session }),
    body,
  });
  return forwardBackendJson(upstream, request.url);
}
