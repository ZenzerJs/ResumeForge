import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { KeyboardShortcutsModal } from "@/components/ui/keyboard-shortcuts-modal";
import "./globals.css";

const hankenGrotesk = localFont({
  src: [
    { path: "./fonts/HankenGrotesk-400.ttf", weight: "400", style: "normal" },
    { path: "./fonts/HankenGrotesk-600.ttf", weight: "600", style: "normal" },
    { path: "./fonts/HankenGrotesk-700.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-hanken",
  display: "swap",
});

const jetbrainsMono = localFont({
  src: [
    { path: "./fonts/JetBrainsMono-400.ttf", weight: "400", style: "normal" },
    { path: "./fonts/JetBrainsMono-600.ttf", weight: "600", style: "normal" },
  ],
  variable: "--font-mono",
  display: "swap",
});

const defaultUrl = process.env.NEXT_PUBLIC_APP_URL || "https://resumeforge.app";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: {
    default: "ResumeForge — AI Resume Workspace",
    template: "%s | ResumeForge",
  },
  description:
    "Craft truthful, job-specific resume variants from one protected master resume. Use as a guest, or sign in to save. Evidence-grounded, zero-hallucination AI with live Typst WASM preview.",
  keywords: [
    "Resume",
    "Typst",
    "AI Resume Tailoring",
    "ATS Score",
    "Cover Letter Generator",
    "Guest Resume Editor",
    "Evidence Bank",
  ],
  authors: [{ name: "ResumeForge Team" }],
  creator: "ResumeForge",
  publisher: "ResumeForge",
  openGraph: {
    title: "ResumeForge — AI Resume Workspace",
    description:
      "Craft truthful, job-specific resume variants from one protected master resume. Use as a guest, or sign in to save.",
    url: defaultUrl,
    siteName: "ResumeForge",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ResumeForge — AI Resume Workspace",
    description:
      "Craft truthful, job-specific resume variants from one protected master resume. Evidence-grounded AI with Typst WASM compilation.",
  },
  icons: {
    icon: "/icon",
    apple: "/apple-icon",
  },
};

export const viewport: Viewport = {
  themeColor: "#ff8c00",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${hankenGrotesk.variable} ${jetbrainsMono.variable}`}
      style={{ colorScheme: "dark" }}
      suppressHydrationWarning
    >
      <body
        className="bg-background text-on-surface font-body-regular antialiased min-h-screen"
        suppressHydrationWarning
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-[#ff8c00] focus:px-4 focus:py-2 focus:text-black focus:font-semibold"
        >
          Skip to content
        </a>
        {children}
        <KeyboardShortcutsModal />
      </body>
    </html>
  );
}
