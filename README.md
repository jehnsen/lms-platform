# 3rdLoopLearning — AI-powered LMS (frontend)

Frontend-first school learning management system built with Next.js 16 (App Router), React 19 and Tailwind CSS 4. There is no backend yet: data lives in the browser behind a service layer, and anything that needs a server is a typed interface with a mock.

The requirements are in [`docs/requirements/`](docs/requirements/):

| Document | What it is |
| --- | --- |
| `BRD.md`, `BA-deliverables.md` | The client's requirements: BR-01 to BR-27, US-01 to US-31, FR-1.1 to FR-8.3, NFR-1 to NFR-8. |
| `TRACEABILITY.md` | One row per FR: status, the files that implement it, and what is missing. |
| `OPEN-QUESTIONS.md` | Decisions the client still has to make, with the default the app uses meanwhile. |
| `BACKEND-BACKLOG.md` | Everything that must be real on a server before go-live. |

## Run it

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
npm run lint
npm test         # unit tests for the rules in src/lib/domain
```

## Roles and demo accounts

Sign in at `/login` by choosing a role; it fills in that role's demo account. Any password of six or more characters works. Once signed in, **Demo: view as** in the sidebar switches role.

| Role | Demo account | Home page shows |
| --- | --- | --- |
| Student | `mike.manabat@example.com` | Where they left off, what is due, their progress. |
| Faculty | `amara.okafor@example.com` | The courses they teach, with class average and submissions. |
| Admin | `priya.nair@example.com` | Account counts and the audit log. |
| Parent | `rosa.manabat@example.com` | Their linked child's grades and progress, read-only. |

Each role sees only its own menu and pages. Opening a page the role may not see shows a "no access" page and writes the attempt to the audit log.

## Features and where they live

| Feature | Route | Roles | Main code |
| --- | --- | --- | --- |
| Sign in (mock) | `/login` | everyone | `src/components/login-form.tsx`, `src/lib/api/session.ts` |
| Home page per role | `/` | all | `src/components/role-home.tsx`, `dashboard-view.tsx` (student), `home-faculty.tsx`, `home-admin.tsx`, `home-parent.tsx` |
| Courses and lessons | `/courses`, `/courses/[courseId]` | student, faculty, admin | `src/components/course-catalog.tsx`, `course-overview.tsx`, `curriculum.tsx` |
| Video lessons with in-video quizzes | `/courses/[courseId]/learn/[lessonId]` | student; faculty and admin preview | `src/components/lesson-player.tsx`, `lesson-workspace.tsx` |
| Graded quizzes | `/quizzes`, `/quizzes/[quizId]` | student | `src/components/quiz-runner.tsx`, `src/lib/grading.ts` |
| Grades | `/grades` | student (own), parent (child) | `src/components/grades-view.tsx` |
| Gradebook | `/gradebook` | faculty (own courses), admin (all, read-only) | `src/components/gradebook-view.tsx`, `src/lib/api/grades.ts` |
| Content library | `/content` | faculty; admin read-only | `src/components/content-library.tsx` |
| Lesson planner (simulated AI) | `/lesson-planner` | faculty | `src/components/lesson-plan-generator.tsx`, `src/lib/mock-ai/lesson-plan.ts` |
| AI tutor (simulated) | `/tutor`, panel beside each lesson | student | `src/components/tutor-chat.tsx`, `src/lib/mock-ai/tutor.ts` |
| Notifications | bell in the sidebar or top bar | all | `src/components/notification-bell.tsx`, `src/lib/api/notifications.ts` |
| No-access page | `/forbidden` | all | `src/components/forbidden-view.tsx` |

Pages behind sign-in live in `src/app/(app)/` and share the sidebar layout; `/login` lives in `src/app/(auth)/` without it.

## How the code is layered

```
src/lib/domain/    Rules with no React and no storage: permissions, page access, session
                   cookie format, contrast maths. Unit-tested. A backend can share them.
src/lib/api/       The service layer and the future backend seam. Hooks for reading,
                   async functions for changing. Every function checks permission first.
src/lib/data/      Seed data loaded into the mock repositories.
src/components/    Screens. They call src/lib/api and never touch storage.
src/proxy.ts       Redirects before a page is served (signed out, or wrong role).
```

**Permissions** are one matrix in `src/lib/domain/permissions.ts` and one function, `can(actor, action, resource)`. The menu, the page guard (`src/components/route-guard.tsx`), `src/proxy.ts` and every service call go through it. Page-level rules are in `src/lib/domain/routes.ts`.

**These checks are not security.** They run in the browser and can be bypassed. The backend must repeat them on every request; see `docs/requirements/BACKEND-BACKLOG.md`.

## What is mocked

- **Sign-in and the session** — accounts are seeded users. Any password of 6+ characters is accepted, and the SSO button signs in the chosen role's demo account. The session is an unsigned cookie (`lms_session`) written by the browser.
- **Permission enforcement** — done in the browser by `can()`, the route guard and `src/proxy.ts`.
- **All data** — users, terms, sections, enrollments, learner progress, lesson plans, notifications and the audit log are kept in `localStorage` by the repositories in `src/lib/api/_stores.ts`, under versioned keys such as `lms:progress:v1`. The admin home page has **Reset demo data**; the student grades page has **Reset demo progress**.
- **The audit log** — written by the browser, editable by the user, capped at 500 events.
- **Notifications** — in-app only. Nothing is emailed or pushed.
- **Course and quiz content** — static files in `src/lib/data/courses.ts` and `quizzes.ts`.
- **Study time and streak on the student dashboard** — fixed sample numbers in `src/lib/data/people.ts`.
- **AI tutor and lesson planner** — template-based, in `src/lib/mock-ai/`. No model is called.
- **Uploads** — files stay in the browser tab; progress and auto-captioning are simulated.
- **Lesson videos** — every video lesson plays one of two sample clips streamed from `media.w3.org` (`SAMPLE_VIDEOS` in `src/lib/data/courses.ts`), so they need an internet connection. Captions come from each lesson's `transcript`.

## Connecting a backend

The service layer is the seam: replace the body of each module in `src/lib/api/` with calls to the real API and the screens do not change.

| Module | Replace with |
| --- | --- |
| `api/session.ts` | Real sign-in, sign-out and current-user endpoints; a server-issued session cookie. `authorize()` stays as a client-side courtesy check. |
| `api/users.ts` | Users and parent–child links. |
| `api/courses.ts` | Courses visible to the caller, rosters, terms. |
| `api/progress.ts` | Lesson completion, quiz attempts, checkpoint answers. |
| `api/grades.ts` | Class gradebook and export logging. |
| `api/notifications.ts` | Notification list and read state. |
| `api/lesson-plans.ts` | Saved lesson plans. |
| `api/audit.ts` | Audit log reads. |
| `api/_repository.ts`, `api/_stores.ts` | Delete: these are the mock database. |

Other single-function seams:

- `streamTutorReply()` in `src/lib/mock-ai/tutor.ts` — a streaming call to your chat endpoint.
- `generateLessonPlan()` in `src/lib/mock-ai/lesson-plan.ts` — return the same `LessonPlan` shape from your API.
- `simulateUpload()` and `autoCaption()` in `src/components/content-library.tsx` — real upload and transcription requests.

The full list of server-side work is in `docs/requirements/BACKEND-BACKLOG.md`.

## Notes for contributors

- **Next.js 16.** Read the guide in `node_modules/next/dist/docs/` before writing routing, layout, caching or auth code (see `AGENTS.md`). Middleware is called Proxy in this version.
- **Cache Components are on.** Dynamic routes read `params` inside `<Suspense>` and declare `generateStaticParams`.
- **Pages render role-specific data in the browser only.** The route guard shows a skeleton until the session is known, so prerendered HTML never contains one role's data.
- **Hidden pages stay mounted.** Next.js keeps recently visited pages alive when you navigate away. Anything that should stop or reset on leaving (media playback, open dialogs, "pending" flags) goes in a `useLayoutEffect` cleanup — see `src/components/lesson-player.tsx`.
- **Changing the signed-in user reloads the page.** Use `reloadTo()` in `src/lib/navigation.ts` for sign-in, sign-out and role switches, so nothing cached for the previous user survives. Use `<Link>` and `useRouter()` everywhere else.
- **Do not delete `.next/dev` while `npm run dev` is running.** The dev server will return errors until it is restarted.
- **Storage versions.** When the shape of a stored value changes, bump the version passed to `createRepository`; the old key is ignored and the store restarts from its seed.
- **Theme and type.** Light and dark follow the system setting. Colours are tokens in `src/app/globals.css`; a unit test checks that every text and surface pair used reaches WCAG AA contrast in both themes. The typeface is Inter, set in `src/app/layout.tsx`.
- Course and lesson photos in `public/thumbnails/` and `public/images/` are from [Unsplash](https://unsplash.com/license).
