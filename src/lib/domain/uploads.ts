/**
 * US-07, FR-2.3: which files the content library accepts, and how large they
 * may be. The limits are school settings; these are the defaults until the
 * school sets its own (Q-13 in OPEN-QUESTIONS.md). The server must repeat the
 * check: a browser can be made to skip it.
 */
import type { MaterialKind } from "@/lib/types";

export const UPLOAD_FORMATS: Record<MaterialKind, { label: string; extensions: string[] }> = {
  video: { label: "Video", extensions: ["mp4", "webm", "mov", "m4v"] },
  audio: { label: "Audio", extensions: ["mp3", "wav", "m4a", "ogg"] },
  document: { label: "Documents", extensions: ["pdf", "doc", "docx", "txt", "md"] },
  slides: { label: "Slides", extensions: ["ppt", "pptx", "odp", "key"] },
};

export const MATERIAL_KINDS = Object.keys(UPLOAD_FORMATS) as MaterialKind[];

export const DEFAULT_UPLOAD_LIMITS_MB: Record<MaterialKind, number> = {
  video: 500,
  audio: 100,
  document: 50,
  slides: 50,
};

export const UPLOAD_LIMIT_RANGE_MB = { min: 1, max: 5000 } as const;

const BYTES_PER_MB = 1024 * 1024;

function extensionOf(fileName: string) {
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? "" : fileName.slice(dot + 1).toLowerCase();
}

/** The kind of material a file is, or `undefined` when the format is not accepted. */
export function materialKindOf(fileName: string): MaterialKind | undefined {
  const extension = extensionOf(fileName);
  return MATERIAL_KINDS.find((kind) => UPLOAD_FORMATS[kind].extensions.includes(extension));
}

export type UploadCheck = { ok: true; kind: MaterialKind } | { ok: false; reason: string };

/** May this file be uploaded? Says why not when it may not. */
export function checkUpload(
  file: { name: string; size: number },
  limitsMb: Record<MaterialKind, number>,
): UploadCheck {
  const kind = materialKindOf(file.name);
  if (!kind) {
    const extension = extensionOf(file.name);
    return {
      ok: false,
      reason: `${file.name}: ${extension ? `.${extension} files are` : "this file type is"} not supported.`,
    };
  }
  if (file.size === 0) return { ok: false, reason: `${file.name} is empty.` };
  const limit = limitsMb[kind];
  if (file.size > limit * BYTES_PER_MB) {
    const sizeMb = Math.ceil(file.size / BYTES_PER_MB);
    return {
      ok: false,
      reason: `${file.name} is ${sizeMb} MB. The limit for ${UPLOAD_FORMATS[kind].label.toLowerCase()} is ${limit} MB.`,
    };
  }
  return { ok: true, kind };
}

/** The `accept` attribute for a file input that takes every supported format. */
export function acceptedExtensions() {
  return MATERIAL_KINDS.flatMap((kind) => UPLOAD_FORMATS[kind].extensions.map((extension) => `.${extension}`));
}
