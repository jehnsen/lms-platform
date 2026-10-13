# Open questions for the client

Points the BRD and the BA deliverables leave open, or where the two disagree. Nothing here has been decided on the client's behalf: each row records the **default the app uses for now**, and every default is either configurable or isolated in one place so it can change without rework.

**Last updated:** 2026-10-13, after Phase 0.

Status: `Open` (waiting for an answer), `Answered` (decision recorded in the row), `Deferred` (not needed until a later phase).

## About the documents themselves

| # | Question | Affects | Default used for now | Status |
| --- | --- | --- | --- | --- |
| Q-01 | US-31 (offline use) traces to "Risk R4", but the BRD's risks are not numbered and the matrix has no FR for it. Should it get an FR (for example FR-8.4)? | US-31 | Tracked under US-31 with no FR. | Open |
| Q-02 | The BA document is marked "Draft" and says FR IDs and priorities are proposed. Are they confirmed? | All | Treated as the source of truth as written. | Open |
| Q-03 | The matrix adds scope that no story tests: scheduled SIS syncs (FR-1.6), "student group" visibility (FR-2.8), configurable notification templates (FR-6.6). Are these required for go-live? | FR-1.6, FR-2.8, FR-6.6 | Built only as far as the stories' acceptance criteria require. | Open |

## Roles and access

| # | Question | Affects | Default used for now | Status |
| --- | --- | --- | --- | --- |
| Q-04 | The academic coordinator receives attendance alerts (US-21) and is in the RACI, but BR-01 defines only four roles. Is "coordinator" a fifth role, or a responsibility held by a faculty member or admin? | BR-01, US-21, FR-5.5 | Four roles only. The coordinator will be modelled as a person assigned to a section, not as a role (Phase 5). | Open |
| Q-05 | Are the IT administrator (US-29, US-30) and the Principal separate roles with different permissions, or both "Admin"? | BR-01, US-29, US-30 | Both are Admin. | Open |
| Q-06 | The default permissions per role (FR-1.1) are not specified. Please confirm or correct the defaults in `src/lib/domain/permissions.ts`. In particular: (a) parents see a linked child's grades and progress but no course content; (b) faculty see only the courses they teach; (c) admins can view and export any gradebook but cannot change scores; (d) admins can view but not edit the content library; (e) only students use the AI tutor; (f) faculty and admins cannot take quizzes. | FR-1.1, US-03, US-05 | As listed. | Open |
| Q-07 | How do parents sign in? US-02 covers students and faculty through SSO; parents are unlikely to be in the school identity provider. | BR-02, US-05 | Parents use local accounts. | Open |
| Q-08 | Password policy and MFA method for local and admin accounts (FR-1.4). | FR-1.4 | Minimum 6 characters in the mock. Policy and MFA arrive in Phase 1 as configurable settings. | Deferred (Phase 1) |
| Q-09 | How long does a session last, and is there an idle timeout? | NFR-3 | 7 days, no idle timeout (mock cookie). | Open |
| Q-10 | Can a student be in more than one section of the same course? | FR-2.1, FR-2.8 | No: one section per course. | Open |
| Q-11 | What must the audit log record, and how long is it kept? | FR-1.2, NFR-3, US-04 | Sign-in, sign-out, denied access, gradebook export and demo resets. The mock keeps the latest 500 events. | Open |
| Q-12 | Retention policy for deactivated and archived accounts and their data (US-04). | US-04, NFR-3 | Nothing is deleted. | Deferred (Phase 1) |

## Policies needed by later phases

Each becomes a configurable setting with a default when its phase is built.

| # | Question | Affects | Phase |
| --- | --- | --- | --- |
| Q-13 | Supported file formats and maximum upload size. | FR-2.3 | 2 |
| Q-14 | Default late rule (block, flag, or penalty and its percentage); whether a penalty is per day or flat. | FR-3.4 | 3a |
| Q-15 | Are short answers auto-marked by keyword (as the prototype does), always sent to manual marking, or auto-marked with manual override? FR-3.5 and US-12 disagree. | FR-3.5, FR-3.6, US-12 | 3b |
| Q-16 | How many quiz attempts are allowed, and which one counts (best, last, average)? | FR-3.7, FR-4.2 | 3b |
| Q-17 | Grading scale bands and the GPA mapping; default grade categories and weights. | FR-4.1, FR-4.2 | 4 |
| Q-18 | The SIS export format. | FR-4.5, FR-8.1 | 4 |
| Q-19 | Attendance threshold; how Late and Excused count towards it; the window in which attendance can be edited. | FR-5.2, FR-5.4 | 5 |
| Q-20 | Who may message whom (for example, may students message each other; may parents message faculty)? Child-safety rules apply. | FR-6.2 | 6 |
| Q-21 | Which alerts are mandatory and cannot be switched off. | FR-6.7 | 6 |
| Q-22 | At-risk rules and their thresholds. | FR-7.3 | 7 |

## Platform and scope

| # | Question | Affects | Default used for now | Status |
| --- | --- | --- | --- | --- |
| Q-23 | NFR-6 says "web, iOS and Android" and US-31 says "the mobile app". Are native apps required, or does a responsive web app that can be installed (PWA) satisfy this? | NFR-6, US-31 | Responsive web app, tested down to 360 px, with a PWA planned in Phase 8. | Open |
| Q-24 | The prototype includes an AI tutor, an AI lesson planner, in-video checkpoint questions and auto-captioning, none of which are in the BRD. Are they in scope for go-live, and may student content be sent to an AI provider under the applicable privacy law? | NFR-3, scope | Kept in the app, simulated, with no data leaving the browser. | Open |
