"use client";

/**
 * Content library service (US-07, FR-2.3, FR-2.6): the shared list of study
 * materials and the files behind them.
 *
 * Backend seam: `GET /materials`, `POST /materials` (the upload, with the size
 * and format checked again on the server), `PATCH /materials/:id` (captions),
 * `DELETE /materials/:id`, and `GET /courses/:id/lessons/:lessonId/file` for
 * the file a lesson shows to someone who may open that lesson.
 */
import { useEffect, useMemo, useState } from "react";
import { nowIso } from "@/lib/clock";
import { courseLessons } from "@/lib/domain/course-outline";
import { can } from "@/lib/domain/permissions";
import { checkUpload } from "@/lib/domain/uploads";
import type { Lesson, Material } from "@/lib/types";
import { formatBytes } from "@/lib/utils";
import { useStoredFile, type StoredFile } from "./_file-url";
import { deleteFile, putFile } from "./_files";
import { useRepository } from "./_repository";
import { coursesRepo, materialsRepo, settingsRepo } from "./_stores";
import { authorize, recordAudit, useActor } from "./session";

/** Every library item, newest first. `null` unless the signed-in user may open the library. */
export function useMaterials(): Material[] | null {
  const actor = useActor();
  const materials = useRepository(materialsRepo);
  return useMemo(() => {
    if (!can(actor, "view", { type: "content-library" })) return null;
    return [...materials].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  }, [actor, materials]);
}

/** How many lessons use each library item, by item id. */
export function useMaterialUsage(): Record<string, number> {
  const courses = useRepository(coursesRepo);
  return useMemo(() => {
    const usage: Record<string, number> = {};
    for (const lesson of courses.flatMap(courseLessons)) {
      if (lesson.materialId) usage[lesson.materialId] = (usage[lesson.materialId] ?? 0) + 1;
    }
    return usage;
  }, [courses]);
}

/** An upload the library refuses, with the reason to show. */
export class MaterialError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MaterialError";
  }
}

let uploadCounter = 0;

/**
 * Adds a file to the library. The format and the size limit set by the school
 * are checked here as well as in the form (FR-2.3).
 */
export async function addMaterial(file: File, courseId: string, durationLabel?: string): Promise<Material> {
  authorize("create", { type: "content-library" });
  const check = checkUpload(file, settingsRepo.get().uploadLimitsMb);
  if (!check.ok) throw new MaterialError(check.reason);

  uploadCounter += 1;
  const material: Material = {
    id: `mat-${Date.now().toString(36)}${uploadCounter.toString(36)}`,
    title: file.name.replace(/\.[^.]+$/, ""),
    kind: check.kind,
    courseId,
    sizeLabel: formatBytes(file.size),
    durationLabel,
    captions: "none",
    uploadedAt: nowIso(),
    fileName: file.name,
    mimeType: file.type || undefined,
  };
  try {
    await putFile(material.id, file);
  } catch {
    throw new MaterialError(`${file.name} could not be stored in this browser. It may be out of space.`);
  }
  materialsRepo.update((materials) => [material, ...materials]);
  recordAudit({
    action: "content.upload",
    resource: `material:${material.id}`,
    outcome: "allowed",
    detail: `${file.name}, ${material.sizeLabel}`,
  });
  return material;
}

function patchMaterial(materialId: string, changes: Partial<Material>) {
  materialsRepo.update((materials) =>
    materials.map((material) => (material.id === materialId ? { ...material, ...changes } : material)),
  );
}

/** Attaches a WebVTT caption track to a video or audio item. */
export async function setMaterialCaptions(materialId: string, vtt: string, demo = false): Promise<void> {
  authorize("update", { type: "content-library" });
  patchMaterial(materialId, { captions: "ready", captionsVtt: vtt, demoCaptions: demo });
}

/** Removes an item and its file. Refused while a lesson still uses it. */
export async function removeMaterial(materialId: string): Promise<void> {
  authorize("delete", { type: "content-library" });
  const used = coursesRepo
    .get()
    .flatMap(courseLessons)
    .filter((lesson) => lesson.materialId === materialId).length;
  if (used > 0) {
    throw new MaterialError(
      `This item is used in ${used} ${used === 1 ? "lesson" : "lessons"}. Remove it from ${used === 1 ? "that lesson" : "those lessons"} first.`,
    );
  }
  materialsRepo.update((materials) => materials.filter((material) => material.id !== materialId));
  await deleteFile(materialId).catch(() => undefined);
  recordAudit({ action: "content.delete", resource: `material:${materialId}`, outcome: "allowed" });
}

// --- The files themselves ------------------------------------------------------

export type { StoredFile };

/** The stored file of a library item, for people who may open the library. */
export function useMaterialFile(material: Material | undefined): StoredFile {
  const allowed = can(useActor(), "view", { type: "content-library" });
  const file = useStoredFile(allowed && material?.fileName ? material.id : undefined);
  if (material && allowed && !material.fileName) return { state: "missing" };
  return file;
}

/**
 * The library item a lesson shows, and its file. The lesson must come from
 * `useCourse()`, which only hands out lessons the signed-in user may open, so
 * a student gets the file of a lesson they can see and of nothing else.
 */
export function useLessonMaterial(lesson: Lesson | undefined): { material: Material | undefined; file: StoredFile } {
  const materials = useRepository(materialsRepo);
  const material = lesson?.materialId
    ? materials.find((candidate) => candidate.id === lesson.materialId)
    : undefined;
  const file = useStoredFile(material?.fileName ? material.id : undefined);
  if (!lesson?.materialId) return { material: undefined, file: { state: "none" } };
  if (!material?.fileName) return { material, file: { state: "missing" } };
  return { material, file };
}

/** An object URL for a piece of text, such as a caption track. Revoked when it is no longer shown. */
export function useTextUrl(text: string | undefined, type: string): string | undefined {
  const [made, setMade] = useState<{ text: string; url: string } | null>(null);

  useEffect(() => {
    if (text === undefined) return;
    const url = URL.createObjectURL(new Blob([text], { type }));
    // Deferred, so the state change is not made in the body of the effect.
    const timer = setTimeout(() => setMade({ text, url }));
    return () => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
    };
  }, [text, type]);

  return text !== undefined && made?.text === text ? made.url : undefined;
}
