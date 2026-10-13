# School Learning Management System

User Stories, BRD-to-FRS Mapping and Stakeholder RACI

Companion to the Business Requirements Document (BR-01 to BR-27) for a Learning Management System used by students and faculty.

Status: Draft for stakeholder review

## How to read this document

- Section 1 turns each business requirement into user stories with acceptance criteria, grouped by epic.
- Section 2 traces every business requirement (BR) to functional requirements (FR), stories and a verification method, and lists the non-functional requirements.
- Section 3 sets out who is Responsible, Accountable, Consulted and Informed for delivery and operation.
- Priorities use MoSCoW: Must (needed for go-live), Should (important, can follow shortly), Could (nice to have).
- FR IDs and priorities are proposed and should be confirmed with stakeholders before functional specifications are signed off.
## 1. User Stories

Format: As a [role], I want [capability], so that [benefit]. Acceptance criteria use Given/When/Then where behavior depends on a condition.

### Epic A: User and Access Management (BR-01 to BR-04)

#### US-01 — Administrator (Must, BR-03)
I want to bulk-onboard students and faculty from the SIS or a CSV file, so that accounts are ready before the term starts without manual entry

Acceptance criteria:
- Given a valid CSV or SIS feed, when I run the import, then accounts are created with the correct role and section.
- Given invalid rows, when the import finishes, then a row-level error report is shown and the valid rows are still created.
- Duplicate users are detected and not created twice.

#### US-02 — Student or faculty member (Must, BR-02)
I want to sign in with my school account (SSO), so that I do not have to manage another password

Acceptance criteria:
- Given a valid school account, when I sign in through SSO, then I land on my role-specific home page.
- Given a deactivated account, when I try to sign in, then access is denied with a clear message.

#### US-03 — Administrator (Must, BR-01)
I want to assign and change user roles (Student, Faculty, Admin, Parent), so that each person only sees what their role permits

Acceptance criteria:
- Given the Student role, when the user opens another student's grades, then access is blocked and the attempt is logged.
- Role changes take effect on next page load and are recorded in the audit log.

#### US-04 — Administrator (Must, BR-04)
I want to deactivate or archive accounts and courses at term end, so that records are preserved but no longer editable

Acceptance criteria:
- Given a term end date, when archival runs, then courses become read-only and grades remain viewable by authorized users.
- Deactivated accounts cannot sign in, and data is retained according to the retention policy.

#### US-05 — Parent or guardian (Should, BR-01)
I want an account linked to my child, so that I can follow their progress and attendance

Acceptance criteria:
- Given a linked child, when I sign in, then I see only that child's grades, attendance and announcements.
- I cannot see other students' data or submit work on behalf of the child.

### Epic B: Course and Content Management (BR-05 to BR-08)

#### US-06 — Faculty member (Must, BR-05)
I want to create a course with units, lessons and a schedule, so that students have a clear structure to follow

Acceptance criteria:
- Given a new course, when I add units and lessons, then they appear in order in the student view.
- Course dates feed the calendar for enrolled students.

#### US-07 — Faculty member (Must, BR-06)
I want to upload documents, videos, links and presentations, so that all learning materials are in one place

Acceptance criteria:
- Supported formats upload with progress shown, and size limits are displayed before upload.
- Given a published item, when a student opens it, then it displays or downloads on web and mobile.

#### US-08 — Faculty member (Should, BR-07)
I want to copy a previous course or start from a template, so that I do not rebuild courses every term

Acceptance criteria:
- Given a template, when I create a course from it, then structure and content are copied without student data.
- Dates in the copied course can be shifted in bulk.

#### US-09 — Faculty member (Should, BR-08)
I want to schedule content release and restrict it to specific sections, so that each class sees the right material at the right time

Acceptance criteria:
- Given a release date, the content stays hidden until that date and time.
- Given a section restriction, only students enrolled in that section can see the item.

### Epic C: Assignments and Assessments (BR-09 to BR-13)

#### US-10 — Faculty member (Must, BR-09)
I want to create an assignment with a due date, rubric and attachments, so that expectations are clear and grading is consistent

Acceptance criteria:
- The assignment publishes to selected sections with the due date shown.
- Rubric criteria and point totals are validated before publishing.

#### US-11 — Student (Must, BR-10)
I want to submit my work online before the due date, so that I do not need paper or email

Acceptance criteria:
- Given an open assignment, when I upload my work, then I receive a timestamped confirmation.
- Given a late submission, then the configured late rule (block, flag or penalty) is applied and shown to me.
- Resubmission is allowed only if the faculty member enabled it.

#### US-12 — Faculty member (Must, BR-11)
I want to build quizzes with auto-graded objective questions, so that grading time is reduced

Acceptance criteria:
- Multiple choice, true/false and matching questions are auto-scored.
- Questions needing manual marking go to a grading queue, and final scores post to the gradebook.

#### US-13 — Student (Must, BR-11)
I want to take a timed quiz online, so that I can complete tests without being in a classroom

Acceptance criteria:
- The timer is always visible and answers autosave.
- Given the time limit is reached, then the attempt is submitted automatically.

#### US-14 — Faculty member (Should, BR-12)
I want to see a similarity report on student submissions, so that I can check originality

Acceptance criteria:
- A report is generated per submission through the integrated plagiarism tool.
- Reports are visible to faculty only unless the school configures otherwise.

#### US-15 — Faculty member (Must, BR-13)
I want to give inline comments and rubric-based feedback, so that students understand how to improve

Acceptance criteria:
- Comments are anchored to specific parts of the submission.
- Rubric scores total automatically, and feedback is visible once grades are released.

### Epic D: Grading and Progress Tracking (BR-14 to BR-16)

#### US-16 — Faculty member (Must, BR-14)
I want to configure gradebook categories, weights and the grading scale, so that final grades follow school policy

Acceptance criteria:
- Category weights must total 100% before they can be saved.
- The final grade recalculates automatically when any score changes, and the scale (percentage, letter or GPA) is selectable.

#### US-17 — Student (Must, BR-15)
I want to see my grades and feedback as soon as they are released, so that I always know where I stand

Acceptance criteria:
- Only released grades are visible, and a running course total is shown.
- A notification is sent when new grades are released.

#### US-18 — Administrator (Must, BR-16)
I want to export final grades and report-card data to the SIS, so that records do not have to be re-keyed

Acceptance criteria:
- The export uses an SIS-compatible format.
- Failed records are listed with the reason, and every export is audit-logged.

### Epic E: Attendance and Scheduling (BR-17 to BR-19)

#### US-19 — Faculty member (Must, BR-17)
I want to mark attendance for each class session, so that attendance is recorded accurately and quickly

Acceptance criteria:
- The roster loads per session with Present, Absent, Late and Excused options.
- Edits after submission are allowed within a set window and are logged.

#### US-20 — Student (Should, BR-18)
I want to see my timetable and the academic calendar, so that I know when classes, deadlines and exams happen

Acceptance criteria:
- The calendar shows classes, due dates and exams, filterable by course.
- Changes to a class or deadline appear on the calendar immediately.

#### US-21 — Parent or guardian (Should, BR-19)
I want to be alerted when my child's attendance drops below the threshold, so that we can act early

Acceptance criteria:
- Given a threshold set by the administrator, when attendance falls below it, then an alert goes to the student, parent and academic coordinator.
- Alerts are sent once per breach and not repeated daily.

### Epic F: Communication and Collaboration (BR-20 to BR-22)

#### US-22 — Faculty member (Must, BR-20)
I want to post announcements and message my class, so that everyone receives the same information

Acceptance criteria:
- An announcement appears on the course page and is sent through the selected channels.
- I can see how many students have read it.

#### US-23 — Student (Should, BR-20)
I want to take part in course discussion forums, so that I can ask questions and collaborate with classmates

Acceptance criteria:
- Threads are organized per course, and faculty can moderate them.
- Inappropriate posts can be reported and hidden.

#### US-24 — Faculty member (Should, BR-21)
I want to start a live online class from the course page, so that students join without separate links

Acceptance criteria:
- The join button appears at the scheduled time.
- The recording is linked to the course after the session ends.

#### US-25 — Student (Must, BR-22)
I want to choose how I receive notifications, so that I do not miss deadlines or announcements

Acceptance criteria:
- Email, push and in-app notifications can be turned on or off individually.
- Critical alerts such as exam changes cannot be disabled.

### Epic G: Reporting and Analytics (BR-23 to BR-25)

#### US-26 — Faculty member (Should, BR-23)
I want to see a class performance and engagement dashboard, so that I can spot struggling students early

Acceptance criteria:
- The dashboard shows grade distribution, missing work and last login, filterable by section.
- Data refreshes at least daily.

#### US-27 — Administrator (Should, BR-24)
I want to view school-wide usage and a list of at-risk students, so that the school can intervene early

Acceptance criteria:
- At-risk rules (for example low grades plus low attendance) are configurable.
- I can drill down from school to class level, and access is limited to authorized roles.

#### US-28 — Administrator (Should, BR-25)
I want to export reports as PDF or Excel, so that I can share them with leadership

Acceptance criteria:
- Exports match the filters shown on screen.
- Exports include only the data the requesting role is permitted to see.

### Epic H: Integration and Connectivity (BR-26, BR-27, Risk R4)

#### US-29 — IT administrator (Must, BR-26)
I want to connect the LMS to the SIS, school email and video conferencing tool, so that data flows without manual work

Acceptance criteria:
- Each connection can be tested from the admin console.
- Sync failures raise an alert, and credentials are stored securely.

#### US-30 — IT administrator or developer (Could, BR-27)
I want to use a documented open API, so that future systems can integrate with the LMS

Acceptance criteria:
- The API is authenticated, rate-limited and documented.
- API calls are audit-logged.

#### US-31 — Student with limited connectivity (Could, Risk R4)
I want to download materials for offline use, so that I can keep learning when my internet is unstable

Acceptance criteria:
- Selected materials can be downloaded in the mobile app.
- Progress and submissions sync when I am back online.

## 2. BRD-to-FRS Mapping (Traceability Matrix)

Each business requirement is decomposed into one or more functional requirements, linked to the user stories that describe them and the method that will verify them.

| BR ID | Business requirement | FR ID | Functional requirement | User stories | Verification |
|---|---|---|---|---|---|
| BR-01 | Role-based access for Student, Faculty, Admin and Parent | FR-1.1 | System shall provide a role-permission matrix for Student, Faculty, Admin and Parent, with default permissions per role. | US-03, US-05 | Test (UAT / system test) |
|  |  | FR-1.2 | System shall enforce permissions server-side on every request and log denied attempts. | US-03 | Test (UAT / system test) |
| BR-02 | SSO or school-managed accounts | FR-1.3 | System shall support SSO through SAML 2.0 or OIDC with the school identity provider. | US-02 | Test (UAT / system test) |
|  |  | FR-1.4 | System shall support school-managed local accounts with password policy, and multi-factor authentication for Admin roles. | US-02 | Test (UAT / system test) |
| BR-03 | Bulk onboarding from SIS or CSV | FR-1.5 | System shall import users from a CSV template or SIS feed, validate each row and produce an error report. | US-01 | Test (UAT / system test) |
|  |  | FR-1.6 | System shall detect duplicates and support scheduled and manual SIS syncs. | US-01 | Test (UAT / system test) |
| BR-04 | Activate, deactivate and archive accounts at term end | FR-1.7 | System shall support account statuses (active, inactive, archived) and block sign-in for non-active accounts. | US-04 | Test (UAT / system test) |
|  |  | FR-1.8 | System shall archive courses at term end as read-only while keeping grades accessible. | US-04 | Test (UAT / system test) |
| BR-05 | Create courses with units, lessons and schedules | FR-2.1 | System shall let faculty create courses with name, code, term, sections and schedule. | US-06 | Demo (walkthrough with faculty) |
|  |  | FR-2.2 | System shall support a unit and lesson hierarchy with drag-and-drop ordering. | US-06 | Demo (walkthrough with faculty) |
| BR-06 | Support documents, video, links and presentations | FR-2.3 | System shall accept common document, video and presentation formats up to a configurable size limit. | US-07 | Test (UAT / system test) |
|  |  | FR-2.4 | System shall support external links and embedded media with in-browser preview. | US-07 | Test (UAT / system test) |
| BR-07 | Reusable templates and content libraries | FR-2.5 | System shall let faculty save a course as a template and create new courses from it. | US-08 | Demo (walkthrough with faculty) |
|  |  | FR-2.6 | System shall maintain a shared content library with bulk date shifting when courses are copied. | US-08 | Demo (walkthrough with faculty) |
| BR-08 | Scheduled release and section restriction | FR-2.7 | System shall release content automatically at a set date and time. | US-09 | Test (UAT / system test) |
|  |  | FR-2.8 | System shall restrict content visibility by section or student group. | US-09 | Test (UAT / system test) |
| BR-09 | Assignments with due dates, rubrics and attachments | FR-3.1 | System shall let faculty create assignments with instructions, due date, points, attachments and target sections. | US-10 | Test (UAT / system test) |
|  |  | FR-3.2 | System shall provide a rubric builder with criteria, levels and weighted points. | US-10, US-15 | Demo (walkthrough with faculty) |
| BR-10 | Online submission with late rules | FR-3.3 | System shall accept file and text submissions and issue a timestamped receipt. | US-11 | Test (UAT / system test) |
|  |  | FR-3.4 | System shall apply configurable late rules (block, flag or percentage penalty) and optional resubmission. | US-11 | Test (UAT / system test) |
| BR-11 | Quizzes with auto-grading | FR-3.5 | System shall provide a question bank supporting multiple choice, true/false, matching and short answer. | US-12 | Test (UAT / system test) |
|  |  | FR-3.6 | System shall auto-grade objective questions, queue manual items, and post scores to the gradebook. | US-12 | Test (UAT / system test) |
|  |  | FR-3.7 | System shall support timed attempts with autosave and automatic submission at timeout. | US-13 | Test (UAT / system test) |
| BR-12 | Plagiarism check integration | FR-3.8 | System shall send submissions to the plagiarism service and show a similarity report to faculty. | US-14 | Test (UAT / system test) |
| BR-13 | Inline feedback and rubrics | FR-3.9 | System shall support inline comments on submissions and rubric scoring that totals automatically. | US-15 | Demo (walkthrough with faculty) |
| BR-14 | Gradebook with weighting and grading scales | FR-4.1 | System shall provide a gradebook per course with categories and weights that must total 100%. | US-16 | Test (UAT / system test) |
|  |  | FR-4.2 | System shall calculate final grades automatically and support percentage, letter and GPA scales. | US-16 | Test (UAT / system test) |
| BR-15 | Real-time grades and feedback for students | FR-4.3 | System shall show students released grades and feedback, with grade release control per item. | US-17 | Test (UAT / system test) |
| BR-16 | Progress reports and export to SIS | FR-4.4 | System shall generate progress reports and report-card data per student and term. | US-18 | Test (UAT / system test) |
|  |  | FR-4.5 | System shall export final grades to the SIS in its required format and list failed records. | US-18 | Test (UAT / system test) |
| BR-17 | Attendance per class or session | FR-5.1 | System shall load a roster per session and record Present, Absent, Late or Excused. | US-19 | Test (UAT / system test) |
|  |  | FR-5.2 | System shall allow edits within a defined window and keep an audit trail. | US-19 | Test (UAT / system test) |
| BR-18 | Timetable and academic calendar | FR-5.3 | System shall display a role-specific timetable and academic calendar including due dates and exams. | US-20 | Demo (walkthrough with faculty) |
| BR-19 | Low-attendance alerts | FR-5.4 | System shall let admins set attendance thresholds. | US-21 | Test (UAT / system test) |
|  |  | FR-5.5 | System shall send alerts to the student, parent and coordinator when a threshold is breached. | US-21 | Test (UAT / system test) |
| BR-20 | Announcements, messaging and forums | FR-6.1 | System shall support course announcements with read tracking. | US-22 | Test (UAT / system test) |
|  |  | FR-6.2 | System shall support direct messaging within role-based rules. | US-22 | Test (UAT / system test) |
|  |  | FR-6.3 | System shall provide course discussion forums with moderation and reporting tools. | US-23 | Test (UAT / system test) |
| BR-21 | Virtual classroom integration | FR-6.4 | System shall launch scheduled live sessions from the course through the video conferencing integration. | US-24 | Test (UAT / system test) |
|  |  | FR-6.5 | System shall attach session recordings to the course after the session. | US-24 | Test (UAT / system test) |
| BR-22 | Email, push and in-app notifications | FR-6.6 | System shall send notifications through email, push and in-app channels from configurable templates. | US-25 | Test (UAT / system test) |
|  |  | FR-6.7 | System shall let users manage preferences, except for mandatory alerts. | US-25 | Test (UAT / system test) |
| BR-23 | Faculty dashboards | FR-7.1 | System shall show class performance and engagement (grade distribution, missing work, last login). | US-26 | Demo (walkthrough with faculty) |
| BR-24 | Admin dashboards and at-risk students | FR-7.2 | System shall show school-wide usage and performance with drill-down. | US-27 | Demo (walkthrough with faculty) |
|  |  | FR-7.3 | System shall flag at-risk students using configurable rules. | US-27 | Test (UAT / system test) |
| BR-25 | Exportable reports (PDF, Excel) | FR-7.4 | System shall export reports to PDF and Excel, honoring on-screen filters and role permissions. | US-28 | Test (UAT / system test) |
| BR-26 | Integrate with SIS, email and video conferencing | FR-8.1 | System shall integrate with the SIS for users, enrollments and grades. | US-29 | Test (UAT / system test) |
|  |  | FR-8.2 | System shall integrate with the school email system and video conferencing tool, with connection health checks and failure alerts. | US-29 | Test (UAT / system test) |
| BR-27 | Open API for future integrations | FR-8.3 | System shall expose an authenticated, rate-limited REST API with published documentation. | US-30 | Inspection (documentation review) |

### Non-functional requirements

| NFR ID | Area | Specification | Verification | Owner |
|---|---|---|---|---|
| NFR-1 | Availability | 99.5% uptime, with maintenance windows outside exam periods. | Uptime monitoring and monthly report | IT Department |
| NFR-2 | Performance | Pages load in under 3 seconds with up to 2,000 concurrent users. | Load test before go-live | IT Department |
| NFR-3 | Security and privacy | Encryption in transit and at rest, audit logs, role-based access, compliance with applicable student data privacy law (FERPA, GDPR or local equivalent). | Security review, penetration test, privacy assessment | IT Department |
| NFR-4 | Usability | New faculty can complete core tasks (create course, post assignment, mark attendance) after minimal training. | Usability test with pilot faculty and students | Business Analyst |
| NFR-5 | Accessibility | Conforms to WCAG 2.1 AA. | Accessibility audit with assistive technologies | IT Department |
| NFR-6 | Compatibility | Works on current web browsers, iOS and Android. | Cross-device test matrix | IT Department |
| NFR-7 | Scalability | Supports year-over-year growth in users, courses and storage without redesign. | Capacity review each term | IT Department |
| NFR-8 | Backup and recovery | Daily backups with a defined recovery time and recovery point objective, tested periodically. | Restore drill | IT Department |

Coverage: all 27 business requirements map to at least one functional requirement and at least one user story. NFR-1 to NFR-8 correspond to Section 7 of the BRD.

## 3. Stakeholder RACI

Roles are taken from the BRD stakeholder list. The Business Analyst role represents the project or delivery team. Each activity has exactly one Accountable role.

| R = Responsible (does the work) | A = Accountable (one per activity) | A/R = Accountable and Responsible | C = Consulted (two-way) | I = Informed (one-way) |
|---|---|---|---|---|

| Activity | Principal / Administrators | Business Analyst | IT Department | Academic Coordinators | Faculty | Students | Parents |
|---|---|---|---|---|---|---|---|
| Define and validate business requirements | A | R | C | C | C | C | C |
| Approve BRD and project scope | A | R | C | C | C | I | I |
| Evaluate and select vendor or build option | A | R | R | C | C |  |  |
| Security and privacy review | C | C | A/R | I |  |  |  |
| SIS integration and data migration | I | R | A | C |  |  |  |
| Configure roles, accounts and account lifecycle | C | C | A/R | I | I | I |  |
| Define grading policy and grading scales | A | C | R | R | C | I | I |
| Design course templates and curriculum structure | I | C | C | A | R |  |  |
| Build courses and upload content | I |  | C | A | R |  |  |
| Assignment submission and grading | I |  | I | I | A/R | R | I |
| Attendance recording and alerts | I |  | C | I | A/R | I | I |
| User acceptance testing | I | A/R | C | R | R | C |  |
| Training and onboarding | A | C | R | R | I | I | I |
| Pilot and go-live rollout | A | R | R | C | C | I | I |
| Reports and dashboards | A | C | R | C | I |  |  |
| Technical support and incident management | I |  | A/R | I | I | I | I |
| Backup, uptime and performance monitoring | I |  | A/R |  |  |  |  |
| Change requests and enhancements | A | R | C | C | C | I | I |
| Post go-live review and benefits tracking | A | R | C | C | C | C | C |

### Notes

- Parents are optional stakeholders per the BRD, so they are mostly Informed or Consulted.
- Where Faculty are both Accountable and Responsible (for example grading), the Academic Coordinator is Informed and reviews quality through reports.
- If the school has a dedicated Project Manager or Vendor, add them as columns and move Responsible assignments for build, integration and training accordingly.
