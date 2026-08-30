import type { Metadata } from "next";
import { ApplicationResult } from "@/components/application-result";

export const metadata: Metadata = {
  title: "Application Received | OG Ecom",
  description: "Your Inner Circle application has been received."
};

export default function UnqualifiedPage() {
  return (
    <ApplicationResult message="Thank you for applying. Based on your current budget, we're unable to offer a strategy call at this time. We'll review your application and contact you if we're a good fit." />
  );
}
