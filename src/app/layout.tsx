import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

// Forces per-request rendering so the CSP nonce set in middleware can actually
// be attached to Next.js's own inline hydration scripts — a statically
// prerendered page bakes its HTML once at build time and can never carry a
// fresh per-request nonce.
export const dynamic = "force-dynamic";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Document Summary Assistant",
  description: "Upload a PDF or image and get an AI-generated summary, key points, and improvement suggestions.",
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" data-csp-nonce={nonce}>
        {children}
      </body>
    </html>
  );
}
