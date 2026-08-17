import type { Metadata } from "next";
import { AnalyticsPageTracker } from "@/components/analytics-page-tracker";
import { SmoothScroll } from "@/components/smooth-scroll";
import "lenis/dist/lenis.css";
import "react-international-phone/style.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lucas Resells | Apply for the Inner Circle",
  description: "Apply to build your high-ticket reselling business with the Inner Circle."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <SmoothScroll />
        <AnalyticsPageTracker />
      </body>
    </html>
  );
}
