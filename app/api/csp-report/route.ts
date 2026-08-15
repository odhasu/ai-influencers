import { readBoundedText } from "@/lib/api-security";
import { consumeRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

function safeUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`.slice(0, 500);
  } catch {
    return value.slice(0, 200);
  }
}

function safeText(value: unknown, maxLength = 160) {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, maxLength)
    : null;
}

export async function POST(request: Request) {
  const mediaType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (mediaType !== "application/csp-report" && mediaType !== "application/reports+json") {
    return new Response(null, { status: 204 });
  }

  const rateLimit = await consumeRateLimit({
    request,
    scope: "csp_report",
    limit: 60,
    windowSeconds: 60
  });
  if (!rateLimit.available || !rateLimit.allowed) return new Response(null, { status: 204 });

  const body = await readBoundedText(request, 32 * 1024);
  if (!body.ok) return new Response(null, { status: 204 });

  try {
    const parsed = JSON.parse(body.value) as unknown;
    const envelope = Array.isArray(parsed) ? parsed[0] : parsed;
    if (!envelope || typeof envelope !== "object") return new Response(null, { status: 204 });
    const record = envelope as Record<string, unknown>;
    const report =
      record["csp-report"] && typeof record["csp-report"] === "object"
        ? (record["csp-report"] as Record<string, unknown>)
        : record.body && typeof record.body === "object"
          ? (record.body as Record<string, unknown>)
          : record;

    console.warn("csp_violation", {
      document: safeUrl(report["document-uri"] ?? report.documentURL),
      blocked: safeUrl(report["blocked-uri"] ?? report.blockedURL),
      directive: safeText(report["effective-directive"] ?? report.effectiveDirective),
      disposition: safeText(report.disposition, 40)
    });
  } catch {
    // Browsers do not need to retry malformed reports.
  }

  return new Response(null, { status: 204 });
}
