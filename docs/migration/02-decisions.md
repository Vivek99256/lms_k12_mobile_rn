# 02 — Decision log

Every decision: **proposal → reason → evidence → state**. State is `PROPOSED` until the owners approve; nothing may depend on a `PROPOSED` decision. Facts vs assumptions are marked.

## D-01 Documentation lives in `docs/migration/` of this repo — **APPROVED 2026-10-07**
- Layout in [README.md](README.md); tracker is the single file [STATUS.md](STATUS.md); one doc per sub-module under `docs/migration/modules/` from step 3.
- Reason: the brief requires docs in this repo and a single tracker; `docs/` does not exist yet (`ls` of repo root).

## D-02 Keep React Navigation; do not adopt Expo Router — **APPROVED 2026-10-07** (Q3: yes)
- Evidence: code uses `@react-navigation/*` (`package.json`, `src/navigation/RootNavigator.tsx:1-4`) with a single `Tile` route gated by RBAC (`TileScreen.tsx`); `AGENTS.md` says "Use Expo Router … `src/app/`" but no such folder exists.
- Reason: brief says follow the existing codebase and don't reorganise; the menu-tile gate depends on the current navigator. Switching would be a rewrite with no user benefit.
- Consequence: `AGENTS.md` is out of date; propose editing that one line only after approval.

## D-03 Folder convention for new work: follow the existing layout — **APPROVED 2026-10-07**
- Screens: `src/screens/<module>/<ScreenName>.tsx`, registered in `src/screens/registry.ts` by backend `screen_name` (the registry is empty and was designed for this: `registry.ts:10-14`).
- API calls: `src/api/<module>.ts` using `api`/`callAuto` from `src/api/client.ts`, one typed function per endpoint, types beside them. Server state via TanStack Query hooks `src/hooks/use<Thing>.ts` (pattern: `hooks/useBootstrap.ts`).
- Shared UI: extend `src/components/ui.tsx` / add files in `src/components/`; theme tokens only from `src/config/theme.ts`.
- Tests: `__tests__/<module>.test.ts` (Jest, pattern of existing tests); pure logic is unit-tested, as today.
- Reason/evidence: structure listed in 01-understanding §A. No reorganisation.

## D-04 Auth: log in with `/api/api-login` only; keep the current client — **APPROVED 2026-10-07** (parents not in V1, Q2)
- Evidence: only `api-login` tokens carry `id`, which `api.session` requires (`HydratesLegacyApiSession.php:73-75`); OTP tokens carry `student_id`/`teacher_id` and are rejected by `api.session`, and by all teacherapi methods (`apiController.php:336-343`, `teacherapiController.php:75-80`; evidence/backend_routes_A.md §2.1). Web uses the same login (`AuthContext.tsx:221`).
- Consequence: students/teachers/admins can log in by email+password (already built). **Parents cannot** use this path (they have no email account; OTP-by-mobile only). Parent support is a separate decision.
- Note: tokens never expire server-side unless `JWT_TTL_MINUTES>0` (`ApiLoginController.php:426-432`); the app already treats 401/`status:'2'` as sign-out.

## D-05 Menu drives the app; build dedicated screens against `screen_name`, fall back to `GenericDataScreen`, then web handoff — **APPROVED 2026-10-07**; data obtained via Q4 (see 03 §0)
- Evidence: `TileScreen.tsx:27-40`; bootstrap contract `api.php:100`; web sidebar is also server-driven (`useMenuRights.ts:131`), so mobile and web share one rights model.
- Gap: the real `screen_name`/`api` values are per-tenant DB rows (not in code). To plan module-by-module we need them. Request: permission to run read-only SELECTs on `mobile_homescreen` and `teacher_mobile_homescreen` (via the local Laravel DB) — or you export them.
- Until then module plan (step 2) is based on web modules + API availability, and is marked as such.

## D-06 Mobile scope by role: Student, Teacher, Admin/Staff; Parent pending — **APPROVED 2026-10-07**
- Evidence: backend only allows Admin/Teacher/Student profiles in mobile rights (backend_auth.md §5); web dashboard has teacher/student/admin buckets only (`resolveDashboardRole.ts`); the legacy student app routes serve the "student/parent" case through the student's data.
- Admin/back-office setup (masters, builders, bulk reports) stays web-only by default (see 03 in step 2, with reasons per item).

## D-07 Blade-only / gateway / print modules use the existing web-handoff, not a rebuilt screen — **APPROVED 2026-10-07**
- Evidence: `WebHandoffScreen.tsx` (system browser, single-use ticket `api.php:106`, 60 s TTL); payment gateway callbacks are HTML (fees.php:116-133 note in evidence/backend_routes_B.md); inventory/admission/hrms.php are Blade.
- Reason: avoids a native WebView module (which would change the native fingerprint and need a store build) — repo's own stated rationale in `WebHandoffScreen.tsx` header comment.
- Caveat: feature not "dropped" — recorded in the tracker as `web-handoff`.

## D-08 Libraries: none added now; candidates are requested per sub-module — **APPROVED 2026-10-07**
Already installed and reusable: Query, Zustand, React Navigation, SecureStore, expo-updates, LinearGradient, vector-icons.
Likely needed later (each will be a separate request, with the sub-module that needs it, using `npx expo install`, and it changes the native fingerprint → store build):
| Need | Candidate (Expo module) | First needed by |
|---|---|---|
| Homework/assignment file & photo upload (multipart: pdf/jpg/png ≤10 MB, `files[]` — `HomeworkSubmissionApiController.php:274-281`) | expo-document-picker, expo-image-picker | Student: Homework |
| Push notifications (`gcm_insert` body: `mobile_no,sub_institute_id,gcm_regid`; `api.php:87`) | expo-notifications (+ FCM setup) | Communication |
| Date/time inputs | start with `Field` text + a picker module only if needed | Attendance/Leave |
| Charts (admin dashboards, results) | none first: use bars drawn with `View`; decide at that module | Results/Dashboards |
Nothing here is approved or installed.

## D-09 Treat the backend as read-only and not fully trusted — **APPROVED 2026-10-07**
- Do not rely on UI hiding for authorization; do not send another user's ids; always source `user_id`/`sub_institute_id`/`syear` from the signed-in session (as `client.ts` does).
- Where a legacy endpoint takes identity from the body, the app sends the signed-in user's id; backend weaknesses listed in 01-understanding §B are reported to the backend owners, not patched here.
- Each module doc has a "backend caveats" section.

## D-10 Baseline hygiene — **DONE 2026-10-07** (Q5): baseline committed on branch `migration/step1-baseline` (8675e3a)
- The mobile repo has a single commit and all of `src/` untracked. Propose committing the current baseline on a branch before step 4 so each module is a reviewable diff. I will not commit without your yes.

## D-11 Classification rules and module split — **APPROVED 2026-10-07**
V1 / V1-blocked / Later / Web-only with the ≥5-tenant usage rule, defined in [03-modules-and-order.md](03-modules-and-order.md) §1; module IDs F1-F5, S1-S13, T1-T12, A1-A9. Evidence: DB query of `mobile_homescreen` / `teacher_mobile_homescreen` ([evidence/menu_tiles.txt](evidence/menu_tiles.txt)).

## D-12 Legacy transport in the API client — **APPROVED 2026-10-07**
- Add a form/multipart request option and a standard identity block (`student_id`/`teacher_id`/`user_id`/`user_profile_id`/`syear`/`sub_institute_id`/`type=API`) to `src/api/client.ts`; parse the response as text then JSON; extend `normalizeEnvelope` for `response`-only validation bodies, HTTP-200 `status:'2'`, quoted-URL bodies.
- Evidence: `client.ts:69-72` posts JSON today; some legacy controllers read `$_REQUEST` (ev:backend_routes_A.md §3 row 41); Flutter always sends multipart + identity block (ev:flutter_ref.md); `envelope.ts` treats a body with only `response` as success (ev:teacher_tiles_backend.md caveat 6).
- This modifies existing app code, so it needs your approval before F1 is built.

## D-13 Re-base tile endpoint URLs onto the configured API host — **APPROVED 2026-10-07**
- Tile `api` values are absolute `https://erp.triz.co.in/...`; the generic screen calls them unchanged (`client.ts:39-45`), so a dev build would hit production.
- Proposal: keep only the path of tile `api` URLs and prepend `env.apiBaseUrl`. Unknown hosts are rejected.
- Related constraint: CSRF exemption exists only for erp.triz.co.in, dev.triz.co.in, 127.0.0.1:8000 (`VerifyCsrfToken.php:20-26`), so legacy POSTs return 419 on any other base URL.

## D-14 Never call the unsafe endpoints; route around them — **APPROVED 2026-10-07**
Not used by the app: `GET /lms_data` (public arbitrary-table reader), `POST /fees/get_online_receipt` (no auth, records payments), `public/hrms_api.php` (embedded DB credentials, SQL injection), `/hrms/myleave/{id}` (sample data), `/add_visitorAPI` (no auth). Use `/api/hrms/*`, `/api/leave/*`, web-handoff for payment instead. These are reported to the backend owners in 03 §7.

## D-15 First vertical slice: F1 + S2 (student attendance) — **APPROVED 2026-10-07**
Smallest end-to-end screen on the legacy path (`studentAttendanceAPI`, student.php:179); proves F1 before any module relies on it.

## D-16 Tracker format — **APPROVED 2026-10-07**
[STATUS.md](STATUS.md) holds one row per sub-module: ID · name · role · class · backend flag · depends · doc · status (`planned → doc-approved → built → verified → done`).

## D-17 Workaround policy for blocked items — PROPOSED→ADOPTED from your Q9 answer (2026-10-07)
A workaround is allowed only if it is safe, stable, maintainable, and does **not** bypass authentication, authorization, security or backend business rules. Otherwise the feature stays blocked and the required backend fix is documented. Consequences recorded for the ⛔ items in 03 §3: exam-schedule upload with field `filename` and the admin parent-comm reply with the correct param name are *contract corrections* (allowed once verified); using the admin gallery endpoint for teachers, the unauthenticated visitor/online-receipt/`lms_data` endpoints, and `hrms_api.php` are **not** allowed.

---
## Answers received (2026-10-07, step 2 → 3)
- **Q6** yes — local `php artisan serve` allowed for local/read-only verification; no production APIs, no production data changes.
- **Q8** PAL/ESO and task-management stay Later; 5-tenant threshold approved.
- **Q9** workaround policy = D-17.
- **Q10** D-11…D-16 approved. **Q11** start step 3 with F1 + S2.

## Answers received earlier (step 1 → 2)
- **Q1** read Flutter app: yes (done). **Q2** parents not in V1. **Q3** keep React Navigation. **Q4** read-only SELECTs on the two menu tables (done). **Q5** commit baseline (done, 8675e3a). **Q7** Student → Teacher → Admin.

## Open questions (waiting on you)
- **Q12** Verification needs real data: (a) may I use a **test student account** (give email+password, or tell me which local-DB student to use)? (b) The local `.env` database is a **remote host** (`DB_HOST` is not localhost; I did not print credentials). Is that database safe for read-only calls and, later, test writes — or is it production? If it is production I will only run read-only calls on the endpoints you name.
- **Q13** UX decisions in S2 §6: U-1 week starts Monday? U-2 unknown attendance codes shown neutral and excluded from %? U-3 recorded attendance wins over a holiday colour on the same day?
- **Q14** F1 changes existing client behaviour (text-first parsing, 419 message, URL allow-list/re-basing, identity block). Approve F1 §4 as written?
- **Q15** Approve both documents ([F1](modules/F1-legacy-transport.md), [S2](modules/S2-student-attendance.md)) so step 4 may build them in order F1 → S2?

## Step 4 notes (2026-10-07)
- **Q12 outcome:** the `.env` database host (not recorded here) is a separate remote server, different from `erp.triz.co.in` (128.199.17.97) and `dev.triz.co.in` (202.47.117.61); memory notes say it holds live data. Production status cannot be established from code, so **no real-data call was made**; verification used student id 0 only (SELECTs matching no rows).
- **Q13 applied:** U-1 Monday-first, U-2 neutral unknown codes excluded from %, U-3 recorded attendance wins over a holiday.
- **Q14 applied:** F1 §4 implemented as written (deviations listed in F1 §13).
- **Open Q16:** Is the `.env` database production? If it is a shared dev copy, may I use a named read-only test student account for the real-data check? If it is production I will run only the read-only calls you name.

## Answers received (2026-10-07, step 4 → S1)
- **F1 and S2:** signed off as done.
- **Q16:** do **not** access real student data. The remote `.env` database is treated as potentially production/live until you explicitly confirm it is a non-production/shared development environment or give specific approved read-only checks. Allowed meanwhile: student id 0, synthetic/test data, local Laravel verification, read-only endpoint checks that cannot expose real student data.
- **Commit:** F1 + S2 may be committed on a dedicated migration branch (done: `migration/f1-s2`).
- **Next module:** S1 documentation (not built).

## S1 proposals (2026-10-07) — PROPOSED, see [S1 document](modules/S1-student-home.md) §6, §12
- **S1-D1** For students the Home dashboard section is replaced by a purpose-built one; staff keep the generic section.
- **S1-D2** `notificationHubAPI` needs a non-empty `mobile_no` that the server never uses; send the constant `'0'` (no phone number).
- **S1-D3** Ignore the server-built `image` / `side_image` URLs (no remote images).
- **S1-D4** Move the private `monthDays` helper out of `AttendanceScreen.tsx` into `calendarDays.ts` (behaviour-neutral change to a done module, covered by S2's tests).
- **S1-D5** Notification list: client-side "Show more" (30 at a time), because the server returns everything.
- **S1-D6** Make only `http(s)://` links in notification text tappable.
- **Open:** Q17 read-only SELECT on lookup table `circular_type`; Q18 approve S1-D1…D6; Q19 approve the S1 document. Q16 (database environment) remains open.

## Answers received (2026-10-07, S1 approval)
- **Q17** yes — one read-only SELECT on `circular_type` (done: `1 Circular`, `2 Event`).
- **Q18** yes — S1-D1…D6 approved and implemented.
- **Q19** yes — S1 document approved; built in the order calendar → notifications → circulars → dashboard.
- **Q16** remains OPEN: real student data stays off-limits; only non-existent ids and the local server are used.
- **Commit:** none until you approve (S1 is uncommitted).

## Findings during S1 (2026-10-07)
- **Circular type names are `Circular` and `Event`** (not Flutter's lowercase literals); the app sends the exact names.
- **JSON bodies break `circular/fetchData`** (reads `$_REQUEST`, `circularController.php:123`) — F1's form-encoding is required; confirmed on the local server.
- **Pre-existing dependency issue (not caused by S1):** `expo-asset` sits only under `node_modules/expo/node_modules`, so `expo-font` (used by `@expo/vector-icons`, already imported by `RootNavigator` and `TileList`) cannot resolve it from the top level. Jest cannot load those icons; whether the app bundles on a device is **unverified**.
- **Open Q20:** may I check it (e.g. try a dev build or a Metro bundle) and, if it fails, run `npx expo install expo-asset`? That adds a direct dependency, so it needs your approval; I have not changed `package.json`.

## Answers received (2026-10-07, S1 sign-off → S3)
- **S1:** signed off as done; commit approved (S1-related changes and docs only).
- **Q16:** stays OPEN. The remote database is treated as potentially production; no real student data is read until you explicitly confirm the environment.
- **Q20:** yes — check the app in a development build; install `expo-asset` (Expo-compatible command, direct dependency) **only if** the build shows it is genuinely needed; do not install it preemptively; do not upgrade other Expo/React Native packages; document the result; rerun typecheck and the full suite after any dependency change.
- **Next module:** S3 — Timetable and Exam Schedule. Document first; do not build.

