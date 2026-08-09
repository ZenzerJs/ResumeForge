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
          background: "#020617",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "space-between",
          padding: "80px",
          fontFamily: "sans-serif",
          position: "relative",
          border: "2px solid #1e293b",
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
            background: "radial-gradient(circle, rgba(245, 158, 11, 0.15) 0%, rgba(2, 6, 23, 0) 70%)",
            borderRadius: "50%",
          }}
        />

        {/* Brand Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              width: "54px",
              height: "54px",
              background: "#0f172a",
              border: "2px solid #f59e0b",
              borderRadius: "14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#f59e0b",
              fontWeight: 900,
              fontSize: "28px",
            }}
          >
            RF
          </div>
          <span
            style={{
              color: "#f8fafc",
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
              color: "#ffffff",
              lineHeight: 1.15,
              letterSpacing: "-0.04em",
            }}
          >
            Truthful, AI-Powered Resume Tailoring & WASM Compilation
          </div>
          <div
            style={{
              fontSize: "24px",
              color: "#94a3b8",
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
              background: "#0f172a",
              border: "1px solid #334155",
              padding: "10px 20px",
              borderRadius: "9999px",
              color: "#f59e0b",
              fontSize: "16px",
              fontWeight: 700,
            }}
          >
            ✦ Typst WASM Engine
          </div>
          <div
            style={{
              background: "#0f172a",
              border: "1px solid #334155",
              padding: "10px 20px",
              borderRadius: "9999px",
              color: "#38bdf8",
              fontSize: "16px",
              fontWeight: 700,
            }}
          >
            ✦ Evidence Bank Grounding
          </div>
          <div
            style={{
              background: "#0f172a",
              border: "1px solid #334155",
              padding: "10px 20px",
              borderRadius: "9999px",
              color: "#10b981",
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
