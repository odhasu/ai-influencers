type SmsMessage = {
  to: string;
  body: string;
};

export async function sendSms({ to, body }: SmsMessage) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !from) {
    throw new Error("Twilio SMS is not configured.");
  }

  const form = new URLSearchParams({ To: to, From: from, Body: body });
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: form,
      signal: AbortSignal.timeout(8_000)
    }
  );

  if (!response.ok) {
    throw new Error(`Twilio rejected the SMS request (${response.status}).`);
  }

  const result = await response.json() as { sid?: string };
  if (!result.sid) throw new Error("Twilio did not return a message ID.");
  return result.sid;
}
