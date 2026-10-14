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
| Courses and lessons | `/courses`, `/courses/[courseId]` | student, faculty, admin | `src/components/course-catalog.tsx`, `course-overview.tsx`, `curriculum.tsx`, `src/lib/api/courses.ts` |
| Course builder: details, sections and schedule, units and lessons, release times, section limits, templates, copies | `/courses/new` (faculty), `/courses/[courseId]/edit` (faculty who teach it, admin) | faculty, admin | `src/components/course-new.tsx`, `course-builder.tsx`, `lesson-editor.tsx`, `sortable-list.tsx`, `src/lib/domain/course-rules.ts`, `course-copy.ts`, `content-visibility.ts` |
| Lessons: video with in-video quizzes, reading, link, document, slides | `/courses/[courseId]/learn/[lessonId]` | student; faculty and admin preview | `src/components/lesson-player.tsx`, `lesson-workspace.tsx`, `src/lib/api/materials.ts`, `src/lib/domain/links.ts` |
| Quizzes: timed attempts with autosave and automatic hand-in, five question kinds, instant marking | `/quizzes`, `/quizzes/[quizId]` | student takes them; faculty and admin see questions and answers | `src/components/quiz-list.tsx`, `quiz-runner.tsx`, `quiz-questions.tsx`, `quiz-preview.tsx`, `src/lib/api/quizzes.ts`, `src/lib/grading.ts`, `src/lib/domain/quizzes.ts` |
| Quiz builder and question bank | `/quizzes/new`, `/quizzes/[quizId]/edit` | faculty | `src/components/quiz-builder.tsx`, `question-editor.tsx`, `sortable-list.tsx` |
| Grading queue for teacher-marked answers | `/grading` | faculty | `src/components/grading-queue.tsx`, `src/lib/api/quizzes.ts` |
| Grades: released grades and feedback, a running total for each course | `/grades` | student (own), parent (child) | `src/components/grades-view.tsx`, `src/lib/api/grades.ts` |
| Gradebook: categories and weights, grading scale, totals, grade release for each item, CSV export | `/gradebook` | faculty (own courses), admin (all, read-only) | `src/components/gradebook-view.tsx`, `gradebook-setup-dialog.tsx`, `src/lib/api/grades.ts`, `src/lib/domain/gradebook.ts` |
| Progress report for a student and term, printable, with a CSV of the report-card data | `/reports` | student (own), parent (child), faculty (students and courses they teach), admin | `src/components/report-view.tsx`, `src/lib/api/reports.ts` |
| Calendar: week timetable and month view of classes, due dates, exams, holidays and events, filtered by course | `/calendar` | all (a parent sees a linked child's) | `src/components/calendar-view.tsx`, `calendar-event-dialog.tsx`, `src/lib/api/calendar.ts`, `src/lib/domain/schedule.ts` |
| Attendance: roster for each class session, corrections with a log, attendance rate, low-attendance alerts | `/attendance` | faculty (their sections), admin (read-only), student (own), parent (child) | `src/components/attendance-view.tsx`, `src/lib/api/attendance.ts`, `src/lib/domain/attendance.ts` |
| Export final grades to the SIS, with failed records and reasons | buttons on `/gradebook` (one course) and `/admin/terms` (a whole term) | admin | `src/components/sis-export-dialog.tsx`, `src/lib/api/reports.ts`, `src/lib/domain/sis-export.ts`, `src/lib/adapters/sis.ts` |
| Content library: uploads within size limits, captions, preview | `/content` | faculty; admin read-only | `src/components/content-library.tsx`, `src/lib/api/materials.ts`, `src/lib/domain/uploads.ts` |
| Assignments: set, hand in, receipt, late rules, resubmission | `/assignments`, `/assignments/new` (faculty), `/assignments/[assignmentId]`, `/assignments/[assignmentId]/edit` (faculty) | student, faculty; admin read-only | `src/components/assignment-list.tsx`, `assignment-editor.tsx`, `assignment-detail.tsx`, `rubric.tsx`, `late-policy-fields.tsx`, `src/lib/api/assignments.ts`, `src/lib/domain/assignments.ts` |
| Marking: inline comments, rubric scoring, feedback, grade release, similarity report | `/assignments/[assignmentId]/submissions/[studentId]` | faculty; admin read-only | `src/components/submission-marking.tsx`, `annotated-text.tsx`, `src/lib/adapters/plagiarism.ts` |
| Lesson planner (simulated AI) | `/lesson-planner` | faculty | `src/components/lesson-plan-generator.tsx`, `src/lib/mock-ai/lesson-plan.ts` |
| AI tutor (simulated) | `/tutor`, panel beside each lesson | student | `src/components/tutor-chat.tsx`, `src/lib/mock-ai/tutor.ts` |
| Notifications | bell in the sidebar or top bar | all | `src/components/notification-bell.tsx`, `src/lib/api/notifications.ts` |
| Users: CSV import, SIS sync, roles, statuses, parent–child links, passwords | `/admin/users` | admin | `src/components/admin-users.tsx`, `user-import.tsx`, `user-edit-dialog.tsx`, `src/lib/api/users.ts`, `src/lib/domain/user-import.ts` |
| Terms: term-end archive, export of a term's final grades to the SIS | `/admin/terms` | admin | `src/components/admin-terms.tsx`, `src/lib/api/courses.ts`, `src/lib/domain/terms.ts` |
| School settings: password policy, data retention, upload size limits, default late rule, submission size limit, who sees similarity reports, grading scales, attendance policy and coordinators | `/admin/settings` | admin | `src/components/admin-settings.tsx`, `src/lib/api/settings.ts`, `src/lib/domain/settings.ts` |
| Audit log | `/admin/audit` | admin | `src/components/admin-audit.tsx`, `audit-table.tsx`, `src/lib/api/audit.ts` |
| No-access page | `/forbidden` | all | `src/components/forbidden-view.tsx` |

Pages behind sign-in live in `src/app/(app)/` and share the sidebar layout; `/login` lives in `src/app/(auth)/` without it.

**Importing users.** On `/admin/users`, **Import CSV** takes a file with the columns `name`, `email`, `role`, `sections`, `sis_id` and `children` (download the template from the same panel). The file is checked first: you see how many rows are ready, which are duplicates and which have errors, and nothing is saved until you confirm. Rows with errors are skipped and can be downloaded as a report; the valid rows are still created. A row for someone who already has an account (matched by email or SIS ID) does not create a second one: if it lists sections, the person is added to the ones they are not in yet, and the preview shows the row as "Existing account". That is how existing students and teachers are placed in a new or copied course. Nothing else about an existing account is changed, and a row that would move a student between two sections of the same course is reported as an error.

**Building a course.** Faculty press **New course** on `/courses` to start blank, from a template, or as a copy of a course they teach (a copy takes units, lessons, sections and schedules, never students or their work, and can move every date by a number of days). The builder at `/courses/[courseId]/edit` holds the details, the sections with their weekly meeting times, and the units and lessons. Reorder by dragging the handle, by keyboard on the handle (Space, arrow keys, Space), or with the Move up and Move down buttons. Each lesson can have a release date and time and can be limited to sections; on the course page, staff can switch **Show** to see what one section's students see right now. Nothing is saved until **Save course**.

A new course has no students: they are placed in its sections by the CSV import or the SIS sync, using the section codes shown in the course builder. Both work for new people and for people who already have an account.

**Setting and marking an assignment.** Faculty press **New assignment** on `/assignments`: instructions, due date and time, points, attached files, the sections it is for, how students hand in (typed text, files or both), the late rule, whether handing in again is allowed, and an optional rubric. It can be saved as a draft; publishing checks everything, including that the rubric adds up to the assignment's points. Students hand in on the assignment's page and get a receipt with the date, time and a code. On the marking page (`/assignments/[assignmentId]/submissions/[studentId]`) the teacher comments on selected text or on a file, picks rubric levels (the total and any late deduction update as they go) and writes feedback. Students see none of that until the teacher presses **Release grades** on the assignment page.

The seeded demo has an assignment with marked, unmarked and late work (as faculty, open "Reflection: where have you met machine learning?") and one the student has still to do.

**Building and marking a quiz.** Faculty press **New quiz** on `/quizzes`: settings (due date, pass mark, gradebook category, an optional time limit and attempt limit, the unit it follows) and questions of five kinds: multiple choice, multiple answers, true or false, matching and short answer. Questions can be saved to, and copied from, the question bank shared by all faculty. Multiple choice, true or false and matching are marked automatically; a short answer is marked by keyword or by a teacher, as the question says. Teacher-marked answers arrive on `/grading`; saving a mark there updates the student's score, and the attempt counts once nothing is left to mark.

In the seeded demo, "Unit 2 quiz: Training models" has a 10-minute limit, a matching question and a teacher-marked question, and two answers are already waiting in Dr. Okafor's grading queue.

**Grading a course.** On `/gradebook` a teacher presses **Set up grading** to name the course's categories and give each a weight (the save is refused until they total 100%), say which category each quiz and assignment counts in, choose the scale the grade is reported on (percentage, letter or GPA) and decide whether work not handed in by its due date counts as zero. Inside a category, work counts in proportion to its points. Totals are worked out from the stored scores every time they are shown, so they follow each new score and each change of weights. A course nobody has set up uses Assignments 50% and Quizzes 50% on the school's default scale. The grades of the letter and GPA scales are school policy: an admin changes them on `/admin/settings`.

**Releasing grades.** The "Grade items and release" card on `/gradebook` lists every quiz and assignment. An assignment's marks stay hidden until the teacher presses **Release**. A quiz's scores are shown when the student hands in, unless the teacher presses **Hold**; they are then released for the whole class at once. Students are notified on release. On `/grades` a student (or a parent, for a linked child) sees only released grades and feedback, and a running total for each course that counts only those. In the teacher's gradebook an unreleased mark carries a `*` and does count.

**Reports and the SIS export.** `/reports` shows one student's progress report for a term: the grade in each course with its category breakdown, missing work, lessons done, the term average and the GPA. It can be printed or downloaded as CSV. An admin exports final grades to the SIS with **Export to SIS** on `/gradebook` (one course) or **Export grades to SIS** on `/admin/terms` (every course of a term). The dialog shows what will go and lists every record that cannot, with the reason; both lists can be downloaded, and each export is written to the audit log. In the seeded demo, exporting Machine Learning Foundations fails the students whose work is not marked or not released yet.

**Taking attendance.** On `/attendance` a teacher chooses one of their sections; its class sessions are listed from the first class up to today, newest first, each marked "Not taken", "can be corrected" or "locked". Choosing one loads the roster with Present, Absent, Late and Excused for each student; **Mark the rest present** fills in whoever is left, and everyone must be marked before it is submitted. A submitted session can be corrected for a limited time (48 hours by default, an admin setting); each correction is listed under the roster with who made it and when, and is written to the audit log. Below the roster is each student's attendance in the course so far.

**Low-attendance alerts.** On `/admin/settings` an admin sets the attendance threshold, how Late and Excused count, how many sessions must be recorded before the threshold is checked, the correction window, and which staff are academic coordinators. When a student's attendance in a course falls below the threshold, the student, their linked parents and the coordinators get one alert (with no coordinator named, the section's teachers get it). There is no second alert while attendance stays below; if it recovers and falls again, that is a new alert. To see it in the seeded demo, sign in as Dr. Okafor, take attendance for Machine Learning Foundations, Section A, and mark Mike Manabat absent: that takes him from 84.6% to 78.6%, and Mike, his parent Rosa and Dr. Okafor are each notified once.

**The calendar.** `/calendar` shows a week (the timetable) or a month, with classes, quiz and assignment due dates, exams, holidays and school events, filtered by course and by kind. Classes come from each section's weekly schedule and the course's dates, and due dates from the quizzes and assignments themselves, so a change to any of them is on the calendar at once. An admin adds events for the whole school and faculty for the courses they teach with **Add event**; an event marked "no classes" removes those classes from the timetable and from the attendance list.

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
- **The SIS** — `mockSis` in `src/lib/adapters/sis.ts` returns the same seven records on every sync: two people who already exist and are already in the section it lists (so they are left unchanged), three new ones, and two the import rejects.
- **CSV import** — the file is read and validated in the browser and never leaves it.
- **Term archive and data retention** — an admin starts the archive by hand; nothing runs on the term's end date. The retention period is stored but nothing is ever deleted.
- **Permission enforcement** — done in the browser by `can()`, the route guard and `src/proxy.ts`.
- **All data** — users, terms, sections, enrollments, courses, course templates, library items, assignments, submissions, school settings, gradebook setups, attendance sheets, calendar events, learner progress, lesson plans, notifications and the audit log are kept in `localStorage` by the repositories in `src/lib/api/_stores.ts`, under versioned keys such as `lms:progress:v1`. The admin home page has **Reset demo data**; the student grades page has **Reset demo progress**.
- **The audit log** — written by the browser, editable by the user, capped at 500 events.
- **Notifications** — in-app only. Nothing is emailed or pushed.
- **Quizzes** — a quiz reaches the browser with its answer key and is marked there. The time limit runs on the browser's clock; answers are saved to local storage as they are given; and an attempt whose time runs out while the app is closed is handed in the next time the student opens the quizzes page or the quiz. Courses and quizzes start from the seeds in `src/lib/data/` and are then edited in the browser.
- **Who sees which lesson** — release times and section limits are applied in the browser by `courseForViewer()`. The whole course is in the browser's storage, so this hides lessons from the screen, not from someone who inspects storage.
- **Study time and streak on the student dashboard** — fixed sample numbers in `src/lib/data/people.ts`.
- **AI tutor and lesson planner** — template-based, in `src/lib/mock-ai/`. No model is called.
- **Assignments** — the submission time comes from the browser's clock, the late rule and rubric total are worked out in the browser, and a student's unreleased mark is hidden by the screen, not withheld by a server. The receipt code is a checksum, not proof.
- **Similarity reports** — `mockPlagiarismProvider` in `src/lib/adapters/plagiarism.ts` compares nothing. It derives a low score from the text, and a high one when the work contains the sentence "Machine learning is a field of study in artificial intelligence", so a flagged report can be shown on purpose.
- **Grades and totals** — worked out in the browser from the stored scores by the rules in `src/lib/domain/gradebook.ts`. A student's unreleased quiz scores and assignment marks are hidden by the screens and left out of their totals, but they are in the same browser storage; a server must withhold them. Whether work is "missing" is decided against the browser's clock.
- **SIS grade export** — `mockSis.exportGrades()` in `src/lib/adapters/sis.ts` sends nothing. It accepts every record whose student ID looks like `S-` and digits and turns the rest down, so a rejection can be shown on purpose (give a student a different SIS ID on `/admin/users`). The file's columns are a placeholder until the school's SIS is known.
- **Attendance** — the correction window is checked against the browser's clock, and the threshold check that sends alerts runs in the browser of whoever saved the attendance or the policy; a server would run it as a job. Alerts are in-app only. Class times are plain times and "today" is the device's date, so the demo assumes the device is in the school's time zone. Seeded attendance stops on 13 October 2026; later sessions show as "Not taken".
- **Uploads** — library files, assignment attachments and submitted files are kept in the browser's IndexedDB (`src/lib/api/_files.ts`): they survive a reload but exist only on the device that uploaded them. Upload progress and auto-captioning are simulated. The size and format check runs in the browser.
- **Lesson videos** — a video lesson plays a file uploaded to the content library, or one of two sample clips streamed from `media.w3.org` (`SAMPLE_VIDEOS` in `src/lib/sample-media.ts`), which need an internet connection. Captions come from each lesson's `transcript`.

## Connecting a backend

The service layer is the seam: replace the body of each module in `src/lib/api/` with calls to the real API and the screens do not change.

| Module | Replace with |
| --- | --- |
| `api/session.ts` | Real sign-in (password and SSO), second-step verification, sign-out and current-user endpoints; a server-issued session cookie. `authorize()` stays as a client-side courtesy check. |
| `api/users.ts` | Users, role and status changes, parent–child links, password set, and the import: upload the file for a dry run, then commit. |
| `api/courses.ts` | Courses as the caller may see them (the server leaves out unreleased and other-section lessons), course create, copy and save, templates, rosters, terms, term archive and reopen. |
| `api/materials.ts` | Content library list, upload, captions, delete, and the file a lesson shows. |
| `api/assignments.ts` | Assignments, submissions (the server stamps the time and applies the late rule), marking, inline comments, grade release (the server withholds unreleased marks), similarity checks, file downloads. |
| `api/settings.ts` | School settings. |
| `api/progress.ts` | Lesson completion, checkpoint answers, and a learner's record. |
| `api/quizzes.ts` | Quizzes (without answer keys for students), the question bank, starting an attempt, autosave, handing in (the server marks and enforces the time limit), the grading queue and manual marks. |
| `api/grades.ts` | Class gradebook with totals (the server computes them with the rules in `src/lib/domain/gradebook.ts`), each course's categories, weights and scale, holding and releasing quiz scores, and a learner's released grades (the server withholds the rest). |
| `api/reports.ts` | Progress report for a student and term, and the export of final grades to the SIS: a dry run that lists failed records, then the send, which the server performs and audit-logs. |
| `api/attendance.ts` | A section's sessions and rosters, submitting and correcting attendance (the server stamps the time, enforces the correction window and keeps the trail), attendance rates, and one student's record. The server runs the threshold check and sends each alert once per breach. |
| `api/calendar.ts` | The calendar for the caller, or for a parent's child, and the calendar events. |
| `api/notifications.ts` | Notification list and read state. |
| `api/lesson-plans.ts` | Saved lesson plans. |
| `api/audit.ts` | Audit log reads. |
| `api/_repository.ts`, `api/_stores.ts`, `api/_credentials.ts`, `api/_files.ts` | Delete: these are the mock database, the mock password store and the mock file store. |

Adapters for outside systems. Each is an interface with a mock; implement the interface on the server and call it from the API, never from the browser:

| Interface | File | What the real one does |
| --- | --- | --- |
| `IdentityProvider` | `src/lib/adapters/identity-provider.ts` | SAML 2.0 or OIDC sign-in with the school identity provider (FR-1.3). |
| `SisAdapter` | `src/lib/adapters/sis.ts` | `fetchRoster()` reads the roster from the Student Information System (FR-1.5, FR-1.6). `exportGrades()` sends final grades in the SIS's format and returns the records it turned down, each with a reason (FR-4.5). A connection test joins it later. |
| `PlagiarismProvider` | `src/lib/adapters/plagiarism.ts` | Sends a submission to the similarity-checking service and returns its report (FR-3.8). |

Other single-function seams:

- `streamTutorReply()` in `src/lib/mock-ai/tutor.ts` — a streaming call to your chat endpoint.
- `generateLessonPlan()` in `src/lib/mock-ai/lesson-plan.ts` — return the same `LessonPlan` shape from your API.
- `upload()` and `autoCaption()` in `src/components/content-library.tsx` — real upload progress and a transcription request.

The full list of server-side work is in `docs/requirements/BACKEND-BACKLOG.md`.

## Notes for contributors

- **Next.js 16.** Read the guide in `node_modules/next/dist/docs/` before writing routing, layout, caching or auth code (see `AGENTS.md`). Middleware is called Proxy in this version.
- **Cache Components are on.** Dynamic routes read `params` inside `<Suspense>` and declare `generateStaticParams`, which returns the seeded ids (this version needs at least one).
- **Records made in the browser are unknown to the server.** A course created in the builder has no prerendered page; its page renders on first request and must not call `notFound()` on the server. Look the record up in the component (`useCourse()`, `useCourseEditor()`) and render `NotFoundView` when it is missing.
- **Time-dependent screens read the clock through `useNow()`** (`src/lib/use-now.ts`), so a lesson appears when its release time arrives without a reload.
- **Pages render role-specific data in the browser only.** The route guard shows a skeleton until the session is known, so prerendered HTML never contains one role's data.
- **Hidden pages stay mounted.** Next.js keeps recently visited pages alive when you navigate away. Anything that should stop or reset on leaving (media playback, open dialogs, "pending" flags) goes in a `useLayoutEffect` cleanup — see `src/components/lesson-player.tsx`.
- **Changing the signed-in user reloads the page.** Use `reloadTo()` in `src/lib/navigation.ts` for sign-in, sign-out and role switches, so nothing cached for the previous user survives. Use `<Link>` and `useRouter()` everywhere else.
- **Do not delete `.next/dev` while `npm run dev` is running.** The dev server will return errors until it is restarted.
- **Storage versions.** When the shape of a stored value changes, bump the version passed to `createRepository`; the old key is ignored and the store restarts from its seed.
- **Dependencies added for the requirements work.** `papaparse` (Phase 1) parses the CSV import; it is loaded with `import()` only when an admin picks a file. `@dnd-kit/core`, `@dnd-kit/sortable` and `@dnd-kit/utilities` (Phase 2) give the course builder drag-and-drop that also works from the keyboard; use `SortableList` in `src/components/sortable-list.tsx` for any other reorderable list. `vitest` (Phase 0) runs the unit tests.
- **Dialogs and form fields.** Use `Dialog` in `src/components/dialog.tsx` (the native `<dialog>` element: focus trap, Escape, inert page) and `fieldClass` in `src/components/ui.tsx` for inputs and selects.
- **Theme and type.** Light and dark follow the system setting. Colours are tokens in `src/app/globals.css`; a unit test checks that every text and surface pair used reaches WCAG AA contrast in both themes. The typeface is Inter, set in `src/app/layout.tsx`.
- Course and lesson photos in `public/thumbnails/` and `public/images/` are from [Unsplash](https://unsplash.com/license).
