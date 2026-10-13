import type { Material } from "@/lib/types";

export const materials: Material[] = [
  {
    id: "mat-1",
    title: "Learning from data — lecture recording",
    kind: "video",
    courseId: "ml-foundations",
    sizeLabel: "184 MB",
    durationLabel: "9:12",
    captions: "ready",
    uploadedAt: "2026-09-21",
  },
  {
    id: "mat-2",
    title: "Gradient descent walkthrough",
    kind: "video",
    courseId: "ml-foundations",
    sizeLabel: "241 MB",
    durationLabel: "14:05",
    captions: "ready",
    uploadedAt: "2026-09-24",
  },
  {
    id: "mat-3",
    title: "Flexbox in ten minutes",
    kind: "video",
    courseId: "web-dev",
    sizeLabel: "132 MB",
    durationLabel: "10:02",
    captions: "none",
    uploadedAt: "2026-09-28",
  },
  {
    id: "mat-4",
    title: "Mitosis narrated animation",
    kind: "video",
    courseId: "cell-biology",
    sizeLabel: "310 MB",
    durationLabel: "13:47",
    captions: "ready",
    uploadedAt: "2026-10-01",
  },
  {
    id: "mat-5",
    title: "Compound interest — audio explainer",
    kind: "audio",
    courseId: "money-skills",
    sizeLabel: "11 MB",
    durationLabel: "8:30",
    captions: "ready",
    uploadedAt: "2026-10-03",
  },
  {
    id: "mat-6",
    title: "CSS specificity cheat sheet",
    kind: "document",
    courseId: "web-dev",
    sizeLabel: "420 KB",
    captions: "none",
    uploadedAt: "2026-10-05",
  },
  {
    id: "mat-7",
    title: "Choosing the right metric — worksheet",
    kind: "document",
    courseId: "ml-foundations",
    sizeLabel: "280 KB",
    captions: "none",
    uploadedAt: "2026-10-07",
  },
];

/** Mock study time for the dashboard. Replace with real activity tracking. */
export const weeklyActivity = [
  { day: "Mon", minutes: 35 },
  { day: "Tue", minutes: 20 },
  { day: "Wed", minutes: 10 },
  { day: "Thu", minutes: 45 },
  { day: "Fri", minutes: 30 },
  { day: "Sat", minutes: 15 },
  { day: "Sun", minutes: 0 },
];

export const studyStreakDays = 6;
