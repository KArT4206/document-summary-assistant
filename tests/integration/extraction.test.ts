import { describe, it, expect } from "vitest";
import { extractText } from "@/lib/extraction/extract";
import { AppError } from "@/lib/errors";
import {
  makeValidPdfBuffer,
  makeMultiPagePdfBuffer,
  makeScannedPdfBuffer,
  makeEmptyPdfBuffer,
  makeCorruptedPdfBuffer,
  makeTextImageBuffer,
  makeBlankImageBuffer,
} from "../helpers/fixtures";

// @napi-rs/canvas's PDF text operator renders inter-word gaps as U+0001 rather
// than a literal space when pdf.js re-extracts it — a quirk of this fixture
// generator, not of real-world PDFs (Word/Google Docs/print-to-PDF encode
// spaces normally). Normalize before asserting on word boundaries.
function normalize(text: string): string {
  return text.replace(/\u0001/g, " ");
}

describe("PDF extraction", () => {
  it("extracts text from a normal text-based PDF", async () => {
    const buf = await makeValidPdfBuffer("The quick brown fox jumps over the lazy dog.");
    const result = await extractText(buf, "pdf");
    expect(result.method).toBe("pdf-text");
    expect(normalize(result.text)).toContain("quick brown fox");
    expect(result.pageCount).toBe(1);
  });

  it("extracts text from a multi-page PDF and reports the correct page count", async () => {
    const buf = await makeMultiPagePdfBuffer(["Page one content here.", "Page two content here.", "Page three content here."]);
    const result = await extractText(buf, "pdf");
    expect(result.method).toBe("pdf-text");
    expect(result.pageCount).toBe(3);
    expect(normalize(result.text)).toContain("Page one");
    expect(normalize(result.text)).toContain("Page three");
  }, 20_000);

  it("throws EMPTY_EXTRACTED_TEXT for a PDF with no content and no OCR-able pixels", async () => {
    const buf = makeEmptyPdfBuffer();
    await expect(extractText(buf, "pdf")).rejects.toMatchObject({ code: "EMPTY_EXTRACTED_TEXT" });
  }, 30_000);

  it("throws EXTRACTION_FAILED for a corrupted/malformed PDF rather than crashing", async () => {
    const buf = makeCorruptedPdfBuffer();
    await expect(extractText(buf, "pdf")).rejects.toBeInstanceOf(AppError);
    await expect(extractText(buf, "pdf")).rejects.toMatchObject({ code: "EXTRACTION_FAILED" });
  });

  it("falls back to OCR for a scanned (image-only) PDF and extracts the rendered text", async () => {
    const buf = await makeScannedPdfBuffer("Invoice total due is four hundred dollars");
    const result = await extractText(buf, "pdf");
    expect(result.method).toBe("pdf-ocr");
    expect(result.text.toLowerCase()).toContain("invoice");
  }, 60_000);
});

describe("Image OCR", () => {
  it("extracts readable text from a clear text image", async () => {
    const buf = await makeTextImageBuffer("Testing readable optical character recognition");
    const result = await extractText(buf, "image");
    expect(result.method).toBe("ocr");
    expect(result.text.toLowerCase()).toContain("testing");
  }, 30_000);

  it("throws EMPTY_EXTRACTED_TEXT for a blank image with no text", async () => {
    const buf = await makeBlankImageBuffer();
    await expect(extractText(buf, "image")).rejects.toMatchObject({ code: "EMPTY_EXTRACTED_TEXT" });
  }, 30_000);
});
