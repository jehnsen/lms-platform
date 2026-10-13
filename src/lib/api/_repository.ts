"use client";

import { useSyncExternalStore } from "react";

/**
 * A mock data store: one JSON value in localStorage under a versioned key,
 * observable through `useSyncExternalStore`. This is the stand-in for a
 * backend table. Only the service modules in this folder may use it;
 * components go through those services.
 *
 * Bump `version` when the stored shape changes: the old key is ignored and
 * the store starts again from its seed.
 */
export interface Repository<T> {
  get(): T;
  getServerSnapshot(): T;
  subscribe(listener: () => void): () => void;
  update(change: (current: T) => T): void;
  reset(): void;
}

const STORAGE_PREFIX = "lms";
const registry: Array<Repository<unknown>> = [];

export function createRepository<T>(
  name: string,
  version: number,
  seed: T,
  /** Builds the first value from data saved by an older version of the app. */
  migrate?: () => T | undefined,
): Repository<T> {
  const key = `${STORAGE_PREFIX}:${name}:v${version}`;
  const listeners = new Set<() => void>();
  let value = seed;
  let hydrated = false;

  const emit = () => listeners.forEach((listener) => listener());

  const persist = () => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage full or blocked: the data still works for this session.
    }
  };

  const hydrate = () => {
    if (hydrated || typeof window === "undefined") return;
    hydrated = true;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) {
        value = JSON.parse(raw) as T;
      } else {
        const migrated = migrate?.();
        if (migrated !== undefined) {
          value = migrated;
          persist();
        }
      }
    } catch {
      // Unreadable storage: keep the seed.
    }
    // Keep other tabs of the same browser in step.
    window.addEventListener("storage", (event) => {
      if (event.key !== key) return;
      try {
        value = event.newValue === null ? seed : (JSON.parse(event.newValue) as T);
        emit();
      } catch {
        // Ignore a value this tab cannot read.
      }
    });
  };

  const repository: Repository<T> = {
    get() {
      hydrate();
      return value;
    },
    getServerSnapshot() {
      return seed;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    update(change) {
      hydrate();
      const next = change(value);
      if (next === value) return;
      value = next;
      persist();
      emit();
    },
    reset() {
      hydrate();
      value = seed;
      try {
        window.localStorage.removeItem(key);
      } catch {
        // Nothing to clear.
      }
      emit();
    },
  };

  registry.push(repository as Repository<unknown>);
  return repository;
}

export function useRepository<T>(repository: Repository<T>): T {
  return useSyncExternalStore(repository.subscribe, repository.get, repository.getServerSnapshot);
}

/** Returns every mock store to its seed. Used by "Reset demo data". */
export function resetAllRepositories() {
  registry.forEach((repository) => repository.reset());
}
