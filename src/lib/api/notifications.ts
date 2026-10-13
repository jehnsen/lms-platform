"use client";

/**
 * In-app notifications. Backend seam: `GET /notifications`,
 * `POST /notifications/:id/read`, and a delivery service that also sends
 * email and push (FR-6.6). Preferences and channels arrive in Phase 6.
 */
import { useMemo } from "react";
import { nowIso } from "@/lib/clock";
import type { Notification } from "@/lib/types";
import { useRepository } from "./_repository";
import { notificationsRepo } from "./_stores";
import { authorizeOwn, useActor } from "./session";

const NONE: Notification[] = [];

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

/**
 * Sends an in-app notification to a user. Called by other services (grade
 * release, attendance alerts), which have already authorized the action that
 * triggers it.
 */
export function notify(input: Omit<Notification, "id" | "createdAt" | "readAt">) {
  const createdAt = nowIso();
  notificationCounter += 1;
  const notification: Notification = {
    ...input,
    id: `note-${Date.parse(createdAt)}-${notificationCounter}`,
    createdAt,
  };
  notificationsRepo.update((all) => [notification, ...all]);
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
