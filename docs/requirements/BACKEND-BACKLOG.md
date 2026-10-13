# Backend backlog

Everything that must be real on a server before go-live. This phase of the project is frontend-first: each item below has a typed interface and a mock in the browser, and this file records what has to replace the mock.

**Last updated:** 2026-10-13, after Phase 0. Items are added as each phase introduces a new mock.

## How the frontend is prepared for it

- **`src/lib/api/`** is the seam. Components never touch storage; they call hooks and async functions in these modules. Replacing a module's body with HTTP calls is the whole integration for that domain.
- **`src/lib/domain/`** holds rules with no React or storage in them (permissions, route access, grading). The backend can share them or mirror them, and their unit tests describe the expected behaviour.
- **`src/lib/api/_repository.ts`** is the mock database: one JSON value per "table" in `localStorage`. It goes away entirely.

## 1. Authentication and sessions (BR-02, FR-1.3, FR-1.4, FR-1.7)

| Needed | Mock today | Replace |
| --- | --- | --- |
| SSO with the school identity provider (SAML 2.0 or OIDC) | The SSO button signs in the demo account for the chosen role. | `signInAsDemo` in `src/lib/api/session.ts` |
| Local accounts with hashed passwords and a password policy | Any password of 6+ characters is accepted for an existing email. | `signIn` in `src/lib/api/session.ts` |
| Multi-factor authentication for admins | None yet (Phase 1 adds a mock step). | — |
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
| `api/users.ts` | Users, parent–child links | `GET /users`, `GET /me/children` |
| `api/courses.ts` | Terms, sections, enrollments, course visibility, rosters | `GET /courses`, `GET /courses/:id/roster`, `GET /terms` |
| `api/progress.ts` | Completed lessons, quiz attempts, checkpoint answers | `GET /users/:id/progress`, `POST /lessons/:id/completion`, `POST /quizzes/:id/attempts`, `POST /checkpoints/:id/answers` |
| `api/grades.ts` | Class gradebook | `GET /courses/:id/gradebook`, `POST /courses/:id/gradebook/exports` |
| `api/notifications.ts` | In-app notifications | `GET /notifications`, `POST /notifications/:id/read` |
| `api/lesson-plans.ts` | Saved lesson plans | `GET/POST/DELETE /lesson-plans` |
| `api/audit.ts` | Audit log reads | `GET /audit-events` |

Still read directly from static seed files, to be moved behind the service layer in the phase shown:

- Course catalogue, units and lessons: `src/lib/data/courses.ts` (Phase 2).
- Quizzes and questions: `src/lib/data/quizzes.ts` (Phase 3b).
- Content library items: `src/lib/data/people.ts` and component state (Phase 2).

Quiz grading currently runs in the browser (`src/lib/grading.ts`), which means the answers are shipped to the client. The server must grade attempts and never send answer keys.

## 4. Audit storage (FR-1.2, NFR-3)

| Needed | Mock today |
| --- | --- |
| Append-only, tamper-evident storage written by the server | A list in `localStorage` that the user can edit or clear, capped at 500 events. |
| Events for every denied request and every sensitive action | Written by the browser for sign-in, sign-out, denied access, gradebook export and demo reset. |
| Retention period and export for review | None. See Q-11 in `OPEN-QUESTIONS.md`. |

## 5. Notification delivery (BR-22, FR-6.6)

| Needed | Mock today |
| --- | --- |
| Email through the school email system | None. In-app only. |
| Push notifications (web push and mobile) | None. |
| Server-side fan-out, templates and delivery tracking | `notify()` in `src/lib/api/notifications.ts` writes one in-app record. |

## 6. Integrations (BR-12, BR-21, BR-26, BR-27)

Not started. Each gets an adapter interface and a mock in the phase shown.

| Integration | Phase |
| --- | --- |
| Student Information System: users, enrollments, grade export | 1, 4, 8 |
| Plagiarism service | 3a |
| Video conferencing: live sessions and recordings | 6 |
| School email system | 6, 8 |
| Open REST API: authentication, rate limiting, call logging | 8 |

## 7. Files and media (BR-06)

| Needed | Mock today |
| --- | --- |
| Upload storage, virus scanning, size limits enforced on the server | Files stay in the browser tab; progress is simulated. |
| Video transcoding and streaming | Every lesson plays one of two public sample clips. |
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
