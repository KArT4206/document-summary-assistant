import { createCanvas, loadImage, PDFDocument } from "@napi-rs/canvas";

export async function makeValidPdfBuffer(text = "This is a normal text-based PDF for testing purposes."): Promise<Buffer> {
  const { PDFDocument: _unused } = await import("@napi-rs/canvas");
  void _unused;
  const doc = new PDFDocument();
  const ctx = doc.beginPage(600, 200);
  ctx.font = "16px sans-serif";
  ctx.fillText(text, 20, 40);
  doc.endPage();
  return doc.close();
}

/** A "text-based" PDF here always embeds real vector text via @napi-rs/canvas, so pdf-parse's text layer picks it up directly (no OCR needed). */
export async function makeMultiPagePdfBuffer(pages: string[]): Promise<Buffer> {
  const doc = new PDFDocument();
  for (const text of pages) {
    const ctx = doc.beginPage(600, 200);
    ctx.font = "16px sans-serif";
    ctx.fillText(text, 20, 40);
    doc.endPage();
  }
  return doc.close();
}

/** An image-only ("scanned") PDF: text is rasterized to pixels first, so no text layer exists — exercises the OCR fallback path. */
export async function makeScannedPdfBuffer(text = "Scanned document content for OCR testing."): Promise<Buffer> {
  const raster = createCanvas(600, 200);
  const rctx = raster.getContext("2d");
  rctx.fillStyle = "white";
  rctx.fillRect(0, 0, 600, 200);
  rctx.fillStyle = "black";
  rctx.font = "24px sans-serif";
  rctx.fillText(text, 20, 80);
  const pngBuf = await raster.encode("png");

  const img = await loadImage(pngBuf);
  const doc = new PDFDocument();
  const ctx = doc.beginPage(600, 200);
  (ctx as unknown as { drawImage: (image: unknown, dx: number, dy: number, dw: number, dh: number) => void }).drawImage(img, 0, 0, 600, 200);
  doc.endPage();
  return doc.close();
}

export function makeEmptyPdfBuffer(): Buffer {
  const doc = new PDFDocument();
  doc.beginPage(200, 200);
  doc.endPage();
  return doc.close();
}

export function makeCorruptedPdfBuffer(): Buffer {
  return Buffer.from("%PDF-1.4\nthis is not a valid pdf structure at all\n%%EOF");
}

export async function makeTextImageBuffer(text = "Hello world this is readable test text"): Promise<Buffer> {
  const canvas = createCanvas(600, 150);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, 600, 150);
  ctx.fillStyle = "black";
  ctx.font = "28px sans-serif";
  ctx.fillText(text, 20, 80);
  return canvas.encode("png");
}

export async function makeBlankImageBuffer(): Promise<Buffer> {
  const canvas = createCanvas(200, 200);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, 200, 200);
  return canvas.encode("png");
}

/** A File-like object backed by a real Buffer, for code paths expecting the web File API (validateUpload). */
export function bufferToFile(buffer: Buffer, filename: string, mimeHint?: string): File {
  return new File([new Uint8Array(buffer)], filename, mimeHint ? { type: mimeHint } : undefined);
}
