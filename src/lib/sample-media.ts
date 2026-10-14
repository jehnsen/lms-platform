import type { VideoKey } from "@/lib/types";

/**
 * Placeholder clips streamed from the W3C media server. A video lesson plays
 * one of these unless it uses a video uploaded to the content library;
 * captions and checkpoints are positioned as fractions of the clip so any
 * video can be swapped in.
 */
export const SAMPLE_VIDEOS: Record<VideoKey, string> = {
  sintel: "https://media.w3.org/2010/05/sintel/trailer.mp4",
  bunny: "https://media.w3.org/2010/05/bunny/trailer.mp4",
};

export const SAMPLE_VIDEO_LABELS: Record<VideoKey, string> = {
  sintel: "Sample clip A",
  bunny: "Sample clip B",
};
