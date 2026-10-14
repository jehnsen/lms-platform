"use client";

import { useState } from "react";
import { GraduationCap, Presentation, ShieldAlert, Users } from "lucide-react";
import { AuditTable } from "@/components/audit-table";
import { Button, ButtonLink, Card, PageContainer, PageHeader, SectionTitle, StatTile } from "@/components/ui";
import { resetDemoData, useAuditLog } from "@/lib/api/audit";
import { useCourses, useTerms } from "@/lib/api/courses";
import { useUsers } from "@/lib/api/users";
import { formatDate } from "@/lib/utils";

const RECENT_EVENTS = 12;

/**
 * Admin home: who is in the system and what has just happened in it. Users,
 * terms, settings and the full audit log have their own pages under /admin;
 * school-wide reporting (US-27) arrives in Phase 7.
 */
export function AdminHome() {
  const users = useUsers() ?? [];
  const events = useAuditLog() ?? [];
  const courses = useCourses();
  const terms = useTerms();
  const [confirmingReset, setConfirmingReset] = useState(false);

  const count = (role: string) => users.filter((user) => user.role === role && user.status === "active").length;
  const notActive = users.filter((user) => user.status !== "active").length;
  const activeTerm = terms.find((term) => term.status === "active");
  const denied = events.filter((event) => event.outcome === "denied").length;

  return (
    <PageContainer>
      <PageHeader
        title="School overview"
        description={
          activeTerm
            ? `${activeTerm.name} runs ${formatDate(activeTerm.startsOn)} to ${formatDate(activeTerm.endsOn)}.`
            : "No term is active."
        }
        actions={
          <>
            <ButtonLink href="/admin/terms" variant="secondary">
              Manage terms
            </ButtonLink>
            <ButtonLink href="/analytics" variant="secondary">
              School dashboard
            </ButtonLink>
            <ButtonLink href="/admin/users">Manage users</ButtonLink>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile icon={GraduationCap} label="Students" value={count("student")} hint="Active accounts" />
        <StatTile icon={Presentation} label="Faculty" value={count("faculty")} hint="Active accounts" />
        <StatTile
          icon={Users}
          label="Parents"
          value={count("parent")}
          hint={`${notActive} inactive or archived ${notActive === 1 ? "account" : "accounts"} in all`}
        />
        <StatTile
          icon={ShieldAlert}
          label="Denied attempts"
          value={denied}
          hint={`${courses.length} courses in the catalogue`}
        />
      </div>

      <section className="mt-10">
        <SectionTitle
          action={
            <ButtonLink href="/admin/audit" variant="ghost" size="sm">
              View audit log
            </ButtonLink>
          }
        >
          Recent activity
        </SectionTitle>
        <Card className="overflow-hidden">
          {events.length === 0 ? (
            <p className="p-5 text-sm text-ink-2">
              Nothing has been recorded yet. Sign-ins, exports and blocked attempts will appear here.
            </p>
          ) : (
            <AuditTable
              events={events.slice(0, RECENT_EVENTS)}
              users={users}
              caption={`The ${RECENT_EVENTS} most recent audit events`}
            />
          )}
        </Card>
      </section>

      <section className="mt-10">
        <SectionTitle>Demo data</SectionTitle>
        <Card className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
          <p className="max-w-xl text-ink-2">
            Everything is stored in this browser. Resetting returns users, terms, settings, progress,
            notifications and the audit log to the seeded starting point.
          </p>
          {confirmingReset ? (
            <span className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setConfirmingReset(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setConfirmingReset(false);
                  void resetDemoData();
                }}
              >
                Yes, reset everything
              </Button>
            </span>
          ) : (
            <Button variant="secondary" size="sm" onClick={() => setConfirmingReset(true)}>
              Reset demo data
            </Button>
          )}
        </Card>
      </section>
    </PageContainer>
  );
}
