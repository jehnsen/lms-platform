import type { Metadata } from "next";
import { AdminTerms } from "@/components/admin-terms";

export const metadata: Metadata = { title: "Terms" };

export default function AdminTermsPage() {
  return <AdminTerms />;
}
