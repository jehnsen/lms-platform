# Backend backlog

Everything that must be real on a server before go-live. This phase of the project is frontend-first: each item below has a typed interface and a mock in the browser, and this file records what has to replace the mock.

**Last updated:** 2026-10-14, after Phase 3b. Items are added as each phase introduces a new mock.

## How the frontend is prepared for it

- **`src/lib/api/`** is the seam. Components never touch storage; they call hooks and async functions in these modules. Replacing a module's body with HTTP calls is the whole integration for that domain.
- **`src/lib/domain/`** holds rules with no React or storage in them (permissions, route access, grading). The backend can share them or mirror them, and their unit tests describe the expected behaviour.
- **`src/lib/api/_repository.ts`** is the mock database: one JSON value per "table" in `localStorage`. It goes away entirely.
- **`src/lib/adapters/`** holds one typed interface per outside system, each with a mock. The real implementations live on the server; the browser never holds their credentials.

| Adapter | Interface | Mock today | Used by |
| --- | --- | --- | --- |
| School identity provider | `IdentityProvider` in `adapters/identity-provider.ts` | `createMockIdentityProvider`: asserts the email it is given if the directory has it. | `signInWithSso()` |
| Student Information System | `SisAdapter` in `adapters/sis.ts` | `mockSis`: a fixed roster of seven records. | `syncFromSis()` |
| Plagiarism checking service | `PlagiarismProvider` in `adapters/plagiarism.ts` | `mockPlagiarismProvider`: a score derived from the text; nothing is compared. | `submitAssignment()`, `runSimilarityCheck()` |

## 1. Authentication and sessions (BR-02, FR-1.3, FR-1.4, FR-1.7)

| Needed | Mock today | Replace |
| --- | --- | --- |
| SSO with the school identity provider (SAML 2.0 or OIDC) | A mock provider asserts the email typed into the form; no redirect and no token. | `signInWithSso` in `src/lib/api/session.ts` and the mock in `src/lib/adapters/identity-provider.ts`. The server must validate the ID token or SAML assertion itself. |
| Local accounts with hashed passwords and a password policy | A password set by an admin is kept in `localStorage` as a weak digest, not a real password hash; accounts without one accept any password of 6+ characters. The policy is checked in the browser. | `signIn` in `src/lib/api/session.ts`, `src/lib/api/_credentials.ts`, `setUserPassword` in `src/lib/api/users.ts`. Store Argon2id or bcrypt hashes; enforce `src/lib/domain/password-policy.ts` on the server. |
| Self-service password change and reset | None. Only an admin can set a password. | New endpoints and an email flow. |
| Multi-factor authentication for admins | One fixed demo code, checked in the browser, with 5 tries and a 5-minute expiry held in memory. | `verifyMfa` in `src/lib/api/session.ts`. Real enrolment, TOTP or another method (Q-08), recovery codes, server-side rate limiting. |
| Lock-out and rate limiting on sign-in | None. | Server-side. |
| A session the browser cannot forge | An unsigned cookie written by the browser: `lms_session = { userId, role }`. | `src/lib/domain/session-cookie.ts`; issue an encrypted, HttpOnly, Secure cookie from the server |
| Session expiry and sign-out everywhere | Fixed 7-day cookie. | Server-side sessions |
| Blocking sign-in for inactive and archived accounts | Checked in the browser against the mock users table. | Server check at sign-in and on every request |

## 2. Authorization (BR-01, FR-1.1, FR-1.2)

**The frontend checks are not a security boundary.** `can()`, the route guard and `src/proxy.ts` decide what the interface offers; anyone can bypass them in the browser.

| Needed | Mock today | Replace |
| --- | --- | --- |
| Permission check on every request, on the server | `authorize()` in `src/lib/api/session.ts`, called by each service function. | The same matrix (`src/lib/domain/permissions.ts`) enforced in the API |
| Record-level scoping (own, child, course) decided from server data | Scopes are resolved from enrollments held in the browser. | Server resolves relationships; the client is never trusted for them |
| Responses that contain only what the caller may see | Every "table" is fully present in the browser's storage. | API returns filtered data |
| Optimistic redirect before a page is served | `src/proxy.ts` reads the mock cookie. | Keep the proxy, but have it verify the real session cookie |

## 3. Persistence (all epics)

Replace each mock repository with database tables and API endpoints.

| Service module | Holds | Endpoints it will need |
| --- | --- | --- |
| `api/session.ts` | Session, current user | `POST /auth/sign-in`, `POST /auth/sign-out`, `GET /me` |
| `api/users.ts` | Users, roles, statuses, parent–child links, passwords, bulk import | `GET /users`, `GET /me/children`, `PATCH /users/:id`, `PUT /users/:id/password`, `PUT` and `DELETE /users/:id/children/:studentId`, `POST /users/imports` (dry run and commit) |
| `api/courses.ts` | Courses with units and lessons, sections and schedules, enrollments, course visibility, rosters, templates, terms, term archive | `GET /courses`, `GET /courses/:id`, `POST /courses` (blank, from a template, or a copy with a date shift), `PUT /courses/:id`, `GET /courses/:id/roster`, `GET`, `POST` and `DELETE /course-templates`, `GET /terms`, `POST /terms/:id/archive`, `POST /terms/:id/reopen` |
| `api/materials.ts` | Content library items, captions, and the files behind them | `GET /materials`, `POST /materials` (upload), `PATCH /materials/:id`, `DELETE /materials/:id`, `GET /courses/:id/lessons/:lessonId/file` |
| `api/assignments.ts` | Assignments with rubrics and attachments, submissions with files, inline comments, grades and their release, similarity reports | `GET` and `POST /assignments`, `GET`, `PUT` and `DELETE /assignments/:id`, `GET` and `POST /assignments/:id/submissions`, `PUT /submissions/:id/grade`, `POST` and `DELETE /submissions/:id/comments`, `POST /assignments/:id/release`, `POST /submissions/:id/similarity`, file downloads |
| `api/settings.ts` | School settings: password policy, retention period, upload size limits, default late rule, submission size limit, who sees similarity reports | `GET /settings`, `PUT /settings` |
| `api/progress.ts` | Completed lessons, checkpoint answers, and reading a learner's attempts | `GET /users/:id/progress`, `POST /lessons/:id/completion`, `POST /checkpoints/:id/answers` |
| `api/quizzes.ts` | Quizzes and questions, the question bank, attempts in progress, handed-in attempts, the grading queue | `GET` and `POST /quizzes`, `GET`, `PUT` and `DELETE /quizzes/:id`, `POST /quizzes/:id/attempts`, `PATCH /attempts/:id`, `POST /attempts/:id/submit`, `GET /grading-queue`, `PUT /attempts/:id/marks/:questionId`, `GET`, `POST` and `DELETE /question-bank` |
| `api/grades.ts` | Class gradebook | `GET /courses/:id/gradebook`, `POST /courses/:id/gradebook/exports` |
| `api/notifications.ts` | In-app notifications | `GET /notifications`, `POST /notifications/:id/read` |
| `api/lesson-plans.ts` | Saved lesson plans | `GET/POST/DELETE /lesson-plans` |
| `api/audit.ts` | Audit log reads | `GET /audit-events` |

Nothing is read straight from a seed file any more. The course catalogue and the content library moved behind the service layer in Phase 2 and quizzes in Phase 3b; `src/lib/data/courses.ts`, `quizzes.ts` and `people.ts` are now only seeds. (The student dashboard still shows fixed sample numbers for study time and streak from `people.ts`.)

**Content visibility (US-09).** `GET /courses` and `GET /courses/:id` must return only the lessons the caller may see: nothing scheduled for later and nothing restricted to another section. The rule is `courseForViewer()` in `src/lib/domain/content-visibility.ts`. Today the whole course is in the browser's storage and the filter runs there, so a student who inspects storage can read an unreleased lesson. The same applies to lesson files: `GET /courses/:id/lessons/:lessonId/file` must check that the caller may see that lesson.

**Quizzes (BR-11).** Everything the browser decides today must be decided by the server:

- **The answer key.** A quiz reaches the browser whole, answers included, and is marked there by `src/lib/grading.ts`. The server must mark attempts and send a student only the questions, with the right-hand choices of matching questions already shuffled.
- **The time limit.** `remainingMs()` in `src/lib/domain/quizzes.ts` is evaluated against the browser's clock. The server must stamp the start, refuse answers after the limit, and hand the attempt in itself when the limit is reached, whether or not the student's browser is open. Today `settleExpiredAttempts()` does that only when the student next opens the app.
- **Autosave.** `saveDraftAnswers()` writes to local storage on every change. It becomes `PATCH /attempts/:id`, and the client needs to queue saves and show when one has failed.
- **Attempt limits.** `startDecision()` counts attempts held in the browser.
- **Manual marks.** `applyManualMark()` reworks the total in the browser; the server must do it and own the final score.

Bulk import: the CSV file is parsed and validated in the browser (`previewUserImport`). The server must parse the uploaded file and run the rules in `src/lib/domain/user-import.ts` itself, inside one transaction, and enforce unique email and SIS ID with database constraints.

**Assignments (Epic C).** Everything the browser decides today must be decided by the server:

- **Lateness.** `submitAssignment()` reads the browser's clock. The server must stamp the submission time and apply `lateOutcome()` from `src/lib/domain/assignments.ts` itself.
- **Who may hand in.** Published, set for the student's section, resubmission allowed, course not archived: `submitDecision()` and `isSetFor()`.
- **What a student receives.** `forStudent()` strips the unreleased mark, feedback, inline comments and the similarity report in the browser; the full record is in the same storage. The API must never send them.
- **Marks.** `gradeFor()` totals the rubric and applies the late penalty; the server must recompute both rather than accept a total.
- **Files.** Attachments and submitted files are in IndexedDB. The server needs storage, virus scanning, type and size checks, and downloads authorized per submission.
- **Receipts.** `receiptCode()` is a readable checksum, not proof. A real receipt should be issued and stored by the server, and ideally emailed.

### Scheduled jobs

None of these can run in a browser. Each has a manual stand-in or a recorded setting today.

| Job | Stand-in today |
| --- | --- |
| Archive a term on its end date (US-04) | An admin presses "Archive term"; a term past its end date is flagged. |
| Scheduled SIS sync (FR-1.6) | An admin presses "Sync from SIS". |
| Delete data when the retention period ends (US-04, Q-12) | The period is stored in settings; nothing is deleted. |

## 4. Audit storage (FR-1.2, NFR-3)

| Needed | Mock today |
| --- | --- |
| Append-only, tamper-evident storage written by the server | A list in `localStorage` that the user can edit or clear, capped at 500 events. |
| Events for every denied request and every sensitive action | Written by the browser for sign-in, sign-out, failed second-step codes, denied access, role and status changes, parent–child links, password sets, imports, SIS syncs, term archive and reopen, settings changes, gradebook export and demo reset. |
| Retention period and export for review | None. See Q-11 in `OPEN-QUESTIONS.md`. |

## 5. Notification delivery (BR-22, FR-6.6)

| Needed | Mock today |
| --- | --- |
| Email through the school email system | None. In-app only. |
| Push notifications (web push and mobile) | None. |
| Server-side fan-out, templates and delivery tracking | `notify()` in `src/lib/api/notifications.ts` writes one in-app record. |

## 6. Integrations (BR-12, BR-21, BR-26, BR-27)

Each gets an adapter interface and a mock in the phase shown.

| Integration | Phase |
| --- | --- |
| Student Information System: roster import (mock built in Phase 1: `src/lib/adapters/sis.ts`). Still to come: updating and deactivating existing users (Q-25), grade export, connection test | 1, 4, 8 |
| School identity provider (mock built in Phase 1: `src/lib/adapters/identity-provider.ts`) | 1 |
| Plagiarism service (mock built in Phase 3a: `src/lib/adapters/plagiarism.ts`). The real one is asynchronous: submit, then receive the report by callback or polling. Student work may only be sent once the school has agreed terms with the provider (Q-42) | 3a |
| Video conferencing: live sessions and recordings | 6 |
| School email system | 6, 8 |
| Open REST API: authentication, rate limiting, call logging | 8 |

## 7. Files and media (BR-06)

| Needed | Mock today |
| --- | --- |
| Upload storage, virus scanning, format and size limits enforced on the server | Files are kept in the browser's IndexedDB (`src/lib/api/_files.ts`), so they exist only on the device that uploaded them. The format and size check (`src/lib/domain/uploads.ts`) runs in the browser against limits from settings. Transfer progress is simulated. |
| Authorized, expiring download URLs | The file is read from IndexedDB and handed to the page as an object URL. |
| Embedded third-party media under a Content Security Policy | YouTube and Vimeo links are embedded with `youtube-nocookie.com` and `player.vimeo.com` frames (`src/lib/domain/links.ts`); no CSP is set. The backend or hosting layer should send a `frame-src` allow-list. |
| Video transcoding and streaming | A lesson plays an uploaded file straight from the browser's storage, or one of two public sample clips. |
| Caption generation | "Auto-caption" produces placeholder captions. |

## 8. AI services (beyond the BRD)

| Needed | Mock today |
| --- | --- |
| Tutor responses | Template-based, in `src/lib/mock-ai/tutor.ts`. |
| Lesson plan generation | Template-based, in `src/lib/mock-ai/lesson-plan.ts`. |

Whether these ship, and what student data may be sent to a model provider, is Q-24 in `OPEN-QUESTIONS.md`.

## 9. Non-functional requirements owned by the backend and IT

| NFR | What has to be provided |
| --- | --- |
| NFR-1 Availability | Hosting with a 99.5% uptime target, monitoring, a monthly report, maintenance windows outside exam periods. |
| NFR-2 Performance | A load test at 2,000 concurrent users against the real API; response-time budgets; caching. |
| NFR-3 Security and privacy | Encryption in transit and at rest; server-side authorization; audit storage; a privacy assessment against the applicable law (FERPA, GDPR or local equivalent); security review and penetration test. |
| NFR-7 Scalability | Data model, storage and hosting that grow year over year without redesign; a capacity review each term. |
| NFR-8 Backup and recovery | Daily backups, defined recovery time and recovery point objectives, periodic restore drills. |
