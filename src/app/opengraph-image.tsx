import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "ResumeForge — Local-First AI Resume Workspace";
export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#121010",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "space-between",
          padding: "80px",
          fontFamily: "sans-serif",
          position: "relative",
          border: "2px solid #3a322f",
        }}
      >
        {/* Glow backdrop */}
        <div
          style={{
            position: "absolute",
            top: "-100px",
            right: "-100px",
            width: "500px",
            height: "500px",
            background: "radial-gradient(circle, rgba(247, 189, 63, 0.16) 0%, rgba(18, 16, 16, 0) 70%)",
            borderRadius: "50%",
          }}
        />

        {/* Brand Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              width: "54px",
              height: "54px",
              background: "#1b1716",
              border: "2px solid #f7bd3f",
              borderRadius: "14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#f7bd3f",
              fontWeight: 900,
              fontSize: "28px",
            }}
          >
            RF
          </div>
          <span
            style={{
              color: "#f4eee7",
              fontSize: "32px",
              fontWeight: 800,
              letterSpacing: "-0.03em",
            }}
          >
            ResumeForge
          </span>
        </div>

        {/* Main Content */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px", maxWidth: "950px" }}>
          <div
            style={{
              fontSize: "58px",
              fontWeight: 900,
              color: "#f4eee7",
              lineHeight: 1.15,
              letterSpacing: "-0.04em",
            }}
          >
            Truthful, AI-Powered Resume Tailoring & WASM Compilation
          </div>
          <div
            style={{
              fontSize: "24px",
              color: "#c8bdb0",
              lineHeight: 1.5,
              fontWeight: 400,
            }}
          >
            Craft evidence-backed, job-tailored resume variants from one protected master resume. Zero hallucination. Local WASM rendering.
          </div>
        </div>

        {/* Badge Footer */}
        <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          <div
            style={{
              background: "#1b1716",
              border: "1px solid #3a322f",
              padding: "10px 20px",
              borderRadius: "9999px",
              color: "#f7bd3f",
              fontSize: "16px",
              fontWeight: 700,
            }}
          >
            ✦ Typst WASM Engine
          </div>
          <div
            style={{
              background: "#1b1716",
              border: "1px solid #3a322f",
              padding: "10px 20px",
              borderRadius: "9999px",
              color: "#4f8fff",
              fontSize: "16px",
              fontWeight: 700,
            }}
          >
            ✦ Evidence Bank Grounding
          </div>
          <div
            style={{
              background: "#1b1716",
              border: "1px solid #3a322f",
              padding: "10px 20px",
              borderRadius: "9999px",
              color: "#4f8fff",
              fontSize: "16px",
              fontWeight: 700,
            }}
          >
            ✦ BYOK Privacy
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
