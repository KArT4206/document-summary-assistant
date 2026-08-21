import { AppError } from "../errors";
import type { DocumentKind } from "../validation";

export interface ExtractionResult {
  text: string;
  method: "pdf-text" | "ocr" | "pdf-ocr";
  pageCount?: number;
  warning?: string;
}

const MAX_PDF_PAGES = 200; // hard cap for text-based PDFs
const MAX_OCR_PDF_PAGES = 15; // scanned PDFs are far more expensive to process; capped lower
const MAX_OCR_RENDER_WIDTH = 1600; // px — bounds memory per rendered page
const OCR_PAGE_TIMEOUT_MS = 45_000; // per-page ceiling
const OCR_TOTAL_TIMEOUT_MS = 120_000; // whole-document ceiling, regardless of page count
const MIN_TEXT_LENGTH = 20;
const MAX_EXTRACTED_CHARS = 200_000; // caps AI cost/latency on huge documents

async function withTimeout<T>(promise: Promise<T>, ms: number, onTimeout: () => AppError): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(onTimeout()), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer!);
  }
}

async function ocrBuffer(worker: Awaited<ReturnType<typeof import("tesseract.js").createWorker>>, buffer: Buffer | Uint8Array): Promise<string> {
  const result = await withTimeout(
    worker.recognize(Buffer.from(buffer)),
    OCR_PAGE_TIMEOUT_MS,
    () => new AppError("EXTRACTION_FAILED", "OCR timed out while processing a page.")
  );
  return (result.data.text || "").trim();
}

/**
 * Rasterizes each page of a scanned/image-only PDF and OCRs the rendered
 * images. Bounded on every axis that could otherwise let a hostile PDF
 * consume unlimited CPU/memory/time: page count, render resolution,
 * per-page timeout, and a total wall-clock budget for the whole document.
 */
async function ocrScannedPdf(
  parser: InstanceType<typeof import("pdf-parse").PDFParse>,
  totalPages: number
): Promise<{ text: string; warning?: string }> {
  const { createWorker } = await import("tesseract.js");

  const pagesToProcess = Math.min(totalPages, MAX_OCR_PDF_PAGES);
  const truncated = totalPages > MAX_OCR_PDF_PAGES;

  const startedAt = Date.now();
  const worker = await createWorker("eng", 1, { logger: () => {} });
  const pageTexts: string[] = [];

  try {
    for (let pageNum = 1; pageNum <= pagesToProcess; pageNum++) {
      if (Date.now() - startedAt > OCR_TOTAL_TIMEOUT_MS) {
        break; // stop early rather than exceed the total budget; partial results still returned
      }

      const screenshot = await withTimeout(
        parser.getScreenshot({ first: pageNum, last: pageNum, desiredWidth: MAX_OCR_RENDER_WIDTH, imageBuffer: true }),
        OCR_PAGE_TIMEOUT_MS,
        () => new AppError("EXTRACTION_FAILED", "Rendering a page for OCR timed out.")
      );

      const page = screenshot.pages[0];
      if (!page?.data) continue;

      const text = await ocrBuffer(worker, page.data);
      if (text) pageTexts.push(text);
    }
  } finally {
    await worker.terminate();
  }

  const combined = pageTexts.join("\n\n").trim();
  const warnings: string[] = [];
  if (truncated) warnings.push(`Only the first ${MAX_OCR_PDF_PAGES} of ${totalPages} pages were OCR'd.`);
  if (Date.now() - startedAt > OCR_TOTAL_TIMEOUT_MS) warnings.push("OCR stopped early after reaching the processing time limit; the summary may be based on partial content.");

  return { text: combined, warning: warnings.length ? warnings.join(" ") : undefined };
}

async function extractFromPdf(buffer: Buffer): Promise<ExtractionResult> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });

  try {
    let info;
    let result;
    try {
      info = await parser.getInfo();
      if (info.total > MAX_PDF_PAGES) {
        throw new AppError("EXTRACTION_FAILED", `This PDF has too many pages (limit is ${MAX_PDF_PAGES}).`);
      }
      result = await parser.getText();
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(
        "EXTRACTION_FAILED",
        "This PDF could not be read. It may be corrupted or use an unsupported structure."
      );
    }

    const numpages = result.pages?.length ?? info.total;
    const text = (result.text || "").trim();

    if (text.length >= MIN_TEXT_LENGTH) {
      return {
        text: text.slice(0, MAX_EXTRACTED_CHARS),
        method: "pdf-text",
        pageCount: numpages,
        warning: text.length > MAX_EXTRACTED_CHARS ? "Document truncated to the first 200,000 characters." : undefined,
      };
    }

    // Little to no selectable text — likely a scanned/image-only PDF. Rasterize
    // and OCR it rather than giving up, within strict resource limits.
    let ocr;
    try {
      ocr = await ocrScannedPdf(parser, numpages);
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError("EXTRACTION_FAILED", "This scanned PDF could not be processed with OCR.");
    }

    if (ocr.text.length < MIN_TEXT_LENGTH) {
      throw new AppError(
        "EMPTY_EXTRACTED_TEXT",
        "No readable text was found in this PDF, even after OCR. It may be blank, a low-quality scan, or contain only images with no text."
      );
    }

    return {
      text: ocr.text.slice(0, MAX_EXTRACTED_CHARS),
      method: "pdf-ocr",
      pageCount: numpages,
      warning: ocr.warning,
    };
  } finally {
    await parser.destroy();
  }
}

async function extractFromImage(buffer: Buffer): Promise<ExtractionResult> {
  const { createWorker } = await import("tesseract.js");

  const worker = await createWorker("eng", 1, { logger: () => {} });
  try {
    const text = await ocrBuffer(worker, buffer);
    if (text.length < MIN_TEXT_LENGTH) {
      throw new AppError(
        "EMPTY_EXTRACTED_TEXT",
        "No readable text was found in this image. Try a higher-resolution scan or a clearer photo."
      );
    }
    return { text: text.slice(0, MAX_EXTRACTED_CHARS), method: "ocr" };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError("EXTRACTION_FAILED", "OCR failed to process this image.");
  } finally {
    await worker.terminate();
  }
}

export async function extractText(buffer: Buffer, kind: DocumentKind): Promise<ExtractionResult> {
  return kind === "pdf" ? extractFromPdf(buffer) : extractFromImage(buffer);
}
