import { createCanvas, PDFDocument } from "@napi-rs/canvas";
import fs from "node:fs";
import path from "node:path";

const DIR = path.join(process.cwd(), "tests", "e2e", ".generated");

function write(name: string, buf: Buffer): string {
  fs.mkdirSync(DIR, { recursive: true });
  const p = path.join(DIR, name);
  fs.writeFileSync(p, buf);
  return p;
}

export function ensureFixtures() {
  const doc = new PDFDocument();
  const ctx = doc.beginPage(600, 200);
  ctx.font = "16px sans-serif";
  ctx.fillText("End to end test document about renewable energy policy.", 20, 40);
  doc.endPage();
  const validPdf = write("valid.pdf", doc.close());

  const oversized = write("oversized.pdf", Buffer.alloc(16 * 1024 * 1024, 1));

  // Regression fixture for a real bug found during security review: Next.js's
  // proxy/middleware layer silently truncates request bodies over 10MB by
  // default (proxyClientMaxBodySize), which broke uploads in the 10-15MB
  // range even though they're under the app's advertised 15MB limit. Fixed
  // in next.config.ts; this fixture (~12MB, under the limit) proves it stays fixed.
  const nearLimit = write("near-limit.pdf", Buffer.alloc(12 * 1024 * 1024, 2));

  const unsupported = write("unsupported.txt", Buffer.from("plain text file, wrong extension for this app"));

  return { validPdf, oversized, unsupported, nearLimit };
}

export async function ensureImageFixture(): Promise<string> {
  const canvas = createCanvas(600, 150);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, 600, 150);
  ctx.fillStyle = "black";
  ctx.font = "26px sans-serif";
  ctx.fillText("End to end OCR test image content", 20, 80);
  const buf = await canvas.encode("png");
  return write("valid.png", buf);
}
