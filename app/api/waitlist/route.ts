import { captureServerEvent } from "@/lib/posthog/server";
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
  instagram: z.string().trim().min(2).max(100),
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
  ])
});

const attributionSchema = z.object({
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

  try {
    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase
      .from("waitlist_applications")
      .upsert({
        reselling_experience: answers.reselling_experience,
        long_term_goal: answers.long_term_goal,
        age_range: answers.age_range,
        instagram: answers.instagram,
        email: answers.email.toLowerCase(),
        full_name: answers.full_name,
        phone_number: answers.phone_number,
        budget_range: answers.budget_range,
        session_id: metadata.session_id,
        posthog_distinct_id: metadata.posthog_distinct_id || null,
        form_duration_ms: metadata.form_duration_ms,
        analytics_consent: metadata.analytics_consent,
        utm_source: attribution.utm_source || null,
        utm_medium: attribution.utm_medium || null,
        utm_campaign: attribution.utm_campaign || null,
        utm_content: attribution.utm_content || null,
        utm_term: attribution.utm_term || null,
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
          utm_source: attribution.utm_source || null,
          utm_medium: attribution.utm_medium || null,
          utm_campaign: attribution.utm_campaign || null,
          source: "server"
        }
      });
    }

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
