"use client";

/**
 * Notifications (BR-22): one place every other service sends through. It
 * works out the channels for each person (FR-6.7), puts the in-app
 * notification in their list, and hands email and push to the delivery
 * adapters (FR-6.6).
 *
 * Backend seam: `GET /notifications`, `POST /notifications/:id/read`,
 * `GET|PUT /me/notification-preferences`. Sending moves to the server
 * entirely: services there call a notification service that applies the same
 * rules (`src/lib/domain/notifications.ts`) and talks to the mail and push
 * systems with their credentials.
 */
import { useMemo } from "react";
import { mockEmailProvider } from "@/lib/adapters/email";
import { mockPushProvider } from "@/lib/adapters/push";
import { nowIso } from "@/lib/clock";
import { channelsFor, emailFor, isMandatory, prefRows, wants, withPref, type PrefRow } from "@/lib/domain/notifications";
import type {
  DeliveryRecord,
  Notification,
  NotificationCategory,
  NotificationChannel,
  NotificationPolicy,
} from "@/lib/types";
import { useRepository } from "./_repository";
import { deliveriesRepo, notificationPrefsRepo, notificationsRepo, settingsRepo, usersRepo } from "./_stores";
import { authorizeOwn, recordAudit, useActor } from "./session";

const NONE: Notification[] = [];
const NO_DELIVERIES: DeliveryRecord[] = [];
/** The mock delivery log keeps this many entries. */
const DELIVERY_LOG_LIMIT = 300;

/** A preference change the rules do not allow. */
export class NotificationError extends Error {
  constructor(public readonly problems: string[]) {
    super(problems.join(" "));
    this.name = "NotificationError";
  }
}

/** The signed-in user's notifications, newest first. */
export function useMyNotifications(): Notification[] {
  const actor = useActor();
  const all = useRepository(notificationsRepo);
  return useMemo(() => {
    if (!actor) return NONE;
    return all
      .filter((notification) => notification.userId === actor.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [actor, all]);
}

let notificationCounter = 0;
let deliveryCounter = 0;

function logDelivery(record: Omit<DeliveryRecord, "id" | "sentAt">) {
  deliveryCounter += 1;
  const sentAt = nowIso();
  deliveriesRepo.update((all) =>
    [{ ...record, id: `delivery-${Date.parse(sentAt)}-${deliveryCounter}`, sentAt }, ...all].slice(0, DELIVERY_LOG_LIMIT),
  );
}

/**
 * Sends a notification to one person on the channels that apply: those the
 * sender offers (every channel unless `channels` narrows it, as an
 * announcement does), narrowed by the person's own preferences, which a
 * mandatory alert ignores. Called by other services, which have already
 * authorized the action that triggers it. Returns the channels used.
 */
export function notify(
  input: Omit<Notification, "id" | "createdAt" | "readAt">,
  options: { channels?: NotificationChannel[] } = {},
): NotificationChannel[] {
  const policy = settingsRepo.get().notifications;
  const prefs = notificationPrefsRepo.get()[input.userId];
  const channels = channelsFor(input, prefs, policy, options.channels);
  const mandatory = isMandatory(input, policy);
  const createdAt = nowIso();

  if (channels.includes("in-app")) {
    notificationCounter += 1;
    const notification: Notification = {
      ...input,
      mandatory: mandatory || undefined,
      id: `note-${Date.parse(createdAt)}-${notificationCounter}`,
      createdAt,
    };
    notificationsRepo.update((all) => [notification, ...all]);
  }

  const user = usersRepo.get().find((candidate) => candidate.id === input.userId);
  if (channels.includes("email") && user?.email) {
    const origin = typeof window !== "undefined" && window.location ? window.location.origin : "";
    const email = emailFor(input, origin);
    // Sent although the person switched email off for this kind, because it is mandatory.
    const forced = mandatory && !wants(prefs, input.category, "email");
    void mockEmailProvider.send({ to: user.email, ...email }).then(
      () => logDelivery({ userId: input.userId, channel: "email", to: user.email, category: input.category, ...email, mandatory: forced || undefined }),
      () => undefined,
    );
  }
  if (channels.includes("push")) {
    const forced = mandatory && !wants(prefs, input.category, "push");
    void mockPushProvider.send({ userId: input.userId, title: input.title, body: input.body, href: input.href }).then(
      () =>
        logDelivery({
          userId: input.userId,
          channel: "push",
          to: "This person's registered devices",
          category: input.category,
          subject: input.title,
          body: input.body,
          mandatory: forced || undefined,
        }),
      () => undefined,
    );
  }
  return channels;
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const actor = authorizeOwn("update", "notification");
  const readAt = nowIso();
  notificationsRepo.update((all) =>
    all.map((notification) =>
      notification.id === notificationId && notification.userId === actor.id && !notification.readAt
        ? { ...notification, readAt }
        : notification,
    ),
  );
}

export async function markAllNotificationsRead(): Promise<void> {
  const actor = authorizeOwn("update", "notification");
  const readAt = nowIso();
  notificationsRepo.update((all) =>
    all.map((notification) =>
      notification.userId === actor.id && !notification.readAt ? { ...notification, readAt } : notification,
    ),
  );
}

// --- Preferences (US-25, FR-6.7) ---------------------------------------------------------

/** The signed-in user's preferences, one row for each kind of notification. Mandatory kinds are on and locked. */
export function useMyNotificationPrefs(): PrefRow[] {
  const actor = useActor();
  const all = useRepository(notificationPrefsRepo);
  const settings = useRepository(settingsRepo);
  return useMemo(() => prefRows(actor ? all[actor.id] : undefined, settings.notifications), [actor, all, settings]);
}

/** The kinds of notification the school has made mandatory. */
export function useNotificationPolicy(): NotificationPolicy {
  return useRepository(settingsRepo).notifications;
}

/**
 * Switches one channel on or off for one kind of notification, for the
 * signed-in user. Refused for a mandatory kind (US-25).
 */
export async function setNotificationPref(
  category: NotificationCategory,
  channel: NotificationChannel,
  on: boolean,
): Promise<void> {
  const actor = authorizeOwn("update", "notification");
  const result = withPref(notificationPrefsRepo.get()[actor.id], category, channel, on, settingsRepo.get().notifications);
  if ("problem" in result) throw new NotificationError([result.problem]);
  notificationPrefsRepo.update((all) => ({ ...all, [actor.id]: result.prefs }));
  recordAudit({
    action: "notifications.preference",
    resource: `notification-prefs:${actor.id}`,
    outcome: "allowed",
    detail: `${category}, ${channel}: ${on ? "on" : "off"}`,
  });
}

/**
 * MOCK only: the email and push messages the delivery adapters were asked to
 * send to the signed-in user, newest first. A real mail system does not show
 * its outbox in the app; this is how the demo makes delivery visible.
 */
export function useMyDeliveries(): DeliveryRecord[] {
  const actor = useActor();
  const all = useRepository(deliveriesRepo);
  return useMemo(() => (actor ? all.filter((record) => record.userId === actor.id) : NO_DELIVERIES), [actor, all]);
}
