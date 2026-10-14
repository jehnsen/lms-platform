"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Check,
  ChevronRight,
  Download,
  ExternalLink,
  ListChecks,
  Sparkles,
} from "lucide-react";
import { Curriculum } from "@/components/curriculum";
import { ForbiddenView } from "@/components/forbidden-view";
import { LessonPlayer, type LessonPlayerHandle } from "@/components/lesson-player";
import { NotFoundView } from "@/components/not-found-view";
import { TutorChat, type TutorChatHandle } from "@/components/tutor-chat";
import { Badge, Button, ButtonLink, PageContainer, PageSkeleton, buttonClass } from "@/components/ui";
import { useCourse, useCourseReadOnly } from "@/lib/api/courses";
import { useLessonMaterial, type StoredFile } from "@/lib/api/materials";
import {
  recordCheckpoint,
  setLessonComplete,
  useCanTrackProgress,
  useMyProgress,
} from "@/lib/api/progress";
import { useActor } from "@/lib/api/session";
import { isScheduled } from "@/lib/domain/content-visibility";
import { LESSON_TYPE_LABELS, locateLesson } from "@/lib/domain/course-outline";
import { embedUrlFor, isWebUrl } from "@/lib/domain/links";
import { can } from "@/lib/domain/permissions";
import { SAMPLE_VIDEOS } from "@/lib/sample-media";
import type { Lesson, Material } from "@/lib/types";
import { useNow } from "@/lib/use-now";
import { cn, formatDateTime } from "@/lib/utils";

type SidePanel = "tutor" | "content";
type LessonTab = "overview" | "transcript";

export function LessonWorkspace({ courseId, lessonId }: { courseId: string; lessonId: string }) {
  const state = useMyProgress();
  const actor = useActor();
  // Staff preview lessons without recording progress; the tutor is a learner tool.
  const tracking = useCanTrackProgress();
  // FR-1.8: a learner can still open an archived course, but nothing new is recorded.
  const readOnly = useCourseReadOnly(courseId);
  const recording = tracking && !readOnly;
  const hasTutor = can(actor, "view", { type: "tutor" });
  // The course as this person may see it: a lesson not released to a student is simply not in it (US-09).
  const access = useCourse(courseId);
  const location = access.status === "ok" ? locateLesson(access.course, lessonId) : undefined;
  const attachment = useLessonMaterial(location?.lesson);
  const now = useNow();
  const [previewAnswers, setPreviewAnswers] = useState<Record<string, boolean>>({});
  const playerRef = useRef<LessonPlayerHandle>(null);
  const tutorRef = useRef<TutorChatHandle>(null);
  const [panel, setPanel] = useState<SidePanel>("tutor");
  const [tab, setTab] = useState<LessonTab>("overview");
  const [fraction, setFraction] = useState(0);

  if (access.status === "loading") return <PageSkeleton />;
  if (access.status === "missing") return <NotFoundView />;
  if (access.status === "forbidden") return <ForbiddenView resource={`course:${courseId}`} what="this course" />;
  if (!location) {
    return (
      <NotFoundView message="This lesson isn't available. It may not be released yet, it may be for another section, or it may have been removed." />
    );
  }
  const { course, module: courseModule, lesson, index, total, previous, next } = location;
  const staff = access.staff;

  // A video lesson plays its uploaded file when it has one, otherwise a sample clip.
  const uploadedVideo =
    attachment.material?.kind === "video" && attachment.file.state === "ready" ? attachment.file.url : undefined;
  const videoSrc =
    lesson.type !== "video" || attachment.file.state === "loading"
      ? undefined
      : (uploadedVideo ?? SAMPLE_VIDEOS[lesson.video ?? "sintel"]);

  const complete = state.completedLessons.includes(lesson.id);
  const transcript = lesson.transcript ?? [];
  const isLastInModule = courseModule.lessons[courseModule.lessons.length - 1].id === lesson.id;
  const activeLine =
    transcript.length > 0 ? Math.min(transcript.length - 1, Math.floor(fraction * transcript.length)) : -1;

  const sidePanel: SidePanel = hasTutor ? panel : "content";

  const answerCheckpoint = (checkpointId: string, correct: boolean) => {
    if (recording) void recordCheckpoint(courseId, checkpointId, correct);
    // Otherwise the answer is kept only for this visit, so the video can continue.
    else setPreviewAnswers((previous) => ({ ...previous, [checkpointId]: correct }));
  };

  const askTutor = (question: string) => {
    setPanel("tutor");
    tutorRef.current?.ask(question);
  };

  return (
    <PageContainer className="max-w-[90rem]">
      <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1 text-sm text-ink-3">
        <Link href="/courses" className="hover:text-ink">
          Courses
        </Link>
        <ChevronRight aria-hidden className="size-3.5" />
        <Link href={`/courses/${course.id}`} className="hover:text-ink">
          {course.title}
        </Link>
        <ChevronRight aria-hidden className="size-3.5" />
        <span className="text-ink-2">{courseModule.title}</span>
      </nav>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="min-w-0">
          {videoSrc ? (
            <LessonPlayer
              key={`${lesson.id}-${videoSrc}`}
              ref={playerRef}
              src={videoSrc}
              poster={lesson.thumbnail}
              title={lesson.title}
              transcript={transcript}
              checkpoints={lesson.checkpoints ?? []}
              answered={
                recording
                  ? state.checkpoints
                  : tracking
                    ? { ...state.checkpoints, ...previewAnswers }
                    : previewAnswers
              }
              onCheckpointAnswered={answerCheckpoint}
              onProgress={setFraction}
              onEnded={recording ? () => void setLessonComplete(courseId, lesson.id, true) : undefined}
              onAskTutor={hasTutor ? askTutor : undefined}
            />
          ) : null}

          <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm text-ink-3">
                Lesson {index + 1} of {total} · {LESSON_TYPE_LABELS[lesson.type]} · {lesson.minutes} min
              </p>
              <h1 className="mt-1 text-2xl leading-tight font-semibold tracking-tight text-balance sm:text-3xl">
                {lesson.title}
              </h1>
              {staff && isScheduled(lesson, now) ? (
                <Badge tone="warn" className="mt-2">
                  <CalendarClock aria-hidden className="size-3" />
                  Hidden from students until {formatDateTime(lesson.releaseAt!)}
                </Badge>
              ) : null}
            </div>
            {recording ? (
              <Button
                variant={complete ? "secondary" : "primary"}
                aria-pressed={complete}
                onClick={() => void setLessonComplete(courseId, lesson.id, !complete)}
              >
                <Check aria-hidden className="size-4" />
                {complete ? "Completed" : "Mark as complete"}
              </Button>
            ) : readOnly ? (
              <Badge className="h-8 px-3">
                {tracking && complete ? "Completed · " : null}Archived course · read-only
              </Badge>
            ) : (
              <Badge className="h-8 px-3">Preview · progress isn&apos;t recorded</Badge>
            )}
          </div>

          {lesson.type === "video" ? (
            <div className="mt-6">
              <div role="tablist" aria-label="Lesson details" className="flex gap-1 border-b border-line">
                {(["overview", "transcript"] as const).map((name) => (
                  <button
                    key={name}
                    type="button"
                    role="tab"
                    id={`lesson-tab-${name}`}
                    aria-selected={tab === name}
                    aria-controls={`lesson-panel-${name}`}
                    onClick={() => setTab(name)}
                    className={cn(
                      "-mb-px border-b-2 px-3 py-2 text-sm font-medium capitalize transition-colors",
                      tab === name
                        ? "border-primary text-ink"
                        : "border-transparent text-ink-2 hover:text-ink",
                    )}
                  >
                    {name}
                  </button>
                ))}
              </div>

              {tab === "overview" ? (
                <div id="lesson-panel-overview" role="tabpanel" aria-labelledby="lesson-tab-overview" className="pt-5">
                  <LessonOverview summary={lesson.summary} keyPoints={lesson.keyPoints} />
                </div>
              ) : (
                <div id="lesson-panel-transcript" role="tabpanel" aria-labelledby="lesson-tab-transcript" className="pt-3">
                  <p className="mb-2 px-2 text-xs text-ink-3">Select a line to jump to that point in the video.</p>
                  <ol className="flex flex-col">
                    {transcript.map((line, lineIndex) => (
                      <li key={line}>
                        <button
                          type="button"
                          onClick={() => playerRef.current?.seekToFraction(lineIndex / transcript.length)}
                          aria-current={lineIndex === activeLine ? "true" : undefined}
                          className={cn(
                            "w-full rounded-lg px-2 py-1.5 text-left text-sm leading-relaxed transition-colors",
                            lineIndex === activeLine
                              ? "bg-primary-soft font-medium"
                              : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                          )}
                        >
                          {line}
                        </button>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          ) : (
            <article className="mt-6">
              {lesson.summary ? <p className="max-w-[65ch] text-lg text-ink-2 text-pretty">{lesson.summary}</p> : null}
              {lesson.type === "link" ? <LinkContent lesson={lesson} /> : null}
              {lesson.type === "document" || lesson.type === "slides" ? (
                <FileContent material={attachment.material} file={attachment.file} />
              ) : null}
              <div className="mt-5 flex max-w-[65ch] flex-col gap-4 leading-relaxed text-pretty">
                {(lesson.body ?? []).map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
              <div className="mt-8 max-w-[65ch]">
                <KeyPoints points={lesson.keyPoints} />
              </div>
            </article>
          )}

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
            {previous ? (
              <ButtonLink variant="secondary" href={`/courses/${course.id}/learn/${previous.id}`}>
                <ArrowLeft aria-hidden className="size-4" />
                Previous
              </ButtonLink>
            ) : (
              <span />
            )}
            <div className="flex flex-wrap gap-2">
              {tracking && isLastInModule && courseModule.quizId ? (
                <ButtonLink variant={next ? "secondary" : "primary"} href={`/quizzes/${courseModule.quizId}`}>
                  <ListChecks aria-hidden className="size-4" />
                  {readOnly ? "See the unit quiz" : "Take the unit quiz"}
                </ButtonLink>
              ) : null}
              {next ? (
                <ButtonLink href={`/courses/${course.id}/learn/${next.id}`}>
                  Next lesson
                  <ArrowRight aria-hidden className="size-4" />
                </ButtonLink>
              ) : (
                <ButtonLink variant="secondary" href={`/courses/${course.id}`}>
                  Back to course
                </ButtonLink>
              )}
            </div>
          </div>
        </div>

        <aside className="flex h-[34rem] flex-col overflow-hidden rounded-xl border border-line bg-surface xl:sticky xl:top-6 xl:h-[calc(100dvh-3rem)]">
          <div role="tablist" aria-label="Lesson tools" className="flex shrink-0 border-b border-line">
            {hasTutor ? (
              <SideTab active={sidePanel === "tutor"} onClick={() => setPanel("tutor")} controls="side-panel-tutor">
                <Sparkles aria-hidden className="size-4 text-spark" />
                AI tutor
              </SideTab>
            ) : null}
            <SideTab active={sidePanel === "content"} onClick={() => setPanel("content")} controls="side-panel-content">
              Course content
            </SideTab>
          </div>
          {/* Both panels stay mounted so the conversation survives switching tabs. */}
          {hasTutor ? (
            <div id="side-panel-tutor" role="tabpanel" className={cn("min-h-0 flex-1", sidePanel === "tutor" ? "flex" : "hidden")}>
              <TutorChat
                key={lesson.id}
                ref={tutorRef}
                className="flex-1"
                context={{
                  courseTitle: course.title,
                  lessonTitle: lesson.title,
                  summary: lesson.summary,
                  keyPoints: lesson.keyPoints,
                  practice: lesson.checkpoints,
                }}
              />
            </div>
          ) : null}
          <div
            id="side-panel-content"
            role="tabpanel"
            className={cn("min-h-0 flex-1 overflow-y-auto p-3", sidePanel !== "content" && "hidden")}
          >
            <Curriculum course={course} currentLessonId={lesson.id} staff={staff} />
          </div>
        </aside>
      </div>
    </PageContainer>
  );
}

function SideTab({
  active,
  controls,
  onClick,
  children,
}: {
  active: boolean;
  controls: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      aria-controls={controls}
      onClick={onClick}
      className={cn(
        "-mb-px flex flex-1 items-center justify-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition-colors",
        active ? "border-primary text-ink" : "border-transparent text-ink-2 hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

/** FR-2.4: an external link. Known video players are embedded; everything else opens in a new tab. */
function LinkContent({ lesson }: { lesson: Lesson }) {
  const url = lesson.url ?? "";
  if (!isWebUrl(url)) return <p className="mt-5 text-sm text-ink-2">This lesson has no link yet.</p>;
  const embed = embedUrlFor(url);
  return (
    <div className="mt-5">
      {embed ? (
        <div className="mb-4 aspect-video overflow-hidden rounded-xl border border-line bg-black">
          <iframe
            src={embed}
            title={lesson.title}
            allow="encrypted-media; picture-in-picture; fullscreen"
            referrerPolicy="strict-origin-when-cross-origin"
            loading="lazy"
            className="size-full"
          />
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <a href={url} target="_blank" rel="noopener noreferrer" className={buttonClass({ variant: embed ? "secondary" : "primary" })}>
          <ExternalLink aria-hidden className="size-4" />
          Open link<span className="sr-only"> (opens in a new tab)</span>
        </a>
        <span className="min-w-0 text-sm break-all text-ink-3">{new URL(url).hostname} · opens in a new tab</span>
      </div>
    </div>
  );
}

/** FR-2.3: a document or slide deck from the content library, shown in the page when the browser can, and always downloadable. */
function FileContent({ material, file }: { material: Material | undefined; file: StoredFile }) {
  if (!material) {
    return <p className="mt-5 text-sm text-ink-2">The file for this lesson is no longer in the content library.</p>;
  }
  if (file.state === "loading") return <p className="mt-5 text-sm text-ink-2">Loading the file…</p>;
  if (file.state !== "ready") {
    return (
      <p className="mt-5 rounded-lg bg-surface-2 p-4 text-sm text-ink-2">
        “{material.title}” is a sample library item with no file behind it in this demo. Upload a file in the
        content library and attach it to this lesson to see it here.
      </p>
    );
  }
  const fileName = material.fileName ?? material.title;
  const isPdf = material.mimeType === "application/pdf" || /\.pdf$/i.test(fileName);
  return (
    <div className="mt-5">
      {isPdf ? (
        <iframe src={file.url} title={material.title} className="mb-4 h-[70vh] w-full rounded-xl border border-line bg-surface" />
      ) : (
        <p className="mb-4 rounded-lg bg-surface-2 p-4 text-sm text-ink-2">
          This kind of file can&apos;t be shown inside the page. Download it to open it on your device.
        </p>
      )}
      <a href={file.url} download={fileName} className={buttonClass({ variant: isPdf ? "secondary" : "primary" })}>
        <Download aria-hidden className="size-4" />
        Download {fileName}
      </a>
      <span className="ml-3 text-sm text-ink-3">{material.sizeLabel}</span>
    </div>
  );
}

function KeyPoints({ points }: { points: string[] }) {
  if (points.length === 0) return null;
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <h2 className="text-sm font-semibold">Key points</h2>
      <ul className="mt-2 flex flex-col gap-2 text-sm text-ink-2">
        {points.map((point) => (
          <li key={point} className="flex gap-2.5">
            <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-primary-ink" />
            <span>{point}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LessonOverview({ summary, keyPoints }: { summary: string; keyPoints: string[] }) {
  return (
    <div className="flex max-w-[65ch] flex-col gap-5">
      <p className="leading-relaxed text-ink-2 text-pretty">{summary}</p>
      <KeyPoints points={keyPoints} />
    </div>
  );
}
