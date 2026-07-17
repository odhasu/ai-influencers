import nodemailer from "nodemailer";

type BookingEmail = {
  guestName: string;
  guestEmail: string;
  eventName: string;
  startsAt: string;
};

export async function sendBookingEmail({ guestName, guestEmail, eventName, startsAt }: BookingEmail) {
  const gmailUser = process.env.GMAIL_USER;
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;
  const recipient = process.env.BOOKING_NOTIFICATION_EMAIL || gmailUser;

  if (!gmailUser || !gmailAppPassword || !recipient) {
    throw new Error("Gmail booking notifications are not configured.");
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: gmailUser, pass: gmailAppPassword }
  });
  const result = await transporter.sendMail({
    from: `Authentic Resell Bookings <${gmailUser}>`,
    to: recipient,
    replyTo: guestEmail,
    subject: `New Calendly booking: ${guestName}`,
    text: [
      "You received a new Calendly booking.",
      "",
      `Name: ${guestName}`,
      `Email: ${guestEmail}`,
      `Call: ${eventName}`,
      `Time: ${startsAt}`
    ].join("\n")
  });

  if (!result.messageId) throw new Error("Gmail did not return a message ID.");
  return result.messageId;
}
