"use client";

import { useLayoutEffect, useRef, useState } from "react";
import {
  AudioLines,
  Captions,
  CirclePlay,
  FileText,
  LoaderCircle,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { AiBadge, Badge, Button, Card, Meter, PageContainer, PageHeader, buttonClass } from "@/components/ui";
import { SAMPLE_VIDEOS, courses, getCourse } from "@/lib/data/courses";
import { materials } from "@/lib/data/people";
import type { Material } from "@/lib/types";
import { cn, formatBytes, formatClock, formatDate } from "@/lib/utils";

interface LibraryItem extends Material {
  status: "uploading" | "processing" | "ready";
  progress?: number;
  /** Object URLs for files added in this session. They don't survive a reload. */
  url?: string;
  captionsUrl?: string;
  /** Captions produced by the placeholder "auto-caption" action. */
  demoCaptions?: boolean;
}

type KindFilter = "all" | Material["kind"];

const KIND_META: Record<Material["kind"], { label: string; icon: typeof CirclePlay }> = {
  video: { label: "Video", icon: CirclePlay },
  audio: { label: "Audio", icon: AudioLines },
  document: { label: "Document", icon: FileText },
};

const FILTERS: Array<{ value: KindFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "video", label: "Video" },
  { value: "audio", label: "Audio" },
  { value: "document", label: "Documents" },
];

const CAPTION_FILE = /\.(vtt|srt)$/i;
const DOCUMENT_FILE = /\.(pdf|pptx?|docx?|txt|md)$/i;

const DEMO_CAPTIONS = `WEBVTT

00:00.000 --> 00:06.000
[Demo captions] Automatic captioning is simulated in this build.

00:06.000 --> 00:14.000
Connect a speech-to-text service to transcribe uploaded audio.

00:14.000 --> 10:00.000
You can also attach your own .vtt or .srt file at any time.
`;

function baseName(filename: string) {
  return filename.replace(/\.[^.]+$/, "").toLowerCase();
}

function kindOf(file: File): Material["kind"] | undefined {
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  if (DOCUMENT_FILE.test(file.name)) return "document";
  return undefined;
}

/** Browsers only play WebVTT, so SubRip files are converted on the way in. */
function toVtt(text: string, filename: string) {
  const clean = text.replace(/\r/g, "").trim();
  if (!/\.srt$/i.test(filename)) return clean.startsWith("WEBVTT") ? clean : `WEBVTT\n\n${clean}`;
  return `WEBVTT\n\n${clean.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2")}`;
}

function vttUrl(vtt: string) {
  return URL.createObjectURL(new Blob([vtt], { type: "text/vtt" }));
}

export function ContentLibrary() {
  const [items, setItems] = useState<LibraryItem[]>(() =>
    materials.map((material) => ({ ...material, status: "ready" })),
  );
  const [courseId, setCourseId] = useState(courses[0].id);
  const [filter, setFilter] = useState<KindFilter>("all");
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);

  const objectUrls = useRef(new Set<string>());
  const uploadCount = useRef(0);

  // This page stays mounted (hidden) after navigating away, so simulated
  // uploads are left to finish. Only the preview is closed, to stop its media.
  useLayoutEffect(() => {
    return () => setPreviewId(null);
  }, []);

  const patch = (id: string, changes: Partial<LibraryItem>) =>
    setItems((previous) => previous.map((item) => (item.id === id ? { ...item, ...changes } : item)));

  const track = (url: string) => {
    objectUrls.current.add(url);
    return url;
  };

  const release = (url: string | undefined) => {
    if (!url || !objectUrls.current.delete(url)) return;
    URL.revokeObjectURL(url);
  };

  /** Stand-in for a real upload: advances a progress bar, then a short "processing" phase. */
  const simulateUpload = (id: string, progress = 0) => {
    const next = Math.min(100, progress + 9);
    if (next < 100) {
      patch(id, { progress: next });
      setTimeout(() => simulateUpload(id, next), 150);
      return;
    }
    patch(id, { progress: 100, status: "processing" });
    setTimeout(() => patch(id, { status: "ready", progress: undefined }), 900);
  };

  const attachCaptions = async (id: string, file: File) => {
    const url = track(vttUrl(toVtt(await file.text(), file.name)));
    patch(id, { captions: "ready", captionsUrl: url, demoCaptions: false });
  };

  const autoCaption = (id: string) => {
    patch(id, { captions: "generating" });
    setTimeout(() => patch(id, { captions: "ready", captionsUrl: track(vttUrl(DEMO_CAPTIONS)), demoCaptions: true }), 2200);
  };

  const addFiles = (files: File[]) => {
    const captionFiles = files.filter((file) => CAPTION_FILE.test(file.name));
    const mediaFiles = files.filter((file) => !CAPTION_FILE.test(file.name));
    const added: LibraryItem[] = [];
    let rejected = 0;

    for (const file of mediaFiles) {
      const kind = kindOf(file);
      if (!kind) {
        rejected += 1;
        continue;
      }
      uploadCount.current += 1;
      const id = `upload-${uploadCount.current}`;
      const url = kind === "document" ? undefined : track(URL.createObjectURL(file));
      added.push({
        id,
        title: file.name.replace(/\.[^.]+$/, ""),
        kind,
        courseId,
        sizeLabel: formatBytes(file.size),
        captions: "none",
        uploadedAt: new Date().toISOString(),
        status: "uploading",
        progress: 0,
        url,
      });

      if (url) {
        // Read the duration from the file itself.
        const probe = document.createElement(kind === "video" ? "video" : "audio");
        probe.preload = "metadata";
        probe.onloadedmetadata = () => patch(id, { durationLabel: formatClock(probe.duration) });
        probe.src = url;
      }
    }

    if (added.length > 0) {
      setItems((previous) => [...added, ...previous]);
      added.forEach((item) => setTimeout(() => simulateUpload(item.id), 150));
    }

    // Pair caption files with media: same file name first, otherwise the newest video.
    let unmatched = 0;
    for (const file of captionFiles) {
      const sameName = added.find((item) => item.title.toLowerCase() === baseName(file.name));
      const fallback =
        added.find((item) => item.kind !== "document") ??
        items.find((item) => item.kind === "video" && item.captions === "none");
      const target = sameName ?? fallback;
      if (target) void attachCaptions(target.id, file);
      else unmatched += 1;
    }

    const problems = [
      rejected > 0 ? `${rejected} ${rejected === 1 ? "file was" : "files were"} skipped (unsupported type)` : null,
      unmatched > 0 ? `${unmatched} caption ${unmatched === 1 ? "file has" : "files have"} no video to attach to` : null,
    ].filter(Boolean);
    setNotice(problems.length ? `${problems.join("; ")}.` : null);
  };

  const remove = (item: LibraryItem) => {
    if (previewId === item.id) setPreviewId(null);
    release(item.url);
    release(item.captionsUrl);
    setItems((previous) => previous.filter((other) => other.id !== item.id));
  };

  const visible = items.filter((item) => filter === "all" || item.kind === filter);
  const preview = items.find((item) => item.id === previewId);
  const captioned = items.filter((item) => item.kind !== "document" && item.captions === "ready").length;
  const media = items.filter((item) => item.kind !== "document").length;

  return (
    <PageContainer>
      <PageHeader
        title="Content library"
        description="Upload videos, audio and documents for your courses. Add captions so every learner can follow along."
      />

      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Upload study materials</h2>
          <div className="flex items-center gap-2 text-sm">
            <label htmlFor="upload-course" className="text-ink-2">
              Add to
            </label>
            <select
              id="upload-course"
              value={courseId}
              onChange={(event) => setCourseId(event.target.value)}
              className="h-9 rounded-lg border border-line-strong bg-surface px-2 text-sm"
            >
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>
          </div>
        </div>

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
            "relative flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors focus-within:border-primary",
            dragging ? "border-primary bg-primary-soft" : "border-line-strong hover:border-primary",
          )}
        >
          <UploadCloud aria-hidden className="size-8 text-ink-3" />
          <span className="font-medium">Drop files here or browse</span>
          <span className="max-w-md text-sm text-ink-2">
            Video, audio, PDF or slides. Include a <code className="font-mono text-xs">.vtt</code> or{" "}
            <code className="font-mono text-xs">.srt</code> file with the same name to attach captions
            automatically.
          </span>
          <input
            type="file"
            multiple
            accept="video/*,audio/*,.pdf,.ppt,.pptx,.doc,.docx,.txt,.md,.vtt,.srt"
            className="sr-only"
            onChange={(event) => {
              addFiles(Array.from(event.target.files ?? []));
              event.target.value = "";
            }}
          />
        </label>

        {notice ? (
          <p role="status" className="mt-3 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
            {notice}
          </p>
        ) : null}
        <p className="mt-3 text-xs text-ink-3">
          Demo mode: files stay in this browser tab and uploads are simulated — nothing is sent to a
          server.
        </p>
      </Card>

      <div className="mt-8 mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1" role="group" aria-label="Filter by type">
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
          {captioned} of {media} video and audio files have captions
        </p>
      </div>

      <Card className="overflow-hidden">
        <ul>
          {visible.map((item) => {
            const meta = KIND_META[item.kind];
            const busy = item.status !== "ready";
            return (
              <li key={item.id} className="flex flex-col gap-3 border-t border-line px-4 py-3.5 first:border-t-0 md:flex-row md:items-center">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-surface-2 text-ink-2">
                    <meta.icon aria-hidden className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{item.title}</div>
                    <div className="text-xs text-ink-3">
                      {[meta.label, item.durationLabel, item.sizeLabel, getCourse(item.courseId)?.title, formatDate(item.uploadedAt)]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                    {busy ? (
                      <div className="mt-2 flex items-center gap-3">
                        <Meter
                          value={item.progress ?? 100}
                          label={`Uploading ${item.title}`}
                          className="max-w-xs flex-1"
                        />
                        <span className="text-xs text-ink-2 tabular-nums">
                          {item.status === "uploading" ? `${item.progress ?? 0}%` : "Processing…"}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 md:justify-end">
                  {item.kind !== "document" ? (
                    <CaptionControls item={item} onAttach={attachCaptions} onAutoCaption={autoCaption} />
                  ) : null}
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busy || item.kind === "document"}
                    onClick={() => setPreviewId(item.id)}
                  >
                    Preview
                  </Button>
                  <button
                    type="button"
                    onClick={() => remove(item)}
                    aria-label={`Remove ${item.title}`}
                    className="grid size-8 place-items-center rounded-lg text-ink-3 hover:bg-surface-2 hover:text-bad"
                  >
                    <Trash2 aria-hidden className="size-4" />
                  </button>
                </div>
              </li>
            );
          })}
          {visible.length === 0 ? (
            <li className="px-4 py-10 text-center text-sm text-ink-2">Nothing here yet.</li>
          ) : null}
        </ul>
      </Card>

      {preview ? <PreviewDialog item={preview} onClose={() => setPreviewId(null)} /> : null}
    </PageContainer>
  );
}

function CaptionControls({
  item,
  onAttach,
  onAutoCaption,
}: {
  item: LibraryItem;
  onAttach: (id: string, file: File) => void;
  onAutoCaption: (id: string) => void;
}) {
  if (item.captions === "generating") {
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
            if (file) onAttach(item.id, file);
            event.target.value = "";
          }}
        />
      </label>
      <Button variant="spark" size="sm" disabled={item.status !== "ready"} onClick={() => onAutoCaption(item.id)}>
        <Sparkles aria-hidden className="size-4" />
        Auto-caption
      </Button>
    </>
  );
}

function PreviewDialog({ item, onClose }: { item: LibraryItem; onClose: () => void }) {
  const isSample = !item.url;
  const source = item.url ?? (item.kind === "video" ? SAMPLE_VIDEOS.sintel : undefined);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Preview: ${item.title}`}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      <button type="button" aria-label="Close preview" onClick={onClose} className="absolute inset-0 bg-black/60" />
      <div className="relative w-full max-w-3xl overflow-hidden rounded-xl border border-line bg-surface shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate font-semibold">{item.title}</h2>
            <p className="text-xs text-ink-3">{getCourse(item.courseId)?.title}</p>
          </div>
          <button
            type="button"
            autoFocus
            onClick={onClose}
            aria-label="Close preview"
            className="grid size-9 shrink-0 place-items-center rounded-lg text-ink-2 hover:bg-surface-2"
          >
            <X aria-hidden className="size-5" />
          </button>
        </div>

        {source && item.kind === "video" ? (
          <video controls playsInline src={source} className="aspect-video w-full bg-black">
            {item.captionsUrl ? (
              <track kind="captions" src={item.captionsUrl} srcLang="en" label="English" default />
            ) : null}
          </video>
        ) : source ? (
          <div className="p-6">
            <audio controls src={source} className="w-full" />
          </div>
        ) : (
          <p className="p-6 text-sm text-ink-2">
            Sample library items have no file attached in this demo. Upload your own to preview it.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3 text-xs text-ink-3">
          {item.captionsUrl ? (
            <span>Captions are on by default — use the player&apos;s CC control to toggle them.</span>
          ) : item.captions === "ready" ? (
            <span>This item&apos;s captions are stored with the original file.</span>
          ) : (
            <span>No caption track attached to this file.</span>
          )}
          {item.demoCaptions ? <AiBadge>Demo captions</AiBadge> : null}
          {isSample && source ? <span>Showing a sample clip in place of the stored file.</span> : null}
        </div>
      </div>
    </div>
  );
}
