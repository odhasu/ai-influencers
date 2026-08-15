"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
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

  useEffect(() => {
    const openPreferences = () => setEditing(true);
    window.addEventListener("analytics-preferences-open", openPreferences);
    return () => window.removeEventListener("analytics-preferences-open", openPreferences);
  }, []);

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
      <span className="analytics-consent-title">Analytics preferences</span>
      <p>Allow privacy-conscious usage analytics to help us improve the funnel. Contact details and application answers are never included in analytics events.</p>
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
