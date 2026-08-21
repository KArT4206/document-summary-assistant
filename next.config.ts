import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfjs-dist and tesseract.js load worker/wasm files at runtime via their own
  // module resolution; bundling them breaks that, so run them as plain Node modules.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "tesseract.js"],
  // Security headers (CSP, HSTS, frame protections, etc.) are applied in
  // src/middleware.ts instead of here, since the CSP needs a fresh per-request
  // nonce for Next.js's own inline hydration scripts.
};

export default nextConfig;
