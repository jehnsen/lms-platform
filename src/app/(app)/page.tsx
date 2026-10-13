import type { Metadata } from "next";
import { RoleHome } from "@/components/role-home";

export const metadata: Metadata = { title: "Dashboard" };

export default function HomePage() {
  return <RoleHome />;
}
