import { fileTypeFromBuffer } from "file-type";
import { AppError } from "./errors";

export const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15MB
export const MAX_FILENAME_LENGTH = 200;

const ACCEPTED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

export type DocumentKind = "pdf" | "image";

export interface ValidatedFile {
  buffer: Buffer;
  mime: string;
  kind: DocumentKind;
  filename: string;
}

/** Strips path separators/traversal sequences; the sanitized name is for display only, never used as a filesystem path. */
function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "document";
  const stripped = base.replace(/[^\w.\- ]/g, "_").slice(0, MAX_FILENAME_LENGTH);
  return stripped.length > 0 ? stripped : "document";
}

/**
 * Validates an uploaded file server-side: size, then actual file signature
 * (magic bytes) rather than trusting the client-supplied MIME type or extension.
 */
export async function validateUpload(file: File): Promise<ValidatedFile> {
  if (!file || file.size === 0) {
    throw new AppError("EMPTY_FILE", "The selected file is empty.");
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new AppError(
      "FILE_TOO_LARGE",
      `File exceeds the ${MAX_FILE_BYTES / (1024 * 1024)}MB limit.`
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const detected = await fileTypeFromBuffer(buffer);
  const mime = detected?.mime;

  if (!mime || !ACCEPTED_MIME_TYPES.has(mime)) {
    throw new AppError(
      "INVALID_FILE_TYPE",
      "Unsupported file type. Please upload a PDF, PNG, JPEG, or WEBP file."
    );
  }

  return {
    buffer,
    mime,
    kind: mime === "application/pdf" ? "pdf" : "image",
    filename: sanitizeFilename(file.name || "document"),
  };
}
