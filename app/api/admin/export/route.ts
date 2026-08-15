import { isAdminAuthenticated } from "@/lib/admin-auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

const EXPORT_PAGE_SIZE = 1_000;
const MAX_EXPORT_ROWS = 25_000;
const CSV_HEADERS = [
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
const SELECT_COLUMNS =
  "id,created_at,full_name,email,phone_number,instagram,lead_status,budget_range,reselling_experience,long_term_goal,age_range,referral_code,utm_source,utm_medium,utm_campaign,country,city,assigned_to,tags,follow_up_at,notes";
const PRIVATE_NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0"
};

function csvCell(value: unknown) {
  const text = Array.isArray(value) ? value.join(" | ") : String(value ?? "");
  const spreadsheetSafeText = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${spreadsheetSafeText.replaceAll('"', '""')}"`;
}

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json(
      { ok: false, message: "Unauthorized." },
      { status: 401, headers: PRIVATE_NO_STORE_HEADERS }
    );
  }

  try {
    const supabase = createSupabaseAdmin();
    const exportCutoff = new Date().toISOString();
    const leads: Record<string, unknown>[] = [];

    while (leads.length < MAX_EXPORT_ROWS) {
      const pageSize = Math.min(EXPORT_PAGE_SIZE, MAX_EXPORT_ROWS - leads.length);
      const pageStart = leads.length;
      const { data, error } = await supabase
        .from("waitlist_applications")
        .select(SELECT_COLUMNS)
        .lte("created_at", exportCutoff)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(pageStart, pageStart + pageSize - 1);

      if (error) throw error;
      leads.push(...(data ?? []));
      if (!data || data.length < pageSize) break;
    }

    let truncated = false;
    if (leads.length === MAX_EXPORT_ROWS) {
      const { data, error } = await supabase
        .from("waitlist_applications")
        .select("id")
        .lte("created_at", exportCutoff)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(MAX_EXPORT_ROWS, MAX_EXPORT_ROWS);

      if (error) throw error;
      truncated = Boolean(data?.length);
    }

    const rows = leads.map((lead) => CSV_HEADERS.map((header) => csvCell(lead[header])).join(","));
    const csv = [CSV_HEADERS.join(","), ...rows].join("\n");

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="waitlist-leads-${new Date().toISOString().slice(0, 10)}.csv"`,
        ...PRIVATE_NO_STORE_HEADERS,
        "X-Export-Row-Count": String(leads.length),
        "X-Export-Row-Limit": String(MAX_EXPORT_ROWS),
        "X-Export-Truncated": String(truncated)
      }
    });
  } catch {
    return NextResponse.json(
      { ok: false, message: "Export could not be generated." },
      { status: 503, headers: PRIVATE_NO_STORE_HEADERS }
    );
  }
}
