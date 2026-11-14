import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ResumeForge — Local-First AI Resume Workspace",
    short_name: "ResumeForge",
    description: "Craft truthful, job-specific resume variants from one protected master resume.",
    start_url: "/",
    display: "standalone",
    background_color: "#121010",
    theme_color: "#f7bd3f",
    icons: [
      {
        src: "/icon",
        sizes: "32x32",
        type: "image/png",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
