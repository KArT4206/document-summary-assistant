import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { makeValidPdfBuffer, bufferToFile } from "../helpers/fixtures";

vi.mock("@/lib/ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai")>();
  return {
    ...actual,
    getAIProvider: () => ({
      generateSummary: async () => ({
        summary: "mock summary",
        keyPoints: ["mock point"],
        mainIdeas: ["mock idea"],
        improvementSuggestions: ["mock suggestion"],
      }),
    }),
  };
});

let counter = 0;
function uniqueIp() {
  counter += 1;
  return `10.0.${Math.floor(counter / 250)}.${counter % 250}`;
}

async function postSummarize(opts: { file?: File; length?: string; ip?: string; extraHeaders?: Record<string, string> }) {
  const { POST } = await import("@/app/api/summarize/route");
  const formData = new FormData();
  if (opts.file) formData.append("file", opts.file);
  if (opts.length !== undefined) formData.append("length", opts.length);

  const headers = new Headers({ "x-forwarded-for": opts.ip ?? uniqueIp(), ...opts.extraHeaders });
  const req = new NextRequest("http://localhost:3000/api/summarize", {
    method: "POST",
    body: formData,
    headers,
  });
  const res = await POST(req);
  const body = await res.json();
  return { status: res.status, body };
}

describe("POST /api/summarize", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns a full summary for a valid PDF request", async () => {
    const buf = await makeValidPdfBuffer("Valid request test content here.");
    const file = bufferToFile(buf, "doc.pdf", "application/pdf");
    const { status, body } = await postSummarize({ file, length: "short" });

    expect(status).toBe(200);
    expect(body.summary).toBe("mock summary");
    expect(body.keyPoints).toEqual(["mock point"]);
    expect(body.extractionMethod).toBe("pdf-text");
  });

  it("returns 400 when no file is provided (missing body)", async () => {
    const { status, body } = await postSummarize({ length: "short" });
    expect(status).toBe(400);
    expect(body.error.code).toBe("NO_FILE");
  });

  it("returns 400 for an invalid summary length value", async () => {
    const buf = await makeValidPdfBuffer();
    const file = bufferToFile(buf, "doc.pdf", "application/pdf");
    const { status, body } = await postSummarize({ file, length: "extra-long-invalid" });
    expect(status).toBe(400);
    expect(body.error.code).toBe("INVALID_REQUEST");
  });

  it("returns 415 for an unsupported/spoofed file type", async () => {
    const file = bufferToFile(Buffer.from("not a real document"), "doc.pdf", "application/pdf");
    const { status, body } = await postSummarize({ file, length: "short" });
    expect(status).toBe(415);
    expect(body.error.code).toBe("INVALID_FILE_TYPE");
  });

  it("returns 413 when the declared Content-Length exceeds the limit (oversized request, header-only check)", async () => {
    const buf = await makeValidPdfBuffer();
    const file = bufferToFile(buf, "doc.pdf", "application/pdf");
    const { status, body } = await postSummarize({
      file,
      length: "short",
      extraHeaders: { "content-length": String(30 * 1024 * 1024) },
    });
    expect(status).toBe(413);
    expect(body.error.code).toBe("REQUEST_TOO_LARGE");
  });

  it("never leaks stack traces or internal details in error responses", async () => {
    const { body } = await postSummarize({ length: "short" });
    const serialized = JSON.stringify(body);
    expect(serialized).not.toMatch(/at\s+\S+\s+\(.*:\d+:\d+\)/); // stack-frame-like pattern
    expect(serialized).not.toContain("node_modules");
  });

  it("enforces per-IP rate limiting on repeated requests and returns 429", async () => {
    const ip = uniqueIp();
    const results: number[] = [];
    for (let i = 0; i < 12; i++) {
      // deliberately invalid file so each call is cheap; only the rate-limit check matters here
      const { status } = await postSummarize({ length: "short", ip });
      results.push(status);
    }
    expect(results).toContain(429);
    // the first several requests should NOT have been rate-limited (limit is 10/5min)
    expect(results.slice(0, 9).every((s) => s !== 429)).toBe(true);
  });
});
