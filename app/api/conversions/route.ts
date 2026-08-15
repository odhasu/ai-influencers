import { timingSafeEqual } from "node:crypto";
import { readBoundedJson } from "@/lib/api-security";
import { captureServerEvent } from "@/lib/posthog/server";
import { consumeRateLimit } from "@/lib/rate-limit";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { after, NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const conversionSchema = z.object({
  event: z.enum(["booking_completed", "checkout_started", "payment_succeeded", "conversion_recorded"]),
  lead_id: z.uuid(),
  external_id: z.string().trim().min(2).max(200),
  occurred_at: z.iso.datetime().optional(),
  value_cents: z.number().int().min(0).max(1_000_000_000).optional(),
  currency: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3}$/)
    .transform((value) => value.toUpperCase())
    .optional(),
  provider: z.string().trim().max(80).default("external"),
  product_id: z.string().trim().max(120).optional()
});

function authorized(request: Request, expected: string) {
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  return providedBuffer.length === expectedBuffer.length && timingSafeEqual(providedBuffer, expectedBuffer);
}

export async function POST(request: Request) {
  const ingestSecret = process.env.ANALYTICS_INGEST_SECRET;
  if (!ingestSecret) {
    return NextResponse.json({ ok: false, message: "Conversion ingestion is not configured." }, { status: 503 });
  }

  const rateLimit = await consumeRateLimit({
    request,
    scope: "conversion_ingest",
    limit: 120,
    windowSeconds: 60
  });
  if (!rateLimit.available) {
    return NextResponse.json(
      { ok: false, message: "Conversion ingestion is temporarily unavailable." },
      { status: 503, headers: { "Retry-After": String(rateLimit.retryAfterSeconds), "Cache-Control": "no-store" } }
    );
  }
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { ok: false, message: "Too many requests." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds), "Cache-Control": "no-store" } }
    );
  }
  if (!authorized(request, ingestSecret)) {
    return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }

  const body = await readBoundedJson(request, 16 * 1024);
  if (!body.ok) {
    const status = body.error === "unsupported_media_type" ? 415 : body.error === "payload_too_large" ? 413 : 400;
    return NextResponse.json({ ok: false, message: "Invalid conversion payload." }, { status });
  }
  const parsed = conversionSchema.safeParse(body.value);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid conversion payload." }, { status: 400 });
  }

  try {
    const supabase = createSupabaseAdmin();
    const { data: lead, error: leadError } = await supabase
      .from("waitlist_applications")
      .select(
        "id,session_id,visitor_id,pageview_id,analytics_consent,posthog_distinct_id,first_touch,last_touch,utm_source,utm_medium,utm_campaign,utm_content,utm_term,referral_code,landing_path,referrer_domain,timezone,lead_status"
      )
      .eq("id", parsed.data.lead_id)
      .maybeSingle();

    if (leadError || !lead) {
      return NextResponse.json({ ok: false, message: "Lead not found." }, { status: 404 });
    }

    const { error } = await supabase.from("funnel_events").insert({
      event_name: parsed.data.event,
      event_client_at: parsed.data.occurred_at ?? new Date().toISOString(),
      session_id: lead.session_id,
      visitor_id: lead.visitor_id,
      pageview_id: lead.pageview_id,
      lead_id: lead.id,
      utm_source: lead.utm_source,
      utm_medium: lead.utm_medium,
      utm_campaign: lead.utm_campaign,
      utm_content: lead.utm_content,
      utm_term: lead.utm_term,
      referral_code: lead.referral_code,
      landing_path: lead.landing_path,
      referrer_domain: lead.referrer_domain,
      timezone: lead.timezone,
      first_touch: lead.first_touch,
      last_touch: lead.last_touch,
      conversion_type: parsed.data.event,
      value_cents: parsed.data.value_cents ?? null,
      currency: parsed.data.currency ?? null,
      external_id: parsed.data.external_id,
      metadata: {
        source: "server_ingest",
        provider: parsed.data.provider,
        product_id: parsed.data.product_id
      }
    });

    if (error?.code === "23505") return NextResponse.json({ ok: true, duplicate: true });
    if (error) {
      return NextResponse.json({ ok: false, message: "Conversion could not be stored." }, { status: 503 });
    }

    const nextStatus = parsed.data.event === "booking_completed"
      ? lead.lead_status === "won" ? "won" : "booked"
      : parsed.data.event === "payment_succeeded" || parsed.data.event === "conversion_recorded"
        ? "won"
        : null;
    if (nextStatus) {
      await supabase.from("waitlist_applications").update({ lead_status: nextStatus }).eq("id", lead.id);
    }

    if (lead.analytics_consent) {
      after(() => captureServerEvent({
        distinctId: lead.posthog_distinct_id || lead.id,
        event: parsed.data.event,
        properties: {
          lead_id: lead.id,
          external_id: parsed.data.external_id,
          provider: parsed.data.provider,
          value_cents: parsed.data.value_cents ?? null,
          currency: parsed.data.currency ?? null,
          source: "server"
        }
      }));
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: "Conversion could not be stored." }, { status: 503 });
  }
}
