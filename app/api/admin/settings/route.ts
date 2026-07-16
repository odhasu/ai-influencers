import { isAdminAuthenticated } from "@/lib/admin-auth";
import {
  serializeFunnelSettings,
  type FunnelSettings
} from "@/lib/funnel-settings";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { z } from "zod";

const emptyOrUrl = z.union([z.literal(""), z.url()]);
const emptyOrEmail = z.union([z.literal(""), z.email()]);
const publicId = z.string().trim().max(120).regex(/^[A-Za-z0-9._-]*$/);

const settingsSchema = z.object({
  campaignName: z.string().trim().min(2).max(120),
  heroHeadline: z.string().trim().min(4).max(180),
  heroBody: z.string().trim().min(10).max(500),
  waitlistHeading: z.string().trim().min(2).max(120),
  ctaLabel: z.string().trim().min(2).max(80),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  formEnabled: z.boolean(),
  autoAdvanceDelayMs: z.number().int().min(0).max(2000),
  showWins: z.boolean(),
  thankYouVideoUrl: z.url(),
  bookingUrl: emptyOrUrl,
  bookingCtaLabel: z.string().trim().min(2).max(80),
  webhookEnabled: z.boolean(),
  notificationEmail: emptyOrEmail,
  metaPixelId: publicId,
  tiktokPixelId: publicId,
  googleTagId: publicId
});

export async function PUT(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }

  const parsed = settingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: "Check the highlighted settings and try again." },
      { status: 400 }
    );
  }

  try {
    const settings = parsed.data as FunnelSettings;
    const supabase = createSupabaseAdmin();
    const { error } = await supabase
      .from("funnel_settings")
      .upsert(serializeFunnelSettings(settings), { onConflict: "id" });

    if (error) throw error;
    return NextResponse.json({ ok: true, settings });
  } catch {
    return NextResponse.json({ ok: false, message: "Settings could not be saved." }, { status: 503 });
  }
}
