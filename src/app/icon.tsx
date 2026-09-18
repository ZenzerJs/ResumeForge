import { ImageResponse } from "next/og";

export const runtime = "edge";

export const size = {
  width: 32,
  height: 32,
};
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 18,
          background: "#020617",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#f59e0b",
          borderRadius: 8,
          border: "1.5px solid #d97706",
          fontWeight: 800,
          fontFamily: "sans-serif",
          letterSpacing: "-0.05em",
        }}
      >
        RF
      </div>
    ),
    {
      ...size,
    }
  );
}
