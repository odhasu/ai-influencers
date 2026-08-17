import type { Metadata } from "next";
import { ApplicationResult } from "@/components/application-result";

export const metadata: Metadata = {
  title: "Application Received | Lucas Resells",
  description: "Your Inner Circle application has been received."
};

export default function QualifiedPage() {
  return <ApplicationResult message="Thank you for applying" />;
}
