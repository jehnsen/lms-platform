"use client";

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import {
  Captions,
  CaptionsOff,
  CircleCheck,
  CircleX,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui";
import type { Checkpoint } from "@/lib/types";
import { clamp, cn, formatClock } from "@/lib/utils";

export interface LessonPlayerHandle {
  /** Jump to a point in the video, given as a fraction (0–1) of its length. */
  seekToFraction: (fraction: number) => void;
}

const RATES = [1, 1.25, 1.5, 2, 0.75];

export function LessonPlayer({
  src,
  title,
  transcript,
  checkpoints,
  answered,
  onCheckpointAnswered,
  onProgress,
  onEnded,
  onAskTutor,
  ref,
}: {
  src: string;
  title: string;
  transcript: string[];
  checkpoints: Checkpoint[];
  /** Checkpoints already answered (id -> correct), from the learner store. */
  answered: Record<string, boolean>;
  onCheckpointAnswered: (checkpointId: string, correct: boolean) => void;
  onProgress?: (fraction: number) => void;
  onEnded?: () => void;
  onAskTutor?: (question: string) => void;
  ref?: Ref<LessonPlayerHandle>;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  // Mirrors `active` so timeupdate events fired before the next render don't re-trigger it.
  const activeIdRef = useRef<string | null>(null);

  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [rateIndex, setRateIndex] = useState(0);
  const [captionsOn, setCaptionsOn] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [failed, setFailed] = useState(false);

  const [active, setActive] = useState<Checkpoint | null>(null);
  const [choice, setChoice] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [skipped, setSkipped] = useState<string[]>([]);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === frameRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useImperativeHandle(ref, () => ({
    seekToFraction(fraction) {
      const video = videoRef.current;
      if (!video || !duration) return;
      video.currentTime = clamp(fraction, 0, 1) * duration;
    },
  }));

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video || active) return;
    if (video.paused) void video.play().catch(() => setFailed(true));
    else video.pause();
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    const time = video.currentTime;
    setCurrent(time);
    if (!duration) return;
    onProgress?.(time / duration);

    if (activeIdRef.current) return;
    // Also catches seeking past a checkpoint: the first unanswered one before
    // the playhead always fires, so questions can't be skipped by scrubbing.
    const due = checkpoints.find(
      (checkpoint) =>
        !(checkpoint.id in answered) &&
        !skipped.includes(checkpoint.id) &&
        time >= checkpoint.position * duration,
    );
    if (!due) return;
    activeIdRef.current = due.id;
    video.pause();
    video.currentTime = due.position * duration;
    setActive(due);
    setChoice(null);
    setRevealed(false);
  };

  const closeCheckpoint = (resumeAt?: number) => {
    const video = videoRef.current;
    activeIdRef.current = null;
    setActive(null);
    if (!video) return;
    if (resumeAt !== undefined) video.currentTime = resumeAt;
    void video.play().catch(() => undefined);
  };

  const checkAnswer = () => {
    if (!active || choice === null) return;
    setRevealed(true);
    onCheckpointAnswered(active.id, choice === active.answer);
  };

  const skipCheckpoint = () => {
    if (!active) return;
    setSkipped((previous) => [...previous, active.id]);
    closeCheckpoint();
  };

  /** Start of the section the active checkpoint covers: the previous checkpoint, or the beginning. */
  const sectionStart = () => {
    if (!active) return 0;
    const earlier = checkpoints
      .map((checkpoint) => checkpoint.position)
      .filter((position) => position < active.position);
    return (earlier.length ? Math.max(...earlier) : 0) * duration;
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void frameRef.current?.requestFullscreen?.();
  };

  const cycleRate = () => {
    const next = (rateIndex + 1) % RATES.length;
    setRateIndex(next);
    if (videoRef.current) videoRef.current.playbackRate = RATES[next];
  };

  const retry = () => {
    setFailed(false);
    videoRef.current?.load();
  };

  const cueIndex =
    duration > 0 && transcript.length > 0
      ? Math.min(transcript.length - 1, Math.floor((current / duration) * transcript.length))
      : -1;
  const showCaption = captionsOn && cueIndex >= 0 && (playing || current > 0) && !active && !failed;
  const seekPercent = duration ? (current / duration) * 100 : 0;
  const correct = active !== null && choice === active.answer;

  return (
    <div
      ref={frameRef}
      className={cn(
        "flex flex-col overflow-hidden bg-neutral-950 text-white",
        fullscreen ? "h-full" : "rounded-xl",
      )}
    >
      <div className={cn("relative grid", fullscreen && "min-h-0 flex-1")}>
        <video
          ref={videoRef}
          src={src}
          playsInline
          preload="metadata"
          aria-label={title}
          onClick={togglePlay}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
          onDurationChange={(event) => setDuration(event.currentTarget.duration)}
          onTimeUpdate={handleTimeUpdate}
          onVolumeChange={(event) => setMuted(event.currentTarget.muted)}
          onEnded={onEnded}
          onError={() => setFailed(true)}
          className={cn(
            "col-start-1 row-start-1 w-full self-center bg-black",
            fullscreen ? "h-full object-contain" : "aspect-video",
          )}
        />

        {!playing && current === 0 && !active && !failed ? (
          <button
            type="button"
            onClick={togglePlay}
            aria-label="Play video"
            className="col-start-1 row-start-1 m-auto grid size-16 place-items-center rounded-full bg-white/90 text-neutral-950 transition-transform hover:scale-105"
          >
            <Play aria-hidden className="size-7 translate-x-0.5 fill-current" />
          </button>
        ) : null}

        {showCaption ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center px-4">
            <p className="max-w-2xl rounded-md bg-black/75 px-3 py-1.5 text-center text-sm leading-snug text-balance sm:text-base">
              {transcript[cueIndex]}
            </p>
          </div>
        ) : null}

        {failed ? (
          <div className="col-start-1 row-start-1 z-10 flex flex-col items-center justify-center gap-3 bg-neutral-950 p-6 text-center">
            <p className="font-medium">The video couldn&apos;t be loaded</p>
            <p className="max-w-sm text-sm text-white/70">
              Lessons use a sample clip streamed from an external host. Check your connection and
              try again — the transcript below is still available.
            </p>
            <Button variant="secondary" size="sm" onClick={retry}>
              <RotateCcw aria-hidden className="size-4" />
              Try again
            </Button>
          </div>
        ) : null}

        {active ? (
          <div className="col-start-1 row-start-1 z-10 flex items-center justify-center bg-black/80 p-3 sm:p-6">
            <div
              role="group"
              aria-label="Checkpoint question"
              className="w-full max-w-lg rounded-xl bg-surface p-4 text-ink shadow-xl sm:p-5"
            >
              <div className="mb-2 text-xs font-medium tracking-wide text-primary-ink uppercase">
                Checkpoint
              </div>
              <p className="font-medium text-pretty">{active.prompt}</p>

              <div role="radiogroup" aria-label="Answers" className="mt-3 flex flex-col gap-2">
                {active.options.map((option, index) => {
                  const isChoice = choice === index;
                  const isAnswer = index === active.answer;
                  return (
                    <button
                      key={option}
                      type="button"
                      role="radio"
                      aria-checked={isChoice}
                      disabled={revealed}
                      onClick={() => setChoice(index)}
                      className={cn(
                        "flex items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                        revealed && isAnswer
                          ? "border-good bg-good-soft"
                          : revealed && isChoice
                            ? "border-bad bg-bad-soft"
                            : isChoice
                              ? "border-primary bg-primary-soft"
                              : "border-line hover:border-line-strong",
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "grid size-4 shrink-0 place-items-center rounded-full border",
                          isChoice ? "border-primary" : "border-line-strong",
                        )}
                      >
                        {isChoice ? <span className="size-2 rounded-full bg-primary" /> : null}
                      </span>
                      <span className="flex-1">{option}</span>
                      {revealed && isAnswer ? (
                        <CircleCheck aria-label="Correct answer" className="size-4 shrink-0 text-good" />
                      ) : null}
                      {revealed && isChoice && !isAnswer ? (
                        <CircleX aria-label="Your answer" className="size-4 shrink-0 text-bad" />
                      ) : null}
                    </button>
                  );
                })}
              </div>

              {revealed ? (
                <div className="mt-3" aria-live="polite">
                  <p className={cn("text-sm font-semibold", correct ? "text-good" : "text-bad")}>
                    {correct ? "Correct" : "Not quite"}
                  </p>
                  <p className="mt-1 text-sm text-ink-2">{active.explanation}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => closeCheckpoint()}>
                      Continue
                    </Button>
                    {!correct ? (
                      <Button variant="secondary" size="sm" onClick={() => closeCheckpoint(sectionStart())}>
                        <RotateCcw aria-hidden className="size-4" />
                        Rewatch this part
                      </Button>
                    ) : null}
                    {!correct && onAskTutor ? (
                      <Button
                        variant="spark"
                        size="sm"
                        onClick={() =>
                          onAskTutor(
                            `I'm confused by this checkpoint question: “${active.prompt}” Can you explain the idea simply?`,
                          )
                        }
                      >
                        <Sparkles aria-hidden className="size-4" />
                        Ask the tutor
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" disabled={choice === null} onClick={checkAnswer}>
                    Check answer
                  </Button>
                  <Button variant="ghost" size="sm" onClick={skipCheckpoint}>
                    Skip
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-1 px-3 pt-2 pb-2">
        <div className="relative flex items-center">
          <input
            type="range"
            className="seek w-full"
            min={0}
            max={duration || 1}
            step={0.1}
            value={current}
            disabled={!duration || active !== null}
            aria-label="Seek"
            aria-valuetext={`${formatClock(current)} of ${formatClock(duration)}`}
            style={{ "--seek": `${seekPercent}%` } as React.CSSProperties}
            onChange={(event) => {
              const time = Number(event.target.value);
              if (videoRef.current) videoRef.current.currentTime = time;
              setCurrent(time);
            }}
          />
          {checkpoints.map((checkpoint) => (
            <span
              key={checkpoint.id}
              aria-hidden
              title="Checkpoint question"
              className={cn(
                "pointer-events-none absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-neutral-950",
                checkpoint.id in answered ? "bg-white/50" : "bg-amber-400",
              )}
              style={{ left: `${checkpoint.position * 100}%` }}
            />
          ))}
        </div>

        <div className="flex items-center gap-1">
          <PlayerButton label={playing ? "Pause" : "Play"} onClick={togglePlay} disabled={active !== null}>
            {playing ? <Pause aria-hidden className="size-4 fill-current" /> : <Play aria-hidden className="size-4 fill-current" />}
          </PlayerButton>
          <span className="px-2 text-xs text-white/80 tabular-nums">
            {formatClock(current)} / {formatClock(duration)}
          </span>
          {checkpoints.length > 0 ? (
            <span className="hidden items-center gap-1.5 px-2 text-xs text-white/60 sm:flex">
              <span aria-hidden className="size-2 rounded-full bg-amber-400" />
              {checkpoints.length} {checkpoints.length === 1 ? "checkpoint" : "checkpoints"}
            </span>
          ) : null}
          <div className="flex-1" />
          <button
            type="button"
            onClick={cycleRate}
            aria-label={`Playback speed ${RATES[rateIndex]}×. Change speed`}
            className="h-8 rounded-md px-2 text-xs font-medium text-white/80 tabular-nums hover:bg-white/10 hover:text-white"
          >
            {RATES[rateIndex]}×
          </button>
          <PlayerButton
            label={captionsOn ? "Turn captions off" : "Turn captions on"}
            pressed={captionsOn}
            onClick={() => setCaptionsOn((on) => !on)}
          >
            {captionsOn ? <Captions aria-hidden className="size-4" /> : <CaptionsOff aria-hidden className="size-4" />}
          </PlayerButton>
          <PlayerButton
            label={muted ? "Unmute" : "Mute"}
            onClick={() => {
              if (videoRef.current) videoRef.current.muted = !videoRef.current.muted;
            }}
          >
            {muted ? <VolumeX aria-hidden className="size-4" /> : <Volume2 aria-hidden className="size-4" />}
          </PlayerButton>
          <PlayerButton label={fullscreen ? "Exit full screen" : "Full screen"} onClick={toggleFullscreen}>
            {fullscreen ? <Minimize aria-hidden className="size-4" /> : <Maximize aria-hidden className="size-4" />}
          </PlayerButton>
        </div>
      </div>
    </div>
  );
}

function PlayerButton({
  label,
  pressed,
  className,
  ...props
}: React.ComponentProps<"button"> & { label: string; pressed?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      className={cn(
        "grid size-8 place-items-center rounded-md text-white/80 hover:bg-white/10 hover:text-white disabled:opacity-40",
        className,
      )}
      {...props}
    />
  );
}
