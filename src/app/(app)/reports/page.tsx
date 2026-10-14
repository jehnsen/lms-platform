import type { Metadata } from "next";
import { ReportView } from "@/components/report-view";

export const metadata: Metadata = { title: "Progress reports" };

export default function ReportsPage() {
  return <ReportView />;
}
