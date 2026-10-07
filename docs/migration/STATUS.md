# Migration tracker

Single source of status. Updated at the end of every reply. Rules and rationale: [03-modules-and-order.md](03-modules-and-order.md).

## Current position
- **Step 1 — Understand: APPROVED** (2026-10-07). Baseline committed on branch `migration/step1-baseline` (8675e3a).
- **Step 2 — Divide the work: APPROVED** (2026-10-07; D-11…D-16 approved, D-17 adopted).
- **Step 3 — Document F1 + S2: APPROVED** (2026-10-07).
- **Step 4 — Build F1 + S2: DONE, signed off 2026-10-07.** Committed on branch `migration/f1-s2`.

## Waiting on you
Sign off F1 and S2 as done (or tell me what to change); answer **Q16** (is the `.env` database production? may the test student account be used against it, read-only?); approve the next sub-module to document (proposed: S1, which reuses `MonthCalendar`).

## Legend
Class: **V1** · **V1⛔** (V1 usage, backend blocked) · **Later** · **Web** (web-only). Status: `planned → doc-approved → built → verified → done`. Statuses: F1 and S2 are `done`; S1 is `doc written (awaiting approval)`; everything else `planned`.

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
| S1 | Home, notification hub, circulars, calendar | V1 | circular needs `action`; 500 if no enrollment | F1-F3 | – | planned |
| S2 | Attendance | V1 | no ownership check on server | F1 | [S2](modules/S2-student-attendance.md) | DONE (signed off 2026-10-07); real-data check deliberately pending, DB treated as possibly production (Q16) |
| S3 | Timetable, exam schedule | V1 | re-sort weekdays | F1,F3 | – | planned |
| S4a | Homework list/detail | V1 | needs `action` | F1,F3 | – | planned |
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
- Mobile repo after F1 + S2: `npm run typecheck` clean; `jest` 11 suites, **100 passed, 1 skipped (opt-in local test)**, 0 failed (baseline 4 suites / 20 tests).
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
