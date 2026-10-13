"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Bell } from "lucide-react";
import {
  markAllNotificationsRead,
  markNotificationRead,
  useMyNotifications,
} from "@/lib/api/notifications";
import { cn, formatDate } from "@/lib/utils";

/**
 * In-app notifications (FR-6.6, in-app channel). The full notification
 * centre and per-channel preferences arrive in Phase 6.
 */
export function NotificationBell({ panelClassName }: { panelClassName: string }) {
  const notifications = useMyNotifications();
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const unread = notifications.filter((notification) => !notification.readAt).length;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={container} className="relative">
      <button
        type="button"
        onClick={() => setOpen((shown) => !shown)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        className="relative grid size-10 place-items-center rounded-lg text-ink-2 hover:bg-surface-2 hover:text-ink"
      >
        <Bell aria-hidden className="size-5" />
        {unread > 0 ? (
          <span
            aria-hidden
            className="absolute top-1.5 right-1.5 grid min-w-4 place-items-center rounded-full bg-bad px-1 text-[10px] leading-4 font-semibold text-surface"
          >
            {unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <section
          id={panelId}
          aria-label="Notifications"
          className={cn(
            "z-50 overflow-hidden rounded-xl border border-line bg-surface shadow-lg",
            panelClassName,
          )}
        >
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <h2 className="text-sm font-semibold">Notifications</h2>
            <button
              type="button"
              disabled={unread === 0}
              onClick={() => void markAllNotificationsRead()}
              className="text-xs font-medium text-primary-ink hover:underline disabled:text-ink-3 disabled:no-underline"
            >
              Mark all as read
            </button>
          </div>
          {notifications.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-ink-2">You&apos;re all caught up.</p>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {notifications.map((notification) => {
                const body = (
                  <>
                    <span className="flex items-start gap-2">
                      <span
                        aria-hidden
                        className={cn(
                          "mt-1.5 size-2 shrink-0 rounded-full",
                          notification.readAt ? "bg-transparent" : "bg-primary",
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">
                          {notification.readAt ? null : <span className="sr-only">Unread: </span>}
                          {notification.title}
                        </span>
                        <span className="block text-sm text-ink-2">{notification.body}</span>
                        <span className="mt-0.5 block text-xs text-ink-3">
                          {formatDate(notification.createdAt)}
                        </span>
                      </span>
                    </span>
                  </>
                );
                const onOpen = () => {
                  void markNotificationRead(notification.id);
                  setOpen(false);
                };
                return (
                  <li key={notification.id} className="border-t border-line first:border-t-0">
                    {notification.href ? (
                      <Link href={notification.href} onClick={onOpen} className="block px-4 py-3 hover:bg-surface-2">
                        {body}
                      </Link>
                    ) : (
                      <button type="button" onClick={onOpen} className="block w-full px-4 py-3 text-left hover:bg-surface-2">
                        {body}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
