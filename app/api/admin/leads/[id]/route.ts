import { isAdminAuthenticated } from "@/lib/admin-auth";
import { isSameOriginBrowserRequest, readBoundedJson } from "@/lib/api-security";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { z } from "zod";

const leadUpdateSchema = z
  .object({
    leadStatus: z.enum(["new", "contacted", "qualified", "booked", "won", "lost"]).optional(),
    notes: z.string().trim().max(3000).optional(),
    followUpAt: z.string().datetime().nullable().optional(),
    assignedTo: z.string().trim().max(120).nullable().optional(),
    tags: z.array(z.string().trim().min(1).max(40)).max(10).optional()
  })
  .strict();

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSameOriginBrowserRequest(request)) {
    return NextResponse.json({ ok: false, message: "Forbidden." }, { status: 403 });
  }
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }

  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ ok: false, message: "Invalid lead ID." }, { status: 400 });
  }

  const body = await readBoundedJson(request, 8 * 1024);
  if (!body.ok) {
    const status = body.error === "unsupported_media_type" ? 415 : body.error === "payload_too_large" ? 413 : 400;
    return NextResponse.json({ ok: false, message: "Invalid lead update payload." }, { status });
  }
  const parsed = leadUpdateSchema.safeParse(body.value);
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ ok: false, message: "No valid changes were provided." }, { status: 400 });
  }

  try {
    const supabase = createSupabaseAdmin();
    const { data: current, error: currentError } = await supabase
      .from("waitlist_applications")
      .select("lead_status,notes,follow_up_at,assigned_to,tags")
      .eq("id", id)
      .single();

    if (currentError || !current) {
      return NextResponse.json({ ok: false, message: "Lead not found." }, { status: 404 });
    }

    const changes = parsed.data;
    const update: Record<string, unknown> = {};
    const activities: Array<{ lead_id: string; activity_type: string; summary: string }> = [];

    if (changes.leadStatus && changes.leadStatus !== current.lead_status) {
      update.lead_status = changes.leadStatus;
      if (changes.leadStatus === "contacted") update.last_contacted_at = new Date().toISOString();
      activities.push({
        lead_id: id,
        activity_type: "status_changed",
        summary: `Status changed from ${current.lead_status} to ${changes.leadStatus}`
      });
    }
    if (changes.notes !== undefined && changes.notes !== current.notes) {
      update.notes = changes.notes;
      activities.push({ lead_id: id, activity_type: "note_updated", summary: "Notes updated" });
    }
    if (changes.followUpAt !== undefined && changes.followUpAt !== current.follow_up_at) {
      update.follow_up_at = changes.followUpAt;
      activities.push({
        lead_id: id,
        activity_type: "follow_up_scheduled",
        summary: changes.followUpAt ? "Follow-up scheduled" : "Follow-up cleared"
      });
    }
    if (changes.assignedTo !== undefined && changes.assignedTo !== current.assigned_to) {
      update.assigned_to = changes.assignedTo || null;
    }
    if (changes.tags !== undefined && JSON.stringify(changes.tags) !== JSON.stringify(current.tags)) {
      update.tags = changes.tags;
      activities.push({ lead_id: id, activity_type: "tag_updated", summary: "Tags updated" });
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ ok: true, lead: { id, ...current } });
    }

    const { data, error } = await supabase
      .from("waitlist_applications")
      .update(update)
      .eq("id", id)
      .select(
        "id,created_at,updated_at,full_name,email,phone_number,instagram,reselling_experience,long_term_goal,age_range,budget_range,lead_status,notes,follow_up_at,last_contacted_at,assigned_to,tags,referral_code,referral_link_id,utm_source,utm_medium,utm_campaign,country,city,form_duration_ms"
      )
      .single();

    if (error || !data) throw error ?? new Error("Lead update returned no data.");
    if (activities.length) await supabase.from("lead_activities").insert(activities);
    return NextResponse.json({ ok: true, lead: data });
  } catch {
    return NextResponse.json({ ok: false, message: "The lead could not be updated." }, { status: 503 });
  }
}
