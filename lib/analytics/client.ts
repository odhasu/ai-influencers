"use client";

import posthog from "posthog-js";

export type AnalyticsValue = string | number | boolean | string[] | number[];
export type AnalyticsProperties = Record<string, AnalyticsValue | undefined>;

export type AttributionTouch = {
  captured_at: string;
  landing_path: string;
  referrer_domain: string;
  referrer_path: string;
  referral_code: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  utm_term: string;
  gclid: string;
  gbraid: string;
  wbraid: string;
  fbclid: string;
  ttclid: string;
  msclkid: string;
  twclid: string;
  li_fat_id: string;
  sccid: string;
  dclid: string;
};

export type AttributionState = {
  first_touch: AttributionTouch;
  last_touch: AttributionTouch;
};

type VisitorState = {
  id: string;
  first_seen_at: string;
  last_seen_at: string;
  session_count: number;
};

type SessionState = {
  id: string;
  last_activity_at: string;
  number: number;
};

export type AnalyticsContext = {
  visitor_id: string;
  session_id: string;
  pageview_id: string;
  session_number: number;
  is_returning_visitor: boolean;
  timezone: string;
  locale: string;
  viewport_width: number;
  viewport_height: number;
  first_touch: AttributionTouch;
  last_touch: AttributionTouch;
};

const consentKey = "analytics_consent";
const visitorKey = "funnel_visitor_v1";
const sessionKey = "funnel_session_v1";
const attributionKey = "funnel_attribution_v1";
const consentEvent = "funnel-analytics-consent-changed";
const sessionTimeoutMs = 30 * 60 * 1000;
const clickIdKeys = [
  "gclid",
  "gbraid",
  "wbraid",
  "fbclid",
  "ttclid",
  "msclkid",
  "twclid",
  "li_fat_id",
  "sccid",
  "dclid"
] as const;

let contextCache: AnalyticsContext | null = null;
let ephemeralSessionId = "";

function safeValue(value: string | null, maxLength = 160) {
  return (value ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, maxLength);
}

function emptyTouch(): AttributionTouch {
  return {
    captured_at: "",
    landing_path: "",
    referrer_domain: "",
    referrer_path: "",
    referral_code: "",
    utm_source: "",
    utm_medium: "",
    utm_campaign: "",
    utm_content: "",
    utm_term: "",
    gclid: "",
    gbraid: "",
    wbraid: "",
    fbclid: "",
    ttclid: "",
    msclkid: "",
    twclid: "",
    li_fat_id: "",
    sccid: "",
    dclid: ""
  };
}

function parseJson<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function currentTouch(): AttributionTouch {
  const parameters = new URLSearchParams(window.location.search);
  let referrerDomain = "";
  let referrerPath = "";

  if (document.referrer) {
    try {
      const referrer = new URL(document.referrer);
      referrerDomain = safeValue(referrer.hostname, 160);
      referrerPath = safeValue(referrer.pathname, 300);
    } catch {
      // Invalid referrers are ignored rather than copied into analytics.
    }
  }

  const touch: AttributionTouch = {
    ...emptyTouch(),
    captured_at: new Date().toISOString(),
    landing_path: safeValue(window.location.pathname, 300),
    referrer_domain: referrerDomain,
    referrer_path: referrerPath,
    referral_code: safeValue(parameters.get("ref") ?? parameters.get("referral_code"), 80)
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, ""),
    utm_source: safeValue(parameters.get("utm_source")),
    utm_medium: safeValue(parameters.get("utm_medium")),
    utm_campaign: safeValue(parameters.get("utm_campaign")),
    utm_content: safeValue(parameters.get("utm_content")),
    utm_term: safeValue(parameters.get("utm_term"))
  };

  for (const key of clickIdKeys) touch[key] = safeValue(parameters.get(key), 300);
  return touch;
}

function hasAcquisitionSignal(touch: AttributionTouch) {
  return Boolean(
    touch.referral_code ||
      touch.utm_source ||
      touch.referrer_domain ||
      clickIdKeys.some((key) => touch[key])
  );
}

function buildAttribution(): AttributionState {
  const existing = parseJson<AttributionState>(window.localStorage.getItem(attributionKey));
  const latest = currentTouch();
  const firstTouch = existing?.first_touch?.captured_at ? existing.first_touch : latest;
  const lastTouch = hasAcquisitionSignal(latest) || !existing?.last_touch ? latest : existing.last_touch;
  const attribution = { first_touch: firstTouch, last_touch: lastTouch };
  window.localStorage.setItem(attributionKey, JSON.stringify(attribution));
  return attribution;
}

function buildContext(): AnalyticsContext {
  const now = new Date();
  const nowIso = now.toISOString();
  const storedVisitor = parseJson<VisitorState>(window.localStorage.getItem(visitorKey));
  const storedSession = parseJson<SessionState>(window.localStorage.getItem(sessionKey));
  const sessionIsActive = Boolean(
    storedSession?.id && now.getTime() - new Date(storedSession.last_activity_at).getTime() < sessionTimeoutMs
  );
  const visitor: VisitorState = storedVisitor?.id
    ? { ...storedVisitor, last_seen_at: nowIso }
    : { id: window.crypto.randomUUID(), first_seen_at: nowIso, last_seen_at: nowIso, session_count: 0 };
  const sessionNumber = sessionIsActive ? storedSession!.number : visitor.session_count + 1;
  const session: SessionState = {
    id: sessionIsActive ? storedSession!.id : window.crypto.randomUUID(),
    last_activity_at: nowIso,
    number: sessionNumber
  };

  visitor.session_count = Math.max(visitor.session_count, sessionNumber);
  window.localStorage.setItem(visitorKey, JSON.stringify(visitor));
  window.localStorage.setItem(sessionKey, JSON.stringify(session));

  const attribution = buildAttribution();
  return {
    visitor_id: visitor.id,
    session_id: session.id,
    pageview_id: window.crypto.randomUUID(),
    session_number: sessionNumber,
    is_returning_visitor: sessionNumber > 1,
    timezone: safeValue(Intl.DateTimeFormat().resolvedOptions().timeZone, 80),
    locale: safeValue(navigator.language, 40),
    viewport_width: Math.max(0, Math.round(window.innerWidth)),
    viewport_height: Math.max(0, Math.round(window.innerHeight)),
    ...attribution
  };
}

function posthogProperties(context: AnalyticsContext): AnalyticsProperties {
  const first = context.first_touch;
  const last = context.last_touch;
  const properties: AnalyticsProperties = {
    visitor_id: context.visitor_id,
    session_id: context.session_id,
    pageview_id: context.pageview_id,
    session_number: context.session_number,
    is_returning_visitor: context.is_returning_visitor,
    timezone: context.timezone,
    locale: context.locale,
    viewport_width: context.viewport_width,
    viewport_height: context.viewport_height,
    first_touch_utm_source: first.utm_source,
    first_touch_utm_medium: first.utm_medium,
    first_touch_utm_campaign: first.utm_campaign,
    first_touch_referrer_domain: first.referrer_domain,
    last_touch_utm_source: last.utm_source,
    last_touch_utm_medium: last.utm_medium,
    last_touch_utm_campaign: last.utm_campaign,
    last_touch_referrer_domain: last.referrer_domain,
    referral_code: last.referral_code,
    landing_path: last.landing_path
  };

  for (const key of clickIdKeys) {
    if (last[key]) properties[key] = last[key];
  }
  return properties;
}

function compactProperties(properties: AnalyticsProperties) {
  return Object.fromEntries(
    Object.entries(properties).filter(([, value]) => value !== undefined && value !== "")
  ) as Record<string, AnalyticsValue>;
}

export function analyticsConsentGranted() {
  return typeof window !== "undefined" && window.localStorage.getItem(consentKey) === "granted";
}

export function analyticsConsentDecision() {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(consentKey);
  return value === "granted" || value === "denied" ? value : null;
}

export function grantAnalyticsConsent() {
  window.localStorage.setItem(consentKey, "granted");
  contextCache = buildContext();
  try {
    posthog.opt_in_capturing();
  } catch {
    // First-party analytics remains available when PostHog is not configured.
  }
  captureFunnelEvent("analytics_consent_granted");
  window.dispatchEvent(new CustomEvent(consentEvent, { detail: "granted" }));
}

export function denyAnalyticsConsent() {
  window.localStorage.setItem(consentKey, "denied");
  window.localStorage.removeItem(visitorKey);
  window.localStorage.removeItem(sessionKey);
  window.localStorage.removeItem(attributionKey);
  contextCache = null;
  try {
    posthog.opt_out_capturing();
  } catch {
    // PostHog may not be initialized.
  }
  window.dispatchEvent(new CustomEvent(consentEvent, { detail: "denied" }));
}

export function subscribeToAnalyticsConsent(listener: (granted: boolean) => void) {
  const handler = (event: Event) => listener((event as CustomEvent<string>).detail === "granted");
  window.addEventListener(consentEvent, handler);
  return () => window.removeEventListener(consentEvent, handler);
}

export function getAnalyticsContext() {
  if (!analyticsConsentGranted()) return null;
  if (!contextCache) contextCache = buildContext();
  return contextCache;
}

export function getSubmissionAnalytics() {
  const context = getAnalyticsContext();
  if (context) {
    return {
      analytics_consent: true,
      session_id: context.session_id,
      visitor_id: context.visitor_id,
      pageview_id: context.pageview_id,
      session_number: context.session_number,
      timezone: context.timezone,
      attribution: {
        first_touch: context.first_touch,
        last_touch: context.last_touch
      }
    };
  }

  if (!ephemeralSessionId) ephemeralSessionId = window.crypto.randomUUID();
  return {
    analytics_consent: false,
    session_id: ephemeralSessionId,
    visitor_id: "",
    pageview_id: "",
    session_number: 1,
    timezone: "",
    attribution: { first_touch: emptyTouch(), last_touch: emptyTouch() }
  };
}

export function captureFunnelEvent(event: string, properties: AnalyticsProperties = {}) {
  const context = getAnalyticsContext();
  if (!context) return;

  const nowIso = new Date().toISOString();
  window.localStorage.setItem(
    sessionKey,
    JSON.stringify({ id: context.session_id, last_activity_at: nowIso, number: context.session_number })
  );

  const eventProperties = compactProperties({ ...posthogProperties(context), ...properties });
  void fetch("/api/funnel-events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    body: JSON.stringify({
      event,
      occurred_at: nowIso,
      session_id: context.session_id,
      context,
      properties: compactProperties(properties)
    })
  }).catch(() => undefined);

  try {
    posthog.capture(event, eventProperties);
  } catch {
    // Analytics must never interrupt the public funnel.
  }
}

export function identifyAnalyticsLead(leadId: string) {
  if (!analyticsConsentGranted()) return;
  try {
    posthog.identify(leadId);
  } catch {
    // Server-side events still connect the pseudonymous visitor to the lead.
  }
}

export function getPosthogDistinctId() {
  if (!analyticsConsentGranted()) return "";
  try {
    return posthog.get_distinct_id();
  } catch {
    return "";
  }
}
