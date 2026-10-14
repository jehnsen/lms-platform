"use client";

import { useSyncExternalStore } from "react";

const TICK_MS = 30_000;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;
let current = 0;

function read() {
  // Rounded down to the tick, so every reader in one render sees the same value.
  return Math.floor(Date.now() / TICK_MS) * TICK_MS;
}

function subscribe(listener: () => void) {
  // The value goes stale while nobody listens; React re-reads it right after subscribing.
  if (listeners.size === 0) current = read();
  listeners.add(listener);
  timer ??= setInterval(() => {
    const next = read();
    if (next === current) return;
    current = next;
    listeners.forEach((notify) => notify());
  }, 5_000);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== undefined) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

function getSnapshot() {
  current ||= read();
  return current;
}

/**
 * The current time in milliseconds, refreshed about every half minute.
 * Anything that depends on the clock (a lesson's release time, FR-2.7) reads
 * it through this hook, so the screen updates when the moment arrives without
 * a reload. It is 0 on the server, where nothing time-dependent is rendered.
 */
export function useNow(): number {
  return useSyncExternalStore(subscribe, getSnapshot, () => 0);
}
