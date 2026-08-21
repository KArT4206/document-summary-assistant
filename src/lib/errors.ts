export type ErrorCode =
  | "INVALID_FILE_TYPE"
  | "FILE_TOO_LARGE"
  | "EMPTY_FILE"
  | "NO_FILE"
  | "INVALID_REQUEST"
  | "EXTRACTION_FAILED"
  | "EMPTY_EXTRACTED_TEXT"
  | "AI_TIMEOUT"
  | "AI_RATE_LIMITED"
  | "AI_PROVIDER_ERROR"
  | "AI_INVALID_RESPONSE"
  | "RATE_LIMITED"
  | "REQUEST_TOO_LARGE"
  | "INTERNAL_ERROR";

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  INVALID_FILE_TYPE: 415,
  FILE_TOO_LARGE: 413,
  EMPTY_FILE: 422,
  NO_FILE: 400,
  INVALID_REQUEST: 400,
  EXTRACTION_FAILED: 422,
  EMPTY_EXTRACTED_TEXT: 422,
  AI_TIMEOUT: 504,
  AI_RATE_LIMITED: 429,
  AI_PROVIDER_ERROR: 502,
  AI_INVALID_RESPONSE: 502,
  RATE_LIMITED: 429,
  REQUEST_TOO_LARGE: 413,
  INTERNAL_ERROR: 500,
};

/** User-facing message only — never a stack trace or internal detail. */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;

  constructor(code: ErrorCode, message: string) {
    super(message);
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.name = "AppError";
  }
}

export function toClientError(err: unknown): { code: ErrorCode; message: string; status: number } {
  if (err instanceof AppError) {
    return { code: err.code, message: err.message, status: err.status };
  }
  return {
    code: "INTERNAL_ERROR",
    message: "Something went wrong while processing your request. Please try again.",
    status: 500,
  };
}
