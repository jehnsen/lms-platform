"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState, type ReactNode } from "react";
import {
  BookOpen,
  Clapperboard,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  Menu,
  Sparkles,
  Table2,
  WandSparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import { currentUser } from "@/lib/data/people";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const NAV: Array<{ heading: string; items: NavItem[] }> = [
  {
    heading: "Learn",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/courses", label: "Courses", icon: BookOpen },
      { href: "/quizzes", label: "Quizzes", icon: ListChecks },
      { href: "/grades", label: "My grades", icon: GraduationCap },
      { href: "/tutor", label: "AI tutor", icon: Sparkles },
    ],
  },
  {
    heading: "Teach",
    items: [
      { href: "/lesson-planner", label: "Lesson planner", icon: WandSparkles },
      { href: "/content", label: "Content library", icon: Clapperboard },
      { href: "/gradebook", label: "Gradebook", icon: Table2 },
    ],
  },
];

function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({ pathname, onNavigate }: { pathname: string | null; onNavigate?: () => void }) {
  return (
    <nav aria-label="Main" className="flex flex-col gap-6">
      {NAV.map((group) => (
        <div key={group.heading}>
          <div className="mb-1 px-3 text-xs font-medium tracking-wide text-ink-3 uppercase">
            {group.heading}
          </div>
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
                    {item.label}
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

function ActiveNavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return <NavLinks pathname={usePathname()} onNavigate={onNavigate} />;
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="grid size-8 place-items-center rounded-lg bg-primary text-on-primary">
        <GraduationCap aria-hidden className="size-4.5" />
      </span>
      <span className="font-display text-xl font-semibold tracking-tight">3rdLoopLearning</span>
    </Link>
  );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col gap-8 p-4">
      <div className="px-1 pt-1">
        <Brand />
      </div>
      <div className="flex-1 overflow-y-auto">
        {/* usePathname can suspend on routes with unknown params; fall back to an unhighlighted nav. */}
        <Suspense fallback={<NavLinks pathname={null} onNavigate={onNavigate} />}>
          <ActiveNavLinks onNavigate={onNavigate} />
        </Suspense>
      </div>
      <div className="flex items-center gap-3 rounded-lg border border-line p-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-sm font-semibold">
          {currentUser.initials}
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{currentUser.name}</div>
          <div className="truncate text-xs text-ink-3">Demo account</div>
        </div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="flex min-h-dvh flex-1">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 border-r border-line bg-surface lg:block">
        <Sidebar />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-surface px-4 lg:hidden">
          <Brand />
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            className="grid size-10 place-items-center rounded-lg text-ink-2 hover:bg-surface-2"
          >
            <Menu aria-hidden className="size-5" />
          </button>
        </header>
        <main className="flex-1">{children}</main>
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
            <Sidebar onNavigate={closeMenu} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
