import { backendFetch, backendHeaders, forwardBackendJson, problemResponse, readSessionCookie } from "@/features/online/server";

export async function POST(request: Request) {
  const session = await readSessionCookie();
  if (!session) return problemResponse(401, "SESSION_REQUIRED", request.url);

  const body = await request.json().catch(() => ({}));
  const upstream = await backendFetch("/rooms", {
    method: "POST",
    headers: backendHeaders(request, { "x-guest-session": session }),
    body,
  });
  return forwardBackendJson(upstream, request.url);
}
