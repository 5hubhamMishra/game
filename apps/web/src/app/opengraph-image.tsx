import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#f7f4ee",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 96,
              height: 96,
              borderRadius: 20,
              border: "6px solid #0f766e",
              color: "#0f766e",
              fontSize: 56,
              fontWeight: 700,
            }}
          >
            ↔
          </div>
          <div style={{ display: "flex", fontSize: 88, fontWeight: 700, color: "#1c1917" }}>
            Between <span style={{ color: "#0f766e", marginLeft: 20 }}>Words</span>
          </div>
        </div>
        <div style={{ display: "flex", marginTop: 28, fontSize: 32, color: "#57534e" }}>
          A related-word social deduction game
        </div>
      </div>
    ),
    { ...size },
  );
}
