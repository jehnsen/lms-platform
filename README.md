# 3rdLoopLearning — AI-powered LMS (frontend)

Frontend-only learning management system built with Next.js 16 (App Router), React 19 and Tailwind CSS 4. There is no backend yet: all content is mock data and the "AI" features are simulated.

## Run it

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
npm run lint
```

## Features and where they live

| Feature | Route | Main code |
| --- | --- | --- |
| Sign in (mock) | `/login` | `src/app/(auth)/login/page.tsx`, `src/components/login-form.tsx` |
| Dashboard | `/` | `src/components/dashboard-view.tsx` |
| Lesson plan generation | `/lesson-planner` | `src/components/lesson-plan-generator.tsx`, `src/lib/mock-ai/lesson-plan.ts` |
| Video upload with captions | `/content` | `src/components/content-library.tsx` |
| Video lessons with in-video quizzes | `/courses/[courseId]/learn/[lessonId]` | `src/components/lesson-player.tsx`, `src/components/lesson-workspace.tsx` |
| Graded quizzes | `/quizzes`, `/quizzes/[quizId]` | `src/components/quiz-runner.tsx`, `src/lib/grading.ts` |
| Grades (learner) and gradebook (instructor) | `/grades`, `/gradebook` | `src/components/grades-view.tsx`, `src/components/gradebook-view.tsx` |
| AI tutor | `/tutor` and the panel beside every lesson | `src/components/tutor-chat.tsx`, `src/lib/mock-ai/tutor.ts` |

Pages behind sign-in live in `src/app/(app)/` and share the sidebar layout; `/login` lives in `src/app/(auth)/` without it.

## What is mocked

- **Sign-in** — any well-formed email and a password of 6+ characters is accepted, and no session is stored. Pages are not protected: every route can be opened without signing in. Replace `signIn()` in `src/components/login-form.tsx` and add route protection when a backend exists.
- **Study time and streak on the dashboard** — fixed sample numbers in `src/lib/data/people.ts`.
- **Course, quiz and class data** — `src/lib/data/`. Edit these files to change content.
- **Learner progress** (completed lessons, quiz attempts, checkpoint answers, saved plans) — kept in `localStorage` by `src/lib/store.ts`. "Reset demo progress" on the grades page clears it.
- **AI tutor and lesson planner** — template-based, in `src/lib/mock-ai/`. No model is called.
- **Uploads** — files stay in the browser tab; progress and auto-captioning are simulated.
- **Lesson videos** — every video lesson plays one of two sample clips streamed from `media.w3.org` (`SAMPLE_VIDEOS` in `src/lib/data/courses.ts`), so they need an internet connection. Captions come from each lesson's `transcript`.

## Connecting a backend

Each mock sits behind one function or module, so the UI does not need to change:

- `streamTutorReply()` in `src/lib/mock-ai/tutor.ts` — replace the body with a streaming call to your chat endpoint.
- `generateLessonPlan()` in `src/lib/mock-ai/lesson-plan.ts` — return the same `LessonPlan` shape from your API.
- `src/lib/store.ts` — replace the `localStorage` read/write with API calls.
- `simulateUpload()` and `autoCaption()` in `src/components/content-library.tsx` — replace with real upload and transcription requests.

## Notes

- This Next.js version enables Cache Components. Dynamic routes read `params` inside `<Suspense>` and declare `generateStaticParams`; follow the same pattern for new dynamic routes (see `AGENTS.md`).
- Next.js keeps recently visited pages mounted but hidden when you navigate away, so component state survives navigation. Anything that should stop or reset on leaving a page (media playback, open dialogs, "pending" flags) must do so in a `useLayoutEffect` cleanup — see `src/components/lesson-player.tsx`.
- Light and dark themes follow the system setting. Colours are defined once as tokens in `src/app/globals.css`. The typeface is Inter, set in `src/app/layout.tsx`.
- Course and lesson photos in `public/thumbnails/` and `public/images/` are from [Unsplash](https://unsplash.com/license). Each lesson's `thumbnail` field in `src/lib/data/courses.ts` points at its file.
