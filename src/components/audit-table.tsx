import { Badge } from "@/components/ui";
import { ROLE_LABELS } from "@/lib/domain/permissions";
import type { AuditEvent, User } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

/** Audit events as a table (FR-1.2). Used on the admin home and the audit log page. */
export function AuditTable({
  events,
  users,
  caption,
}: {
  events: AuditEvent[];
  users: User[];
  caption: string;
}) {
  const nameOf = (userId: string | null) => users.find((user) => user.id === userId)?.name ?? "Not signed in";

  return (
    <div className="relative overflow-x-auto">
      <table className="w-full min-w-[44rem] text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="text-left text-xs text-ink-3">
            <th scope="col" className="px-4 py-2.5 font-medium">When</th>
            <th scope="col" className="px-3 py-2.5 font-medium">Who</th>
            <th scope="col" className="px-3 py-2.5 font-medium">Action</th>
            <th scope="col" className="px-3 py-2.5 font-medium">On</th>
            <th scope="col" className="px-3 py-2.5 font-medium">Detail</th>
            <th scope="col" className="px-4 py-2.5 font-medium">Outcome</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.id} className="border-t border-line align-top">
              <td className="px-4 py-2.5 whitespace-nowrap text-ink-2 tabular-nums">{formatDateTime(event.at)}</td>
              <td className="px-3 py-2.5 whitespace-nowrap">
                {nameOf(event.actorId)}
                {event.actorRole ? <span className="text-ink-3"> · {ROLE_LABELS[event.actorRole]}</span> : null}
              </td>
              <td className="px-3 py-2.5 font-mono text-xs">{event.action}</td>
              <td className="px-3 py-2.5 font-mono text-xs break-all text-ink-2">{event.resource}</td>
              <td className="px-3 py-2.5 text-ink-2">{event.detail ?? ""}</td>
              <td className="px-4 py-2.5">
                <Badge tone={event.outcome === "denied" ? "bad" : "good"}>
                  {event.outcome === "denied" ? "Denied" : "Allowed"}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
