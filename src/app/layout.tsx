import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ResumeForge — Local-First AI Resume Workspace",
  description:
    "Craft truthful, job-specific resume variants from one protected master resume. Evidence-grounded, zero-hallucination AI.",
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
