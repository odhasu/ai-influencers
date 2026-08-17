"use client";

import Lenis from "lenis";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

export function SmoothScroll() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname.startsWith("/dashboard") || pathname.startsWith("/admin")) return;

    const lenis = new Lenis({
      autoRaf: true,
      anchors: { duration: 1.35 },
      duration: 1.4,
      smoothWheel: true,
      stopInertiaOnNavigate: true,
      syncTouch: false,
      wheelMultiplier: 0.82,
      prevent: (node) =>
        Boolean(node.closest(".react-international-phone-country-selector-dropdown, .calendly-card"))
    });

    return () => lenis.destroy();
  }, [pathname]);

  return null;
}
