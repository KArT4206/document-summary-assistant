import { AppError } from "./errors";

export interface LimitedRequest {
  request: Request;
  /** True once the stream was cut off for exceeding the limit. Check this after
   *  a failed `.formData()`/`.arrayBuffer()` call: downstream parsers (Next's
   *  formData() included) tend to swallow the underlying stream error and
   *  throw their own generic parse error instead, so the limit-exceeded signal
   *  has to be read back out of here rather than relying on catching our
   *  AppError by identity. */
  exceeded: () => boolean;
}

/**
 * Enforces a hard byte cap on a request body by reading it as a stream and
 * counting bytes as they arrive, rather than trusting the client-supplied
 * `Content-Length` header (which a client can omit, lie about, or use
 * chunked transfer-encoding to bypass).
 */
export function enforceBodySizeLimit(req: Request, maxBytes: number): LimitedRequest {
  if (!req.body) return { request: req, exceeded: () => false };

  let received = 0;
  let didExceed = false;
  const reader = req.body.getReader();

  const limited = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      received += value.byteLength;
      if (received > maxBytes) {
        didExceed = true;
        controller.error(new AppError("REQUEST_TOO_LARGE", `Upload exceeds the ${Math.floor(maxBytes / (1024 * 1024))}MB limit.`));
        await reader.cancel();
        return;
      }
      controller.enqueue(value);
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });

  const request = new Request(req.url, {
    method: req.method,
    headers: req.headers,
    body: limited,
    // @ts-expect-error - `duplex` is required by undici for streaming bodies but missing from the DOM lib's RequestInit type
    duplex: "half",
  });

  return { request, exceeded: () => didExceed };
}
