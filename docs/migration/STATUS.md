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

## Waiting on you
Review and sign off S4a (or tell me what to change) and separately approve its commit. **Q16 stays open** (no real student data). The coordinated S1–S4a device pass still needs your explicit approval of the native build. Choose the next sub-module (build order: S6a/b fees → S5 results → S7 leave and communication → S9 → S10 → S8 → S13; S4b needs the F5 picker libraries first).

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
| S5 | Results PDF, WRT progress | V1 | heavy/unsafe PDF endpoints | F1,F3 | – | planned |
| S6a | Fees summary/detail | V1 | needs `type=API`; year row required | F1,F3 | – | planned |
| S6b | Fee receipt PDF | V1 | quoted-URL response | S6a | – | planned |
| S6c | Online payment | V1 (web-handoff) | gateway HTML | S6a | – | planned |
| S7a | Leave list, parent communication list, subject teachers | V1 | needs `type` / `type=API` | F1,F3 | – | planned |
| S7b | Leave apply (attachment), send communication | V1 | separate submit route; `attechment` | S7a,F5 | – | planned |
| S8a | Learn (subjects/content), social collaborative | V1 | content route unread | F1,F3 | – | planned |
| S8b | Leaderboard, portfolio, virtual classroom | Later | 3 tenants | – | – | planned |
| S8c | Live lecture | V1⛔ | no endpoint | – | – | planned |
| S9a | Health, height-weight, infirmary, consent, vaccination, certificates, transport | V1 | `status_code` variants | F1,F3 | – | planned |
| S9b | Hostel, achievement certificate | V1⛔ | school read from `session()` | – | – | planned |
| S10a | School info (9 tiles), photo/video gallery | V1 | `action` must equal stored type | F1,F3 | – | planned |
| S10b | Classwork gallery | V1 (verify) | backend route unverified | F1 | – | planned |
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
- Mobile repo after S4a: `npm run typecheck` clean; `jest` 40 suites, **411 passed, 16 skipped (opt-in local tests), 0 failed** (after S3: 315; after S1: 232; F1+S2: 100; original: 20). `npx expo export` for Android still bundles (1063 modules).
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
