import { ImageResponse } from "next/og";

export const runtime = "edge";

export const size = {
  width: 180,
  height: 180,
};
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 84,
          background: "#121010",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#f7bd3f",
          borderRadius: 36,
          border: "4px solid #ff8b3d",
          fontWeight: 900,
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
