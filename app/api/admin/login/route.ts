import {
  adminCookieName,
  createAdminSessionToken,
  getAdminCookieOptions,
  isAdminConfigured,
  verifyAdminPassword
} from "@/lib/admin-auth";
import { isSameOriginBrowserRequest, readBoundedJson } from "@/lib/api-security";
import { consumeRateLimit } from "@/lib/rate-limit";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const loginSchema = z.object({
  password: z.string().min(1).max(300),
  rememberDevice: z.boolean().default(true)
});

export async function POST(request: Request) {
  if (!isSameOriginBrowserRequest(request)) {
    return NextResponse.json(
      { ok: false, message: "Forbidden." },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (!isAdminConfigured()) {
    return NextResponse.json(
      { ok: false, message: "Dashboard access has not been configured." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  const rateLimit = await consumeRateLimit({
    request,
    scope: "admin-login",
    limit: 5,
    windowSeconds: 15 * 60
  });
  if (!rateLimit.available) {
    return NextResponse.json(
      { ok: false, message: "Sign in is temporarily unavailable." },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": String(rateLimit.retryAfterSeconds)
        }
      }
    );
  }
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { ok: false, message: "Too many sign-in attempts. Try again later." },
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": String(rateLimit.retryAfterSeconds)
        }
      }
    );
  }

  const body = await readBoundedJson(request, 4 * 1024);
  if (!body.ok) {
    const status = body.error === "unsupported_media_type" ? 415 : body.error === "payload_too_large" ? 413 : 400;
    return NextResponse.json(
      { ok: false, message: body.error === "payload_too_large" ? "Request body is too large." : "Invalid login payload." },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }

  const parsed = loginSchema.safeParse(body.value);
  if (!parsed.success || !verifyAdminPassword(parsed.data.password)) {
    return NextResponse.json(
      { ok: false, message: "Invalid password." },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(
    adminCookieName,
    createAdminSessionToken(parsed.data.rememberDevice),
    getAdminCookieOptions(parsed.data.rememberDevice)
  );
  return response;
}
