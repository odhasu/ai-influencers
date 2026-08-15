import { isSameOriginBrowserRequest, readBoundedJson } from "@/lib/api-security";
import { consumeRateLimit } from "@/lib/rate-limit";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const eventNameSchema = z.enum([
  "analytics_consent_granted",
  "page_viewed",
  "page_engagement_recorded",
  "landing_viewed",
  "scroll_depth_reached",
  "time_on_page_reached",
  "button_clicked",
  "primary_cta_clicked",
  "form_viewed",
  "form_started",
  "form_step_viewed",
  "form_step_completed",
  "form_field_focused",
  "form_field_completed",
  "form_validation_failed",
  "form_back_clicked",
  "form_abandoned",
  "form_submit_started",
  "form_success_shown",
  "form_submit_failed",
  "testimonial_video_opened",
  "vsl_started",
  "vsl_played",
  "vsl_paused",
  "vsl_watch_batch",
  "vsl_progress_reached",
  "vsl_completed",
  "booking_started"
]);

const shortString = z.string().max(160);
const attributionTouchSchema = z.object({
  captured_at: z.union([z.literal(""), z.iso.datetime()]),
  landing_path: z.string().max(300),
  referrer_domain: shortString,
  referrer_path: z.string().max(300),
  referral_code: z.string().max(80),
  utm_source: shortString,
  utm_medium: shortString,
  utm_campaign: shortString,
  utm_content: shortString,
  utm_term: shortString,
  gclid: z.string().max(300),
  gbraid: z.string().max(300),
  wbraid: z.string().max(300),
  fbclid: z.string().max(300),
  ttclid: z.string().max(300),
  msclkid: z.string().max(300),
  twclid: z.string().max(300),
  li_fat_id: z.string().max(300),
  sccid: z.string().max(300),
  dclid: z.string().max(300)
});

const contextSchema = z.object({
  visitor_id: z.uuid(),
  session_id: z.uuid(),
  pageview_id: z.uuid(),
  session_number: z.number().int().min(1).max(10000),
  is_returning_visitor: z.boolean(),
  timezone: z.string().max(80),
  locale: z.string().max(40),
  viewport_width: z.number().int().min(0).max(20000),
  viewport_height: z.number().int().min(0).max(20000),
  first_touch: attributionTouchSchema,
  last_touch: attributionTouchSchema
});

const propertiesSchema = z.object({
  step_number: z.number().int().min(1).max(20).optional(),
  step_key: z.string().max(80).optional(),
  percent: z.number().int().min(0).max(100).optional(),
  cta_location: z.string().max(80).optional(),
  video_id: z.string().max(80).optional(),
  elapsed_ms: z.number().int().min(0).max(1000 * 60 * 60 * 8).optional(),
  landing_path: z.string().max(300).optional(),
  total_steps: z.number().int().min(1).max(20).optional(),
  seconds: z.number().int().min(0).max(60 * 60 * 8).optional(),
  page_type: z.string().max(80).optional(),
  engaged_ms: z.number().int().min(0).max(1000 * 60 * 60 * 24).optional(),
  max_scroll_percent: z.number().int().min(0).max(100).optional(),
  field_key: z.string().max(80).optional(),
  field_type: z.enum(["choice", "text", "email", "tel"]).optional(),
  field_completed: z.boolean().optional(),
  focus_duration_ms: z.number().int().min(0).max(1000 * 60 * 60).optional(),
  step_elapsed_ms: z.number().int().min(0).max(1000 * 60 * 60 * 8).optional(),
  completed_steps: z.number().int().min(0).max(20).optional(),
  abandon_reason: z.enum(["page_hidden", "page_unloaded", "navigation"]).optional(),
  failure_type: z.string().max(80).optional(),
  from_step_number: z.number().int().min(1).max(20).optional(),
  from_step_key: z.string().max(80).optional(),
  button_label: z.string().max(80).optional(),
  destination_host: z.string().max(160).optional(),
  destination_path: z.string().max(300).optional(),
  provider: z.string().max(80).optional(),
  video_duration_seconds: z.number().int().min(0).max(60 * 60 * 8).optional(),
  furthest_second: z.number().int().min(0).max(60 * 60 * 8).optional(),
  watched_seconds: z.array(z.number().int().min(0).max(60 * 60 * 8)).max(30).optional(),
  source: z.string().max(80).optional()
});

const requestSchema = z.object({
  event: eventNameSchema,
  occurred_at: z.iso.datetime(),
  session_id: z.uuid(),
  context: contextSchema,
  properties: propertiesSchema.default({})
});

function decodedHeader(headers: Headers, name: string, maxLength = 160) {
  const value = (headers.get(name) ?? "").slice(0, maxLength);
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function deviceInfo(userAgent: string) {
  const deviceType = /ipad|tablet/i.test(userAgent)
    ? "tablet"
    : /mobile|iphone|android/i.test(userAgent)
      ? "mobile"
      : "desktop";
  const browser = /edg\//i.test(userAgent)
    ? "edge"
    : /firefox\//i.test(userAgent)
      ? "firefox"
      : /chrome\//i.test(userAgent)
        ? "chrome"
        : /safari\//i.test(userAgent)
          ? "safari"
          : "other";
  const os = /windows/i.test(userAgent)
    ? "windows"
    : /android/i.test(userAgent)
      ? "android"
      : /iphone|ipad|ios/i.test(userAgent)
        ? "ios"
        : /mac os|macintosh/i.test(userAgent)
          ? "macos"
          : /linux/i.test(userAgent)
            ? "linux"
            : "other";
  return { deviceType, browser, os };
}

export async function POST(request: Request) {
  if (!isSameOriginBrowserRequest(request)) {
    return NextResponse.json({ ok: false, message: "Forbidden." }, { status: 403 });
  }

  const rateLimit = await consumeRateLimit({
    request,
    scope: "funnel-events",
    limit: 120,
    windowSeconds: 60
  });
  if (!rateLimit.available) {
    return NextResponse.json(
      { ok: false, message: "Analytics ingestion is temporarily unavailable." },
      { status: 503, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
    );
  }
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { ok: false, message: "Too many analytics events." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
    );
  }

  const body = await readBoundedJson(request, 32 * 1024);
  if (!body.ok) {
    const status = body.error === "unsupported_media_type" ? 415 : body.error === "payload_too_large" ? 413 : 400;
    return NextResponse.json(
      {
        ok: false,
        message: body.error === "payload_too_large" ? "Request body is too large." : "Invalid analytics payload."
      },
      { status }
    );
  }

  const parsed = requestSchema.safeParse(body.value);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid analytics payload." }, { status: 400 });
  }

  const { event, occurred_at: occurredAt, session_id: sessionId, context, properties } = parsed.data;
  if (context.session_id !== sessionId) {
    return NextResponse.json({ ok: false, message: "Invalid analytics payload." }, { status: 400 });
  }
  const userAgent = request.headers.get("user-agent") ?? "";
  const device = deviceInfo(userAgent);
  const lastTouch = context.last_touch;
  const clickIds = Object.fromEntries(
    ["gclid", "gbraid", "wbraid", "fbclid", "ttclid", "msclkid", "twclid", "li_fat_id", "sccid", "dclid"]
      .map((key) => [key, lastTouch[key as keyof typeof lastTouch]])
      .filter(([, value]) => value)
  );

  try {
    const supabase = createSupabaseAdmin();
    const { error } = await supabase.from("funnel_events").insert({
      event_name: event,
      event_client_at: occurredAt,
      session_id: sessionId,
      visitor_id: context.visitor_id,
      pageview_id: context.pageview_id,
      step_number: properties.step_number ?? null,
      step_key: properties.step_key ?? null,
      percent: properties.percent ?? properties.max_scroll_percent ?? null,
      cta_location: properties.cta_location ?? null,
      video_id: properties.video_id ?? null,
      elapsed_ms: properties.elapsed_ms ?? properties.engaged_ms ?? properties.focus_duration_ms ?? null,
      utm_source: lastTouch.utm_source || null,
      utm_medium: lastTouch.utm_medium || null,
      utm_campaign: lastTouch.utm_campaign || null,
      utm_content: lastTouch.utm_content || null,
      utm_term: lastTouch.utm_term || null,
      referral_code: lastTouch.referral_code || null,
      landing_path: properties.landing_path ?? lastTouch.landing_path ?? null,
      referrer_domain: lastTouch.referrer_domain || null,
      device_type: device.deviceType,
      browser: device.browser,
      os: device.os,
      country: (request.headers.get("x-vercel-ip-country") ?? "").slice(0, 8) || null,
      region: decodedHeader(request.headers, "x-vercel-ip-country-region", 80) || null,
      city: decodedHeader(request.headers, "x-vercel-ip-city", 160) || null,
      timezone: context.timezone || null,
      first_touch: context.first_touch,
      last_touch: context.last_touch,
      click_ids: clickIds,
      metadata: {
        ...properties,
        session_number: context.session_number,
        is_returning_visitor: context.is_returning_visitor,
        locale: context.locale,
        viewport_width: context.viewport_width,
        viewport_height: context.viewport_height
      }
    });

    if (error) {
      console.error("[funnel-events] insert failed:", error.message);
      return NextResponse.json(
        { ok: false, message: "Analytics event could not be stored." },
        { status: 503, headers: { "Retry-After": "30" } }
      );
    }
    return NextResponse.json({ ok: true }, { status: 202 });
  } catch (error) {
    console.error(
      "[funnel-events] unexpected failure:",
      error instanceof Error ? error.message : "unknown error"
    );
    return NextResponse.json(
      { ok: false, message: "Analytics event could not be stored." },
      { status: 503, headers: { "Retry-After": "30" } }
    );
  }
}
