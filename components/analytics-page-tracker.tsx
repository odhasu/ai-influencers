"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useSyncExternalStore } from "react";
import {
  analyticsConsentGranted,
  captureFunnelEvent,
  subscribeToAnalyticsConsent
} from "@/lib/analytics/client";

function pageType(pathname: string) {
  if (pathname === "/" || pathname === "/waitlist") return "application";
  if (pathname === "/waitlist-thank-you") return "thank_you";
  return "public";
}

function subscribe(listener: () => void) {
  return subscribeToAnalyticsConsent(() => listener());
}

export function AnalyticsPageTracker() {
  const pathname = usePathname();
  const enabled = useSyncExternalStore(subscribe, analyticsConsentGranted, () => false);
  const trackedPageRef = useRef("");

  useEffect(() => {
    if (!enabled || pathname.startsWith("/dashboard") || pathname.startsWith("/admin")) return;

    const trackingKey = `${pathname}:${Date.now()}`;
    trackedPageRef.current = trackingKey;
    const kind = pageType(pathname);
    let activeStartedAt = document.visibilityState === "visible" ? Date.now() : 0;
    let activeMs = 0;
    let maxScrollPercent = 0;
    let flushed = false;
    const reached = new Set<number>();

    const activeElapsed = () => activeMs + (activeStartedAt ? Date.now() - activeStartedAt : 0);
    const onScroll = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      maxScrollPercent = scrollable <= 0
        ? 100
        : Math.max(maxScrollPercent, Math.min(100, Math.round((window.scrollY / scrollable) * 100)));
      for (const milestone of [25, 50, 75, 90, 100]) {
        if (maxScrollPercent >= milestone && !reached.has(milestone)) {
          reached.add(milestone);
          captureFunnelEvent("scroll_depth_reached", { percent: milestone, page_type: kind });
        }
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        if (activeStartedAt) activeMs += Date.now() - activeStartedAt;
        activeStartedAt = 0;
      } else if (!activeStartedAt) {
        activeStartedAt = Date.now();
      }
    };
    const flush = () => {
      if (flushed || trackedPageRef.current !== trackingKey) return;
      flushed = true;
      captureFunnelEvent("page_engagement_recorded", {
        page_type: kind,
        engaged_ms: Math.round(activeElapsed()),
        max_scroll_percent: maxScrollPercent
      });
    };
    const onClick = (event: MouseEvent) => {
      const source = event.target instanceof Element
        ? event.target.closest<HTMLElement>("[data-analytics-label]")
        : null;
      if (!source) return;
      let destinationHost = "";
      let destinationPath = "";
      if (source instanceof HTMLAnchorElement && source.href) {
        try {
          const destination = new URL(source.href);
          destinationHost = destination.hostname.slice(0, 160);
          destinationPath = destination.pathname.slice(0, 300);
        } catch {
          // Invalid destinations are omitted.
        }
      }
      const properties = {
        button_label: (source.dataset.analyticsLabel ?? "").slice(0, 80),
        cta_location: (source.dataset.analyticsLocation ?? "").slice(0, 80),
        destination_host: destinationHost,
        destination_path: destinationPath
      };
      captureFunnelEvent("button_clicked", properties);
      if (source.dataset.analyticsEvent === "booking_started") {
        captureFunnelEvent("booking_started", { ...properties, provider: "external_link" });
      }
    };

    captureFunnelEvent("page_viewed", { landing_path: pathname, page_type: kind });
    if (kind === "application") {
      captureFunnelEvent("landing_viewed", { landing_path: pathname, page_type: kind });
    }
    const timers = [15, 30, 60, 120, 300].map((seconds) =>
      window.setTimeout(
        () => captureFunnelEvent("time_on_page_reached", { seconds, page_type: kind }),
        seconds * 1000
      )
    );

    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("click", onClick);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    onScroll();

    return () => {
      flush();
      timers.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("click", onClick);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
    };
  }, [enabled, pathname]);

  return null;
}
