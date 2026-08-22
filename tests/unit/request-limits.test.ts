import { describe, it, expect } from "vitest";
import { enforceBodySizeLimit } from "@/lib/request-limits";
import { AppError } from "@/lib/errors";

function makeStreamingRequest(totalBytes: number, chunkSize = 64 * 1024): Request {
  let sent = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent >= totalBytes) {
        controller.close();
        return;
      }
      const size = Math.min(chunkSize, totalBytes - sent);
      controller.enqueue(new Uint8Array(size));
      sent += size;
    },
  });
  return new Request("http://localhost/api/summarize", {
    method: "POST",
    body: stream,
    // @ts-expect-error - duplex required by undici, missing from DOM RequestInit type
    duplex: "half",
  });
}

describe("enforceBodySizeLimit", () => {
  it("passes through a body under the limit without error", async () => {
    const req = makeStreamingRequest(1024);
    const limited = enforceBodySizeLimit(req, 10_000);
    const buf = await limited.request.arrayBuffer();
    expect(buf.byteLength).toBe(1024);
    expect(limited.exceeded()).toBe(false);
  });

  it("rejects a body that exceeds the limit even though Content-Length was never declared (chunked-style)", async () => {
    const req = makeStreamingRequest(50_000);
    const limited = enforceBodySizeLimit(req, 10_000);
    await expect(limited.request.arrayBuffer()).rejects.toBeTruthy();
    expect(limited.exceeded()).toBe(true);
  });

  it("the rejection is a real AppError with a client-safe message, not a raw stream error", async () => {
    const req = makeStreamingRequest(50_000);
    const limited = enforceBodySizeLimit(req, 10_000);
    const err = await limited.request.arrayBuffer().catch((e) => e);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).status).toBe(413);
  });

  it("exceeded() reports false until the limit is actually crossed, even if checked mid-stream", async () => {
    const req = makeStreamingRequest(5_000);
    const limited = enforceBodySizeLimit(req, 10_000);
    expect(limited.exceeded()).toBe(false);
    await limited.request.arrayBuffer();
    expect(limited.exceeded()).toBe(false);
  });
});
