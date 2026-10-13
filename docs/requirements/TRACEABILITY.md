# Traceability: requirements to implementation

Source of truth: [`BRD.md`](./BRD.md) (BR-01 to BR-27, NFRs) and [`BA-deliverables.md`](./BA-deliverables.md) (US-01 to US-31, FR-1.1 to FR-8.3, NFR-1 to NFR-8).

**Last updated:** 2026-10-13, after Phase 0 (foundations).

| Phase | What it changed here |
| --- | --- |
| Baseline | Gap analysis of the prototype. |
| 0 Foundations | FR-1.1, FR-1.4 and FR-1.7 moved from Missing to Partial. FR-1.2 and FR-1.3 gained their mocks. Gradebook rows (FR-4.1, FR-7.1) now come from real enrollments and attempts. NFR-5 and NFR-6 are now measured. |

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
| Done | none | 0 |
| Partial | FR-1.1, 1.4, 1.7, 2.2, 2.3, 2.4, 2.6, 3.5, 3.6, 4.1, 4.2, 4.3, 7.1 | 13 |
| Missing | all others | 30 |
| Backend-only | FR-1.2 (mock built), 1.3 (mock built), 3.8, 8.1, 8.2, 8.3 | 6 |

Roles, sessions, a permission matrix, an audit log and a service layer now exist, so later phases have something to build on. No user story is fully closed yet: the admin screens that complete Epic A arrive in Phase 1.

## Functional requirements

### Epic A: User and access management

| BR | FR | Stories | Priority | Status | Implemented today in | What is missing |
| --- | --- | --- | --- | --- | --- | --- |
| BR-01 | FR-1.1 Role-permission matrix | US-03, US-05 | Must (US-03), Should (US-05) | Partial | `src/lib/domain/permissions.ts` (matrix, `can()`), `src/lib/domain/routes.ts`, `src/components/app-shell.tsx` (menu per role), `src/components/role-home.tsx`, `src/components/home-parent.tsx`, `src/components/grades-view.tsx` (parent view), `src/lib/domain/permissions.test.ts` | The matrix with defaults per role exists and drives the menu, pages and services. Parents see only a linked child's grades and progress, read-only. Still missing: a screen to assign and change roles and to link parents to children (Phase 1); the page where a student could try to open another student's report (Phase 4); attendance and announcements in the parent view (Phases 5 and 6). The defaults need client confirmation (Q-06). |
| BR-01 | FR-1.2 Server-side enforcement, denied attempts logged | US-03 | Must | Backend-only | Mock: `src/proxy.ts`, `src/components/route-guard.tsx`, `src/components/forbidden-view.tsx`, `authorize()` and `recordDenied()` in `src/lib/api/session.ts`, `src/lib/api/audit.ts`, `src/components/home-admin.tsx` (audit table) | Mock built. Every page and service call is checked in the browser, and blocked attempts appear in the audit log with who, what and when. None of this is security: it can be bypassed in the browser, and the log is editable. The backend must enforce the same matrix on every request and own the audit store. |
| BR-02 | FR-1.3 SSO (SAML 2.0 or OIDC) | US-02 | Must | Backend-only | Mock: `src/components/login-form.tsx` (SSO button), `signInAsDemo()` in `src/lib/api/session.ts` | Mock built. The SSO button signs in the chosen role's demo account and each role lands on its own home page. There is no identity-provider adapter yet (Phase 1) and no real protocol. |
| BR-02 | FR-1.4 Local accounts, password policy, MFA for admins | US-02 | Must | Partial | `signIn()` in `src/lib/api/session.ts`, `src/components/login-form.tsx`, `src/lib/data/directory.ts` | Accounts exist and sign-in checks the email against them; unknown and deactivated accounts get a clear message. Any password of 6+ characters is accepted: there is no stored password, no password policy and no MFA step (Phase 1). |
| BR-03 | FR-1.5 CSV or SIS import with row validation and error report | US-01 | Must | Missing | — | No import, template, validation or error report. |
| BR-03 | FR-1.6 Duplicate detection; scheduled and manual SIS sync | US-01 | Must | Missing | — | Nothing exists. A manual sync can run on a mock adapter; a scheduled sync needs a server. |
| BR-04 | FR-1.7 Account statuses; non-active accounts cannot sign in | US-04 | Must | Partial | `AccountStatus` in `src/lib/types.ts`, `signIn()` and `reconcileSession()` in `src/lib/api/session.ts`, `can()` in `src/lib/domain/permissions.ts` | The three statuses exist. A non-active account cannot sign in, loses any session it still has on the next page load, and is denied every permission. There is no admin screen to change a status yet (Phase 1). |
| BR-04 | FR-1.8 Archive courses at term end, read-only, grades still viewable | US-04 | Must | Missing | — | No terms and no archived state on courses. |

### Epic B: Course and content management

| BR | FR | Stories | Priority | Status | Implemented today in | What is missing |
| --- | --- | --- | --- | --- | --- | --- |
| BR-05 | FR-2.1 Create courses with name, code, term, sections, schedule | US-06 | Must | Missing | — | Courses are hard-coded in `src/lib/data/courses.ts`. `Course` has no code, term, sections or schedule, and there is no authoring screen. |
| BR-05 | FR-2.2 Unit and lesson hierarchy with drag-and-drop ordering | US-06 | Must | Partial | `src/lib/types.ts` (`Course` → `CourseModule` → `Lesson`), `src/components/curriculum.tsx`, `src/components/course-overview.tsx` | The hierarchy exists and students see it in order. Faculty cannot add, edit or reorder anything. Course dates do not feed a calendar (there is none). |
| BR-06 | FR-2.3 Document, video and presentation uploads up to a configurable size limit | US-07 | Must | Partial | `src/components/content-library.tsx` | Upload with progress works for video, audio, PDF, slides and documents, with caption pairing. No size limit exists or is shown. Uploads are simulated, last only for the browser tab, and cannot be attached to a lesson or seen by students. |
| BR-06 | FR-2.4 External links and embedded media with in-browser preview | US-07 | Must | Partial | `src/components/lesson-player.tsx`, `src/components/lesson-workspace.tsx`, `src/components/content-library.tsx` (preview dialog) | Video with captions plays in the browser and reading lessons render. No external-link, document or presentation lesson types, and library items cannot be published to students. |
| BR-07 | FR-2.5 Save a course as a template; create from template | US-08 | Should | Missing | — | Nothing exists. Saved lesson plans in `src/components/lesson-plan-generator.tsx` are text plans, not course templates. |
| BR-07 | FR-2.6 Shared content library; bulk date shifting on copy | US-08 | Should | Partial | `src/components/content-library.tsx`, `src/lib/data/people.ts` (`materials`) | A library exists, filterable by type and tagged by course. It is not shared or persisted, and there is no course copy or date shifting. |
| BR-08 | FR-2.7 Automatic release at a date and time | US-09 | Should | Missing | — | Lessons have no release date; everything is always visible. |
| BR-08 | FR-2.8 Restrict visibility by section or student group | US-09 | Should | Missing | — | No sections, groups or enrollments. |

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
| BR-16 | FR-4.4 Progress reports and report-card data per student and term | US-18 | Must | Missing | — | The grades page is a live view for the signed-in learner only. No terms, no per-student report. |
| BR-16 | FR-4.5 Export final grades to the SIS format; list failed records | US-18 | Must | Missing | `src/components/gradebook-view.tsx` (`downloadCsv`), `logGradebookExport()` in `src/lib/api/grades.ts` | A plain CSV of the on-screen gradebook can be downloaded, and each export is now permission-checked and audit-logged. It is not in an SIS format and reports no failed records. |

### Epic E: Attendance and scheduling

| BR | FR | Stories | Priority | Status | Implemented today in | What is missing |
| --- | --- | --- | --- | --- | --- | --- |
| BR-17 | FR-5.1 Roster per session: Present, Absent, Late, Excused | US-19 | Must | Missing | — | No attendance, sessions or rosters. |
| BR-17 | FR-5.2 Edits within a defined window, with an audit trail | US-19 | Must | Missing | — | Depends on FR-5.1 and the audit log. |
| BR-18 | FR-5.3 Role-specific timetable and academic calendar | US-20 | Should | Missing | `src/components/dashboard-view.tsx` ("Up next") | The dashboard lists upcoming quiz due dates. There is no calendar or timetable. |
| BR-19 | FR-5.4 Admin-set attendance thresholds | US-21 | Should | Missing | — | No admin settings. |
| BR-19 | FR-5.5 Alerts to student, parent and coordinator on breach | US-21 | Should | Missing | — | No notifications. The BRD does not define who the coordinator is in the system (see observations below). |

### Epic F: Communication and collaboration

| BR | FR | Stories | Priority | Status | Implemented today in | What is missing |
| --- | --- | --- | --- | --- | --- | --- |
| BR-20 | FR-6.1 Course announcements with read tracking | US-22 | Must | Missing | — | Nothing exists. |
| BR-20 | FR-6.2 Direct messaging within role-based rules | US-22 | Must | Missing | — | Nothing exists. The rules themselves are not specified. |
| BR-20 | FR-6.3 Course forums with moderation and reporting | US-23 | Should | Missing | — | Nothing exists. |
| BR-21 | FR-6.4 Launch scheduled live sessions through the video integration | US-24 | Should | Missing | — | Nothing exists. The real provider is a backend integration; the join button and schedule are frontend. |
| BR-21 | FR-6.5 Attach recordings to the course afterwards | US-24 | Should | Missing | — | Nothing exists. |
| BR-22 | FR-6.6 Email, push and in-app notifications from configurable templates | US-25 | Must | Missing | `src/lib/api/notifications.ts`, `src/components/notification-bell.tsx` | The in-app channel exists: a `notify()` service, a bell with an unread count, and mark-as-read. Nothing in the app sends a notification yet beyond seeded examples, and there are no templates. Email and push delivery need a backend. |
| BR-22 | FR-6.7 User preferences, except mandatory alerts | US-25 | Must | Missing | — | Nothing exists. |

### Epic G: Reporting and analytics

| BR | FR | Stories | Priority | Status | Implemented today in | What is missing |
| --- | --- | --- | --- | --- | --- | --- |
| BR-23 | FR-7.1 Class performance and engagement: grade distribution, missing work, last login | US-26 | Should | Partial | `src/components/gradebook-view.tsx`, `src/components/charts.tsx` (`ColumnChart`), `src/components/home-faculty.tsx` | The gradebook shows a grade distribution, class average, submission rate and a list of learners with missing or failing work, per course and filterable by section. The faculty home summarises each course. No last login yet. |
| BR-24 | FR-7.2 School-wide usage and performance with drill-down | US-27 | Should | Missing | — | No admin area. |
| BR-24 | FR-7.3 At-risk students from configurable rules | US-27 | Should | Missing | `src/components/gradebook-view.tsx` ("Follow up with") | The gradebook flags learners below 70% or with missing work, using a rule fixed in code, per course, with no attendance input. Not configurable and not school-wide. |
| BR-25 | FR-7.4 PDF and Excel export honouring filters and permissions | US-28 | Should | Missing | — | Only CSV (gradebook) and Markdown (lesson plan) exports exist. |

### Epic H: Integration and connectivity

| BR | FR | Stories | Priority | Status | Implemented today in | What is missing |
| --- | --- | --- | --- | --- | --- | --- |
| BR-26 | FR-8.1 SIS integration for users, enrollments and grades | US-29 | Must | Backend-only | — | No mock yet. Needs an `SisAdapter` interface with mock import, sync and export, and an admin screen. |
| BR-26 | FR-8.2 Email and video-conferencing integration with health checks and failure alerts | US-29 | Must | Backend-only | — | No mock yet. Needs provider interfaces, "test connection", failure alerts and masked credentials on an admin integrations page. Credentials can only be stored securely on a server. |
| BR-27 | FR-8.3 Authenticated, rate-limited REST API with documentation | US-30 | Could | Backend-only | — | No API. This phase can deliver an OpenAPI 3 specification and a docs page; live endpoints, authentication, rate limiting and call logging are backend work. |
| Risk "connectivity gaps" | — (no FR in the matrix) | US-31 | Could | Missing | — | No offline support, web manifest or service worker. |

## Non-functional requirements

| NFR | Area | Status | Where it stands | What the backend or the project still has to provide |
| --- | --- | --- | --- | --- |
| NFR-1 | Availability, 99.5% | Backend-only | Not applicable to a static frontend. | Hosting with an uptime target, monitoring, a monthly report, and maintenance windows outside exam periods. |
| NFR-2 | Performance, under 3 s at 2,000 users | Partial | Every route is prerendered as a static shell, code is split per route, each role's home page is its own bundle, and images are optimised by `next/image`. Not measured under load. | A load test against the real backend before go-live. API response times and caching are backend concerns. |
| NFR-3 | Security and privacy | Backend-only | Mocks exist for role-based access (`can()`), route protection and an audit log. They run in the browser and secure nothing. | Encryption in transit and at rest, server-side authorization on every request, tamper-proof audit storage, a privacy assessment against the applicable law, a security review and a penetration test. |
| NFR-4 | Usability | Partial | Consistent layout, one design system, plain-language labels. Not tested with users. | A usability test with pilot faculty and students on the three core tasks (create course, post assignment, mark attendance). Two of those tasks do not exist yet. |
| NFR-5 | Accessibility, WCAG 2.1 AA | Partial | Semantic landmarks and headings, labelled controls, visible focus, keyboard-operable player, quiz and menus, live regions, reduced-motion support. Measured in Phase 0: a unit test (`src/lib/domain/contrast.test.ts`) checks every text and surface token pair in both themes (one pair failed and was fixed), and an automated axe audit of every current page for all four roles reports no WCAG 2.1 A or AA violations in light or dark. | Automated checks find only part of what WCAG requires. An audit with assistive technologies (screen readers, keyboard-only, zoom) is still needed before go-live, and each new phase must be re-audited. |
| NFR-6 | Compatibility: web, iOS, Android | Partial | Responsive layouts. Checked in Chrome at 360 px wide, in light and dark, for all four roles: no page scrolls sideways. No web manifest yet, so not installable (Phase 8). | Confirmation from the client that a responsive web app plus PWA satisfies "iOS and Android" (Q-23). A cross-device and cross-browser test matrix: only Chrome has been checked. |
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
