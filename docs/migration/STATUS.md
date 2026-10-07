# Migration tracker

Single source of status. Updated at the end of every reply. Rules and rationale: [03-modules-and-order.md](03-modules-and-order.md).

## Current position
- **Step 1 — Understand: APPROVED** (2026-10-07). Baseline committed on branch `migration/step1-baseline` (8675e3a).
- **Step 2 — Divide the work: APPROVED** (2026-10-07; D-11…D-16 approved, D-17 adopted).
- **Step 3 — Document F1 + S2: APPROVED** (2026-10-07).
- **Step 4 — Build F1 + S2: DONE, signed off 2026-10-07.** Committed as f2e62e2 on branch `migration/f1-s2`.
- **Step 3 — Document S1: APPROVED** (2026-10-07; Q17, Q18 incl. S1-D1…D6, Q19 all yes).
- **Step 4 — Build S1: DONE, signed off 2026-10-07.** Committed as 27c5c66 on branch `migration/s1-student-home`.
- **Step 3 — Document S3: APPROVED** (2026-10-07; Q21 yes, Q22 option c).
- **Step 4 — Build S3: DONE, signed off 2026-10-07.** Committed as 7b4e45e on branch `migration/s3-timetable-exam-schedule`.
- **Step 3 — Document S4a: APPROVED** (2026-10-07; Q23 yes, D1/D2 modern API with no legacy fallback, D6 AI score when evaluated).
- **Step 4 — Build S4a: DONE, signed off 2026-10-07.** Committed on branch `migration/s4a-homework-view`. S4b is NOT approved and not started.

- **Step 3 — Document S6 (fees): APPROVED** (2026-10-07; Q24 option A, Q25 S6-D2…D7 yes, Q26 S6b/c/d future scope only).
- **Step 4 — Build S6a: DONE, signed off 2026-10-07.** Committed on branch `migration/s6a-fees-summary`. The `PaidUnpaid` backend defect stays a backend issue. S6b/c/d are NOT approved.
- **Step 3 — Document S5 (results): APPROVED** (2026-10-07; Q27 option A, Q28 S5-D2…D6 yes incl. external-viewer-only opening, Q29 S5b/c/d future/blocker items).
- **Step 4 — Build S5a: DONE, signed off 2026-10-07.** Committed on branch `migration/s5a-result-pdfs`. S5b/c/d are future/blocker items and must not be implemented.
- **Step 3 — Document S7 (leave and communication): APPROVED** (2026-10-07; Q30 option A — build S7c, S7a, S7b view-only; Q31 S7-D2…D8 yes; Q32 S7d/S7e future scope).
- **Step 4 — Build S7c + S7a + S7b: DONE, signed off 2026-10-07.** Committed as a842611 on branch `migration/s7-leave-communication`. S7d/S7e are future scope and not implemented.
- **Step 3 — Document S9 (my records): APPROVED** (2026-10-07; Q33 option A, Q34 S9-D2…D11 yes with the health-data requirements, Q35 backend ask written separately).
- **Step 4 — Build S9a: DONE, signed off 2026-10-07.** Committed as 9d63827 on branch `migration/s9-my-records`. S9b (hostel, achievement certificate) stays blocked on the backend ([ask](backend-asks/S9-blocked-tiles.md)).
- **Step 3 — Document S10 (school information and galleries): APPROVED** (2026-10-07; Q36 option A, Q37 S10-D2…D7 yes with D4(b) no in-app images, Q38 classwork backend security ask written separately).
- **Step 4 — Build S10a: DONE, signed off 2026-10-07.** Committed as 9ab44e1 on branch `migration/s10-school-info-galleries`. S10b (classwork gallery) stays blocked on the backend ([security ask](backend-asks/S10-classwork-credential-exposure.md)).
- **Step 3 — Document S8 (learning): APPROVED** (2026-10-07; Q39 option B, Q40 S8-D2…D7 with clarifications, Q41 S9c added to the plan, Q42 Learn-content backend ask).
- **Step 4 — Build S8a + S8c: DONE, signed off 2026-10-07.** Committed as bd1e4f4 on branch `migration/s8-learning` (including the approved additive F1 `bearerOnly` option). S8b Learn stays blocked on the backend ([ask](backend-asks/S8-learn-content-endpoint.md)).
- **Step 4 — Build S9c (Student Discipline): DONE, signed off 2026-10-07.** Committed on branch `migration/s9c-student-discipline` (view only, S9 memory-only handling).

## Waiting on you
Review the S13 (Profile) scope/design (document to follow) and approve or adjust it. **Q16 stays open and is applied strictly.** The coordinated S1–S10 device pass stays deferred and needs your explicit approval of the native build. S4b, S5b/c/d, S6b/c/d, S7d/e, S8b, S9b and S10b are not approved.

## Legend
Class: **V1** · **V1⛔** (V1 usage, backend blocked) · **Later** · **Web** (web-only). Status: `planned → doc-approved → built → verified → done`. Statuses: F1 and S2 are `done`; S1 is `done`; S3 is `done`; S4a is `done`; everything else `planned`.

## Foundation
| ID | Sub-module | Class | Depends | Doc | Status |
|---|---|---|---|---|---|
| F1 | Legacy transport + envelope adapter | V1 | – | [F1](modules/F1-legacy-transport.md) | DONE (signed off 2026-10-07) |
| F2 | Tile resolver / registry | V1 | F1 | – | planned |
| F3 | List/detail/form UI kit | V1 | – | – | planned |
| F4 | Class pickers (staff) | V1 | F1,F3 | – | planned |
| F5 | File pick/upload/open (**needs library approval**) | V1 | F1 | – | planned |

## Student
| ID | Sub-module | Class | Backend flag | Depends | Doc | Status |
|---|---|---|---|---|---|---|
| S1 | Home dashboard, notification hub, circulars & events, academic calendar & holidays | V1 | circular needs `action`, 500 if no enrollment, JSON body breaks it (form-encoding required) | F1, S2 | [S1](modules/S1-student-home.md) | DONE (signed off 2026-10-07); real-data check deliberately pending (Q16) |
| S2 | Attendance | V1 | no ownership check on server | F1 | [S2](modules/S2-student-attendance.md) | DONE (signed off 2026-10-07); real-data check deliberately pending, DB treated as possibly production (Q16) |
| S3 | Timetable, exam schedule | V1 | weekday order is alphabetical (client re-sorts); batch periods concatenated; exam file links may be dead for teacher-mobile uploads | F1, S1 | [S3](modules/S3-timetable-exam-schedule.md) | DONE (signed off 2026-10-07); real-data and device checks deliberately pending (Q16; coordinated pass) |
| S4a | Homework list/detail (view only) | V1 | modern API needs a current academic year; list unpaged; real data unverified | F1, S1 | [S4a](modules/S4a-homework-view.md) | DONE (signed off 2026-10-07); real-data and device checks deliberately pending (Q16; coordinated pass) |
| S4b | Homework submit (upload) | V1 | – | S4a,F5 | – | planned |
| S5a | Result PDFs (term-wise files the school uploaded; view only) | V1 | legacy `uploadResultAPI` (22 of 34 tenants); no ownership check, public file URLs; real data unverified | F1, S1 | [S5](modules/S5-results.md) | DONE (signed off 2026-10-07); real-data and device checks deliberately pending (Q16; coordinated pass) |
| S5b | WRT progress report (`get_wrtreportAPI`) | V1 | Later: requires an exam/session identifier and backend/data-flow clarification; heavy PDF generation, wipes a shared folder | F1, auth/session change | [S5](modules/S5-results.md) §3, §10 | future scope; not documented further |
| S5c | `studentResultPDFAPI` tenant (1 of 34) | V1 | Blocked: authentication, SQL injection, ownership and destructive-file-operation risks | – | [S5](modules/S5-results.md) §3, §10 | blocked; that tile shows "not available in the app yet" under S5a |
| S5d | Native marks / grades / percentages | Later | native marks are not available through a safe mobile API | – | [S5](modules/S5-results.md) §3 | future scope; not documented further |
| S6a | Fees summary (view only, whole-year totals) | V1 (at risk) | legacy `fees/PaidUnpaid`; probable 500 for most students (join defect, documented not fixed); no modern API | F1, S1 | [S6](modules/S6-fees.md) | DONE (signed off 2026-10-07); real-data and device checks deliberately pending (Q16; coordinated pass) |
| S6b | Month-wise dues, paid-receipt list | V1 | Later / backend-dependent: `studentFeesDetailAPI` broken and unsafe | S6a | [S6](modules/S6-fees.md) §3, §9 | future scope; not documented |
| S6c | Receipt view/download (financial document) | V1 | Later / separate financial-scope approval required | S6a | [S6](modules/S6-fees.md) §3 | future scope; not documented |
| S6d | Online payment (financial action) | V1 (web-handoff) | Later / separate financial-action approval required | S6a | [S6](modules/S6-fees.md) §3 | future scope; not documented |
| S7a | My leave applications (view only) | V1 | legacy `studentLeaveApplicationAPI`; unauthenticated without `type=API` (app always sends it), no ownership check, public attachment URLs; no row id/order | F1, S1 | [S7](modules/S7-leave-communication.md) | DONE (signed off 2026-10-07); real-data and device checks deliberately pending (Q16; coordinated pass) |
| S7b | My messages to school + staff replies (view only) | V1 | legacy `studentParentcommunicationListAPI` (`status_code` envelope); the tile stores the WRITE endpoint `add_communicationAPI` (ignored) | F1, S1 | [S7](modules/S7-leave-communication.md) | DONE (signed off 2026-10-07); real-data and device checks deliberately pending (Q16; coordinated pass) |
| S7c | Subject teachers (view only) | V1 | legacy `studentTeacherListAPI`; "Wrong Parameters" = no enrolment; teacher mobile/image never used | F1, S1 | [S7](modules/S7-leave-communication.md) | DONE (signed off 2026-10-07); real-data and device checks deliberately pending (Q16; coordinated pass) |
| S7d | Apply for leave (WRITE; optional attachment) | V1 | Later: write operation; needs separate approval, safe non-production verification and F5 for the attachment | S7a, F5 | [S7](modules/S7-leave-communication.md) §0, §10 | future scope; not documented further |
| S7e | Send a message to school (WRITE) | V1 | Later: write operation; needs separate approval and safe non-production verification | S7b | [S7](modules/S7-leave-communication.md) §0, §10 | future scope; not documented further |
| S8a | Social Collaborative — my own discussions + conversations (view only) | V1 | modern token-bound `GET api/lms/social-collaborative?mine=1` and `/{id}`; two locks against showing anyone else's content; 422 without a current year | F1, S1 | [S8](modules/S8-learning.md) | DONE (signed off 2026-10-07); real-data and device checks deliberately pending (Q16; coordinated pass) |
| S8b | Learn — subjects → chapters → items | V1⛔ (decided) | **not built** (Q39 B): `studentContentAPI` builds SQL from request values, no paging, a query per chapter/topic, CDN links; tile shows "This isn't available in the app yet." and the endpoint is never called | – | [S8](modules/S8-learning.md) §3, §10; [backend ask](backend-asks/S8-learn-content-endpoint.md) | blocked on backend; message only |
| S8c | Live lecture | V1⛔ | no endpoint (menu row stores the site root); tile shows "This isn't available in the app yet." and makes no request | – | [S8](modules/S8-learning.md) | DONE (signed off 2026-10-07); real-data and device checks deliberately pending (Q16; coordinated pass) |
| S8d | Virtual classroom | Later | 3 tenants; response carries the meeting password | – | [S8](modules/S8-learning.md) §3 | not proposed |
| S8e | Portfolio | Later | 3 tenants | – | [S8](modules/S8-learning.md) | not proposed |
| S8f | Leader board | Later | 3 tenants; fixed "Bronze" medal; classmates' names | – | [S8](modules/S8-learning.md) §3 | not proposed |
| S9a | My records, view only: height & weight, vaccination, health details, infirmary, consent, transport, certificates (text version) | V1 | legacy read endpoints (JWT always checked, no ownership check); health data highly sensitive; public health-document URLs; health has no year filter; certificates are HTML | F1, S1 | [S9](modules/S9-my-records.md) | DONE (signed off 2026-10-07); real-data and device checks deliberately pending (Q16; coordinated pass) |
| S9b | Hostel, achievement certificate | V1⛔ | school read from `session()` (hostel; `document_details` also GET-only, no JWT) — broken for token callers; tiles show "This isn't available in the app yet." and make no request | – | [S9](modules/S9-my-records.md) §3, §10; [backend ask](backend-asks/S9-blocked-tiles.md) | blocked on backend; message only |
| S9c | Student Discipline (`child_remark`, 23 tenants; view only) | V1 | `studentDisciplineAPI` is JWT-checked, read-only; S9 sensitive-data standard applied (memory only, no logging / storage / sharing) | F1, S1 | [S9](modules/S9-my-records.md) §18–19 | DONE (signed off 2026-10-07); real-data and device checks deliberately pending (Q16; coordinated pass) |
| S10a | School information (9 pages), photo gallery, video gallery (view only; no images in the app) | V1 | legacy `schoolDetailAPI` (swapped aliases, HTML, action text must equal stored type) and `studentPhotoVideoGalleryAPI` (object keyed by album); public photo URLs | F1, S1 | [S10](modules/S10-school-info-galleries.md) | DONE (signed off 2026-10-07); real-data and device checks deliberately pending (Q16; coordinated pass) |
| S10b | Classwork gallery | V1⛔ | blocked: `front_desk/send_attachment/create` embeds whole `tbluser`/`tblstudent` rows (incl. `password`, `plain_password`, `otp`) in every row and lists all students when `student_id` is omitted; tile shows "This isn't available in the app yet." and the endpoint is never contacted | – | [S10](modules/S10-school-info-galleries.md) §3, §10; [security ask](backend-asks/S10-classwork-credential-exposure.md) | blocked on backend; message only |
| S11 | Face-capture photos | Later | no recognition backend | F5 | – | planned |
| S12 | Adaptive learning (PAL/ESO) | Later | ESO nodes tenant 1 only | – | – | planned |
| S13 | Profile | V1 | – | F1 | – | planned |

## Teacher
| ID | Sub-module | Class | Backend flag | Depends | Doc | Status |
|---|---|---|---|---|---|---|
| T1 | Dashboard, profile, timetable, proxy | V1 | – | F1-F3 | – | planned |
| T1c | Teacher calendar | V1⛔ | no tenant filter | – | – | planned |
| T2 | Take attendance | V1 | rights DB-dependent | F4 | – | planned |
| T3 | Homework assign/list/review | V1 | file field `image` | F4,(F5) | – | planned |
| T4a | Marks entry, co-scholastic | V1 | co-scholastic takes tenant from body | F4 | – | planned |
| T4b | Exam schedule list | V1 | – | F4 | – | planned |
| T4c | Exam schedule upload | V1⛔ | field name mismatch | F5 | – | planned |
| T5 | Circular, notifications/SMS/email, parent comm, leave approval, notification report, message | V1 | easy_com no role check; `t_message` shape unconfirmed | F4,(F5) | – | planned |
| T6 | Student directory | V1 | any-school read | F4 | – | planned |
| T7a | Teach, lesson planning, resources, social collaborative, virtual classroom | V1 | read-only in Flutter | F4 | – | planned |
| T7b | Portfolio feedback | V1⛔ | no backend route | – | – | planned |
| T8a | My attendance, punch, leave (`/api/hrms/*`, `/api/leave/*`) | V1 | leave APIs need `token` input | F1 | – | planned |
| T8b | Payslip/payroll | Later | only unsafe path exists | – | – | planned |
| T9a | Complaint, task | V1 | task list hides unapproved | F4,(F5) | – | planned |
| T9b | Requisition | V1⛔ | teacher list SQL error | F4 | – | planned |
| T9c | Visitor | Later | unauthenticated write | – | – | planned |
| T10 | Teacher gallery | V1⛔ | list returns "no data" | – | – | planned |
| T11 | Face attendance capture | Later | no recognition backend | F5 | – | planned |
| T12 | PTM | Later | 2 tenants | – | – | planned |

## Admin
| ID | Sub-module | Class | Backend flag | Depends | Doc | Status |
|---|---|---|---|---|---|---|
| A1 | Admin dashboard | V1 | – | F1 | – | planned |
| A2 | Admin communication & directories (adminapi variants) | V1 | no role check; parent-comm reply param name | T5,T6 | – | planned |
| A3 | Admin office (complaint, task, requisition, proxy, profile, gallery) | V1 | list-join quirks | T9,A2 | – | planned |
| A4 | Leave authorisation | Later | 4 tenants, unsafe write | – | – | planned |
| A5 | Admission lists | Later | 1 tenant | – | – | planned |
| A6 | Fees admin (dashboard, defaulters, cancel) | Later | 1 tenant | – | – | planned |
| A7 | Inward/outward | Later | 1 tenant | – | – | planned |
| A8 | Page-builder forms (9 rows) | Later | builder UI removed | – | – | planned |
| A9 | Module dashboards | Later | – | – | – | planned |

## Web-only (not built on mobile) — reasons in 03 §3.4
fees reports/masters/NACH · lms exam builder & analytics · pal staff authoring · h5p · student CRUD/reports/ID cards/certificates · result report cards/reports/masters · hrit policy & payroll · talent-management, organization-management, people-competency, capability-intelligence · enterprise-brain, ai, platform-* · Inventory/Transportation/hostel/library masters · front_desk masters · admin-services petty cash/consent master · easy_com gateway config · general, academic_setup, user, integration, Utility, teach-learn, imports, builders, authoring, placeholders. Nothing is dropped silently: each is listed in 03 §3.4.

## Baseline facts
- Mobile repo after S9c: `npm run typecheck` clean; `jest` 76 suites (65 run, 11 opt-in skipped), **1028 passed, 44 skipped (opt-in local tests), 0 failed** (after S8: 994; S10: 916; S9: 814; S7: 638; S5a: 543; S6a: 476; S4a: 411; S3: 315; S1: 232; F1+S2: 100; original: 20).
- Laravel and Next.js: read-only; not modified by this work.
- Database: only `SELECT` run, only on `mobile_homescreen` and `teacher_mobile_homescreen`.

## Log
| Date | Event |
|---|---|
| 2026-10-07 | Step 1 surveys, docs written, spot-checks matched. |
| 2026-10-07 | Step 1 approved. Baseline committed (8675e3a, branch `migration/step1-baseline`). |
| 2026-10-07 | Step 2 approved; Q6 yes (local server), Q8 Later for PAL/ESO & task-management, threshold approved, Q9 policy → D-17. |
| 2026-10-07 | Step 3: read attendance backend/Flutter/web, local server probes (read-only, ids = 0, stopped afterwards), wrote F1 + S2 documents. Awaiting approval. |
| 2026-10-07 | (earlier) Step 2: Flutter reference survey, read-only menu query, student/teacher endpoint audits, module plan 03, decisions D-11…D-16, tracker. Awaiting approval. |
| 2026-10-07 | Step 3 approved; Q12-Q15 answered (U-1 Monday, U-2 neutral unknown codes, U-3 attendance wins, F1 §4 approved). |
| 2026-10-07 | Step 4: F1 + S2 built, 100 tests pass, local-server verification with id 0 only (DB production status uncertain, so no real-data call). Docs updated with actuals. Awaiting sign-off. |
| 2026-10-07 | F1 + S2 signed off; committed f2e62e2 on migration/f1-s2 (secret scan clean, no backend files, tests 100 pass). DB server IP redacted from docs; one baseline-commit evidence line (8675e3a, local only, never pushed) still contains it. |
| 2026-10-07 | S1 research: read dashboard/notification/circular/calendar controllers; local probes with non-existent ids (JSON body breaks circular/fetchData; circular 500 when no enrollment; dashboard 422/403/empty shapes). S1 document written. Awaiting approval. |
| 2026-10-07 | S1 approved (Q17-Q19 yes); one SELECT on circular_type: 1 Circular, 2 Event. |
| 2026-10-07 | S1 built (calendar, notifications, circulars, dashboard + Home); 232 tests pass; local verification with synthetic ids only; S1 document updated with actuals. Found: expo-asset not hoisted (pre-existing). Awaiting sign-off; uncommitted. |
| 2026-10-07 | S1 signed off and committed (27c5c66, branch migration/s1-student-home); pre-commit scan clean. |
| 2026-10-07 | Q20: Metro bundles the app for Android (1049 modules) and iOS with no unresolved modules, so `expo-asset` was NOT installed; `package.json` untouched. |
| 2026-10-07 | S3 research (controllers, web staff pages, Flutter reference, local probes with student 0) and S3 document written. Awaiting approval. |
| 2026-10-07 | S3 approved (Q21 yes, Q22 option c). S3 built: timetable then exam schedule; 83 new tests; 315 passing; local verification with synthetic ids over real HTTP (10/10 opt-in tests, plus the localhost 419 check); S3 document updated with actuals. Awaiting sign-off; uncommitted. |
| 2026-10-07 | S3 signed off and committed (7b4e45e, branch migration/s3-timetable-exam-schedule); pre-commit scan clean; S1/S2 source changed by additions only. |
| 2026-10-07 | S4a research (legacy and modern homework endpoints, web student screens, Flutter reference, local probes with synthetic ids) and S4a document written. Awaiting approval. |
| 2026-10-07 | S4a approved (Q23). S4a built, view only: filters, due-date sort, expandable detail, remarks/AI-score gating, HTML→text, 30-row batches; 96 new tests; 411 passing; local verification with synthetic ids over real HTTP (16/16 opt-in tests); S4a document updated with actuals. Awaiting review; uncommitted. |
| 2026-10-07 | S6 research (fee endpoints, web/Flutter/menu evidence, local probes with synthetic ids, PHP semantic checks) and S6 document written. Proposes S6a only; S6b/c/d identified, not proposed. Awaiting approval. |
| 2026-10-07 | S6 approved (Q24 option A, Q25 yes, Q26 future scope only). S6a built, view only: ₹ Indian formatting, whole-year labels, no-retry query, fee-specific 500 message, strict amount parsing; 65 new tests; 476 passing; local verification with synthetic ids over real HTTP (4/4 opt-in tests); backend defect documented with evidence, not fixed; S6 document updated with actuals. Awaiting review; uncommitted. |
| 2026-10-07 | S6a signed off (DONE) and committed on branch migration/s6a-fees-summary. The one transient text.test.ts timing failure is accepted as a parallel-run observation (final full run 476/476). |
| 2026-10-07 | S5 research (web, production menu, Flutter reference, legacy and modern result endpoints, local probes with a non-existent student) and S5 document written. Proposes S5a only; S5b/c/d identified, not proposed. Laravel untouched; no file generated or deleted by the probes. Awaiting approval. |
| 2026-10-07 | S5 approved (Q27 option A, Q28 yes, Q29 future/blocker items). S5a built, view only: term-wise result PDF list from `uploadResultAPI`, F1 link validation, external-viewer-only opening, blocked-endpoint tile state, no calculation; 67 new tests; 543 passing; local verification with a non-existent student over real HTTP (3/3 opt-in tests); S5 document updated with actuals. Awaiting review; uncommitted. |
| 2026-10-07 | S5a signed off (DONE) and committed on branch migration/s5a-result-pdfs. |
| 2026-10-07 | S7 research (web, production menu, Flutter reference, legacy read/write/staff endpoints; read-only local probes with a non-existent student; no write endpoint called) and S7 document written. Proposes S7a/b/c view-only; S7d/e writes identified, not proposed. Laravel untouched. Awaiting approval. |
| 2026-10-07 | S7 approved (Q30 option A, Q31 yes, Q32 future scope). S7c, S7a, S7b built, view only: subject teachers (mobile/image dropped), leave list (newest first, empty status = Pending, staff reply, validated attachment), messages list (`status_code` envelope, reply/awaiting); 95 new tests; 638 passing; local verification with a non-existent student over real HTTP (6/6 opt-in tests; server log shows only the three read paths); S7 document updated with actuals. Awaiting review; uncommitted. |
| 2026-10-07 | S7 (S7c, S7a, S7b) signed off (DONE) and committed on branch migration/s7-leave-communication. |
| 2026-10-07 | S9 research (web, production menu, Flutter reference, nine read endpoints incl. two broken ones; read-only local probes with a non-existent student) and S9 scope/design document written. Proposes seven view-only lists; hostel and achievement certificate blocked. Laravel untouched. Awaiting approval. |
| 2026-10-07 | S9 approved (Q33 option A, Q34 yes, Q35 backend ask separate). S9a built, view only: height & weight, vaccination, health details, infirmary, consent, transport, certificates (text version) + unavailable state for hostel/achievement certificate; records dropped from memory on unmount (stricter than planned), no logging/persistence; 176 new tests; 814 passing; local verification with a non-existent student over real HTTP (3/3 opt-in tests; server log shows only the seven read paths); S9 document updated with actuals; backend ask written. Awaiting review; uncommitted. |
| 2026-10-07 | S9a signed off (DONE) and committed on branch migration/s9-my-records. Stricter health-data handling approved (no console logging, no persistence, no share/export, gcTime 0, dropped on unmount). |
| 2026-10-07 | S9a committed as 9d63827. S10 research (web, production menu, Flutter reference, the two gallery/school-info endpoints and the classwork endpoint; read-only local probes with a non-existent student and tenant) and S10 scope/design document written. Proposes S10a; S10b blocked by a backend credential-exposure finding. Laravel untouched. Awaiting approval. |
| 2026-10-07 | S10 approved (Q36 option A, Q37 yes with D4(b), Q38 backend security ask). S10a built, view only: nine school pages (plain text), photo and video galleries as text lists (no Image, external open after link validation, deterministic album order, both response shapes), classwork tile "not available"; 102 new tests; 916 passing; local verification with a non-existent student and tenant over real HTTP (4/4 opt-in tests; server log has 0 classwork hits); S10 document updated with actuals; classwork credential-exposure backend ask written. Awaiting review; uncommitted. |
| 2026-10-07 | S10a signed off (DONE) and committed on branch migration/s10-school-info-galleries. The D4(b) no-image approach is approved; the classwork endpoint stays blocked with no fallback. |
| 2026-10-07 | S10a committed as 9ab44e1. S8 research (web, production menu, Flutter reference, legacy LMS endpoints, modern social-collaborative and leaderboard APIs; read-only local probes) and S8 scope/design document written. **Q16 disclosure:** one probe of the modern social-collaborative list without `mine=1` returned a tenant-wide public discussion post (first 320 characters seen: ids, a chapter title, description "testing"; the rest unread and the saved response deleted); later checks use `mine=1` only. Plan gap found: Student Discipline tile (23 tenants) had no module, proposed as S9c. Laravel untouched. Awaiting approval. |
| 2026-10-07 | S8 approved (Q39 option B, Q40 with clarifications, Q41 S9c added, Q42 backend ask). **Q16 process correction accepted:** no real database row may be retrieved intentionally, even a public one; if a synthetic probe unexpectedly returns a real row, stop, do not inspect/quote/save it, report it. S8a (own discussions, always `mine=1`) and S8c built, S8b Learn not built; Learn-content backend ask written; S9c added to the plan (docs only). 78 new tests; 994 passing; local verification asserted counts only (5/5 opt-in; server log: only the social-collaborative paths, 0 Learn/legacy hits). Awaiting review; uncommitted. |
| 2026-10-07 | S8a + S8c signed off (DONE) and committed on branch migration/s8-learning, including the approved additive F1 `bearerOnly` option and the Q16 process-correction documentation. S9c (Student Discipline) approved for implementation as view only. |
| 2026-10-07 | S8a + S8c committed as bd1e4f4. S9c (Student Discipline, view only) built: 34 new tests, 1028 passing; local verification with a non-existent student asserted the count only (3/3 opt-in tests; server log: only `/studentDisciplineAPI`). Awaiting review; uncommitted. |
| 2026-10-07 | S9c (Student Discipline) signed off (DONE) and committed on branch migration/s9c-student-discipline. |
| 2026-10-07 | Pre-commit test runs of S9c: of four full-suite runs, two each had one different test fail once under heavy parallel load (a first-render async wait in `RecordScreens` and in `DisciplineScreen`); both suites pass alone (99/99 twice; 15/15) and the final full run was 1028 passed, 0 failed. Recorded as transient parallel-run timing observations (like the earlier `text.test.ts` one); no logic failure. |
