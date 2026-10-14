# Traceability: requirements to implementation

Source of truth: [`BRD.md`](./BRD.md) (BR-01 to BR-27, NFRs) and [`BA-deliverables.md`](./BA-deliverables.md) (US-01 to US-31, FR-1.1 to FR-8.3, NFR-1 to NFR-8).

**Last updated:** 2026-10-14, after Phase 2 (courses and content).

| Phase | What it changed here |
| --- | --- |
| Baseline | Gap analysis of the prototype. |
| 0 Foundations | FR-1.1, FR-1.4 and FR-1.7 moved from Missing to Partial. FR-1.2 and FR-1.3 gained their mocks. Gradebook rows (FR-4.1, FR-7.1) now come from real enrollments and attempts. NFR-5 and NFR-6 are now measured. |
| Re-verification, 2026-10-14 | No status changed. The notes for FR-1.8, FR-2.1, FR-2.8, FR-4.4 and FR-5.5 still described the app before Phase 0 added terms, sections, enrollments and in-app notifications; they now say what exists and what is still missing. `npm run lint`, `npm test` (72 tests) and `npm run build` pass on commit `7df0de4`. The axe audit and the 360 px check recorded under NFR-5 and NFR-6 were not re-run: no tooling for them is checked in. |
| 1 Users and access | FR-1.5, FR-1.7 and FR-1.8 moved to Done. FR-1.6 moved from Missing to Partial. FR-1.3 gained its identity-provider adapter and FR-1.4 its password policy and second step. Closes US-01, US-02, US-03 and US-04 against mocks. The new admin screens have not been through the axe audit or the 360 px check (see NFR-5, NFR-6). |
| 2 Courses and content | FR-2.2, 2.3, 2.4, 2.6, 2.7 and 2.8 moved to Done; FR-2.1 and FR-2.5 to Partial. Closes US-07 and US-09 against mocks. US-06 waits for the calendar (Phase 5) and US-08 for quizzes to be copied (Phase 3b). Courses and library materials moved behind the service layer. The new screens have not been through the axe audit or the 360 px check. |

## How to read this

| Status | Meaning |
| --- | --- |
| `Done` | Every acceptance criterion of the linked stories is met in the frontend, against mock data. |
| `Partial` | At least one acceptance criterion is met. The notes say which are not. |
| `Missing` | Nothing in the app meets the requirement yet. |
| `Backend-only` | The requirement is itself a server, infrastructure or third-party capability. The frontend can only carry a typed interface, a mock adapter and the screens around it. The notes say whether that mock exists. |

Two things apply to every row and are not repeated in the notes:

- **Persistence is mock.** All data lives in the browser. A row can be `Done` here and still need a real backend before go-live. That work is tracked in [`BACKEND-BACKLOG.md`](./BACKEND-BACKLOG.md).
- **Priority** is the MoSCoW priority of the linked stories. Where an FR serves stories with different priorities, each is shown.

## Summary

| Status | FRs | Count |
| --- | --- | --- |
| Done | FR-1.5, 1.7, 1.8, 2.2, 2.3, 2.4, 2.6, 2.7, 2.8 | 9 |
| Partial | FR-1.1, 1.4, 1.6, 2.1, 2.5, 3.5, 3.6, 4.1, 4.2, 4.3, 7.1 | 11 |
| Missing | all others | 23 |
| Backend-only | FR-1.2 (mock built), 1.3 (mock built), 3.8, 8.1 (roster mock built), 8.2, 8.3 | 6 |

User stories closed so far, all against mock data: US-01, US-02, US-03, US-04 (Phase 1); US-07, US-09 (Phase 2). Partly met: US-06 (everything but "course dates feed the calendar", Phase 5) and US-08 (everything but copying unit quizzes, Phase 3b). US-05 is partly met: a parent sees a linked child's grades and progress, and an admin can link them; attendance and announcements reach the parent view in Phases 5 and 6.

## Functional requirements

### Epic A: User and access management

| BR | FR | Stories | Priority | Status | Implemented today in | What is missing |
| --- | --- | --- | --- | --- | --- | --- |
| BR-01 | FR-1.1 Role-permission matrix | US-03, US-05 | Must (US-03), Should (US-05) | Partial | `src/lib/domain/permissions.ts` (matrix, `can()`), `src/lib/domain/routes.ts`, `src/components/app-shell.tsx` (menu per role), `src/components/admin-users.tsx` and `user-edit-dialog.tsx` (role changes, parent–child links), `updateUserRole()`, `linkChild()` and `unlinkChild()` in `src/lib/api/users.ts`, `src/components/home-parent.tsx`, `src/components/grades-view.tsx` (parent view), `src/lib/domain/permissions.test.ts` | US-03 is met: an admin changes roles on the Users page, the change applies on the person's next page load and is audit-logged, and a student asking for another student's grades is refused and logged by the service (`getProgress()`). No screen offers a student that request, so it can only be seen in the audit log once the per-student report exists (Phase 4). US-05 is partly met: parents see only a linked child's grades and progress, read-only, and admins manage the links. Still missing for US-05: attendance and announcements in the parent view (Phases 5 and 6). The defaults need client confirmation (Q-06). |
| BR-01 | FR-1.2 Server-side enforcement, denied attempts logged | US-03 | Must | Backend-only | Mock: `src/proxy.ts`, `src/components/route-guard.tsx`, `src/components/forbidden-view.tsx`, `authorize()` and `recordDenied()` in `src/lib/api/session.ts`, `src/lib/api/audit.ts`, `src/components/admin-audit.tsx` (searchable audit log at `/admin/audit`), `src/components/home-admin.tsx` (recent events) | Mock built. Every page and service call is checked in the browser, and blocked attempts appear in the audit log with who, what and when. None of this is security: it can be bypassed in the browser, and the log is editable. The backend must enforce the same matrix on every request and own the audit store. |
| BR-02 | FR-1.3 SSO (SAML 2.0 or OIDC) | US-02 | Must | Backend-only | Mock: `IdentityProvider` in `src/lib/adapters/identity-provider.ts`, `signInWithSso()` in `src/lib/api/session.ts`, `src/components/login-form.tsx` (SSO button) | Mock built, and US-02 is met against it: the SSO button asks the mock provider who the person is, the LMS looks the account up, and each role lands on its own home page; a deactivated account is refused with a clear message. The mock asserts whatever email is typed. The real redirect, token or assertion validation and session issue are backend work. Parents are not in the mock directory (Q-07). |
| BR-02 | FR-1.4 Local accounts, password policy, MFA for admins | US-02 | Must | Partial | `signIn()`, `verifyMfa()` in `src/lib/api/session.ts`, `src/lib/api/_credentials.ts`, `src/lib/domain/password-policy.ts`, `setUserPassword()` in `src/lib/api/users.ts`, `src/components/user-edit-dialog.tsx` (set password), `src/components/admin-settings.tsx` (policy), `src/components/login-form.tsx` (second step), `src/lib/domain/policy.test.ts` | Built: a configurable password policy, checked whenever an admin sets a local account's password; that account then accepts only that password. Admins always pass a second step after a password or SSO sign-in, with limited attempts and an expiry. Not met: accounts with no password set (all seeded ones) still accept any password of 6+ characters, so the demo stays easy to enter; nobody can change or reset their own password; the second step accepts one fixed demo code and there is no device enrolment. Policy defaults and the MFA method are Q-08 and Q-27. |
| BR-03 | FR-1.5 CSV or SIS import with row validation and error report | US-01 | Must | Done | `src/lib/domain/user-import.ts` (`planUserImport`, `applyUserImport`, `importReport`, `importTemplate`), `previewUserImport()` and `commitUserImport()` in `src/lib/api/users.ts`, `src/components/user-import.tsx`, `src/lib/adapters/sis.ts`, `src/lib/domain/user-import.test.ts` | Mock persistence only. A CSV file (downloadable template) or the mock SIS feed is checked row by row before anything is saved; valid rows create accounts with their role, sections and, for parents, linked children; rows with errors are listed with the reason and can be downloaded as a report. The file is parsed in the browser; a server must parse and validate it again. Column names and the section-code format are ours until the SIS dictates them (Q-31). |
| BR-03 | FR-1.6 Duplicate detection; scheduled and manual SIS sync | US-01 | Must | Partial | `planUserImport()` in `src/lib/domain/user-import.ts`, `syncFromSis()` and `useSisSync()` in `src/lib/api/users.ts`, `SisAdapter` in `src/lib/adapters/sis.ts`, `src/components/admin-users.tsx` ("Sync from SIS") | Duplicates are detected by email or SIS ID, against existing accounts and within the file, and are skipped, never created twice (US-01 is met). A manual sync runs on the mock adapter and reports created, skipped and failed records. Missing: scheduled syncs, which need a server; and a sync or import never updates or deactivates an existing account, so it cannot change someone's sections (Q-25). |
| BR-04 | FR-1.7 Account statuses; non-active accounts cannot sign in | US-04 | Must | Done | `AccountStatus` in `src/lib/types.ts`, `setUserStatus()` in `src/lib/api/users.ts`, `src/components/admin-users.tsx` (one account or many at once), `completeSignIn()` and `reconcileSession()` in `src/lib/api/session.ts`, `can()` in `src/lib/domain/permissions.ts`, `src/components/admin-settings.tsx` (retention period) | Mock persistence only. Admins activate, deactivate and archive accounts, singly or in bulk, and every change is audit-logged. A non-active account cannot sign in (clear message), loses any session on its next page load, and is denied every permission. Nothing is ever deleted. The retention period is a setting; deleting data when it runs out is a server job (Q-12). |
| BR-04 | FR-1.8 Archive courses at term end, read-only, grades still viewable | US-04 | Must | Done | `src/lib/domain/terms.ts`, the archived-course rule in `can()` (`src/lib/domain/permissions.ts`), `archiveTerm()`, `reopenTerm()` and `useCourseReadOnly()` in `src/lib/api/courses.ts`, `src/components/admin-terms.tsx`, read-only states in `course-overview.tsx`, `lesson-workspace.tsx`, `quiz-runner.tsx`, `quiz-list.tsx`, `course-catalog.tsx`, `gradebook-view.tsx`, tests in `policy.test.ts` and `permissions.test.ts` | Mock persistence only. Archiving a term makes its courses read-only for every role through one rule in `can()`, so anything later phases add inherits it as long as the action names its course. Students, parents, faculty and admins who could see the grades before still can, and gradebooks can still be exported. An admin starts the archive; running it automatically on the end date is a server job. A term is flagged "ready to archive" once its end date has passed. An admin can reopen a term (Q-28). Courses are archived with their term, not one by one. |

### Epic B: Course and content management

| BR | FR | Stories | Priority | Status | Implemented today in | What is missing |
| --- | --- | --- | --- | --- | --- | --- |
| BR-05 | FR-2.1 Create courses with name, code, term, sections, schedule | US-06 | Must | Partial | `createCourse()`, `saveCourse()` and `useCourseEditor()` in `src/lib/api/courses.ts`, `src/lib/domain/course-rules.ts`, `src/components/course-new.tsx` (`/courses/new`), `src/components/course-builder.tsx` (`/courses/[courseId]/edit`), `Meeting` and `Section.meetings` in `src/lib/types.ts`, schedule on `src/components/course-overview.tsx`, `src/lib/domain/courses.test.ts` | Faculty create a course with a name, a unique code, a term, sections and each section's weekly meeting times, and edit all of it in the builder; everything is validated before it is saved. Courses now live in a mock repository behind the service layer. Not met: US-06's second criterion, "course dates feed the calendar", because there is no calendar until Phase 5; the dates and meeting times it will read are stored. Also open: a new course has no students until an import or SIS sync places them, and imports skip people who already have an account (Q-25); only the creator teaches a new course and admins cannot create one (Q-32); a course cannot be deleted. |
| BR-05 | FR-2.2 Unit and lesson hierarchy with drag-and-drop ordering | US-06 | Must | Done | `src/components/sortable-list.tsx`, `src/components/course-builder.tsx`, `src/components/lesson-editor.tsx`, `moveItem()` and `locateLesson()` in `src/lib/domain/course-outline.ts`, `src/components/curriculum.tsx`, `src/lib/domain/courses.test.ts` | Mock persistence only. Units and lessons are added, edited, removed and reordered in the builder, and students see them in that order. Reordering works by dragging, by keyboard on the drag handle (Space, arrows, Space), and by Move up and Move down buttons; screen readers are told where an item lands. A lesson moves to another unit from its edit dialog, not by dragging between units. In-video checkpoint questions cannot be written in the builder yet; existing ones are kept. |
| BR-06 | FR-2.3 Document, video and presentation uploads up to a configurable size limit | US-07 | Must | Done | `src/lib/domain/uploads.ts` (`checkUpload`, formats, default limits), `addMaterial()` in `src/lib/api/materials.ts`, `src/lib/api/_files.ts`, `src/components/content-library.tsx`, upload limits in `src/components/admin-settings.tsx`, `FileContent` in `src/components/lesson-workspace.tsx`, `src/lib/domain/courses.test.ts` | Mock storage only. Video, audio, documents and slides upload with progress; the accepted formats and the size limit for each kind are listed before upload and set by an admin; a file over the limit or of another type is refused with the reason. A file attached to a lesson opens in the page (PDF) or downloads (other formats) for students who can see that lesson. Files are kept in the browser's IndexedDB, so they exist only on the device that uploaded them; the transfer progress is simulated. Formats and limits are defaults (Q-13). |
| BR-06 | FR-2.4 External links and embedded media with in-browser preview | US-07 | Must | Done | `src/lib/domain/links.ts` (`isWebUrl`, `embedUrlFor`), `LinkContent` in `src/components/lesson-workspace.tsx`, `PreviewDialog` in `src/components/content-library.tsx`, `src/components/lesson-player.tsx`, `src/lib/domain/courses.test.ts` | Link lessons accept http and https addresses only. YouTube and Vimeo links play inside the lesson; any other page opens in a new tab, because most sites refuse to be framed. Video and audio play in the browser with captions, PDFs display in the page, and other documents and slides download. |
| BR-07 | FR-2.5 Save a course as a template; create from template | US-08 | Should | Partial | `saveCourseAsTemplate()`, `useTemplates()`, `deleteTemplate()` and `createCourse()` in `src/lib/api/courses.ts`, `copyCourse()` in `src/lib/domain/course-copy.ts`, `src/components/course-builder.tsx` ("Save as template"), `src/components/course-new.tsx`, `src/lib/domain/courses.test.ts` | A course is saved as a template that every teacher can start from; a course can also be copied directly, including one from an archived term. The copy takes units, lessons, sections and schedules and no student data: every unit, lesson and checkpoint gets a new id, so no progress or answer can attach to it, and its sections start empty. Not met: unit quizzes are not copied, because quizzes are still static data outside the service layer; they move in Phase 3b. |
| BR-07 | FR-2.6 Shared content library; bulk date shifting on copy | US-08 | Should | Done | `src/lib/api/materials.ts`, `src/components/content-library.tsx`, `shiftCourseDates()`, `daysBetween()` in `src/lib/domain/course-copy.ts`, `src/components/course-new.tsx` ("Move the dates"), `src/components/course-builder.tsx` ("Move every date"), `src/lib/domain/courses.test.ts` | Mock persistence only. The library is one list shared by all faculty, kept between visits, and shows how many lessons use each item; an item in use cannot be removed. When a course is copied, every date in it (first and last day, each lesson's release time) moves by the same number of days, suggested so the first day lands on the new term's first day; the same tool works on an existing course. |
| BR-08 | FR-2.7 Automatic release at a date and time | US-09 | Should | Done | `Lesson.releaseAt` in `src/lib/types.ts`, `src/lib/domain/content-visibility.ts`, `useCourses()` and `useCourse()` in `src/lib/api/courses.ts`, `src/lib/use-now.ts`, `src/components/lesson-editor.tsx`, `src/lib/domain/courses.test.ts` | Mock enforcement only. A lesson with a release time is left out of what a student receives until that moment, then appears within half a minute without a reload; opening its address early shows "not available". Staff see it labelled with its release time. Times are entered in the teacher's own time zone (Q-34). The filtering runs in the browser, where the whole course is stored; a server must leave unreleased lessons out of its responses. Quizzes have no release time yet (Phase 3b). |
| BR-08 | FR-2.8 Restrict visibility by section or student group | US-09 | Should | Done | `Lesson.sectionIds` in `src/lib/types.ts`, `src/lib/domain/content-visibility.ts`, `src/components/lesson-editor.tsx`, "Show what a section sees" in `src/components/course-overview.tsx`, `src/lib/domain/courses.test.ts` | Mock enforcement only. A lesson limited to sections is shown only to students enrolled in one of them; staff see it labelled and can preview the course as any section sees it. Restriction is by section only: "student group" is in the FR but in no story (Q-03). |

### Epic C: Assignments and assessments

| BR | FR | Stories | Priority | Status | Implemented today in | What is missing |
| --- | --- | --- | --- | --- | --- | --- |
| BR-09 | FR-3.1 Assignments with instructions, due date, points, attachments, target sections | US-10 | Must | Missing | — | No assignment feature. |
| BR-09 | FR-3.2 Rubric builder with criteria, levels, weighted points | US-10, US-15 | Must | Missing | — | No rubrics. |
| BR-10 | FR-3.3 File and text submissions with a timestamped receipt | US-11 | Must | Missing | — | No submissions. |
| BR-10 | FR-3.4 Late rules (block, flag, percentage penalty); optional resubmission | US-11 | Must | Missing | — | No due-date enforcement anywhere. Quiz `due` dates are display-only. |
| BR-11 | FR-3.5 Question bank: multiple choice, true/false, matching, short answer | US-12 | Must | Partial | `src/lib/types.ts` (`Question`), `src/lib/data/quizzes.ts`, `src/components/quiz-runner.tsx` | Single choice, multi-select, true/false and short answer exist. No matching type. Questions are hard-coded per quiz: there is no question bank and no quiz builder for faculty. |
| BR-11 | FR-3.6 Auto-grade objective items, queue manual items, post to gradebook | US-12 | Must | Partial | `src/lib/grading.ts`, `recordAttempt()` in `src/lib/api/progress.ts`, `src/components/grades-view.tsx`, `src/components/gradebook-view.tsx` | Objective questions are auto-graded with partial credit, and scores reach the learner's grades and the faculty gradebook. Short answers are auto-marked by keyword match, so nothing goes to a manual queue, and faculty cannot override a score. |
| BR-11 | FR-3.7 Timed attempts with autosave and auto-submit | US-13 | Must | Missing | `src/components/quiz-runner.tsx` | `Quiz.minutes` is only an estimate shown to the learner. No timer, no autosave (answers are lost on reload), no auto-submit. |
| BR-12 | FR-3.8 Plagiarism service and similarity report | US-14 | Should | Backend-only | — | No mock yet. Needs a provider interface, a mock report, and a faculty-only view. Depends on submissions (FR-3.3). |
| BR-13 | FR-3.9 Inline comments and rubric scoring that totals automatically | US-15 | Must | Missing | — | Quiz explanations are fixed text per question, not feedback on a student's work. No comments, rubric scoring or release step. |

### Epic D: Grading and progress tracking

| BR | FR | Stories | Priority | Status | Implemented today in | What is missing |
| --- | --- | --- | --- | --- | --- | --- |
| BR-14 | FR-4.1 Gradebook per course with categories and weights totalling 100% | US-16 | Must | Partial | `src/components/gradebook-view.tsx`, `src/lib/api/grades.ts`, `src/lib/progress.ts` (`weightedGrade`), `src/lib/data/quizzes.ts` (`weight`) | A per-course gradebook exists, built from real enrollments and attempts, with a weight on each quiz and a section filter. No categories, no screen to configure weights, and no 100% rule (weights are re-normalised over whatever has been submitted). |
| BR-14 | FR-4.2 Automatic final grades; percentage, letter and GPA scales | US-16 | Must | Partial | `src/lib/progress.ts` (`courseGrade`, `weightedGrade`), `src/lib/grading.ts` (`letterGrade`) | Grades recalculate whenever a score changes, as a percentage and a letter. The letter bands are fixed in code, there is no GPA scale, and the scale cannot be selected. |
| BR-15 | FR-4.3 Students see released grades and feedback; release control per item | US-17 | Must | Partial | `src/components/grades-view.tsx`, `src/components/quiz-runner.tsx` (result review), `src/lib/api/progress.ts` | Students see their own grades and a running course total; parents see a linked child's. Every score is visible the moment it exists: there is no release control and no notification on release. |
| BR-16 | FR-4.4 Progress reports and report-card data per student and term | US-18 | Must | Missing | — | The grades page is a live view for the signed-in learner or a parent's linked child. One term is seeded, but nothing is reported per term and there is no per-student report for faculty or admins. |
| BR-16 | FR-4.5 Export final grades to the SIS format; list failed records | US-18 | Must | Missing | `src/components/gradebook-view.tsx` (`downloadCsv`), `logGradebookExport()` in `src/lib/api/grades.ts` | A plain CSV of the on-screen gradebook can be downloaded, and each export is now permission-checked and audit-logged. It is not in an SIS format and reports no failed records. |

### Epic E: Attendance and scheduling

| BR | FR | Stories | Priority | Status | Implemented today in | What is missing |
| --- | --- | --- | --- | --- | --- | --- |
| BR-17 | FR-5.1 Roster per session: Present, Absent, Late, Excused | US-19 | Must | Missing | — | No attendance, sessions or rosters. |
| BR-17 | FR-5.2 Edits within a defined window, with an audit trail | US-19 | Must | Missing | — | Depends on FR-5.1 and the audit log. |
| BR-18 | FR-5.3 Role-specific timetable and academic calendar | US-20 | Should | Missing | `src/components/dashboard-view.tsx` ("Up next") | The dashboard lists upcoming quiz due dates. There is no calendar or timetable. |
| BR-19 | FR-5.4 Admin-set attendance thresholds | US-21 | Should | Missing | — | No admin settings. |
| BR-19 | FR-5.5 Alerts to student, parent and coordinator on breach | US-21 | Should | Missing | — | The in-app channel exists (`notify()` in `src/lib/api/notifications.ts`) but nothing calls it: there is no attendance data and no alert rule. The BRD does not define who the coordinator is in the system (see observations below). |

### Epic F: Communication and collaboration

| BR | FR | Stories | Priority | Status | Implemented today in | What is missing |
| --- | --- | --- | --- | --- | --- | --- |
| BR-20 | FR-6.1 Course announcements with read tracking | US-22 | Must | Missing | — | Nothing exists. |
| BR-20 | FR-6.2 Direct messaging within role-based rules | US-22 | Must | Missing | — | Nothing exists. The rules themselves are not specified. |
| BR-20 | FR-6.3 Course forums with moderation and reporting | US-23 | Should | Missing | — | Nothing exists. |
| BR-21 | FR-6.4 Launch scheduled live sessions through the video integration | US-24 | Should | Missing | — | Nothing exists. The real provider is a backend integration; the join button and schedule are frontend. |
| BR-21 | FR-6.5 Attach recordings to the course afterwards | US-24 | Should | Missing | — | Nothing exists. |
| BR-22 | FR-6.6 Email, push and in-app notifications from configurable templates | US-25 | Must | Missing | `src/lib/api/notifications.ts`, `src/components/notification-bell.tsx` | The in-app channel exists: a `notify()` service, a bell with an unread count, and mark-as-read. One event sends a notification so far (faculty are told when their term is archived); there are no templates. Email and push delivery need a backend. |
| BR-22 | FR-6.7 User preferences, except mandatory alerts | US-25 | Must | Missing | — | Nothing exists. |

### Epic G: Reporting and analytics

| BR | FR | Stories | Priority | Status | Implemented today in | What is missing |
| --- | --- | --- | --- | --- | --- | --- |
| BR-23 | FR-7.1 Class performance and engagement: grade distribution, missing work, last login | US-26 | Should | Partial | `src/components/gradebook-view.tsx`, `src/components/charts.tsx` (`ColumnChart`), `src/components/home-faculty.tsx` | The gradebook shows a grade distribution, class average, submission rate and a list of learners with missing or failing work, per course and filterable by section. The faculty home summarises each course. Each account's last sign-in is now recorded and shown to admins on the Users page, but not yet on a faculty dashboard. |
| BR-24 | FR-7.2 School-wide usage and performance with drill-down | US-27 | Should | Missing | — | No admin area. |
| BR-24 | FR-7.3 At-risk students from configurable rules | US-27 | Should | Missing | `src/components/gradebook-view.tsx` ("Follow up with") | The gradebook flags learners below 70% or with missing work, using a rule fixed in code, per course, with no attendance input. Not configurable and not school-wide. |
| BR-25 | FR-7.4 PDF and Excel export honouring filters and permissions | US-28 | Should | Missing | — | Only CSV (gradebook) and Markdown (lesson plan) exports exist. |

### Epic H: Integration and connectivity

| BR | FR | Stories | Priority | Status | Implemented today in | What is missing |
| --- | --- | --- | --- | --- | --- | --- |
| BR-26 | FR-8.1 SIS integration for users, enrollments and grades | US-29 | Must | Backend-only | Mock: `SisAdapter` in `src/lib/adapters/sis.ts`, `syncFromSis()` in `src/lib/api/users.ts` | Roster mock built: a manual sync creates users with their sections from a fixed feed. Still to mock: enrollment changes for existing users, grade export (Phase 4), and the admin integrations screen with a connection test (Phase 8). |
| BR-26 | FR-8.2 Email and video-conferencing integration with health checks and failure alerts | US-29 | Must | Backend-only | — | No mock yet. Needs provider interfaces, "test connection", failure alerts and masked credentials on an admin integrations page. Credentials can only be stored securely on a server. |
| BR-27 | FR-8.3 Authenticated, rate-limited REST API with documentation | US-30 | Could | Backend-only | — | No API. This phase can deliver an OpenAPI 3 specification and a docs page; live endpoints, authentication, rate limiting and call logging are backend work. |
| Risk "connectivity gaps" | — (no FR in the matrix) | US-31 | Could | Missing | — | No offline support, web manifest or service worker. |

## Non-functional requirements

| NFR | Area | Status | Where it stands | What the backend or the project still has to provide |
| --- | --- | --- | --- | --- |
| NFR-1 | Availability, 99.5% | Backend-only | Not applicable to a static frontend. | Hosting with an uptime target, monitoring, a monthly report, and maintenance windows outside exam periods. |
| NFR-2 | Performance, under 3 s at 2,000 users | Partial | Every route is prerendered as a static shell, code is split per route, each role's home page is its own bundle, the CSV parser loads only when an admin picks a file, the drag-and-drop library loads only with the course builder, and images are optimised by `next/image`. Not measured under load. | A load test against the real backend before go-live. API response times and caching are backend concerns. |
| NFR-3 | Security and privacy | Backend-only | Mocks exist for role-based access (`can()`), route protection and an audit log. They run in the browser and secure nothing. | Encryption in transit and at rest, server-side authorization on every request, tamper-proof audit storage, a privacy assessment against the applicable law, a security review and a penetration test. |
| NFR-4 | Usability | Partial | Consistent layout, one design system, plain-language labels. Not tested with users. | A usability test with pilot faculty and students on the three core tasks (create course, post assignment, mark attendance). Two of those tasks do not exist yet. |
| NFR-5 | Accessibility, WCAG 2.1 AA | Partial | Semantic landmarks and headings, labelled controls, visible focus, keyboard-operable player, quiz and menus, live regions, reduced-motion support. Measured in Phase 0: a unit test (`src/lib/domain/contrast.test.ts`) checks every text and surface token pair in both themes (one pair failed and was fixed), and an automated axe audit of every current page for all four roles reports no WCAG 2.1 A or AA violations in light or dark. | Automated checks find only part of what WCAG requires. An audit with assistive technologies (screen readers, keyboard-only, zoom) is still needed before go-live, and each new phase must be re-audited. **Phase 1 has not been re-audited:** the admin pages, the edit dialog (native `<dialog>`) and the sign-in second step were built to the same rules (labelled controls, table headers and captions, live regions for results, token colours already covered by the contrast test) but no axe run or screen-reader pass has been done on them. **Phase 2 has not been re-audited either:** the course builder, lesson editor, new-course page and the reworked content library follow the same rules, and reordering has three routes (drag, keyboard on the handle, Move up and Move down buttons) with announcements, but none of it has been tried with a screen reader or run through axe. |
| NFR-6 | Compatibility: web, iOS, Android | Partial | Responsive layouts. Checked in Chrome at 360 px wide, in light and dark, for all four roles: no page scrolls sideways. No web manifest yet, so not installable (Phase 8). | Confirmation from the client that a responsive web app plus PWA satisfies "iOS and Android" (Q-23). A cross-device and cross-browser test matrix: only Chrome has been checked. **The Phase 1 pages have not been checked at 360 px:** their tables scroll sideways inside their cards and their toolbars wrap, by the same patterns as the gradebook, but nobody has looked at them in a browser yet. **The same is true of the Phase 2 screens.** |
| NFR-7 | Scalability | Backend-only | Not applicable to a static frontend. | Data model, storage and hosting that grow without redesign; a capacity review each term. |
| NFR-8 | Backup and recovery | Backend-only | Not applicable: data is in the browser. | Daily backups, defined recovery time and recovery point objectives, and periodic restore drills. |

## Features in the app that go beyond the BRD

These stay. They are listed so nobody mistakes them for scope creep or removes them.

| Feature | Where | Closest requirement |
| --- | --- | --- |
| AI tutor (simulated) | `/tutor`, panel beside each lesson | None. Supports BO-3. |
| AI lesson planner (simulated) | `/lesson-planner` | None. Supports BO-2; related to BR-05. |
| In-video checkpoint questions | `src/components/lesson-player.tsx` | Related to BR-11, but ungraded. |
| Captions, transcripts and auto-captioning (simulated) | `src/components/lesson-player.tsx`, `src/components/content-library.tsx` | Supports NFR-5. |
| Study time and streak on the dashboard | `src/components/dashboard-view.tsx` | Related to BR-23 (engagement). |

## Observations on the source documents

Points where the two documents disagree, leave a gap, or need a client decision. They are tracked, with the default the app uses meanwhile, in [`OPEN-QUESTIONS.md`](./OPEN-QUESTIONS.md).

1. **US-31 has no functional requirement.** It traces to "Risk R4", but the BRD's risks are not numbered and the matrix has no FR for offline use. The coverage statement in the BA document does not hold for this story.
2. **The academic coordinator is not a role.** US-21 sends attendance alerts to the coordinator, and the RACI lists coordinators as stakeholders, but BR-01 defines only Student, Faculty, Admin and Parent. The same applies to the "IT administrator" (US-29, US-30) and the Principal.
3. **Short-answer marking is ambiguous.** FR-3.5 lists short answer in the question bank; US-12 names only multiple choice, true/false and matching as auto-scored and sends the rest to a manual queue. The prototype auto-marks short answers by keyword.
4. **The matrix adds scope the stories do not test.** FR-1.6 adds scheduled SIS syncs, FR-2.8 adds "student group", FR-6.6 adds configurable templates. None has an acceptance criterion.
5. **"iOS and Android" and "the mobile app".** NFR-6 and US-31 can be read as native apps. This phase assumes a responsive web app and PWA.
6. **Sign-in for parents is not specified.** US-02 covers students and faculty through SSO; FR-1.4 covers local accounts and MFA for admins. Parents are unlikely to be in the school identity provider.
7. **Policies referred to but not defined:** retention policy (US-04), messaging role rules (FR-6.2), password policy and MFA method (FR-1.4), file formats and size limits (FR-2.3), late-penalty defaults (FR-3.4), grading scale bands and GPA mapping (FR-4.2), attendance threshold and how Late and Excused count (FR-5.4), the edit window (FR-5.2), and at-risk rules (FR-7.3).
8. **The documents are drafts.** The BA document says FR IDs and priorities are proposed and still need stakeholder confirmation.
