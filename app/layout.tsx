import type { Metadata } from "next";
import { AnalyticsConsent } from "@/components/analytics-consent";
import { AnalyticsPageTracker } from "@/components/analytics-page-tracker";
import "react-international-phone/style.css";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://authenticresell.com"),
  title: {
    default: "Authentic Resell | Inner Circle Application",
    template: "%s | Authentic Resell"
  },
  description:
    "Apply to the Authentic Resell Inner Circle, then choose a time to discuss your reselling experience and goals.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Authentic Resell",
    title: "Authentic Resell | Inner Circle Application",
    description:
      "Apply to the Inner Circle and choose a time to discuss your reselling experience and goals."
  },
  twitter: {
    card: "summary_large_image",
    title: "Authentic Resell | Inner Circle Application",
    description:
      "Apply to the Inner Circle and choose a time to discuss your reselling experience and goals."
  },
  robots: {
    index: true,
    follow: true
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <AnalyticsPageTracker />
        <AnalyticsConsent />
      </body>
    </html>
  );
}
