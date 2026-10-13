"use client";

/** Users service. Backend seam: `GET /users`, `GET /users/:id/children`. */
import { useMemo } from "react";
import { can } from "@/lib/domain/permissions";
import type { User } from "@/lib/types";
import { useRepository } from "./_repository";
import { usersRepo } from "./_stores";
import { useActor } from "./session";

const NO_USERS: User[] = [];

/** Every account. `null` unless the signed-in user may manage users. */
export function useUsers(): User[] | null {
  const actor = useActor();
  const users = useRepository(usersRepo);
  return can(actor, "view", { type: "user" }) ? users : null;
}

/** The students linked to the signed-in parent (US-05). Empty for other roles. */
export function useLinkedChildren(): User[] {
  const actor = useActor();
  const users = useRepository(usersRepo);
  return useMemo(() => {
    if (!actor || actor.childIds.length === 0) return NO_USERS;
    return users.filter((user) => actor.childIds.includes(user.id));
  }, [actor, users]);
}
