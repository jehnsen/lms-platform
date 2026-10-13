"use client";

import dynamic from "next/dynamic";
import { PageSkeleton } from "@/components/ui";
import { useActor } from "@/lib/api/session";
import type { Role } from "@/lib/types";

const loading = () => <PageSkeleton />;

/** Each role's home is its own bundle, so nobody downloads the other three (NFR-2). */
const HOMES: Record<Role, React.ComponentType> = {
  student: dynamic(() => import("@/components/dashboard-view").then((mod) => mod.DashboardView), { loading }),
  faculty: dynamic(() => import("@/components/home-faculty").then((mod) => mod.FacultyHome), { loading }),
  admin: dynamic(() => import("@/components/home-admin").then((mod) => mod.AdminHome), { loading }),
  parent: dynamic(() => import("@/components/home-parent").then((mod) => mod.ParentHome), { loading }),
};

/** The page at `/`: a different home for each role (US-02). */
export function RoleHome() {
  const actor = useActor();
  if (!actor) return <PageSkeleton />;
  const Home = HOMES[actor.role];
  return <Home />;
}
