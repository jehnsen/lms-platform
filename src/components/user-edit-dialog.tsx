"use client";

import { useState } from "react";
import { CircleCheck, CircleX, LoaderCircle, X } from "lucide-react";
import { Dialog } from "@/components/dialog";
import { Button, fieldClass } from "@/components/ui";
import { useSettings } from "@/lib/api/settings";
import {
  linkChild,
  setUserPassword,
  setUserStatus,
  unlinkChild,
  updateUserRole,
} from "@/lib/api/users";
import { passwordRules } from "@/lib/domain/password-policy";
import { ROLES, ROLE_LABELS } from "@/lib/domain/permissions";
import type { AccountStatus, Role, User } from "@/lib/types";
import { cn } from "@/lib/utils";

export const STATUS_LABELS: Record<AccountStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  archived: "Archived",
};

const STATUSES: AccountStatus[] = ["active", "inactive", "archived"];

interface Notice {
  tone: "good" | "bad";
  text: string;
}

function NoticeLine({ notice }: { notice: Notice | null }) {
  // Always rendered, so screen readers announce the text when it arrives.
  return (
    <p
      role={notice?.tone === "bad" ? "alert" : "status"}
      className={cn("text-sm", notice ? (notice.tone === "bad" ? "text-bad" : "text-good") : "sr-only")}
    >
      {notice?.text}
    </p>
  );
}

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Try again.";
}

/** Edit one account: role (US-03), status (US-04), linked children (US-05) and password (FR-1.4). */
export function UserEditDialog({
  user,
  users,
  isSelf,
  onClose,
}: {
  user: User;
  users: User[];
  isSelf: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog title={user.name} description={user.email} onClose={onClose}>
      <div className="flex flex-col gap-6">
        <AccessSection user={user} isSelf={isSelf} />
        {user.role === "parent" ? <ChildrenSection parent={user} users={users} /> : null}
        <PasswordSection user={user} />
      </div>
    </Dialog>
  );
}

function AccessSection({ user, isSelf }: { user: User; isSelf: boolean }) {
  const [role, setRole] = useState<Role>(user.role);
  const [status, setStatus] = useState<AccountStatus>(user.status);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const changed = role !== user.role || status !== user.status;

  const save = async () => {
    setBusy(true);
    setNotice(null);
    try {
      await updateUserRole(user.id, role);
      await setUserStatus([user.id], status);
      setNotice({ tone: "good", text: "Saved. The change is in the audit log." });
    } catch (error) {
      setNotice({ tone: "bad", text: messageOf(error) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="edit-access">
      <h3 id="edit-access" className="text-sm font-semibold">
        Role and status
      </h3>
      <p className="mt-1 text-sm text-ink-2">
        {isSelf
          ? "This is your own account. Another administrator has to change its role or status."
          : "A new role applies the next time this person loads a page. Only active accounts can sign in; nothing is deleted."}
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="edit-role" className="mb-1 block text-sm font-medium">
            Role
          </label>
          <select
            id="edit-role"
            value={role}
            disabled={isSelf || busy}
            onChange={(event) => setRole(event.target.value as Role)}
            className={cn(fieldClass, "w-full")}
          >
            {ROLES.map((option) => (
              <option key={option} value={option}>
                {ROLE_LABELS[option]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="edit-status" className="mb-1 block text-sm font-medium">
            Status
          </label>
          <select
            id="edit-status"
            value={status}
            disabled={isSelf || busy}
            onChange={(event) => setStatus(event.target.value as AccountStatus)}
            className={cn(fieldClass, "w-full")}
          >
            {STATUSES.map((option) => (
              <option key={option} value={option}>
                {STATUS_LABELS[option]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button onClick={() => void save()} disabled={!changed || busy || isSelf}>
          {busy ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : null}
          Save changes
        </Button>
        <NoticeLine notice={notice} />
      </div>
    </section>
  );
}

function ChildrenSection({ parent, users }: { parent: User; users: User[] }) {
  const childIds = parent.childIds ?? [];
  const children = users.filter((user) => childIds.includes(user.id));
  const candidates = users
    .filter((user) => user.role === "student" && user.status === "active" && !childIds.includes(user.id))
    .sort((a, b) => a.name.localeCompare(b.name));
  const [studentId, setStudentId] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);

  const change = async (work: () => Promise<void>, done: string) => {
    try {
      await work();
      setNotice({ tone: "good", text: done });
    } catch (error) {
      setNotice({ tone: "bad", text: messageOf(error) });
    }
  };

  return (
    <section aria-labelledby="edit-children" className="border-t border-line pt-5">
      <h3 id="edit-children" className="text-sm font-semibold">
        Linked children
      </h3>
      <p className="mt-1 text-sm text-ink-2">
        This parent sees these students&apos; grades and progress, read-only, and nobody else&apos;s.
      </p>
      {children.length === 0 ? (
        <p className="mt-3 text-sm text-ink-2">No children are linked yet.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-1.5">
          {children.map((child) => (
            <li key={child.id} className="flex items-center justify-between gap-3 rounded-lg bg-surface-2 py-1.5 pr-1.5 pl-3 text-sm">
              <span className="min-w-0 truncate">
                {child.name}
                {child.status !== "active" ? (
                  <span className="text-ink-3"> · {STATUS_LABELS[child.status]}</span>
                ) : null}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void change(() => unlinkChild(parent.id, child.id), `Unlinked ${child.name}.`)}
              >
                <X aria-hidden className="size-4" />
                Unlink<span className="sr-only"> {child.name}</span>
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1 basis-48">
          <label htmlFor="edit-child" className="mb-1 block text-sm font-medium">
            Add a student
          </label>
          <select
            id="edit-child"
            value={studentId}
            onChange={(event) => setStudentId(event.target.value)}
            className={cn(fieldClass, "w-full")}
          >
            <option value="">Choose a student</option>
            {candidates.map((student) => (
              <option key={student.id} value={student.id}>
                {student.name}
              </option>
            ))}
          </select>
        </div>
        <Button
          variant="secondary"
          disabled={studentId === ""}
          onClick={() => {
            const student = candidates.find((candidate) => candidate.id === studentId);
            setStudentId("");
            void change(() => linkChild(parent.id, studentId), `Linked ${student?.name ?? "the student"}.`);
          }}
        >
          Link
        </Button>
      </div>
      <div className="mt-2">
        <NoticeLine notice={notice} />
      </div>
    </section>
  );
}

function PasswordSection({ user }: { user: User }) {
  const { passwordPolicy } = useSettings();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const rules = passwordRules(password, passwordPolicy);
  const valid = rules.every((rule) => rule.met);

  const save = async () => {
    setBusy(true);
    setNotice(null);
    try {
      await setUserPassword(user.id, password);
      setPassword("");
      setNotice({ tone: "good", text: "Password set. This account now accepts only this password." });
    } catch (error) {
      setNotice({ tone: "bad", text: messageOf(error) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="edit-password" className="border-t border-line pt-5">
      <h3 id="edit-password" className="text-sm font-semibold">
        Password for local sign-in
      </h3>
      <p className="mt-1 text-sm text-ink-2">
        For accounts that do not use the school&apos;s single sign-on. Demo only: do not type a real password.
      </p>
      <form
        className="mt-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (valid) void save();
        }}
      >
        <label htmlFor="edit-new-password" className="mb-1 block text-sm font-medium">
          New password
        </label>
        <input
          id="edit-new-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-describedby="edit-password-rules"
          className={cn(fieldClass, "w-full")}
        />
        <ul id="edit-password-rules" className="mt-2 flex flex-col gap-1 text-sm">
          {rules.map((rule) => (
            <li key={rule.id} className={cn("flex items-center gap-2", rule.met ? "text-good" : "text-ink-2")}>
              {rule.met ? (
                <CircleCheck aria-hidden className="size-4 shrink-0" />
              ) : (
                <CircleX aria-hidden className="size-4 shrink-0" />
              )}
              <span className="sr-only">{rule.met ? "Met: " : "Not met: "}</span>
              {rule.label}
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button type="submit" variant="secondary" disabled={!valid || busy}>
            {busy ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : null}
            Set password
          </Button>
          <NoticeLine notice={notice} />
        </div>
      </form>
    </section>
  );
}
