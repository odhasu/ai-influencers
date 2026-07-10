import { PostHog } from "posthog-node";

type ServerEvent = {
  distinctId: string;
  event: string;
  properties?: Record<string, string | number | boolean | null>;
};

export async function captureServerEvent(payload: ServerEvent) {
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

  if (!token || !host) return;

  const client = new PostHog(token, {
    host,
    flushAt: 1,
    flushInterval: 0
  });

  try {
    client.capture(payload);
  } finally {
    await client.shutdown();
  }
}
