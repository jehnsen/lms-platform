"use client";

import Link from "next/link";
import { useState } from "react";
import { Lock } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  PageContainer,
  PageHeader,
  PageSkeleton,
  ScrollRegion,
  fieldClass,
} from "@/components/ui";
import {
  NotificationError,
  markAllNotificationsRead,
  markNotificationRead,
  setNotificationPref,
  useMyDeliveries,
  useMyNotificationPrefs,
  useMyNotifications,
} from "@/lib/api/notifications";
import { useActor } from "@/lib/api/session";
import { CATEGORY_LABELS, CHANNEL_LABELS, NOTIFICATION_CATEGORIES, NOTIFICATION_CHANNELS } from "@/lib/domain/notifications";
import type { NotificationCategory, NotificationChannel } from "@/lib/types";
import { cn, formatDateTime } from "@/lib/utils";

/**
 * `/notifications` (US-25): everything the signed-in user has been sent in
 * the app, and how they want to be told about each kind of thing.
 */
export function NotificationCentre() {
  const actor = useActor();
  const notifications = useMyNotifications();
  const [kind, setKind] = useState<NotificationCategory | "all">("all");
  const [unreadOnly, setUnreadOnly] = useState(false);

  if (actor === undefined) return <PageSkeleton />;

  const unread = notifications.filter((notification) => !notification.readAt).length;
  const shown = notifications.filter(
    (notification) => (kind === "all" || notification.category === kind) && (!unreadOnly || !notification.readAt),
  );

  return (
    <PageContainer className="max-w-4xl">
      <PageHeader
        title="Notifications"
        description="What you have been sent, and how you want to be told about each kind of thing."
      />

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
          <h2 className="font-semibold">
            In the app <span className="font-normal text-ink-3">· {unread} unread</span>
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={unreadOnly}
                onChange={(event) => setUnreadOnly(event.target.checked)}
                className="size-4 accent-primary"
              />
              Unread only
            </label>
            <label htmlFor="notification-kind" className="sr-only">
              Kind
            </label>
            <select
              id="notification-kind"
              value={kind}
              onChange={(event) => setKind(event.target.value as NotificationCategory | "all")}
              className={fieldClass}
            >
              <option value="all">All kinds</option>
              {NOTIFICATION_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {CATEGORY_LABELS[category].label}
                </option>
              ))}
            </select>
            <Button variant="secondary" size="sm" disabled={unread === 0} onClick={() => void markAllNotificationsRead()}>
              Mark all as read
            </Button>
          </div>
        </div>
        {shown.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-ink-2">
            {notifications.length === 0 ? "You have no notifications yet." : "Nothing matches."}
          </p>
        ) : (
          <ul>
            {shown.map((notification) => {
              const content = (
                <span className="flex items-start gap-2.5">
                  <span
                    aria-hidden
                    className={cn("mt-1.5 size-2 shrink-0 rounded-full", notification.readAt ? "bg-transparent" : "bg-primary")}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-sm font-medium">
                        {notification.readAt ? null : <span className="sr-only">Unread: </span>}
                        {notification.title}
                      </span>
                      <Badge>{CATEGORY_LABELS[notification.category].label}</Badge>
                      {notification.mandatory ? <Badge tone="warn">Required</Badge> : null}
                    </span>
                    <span className="block text-sm text-ink-2">{notification.body}</span>
                    <span className="mt-0.5 block text-xs text-ink-3">{formatDateTime(notification.createdAt)}</span>
                  </span>
                </span>
              );
              const open = () => void markNotificationRead(notification.id);
              return (
                <li key={notification.id} className="border-t border-line first:border-t-0">
                  {notification.href ? (
                    <Link href={notification.href} onClick={open} className="block px-5 py-3 hover:bg-surface-2">
                      {content}
                    </Link>
                  ) : (
                    <button type="button" onClick={open} className="block w-full px-5 py-3 text-left hover:bg-surface-2">
                      {content}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Preferences />
      <DeliveryLog />
    </PageContainer>
  );
}

/** US-25: email, push and in-app, switched on or off for each kind of notification. Mandatory kinds are locked on. */
function Preferences() {
  const rows = useMyNotificationPrefs();
  const [problem, setProblem] = useState("");
  const [note, setNote] = useState("");

  const change = async (category: NotificationCategory, channel: NotificationChannel, on: boolean) => {
    setProblem("");
    setNote("");
    try {
      await setNotificationPref(category, channel, on);
      setNote(`${CATEGORY_LABELS[category].label}, ${CHANNEL_LABELS[channel].toLowerCase()}: ${on ? "on" : "off"}. Saved.`);
    } catch (error) {
      setProblem(error instanceof NotificationError ? error.problems.join(" ") : "That could not be saved. Try again.");
    }
  };

  return (
    <Card className="mt-6 overflow-hidden">
      <div className="px-5 pt-5 pb-3">
        <h2 className="font-semibold">How you are notified</h2>
        <p className="text-sm text-ink-3">
          Choose email, push and in-app separately for each kind of notification. The school requires some alerts,
          and those cannot be switched off.
        </p>
      </div>
      <ScrollRegion label="How you are notified">
        <table className="w-full min-w-[30rem] text-sm">
          <thead>
            <tr className="text-left text-xs text-ink-3">
              <th scope="col" className="px-5 py-2 font-medium">Kind</th>
              {NOTIFICATION_CHANNELS.map((channel) => (
                <th key={channel} scope="col" className="px-3 py-2 text-center font-medium">
                  {CHANNEL_LABELS[channel]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.category} className="border-t border-line align-top">
                <th scope="row" className="px-5 py-2.5 text-left font-normal">
                  <span className="flex flex-wrap items-center gap-2 font-medium">
                    {CATEGORY_LABELS[row.category].label}
                    {row.locked ? (
                      <Badge tone="warn">
                        <Lock aria-hidden className="size-3" />
                        Required by the school
                      </Badge>
                    ) : null}
                  </span>
                  <span className="block text-xs text-ink-3">{CATEGORY_LABELS[row.category].detail}</span>
                </th>
                {NOTIFICATION_CHANNELS.map((channel) => (
                  <td key={channel} className="px-3 py-2.5 text-center">
                    <input
                      type="checkbox"
                      checked={row.channels[channel]}
                      disabled={row.locked}
                      onChange={(event) => void change(row.category, channel, event.target.checked)}
                      aria-label={`${CHANNEL_LABELS[channel]} for ${CATEGORY_LABELS[row.category].label}${row.locked ? ", required by the school" : ""}`}
                      className="size-4 accent-primary"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollRegion>
      {/* Always rendered, so each change and each refusal is announced (NFR-5). */}
      <p role="status" className="px-5 pt-2 text-sm text-ink-2">
        {note}
      </p>
      <p role="alert" className="px-5 pb-3 text-sm text-bad">
        {problem}
      </p>
    </Card>
  );
}

/** MOCK only: what the email and push adapters were asked to send to this person. */
function DeliveryLog() {
  const deliveries = useMyDeliveries();
  return (
    <Card className="mt-6">
      <details>
        <summary className="cursor-pointer px-5 py-4 font-semibold">
          Email and push sent to you <span className="font-normal text-ink-3">· demo log, {deliveries.length}</span>
        </summary>
        <p className="px-5 pb-3 text-sm text-ink-2">
          Nothing is really emailed or pushed in this demo. This list shows what the mail and push services were
          asked to send, so you can check your choices above.
        </p>
        {deliveries.length === 0 ? (
          <p className="border-t border-line px-5 py-4 text-sm text-ink-2">Nothing has been sent yet.</p>
        ) : (
          <ul>
            {deliveries.slice(0, 30).map((record) => (
              <li key={record.id} className="border-t border-line px-5 py-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="primary">{CHANNEL_LABELS[record.channel]}</Badge>
                  <span className="font-medium">{record.subject}</span>
                  {record.mandatory ? <Badge tone="warn">Sent because it is required</Badge> : null}
                </div>
                <div className="mt-0.5 text-xs text-ink-3">
                  To {record.to} · {formatDateTime(record.sentAt)} · {CATEGORY_LABELS[record.category].label}
                </div>
              </li>
            ))}
          </ul>
        )}
      </details>
    </Card>
  );
}
