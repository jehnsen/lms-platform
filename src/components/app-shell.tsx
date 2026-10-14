"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState, type ReactNode } from "react";
import {
  BookOpen,
  CalendarCheck,
  CalendarDays,
  CalendarRange,
  Clapperboard,
  ClipboardCheck,
  FileText,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  LogOut,
  PenLine,
  Menu,
  ScrollText,
  Settings,
  Sparkles,
  Table2,
  Users,
  WandSparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { NotificationBell } from "@/components/notification-bell";
import { RouteGuard } from "@/components/route-guard";
import { PageSkeleton } from "@/components/ui";
import { signInAsDemo, signOut, useActor } from "@/lib/api/session";
import { ROLES, ROLE_LABELS } from "@/lib/domain/permissions";
import { SIGN_IN_PATH, canAccessRoute } from "@/lib/domain/routes";
import { reloadTo } from "@/lib/navigation";
import type { Role } from "@/lib/types";
import { cn, initialsOf } from "@/lib/utils";

interface NavItem {
  href: string;
  /** One label for every role, or a label for each role that sees the entry here. */
  label: string | Partial<Record<Role, string>>;
  icon: LucideIcon;
}

interface NavGroup {
  heading?: string | Partial<Record<Role, string>>;
  items: NavItem[];
}

/**
 * Every destination, in display order. Each role sees only the entries its
 * permissions allow (`canAccessRoute`), so the menu and the page guards
 * cannot disagree.
 */
const NAV: NavGroup[] = [
  {
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/courses", label: "Courses", icon: BookOpen },
      { href: "/assignments", label: "Assignments", icon: ClipboardCheck },
      { href: "/quizzes", label: "Quizzes", icon: ListChecks },
      { href: "/calendar", label: "Calendar", icon: CalendarDays },
    ],
  },
  {
    heading: { student: "Learn", parent: "Your child" },
    items: [
      { href: "/grades", label: { student: "My grades", parent: "Grades" }, icon: GraduationCap },
      { href: "/attendance", label: { student: "Attendance", parent: "Attendance" }, icon: CalendarCheck },
      { href: "/reports", label: { student: "Progress report", parent: "Progress report" }, icon: FileText },
      { href: "/tutor", label: "AI tutor", icon: Sparkles },
    ],
  },
  {
    heading: { faculty: "Teach", admin: "Oversight" },
    items: [
      { href: "/grading", label: "Grading queue", icon: PenLine },
      { href: "/attendance", label: { faculty: "Attendance", admin: "Attendance" }, icon: CalendarCheck },
      { href: "/gradebook", label: "Gradebook", icon: Table2 },
      { href: "/reports", label: { faculty: "Progress reports", admin: "Progress reports" }, icon: FileText },
      { href: "/content", label: "Content library", icon: Clapperboard },
      { href: "/lesson-planner", label: "Lesson planner", icon: WandSparkles },
    ],
  },
  {
    heading: "Administration",
    items: [
      { href: "/admin/users", label: "Users", icon: Users },
      { href: "/admin/terms", label: "Terms", icon: CalendarRange },
      { href: "/admin/settings", label: "Settings", icon: Settings },
      { href: "/admin/audit", label: "Audit log", icon: ScrollText },
    ],
  },
];

function textFor(value: string | Partial<Record<Role, string>> | undefined, role: Role) {
  return typeof value === "string" ? value : value?.[role];
}

function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({
  role,
  pathname,
  onNavigate,
}: {
  role: Role;
  pathname: string | null;
  onNavigate?: () => void;
}) {
  const groups = NAV.map((group) => ({
    heading: textFor(group.heading, role),
    items: group.items.filter(
      (item) => canAccessRoute(role, item.href) && textFor(item.label, role) !== undefined,
    ),
  })).filter((group) => group.items.length > 0);

  return (
    <nav aria-label="Main" className="flex flex-col gap-6">
      {groups.map((group) => (
        <div key={group.items[0].href}>
          {group.heading ? (
            <div className="mb-1 px-3 text-xs font-medium tracking-wide text-ink-3 uppercase">
              {group.heading}
            </div>
          ) : null}
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-primary-soft text-primary-ink"
                        : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                    )}
                  >
                    <item.icon aria-hidden className="size-4 shrink-0" />
                    {textFor(item.label, role)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function ActiveNavLinks({ role, onNavigate }: { role: Role; onNavigate?: () => void }) {
  return <NavLinks role={role} pathname={usePathname()} onNavigate={onNavigate} />;
}

function NavSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-2 px-3">
      {[0, 1, 2, 3].map((row) => (
        <div key={row} className="h-8 rounded-lg bg-surface-2" />
      ))}
    </div>
  );
}

function Sidebar({ onNavigate, inDrawer }: { onNavigate?: () => void; inDrawer?: boolean }) {
  const actor = useActor();
  const viewAsId = inDrawer ? "view-as-drawer" : "view-as";

  // The page you are on may not exist for the new role, so start from home.
  const viewAs = (role: Role) => reloadTo("/", () => signInAsDemo(role));
  const leave = () => reloadTo(SIGN_IN_PATH, signOut);

  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <div className="flex items-center justify-between gap-2 pt-1 pl-1">
        <Brand />
        {/* On small screens the bell lives in the top bar instead. */}
        {inDrawer ? null : <NotificationBell panelClassName="absolute top-full left-0 mt-2 w-80" />}
      </div>

      <div className="flex-1 overflow-y-auto">
        {actor ? (
          // usePathname can suspend on routes with unknown params; fall back to an unhighlighted nav.
          <Suspense fallback={<NavLinks role={actor.role} pathname={null} onNavigate={onNavigate} />}>
            <ActiveNavLinks role={actor.role} onNavigate={onNavigate} />
          </Suspense>
        ) : (
          <NavSkeleton />
        )}
      </div>

      {actor ? (
        <div className="flex flex-col gap-3">
          <div>
            <label htmlFor={viewAsId} className="mb-1 block px-1 text-xs text-ink-3">
              Demo: view as
            </label>
            <select
              id={viewAsId}
              value={actor.role}
              onChange={(event) => viewAs(event.target.value as Role)}
              className="h-9 w-full rounded-lg border border-line-strong bg-surface px-2 text-sm"
            >
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3 rounded-lg border border-line p-3">
            <span
              aria-hidden
              className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-sm font-semibold"
            >
              {initialsOf(actor.name)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{actor.name}</div>
              <div className="truncate text-xs text-ink-3">{ROLE_LABELS[actor.role]}</div>
            </div>
            <button
              type="button"
              onClick={leave}
              aria-label="Sign out"
              title="Sign out"
              className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-3 hover:bg-surface-2 hover:text-ink"
            >
              <LogOut aria-hidden className="size-4" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="flex min-h-dvh flex-1">
      <aside className="sticky top-0 z-30 hidden h-dvh w-60 shrink-0 border-r border-line bg-surface lg:block print:hidden!">
        <Sidebar />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-line bg-surface px-4 lg:hidden print:hidden!">
          <Brand />
          <div className="flex items-center">
            <NotificationBell panelClassName="fixed inset-x-3 top-16" />
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              className="grid size-10 place-items-center rounded-lg text-ink-2 hover:bg-surface-2"
            >
              <Menu aria-hidden className="size-5" />
            </button>
          </div>
        </header>
        <main className="flex-1">
          <Suspense fallback={<PageSkeleton />}>
            <RouteGuard>{children}</RouteGuard>
          </Suspense>
        </main>
      </div>

      {menuOpen ? (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          onKeyDown={(event) => {
            if (event.key === "Escape") closeMenu();
          }}
        >
          <button
            type="button"
            aria-label="Close menu"
            onClick={closeMenu}
            className="absolute inset-0 bg-black/50"
          />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r border-line bg-surface">
            <button
              type="button"
              autoFocus
              onClick={closeMenu}
              aria-label="Close menu"
              className="absolute top-3 right-3 grid size-9 place-items-center rounded-lg text-ink-2 hover:bg-surface-2"
            >
              <X aria-hidden className="size-5" />
            </button>
            <Sidebar inDrawer onNavigate={closeMenu} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
