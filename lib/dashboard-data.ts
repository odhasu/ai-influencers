import "server-only";

import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { getFunnelSettings, type FunnelSettings } from "@/lib/funnel-settings";

export type LeadStatus = "new" | "contacted" | "qualified" | "booked" | "won" | "lost";

export type DashboardLead = {
  id: string;
  created_at: string;
  updated_at: string;
  full_name: string;
  email: string;
  phone_number: string;
  instagram: string;
  reselling_experience: string;
  long_term_goal: string;
  age_range: string;
  budget_range: string;
  lead_status: LeadStatus;
  notes: string;
  follow_up_at: string | null;
  last_contacted_at: string | null;
  assigned_to: string | null;
  tags: string[];
  referral_code: string | null;
  referral_link_id: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  country: string | null;
  city: string | null;
  form_duration_ms: number;
  visitor_id: string | null;
  session_number: number;
  timezone: string | null;
  referrer_domain: string | null;
  gclid: string | null;
  fbclid: string | null;
  ttclid: string | null;
  msclkid: string | null;
  first_touch: Record<string, string>;
  last_touch: Record<string, string>;
};

export type DashboardEvent = {
  created_at: string;
  event_name: string;
  session_id: string;
  visitor_id: string | null;
  pageview_id: string | null;
  lead_id: string | null;
  step_number: number | null;
  step_key: string | null;
  percent: number | null;
  cta_location: string | null;
  video_id: string | null;
  elapsed_ms: number | null;
  utm_source: string | null;
  utm_campaign: string | null;
  referral_code: string | null;
  referral_link_id: string | null;
  device_type: string | null;
  browser: string | null;
  os: string | null;
  country: string | null;
  city: string | null;
  conversion_type: string | null;
  value_cents: number | null;
  currency: string | null;
  metadata: Record<string, unknown>;
};

export type ReferralLink = {
  id: string;
  created_at: string;
  updated_at: string;
  label: string;
  platform: string;
  placement: string;
  code: string;
  destination_path: string;
  notes: string;
  is_active: boolean;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  utm_term: string;
};

export type DashboardPayload = {
  leads: DashboardLead[];
  events: DashboardEvent[];
  referralLinks: ReferralLink[];
  settings: FunnelSettings;
  webhookConfigured: boolean;
  error: string | null;
};

export async function getDashboardPayload(): Promise<DashboardPayload> {
  const fallback: DashboardPayload = {
    leads: [],
    events: [],
    referralLinks: [],
    settings: await getFunnelSettings(),
    webhookConfigured: Boolean(process.env.LEAD_WEBHOOK_URL),
    error: null
  };

  try {
    const supabase = createSupabaseAdmin();
    const eventsSince = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString();
    const [leadsResult, eventsResult, referralLinksResult, settings] = await Promise.all([
      supabase
        .from("waitlist_applications")
        .select(
          "id,created_at,updated_at,full_name,email,phone_number,instagram,reselling_experience,long_term_goal,age_range,budget_range,lead_status,notes,follow_up_at,last_contacted_at,assigned_to,tags,referral_code,referral_link_id,utm_source,utm_medium,utm_campaign,country,city,form_duration_ms,visitor_id,session_number,timezone,referrer_domain,gclid,fbclid,ttclid,msclkid,first_touch,last_touch"
        )
        .order("created_at", { ascending: false })
        .limit(1000),
      supabase
        .from("funnel_events")
        .select(
          "created_at,event_name,session_id,visitor_id,pageview_id,lead_id,step_number,step_key,percent,cta_location,video_id,elapsed_ms,utm_source,utm_campaign,referral_code,referral_link_id,device_type,browser,os,country,city,conversion_type,value_cents,currency,metadata"
        )
        .gte("created_at", eventsSince)
        .order("created_at", { ascending: false })
        .limit(5000),
      supabase
        .from("referral_links")
        .select(
          "id,created_at,updated_at,label,platform,placement,code,destination_path,notes,is_active,utm_source,utm_medium,utm_campaign,utm_content,utm_term"
        )
        .order("created_at", { ascending: false })
        .limit(500),
      getFunnelSettings(supabase)
    ]);

    if (leadsResult.error) throw leadsResult.error;
    if (eventsResult.error && eventsResult.error.code !== "42P01") throw eventsResult.error;
    if (referralLinksResult.error && referralLinksResult.error.code !== "42P01") throw referralLinksResult.error;

    return {
      leads: (leadsResult.data ?? []) as DashboardLead[],
      events: (eventsResult.data ?? []) as DashboardEvent[],
      referralLinks: (referralLinksResult.data ?? []) as ReferralLink[],
      settings,
      webhookConfigured: Boolean(process.env.LEAD_WEBHOOK_URL),
      error: null
    };
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error.code === "42703" || error.code === "PGRST204")
    ) {
      try {
        const supabase = createSupabaseAdmin();
        const legacyResult = await supabase
          .from("waitlist_applications")
          .select(
            "id,created_at,updated_at,full_name,email,phone_number,instagram,reselling_experience,long_term_goal,age_range,budget_range,utm_source,utm_medium,utm_campaign,country,city,form_duration_ms"
          )
          .order("created_at", { ascending: false })
          .limit(1000);

        if (!legacyResult.error) {
          return {
            ...fallback,
            leads: (legacyResult.data ?? []).map((lead) => ({
              ...lead,
              lead_status: "new" as const,
              notes: "",
              follow_up_at: null,
              last_contacted_at: null,
              assigned_to: null,
              tags: [],
              referral_code: null,
              referral_link_id: null,
              visitor_id: null,
              session_number: 1,
              timezone: null,
              referrer_domain: null,
              gclid: null,
              fbclid: null,
              ttclid: null,
              msclkid: null,
              first_touch: {},
              last_touch: {}
            })) as DashboardLead[],
            error:
              "Existing leads are shown in read-only compatibility mode. Apply the dashboard migration to enable pipeline editing, analytics, and live funnel settings."
          };
        }
      } catch {
        // Fall through to the general migration message below.
      }
    }

    return {
      ...fallback,
      error:
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error.code === "42703" || error.code === "PGRST204")
          ? "The dashboard migration has not been applied yet."
          : error &&
              typeof error === "object" &&
              "code" in error &&
              (error.code === "42P01" || error.code === "PGRST205")
            ? "Supabase is connected, but its database tables have not been created yet. Apply the included migrations to activate lead storage, analytics, and funnel settings."
          : "The dashboard could not load data from Supabase."
    };
  }
}
