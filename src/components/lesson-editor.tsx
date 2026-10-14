"use client";

import { useState } from "react";
import { Dialog } from "@/components/dialog";
import { Button, fieldBaseClass, fieldClass } from "@/components/ui";
import { LESSON_TYPES, LESSON_TYPE_LABELS } from "@/lib/domain/course-outline";
import type { SectionDraft } from "@/lib/domain/course-rules";
import { isWebUrl } from "@/lib/domain/links";
import { SAMPLE_VIDEO_LABELS } from "@/lib/sample-media";
import type { Lesson, LessonType, Material, VideoKey } from "@/lib/types";
import { cn, fromLocalInput, toLocalInput } from "@/lib/utils";

const TEXTAREA_CLASS = cn(fieldBaseClass, "w-full px-3 py-2 leading-relaxed");
const LABEL_CLASS = "mb-1 block text-sm font-medium";
const HINT_CLASS = "mt-1 text-xs text-ink-3";

const lines = (text: string) =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

/** Keeps only the fields that belong to the lesson's type, so a changed type leaves nothing stale behind. */
function tidy(lesson: Lesson): Lesson {
  const { video, transcript, checkpoints, body, url, materialId, ...common } = lesson;
  switch (lesson.type) {
    case "video":
      return { ...common, video: materialId ? undefined : (video ?? "sintel"), materialId, transcript, checkpoints };
    case "reading":
      return { ...common, body };
    case "link":
      return { ...common, url: url?.trim() };
    case "document":
    case "slides":
      return { ...common, materialId };
  }
}

/**
 * Edit one lesson (US-06, US-07, US-09): what it is, what it shows, when it is
 * released and which sections see it. Changes go into the course draft; they
 * are saved with the course.
 */
export function LessonEditor({
  lesson,
  isNew,
  unitId,
  units,
  sections,
  materials,
  onSave,
  onClose,
}: {
  lesson: Lesson;
  isNew: boolean;
  unitId: string;
  units: Array<{ id: string; title: string }>;
  sections: SectionDraft[];
  materials: Material[];
  onSave: (lesson: Lesson, unitId: string) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(lesson);
  const [toUnitId, setToUnitId] = useState(unitId);
  const [minutes, setMinutes] = useState(String(lesson.minutes));
  const [keyPoints, setKeyPoints] = useState(lesson.keyPoints.join("\n"));
  const [transcript, setTranscript] = useState((lesson.transcript ?? []).join("\n"));
  const [body, setBody] = useState((lesson.body ?? []).join("\n\n"));
  const [problems, setProblems] = useState<string[]>([]);

  const set = (changes: Partial<Lesson>) => setDraft((current) => ({ ...current, ...changes }));
  const fileKind = draft.type === "slides" ? "slides" : "document";
  const files = materials.filter((material) => material.kind === (draft.type === "video" ? "video" : fileKind));
  const limited = draft.sectionIds ?? [];
  const checkpoints = lesson.checkpoints?.length ?? 0;

  const save = () => {
    const next = tidy({
      ...draft,
      title: draft.title.trim(),
      summary: draft.summary.trim(),
      minutes: Number(minutes),
      keyPoints: lines(keyPoints),
      transcript: lines(transcript),
      body: body
        .split(/\n\s*\n/)
        .map((paragraph) => paragraph.replace(/\s*\n\s*/g, " ").trim())
        .filter(Boolean),
      sectionIds: limited.length > 0 ? limited : undefined,
    });
    const found: string[] = [];
    if (!next.title) found.push("Give the lesson a title.");
    if (!Number.isInteger(next.minutes) || next.minutes < 1) found.push("Length must be a whole number of minutes, at least 1.");
    if (next.type === "link" && !isWebUrl(next.url ?? "")) found.push("Enter a link that starts with http:// or https://.");
    if ((next.type === "document" || next.type === "slides") && !next.materialId) {
      found.push("Choose a file from the content library.");
    }
    setProblems(found);
    if (found.length === 0) onSave(next, toUnitId);
  };

  return (
    <Dialog wide title={isNew ? "New lesson" : "Edit lesson"} description="Changes are saved with the course." onClose={onClose}>
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <div>
          <label htmlFor="lesson-title" className={LABEL_CLASS}>
            Title
          </label>
          <input
            id="lesson-title"
            type="text"
            value={draft.title}
            onChange={(event) => set({ title: event.target.value })}
            className={cn(fieldClass, "w-full")}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="lesson-type" className={LABEL_CLASS}>
              Type
            </label>
            <select
              id="lesson-type"
              value={draft.type}
              // A file chosen for one type is not carried to another.
              onChange={(event) => set({ type: event.target.value as LessonType, materialId: undefined })}
              className={cn(fieldClass, "w-full")}
            >
              {LESSON_TYPES.map((type) => (
                <option key={type} value={type}>
                  {LESSON_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="lesson-minutes" className={LABEL_CLASS}>
              Length (minutes)
            </label>
            <input
              id="lesson-minutes"
              type="number"
              inputMode="numeric"
              min={1}
              value={minutes}
              onChange={(event) => setMinutes(event.target.value)}
              className={cn(fieldClass, "w-full")}
            />
          </div>
          <div>
            <label htmlFor="lesson-unit" className={LABEL_CLASS}>
              Unit
            </label>
            <select
              id="lesson-unit"
              value={toUnitId}
              onChange={(event) => setToUnitId(event.target.value)}
              className={cn(fieldClass, "w-full")}
            >
              {units.map((unit, index) => (
                <option key={unit.id} value={unit.id}>
                  {unit.title || `Unit ${index + 1}`}
                </option>
              ))}
            </select>
          </div>
        </div>

        {draft.type === "video" ? (
          <>
            <div>
              <label htmlFor="lesson-video" className={LABEL_CLASS}>
                Video
              </label>
              <select
                id="lesson-video"
                value={draft.materialId ? `file:${draft.materialId}` : `sample:${draft.video ?? "sintel"}`}
                onChange={(event) => {
                  const { value } = event.target;
                  const id = value.slice(value.indexOf(":") + 1);
                  set(value.startsWith("file:") ? { materialId: id } : { materialId: undefined, video: id as VideoKey });
                }}
                className={cn(fieldClass, "w-full")}
              >
                <optgroup label="Sample clips">
                  {(Object.keys(SAMPLE_VIDEO_LABELS) as VideoKey[]).map((key) => (
                    <option key={key} value={`sample:${key}`}>
                      {SAMPLE_VIDEO_LABELS[key]}
                    </option>
                  ))}
                </optgroup>
                {files.length > 0 ? (
                  <optgroup label="From the content library">
                    {files.map((material) => (
                      <option key={material.id} value={`file:${material.id}`}>
                        {material.title}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
              </select>
              {checkpoints > 0 ? (
                <p className={HINT_CLASS}>
                  This lesson has {checkpoints} in-video {checkpoints === 1 ? "question" : "questions"}. They are kept
                  as they are.
                </p>
              ) : null}
            </div>
            <div>
              <label htmlFor="lesson-transcript" className={LABEL_CLASS}>
                Captions and transcript
              </label>
              <textarea
                id="lesson-transcript"
                rows={4}
                value={transcript}
                onChange={(event) => setTranscript(event.target.value)}
                aria-describedby="lesson-transcript-hint"
                className={TEXTAREA_CLASS}
              />
              <p id="lesson-transcript-hint" className={HINT_CLASS}>
                One caption per line. They are spread evenly across the video.
              </p>
            </div>
          </>
        ) : null}

        {draft.type === "link" ? (
          <div>
            <label htmlFor="lesson-url" className={LABEL_CLASS}>
              Link
            </label>
            <input
              id="lesson-url"
              type="url"
              inputMode="url"
              placeholder="https://"
              value={draft.url ?? ""}
              onChange={(event) => set({ url: event.target.value })}
              aria-describedby="lesson-url-hint"
              className={cn(fieldClass, "w-full")}
            />
            <p id="lesson-url-hint" className={HINT_CLASS}>
              YouTube and Vimeo links play inside the lesson. Any other page opens in a new tab.
            </p>
          </div>
        ) : null}

        {draft.type === "document" || draft.type === "slides" ? (
          <div>
            <label htmlFor="lesson-file" className={LABEL_CLASS}>
              File from the content library
            </label>
            <select
              id="lesson-file"
              value={draft.materialId ?? ""}
              onChange={(event) => set({ materialId: event.target.value || undefined })}
              aria-describedby="lesson-file-hint"
              className={cn(fieldClass, "w-full")}
            >
              <option value="">Choose a file</option>
              {files.map((material) => (
                <option key={material.id} value={material.id}>
                  {material.title} ({material.sizeLabel}){material.fileName ? "" : " · sample, no file"}
                </option>
              ))}
            </select>
            <p id="lesson-file-hint" className={HINT_CLASS}>
              {files.length === 0
                ? `The library has no ${fileKind === "slides" ? "slides" : "documents"} yet. Upload one on the Content library page, then come back.`
                : "Students can open or download it from the lesson."}
            </p>
          </div>
        ) : null}

        <div>
          <label htmlFor="lesson-summary" className={LABEL_CLASS}>
            Summary
          </label>
          <textarea
            id="lesson-summary"
            rows={2}
            value={draft.summary}
            onChange={(event) => set({ summary: event.target.value })}
            className={TEXTAREA_CLASS}
          />
        </div>

        {draft.type === "reading" ? (
          <div>
            <label htmlFor="lesson-body" className={LABEL_CLASS}>
              Text
            </label>
            <textarea
              id="lesson-body"
              rows={7}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              aria-describedby="lesson-body-hint"
              className={TEXTAREA_CLASS}
            />
            <p id="lesson-body-hint" className={HINT_CLASS}>
              Leave a blank line between paragraphs.
            </p>
          </div>
        ) : null}

        <div>
          <label htmlFor="lesson-points" className={LABEL_CLASS}>
            Key points
          </label>
          <textarea
            id="lesson-points"
            rows={3}
            value={keyPoints}
            onChange={(event) => setKeyPoints(event.target.value)}
            aria-describedby="lesson-points-hint"
            className={TEXTAREA_CLASS}
          />
          <p id="lesson-points-hint" className={HINT_CLASS}>
            One per line. Optional.
          </p>
        </div>

        <fieldset className="rounded-lg border border-line p-4">
          <legend className="px-1 text-sm font-semibold">Who sees it, and when</legend>
          <div>
            <label htmlFor="lesson-release" className={LABEL_CLASS}>
              Release date and time
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                id="lesson-release"
                type="datetime-local"
                value={toLocalInput(draft.releaseAt)}
                onChange={(event) => set({ releaseAt: fromLocalInput(event.target.value) })}
                aria-describedby="lesson-release-hint"
                className={fieldClass}
              />
              {draft.releaseAt ? (
                <Button variant="ghost" size="sm" onClick={() => set({ releaseAt: undefined })}>
                  Clear
                </Button>
              ) : null}
            </div>
            <p id="lesson-release-hint" className={HINT_CLASS}>
              {draft.releaseAt
                ? "Students cannot see this lesson before then. It appears by itself at that time."
                : "Leave empty to show the lesson to students as soon as the course is saved."}
            </p>
          </div>

          <fieldset className="mt-4">
            <legend className={LABEL_CLASS}>Limit to sections</legend>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {sections.map((section) => (
                <label key={section.id} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={limited.includes(section.id)}
                    onChange={(event) =>
                      set({
                        sectionIds: event.target.checked
                          ? [...limited, section.id]
                          : limited.filter((id) => id !== section.id),
                      })
                    }
                    className="size-4 accent-primary"
                  />
                  {section.name || "Unnamed section"}
                </label>
              ))}
            </div>
            <p className={HINT_CLASS}>
              {limited.length === 0
                ? "No section is ticked, so every section sees this lesson."
                : "Only students enrolled in the ticked sections see this lesson."}
            </p>
          </fieldset>
        </fieldset>

        {problems.length > 0 ? (
          <div role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">
            {problems.map((problem) => (
              <p key={problem}>{problem}</p>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">{isNew ? "Add lesson" : "Done"}</Button>
        </div>
      </form>
    </Dialog>
  );
}
