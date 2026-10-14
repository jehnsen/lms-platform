"use client";

import { useLayoutEffect, useRef, useState } from "react";
import {
  AudioLines,
  Captions,
  CirclePlay,
  Download,
  FileText,
  LoaderCircle,
  Presentation,
  Sparkles,
  Trash2,
  UploadCloud,
  type LucideIcon,
} from "lucide-react";
import { Dialog } from "@/components/dialog";
import { AiBadge, Badge, Button, Card, Meter, PageContainer, PageHeader, buttonClass, fieldBaseClass } from "@/components/ui";
import { useCourses } from "@/lib/api/courses";
import {
  addMaterial,
  removeMaterial,
  setMaterialCaptions,
  useMaterialFile,
  useMaterialUsage,
  useMaterials,
  useTextUrl,
} from "@/lib/api/materials";
import { useActor } from "@/lib/api/session";
import { useSettings } from "@/lib/api/settings";
import { can } from "@/lib/domain/permissions";
import { MATERIAL_KINDS, UPLOAD_FORMATS, acceptedExtensions, checkUpload } from "@/lib/domain/uploads";
import { SAMPLE_VIDEOS } from "@/lib/sample-media";
import type { Material, MaterialKind } from "@/lib/types";
import { cn, formatClock, formatDate } from "@/lib/utils";

/** A file on its way into the library. */
interface Upload {
  id: string;
  title: string;
  kind: MaterialKind;
  progress: number;
  status: "uploading" | "processing";
}

type KindFilter = "all" | MaterialKind;

const KIND_META: Record<MaterialKind, { label: string; icon: LucideIcon }> = {
  video: { label: "Video", icon: CirclePlay },
  audio: { label: "Audio", icon: AudioLines },
  document: { label: "Document", icon: FileText },
  slides: { label: "Slides", icon: Presentation },
};

const FILTERS: Array<{ value: KindFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "video", label: "Video" },
  { value: "audio", label: "Audio" },
  { value: "document", label: "Documents" },
  { value: "slides", label: "Slides" },
];

const CAPTION_FILE = /\.(vtt|srt)$/i;
const ACCEPT = [...acceptedExtensions(), ".vtt", ".srt"].join(",");

const DEMO_CAPTIONS = `WEBVTT

00:00.000 --> 00:06.000
[Demo captions] Automatic captioning is simulated in this build.

00:06.000 --> 00:14.000
Connect a speech-to-text service to transcribe uploaded audio.

00:14.000 --> 10:00.000
You can also attach your own .vtt or .srt file at any time.
`;

const hasSound = (kind: MaterialKind) => kind === "video" || kind === "audio";

function baseName(filename: string) {
  return filename.replace(/\.[^.]+$/, "").toLowerCase();
}

/** Browsers only play WebVTT, so SubRip files are converted on the way in. */
function toVtt(text: string, filename: string) {
  const clean = text.replace(/\r/g, "").trim();
  if (!/\.srt$/i.test(filename)) return clean.startsWith("WEBVTT") ? clean : `WEBVTT\n\n${clean}`;
  return `WEBVTT\n\n${clean.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2")}`;
}

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/** Reads the running time from a video or audio file, or gives up after a few seconds. */
function readDuration(file: File, kind: MaterialKind): Promise<string | undefined> {
  if (!hasSound(kind)) return Promise.resolve(undefined);
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const probe = document.createElement(kind === "video" ? "video" : "audio");
    const finish = (label?: string) => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      resolve(label);
    };
    const timer = setTimeout(() => finish(), 4000);
    probe.preload = "metadata";
    probe.onloadedmetadata = () => finish(Number.isFinite(probe.duration) ? formatClock(probe.duration) : undefined);
    probe.onerror = () => finish();
    probe.src = url;
  });
}

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Try again.";
}

/**
 * The shared content library (US-07, FR-2.3, FR-2.6). Faculty upload files
 * within the school's size limits; a lesson shows one by picking it in the
 * course builder.
 */
export function ContentLibrary() {
  const materials = useMaterials();
  const usage = useMaterialUsage();
  const courses = useCourses();
  const { uploadLimitsMb } = useSettings();
  const [chosenCourseId, setChosenCourseId] = useState<string | null>(null);
  const [filter, setFilter] = useState<KindFilter>("all");
  const [dragging, setDragging] = useState(false);
  const [notices, setNotices] = useState<string[]>([]);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [captioning, setCaptioning] = useState<string[]>([]);
  // Faculty manage the library; admins can look but not change it (FR-1.1).
  const canEdit = can(useActor(), "create", { type: "content-library" });
  const uploadCount = useRef(0);

  // This page stays mounted (hidden) after navigating away, so uploads are
  // left to finish. Only the preview is closed, to stop its media.
  useLayoutEffect(() => {
    return () => setPreviewId(null);
  }, []);

  if (!materials) return null;

  const open = courses.filter((course) => course.status !== "archived");
  const courseId = open.some((course) => course.id === chosenCourseId) ? chosenCourseId! : open[0]?.id;
  const titleOf = (id: string) => courses.find((course) => course.id === id)?.title;

  const patchUpload = (id: string, changes: Partial<Upload>) =>
    setUploads((current) => current.map((upload) => (upload.id === id ? { ...upload, ...changes } : upload)));

  const report = (messages: string[]) => setNotices((current) => [...current, ...messages]);

  /** MOCK transfer: a progress bar, then the file is stored and listed. A real upload reports real progress. */
  const upload = async (row: Upload, file: File, toCourseId: string, captions: File | undefined) => {
    for (let progress = 9; progress < 100; progress += 9) {
      await wait(150);
      patchUpload(row.id, { progress });
    }
    patchUpload(row.id, { progress: 100, status: "processing" });
    try {
      const material = await addMaterial(file, toCourseId, await readDuration(file, row.kind));
      if (captions) await setMaterialCaptions(material.id, toVtt(await captions.text(), captions.name));
    } catch (error) {
      report([messageOf(error)]);
    } finally {
      setUploads((current) => current.filter((upload) => upload.id !== row.id));
    }
  };

  const addFiles = (files: File[]) => {
    if (!courseId) return;
    const captionFiles = files.filter((file) => CAPTION_FILE.test(file.name));
    const problems: string[] = [];
    const accepted: Array<{ row: Upload; file: File }> = [];

    for (const file of files.filter((candidate) => !CAPTION_FILE.test(candidate.name))) {
      // FR-2.3: format and size are checked before anything is sent.
      const check = checkUpload(file, uploadLimitsMb);
      if (!check.ok) {
        problems.push(check.reason);
        continue;
      }
      uploadCount.current += 1;
      accepted.push({
        file,
        row: {
          id: `upload-${uploadCount.current}`,
          title: file.name.replace(/\.[^.]+$/, ""),
          kind: check.kind,
          progress: 0,
          status: "uploading",
        },
      });
    }

    // Pair caption files with media: same file name first, then the first new video or audio
    // file, then the newest library video without captions.
    const captionsFor = new Map<string, File>();
    for (const captions of captionFiles) {
      const fresh =
        accepted.find(({ row }) => row.title.toLowerCase() === baseName(captions.name) && !captionsFor.has(row.id)) ??
        accepted.find(({ row }) => hasSound(row.kind) && !captionsFor.has(row.id));
      const existing = materials.find((material) => material.kind === "video" && material.captions === "none");
      if (fresh) captionsFor.set(fresh.row.id, captions);
      else if (existing) void attachCaptions(existing.id, captions);
      else problems.push(`${captions.name} has no video or audio file to attach to.`);
    }

    setNotices(problems);
    setUploads((current) => [...accepted.map(({ row }) => row), ...current]);
    for (const { row, file } of accepted) void upload(row, file, courseId, captionsFor.get(row.id));
  };

  const attachCaptions = async (materialId: string, file: File) => {
    try {
      await setMaterialCaptions(materialId, toVtt(await file.text(), file.name));
    } catch (error) {
      report([messageOf(error)]);
    }
  };

  /** MOCK: stands in for a speech-to-text job. */
  const autoCaption = async (materialId: string) => {
    setCaptioning((current) => [...current, materialId]);
    await wait(2200);
    try {
      await setMaterialCaptions(materialId, DEMO_CAPTIONS, true);
    } catch (error) {
      report([messageOf(error)]);
    } finally {
      setCaptioning((current) => current.filter((id) => id !== materialId));
    }
  };

  const remove = async (material: Material) => {
    if (previewId === material.id) setPreviewId(null);
    try {
      await removeMaterial(material.id);
      setNotices([]);
    } catch (error) {
      setNotices([messageOf(error)]);
    }
  };

  const visible = materials.filter((material) => filter === "all" || material.kind === filter);
  const visibleUploads = uploads.filter((row) => filter === "all" || row.kind === filter);
  const preview = materials.find((material) => material.id === previewId);
  const media = materials.filter((material) => hasSound(material.kind));
  const captioned = media.filter((material) => material.captions === "ready").length;

  return (
    <PageContainer>
      <PageHeader
        title="Content library"
        description="Videos, audio, documents and slides shared by all faculty. Upload a file here, then add it to a lesson in the course builder."
      />

      {canEdit ? (
        <Card className="p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold">Upload study materials</h2>
            {courseId ? (
              <div className="flex items-center gap-2 text-sm">
                <label htmlFor="upload-course" className="text-ink-2">
                  Add to
                </label>
                <select
                  id="upload-course"
                  value={courseId}
                  onChange={(event) => setChosenCourseId(event.target.value)}
                  className={cn(fieldBaseClass, "h-9 max-w-56 px-2")}
                >
                  {open.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.title}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>

          {courseId ? (
            <label
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                addFiles(Array.from(event.dataTransfer.files));
              }}
              className={cn(
                "relative flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors focus-within:border-primary",
                dragging ? "border-primary bg-primary-soft" : "border-line-strong hover:border-primary",
              )}
            >
              <UploadCloud aria-hidden className="size-8 text-ink-3" />
              <span className="font-medium">Drop files here or browse</span>
              <span className="max-w-md text-sm text-ink-2">
                Include a <code className="font-mono text-xs">.vtt</code> or{" "}
                <code className="font-mono text-xs">.srt</code> file with the same name to attach captions
                automatically.
              </span>
              <input
                type="file"
                multiple
                accept={ACCEPT}
                aria-describedby="upload-limits"
                className="sr-only"
                onChange={(event) => {
                  addFiles(Array.from(event.target.files ?? []));
                  event.target.value = "";
                }}
              />
            </label>
          ) : (
            <p className="rounded-lg bg-surface-2 p-4 text-sm text-ink-2">
              You need a course in a current term to add materials to. Create one from the Courses page.
            </p>
          )}

          {/* FR-2.3, US-07: the limits are shown before anything is uploaded. */}
          <dl id="upload-limits" className="mt-4 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
            {MATERIAL_KINDS.map((kind) => (
              <div key={kind} className="flex flex-wrap items-baseline justify-between gap-x-3 border-b border-line py-1">
                <dt>
                  <span className="font-medium">{UPLOAD_FORMATS[kind].label}</span>{" "}
                  <span className="text-xs text-ink-3">
                    {UPLOAD_FORMATS[kind].extensions.map((extension) => extension.toUpperCase()).join(", ")}
                  </span>
                </dt>
                <dd className="text-ink-2 tabular-nums">up to {uploadLimitsMb[kind]} MB</dd>
              </div>
            ))}
          </dl>

          {/* Always rendered, so screen readers announce problems when they appear. */}
          <div role="alert" className={notices.length > 0 ? "mt-3 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn" : undefined}>
            {notices.map((notice) => (
              <p key={notice}>{notice}</p>
            ))}
          </div>
          <p className="mt-3 text-xs text-ink-3">
            Demo mode: files are kept in this browser and the transfer is simulated. Nothing is sent to a
            server.
          </p>
        </Card>
      ) : null}

      <div className="mt-8 mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by type">
          {FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={filter === option.value}
              onClick={() => setFilter(option.value)}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                filter === option.value ? "bg-ink text-bg" : "text-ink-2 hover:bg-surface-2",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="text-sm text-ink-2">
          {captioned} of {media.length} video and audio files have captions
        </p>
      </div>

      <Card className="overflow-hidden">
        <ul>
          {visibleUploads.map((row) => {
            const meta = KIND_META[row.kind];
            return (
              <li key={row.id} className="flex items-start gap-3 border-t border-line px-4 py-3.5 first:border-t-0">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-surface-2 text-ink-2">
                  <meta.icon aria-hidden className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{row.title}</div>
                  <div className="mt-2 flex items-center gap-3">
                    <Meter value={row.progress} label={`Uploading ${row.title}`} className="max-w-xs flex-1" />
                    <span className="text-xs text-ink-2 tabular-nums">
                      {row.status === "uploading" ? `${row.progress}%` : "Processing…"}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
          {visible.map((item) => {
            const meta = KIND_META[item.kind];
            const used = usage[item.id] ?? 0;
            return (
              <li key={item.id} className="flex flex-col gap-3 border-t border-line px-4 py-3.5 first:border-t-0 md:flex-row md:items-center">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-surface-2 text-ink-2">
                    <meta.icon aria-hidden className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{item.title}</div>
                    <div className="text-xs text-ink-3">
                      {[
                        meta.label,
                        item.durationLabel,
                        item.sizeLabel,
                        titleOf(item.courseId),
                        formatDate(item.uploadedAt),
                        used > 0 ? `Used in ${used} ${used === 1 ? "lesson" : "lessons"}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 md:justify-end">
                  {hasSound(item.kind) ? (
                    <CaptionControls
                      item={item}
                      canEdit={canEdit}
                      generating={captioning.includes(item.id)}
                      onAttach={(file) => void attachCaptions(item.id, file)}
                      onAutoCaption={() => void autoCaption(item.id)}
                    />
                  ) : null}
                  <Button variant="secondary" size="sm" onClick={() => setPreviewId(item.id)}>
                    Preview<span className="sr-only"> {item.title}</span>
                  </Button>
                  {canEdit ? (
                    <button
                      type="button"
                      onClick={() => void remove(item)}
                      aria-label={`Remove ${item.title}`}
                      className="grid size-8 place-items-center rounded-lg text-ink-3 hover:bg-surface-2 hover:text-bad"
                    >
                      <Trash2 aria-hidden className="size-4" />
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
          {visible.length === 0 && visibleUploads.length === 0 ? (
            <li className="px-4 py-10 text-center text-sm text-ink-2">Nothing here yet.</li>
          ) : null}
        </ul>
      </Card>

      {preview ? (
        <PreviewDialog item={preview} courseTitle={titleOf(preview.courseId)} onClose={() => setPreviewId(null)} />
      ) : null}
    </PageContainer>
  );
}

function CaptionControls({
  item,
  canEdit,
  generating,
  onAttach,
  onAutoCaption,
}: {
  item: Material;
  canEdit: boolean;
  generating: boolean;
  onAttach: (file: File) => void;
  onAutoCaption: () => void;
}) {
  if (generating) {
    return (
      <Badge tone="spark">
        <LoaderCircle aria-hidden className="size-3 animate-spin" />
        Generating captions…
      </Badge>
    );
  }
  if (item.captions === "ready") {
    return (
      <Badge tone="good">
        <Captions aria-hidden className="size-3" />
        {item.demoCaptions ? "Captions (demo)" : "Captions"}
      </Badge>
    );
  }
  if (!canEdit) return <Badge tone="warn">No captions</Badge>;
  return (
    <>
      <Badge tone="warn">No captions</Badge>
      <label className={buttonClass({ variant: "secondary", size: "sm" }, "relative cursor-pointer focus-within:outline-2 focus-within:outline-primary")}>
        Add captions
        <input
          type="file"
          accept=".vtt,.srt"
          className="sr-only"
          aria-label={`Add a caption file to ${item.title}`}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onAttach(file);
            event.target.value = "";
          }}
        />
      </label>
      <Button variant="spark" size="sm" onClick={onAutoCaption}>
        <Sparkles aria-hidden className="size-4" />
        Auto-caption
      </Button>
    </>
  );
}

/** FR-2.4: in-browser preview. Video, audio and PDF play or display; other files download. */
function PreviewDialog({
  item,
  courseTitle,
  onClose,
}: {
  item: Material;
  courseTitle: string | undefined;
  onClose: () => void;
}) {
  const file = useMaterialFile(item);
  const captionsUrl = useTextUrl(item.captionsVtt, "text/vtt");
  const stored = file.state === "ready" ? file.url : undefined;
  // A seeded sample video has no file, so a sample clip stands in for it.
  const source = stored ?? (item.kind === "video" && file.state === "missing" ? SAMPLE_VIDEOS.sintel : undefined);
  const fileName = item.fileName ?? item.title;
  const isPdf = item.mimeType === "application/pdf" || /\.pdf$/i.test(fileName);

  return (
    <Dialog wide title={item.title} description={courseTitle} onClose={onClose}>
      {file.state === "loading" ? (
        <p className="text-sm text-ink-2">Loading the file…</p>
      ) : source && item.kind === "video" ? (
        <video controls playsInline src={source} className="aspect-video w-full rounded-lg bg-black">
          {captionsUrl ? <track kind="captions" src={captionsUrl} srcLang="en" label="English" default /> : null}
        </video>
      ) : source && item.kind === "audio" ? (
        <audio controls src={source} className="w-full" />
      ) : stored ? (
        <div>
          {isPdf ? (
            <iframe src={stored} title={item.title} className="mb-3 h-[60vh] w-full rounded-lg border border-line" />
          ) : (
            <p className="mb-3 text-sm text-ink-2">This kind of file can&apos;t be shown inside the page.</p>
          )}
          <a href={stored} download={fileName} className={buttonClass({ variant: "secondary" })}>
            <Download aria-hidden className="size-4" />
            Download {fileName}
          </a>
        </div>
      ) : (
        <p className="text-sm text-ink-2">
          Sample library items have no file attached in this demo. Upload your own to preview it.
        </p>
      )}

      {hasSound(item.kind) ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3 text-xs text-ink-3">
          {captionsUrl ? (
            <span>Captions are on by default. Use the player&apos;s CC control to turn them off.</span>
          ) : item.captions === "ready" ? (
            <span>This item&apos;s captions are stored with the original file.</span>
          ) : (
            <span>No caption track attached to this file.</span>
          )}
          {item.demoCaptions ? <AiBadge>Demo captions</AiBadge> : null}
          {!stored && source ? <span>Showing a sample clip in place of the stored file.</span> : null}
        </div>
      ) : null}
    </Dialog>
  );
}
