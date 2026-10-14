"use client";

/**
 * MOCK password storage for local accounts (FR-1.4). Used by sign-in and by
 * the admin "set password" action; nothing else may read it.
 *
 * NOT A PASSWORD HASH. The digest below only keeps the typed text out of plain
 * sight in localStorage. The backend must store a salted, slow hash (Argon2id
 * or bcrypt) and compare on the server.
 */
import { nowIso } from "@/lib/clock";
import { credentialsRepo } from "./_stores";

/** Accepted for any account that has no password of its own yet. */
export const DEMO_MIN_PASSWORD_LENGTH = 6;

function mockDigest(userId: string, password: string) {
  // FNV-1a, 32 bit, salted with the user id.
  let hash = 0x811c9dc5;
  for (const char of `${userId}:${password}`) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function storeCredential(userId: string, password: string) {
  const credential = { digest: mockDigest(userId, password), setAt: nowIso() };
  credentialsRepo.update((all) => ({ ...all, [userId]: credential }));
}

export function hasCredential(userId: string) {
  return userId in credentialsRepo.get();
}

/**
 * Does this password open this account? An account an admin has set a
 * password for accepts only that password; every other account keeps the demo
 * rule of any password of six or more characters.
 */
export function checkCredential(userId: string, password: string) {
  const credential = credentialsRepo.get()[userId];
  if (!credential) return password.length >= DEMO_MIN_PASSWORD_LENGTH;
  return credential.digest === mockDigest(userId, password);
}
