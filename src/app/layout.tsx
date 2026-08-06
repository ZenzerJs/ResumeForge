import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ResumeForge",
  description: "Local-first AI resume workspace",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
