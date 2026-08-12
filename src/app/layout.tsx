import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const hankenGrotesk = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
  weight: ["400", "600"],
});

const defaultUrl = process.env.NEXT_PUBLIC_APP_URL || "https://resumeforge.app";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: {
    default: "ResumeForge — Local-First AI Resume Workspace",
    template: "%s | ResumeForge",
  },
  description:
    "Craft truthful, job-specific resume variants from one protected master resume. Evidence-grounded, zero-hallucination AI with live Typst WASM preview.",
  keywords: [
    "Resume",
    "Typst",
    "AI Resume Tailoring",
    "ATS Score",
    "Cover Letter Generator",
    "Local-First Workspace",
    "Evidence Bank",
  ],
  authors: [{ name: "ResumeForge Team" }],
  creator: "ResumeForge",
  publisher: "ResumeForge",
  openGraph: {
    title: "ResumeForge — Local-First AI Resume Workspace",
    description:
      "Craft truthful, job-specific resume variants from one protected master resume. Evidence-grounded, zero-hallucination AI.",
    url: defaultUrl,
    siteName: "ResumeForge",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ResumeForge — Local-First AI Resume Workspace",
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
      suppressHydrationWarning
    >
      <body
        className="bg-background text-on-surface font-body-regular antialiased min-h-screen"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
