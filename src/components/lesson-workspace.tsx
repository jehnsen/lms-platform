"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronRight, ListChecks, Sparkles } from "lucide-react";
import { Curriculum } from "@/components/curriculum";
import { LessonPlayer, type LessonPlayerHandle } from "@/components/lesson-player";
import { TutorChat, type TutorChatHandle } from "@/components/tutor-chat";
import { Button, ButtonLink, PageContainer } from "@/components/ui";
import { SAMPLE_VIDEOS, findLesson } from "@/lib/data/courses";
import { learner, useLearner } from "@/lib/store";
import { cn } from "@/lib/utils";

type SidePanel = "tutor" | "content";
type LessonTab = "overview" | "transcript";

export function LessonWorkspace({ courseId, lessonId }: { courseId: string; lessonId: string }) {
  const state = useLearner();
  const playerRef = useRef<LessonPlayerHandle>(null);
  const tutorRef = useRef<TutorChatHandle>(null);
  const [panel, setPanel] = useState<SidePanel>("tutor");
  const [tab, setTab] = useState<LessonTab>("overview");
  const [fraction, setFraction] = useState(0);

  const location = findLesson(courseId, lessonId);
  if (!location) return null;
  const { course, module: courseModule, lesson, index, total, previous, next } = location;

  const complete = state.completedLessons.includes(lesson.id);
  const transcript = lesson.transcript ?? [];
  const isLastInModule = courseModule.lessons[courseModule.lessons.length - 1].id === lesson.id;
  const activeLine =
    transcript.length > 0 ? Math.min(transcript.length - 1, Math.floor(fraction * transcript.length)) : -1;

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
          {lesson.type === "video" && lesson.video ? (
            <LessonPlayer
              key={lesson.id}
              ref={playerRef}
              src={SAMPLE_VIDEOS[lesson.video]}
              poster={lesson.thumbnail}
              title={lesson.title}
              transcript={transcript}
              checkpoints={lesson.checkpoints ?? []}
              answered={state.checkpoints}
              onCheckpointAnswered={learner.recordCheckpoint}
              onProgress={setFraction}
              onEnded={() => learner.setLessonComplete(lesson.id, true)}
              onAskTutor={askTutor}
            />
          ) : null}

          <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm text-ink-3">
                Lesson {index + 1} of {total} · {lesson.type === "video" ? "Video" : "Reading"} ·{" "}
                {lesson.minutes} min
              </p>
              <h1 className="mt-1 text-2xl leading-tight font-semibold tracking-tight text-balance sm:text-3xl">
                {lesson.title}
              </h1>
            </div>
            <Button
              variant={complete ? "secondary" : "primary"}
              aria-pressed={complete}
              onClick={() => learner.setLessonComplete(lesson.id, !complete)}
            >
              <Check aria-hidden className="size-4" />
              {complete ? "Completed" : "Mark as complete"}
            </Button>
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
            <article className="mt-6 max-w-[65ch]">
              <p className="text-lg text-ink-2 text-pretty">{lesson.summary}</p>
              <div className="mt-5 flex flex-col gap-4 leading-relaxed text-pretty">
                {(lesson.body ?? []).map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
              <div className="mt-8">
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
              {isLastInModule && courseModule.quizId ? (
                <ButtonLink variant={next ? "secondary" : "primary"} href={`/quizzes/${courseModule.quizId}`}>
                  <ListChecks aria-hidden className="size-4" />
                  Take the module quiz
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
            <SideTab active={panel === "tutor"} onClick={() => setPanel("tutor")} controls="side-panel-tutor">
              <Sparkles aria-hidden className="size-4 text-spark" />
              AI tutor
            </SideTab>
            <SideTab active={panel === "content"} onClick={() => setPanel("content")} controls="side-panel-content">
              Course content
            </SideTab>
          </div>
          {/* Both panels stay mounted so the conversation survives switching tabs. */}
          <div id="side-panel-tutor" role="tabpanel" className={cn("min-h-0 flex-1", panel === "tutor" ? "flex" : "hidden")}>
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
          <div
            id="side-panel-content"
            role="tabpanel"
            className={cn("min-h-0 flex-1 overflow-y-auto p-3", panel !== "content" && "hidden")}
          >
            <Curriculum course={course} currentLessonId={lesson.id} />
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

function KeyPoints({ points }: { points: string[] }) {
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
