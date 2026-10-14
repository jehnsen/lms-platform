# Open questions for the client

Points the BRD and the BA deliverables leave open, or where the two disagree. Nothing here has been decided on the client's behalf: each row records the **default the app uses for now**, and every default is either configurable or isolated in one place so it can change without rework.

**Last updated:** 2026-10-14, after Phase 2. New in Phase 2: Q-32 to Q-36; default recorded for Q-13; **Q-25 now blocks term rollover** (see its row). New in Phase 1: Q-25 to Q-31.

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
| Q-07 | How do parents sign in? US-02 covers students and faculty through SSO; parents are unlikely to be in the school identity provider. | BR-02, US-05 | Parents use local accounts: an admin sets the password on the Users page. The mock identity provider knows students, faculty and admins only, and tells a parent to use their email and password. | Open |
| Q-08 | Password policy and MFA method for local and admin accounts (FR-1.4). | FR-1.4 | Policy: at least 8 characters with an uppercase letter, a lowercase letter and a number; symbols optional. Admins change it under Admin → Settings (`DEFAULT_PASSWORD_POLICY` in `src/lib/domain/password-policy.ts`). MFA: a 6-digit code from an authenticator app, asked at every admin sign-in, 5 tries, valid for 5 minutes; not optional. | Open |
| Q-09 | How long does a session last, and is there an idle timeout? | NFR-3 | 7 days, no idle timeout (mock cookie). | Open |
| Q-10 | Can a student be in more than one section of the same course? | FR-2.1, FR-2.8 | No: one section per course. | Open |
| Q-11 | What must the audit log record, and how long is it kept? | FR-1.2, NFR-3, US-04 | Sign-in, sign-out, failed second-step codes, denied access, role and status changes, parent–child links, passwords being set (never the password), imports and SIS syncs, term archive and reopen, settings changes, gradebook export and demo resets. The mock keeps the latest 500 events. | Open |
| Q-12 | Retention policy for deactivated and archived accounts and their data (US-04). | US-04, NFR-3 | Kept indefinitely. Admins can set a number of years under Admin → Settings; the app records it but deletes nothing, because deleting is a server job. | Open |
| Q-25 | Should a CSV import or SIS sync update people who already have an account (name, sections) and deactivate people who have left? The stories only say duplicates are "not created twice". **This now matters in practice:** a course made or copied in the course builder has empty sections, and the only way students get into a section is an import or sync, which skips everyone who already has an account. Until this is decided, existing students cannot be placed in a new course. | US-01, US-06, US-08, FR-1.6, FR-8.1 | Existing accounts are skipped and left untouched. So an import cannot move an existing student to another section or add them to a new course. | Open, blocking |
| Q-26 | May admin accounts be created by bulk import? | US-01, BR-01 | Yes, like any other role. | Open |
| Q-27 | When an admin signs in through SSO, does the identity provider's own MFA satisfy FR-1.4, or must the LMS ask again? | FR-1.3, FR-1.4 | The LMS always asks for the second step, after a password or SSO. | Open |
| Q-28 | Can an archived term be reopened, and by whom? | US-04, FR-1.8 | An admin can reopen it; the reopening is audit-logged. | Open |
| Q-29 | At term end, should accounts be archived automatically (for example a graduating class), or only by an admin? | BR-04, US-04 | Only by an admin, one account or many at once, on the Users page. Archiving a term does not change any account. | Open |
| Q-30 | When someone's role changes, what happens to their sections and linked children? | US-03 | They are kept but have no effect under the new role, and apply again if the role is changed back. | Open |
| Q-31 | What columns does the school's CSV or SIS feed use, and how are sections identified in it? | US-01, FR-1.5, FR-8.1 | Columns `name`, `email`, `role`, `sections`, `sis_id`, `children`. Sections are identified by a code made of the course code and the section name, for example `CS-110-A`; several are separated by semicolons. The code is rebuilt when a course code or section name changes. | Open |
| Q-13 | Supported file formats and maximum upload size. | FR-2.3, US-07 | Video (MP4, WebM, MOV, M4V) 500 MB; audio (MP3, WAV, M4A, OGG) 100 MB; documents (PDF, DOC, DOCX, TXT, MD) 50 MB; slides (PPT, PPTX, ODP, KEY) 50 MB. Admins change the limits under Admin → Settings; the list of formats is in `src/lib/domain/uploads.ts`. | Open |
| Q-32 | Who creates courses, and how do other teachers get onto one? | FR-2.1, US-06, BR-01 | Faculty create courses; the creator teaches every section of a new course. Admins can edit any course but not create one. Nobody can add a second teacher to a section yet. | Open |
| Q-33 | Can a course be deleted, and does a course need a draft state before students see it? | FR-2.1 | No delete and no draft state. A new course is invisible to students anyway until they are placed in its sections; single lessons are held back with a release time. | Open |
| Q-34 | Which time zone do release times and deadlines use? | FR-2.7, FR-3.4, FR-5.3 | The person entering the time uses their own device's time zone; the moment is stored in UTC and shown to each viewer in theirs. Date-only values (term and course dates) are plain calendar dates. | Open |
| Q-35 | Should a teacher be able to restrict or schedule a whole unit, or a quiz, and not only single lessons? | FR-2.7, FR-2.8, US-09 | Lessons only. Quizzes get a release time when they move into the service layer (Phase 3b). | Open |
| Q-36 | May teachers use any content library item, or only items for their own courses? And who may remove an item? | FR-2.6 | Every faculty member sees and can use every item, and can remove any item that no lesson uses. | Open |

## Policies needed by later phases

Each becomes a configurable setting with a default when its phase is built.

| # | Question | Affects | Phase |
| --- | --- | --- | --- |
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
