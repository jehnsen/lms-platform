# Business Requirements Document: School Learning Management System (LMS)

## 1. Purpose

Provide one platform where faculty deliver and manage coursework and students access learning, submit work, and track progress, replacing scattered tools (email, paper, messaging apps, spreadsheets).

## 2. Business Problem

- Course materials, assignments, and grades are spread across several channels.

- Faculty spend significant time on manual grading, attendance, and communication.

- Students and parents lack real-time visibility into progress.

- Administrators cannot easily report on engagement and performance.

## 3. Business Objectives

| **ID** | **Objective**                                     | **Success Measure**                                 |
|--------|---------------------------------------------------|-----------------------------------------------------|
| BO-1   | Centralize course content and communication       | 100% of courses on the LMS within one academic term |
| BO-2   | Reduce faculty administrative effort              | 30% less time spent on grading and attendance       |
| BO-3   | Improve student engagement and transparency       | 85%+ weekly active student users                    |
| BO-4   | Enable data-driven decisions                      | Standard dashboards available to administrators     |
| BO-5   | Support continuity of learning (remote or hybrid) | Classes can run fully online when needed            |

## 4. Scope

**In scope:** user and course management, content delivery, assignments, assessments, gradebook, attendance, communication, notifications, reporting, and integration with the Student Information System (SIS).

**Out of scope (initial release):** full admissions and enrollment, fee and payment management, HR and payroll, library management, and transport management.

## 5. Stakeholders

- **Students:** primary users who learn, submit work, and track progress.

- **Faculty:** create courses, assess, and communicate.

- **School Administrators and Principal:** oversight, policy, and reporting.

- **IT Department:** deployment, support, and security.

- **Parents/Guardians (optional):** view progress and attendance.

- **Academic Coordinators:** curriculum alignment and quality.

## 6. Business Requirements

### 6.1 User and Access Management

- BR-01: Role-based access for Student, Faculty, Admin, and Parent.

- BR-02: Single sign-on (SSO) or school-managed accounts.

- BR-03: Bulk onboarding of users from the SIS or CSV.

- BR-04: Admins can activate, deactivate, and archive accounts at term end.

### 6.2 Course and Content Management

- BR-05: Faculty create courses with units, lessons, and schedules.

- BR-06: Support documents, video, links, and presentations.

- BR-07: Reusable course templates and content libraries across terms.

- BR-08: Content can be scheduled for release and restricted to specific sections.

### 6.3 Assignments and Assessments

- BR-09: Faculty create assignments with due dates, rubrics, and attachments.

- BR-10: Students submit online, with late-submission rules.

- BR-11: Quizzes and tests with auto-grading for objective questions.

- BR-12: Plagiarism check integration.

- BR-13: Faculty give feedback inline and through rubrics.

### 6.4 Grading and Progress Tracking

- BR-14: A gradebook with configurable weighting and grading scales.

- BR-15: Students see grades and feedback in real time.

- BR-16: Progress reports and report-card data export to the SIS.

### 6.5 Attendance and Scheduling

- BR-17: Faculty mark attendance per class or session.

- BR-18: Timetable and academic calendar visible to all users.

- BR-19: Automatic alerts for low attendance.

### 6.6 Communication and Collaboration

- BR-20: Announcements, messaging, and discussion forums per course.

- BR-21: Virtual classroom integration (live sessions and recordings).

- BR-22: Notifications by email, push, and in-app.

### 6.7 Reporting and Analytics

- BR-23: Faculty dashboards cover class performance and engagement.

- BR-24: Admin dashboards cover school-wide usage, performance, and at-risk students.

- BR-25: Exportable reports (PDF, Excel).

### 6.8 Integration

- BR-26: Integrate with the SIS, the school email system, and the video conferencing tool.

- BR-27: Open API for future integrations.

## 7. Non-Functional Requirements

- **Availability:** 99.5% uptime, especially during exams.

- **Performance:** pages load in under 3 seconds with up to 2,000 concurrent users.

- **Security and privacy:** encryption in transit and at rest, audit logs, and compliance with applicable student data privacy law (such as FERPA, GDPR, or the local equivalent).

- **Usability:** intuitive interface with minimal training.

- **Accessibility:** WCAG 2.1 AA.

- **Compatibility:** web, iOS, and Android.

- **Scalability:** supports growth in students, courses, and storage year over year.

- **Data backup and recovery:** daily backups with a defined recovery time.

## 8. Assumptions

- The school provides reliable internet and devices for students and faculty.

- The SIS exposes the data needed for integration.

- Faculty will receive training before go-live.

## 9. Constraints

- Budget and timeline set by school leadership.

- Must comply with data protection and child-safety regulations.

- Rollout aligned to the academic calendar.

## 10. Risks

| **Risk**                            | **Mitigation**                                      |
|-------------------------------------|-----------------------------------------------------|
| Low faculty adoption                | Training, champions, and phased rollout             |
| Data migration errors               | Pilot migration and validation checks               |
| Student data privacy breach         | Role-based access, audits, and security review      |
| Connectivity gaps for some students | Mobile-friendly design and offline download options |

## 11. Success Criteria

- Over 90% of faculty actively use the LMS within one term.

- Student and faculty satisfaction of 4 out of 5 or higher.

- Reduction in manual grading and attendance effort as per BO-2.

- No major security incidents in the first year.

## 12. Next Steps

Stakeholder sign-off, followed by detailed functional specifications, user stories with acceptance criteria, vendor or build evaluation, and a pilot rollout plan.
