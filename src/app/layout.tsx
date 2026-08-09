import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
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
  themeColor: "#f59e0b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${inter.variable}`} suppressHydrationWarning>
      <body
        className="ink-navy font-sans antialiased min-h-screen"
        style={{ backgroundColor: "#0A0E17" }}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
