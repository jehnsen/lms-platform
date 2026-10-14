"use client";

import { useLayoutEffect, useState } from "react";
import { Download, LoaderCircle, Pencil, RefreshCw, Search, Upload } from "lucide-react";
import { Badge, Button, Card, PageContainer, PageHeader, fieldBaseClass, fieldClass } from "@/components/ui";
import { STATUS_LABELS, UserEditDialog } from "@/components/user-edit-dialog";
import { ImportReport, UserImportPanel, downloadImportReport } from "@/components/user-import";
import { useActor } from "@/lib/api/session";
import { setUserStatus, syncFromSis, useSisSync, useUserSections, useUsers } from "@/lib/api/users";
import { ROLES, ROLE_LABELS } from "@/lib/domain/permissions";
import type { ImportPlan } from "@/lib/domain/user-import";
import type { AccountStatus, Role, User } from "@/lib/types";
import { cn, formatDateTime } from "@/lib/utils";

const STATUS_TONES: Record<AccountStatus, "good" | "warn" | "neutral"> = {
  active: "good",
  inactive: "warn",
  archived: "neutral",
};

const STATUSES: AccountStatus[] = ["active", "inactive", "archived"];

/** How many section codes or children a row lists before "+N more". */
const LISTED = 3;

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Try again.";
}

/**
 * Admin users page (Epic A): bulk onboarding from CSV or the SIS (US-01), role
 * changes (US-03), account statuses (US-04) and parent–child links (US-05).
 */
export function AdminUsers() {
  const actor = useActor();
  const users = useUsers();
  const sectionsOf = useUserSections();
  const sisSync = useSisSync();
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<Role | "all">("all");
  const [status, setStatus] = useState<AccountStatus | "all">("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<AccountStatus>("inactive");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncReport, setSyncReport] = useState<ImportPlan | null>(null);
  const [notice, setNotice] = useState<{ tone: "good" | "bad"; text: string } | null>(null);

  // This page stays mounted when hidden: do not come back to an open dialog.
  useLayoutEffect(() => {
    return () => setEditingId(null);
  }, []);

  if (!actor || !users || !sectionsOf) return null;

  const wanted = query.trim().toLowerCase();
  const visible = users
    .filter(
      (user) =>
        (role === "all" || user.role === role) &&
        (status === "all" || user.status === status) &&
        (wanted === "" ||
          user.name.toLowerCase().includes(wanted) ||
          user.email.toLowerCase().includes(wanted) ||
          (user.sisId ?? "").toLowerCase().includes(wanted)),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  const visibleIds = visible.map((user) => user.id);
  // A selection only ever applies to rows the admin can see.
  const chosen = selected.filter((id) => visibleIds.includes(id));
  const allChosen = visible.length > 0 && chosen.length === visible.length;
  const editing = users.find((user) => user.id === editingId);

  const toggle = (userId: string) =>
    setSelected((current) => (current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId]));

  const applyBulk = async () => {
    try {
      const changed = await setUserStatus(chosen, bulkStatus);
      setSelected([]);
      setNotice({
        tone: "good",
        text:
          changed === 0
            ? `Those accounts were already ${STATUS_LABELS[bulkStatus].toLowerCase()}.`
            : `${changed} ${changed === 1 ? "account" : "accounts"} set to ${STATUS_LABELS[bulkStatus].toLowerCase()}.`,
      });
    } catch (error) {
      setNotice({ tone: "bad", text: messageOf(error) });
    }
  };

  const runSisSync = async () => {
    setSyncing(true);
    setNotice(null);
    try {
      setSyncReport(await syncFromSis());
    } catch (error) {
      setNotice({ tone: "bad", text: `The SIS sync failed: ${messageOf(error)}` });
    } finally {
      setSyncing(false);
    }
  };

  const linkedTo = (user: User) => {
    const items =
      user.role === "parent"
        ? users.filter((candidate) => (user.childIds ?? []).includes(candidate.id)).map((child) => child.name)
        : (sectionsOf[user.id] ?? []);
    if (items.length === 0) return <span className="text-ink-3">—</span>;
    return (
      <>
        {items.slice(0, LISTED).join(", ")}
        {items.length > LISTED ? <span className="text-ink-3"> +{items.length - LISTED} more</span> : null}
      </>
    );
  };

  return (
    <PageContainer>
      <PageHeader
        title="Users"
        description="Every account in the school. Import new people, change roles, and deactivate or archive accounts at term end."
        actions={
          <>
            <Button variant="secondary" onClick={() => void runSisSync()} disabled={syncing}>
              {syncing ? (
                <LoaderCircle aria-hidden className="size-4 animate-spin" />
              ) : (
                <RefreshCw aria-hidden className="size-4" />
              )}
              {syncing ? "Syncing…" : "Sync from SIS"}
            </Button>
            <Button onClick={() => setImporting(true)} disabled={importing}>
              <Upload aria-hidden className="size-4" />
              Import CSV
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-4">
        {importing ? <UserImportPanel onClose={() => setImporting(false)} /> : null}

        {syncReport ? (
          <Card className="p-5">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">SIS sync finished</h2>
                <p className="mt-1 text-sm text-ink-2">
                  New people were created. People who already have an account were left as they are.
                </p>
              </div>
              <span className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => downloadImportReport(syncReport, "sis-sync-report.csv")}>
                  <Download aria-hidden className="size-4" />
                  Download report
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSyncReport(null)}>
                  Dismiss
                </Button>
              </span>
            </div>
            <ImportReport plan={syncReport} saved rowLabel="Record" />
          </Card>
        ) : null}

        <p className="text-xs text-ink-3">
          {sisSync.lastRunAt
            ? `Last SIS sync ${formatDateTime(sisSync.lastRunAt)}: ${sisSync.created} created, ${sisSync.skipped} already existed, ${sisSync.failed} failed.`
            : "The SIS has not been synced yet."}{" "}
          The SIS connection is simulated in this demo.
        </p>

        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
            <div className="relative min-w-0 flex-1 basis-56">
              <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" />
              <label htmlFor="users-search" className="sr-only">
                Search users
              </label>
              <input
                id="users-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name, email or SIS ID"
                className={cn(fieldBaseClass, "h-10 w-full pr-3 pl-9")}
              />
            </div>
            <label htmlFor="users-role" className="sr-only">
              Role
            </label>
            <select
              id="users-role"
              value={role}
              onChange={(event) => setRole(event.target.value as Role | "all")}
              className={fieldClass}
            >
              <option value="all">All roles</option>
              {ROLES.map((option) => (
                <option key={option} value={option}>
                  {ROLE_LABELS[option]}
                </option>
              ))}
            </select>
            <label htmlFor="users-status" className="sr-only">
              Status
            </label>
            <select
              id="users-status"
              value={status}
              onChange={(event) => setStatus(event.target.value as AccountStatus | "all")}
              className={fieldClass}
            >
              <option value="all">All statuses</option>
              {STATUSES.map((option) => (
                <option key={option} value={option}>
                  {STATUS_LABELS[option]}
                </option>
              ))}
            </select>
          </div>

          {chosen.length > 0 ? (
            <div className="flex flex-wrap items-center gap-3 border-b border-line bg-surface-2 px-4 py-2.5 text-sm">
              <span className="font-medium">{chosen.length} selected</span>
              <label htmlFor="users-bulk-status">Set status to</label>
              <select
                id="users-bulk-status"
                value={bulkStatus}
                onChange={(event) => setBulkStatus(event.target.value as AccountStatus)}
                className={cn(fieldBaseClass, "h-8 px-2")}
              >
                {STATUSES.map((option) => (
                  <option key={option} value={option}>
                    {STATUS_LABELS[option]}
                  </option>
                ))}
              </select>
              <Button size="sm" onClick={() => void applyBulk()}>
                Apply
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelected([])}>
                Clear selection
              </Button>
            </div>
          ) : null}

          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[52rem] text-sm">
              <caption className="sr-only">User accounts</caption>
              <thead>
                <tr className="text-left text-xs text-ink-3">
                  <th scope="col" className="w-10 py-2.5 pr-1 pl-4">
                    <input
                      type="checkbox"
                      aria-label="Select all users shown"
                      checked={allChosen}
                      onChange={() => setSelected(allChosen ? [] : visibleIds)}
                      className="size-4 accent-primary"
                    />
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Name</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Role</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Status</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Sections or children</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Last sign-in</th>
                  <th scope="col" className="px-4 py-2.5">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((user) => (
                  <tr key={user.id} className="border-t border-line">
                    <td className="py-2.5 pr-1 pl-4">
                      <input
                        type="checkbox"
                        aria-label={`Select ${user.name}`}
                        checked={chosen.includes(user.id)}
                        onChange={() => toggle(user.id)}
                        className="size-4 accent-primary"
                      />
                    </td>
                    <th scope="row" className="px-3 py-2.5 text-left font-normal">
                      <div className="font-medium">
                        {user.name}
                        {user.id === actor.id ? <span className="font-normal text-ink-3"> (you)</span> : null}
                      </div>
                      <div className="text-xs break-all text-ink-3">{user.email}</div>
                    </th>
                    <td className="px-3 py-2.5 whitespace-nowrap">{ROLE_LABELS[user.role]}</td>
                    <td className="px-3 py-2.5">
                      <Badge tone={STATUS_TONES[user.status]}>{STATUS_LABELS[user.status]}</Badge>
                    </td>
                    <td className="px-3 py-2.5 text-ink-2">{linkedTo(user)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-ink-2 tabular-nums">
                      {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : <span className="text-ink-3">Never</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Button variant="ghost" size="sm" onClick={() => setEditingId(user.id)}>
                        <Pencil aria-hidden className="size-4" />
                        Edit<span className="sr-only"> {user.name}</span>
                      </Button>
                    </td>
                  </tr>
                ))}
                {visible.length === 0 ? (
                  <tr className="border-t border-line">
                    <td colSpan={7} className="px-4 py-8 text-center text-ink-2">
                      No users match these filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-2.5 text-xs text-ink-3">
            <span>
              {visible.length} of {users.length} {users.length === 1 ? "account" : "accounts"}
            </span>
            {/* Always rendered, so screen readers announce the result of a bulk change. */}
            <span
              role={notice?.tone === "bad" ? "alert" : "status"}
              className={cn("text-sm", notice?.tone === "bad" ? "text-bad" : "text-good")}
            >
              {notice?.text}
            </span>
          </div>
        </Card>
      </div>

      {editing ? (
        <UserEditDialog
          user={editing}
          users={users}
          isSelf={editing.id === actor.id}
          onClose={() => setEditingId(null)}
        />
      ) : null}
    </PageContainer>
  );
}
