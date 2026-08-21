import { describe, it, expect } from "vitest";
import { AppError, toClientError } from "@/lib/errors";

describe("AppError / toClientError", () => {
  it("maps a known AppError to its code, message, and status", () => {
    const err = new AppError("FILE_TOO_LARGE", "too big");
    const result = toClientError(err);
    expect(result).toEqual({ code: "FILE_TOO_LARGE", message: "too big", status: 413 });
  });

  it("never leaks internal error details for unknown/unexpected errors", () => {
    const err = new TypeError("Cannot read properties of undefined at /Users/x/secret/path.ts:42");
    const result = toClientError(err);
    expect(result.code).toBe("INTERNAL_ERROR");
    expect(result.status).toBe(500);
    expect(result.message).not.toContain("secret");
    expect(result.message).not.toContain(".ts:");
  });

  it("never leaks details for non-Error thrown values (e.g. thrown strings)", () => {
    const result = toClientError("raw string throw with /etc/passwd content");
    expect(result.code).toBe("INTERNAL_ERROR");
    expect(result.message).not.toContain("/etc/passwd");
  });
});
