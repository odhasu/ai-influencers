import type { Metadata, Viewport } from "next";
import { AnalyticsPageTracker } from "@/components/analytics-page-tracker";
import { SmoothScroll } from "@/components/smooth-scroll";
import "lenis/dist/lenis.css";
import "react-international-phone/style.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "OG Ecom | Apply for the Inner Circle",
  description: "Apply to build your high-ticket reselling business with the Inner Circle."
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lets the layout paint edge to edge on notched phones; the safe-area
  // insets in globals.css keep content clear of the notch and home bar.
  viewportFit: "cover",
  themeColor: "#000000"
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
