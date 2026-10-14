/**
 * Notification rules (FR-6.6, FR-6.7, US-25): which channels a notification
 * goes out on for one person, and which kinds of notification nobody can
 * switch off. No storage and no sending here; the service does both.
 */
import type {
  Notification,
  NotificationCategory,
  NotificationChannel,
  NotificationPolicy,
  NotificationPrefs,
} from "@/lib/types";

export const NOTIFICATION_CHANNELS: NotificationChannel[] = ["in-app", "email", "push"];

export const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  "in-app": "In the app",
  email: "Email",
  push: "Push",
};

export const NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  "announcements",
  "messages",
  "discussions",
  "grades",
  "deadlines",
  "schedule",
  "attendance",
  "system",
];

export const CATEGORY_LABELS: Record<NotificationCategory, { label: string; detail: string }> = {
  announcements: { label: "Announcements", detail: "Notices your teachers post to a course." },
  messages: { label: "Messages", detail: "Direct messages sent to you." },
  discussions: { label: "Discussions", detail: "Replies in forum threads you started, and posts reported to you." },
  grades: { label: "Grades", detail: "Grades and feedback that have been released." },
  deadlines: { label: "Deadlines", detail: "New assignments and work that is due." },
  schedule: { label: "Exams and timetable", detail: "Exams, live classes and cancelled classes." },
  attendance: { label: "Attendance", detail: "Alerts when attendance falls below the school's threshold." },
  system: { label: "Account and school", detail: "Changes to your account and notices from the school office." },
};

/** Q-21: the alerts nobody can switch off until the school says otherwise. */
export const DEFAULT_NOTIFICATION_POLICY: NotificationPolicy = {
  mandatoryCategories: ["schedule", "attendance", "system"],
};

/** A kind of notification nobody has set a preference for goes out on every channel. */
const DEFAULT_ON = true;

type Kind = Pick<Notification, "category" | "mandatory">;

/** True when this notification cannot be switched off: its kind is mandatory, or it is marked so itself. */
export function isMandatory(notification: Kind, policy: NotificationPolicy) {
  return notification.mandatory === true || policy.mandatoryCategories.includes(notification.category);
}

/** Whether one person has a channel switched on for a kind of notification, before mandatory alerts are considered. */
export function wants(prefs: NotificationPrefs | undefined, category: NotificationCategory, channel: NotificationChannel) {
  return prefs?.[category]?.[channel] ?? DEFAULT_ON;
}

/**
 * The channels a notification goes out on for one person. `offered` is what
 * the sender chose (US-22: an announcement goes through the selected
 * channels); left out, every channel is offered. The person's own choices
 * narrow that, except for a mandatory alert, which they cannot narrow.
 */
export function channelsFor(
  notification: Kind,
  prefs: NotificationPrefs | undefined,
  policy: NotificationPolicy,
  offered: NotificationChannel[] = NOTIFICATION_CHANNELS,
): NotificationChannel[] {
  const mandatory = isMandatory(notification, policy);
  return NOTIFICATION_CHANNELS.filter(
    (channel) => offered.includes(channel) && (mandatory || wants(prefs, notification.category, channel)),
  );
}

export interface PrefRow {
  category: NotificationCategory;
  channels: Record<NotificationChannel, boolean>;
  /** Mandatory: every channel is on and cannot be changed. */
  locked: boolean;
}

/** One person's preferences as the settings screen shows them, one row for each kind of notification. */
export function prefRows(prefs: NotificationPrefs | undefined, policy: NotificationPolicy): PrefRow[] {
  return NOTIFICATION_CATEGORIES.map((category) => {
    const locked = policy.mandatoryCategories.includes(category);
    return {
      category,
      locked,
      channels: Object.fromEntries(
        NOTIFICATION_CHANNELS.map((channel) => [channel, locked || wants(prefs, category, channel)]),
      ) as Record<NotificationChannel, boolean>,
    };
  });
}

/**
 * Switches one channel on or off for one kind of notification. A mandatory
 * kind cannot be switched off: the change is refused, with the reason.
 */
export function withPref(
  prefs: NotificationPrefs | undefined,
  category: NotificationCategory,
  channel: NotificationChannel,
  on: boolean,
  policy: NotificationPolicy,
): { prefs: NotificationPrefs } | { problem: string } {
  if (!on && policy.mandatoryCategories.includes(category)) {
    return {
      problem: `${CATEGORY_LABELS[category].label} alerts are required by the school and cannot be switched off.`,
    };
  }
  const current = Object.fromEntries(
    NOTIFICATION_CHANNELS.map((item) => [item, wants(prefs, category, item)]),
  ) as Record<NotificationChannel, boolean>;
  return { prefs: { ...prefs, [category]: { ...current, [channel]: on } } };
}

/** Why this policy cannot be saved. Empty when it can. */
export function notificationPolicyProblems(policy: NotificationPolicy): string[] {
  return policy.mandatoryCategories.every((category) => NOTIFICATION_CATEGORIES.includes(category))
    ? []
    : ["One of the mandatory kinds of notification is not a kind the app sends."];
}

/** What an email for a notification says. One layout for every kind; templates per kind are a backend item (FR-6.6). */
export function emailFor(notification: Pick<Notification, "title" | "body" | "href">, origin: string) {
  return {
    subject: notification.title,
    body: `${notification.body}${notification.href ? `\n\nOpen it: ${origin}${notification.href}` : ""}\n\nYou can change which emails you get under Notifications in the app.`,
  };
}
