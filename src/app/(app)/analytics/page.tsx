import type { Metadata } from "next";
import { AnalyticsView } from "@/components/analytics-view";

export const metadata: Metadata = { title: "Dashboards" };

export default function AnalyticsPage() {
  return <AnalyticsView />;
}
