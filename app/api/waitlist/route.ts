import { captureServerEvent } from "@/lib/posthog/server";
import { getFunnelSettings } from "@/lib/funnel-settings";
import { clientIp, hashIdentifier, rateLimit, RateLimitExceededError } from "@/lib/rate-limit";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const answersSchema = z.object({
  start_timeline: z.enum(["ASAP - ready now", "Within 1-4 weeks", "Just researching for now"]),
  long_term_goal: z.enum([
    "Side hustle money - $1K-$2K/month",
    "Part time money - $4K-$10K/month",
    "Full time money - $15K+/month"
  ]),
  full_name: z.string().trim().min(2).max(120),
  phone_number: z
    .string()
    .trim()
    .min(7)
    .max(40)
    .refine((value) => value.replace(/\D/g, "").length >= 7),
  biggest_struggle: z.enum(["Lack of Direction", "Procrastination", "Skepticism"]),
  budget_range: z.enum([
    "Under $200 USD",
    "$200 - $500 USD",
    "$500 - $1K USD",
    "$1K - $3K USD",
    "$3K+ USD"
  ])
});

function qualificationForBudget(budget: string) {
  return budget === "Under $200 USD" ? "unqualified" : "qualified";
}

const attributionTouchSchema = z.object({
  captured_at: z.union([z.literal(""), z.iso.datetime()]),
  landing_path: z.string().max(300),
  referrer_domain: z.string().max(160),
  referrer_path: z.string().max(300),
  referral_code: z.string().trim().toLowerCase().max(80).default(""),
  utm_source: z.string().max(160).default(""),
  utm_medium: z.string().max(160).default(""),
  utm_campaign: z.string().max(160).default(""),
  utm_content: z.string().max(160).default(""),
  utm_term: z.string().max(160).default(""),
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

const attributionSchema = z.object({
  first_touch: attributionTouchSchema,
  last_touch: attributionTouchSchema
});

const requestSchema = z.object({
  answers: answersSchema,
  website: z.string().max(200).default(""),
  metadata: z.object({
    session_id: z.uuid(),
    visitor_id: z.union([z.literal(""), z.uuid()]),
    pageview_id: z.union([z.literal(""), z.uuid()]),
    session_number: z.number().int().min(1).max(10000),
    timezone: z.string().max(80),
    posthog_distinct_id: z.string().max(200).default(""),
    form_duration_ms: z.number().int().min(0).max(1000 * 60 * 60 * 8),
    analytics_consent: z.boolean(),
    attribution: attributionSchema
  })
});

function safeHeader(headers: Headers, name: string, maxLength = 300) {
  return (headers.get(name) ?? "").slice(0, maxLength);
}

function decodedHeader(headers: Headers, name: string, maxLength = 160) {
  const value = safeHeader(headers, name, maxLength);
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

async function sendLeadWebhook(payload: Record<string, unknown>) {
  const webhookUrl = process.env.LEAD_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Funnel-Event": "waitlist_application_created"
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000)
    });
  } catch {
    // Lead storage succeeds independently of optional notifications.
  }
}

function rateLimitedResponse(error: RateLimitExceededError) {
  return NextResponse.json(
    { ok: false, message: "Too many applications. Please wait a few minutes and try again." },
    { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } }
  );
}

export async function POST(request: Request) {
  try {
    rateLimit("waitlist:ip", hashIdentifier(clientIp(request)), {
      limit: 10,
      windowMs: 10 * 60 * 1000
    });
  } catch (error) {
    if (error instanceof RateLimitExceededError) return rateLimitedResponse(error);
    throw error;
  }

  let parsed: z.infer<typeof requestSchema>;

  try {
    parsed = requestSchema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { ok: false, message: "Please check the application details and try again." },
      { status: 400 }
    );
  }

  if (parsed.website) {
    return NextResponse.json({
      ok: true,
      leadId: crypto.randomUUID(),
      qualification: qualificationForBudget(parsed.answers.budget_range)
    });
  }

  try {
    rateLimit("waitlist:phone", hashIdentifier(parsed.answers.phone_number), {
      limit: 5,
      windowMs: 24 * 60 * 60 * 1000
    });
  } catch (error) {
    if (error instanceof RateLimitExceededError) return rateLimitedResponse(error);
    throw error;
  }

  const { answers, metadata } = parsed;
  const { attribution } = metadata;
  const { first_touch: firstTouch, last_touch: lastTouch } = attribution;

  try {
    const supabase = createSupabaseAdmin();
    const referralCode = lastTouch.referral_code
      ? lastTouch.referral_code.replace(/[^a-z0-9-]/g, "").slice(0, 80)
      : "";
    const { data: referralLink } = referralCode
      ? await supabase
          .from("referral_links")
          .select("id,code,utm_source,utm_medium,utm_campaign,utm_content,utm_term,is_active")
          .eq("code", referralCode)
          .maybeSingle()
      : { data: null };
    const activeReferralLink = referralLink?.is_active ? referralLink : null;
    const resolvedAttribution = {
      referral_code: referralCode || null,
      referral_link_id: activeReferralLink?.id ?? null,
      utm_source: lastTouch.utm_source || activeReferralLink?.utm_source || null,
      utm_medium: lastTouch.utm_medium || activeReferralLink?.utm_medium || null,
      utm_campaign: lastTouch.utm_campaign || activeReferralLink?.utm_campaign || null,
      utm_content: lastTouch.utm_content || activeReferralLink?.utm_content || null,
      utm_term: lastTouch.utm_term || activeReferralLink?.utm_term || null
    };
    const clickIds = Object.fromEntries(
      ["gclid", "gbraid", "wbraid", "fbclid", "ttclid", "msclkid", "twclid", "li_fat_id", "sccid", "dclid"]
        .map((key) => [key, lastTouch[key as keyof typeof lastTouch]])
        .filter(([, value]) => value)
    );
    const { data: existingLead, error: lookupError } = await supabase
      .from("waitlist_applications")
      .select("id,first_touch")
      .eq("phone_number", answers.phone_number)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lookupError) throw lookupError;
    const preservedFirstTouch =
      existingLead?.first_touch && Object.keys(existingLead.first_touch as Record<string, unknown>).length
        ? existingLead.first_touch
        : firstTouch;

    const leadPayload = {
      start_timeline: answers.start_timeline,
      long_term_goal: answers.long_term_goal,
      full_name: answers.full_name,
      phone_number: answers.phone_number,
      biggest_struggle: answers.biggest_struggle,
      budget_range: answers.budget_range,
      session_id: metadata.session_id,
      visitor_id: metadata.visitor_id || null,
      pageview_id: metadata.pageview_id || null,
      session_number: metadata.session_number,
      timezone: metadata.timezone || null,
      posthog_distinct_id: metadata.posthog_distinct_id || null,
      form_duration_ms: metadata.form_duration_ms,
      analytics_consent: metadata.analytics_consent,
      referral_code: resolvedAttribution.referral_code,
      referral_link_id: resolvedAttribution.referral_link_id,
      utm_source: resolvedAttribution.utm_source,
      utm_medium: resolvedAttribution.utm_medium,
      utm_campaign: resolvedAttribution.utm_campaign,
      utm_content: resolvedAttribution.utm_content,
      utm_term: resolvedAttribution.utm_term,
      first_touch: preservedFirstTouch,
      last_touch: lastTouch,
      click_ids: clickIds,
      referrer: [lastTouch.referrer_domain, lastTouch.referrer_path].filter(Boolean).join("") || null,
      referrer_domain: lastTouch.referrer_domain || null,
      landing_path: lastTouch.landing_path || null,
      gclid: lastTouch.gclid || null,
      fbclid: lastTouch.fbclid || null,
      ttclid: lastTouch.ttclid || null,
      msclkid: lastTouch.msclkid || null,
      user_agent: safeHeader(request.headers, "user-agent", 500) || null,
      country: safeHeader(request.headers, "x-vercel-ip-country", 8) || null,
      region: decodedHeader(request.headers, "x-vercel-ip-country-region", 80) || null,
      city: decodedHeader(request.headers, "x-vercel-ip-city", 160) || null
    };
    const leadResult = existingLead
      ? await supabase
          .from("waitlist_applications")
          .update(leadPayload)
          .eq("id", existingLead.id)
          .select("id")
          .single()
      : await supabase.from("waitlist_applications").insert(leadPayload).select("id").single();
    const { data, error } = leadResult;

    if (error || !data) {
      console.error("waitlist_insert_failed", {
        code: error?.code ?? "missing_data",
        message: error?.message ?? "No record returned"
      });
      return NextResponse.json(
        { ok: false, message: "The application could not be saved right now." },
        { status: 503 }
      );
    }

    if (metadata.analytics_consent) {
      await captureServerEvent({
        distinctId: metadata.posthog_distinct_id || data.id,
        event: "form_submit_succeeded",
        properties: {
          lead_id: data.id,
          total_steps: 6,
          elapsed_ms: metadata.form_duration_ms,
          utm_source: resolvedAttribution.utm_source,
          utm_medium: resolvedAttribution.utm_medium,
          utm_campaign: resolvedAttribution.utm_campaign,
          referral_code: resolvedAttribution.referral_code,
          visitor_id: metadata.visitor_id || null,
          session_number: metadata.session_number,
          first_touch_utm_source: firstTouch.utm_source || null,
          last_touch_utm_source: resolvedAttribution.utm_source,
          source: "server"
        }
      });
    }

    const settings = await getFunnelSettings(supabase);
    const operationalTasks: Array<PromiseLike<unknown>> = [
      supabase.from("funnel_events").insert({
        event_name: "form_submit_succeeded",
        event_client_at: new Date().toISOString(),
        session_id: metadata.session_id,
        visitor_id: metadata.visitor_id || null,
        pageview_id: metadata.pageview_id || null,
        lead_id: data.id,
        elapsed_ms: metadata.form_duration_ms,
        utm_source: resolvedAttribution.utm_source,
        utm_medium: resolvedAttribution.utm_medium,
        utm_campaign: resolvedAttribution.utm_campaign,
        referral_code: resolvedAttribution.referral_code,
        referral_link_id: resolvedAttribution.referral_link_id,
        utm_content: resolvedAttribution.utm_content,
        utm_term: resolvedAttribution.utm_term,
        landing_path: lastTouch.landing_path || null,
        referrer_domain: lastTouch.referrer_domain || null,
        timezone: metadata.timezone || null,
        first_touch: preservedFirstTouch,
        last_touch: lastTouch,
        click_ids: clickIds,
        device_type: /mobile|iphone|android/i.test(safeHeader(request.headers, "user-agent", 500))
          ? "mobile"
          : "desktop",
        metadata: { source: "server", session_number: metadata.session_number }
      })
    ];

    if (metadata.visitor_id) {
      operationalTasks.push(
        supabase.from("lead_visitor_links").upsert(
          {
            lead_id: data.id,
            visitor_id: metadata.visitor_id,
            last_linked_at: new Date().toISOString(),
            last_session_id: metadata.session_id
          },
          { onConflict: "lead_id,visitor_id" }
        )
      );
    }

    if (settings.webhookEnabled && process.env.LEAD_WEBHOOK_URL) {
      operationalTasks.push(
        sendLeadWebhook({
          event: "waitlist_application_created",
          lead_id: data.id,
          created_at: new Date().toISOString(),
          answers,
          attribution: {
            first_touch: preservedFirstTouch,
            last_touch: lastTouch,
            click_ids: clickIds,
            ...resolvedAttribution
          }
        })
      );
    }

    await Promise.allSettled(operationalTasks);

    return NextResponse.json({
      ok: true,
      leadId: data.id,
      qualification: qualificationForBudget(answers.budget_range)
    });
  } catch (error) {
    console.error("waitlist_request_failed", {
      message: error instanceof Error ? error.message : "Unknown server error"
    });
    return NextResponse.json(
      { ok: false, message: "The application could not be saved right now." },
      { status: 503 }
    );
  }
}
