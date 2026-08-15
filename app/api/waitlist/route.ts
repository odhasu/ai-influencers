import { captureServerEvent } from "@/lib/posthog/server";
import { isSameOriginBrowserRequest, readBoundedJson } from "@/lib/api-security";
import { getPublicFunnelSettings } from "@/lib/funnel-settings";
import { consumeRateLimit } from "@/lib/rate-limit";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { after, NextResponse } from "next/server";
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
  age_range: z.enum(["18 - 23", "24 - 35", "35+"]),
  instagram: z.string().trim().max(100).default(""),
  email: z.email().trim().max(254),
  full_name: z.string().trim().min(2).max(120),
  phone_number: z
    .string()
    .trim()
    .min(7)
    .max(40)
    .refine((value) => {
      const digits = value.replace(/\D/g, "");
      return digits.length >= 7 && digits.length <= 15;
    }),
  budget_range: z.enum([
    "Under $200 USD",
    "$200 - $500 USD",
    "$500 - $1K USD",
    "$1K - $3K USD",
    "$3K+ USD"
  ]),
  call_commitment: z.literal("Yes")
});

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

function normalizeInstagram(value: string) {
  const trimmed = value.trim();
  return trimmed && trimmed !== "not_provided" ? trimmed : "not_provided";
}

function json(
  body: Record<string, unknown>,
  init: { status?: number; headers?: Record<string, string> } = {}
) {
  return NextResponse.json(body, {
    status: init.status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      ...init.headers
    }
  });
}

export async function POST(request: Request) {
  if (!isSameOriginBrowserRequest(request)) {
    return json({ ok: false, message: "This request could not be verified." }, { status: 403 });
  }

  const rateLimit = await consumeRateLimit({
    request,
    scope: "waitlist_submit",
    limit: 8,
    windowSeconds: 10 * 60
  });
  if (!rateLimit.available) {
    return json(
      { ok: false, message: "Applications are temporarily unavailable. Please try again shortly." },
      { status: 503, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
    );
  }
  if (!rateLimit.allowed) {
    return json(
      { ok: false, message: "Too many attempts. Please wait before trying again." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
    );
  }

  const body = await readBoundedJson(request, 48 * 1024);
  if (!body.ok) {
    const status = body.error === "unsupported_media_type" ? 415 : body.error === "payload_too_large" ? 413 : 400;
    return json(
      { ok: false, message: "Please check the application details and try again." },
      { status }
    );
  }

  const result = requestSchema.safeParse(body.value);
  if (!result.success) {
    return json(
      { ok: false, message: "Please check the application details and try again." },
      { status: 400 }
    );
  }
  const parsed: z.infer<typeof requestSchema> = result.data;

  if (parsed.website) {
    return json({ ok: true, leadId: crypto.randomUUID() });
  }

  const { answers, metadata } = parsed;
  const { attribution } = metadata;
  const { first_touch: firstTouch, last_touch: lastTouch } = attribution;
  const instagram = normalizeInstagram(answers.instagram);
  const normalizedPhone = `+${answers.phone_number.replace(/\D/g, "")}`;
  const normalizedEmail = answers.email.toLowerCase();

  const emailRateLimit = await consumeRateLimit({
    request,
    scope: "waitlist_email",
    identifier: normalizedEmail,
    limit: 3,
    windowSeconds: 60 * 60
  });
  if (!emailRateLimit.available) {
    return json(
      { ok: false, message: "Applications are temporarily unavailable. Please try again shortly." },
      { status: 503, headers: { "Retry-After": String(emailRateLimit.retryAfterSeconds) } }
    );
  }
  if (!emailRateLimit.allowed) {
    return json(
      { ok: false, message: "This application was recently submitted. Please try again later." },
      { status: 429, headers: { "Retry-After": String(emailRateLimit.retryAfterSeconds) } }
    );
  }

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
    const { data: existingLead, error: existingLeadError } = await supabase
      .from("waitlist_applications")
      .select("id,first_touch")
      .eq("email", normalizedEmail)
      .maybeSingle();
    if (existingLeadError) throw existingLeadError;

    const preservedFirstTouch =
      existingLead?.first_touch && Object.keys(existingLead.first_touch as Record<string, unknown>).length
        ? existingLead.first_touch
        : firstTouch;

    const leadInput = {
        reselling_experience: answers.reselling_experience,
        long_term_goal: answers.long_term_goal,
        age_range: answers.age_range,
        instagram,
        email: normalizedEmail,
        full_name: answers.full_name,
        phone_number: normalizedPhone,
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

    let lead: { id: string } | null = existingLead ? { id: existingLead.id } : null;
    let isNewLead = false;

    if (!lead) {
      const { data: insertedLead, error: insertError } = await supabase
        .from("waitlist_applications")
        .insert(leadInput)
        .select("id")
        .single();

      if (insertError?.code === "23505") {
        const { data: concurrentLead, error: concurrentLeadError } = await supabase
          .from("waitlist_applications")
          .select("id")
          .eq("email", normalizedEmail)
          .maybeSingle();
        if (concurrentLeadError || !concurrentLead) throw concurrentLeadError ?? insertError;
        lead = concurrentLead;
      } else if (insertError || !insertedLead) {
        console.error("waitlist_insert_failed", {
          code: insertError?.code ?? "missing_data",
          message: insertError?.message ?? "No record returned"
        });
        return json(
          { ok: false, message: "The application could not be saved right now." },
          { status: 503 }
        );
      } else {
        lead = insertedLead;
        isNewLead = true;
      }
    }

    const leadId = lead.id;
    const requestUserAgent = safeHeader(request.headers, "user-agent", 500);

    after(async () => {
      const operationalTasks: Array<PromiseLike<unknown>> = [
        supabase.from("funnel_events").insert({
        event_name: "form_submit_succeeded",
        event_client_at: new Date().toISOString(),
        session_id: metadata.session_id,
        visitor_id: metadata.visitor_id || null,
        pageview_id: metadata.pageview_id || null,
        lead_id: leadId,
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
        device_type: /mobile|iphone|android/i.test(requestUserAgent)
          ? "mobile"
          : "desktop",
        metadata: {
          source: "server",
          session_number: metadata.session_number,
          submission_type: isNewLead ? "new" : "duplicate"
        }
      })
      ];

      if (metadata.analytics_consent) {
        operationalTasks.push(
          captureServerEvent({
            distinctId: metadata.posthog_distinct_id || leadId,
            event: "form_submit_succeeded",
            properties: {
              lead_id: leadId,
              total_steps: 7,
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
          })
        );
      }

      if (metadata.visitor_id) {
        operationalTasks.push(
          supabase.from("lead_visitor_links").upsert(
            {
              lead_id: leadId,
              visitor_id: metadata.visitor_id,
              last_linked_at: new Date().toISOString(),
              last_session_id: metadata.session_id
            },
            { onConflict: "lead_id,visitor_id" }
          )
        );
      }

      if (isNewLead && process.env.LEAD_WEBHOOK_URL) {
        const settings = await getPublicFunnelSettings();
        if (settings.webhookEnabled) {
          operationalTasks.push(
            sendLeadWebhook({
              event: "waitlist_application_created",
              lead_id: leadId,
              created_at: new Date().toISOString(),
              answers: { ...answers, instagram, phone_number: normalizedPhone },
              attribution: {
                first_touch: preservedFirstTouch,
                last_touch: lastTouch,
                click_ids: clickIds,
                ...resolvedAttribution
              }
            })
          );
        }
      }

      await Promise.allSettled(operationalTasks);
    });

    return json({ ok: true, leadId });
  } catch (error) {
    console.error("waitlist_request_failed", {
      message: error instanceof Error ? error.message : "Unknown server error"
    });
    return json(
      { ok: false, message: "The application could not be saved right now." },
      { status: 503 }
    );
  }
}
