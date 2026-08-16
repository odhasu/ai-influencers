import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export type FunnelSettings = {
  campaignName: string;
  heroHeadline: string;
  heroBody: string;
  waitlistHeading: string;
  ctaLabel: string;
  accentColor: string;
  formEnabled: boolean;
  autoAdvanceDelayMs: number;
  showWins: boolean;
  thankYouVideoUrl: string;
  bookingUrl: string;
  bookingCtaLabel: string;
  webhookEnabled: boolean;
  notificationEmail: string;
  metaPixelId: string;
  tiktokPixelId: string;
  googleTagId: string;
};

export const defaultFunnelSettings: FunnelSettings = {
  campaignName: "Inner Circle Waitlist",
  heroHeadline:
    "See How Regular People Are Building $5K-$30K/Month High-Ticket Reselling Businesses",
  heroBody: "",
  waitlistHeading: "Apply Now",
  ctaLabel: "Get Started Now",
  accentColor: "#39FF14",
  formEnabled: true,
  autoAdvanceDelayMs: 240,
  showWins: true,
  thankYouVideoUrl:
    "https://stream.clyro.io/v/8V01yqULxPLLwB0100E2lRPpd00CFZVm00V4X02l02QjMnvxrc.m3u8",
  bookingUrl: "",
  bookingCtaLabel: "Book Your Call",
  webhookEnabled: false,
  notificationEmail: "",
  metaPixelId: "",
  tiktokPixelId: "",
  googleTagId: ""
};

type FunnelSettingsRow = {
  campaign_name: string;
  hero_headline: string;
  hero_body: string;
  waitlist_heading: string;
  cta_label: string;
  accent_color: string;
  form_enabled: boolean;
  auto_advance_delay_ms: number;
  show_wins: boolean;
  thank_you_video_url: string;
  booking_url: string;
  booking_cta_label: string;
  webhook_enabled: boolean;
  notification_email: string;
  meta_pixel_id: string;
  tiktok_pixel_id: string;
  google_tag_id: string;
};

export function serializeFunnelSettings(settings: FunnelSettings) {
  return {
    id: "default",
    campaign_name: settings.campaignName,
    hero_headline: settings.heroHeadline,
    hero_body: settings.heroBody,
    waitlist_heading: settings.waitlistHeading,
    cta_label: settings.ctaLabel,
    accent_color: settings.accentColor,
    form_enabled: settings.formEnabled,
    auto_advance_delay_ms: settings.autoAdvanceDelayMs,
    show_wins: settings.showWins,
    thank_you_video_url: settings.thankYouVideoUrl,
    booking_url: settings.bookingUrl,
    booking_cta_label: settings.bookingCtaLabel,
    webhook_enabled: settings.webhookEnabled,
    notification_email: settings.notificationEmail,
    meta_pixel_id: settings.metaPixelId,
    tiktok_pixel_id: settings.tiktokPixelId,
    google_tag_id: settings.googleTagId
  };
}

function mapFunnelSettings(row: FunnelSettingsRow): FunnelSettings {
  return {
    campaignName: row.campaign_name,
    heroHeadline: row.hero_headline,
    heroBody: row.hero_body,
    waitlistHeading: row.waitlist_heading,
    ctaLabel: row.cta_label,
    accentColor: row.accent_color,
    formEnabled: row.form_enabled,
    autoAdvanceDelayMs: row.auto_advance_delay_ms,
    showWins: row.show_wins,
    thankYouVideoUrl: row.thank_you_video_url,
    bookingUrl: row.booking_url,
    bookingCtaLabel: row.booking_cta_label,
    webhookEnabled: row.webhook_enabled,
    notificationEmail: row.notification_email,
    metaPixelId: row.meta_pixel_id,
    tiktokPixelId: row.tiktok_pixel_id,
    googleTagId: row.google_tag_id
  };
}

export async function getFunnelSettings(client?: SupabaseClient): Promise<FunnelSettings> {
  try {
    const supabase = client ?? createSupabaseAdmin();
    const { data, error } = await supabase
      .from("funnel_settings")
      .select(
        "campaign_name,hero_headline,hero_body,waitlist_heading,cta_label,accent_color,form_enabled,auto_advance_delay_ms,show_wins,thank_you_video_url,booking_url,booking_cta_label,webhook_enabled,notification_email,meta_pixel_id,tiktok_pixel_id,google_tag_id"
      )
      .eq("id", "default")
      .maybeSingle<FunnelSettingsRow>();

    if (error || !data) return defaultFunnelSettings;
    return mapFunnelSettings(data);
  } catch {
    return defaultFunnelSettings;
  }
}
