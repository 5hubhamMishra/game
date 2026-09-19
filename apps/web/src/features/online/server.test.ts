import { describe, expect, it } from "vitest";
import { forwardBackendJson, problemResponse } from "./server";

describe("same-origin API errors", () => {
  it("returns Problem Details for missing sessions", async () => {
    const response = problemResponse(401, "SESSION_REQUIRED", "https://example.test/api/rooms");
    expect(response.status).toBe(401);
    expect(response.headers.get("content-type")).toContain("application/problem+json");
    expect(await response.json()).toMatchObject({
      type: "urn:between-words:error:session_required",
      status: 401,
      code: "SESSION_REQUIRED",
    });
  });

  it("preserves upstream rate-limit headers", async () => {
    const response = await forwardBackendJson(new Response(JSON.stringify({ code: "RATE_LIMITED" }), {
      status: 429,
      headers: { "retry-after": "60" },
    }), "https://example.test/api/rooms");
    expect(response.status).toBe(429);
    expect(response.headers.get("content-type")).toContain("application/problem+json");
    expect(response.headers.get("retry-after")).toBe("60");
    expect(await response.json()).toMatchObject({ code: "RATE_LIMITED", status: 429 });
  });
});
