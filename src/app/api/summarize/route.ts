import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateUpload, MAX_FILE_BYTES } from "@/lib/validation";
import { extractText } from "@/lib/extraction/extract";
import { getAIProvider, SummaryLengthSchema } from "@/lib/ai";
import { checkRateLimit, getClientKey } from "@/lib/rate-limit";
import { AppError, toClientError } from "@/lib/errors";

export const runtime = "nodejs";
export const maxDuration = 120;

const RequestSchema = z.object({
  length: SummaryLengthSchema,
});

export async function POST(req: NextRequest) {
  try {
    const clientKey = getClientKey(req.headers);
    checkRateLimit(`summarize:${clientKey}`, { limit: 10, windowMs: 5 * 60 * 1000 });

    const contentLength = Number(req.headers.get("content-length") || 0);
    if (contentLength > MAX_FILE_BYTES * 1.2) {
      throw new AppError("REQUEST_TOO_LARGE", `Upload exceeds the ${MAX_FILE_BYTES / (1024 * 1024)}MB limit.`);
    }

    const formData = await req.formData();
    const file = formData.get("file");
    const lengthRaw = formData.get("length");

    if (!(file instanceof File)) {
      throw new AppError("NO_FILE", "No file was provided.");
    }

    const parsedRequest = RequestSchema.safeParse({ length: lengthRaw ?? "medium" });
    if (!parsedRequest.success) {
      throw new AppError("INVALID_REQUEST", "Invalid summary length requested.");
    }
    const { length } = parsedRequest.data;

    const validated = await validateUpload(file);
    const extraction = await extractText(validated.buffer, validated.kind);

    checkRateLimit(`ai:${clientKey}`, { limit: 20, windowMs: 5 * 60 * 1000 });

    const provider = getAIProvider();
    const result = await provider.generateSummary({ documentText: extraction.text, length });

    return NextResponse.json({
      filename: validated.filename,
      extractionMethod: extraction.method,
      pageCount: extraction.pageCount,
      warning: extraction.warning,
      sourceTextPreview: extraction.text.slice(0, 5000),
      ...result,
    });
  } catch (err) {
    const { code, message, status } = toClientError(err);
    if (status >= 500) {
      console.error("[summarize] internal error:", err);
    }
    return NextResponse.json({ error: { code, message } }, { status });
  }
}
