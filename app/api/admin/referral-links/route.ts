import { isAdminAuthenticated } from "@/lib/admin-auth";
import { isSameOriginBrowserRequest, readBoundedJson } from "@/lib/api-security";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { z } from "zod";

const referralLinkSchema = z
  .object({
    id: z.uuid().optional(),
    label: z.string().trim().min(2).max(120),
    platform: z.string().trim().min(2).max(80),
    placement: z.string().trim().min(2).max(120),
    code: z
      .string()
      .trim()
      .toLowerCase()
      .min(2)
      .max(80)
      .regex(/^[a-z0-9][a-z0-9-]*$/),
    destinationPath: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .regex(/^\/(?!\/)[^\u0000-\u001f\u007f?#]*$/),
    notes: z.string().trim().max(1000),
    isActive: z.boolean(),
    utmSource: z.string().trim().max(160),
    utmMedium: z.string().trim().max(160),
    utmCampaign: z.string().trim().max(160),
    utmContent: z.string().trim().max(160),
    utmTerm: z.string().trim().max(160)
  })
  .strict();

const deleteSchema = z.object({ id: z.uuid() }).strict();

function toDatabase(input: z.infer<typeof referralLinkSchema>) {
  return {
    label: input.label,
    platform: input.platform,
    placement: input.placement,
    code: input.code,
    destination_path: input.destinationPath,
    notes: input.notes,
    is_active: input.isActive,
    utm_source: input.utmSource,
    utm_medium: input.utmMedium,
    utm_campaign: input.utmCampaign,
    utm_content: input.utmContent,
    utm_term: input.utmTerm
  };
}

export async function POST(request: Request) {
  if (!isSameOriginBrowserRequest(request)) {
    return NextResponse.json({ ok: false, message: "Forbidden." }, { status: 403 });
  }
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }

  const body = await readBoundedJson(request, 12 * 1024);
  if (!body.ok) {
    const status = body.error === "unsupported_media_type" ? 415 : body.error === "payload_too_large" ? 413 : 400;
    return NextResponse.json({ ok: false, message: "Invalid referral link payload." }, { status });
  }
  const parsed = referralLinkSchema.safeParse(body.value);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Check the referral link fields." }, { status: 400 });
  }

  try {
    const supabase = createSupabaseAdmin();
    const mutation = parsed.data.id
      ? supabase.from("referral_links").update(toDatabase(parsed.data)).eq("id", parsed.data.id)
      : supabase.from("referral_links").insert(toDatabase(parsed.data));

    const { data, error } = await mutation
      .select(
        "id,created_at,updated_at,label,platform,placement,code,destination_path,notes,is_active,utm_source,utm_medium,utm_campaign,utm_content,utm_term"
      )
      .single();

    if (error || !data) {
      if (error?.code === "23505") {
        return NextResponse.json({ ok: false, message: "That referral code already exists." }, { status: 409 });
      }
      throw error ?? new Error("Referral link mutation returned no data.");
    }

    return NextResponse.json({ ok: true, referralLink: data });
  } catch {
    return NextResponse.json({ ok: false, message: "The referral link could not be saved." }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  if (!isSameOriginBrowserRequest(request)) {
    return NextResponse.json({ ok: false, message: "Forbidden." }, { status: 403 });
  }
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }

  const body = await readBoundedJson(request, 2 * 1024);
  if (!body.ok) {
    const status = body.error === "unsupported_media_type" ? 415 : body.error === "payload_too_large" ? 413 : 400;
    return NextResponse.json({ ok: false, message: "Invalid referral link ID." }, { status });
  }
  const parsed = deleteSchema.safeParse(body.value);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid referral link ID." }, { status: 400 });
  }

  try {
    const supabase = createSupabaseAdmin();
    const { error } = await supabase.from("referral_links").delete().eq("id", parsed.data.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: "The referral link could not be deleted." }, { status: 503 });
  }
}
