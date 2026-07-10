import posthog from "posthog-js";

const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

if (token && host && typeof window !== "undefined") {
  const consent = window.localStorage.getItem("analytics_consent");

  posthog.init(token, {
    api_host: "/ingest",
    ui_host: host,
    defaults: "2026-05-30",
    autocapture: true,
    capture_pageview: false,
    capture_pageleave: true,
    person_profiles: "identified_only",
    opt_out_capturing_by_default: consent !== "granted",
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: "[data-private]"
    }
  });
}
