import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";

/** Everything behind sign-in shares the sidebar shell; /login sits outside it. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
