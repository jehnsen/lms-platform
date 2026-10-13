"use client";

/** Saved lesson plans. Backend seam: `GET/POST/DELETE /lesson-plans`. */
import type { LessonPlan } from "@/lib/types";
import { useRepository } from "./_repository";
import { lessonPlansRepo } from "./_stores";
import { authorizeOwn, useActor } from "./session";

const NONE: LessonPlan[] = [];

/** The signed-in faculty member's saved plans, newest first. */
export function useMyLessonPlans(): LessonPlan[] {
  const actor = useActor();
  const all = useRepository(lessonPlansRepo);
  return (actor && all[actor.id]) || NONE;
}

export async function saveLessonPlan(plan: LessonPlan): Promise<void> {
  const actor = authorizeOwn("create", "lesson-plan");
  lessonPlansRepo.update((all) => {
    const others = (all[actor.id] ?? NONE).filter((saved) => saved.id !== plan.id);
    return { ...all, [actor.id]: [plan, ...others] };
  });
}

export async function deleteLessonPlan(planId: string): Promise<void> {
  const actor = authorizeOwn("delete", "lesson-plan");
  lessonPlansRepo.update((all) => ({
    ...all,
    [actor.id]: (all[actor.id] ?? NONE).filter((plan) => plan.id !== planId),
  }));
}
