import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfjs-dist and tesseract.js load worker/wasm files at runtime via their own
  // module resolution; bundling them breaks that, so run them as plain Node modules.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "tesseract.js"],
  // Security headers (CSP, HSTS, frame protections, etc.) are applied in
  // src/proxy.ts instead of here, since the CSP needs a fresh per-request
  // nonce for Next.js's own inline hydration scripts.
  experimental: {
    // Next's own proxy/middleware layer silently truncates any request body
    // over 10MB by default (undocumented until you hit it — surfaces as a
    // generic "Failed to parse body as FormData" error, not an obvious size
    // error). Since src/proxy.ts runs on every route including
    // /api/summarize, this was truncating legitimate uploads well under our
    // advertised 15MB limit. Raised to comfortably clear
    // MAX_FILE_BYTES * 1.2 (~18MB) from src/lib/validation.ts.
    proxyClientMaxBodySize: 20 * 1024 * 1024,
  },
};

export default nextConfig;
