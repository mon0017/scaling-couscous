import type { Metadata } from "next";
import "./globals.css";
export const viewport = {width:'device-width',initialScale:1,viewportFit:'cover',themeColor:'#102f40'};

export const metadata: Metadata = {
  title: "JohnLoan Baba Yaga — Member loan portal",
  description: "Your union loans, payments, and documents in one secure place.",
  manifest: '/manifest.webmanifest',
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}

