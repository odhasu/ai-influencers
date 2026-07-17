import { createHmac, timingSafeEqual } from "node:crypto";

const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function verifyCalendlyWebhook(
  rawBody: string,
  signatureHeader: string | null,
  signingKey: string,
  now = Date.now()
) {
  if (!signatureHeader || !signingKey) return false;

  const parts = signatureHeader.split(",").reduce<Record<string, string[]>>((result, part) => {
    const [key, value] = part.trim().split("=", 2);
    if (key && value) (result[key] ??= []).push(value);
    return result;
  }, {});
  const timestamp = Number(parts.t?.[0]);
  const signatures = parts.v1 ?? [];

  if (!Number.isFinite(timestamp) || signatures.length === 0) return false;
  if (Math.abs(Math.floor(now / 1000) - timestamp) > SIGNATURE_TOLERANCE_SECONDS) return false;

  const expected = createHmac("sha256", signingKey)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  return signatures.some((signature) => safeEqual(signature, expected));
}
