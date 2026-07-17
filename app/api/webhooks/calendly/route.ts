import { verifyCalendlyWebhook } from "@/lib/calendly/webhook";
import { sendBookingEmail } from "@/lib/gmail/booking-email";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const webhookSchema = z.object({
  event: z.string(),
  payload: z.object({
    uri: z.url(),
    email: z.email(),
    name: z.string().trim().min(1).max(200),
    scheduled_event: z.object({
      name: z.string().trim().min(1).max(300),
      start_time: z.iso.datetime()
    })
  })
});

function formattedBookingTime(startTime: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: process.env.BOOKING_NOTIFICATION_TIMEZONE || "Europe/Amsterdam"
  }).format(new Date(startTime));
}

export async function POST(request: Request) {
  const signingKey = process.env.CALENDLY_WEBHOOK_SIGNING_KEY;
  if (!signingKey) {
    return NextResponse.json({ ok: false, message: "Webhook is not configured." }, { status: 503 });
  }

  const rawBody = await request.text();
  if (!verifyCalendlyWebhook(rawBody, request.headers.get("calendly-webhook-signature"), signingKey)) {
    return NextResponse.json({ ok: false, message: "Invalid signature." }, { status: 401 });
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid payload." }, { status: 400 });
  }

  const parsed = webhookSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid payload." }, { status: 400 });
  }
  if (parsed.data.event !== "invitee.created") {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const supabase = createSupabaseAdmin();
  const eventUri = parsed.data.payload.uri;
  const { data: claimed, error: claimError } = await supabase
    .from("booking_email_notifications")
    .insert({ calendly_event_uri: eventUri, invitee_email: parsed.data.payload.email.toLowerCase() })
    .select("id")
    .single();

  if (claimError?.code === "23505") return NextResponse.json({ ok: true, duplicate: true });
  if (claimError || !claimed) {
    return NextResponse.json({ ok: false, message: "Booking could not be claimed." }, { status: 503 });
  }

  try {
    const normalizedEmail = parsed.data.payload.email.toLowerCase();
    const { data: lead } = await supabase
      .from("waitlist_applications")
      .select("id,lead_status")
      .eq("email", normalizedEmail)
      .maybeSingle();

    const gmailMessageId = await sendBookingEmail({
      guestName: parsed.data.payload.name,
      guestEmail: parsed.data.payload.email,
      eventName: parsed.data.payload.scheduled_event.name,
      startsAt: formattedBookingTime(parsed.data.payload.scheduled_event.start_time)
    });

    await supabase
      .from("booking_email_notifications")
      .update({ lead_id: lead?.id ?? null, gmail_message_id: gmailMessageId, sent_at: new Date().toISOString() })
      .eq("id", claimed.id);

    if (lead && lead.lead_status !== "won") {
      await supabase.from("waitlist_applications").update({ lead_status: "booked" }).eq("id", lead.id);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    await supabase.from("booking_email_notifications").delete().eq("id", claimed.id);
    console.error("calendly_booking_email_failed", {
      message: error instanceof Error ? error.message : "Unknown error"
    });
    return NextResponse.json({ ok: false, message: "Booking email could not be sent." }, { status: 503 });
  }
}
