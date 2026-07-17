"use client";

import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import {
  analyticsConsentDecision,
  denyAnalyticsConsent,
  grantAnalyticsConsent,
  subscribeToAnalyticsConsent
} from "@/lib/analytics/client";

function subscribe(listener: () => void) {
  return subscribeToAnalyticsConsent(() => listener());
}

export function AnalyticsConsent() {
  const pathname = usePathname();
  const decision = useSyncExternalStore(subscribe, analyticsConsentDecision, () => null);
  const [editing, setEditing] = useState(false);

  if (pathname.startsWith("/dashboard") || pathname.startsWith("/admin")) {
    return null;
  }

  if (decision && !editing) {
    return (
      <button className="analytics-preference-button" type="button" onClick={() => setEditing(true)}>
        Analytics settings
      </button>
    );
  }

  return (
    <aside className="analytics-consent" aria-label="Analytics preference">
      <p>
        We use privacy-safe analytics to understand campaign performance and improve this application.
        Form entries are never sent to analytics and replay inputs are masked.
      </p>
      <div>
        <button
          className="consent-secondary"
          type="button"
          onClick={() => {
            denyAnalyticsConsent();
            setEditing(false);
          }}
        >
          Decline
        </button>
        <button
          className="consent-primary"
          type="button"
          onClick={() => {
            grantAnalyticsConsent();
            setEditing(false);
          }}
        >
          Allow analytics
        </button>
      </div>
    </aside>
  );
}
