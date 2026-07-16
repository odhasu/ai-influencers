import { isAdminAuthenticated } from "@/lib/admin-auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

function csvCell(value: unknown) {
  const text = Array.isArray(value) ? value.join(" | ") : String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase
      .from("waitlist_applications")
      .select(
        "created_at,full_name,email,phone_number,instagram,lead_status,budget_range,reselling_experience,long_term_goal,age_range,referral_code,utm_source,utm_medium,utm_campaign,country,city,assigned_to,tags,follow_up_at,notes"
      )
      .order("created_at", { ascending: false })
      .limit(10000);

    if (error) throw error;
    const headers = [
      "created_at",
      "full_name",
      "email",
      "phone_number",
      "instagram",
      "lead_status",
      "budget_range",
      "reselling_experience",
      "long_term_goal",
      "age_range",
      "referral_code",
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "country",
      "city",
      "assigned_to",
      "tags",
      "follow_up_at",
      "notes"
    ] as const;
    const rows = (data ?? []).map((lead) => headers.map((header) => csvCell(lead[header])).join(","));
    const csv = [headers.join(","), ...rows].join("\n");

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="waitlist-leads-${new Date().toISOString().slice(0, 10)}.csv"`,
        "Cache-Control": "no-store"
      }
    });
  } catch {
    return NextResponse.json({ ok: false, message: "Export could not be generated." }, { status: 503 });
  }
}
