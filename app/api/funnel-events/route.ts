import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const eventNameSchema = z.enum([
  "landing_viewed",
  "scroll_depth_reached",
  "time_on_page_reached",
  "form_viewed",
  "form_started",
  "form_step_viewed",
  "form_step_completed",
  "form_validation_failed",
  "form_back_clicked",
  "form_submit_started",
  "form_success_shown",
  "form_submit_failed",
  "primary_cta_clicked",
  "testimonial_video_opened",
  "analytics_consent_granted"
]);

const propertiesSchema = z.object({
  lead_id: z.uuid().optional(),
  step_number: z.number().int().min(1).max(20).optional(),
  step_key: z.string().max(80).optional(),
  percent: z.number().int().min(0).max(100).optional(),
  cta_location: z.string().max(80).optional(),
  video_id: z.string().max(80).optional(),
  elapsed_ms: z.number().int().min(0).max(1000 * 60 * 60 * 8).optional(),
  utm_source: z.string().max(160).optional(),
  utm_medium: z.string().max(160).optional(),
  utm_campaign: z.string().max(160).optional(),
  referral_code: z.string().max(80).optional(),
  referral_link_id: z.uuid().optional(),
  landing_path: z.string().max(300).optional(),
  total_steps: z.number().int().min(1).max(20).optional(),
  seconds: z.number().int().min(0).max(60 * 60 * 8).optional(),
  video_position: z.number().int().min(1).max(100).optional(),
  has_utm_source: z.boolean().optional(),
  failure_type: z.string().max(80).optional()
});

const requestSchema = z.object({
  event: eventNameSchema,
  session_id: z.uuid(),
  properties: propertiesSchema.default({})
});

function deviceType(userAgent: string) {
  if (/ipad|tablet/i.test(userAgent)) return "tablet";
  if (/mobile|iphone|android/i.test(userAgent)) return "mobile";
  return "desktop";
}

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new Response(null, { status: 204 });

  const { event, session_id: sessionId, properties } = parsed.data;
  const metadata = {
    total_steps: properties.total_steps,
    seconds: properties.seconds,
    video_position: properties.video_position,
    has_utm_source: properties.has_utm_source,
    failure_type: properties.failure_type
  };

  try {
    const supabase = createSupabaseAdmin();
    const { error } = await supabase.from("funnel_events").insert({
      event_name: event,
      session_id: sessionId,
      lead_id: properties.lead_id ?? null,
      step_number: properties.step_number ?? null,
      step_key: properties.step_key ?? null,
      percent: properties.percent ?? null,
      cta_location: properties.cta_location ?? null,
      video_id: properties.video_id ?? null,
      elapsed_ms: properties.elapsed_ms ?? null,
      utm_source: properties.utm_source ?? null,
      utm_medium: properties.utm_medium ?? null,
      utm_campaign: properties.utm_campaign ?? null,
      referral_code: properties.referral_code ?? null,
      referral_link_id: properties.referral_link_id ?? null,
      landing_path: properties.landing_path ?? null,
      device_type: deviceType(request.headers.get("user-agent") ?? ""),
      metadata
    });

    if (error) return new Response(null, { status: 204 });
    return NextResponse.json({ ok: true }, { status: 202 });
  } catch {
    return new Response(null, { status: 204 });
  }
}
