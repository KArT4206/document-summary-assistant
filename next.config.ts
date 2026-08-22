import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Minor info-disclosure found during live-deployment security check: Next.js
  // sets this by default, revealing the framework in every response.
  poweredByHeader: false,
  // pdfjs-dist and tesseract.js load worker/wasm files at runtime via their own
  // module resolution; bundling them breaks that, so run them as plain Node modules.
  // @napi-rs/canvas is a native-binary package — found missing on Vercel's
  // serverless runtime during live-deployment verification ("Cannot find
  // module '@napi-rs/canvas'"): without being external, Next's file tracing
  // didn't include its .node binary in the deployed function bundle. Works
  // locally because the module is just resolved from node_modules directly.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "@napi-rs/canvas", "tesseract.js"],
  // serverExternalPackages alone isn't enough: @napi-rs/canvas resolves its
  // platform-specific .node binary via a dynamic, platform-detected require
  // inside the package, which Next's static output-file tracing can't follow.
  // Without this, the binary gets silently dropped from the deployed
  // serverless function bundle even though the build succeeds and everything
  // works locally — found via a real 500 on the live Vercel deployment.
  outputFileTracingIncludes: {
    "/api/summarize": [
      "./node_modules/@napi-rs/canvas/**",
      "./node_modules/@napi-rs/canvas-*/**",
      "./node_modules/tesseract.js/**",
      "./node_modules/tesseract.js-core/**",
      "./node_modules/bmp-js/**",
      "./node_modules/idb-keyval/**",
      "./node_modules/is-url/**",
      "./node_modules/node-fetch/**",
      "./node_modules/regenerator-runtime/**",
      "./node_modules/wasm-feature-detect/**",
      "./node_modules/zlibjs/**",
      "./node_modules/pdfjs-dist/legacy/build/*.mjs",
    ],
  },
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
