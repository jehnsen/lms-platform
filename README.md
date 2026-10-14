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

Sign in at `/login` by choosing a role; it fills in that role's demo account. Then either press **Sign in** (any password of six or more characters works, unless an admin has set a password for that account) or **Continue with school account (SSO)**. The admin account asks for a second step: the demo code is `246810`. Once signed in, **Demo: view as** in the sidebar switches role without signing in again.

| Role | Demo account | Home page shows |
| --- | --- | --- |
| Student | `mike.manabat@example.com` | Where they left off, what is due, their progress. |
| Faculty | `amara.okafor@example.com` | The courses they teach, with class average and submissions. |
| Admin | `priya.nair@example.com` | Account counts, recent audit events, and links to users and terms. |
| Parent | `rosa.manabat@example.com` | Their linked child's grades and progress, read-only. Parents are not in the mock school directory, so SSO refuses them; use the password. |

Each role sees only its own menu and pages. Opening a page the role may not see shows a "no access" page and writes the attempt to the audit log.

## Features and where they live

| Feature | Route | Roles | Main code |
| --- | --- | --- | --- |
| Sign in (mock): SSO, local password, second step for admins | `/login` | everyone | `src/components/login-form.tsx`, `src/lib/api/session.ts`, `src/lib/adapters/identity-provider.ts` |
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
| Users: CSV import, SIS sync, roles, statuses, parent–child links, passwords | `/admin/users` | admin | `src/components/admin-users.tsx`, `user-import.tsx`, `user-edit-dialog.tsx`, `src/lib/api/users.ts`, `src/lib/domain/user-import.ts` |
| Terms: term-end archive | `/admin/terms` | admin | `src/components/admin-terms.tsx`, `src/lib/api/courses.ts`, `src/lib/domain/terms.ts` |
| School settings: password policy, data retention | `/admin/settings` | admin | `src/components/admin-settings.tsx`, `src/lib/api/settings.ts`, `src/lib/domain/settings.ts` |
| Audit log | `/admin/audit` | admin | `src/components/admin-audit.tsx`, `audit-table.tsx`, `src/lib/api/audit.ts` |
| No-access page | `/forbidden` | all | `src/components/forbidden-view.tsx` |

Pages behind sign-in live in `src/app/(app)/` and share the sidebar layout; `/login` lives in `src/app/(auth)/` without it.

**Importing users.** On `/admin/users`, **Import CSV** takes a file with the columns `name`, `email`, `role`, `sections`, `sis_id` and `children` (download the template from the same panel). The file is checked first: you see how many rows are ready, which are duplicates and which have errors, and nothing is saved until you confirm. Rows with errors are skipped and can be downloaded as a report; the valid rows are still created.

**Archiving a term.** On `/admin/terms`, archiving a term makes every course in it read-only for all roles: no quiz attempts, no progress, no edits. Grades stay viewable and gradebooks can still be exported. A term can be reopened.

## How the code is layered

```
src/lib/domain/    Rules with no React and no storage: permissions, page access, session
                   cookie format, contrast maths. Unit-tested. A backend can share them.
src/lib/api/       The service layer and the future backend seam. Hooks for reading,
                   async functions for changing. Every function checks permission first.
src/lib/adapters/  One typed interface per outside system (identity provider, SIS),
                   each with a mock. The real ones run on the server.
src/lib/data/      Seed data loaded into the mock repositories.
src/components/    Screens. They call src/lib/api and never touch storage.
src/proxy.ts       Redirects before a page is served (signed out, or wrong role).
```

**Permissions** are one matrix in `src/lib/domain/permissions.ts` and one function, `can(actor, action, resource)`. The menu, the page guard (`src/components/route-guard.tsx`), `src/proxy.ts` and every service call go through it. Page-level rules are in `src/lib/domain/routes.ts`. `can()` also refuses any change inside an archived course, so a new feature is read-only after term end as long as its permission check names the course.

**These checks are not security.** They run in the browser and can be bypassed. The backend must repeat them on every request; see `docs/requirements/BACKEND-BACKLOG.md`.

## What is mocked

- **Sign-in and the session** — accounts are seeded or imported users. The session is an unsigned cookie (`lms_session`) written by the browser.
- **Single sign-on** — `createMockIdentityProvider` in `src/lib/adapters/identity-provider.ts` asserts whatever email is typed, if the account is a student, faculty member or admin. There is no redirect, token or SAML assertion.
- **Passwords** — an account accepts any password of 6+ characters until an admin sets one for it; after that it accepts only that password. Set passwords are kept in `localStorage` as a weak digest (`src/lib/api/_credentials.ts`), not a real hash. The password policy is checked in the browser. Do not type a real password into the demo.
- **The second step for admins** — one fixed code, `246810`, checked in the browser.
- **The SIS** — `mockSis` in `src/lib/adapters/sis.ts` returns the same seven records on every sync: two people who already exist, three new ones, and two the import rejects.
- **CSV import** — the file is read and validated in the browser and never leaves it.
- **Term archive and data retention** — an admin starts the archive by hand; nothing runs on the term's end date. The retention period is stored but nothing is ever deleted.
- **Permission enforcement** — done in the browser by `can()`, the route guard and `src/proxy.ts`.
- **All data** — users, terms, sections, enrollments, school settings, learner progress, lesson plans, notifications and the audit log are kept in `localStorage` by the repositories in `src/lib/api/_stores.ts`, under versioned keys such as `lms:progress:v1`. The admin home page has **Reset demo data**; the student grades page has **Reset demo progress**.
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
| `api/session.ts` | Real sign-in (password and SSO), second-step verification, sign-out and current-user endpoints; a server-issued session cookie. `authorize()` stays as a client-side courtesy check. |
| `api/users.ts` | Users, role and status changes, parent–child links, password set, and the import: upload the file for a dry run, then commit. |
| `api/courses.ts` | Courses visible to the caller, rosters, terms, term archive and reopen. |
| `api/settings.ts` | School settings. |
| `api/progress.ts` | Lesson completion, quiz attempts, checkpoint answers. |
| `api/grades.ts` | Class gradebook and export logging. |
| `api/notifications.ts` | Notification list and read state. |
| `api/lesson-plans.ts` | Saved lesson plans. |
| `api/audit.ts` | Audit log reads. |
| `api/_repository.ts`, `api/_stores.ts`, `api/_credentials.ts` | Delete: these are the mock database and the mock password store. |

Adapters for outside systems. Each is an interface with a mock; implement the interface on the server and call it from the API, never from the browser:

| Interface | File | What the real one does |
| --- | --- | --- |
| `IdentityProvider` | `src/lib/adapters/identity-provider.ts` | SAML 2.0 or OIDC sign-in with the school identity provider (FR-1.3). |
| `SisAdapter` | `src/lib/adapters/sis.ts` | Reads the roster from the Student Information System (FR-1.5, FR-1.6). Grade export and a connection test join it later. |

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
- **Dependencies added for the requirements work.** `papaparse` (Phase 1) parses the CSV import; it is loaded with `import()` only when an admin picks a file. `vitest` (Phase 0) runs the unit tests.
- **Dialogs and form fields.** Use `Dialog` in `src/components/dialog.tsx` (the native `<dialog>` element: focus trap, Escape, inert page) and `fieldClass` in `src/components/ui.tsx` for inputs and selects.
- **Theme and type.** Light and dark follow the system setting. Colours are tokens in `src/app/globals.css`; a unit test checks that every text and surface pair used reaches WCAG AA contrast in both themes. The typeface is Inter, set in `src/app/layout.tsx`.
- Course and lesson photos in `public/thumbnails/` and `public/images/` are from [Unsplash](https://unsplash.com/license).
