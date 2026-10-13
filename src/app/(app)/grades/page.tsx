import type { Metadata } from "next";
import { GradesView } from "@/components/grades-view";

export const metadata: Metadata = { title: "My grades" };

export default function GradesPage() {
  return <GradesView />;
}
