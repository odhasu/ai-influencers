import { captureServerEvent } from "@/lib/posthog/server";
import { getFunnelSettings } from "@/lib/funnel-settings";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const answersSchema = z.object({
  reselling_experience: z.enum([
    "I'm just starting",
    "Less than 6 months",
    "6 months - 1 year",
    "1 - 2 years",
    "2+ years"
  ]),
  long_term_goal: z.enum([
    "Full time income",
    "Side hustle / extra income",
    "Build a brand on social media",
    "Bulk supplying to stores"
  ]),
  age_range: z.enum(["13 - 17", "18 - 23", "24 - 35", "35+"]),
  instagram: z.string().trim().max(100).default(""),
  email: z.email().trim().max(254),
  full_name: z.string().trim().min(2).max(120),
  phone_number: z
    .string()
    .trim()
    .min(7)
    .max(40)
    .refine((value) => value.replace(/\D/g, "").length >= 7),
  budget_range: z.enum([
    "Under $200 USD",
    "$200 - $500 USD",
    "$500 - $1K USD",
    "$1K - $3K USD",
    "$3K+ USD"
  ]),
  call_commitment: z.literal("Yes")
});

const attributionSchema = z.object({
  referral_code: z.string().trim().toLowerCase().max(80).default(""),
  utm_source: z.string().max(160).default(""),
  utm_medium: z.string().max(160).default(""),
  utm_campaign: z.string().max(160).default(""),
  utm_content: z.string().max(160).default(""),
  utm_term: z.string().max(160).default(""),
  referrer: z.string().max(300).default(""),
  landing_path: z.string().max(300).default("")
});

const requestSchema = z.object({
  answers: answersSchema,
  website: z.string().max(200).default(""),
  metadata: z.object({
    session_id: z.uuid(),
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

function normalizeInstagram(value: string) {
  const trimmed = value.trim();
  return trimmed && trimmed !== "not_provided" ? trimmed : "not_provided";
}

export async function POST(request: Request) {
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
    return NextResponse.json({ ok: true, leadId: crypto.randomUUID() });
  }

  const { answers, metadata } = parsed;
  const { attribution } = metadata;
  const instagram = normalizeInstagram(answers.instagram);

  try {
    const supabase = createSupabaseAdmin();
    const referralCode = attribution.referral_code
      ? attribution.referral_code.replace(/[^a-z0-9-]/g, "").slice(0, 80)
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
      utm_source: attribution.utm_source || activeReferralLink?.utm_source || null,
      utm_medium: attribution.utm_medium || activeReferralLink?.utm_medium || null,
      utm_campaign: attribution.utm_campaign || activeReferralLink?.utm_campaign || null,
      utm_content: attribution.utm_content || activeReferralLink?.utm_content || null,
      utm_term: attribution.utm_term || activeReferralLink?.utm_term || null
    };

    const { data, error } = await supabase
      .from("waitlist_applications")
      .upsert({
        reselling_experience: answers.reselling_experience,
        long_term_goal: answers.long_term_goal,
        age_range: answers.age_range,
        instagram,
        email: answers.email.toLowerCase(),
        full_name: answers.full_name,
        phone_number: answers.phone_number,
        budget_range: answers.budget_range,
        session_id: metadata.session_id,
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
        referrer: attribution.referrer || null,
        landing_path: attribution.landing_path || null,
        user_agent: safeHeader(request.headers, "user-agent", 500) || null,
        country: safeHeader(request.headers, "x-vercel-ip-country", 8) || null,
        region: decodedHeader(request.headers, "x-vercel-ip-country-region", 80) || null,
        city: decodedHeader(request.headers, "x-vercel-ip-city", 160) || null
      }, { onConflict: "email" })
      .select("id")
      .single();

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
          total_steps: 7,
          elapsed_ms: metadata.form_duration_ms,
          utm_source: resolvedAttribution.utm_source,
          utm_medium: resolvedAttribution.utm_medium,
          utm_campaign: resolvedAttribution.utm_campaign,
          referral_code: resolvedAttribution.referral_code,
          source: "server"
        }
      });
    }

    const settings = await getFunnelSettings(supabase);
    const operationalTasks: Array<PromiseLike<unknown>> = [
      supabase.from("funnel_events").insert({
        event_name: "form_submit_succeeded",
        session_id: metadata.session_id,
        lead_id: data.id,
        elapsed_ms: metadata.form_duration_ms,
        utm_source: resolvedAttribution.utm_source,
        utm_medium: resolvedAttribution.utm_medium,
        utm_campaign: resolvedAttribution.utm_campaign,
        referral_code: resolvedAttribution.referral_code,
        referral_link_id: resolvedAttribution.referral_link_id,
        landing_path: attribution.landing_path || null,
        device_type: /mobile|iphone|android/i.test(safeHeader(request.headers, "user-agent", 500))
          ? "mobile"
          : "desktop",
        metadata: { source: "server" }
      })
    ];

    if (settings.webhookEnabled && process.env.LEAD_WEBHOOK_URL) {
      operationalTasks.push(
        sendLeadWebhook({
          event: "waitlist_application_created",
          lead_id: data.id,
          created_at: new Date().toISOString(),
          answers: { ...answers, instagram },
          attribution: {
            ...attribution,
            ...resolvedAttribution
          }
        })
      );
    }

    await Promise.allSettled(operationalTasks);

    return NextResponse.json({ ok: true, leadId: data.id });
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
