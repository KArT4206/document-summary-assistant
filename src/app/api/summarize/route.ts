import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateUpload, MAX_FILE_BYTES } from "@/lib/validation";
import { extractText } from "@/lib/extraction/extract";
import { getAIProvider, SummaryLengthSchema } from "@/lib/ai";
import { checkRateLimit, getClientKey } from "@/lib/rate-limit";
import { AppError, toClientError } from "@/lib/errors";
import { enforceBodySizeLimit } from "@/lib/request-limits";

export const runtime = "nodejs";
export const maxDuration = 120;

const RequestSchema = z.object({
  length: SummaryLengthSchema,
});

export async function POST(req: NextRequest) {
  try {
    const clientKey = getClientKey(req.headers);
    checkRateLimit(`summarize:${clientKey}`, { limit: 10, windowMs: 5 * 60 * 1000 });

    // Cheap header-based rejection first (avoids reading anything for an obviously oversized request)...
    const contentLength = Number(req.headers.get("content-length") || 0);
    if (contentLength > MAX_FILE_BYTES * 1.2) {
      throw new AppError("REQUEST_TOO_LARGE", `Upload exceeds the ${MAX_FILE_BYTES / (1024 * 1024)}MB limit.`);
    }

    // ...but Content-Length is client-supplied and can be omitted, lied about, or
    // bypassed with chunked transfer-encoding, so also enforce a hard cap on the
    // actual bytes read from the stream — this is the real backstop.
    const limited = enforceBodySizeLimit(req, MAX_FILE_BYTES * 1.2);
    let formData: FormData;
    try {
      formData = await limited.request.formData();
    } catch (err) {
      // The underlying stream error (AppError) usually doesn't survive Next's
      // own formData() parsing — it gets replaced with a generic TypeError.
      // Use the side-channel flag to still report the correct 413, not a 500.
      if (limited.exceeded()) {
        throw new AppError("REQUEST_TOO_LARGE", `Upload exceeds the ${MAX_FILE_BYTES / (1024 * 1024)}MB limit.`);
      }
      throw err;
    }
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
