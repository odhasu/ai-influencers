import "server-only";

export type SafeJsonResult =
  | { ok: true; value: unknown }
  | {
      ok: false;
      error: "unsupported_media_type" | "payload_too_large" | "invalid_json";
    };

export type SafeTextResult =
  | { ok: true; value: string }
  | { ok: false; error: "payload_too_large" | "invalid_text" };

export function isSameOriginBrowserRequest(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") return false;

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function isJsonMediaType(contentType: string | null) {
  const mediaType = contentType?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  return mediaType === "application/json" || (mediaType.startsWith("application/") && mediaType.endsWith("+json"));
}

export async function readBoundedText(request: Request, maxBytes: number): Promise<SafeTextResult> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new Error("maxBytes must be a positive safe integer.");
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const normalizedLength = contentLength.trim();
    if (!/^\d+$/.test(normalizedLength)) return { ok: false, error: "invalid_text" };
    if (Number(normalizedLength) > maxBytes) return { ok: false, error: "payload_too_large" };
  }

  if (!request.body) return { ok: false, error: "invalid_text" };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return { ok: false, error: "payload_too_large" };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, error: "invalid_text" };
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return { ok: true, value: new TextDecoder("utf-8", { fatal: true }).decode(bytes) };
  } catch {
    return { ok: false, error: "invalid_text" };
  }
}

export async function readBoundedJson(request: Request, maxBytes: number): Promise<SafeJsonResult> {
  if (!isJsonMediaType(request.headers.get("content-type"))) {
    return { ok: false, error: "unsupported_media_type" };
  }

  const body = await readBoundedText(request, maxBytes);
  if (!body.ok) {
    return {
      ok: false,
      error: body.error === "payload_too_large" ? "payload_too_large" : "invalid_json"
    };
  }

  try {
    return { ok: true, value: JSON.parse(body.value) as unknown };
  } catch {
    return { ok: false, error: "invalid_json" };
  }
}
