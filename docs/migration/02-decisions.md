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

## Q20 result (2026-10-07) — expo-asset: NOT installed
- **Check:** a real native dev build needs EAS or a local toolchain that is not set up, so the question "can the app's imports resolve `expo-asset`?" was tested with Metro's production-style bundler, which is what a device build runs: `npx expo export --platform android` and `--platform ios` (output written outside the repo).
- **Result:** both exported successfully — Android bundled 1049 modules into a 2.6 MB Hermes bundle including all `@expo/vector-icons` fonts; no "unable to resolve" or warning lines on either platform.
- **Conclusion:** the nested `expo-asset` (under `node_modules/expo/node_modules`) is **not** a build problem; only **Jest's** resolver cannot follow it (that is why tests that import the icons mock `@expo/vector-icons`). Per your rule ("do not install it preemptively if the dev build works") **no dependency was added**; `package.json` and the lockfile are unchanged. Not verified: running the app on a device/emulator (see Q22).

## S3 proposals (2026-10-07) — PROPOSED, see [S3 document](modules/S3-timetable-exam-schedule.md) §8, §12, §17
- **S3-D1** times in 12-hour format. **S3-D2** day strip Monday–Saturday, opens on today (Sunday → Monday). **S3-D3** periods sorted by start time then period id. **S3-D4** exams split into Upcoming / Earlier. **S3-D5** subject/teacher text shown exactly as sent (no comma splitting). **S3-D6** reuse S1's `safeAttachmentUrl` for the exam file link. Plus: exam rows with an unreadable date are kept under "Date to be confirmed".
- **Open:** Q21 approve the S3 document and decisions; Q22 device-verification choice (a/b/c). Q16 stays open.

## Answers received (2026-10-07, S3 approval)
- **Q21** yes — S3 document and S3-D1…D6 approved (12-hour times, Monday–Saturday strip opening on today with Sunday → Monday, start-time order, Other chip, Upcoming/Earlier, text as sent, F1 link validation) plus "Date to be confirmed" for unreadable exam dates.
- **Q22** option (c) — component/integration tests and local-server verification now; no Android native project is generated for S3; one coordinated device/emulator pass for all completed student modules (S1–S3) later.
- **Q16** remains OPEN; synthetic/non-existent ids only. **Commit:** none until you approve.

## S3 implementation notes (2026-10-07)
- Built as approved; deviations are small and listed in the S3 document §18 (empty-row skipping, Other-only timetable not "empty", full day names accepted, "—" for a missing time, 52/44 dp chips, optional `pinToday` argument in the test helper).
- **Open:** sign-off and commit decision for S3; when to run the coordinated device pass (Q23 — needs your go-ahead for a local native dev build); next module.

## Answers received (2026-10-07, S3 sign-off → next module)
- **S3:** signed off as done; commit approved (S3 implementation, tests and related documentation only).
- **Q16:** stays OPEN — real student data off-limits; synthetic / non-existent ids and the local server only.
- **Device verification (standing instruction):** no native device/emulator build yet. After the next few student modules, **one coordinated verification pass** covering S1, S2 and S3 (and any module finished by then) — **you will explicitly approve the native build** when we reach it. Minimum scope for that pass: home/dashboard rendering; calendar and `MonthCalendar`; notifications; circulars/events; timetable day strip and scrolling; exam schedule; pull-to-refresh; loading/error/empty states; touch targets; navigation and web hand-off; Android bundle/native build behaviour.
- **Next module:** the next student sub-module in the approved build order (03 §5): **S4a — Homework list/detail**. Document first; do not build.

## S4a proposals (2026-10-07) — PROPOSED, see [S4a document](modules/S4a-homework-view.md) §3, §8, §16
- **S4a-D1** use the modern token-bound API (`my-submissions` for the list, `detail/{id}` on expand) — the same one the web student screens use; it carries due date and status, pins the student from the token and ownership-checks the detail. **S4a-D2** no legacy fallback (the legacy endpoint is documented, not used). **S4a-D3** details expand in place (no new route). **S4a-D4** filters To do / Submitted / All, default To do. **S4a-D5** status wording as the web helper. **S4a-D6** teacher remarks only when feedback is published; AI score line only when evaluated, as the web detail does (alternative: hide it). **S4a-D7** question HTML stripped to plain text. **S4a-D8** 30-row "Show more".
- **Open:** Q23 approve the S4a document and decisions (esp. D1/D2/D6); Q16 stays open; the coordinated device pass awaits your explicit approval of the native build.

## Answers received (2026-10-07, S4a approval)
- **Q23** yes — S4a document and S4a-D1…D8 approved. **D1** modern token-bound homework API. **D2** no legacy fallback: the legacy endpoint is not ownership-safe and stays unused unless a future real-data compatibility investigation proves it necessary and its security implications are addressed. **D6** show the AI score line when the homework is evaluated (as the web does), not otherwise.
- **Q16** remains OPEN; synthetic / non-existent ids only. **Commit:** S4a stays uncommitted until you have reviewed it and separately approve the commit.
- Requirements recorded: view only (no submission/upload — that is S4b); existing F1 client; no legacy `studentHomeworkAssignmentAPI`; reuse of S1's link validation; S1–S3 behaviour preserved; tests for filters, default To do, due-date sorting, empty state, loading/error/retry, 401, 404 detail, expand/collapse, remark and AI-score visibility, HTML → plain text, 30-row batches and file-link validation.

## S4a implementation notes (2026-10-07)
- Built as approved; deviations are small and listed in the S4a document §17 (id validation in the API layer, one row open at a time, counts in the chips, disabled-query case renders nothing, names of unopenable files still shown).
- **Open:** review and sign-off of S4a; commit approval; the coordinated S1–S4a device pass (needs your explicit approval of the native build); next sub-module.

## Answers received (2026-10-07, S4a sign-off → S6)
- **S4a:** signed off as done; commit approved (S4a implementation, tests and related documentation only). **S4b is not approved and must not be started.**
- **Q16:** stays OPEN — real student data off-limits; synthetic / non-existent ids and the local server only.
- **Device verification:** the coordinated S1–S4a pass still requires your **explicit approval**; do not create the native Android project or run the emulator yet.
- **Next module:** S6 — Fees. Document first; do not build. **No payment, receipt download or any financial mutation** unless the S6 document explicitly identifies that scope and you separately approve it.


## S6 proposals (2026-10-07, awaiting your answers)
- **Q24 / S6-D1** go/no-go for S6a. A (recommended): build the view-only summary; honest error if the backend defect hits. B: record S6 as backend-blocked and move to S5.
- **Q25** S6-D2 legacy `fees/PaidUnpaid` only; D3 INR with Indian grouping (currency is an assumption); D4 whole-year "Pending" label; D5 overpayment shown as "Paid in advance"; D6 honest closing note, no pay/receipt controls; D7 never call `studentFeesDetailAPI`, `pending_fees`, `ajax_PDF_FeesReceipt`, `get_online_receipt`.
- **Q26** S6b/S6c/S6d not proposed; S6c/S6d are financial scopes needing separate approval.
- **Q16** stays OPEN.

## Answers received (2026-10-07, S6 approval)
- **Q24** option A — build S6a now: view-only whole-year summary (total, paid, pending). No payment, receipt, download, payment link or financial mutation. The `PaidUnpaid` backend defect is a documented limitation; Laravel is not modified.
- **Q25** yes — S6-D2…D7 as documented, with the constraints: INR/Indian formatting; figures labelled whole-year totals; pending = the API's balance; no real-time claim; no payment controls; F1 form-encoded transport; never `studentFeesDetailAPI`, `fees/get_online_receipt`, `ajax_PDF_FeesReceipt` or `pending_fees`.
- **Q26** S6b/S6c/S6d are neither documented nor built: S6b later / backend-dependent; S6c later / separate financial-scope approval; S6d later / separate financial-action approval.
- **Q16** remains OPEN. **Device pass:** deferred; no native Android project.

## S6a implementation notes (2026-10-07)
- Built as approved; deviations are listed in the S6 document §17 (own no-retry query instead of `useStudentQuery`, negative formatting, stricter amount parsing, floored percent, wording).
- **Open:** review and sign-off of S6a; commit approval; the coordinated device pass (explicit approval needed); next sub-module; whether a real-data check or a backend fix will settle the `PaidUnpaid` defect.

## Answers received (2026-10-07, S6a sign-off → S5)
- **S6a:** signed off as done; commit approved (S6a code, tests and documentation only). The `PaidUnpaid` backend defect remains a backend issue and is not to be fixed as part of this migration. **S6b, S6c, S6d remain future scope and are NOT approved.**
- The transient `text.test.ts` timing failure is accepted (parallel-run observation; final full run 476/476; passes alone).
- **Q16:** stays OPEN — real student data and real fee records off-limits; the remote database is treated as potentially production.
- **Device pass:** the coordinated S1–S6a pass stays deferred; no native Android project.
- **Next module:** S5 — Student Results (document first; do not build).

## S5 proposals (2026-10-07, awaiting your answers)
- **Q27 / S5-D1** go/no-go for S5a (view-only list of school-uploaded result PDFs). A (recommended): build it. B: record S5 as backend-blocked and move to S7.
- **Q28** S5-D2 legacy `uploadResultAPI` only; D3 row order (id ascending), "No file uploaded yet" / "can't be opened" states, and opening files in the phone's browser/viewer only (no in-app viewer, download, cache or share); D4 the one `studentResultPDFAPI` tenant sees "not available in the app yet" and no request is made; D5 no native marks/grades/percentages; D6 never call `studentResultPDFAPI`, `api/result/all-results`, `api/result/cbse-1t5-result/pdf`, `current_result`/`api/result/current-result` or `get_wrtreportAPI`.
- **Q29** S5b/S5c/S5d not proposed; S5b needs a session/auth change first.
- **Q16** stays OPEN.

## Answers received (2026-10-07, S5 approval)
- **Q27** option A — build S5a now: view-only term-wise result PDF list from `uploadResultAPI`.
- **Q28** yes — S5-D2…D6 as documented. **D3:** result PDFs open only through the phone's browser or registered PDF viewer; no in-app viewer; no download, cache, persistence or sharing; F1 host/link validation before opening; unsafe links stay non-actionable with a clear message; no marks, percentages, grades or calculated results; no workaround for the backend authorization/public-link limits. Row order: id ascending unless the backend provides an explicit ordering field.
- **Q29** S5b/S5c/S5d are neither documented nor built: S5b later (needs an exam/session identifier and backend/data-flow clarification); S5c blocked (authentication, SQL, ownership and destructive-file-operation risks); S5d later (no safe mobile API for native marks).
- **Q16** remains OPEN. **Commit:** S5a stays uncommitted until you have reviewed it and separately approve the commit. **Device pass:** deferred.

## S5a implementation notes (2026-10-07)
- Built as approved; deviations are listed in the S5 document §18 (no separate parse function, "Open PDF" button text, screen split so a blocked tile creates no query, three-check local test, synchronous-throw handling, awaited unmount in tests).
- **Open:** review and sign-off of S5a; commit approval; the coordinated device pass (explicit approval needed); next sub-module.

## Answers received (2026-10-07, S5a sign-off → S7)
- **S5a:** signed off as done; commit approved (S5a code, tests, S5 documentation and directly related tracker/decision updates). **S5b, S5c, S5d remain future/blocker scope and must not be implemented.**
- **Q16:** stays OPEN — real student records and result files off-limits; the remote database is treated as potentially production.
- **Device pass:** the coordinated S1–S5a pass stays deferred; one coordinated native/device pass after the next appropriate group of modules; no native Android project yet.
- **Next module:** S7 — Leave and Communication. Document first; do not build. **No leave application, message sending, reply or other write operation** unless explicitly documented and separately approved.

## S7 proposals (2026-10-07, awaiting your answers)
- **Q30 / S7-D1** scope. A (recommended): build S7c subject teachers, S7a leave, S7b messages, all view-only, in that order. B: only S7a and S7b. C: do not build S7 now (backend-blocked), move to S9.
- **Q31** S7-D2 legacy read endpoints only, dedicated screens ignore the tiles' stored `api` (the Parent Communication tile stores the write endpoint); D3 leave newest first by `apply_date`, empty status = Pending, replies only when non-empty; D4 attachments open only in the phone's browser/viewer after F1 link validation (no download, cache, share); D5 30-row batches, current year only; D6 teacher mobile number and image not shown or used; D7 "isn't available in the app yet" sentences for apply/send; D8 never call any write, staff, admin or HR endpoint listed in the S7 document §3.
- **Q32** S7d (apply for leave) and S7e (send a message) are not proposed; both are writes needing separate approval, a confirmed non-production database (or mocked-transport-only tests) and, for the attachment, F5.
- **Q16** stays OPEN.

## Answers received (2026-10-07, S7 approval)
- **Q30** option A — build S7c, S7a and S7b as view-only screens, in that order (subject teachers, my leave applications, my messages to school).
- **Q31** yes — S7-D2…D8 as documented. D2: only the dedicated read endpoints; stored tile URLs and the generic tile endpoint behaviour are not used. D6: teacher mobile numbers and images are never displayed or used. D7: the wording "This isn't available in the app yet" for unavailable write functionality. All three screens strictly view only; attachment links validated through the F1 host allow-list before external opening; no download, cache, persistence or sharing; documented ordering and status behaviour kept; an empty leave status may show as Pending but no other status is invented.
- **Security:** the unauthenticated-read behaviour of the legacy leave/message endpoints is a backend privacy defect; the app always sends the authenticated `type=API`/token-bound request and never weakens it; the defect is not fixed in S7.
- **Q32** S7d (apply for leave) and S7e (send a message) are neither documented further nor built: later, write operations, separate approval and safe non-production verification required; S7d also needs the F5 file-picker dependency.
- **Q16** remains OPEN. **Commit:** S7 stays uncommitted until you have reviewed it and separately approve the commit. **Device pass:** deferred.

## S7 implementation notes (2026-10-07)
- Built as approved; deviations are listed in the S7 document §17 (shared `listHelpers.ts`, no separate parse functions, exact D7 wording, grouped model tests, an extra real-client guard test, awaited unmount in tests).
- **Open:** review and sign-off of S7; commit approval; the coordinated device pass (explicit approval needed); next sub-module.

## Answers received (2026-10-07, S7 sign-off → S9)
- **S7:** S7c, S7a and S7b signed off as done; commit approved (S7 code, tests, S7 documentation and tracker/decision updates; no Laravel, S7d/S7e, device/native, secrets or generated files). **S7d and S7e remain future scope and are not implemented.**
- **Q16:** stays OPEN. **Device pass:** the coordinated native/device pass stays deferred.
- **Next module:** S9. Provide the S9 scope/design first and stop for approval; no S9 implementation before approval.

## S9 proposals (2026-10-07, awaiting your answers)
- **Q33 / S9-D1** scope. A (recommended): build all seven lists (height & weight, vaccination, health details, infirmary, consent, transport, certificates) plus the "not available" screen for hostel and achievement certificate. B: six lists, certificates later. C: do not build S9 now.
- **Q34** S9-D2 legacy read endpoints only, dedicated screens ignoring the tiles' stored `api`; D3 newest first by record date; D4 health data in memory only, never logged/persisted/shared; D5 health document via `safeAttachmentUrl` (placeholder `noimages.png` = no file) and bus-tracking link via `isSafeHttpUrl`, both only in the phone's browser/viewer; D6 doctor contact shown as text, never tappable; D7 certificates as a text version (`stripHtml`) with a notice; D8 height/weight as recorded, no units invented; D9 consent: empty status = Pending, amount in ₹ when numeric, internal ids dropped, no consent action; D10 hostel and achievement certificate show "Not available in the app yet" and make no request; D11 never call blocked or staff endpoints.
- **Q35** the two blocked tiles need backend changes; say if you want the backend ask written up separately.
- **Q16** stays OPEN.

## Answers received (2026-10-07, S9 approval)
- **Q33** option A — build all seven view-only lists (height & weight, vaccination, health details, infirmary, consent, transport, certificates) and the "This isn't available in the app yet." state for Hostel and Achievement Certificate; no write, upload, consent, payment, edit or delete requests.
- **Q34** yes — S9-D2…D11. Health data in memory only; never logged, persisted, cached, shared or exposed through debug output; no share/export; `noimages.png` = no health document; health shows "All years"; doctor phone numbers plain text only; newest first where the backend is oldest-first; null consent = Pending; certificates as the text-only HTML-stripped version with "Text version. For the official certificate, ask your school."; never invent height/weight units; do not fabricate missing transport data; hostel and achievement certificate never call their broken endpoints.
- **Q35** yes — the backend ask for the two blocked tiles is written separately ([backend-asks/S9-blocked-tiles.md](backend-asks/S9-blocked-tiles.md)); no Laravel/backend change.
- **Q16** remains OPEN. **Commit:** S9 stays uncommitted until you have reviewed it and separately approve the commit. **Device pass:** deferred; no new packages.

## S9 implementation notes (2026-10-07)
- Built as approved; deviations are listed in the S9 document §17. The one that goes beyond the plan: because health data must not be cached, the record screens use `gcTime: 0` and drop their data from memory when the screen unmounts (instead of the shared 5-minute per-user cache).
- **Open:** review and sign-off of S9; commit approval; the coordinated device pass (explicit approval needed); next sub-module.

## Answers received (2026-10-07, S9 sign-off → S10)
- **S9:** signed off as done; commit approved (the seven view-only lists, the hostel / achievement certificate unavailable states, models, shared screens, hooks, fetchers, tests, S9 documentation, tracker updates and the separate backend ask; no Laravel, write functionality, broken-endpoint calls, device/native changes, secrets or generated files). **S9b stays blocked on the backend.**
- The stricter health-data handling is approved: no console logging, no persistent storage, no sharing/export, `gcTime: 0`, query cache cleared after unmount, data held only in memory while the screen is active.
- **Q16:** stays OPEN; synthetic / non-existent ids only. **Device pass:** deferred; do not start it.
- **Next module:** the next planned module (S10 — school info and galleries) only after presenting its scope/design and stopping for approval.

## S10 proposals (2026-10-07, awaiting your answers)
- **Q36 / S10-D1** scope. A (recommended): school information (nine pages), photo gallery, video gallery, plus the "not available" state for the classwork tile. B: school information and video gallery only (no in-app images). C: do not build S10 now.
- **Q37** S10-D2 legacy read endpoints only with fixed action texts, tiles' stored `api` ignored; D3 school pages as plain text from the HTML with `http(s)` URLs tappable; D4 photo thumbnails (a) in the app via the built-in `Image` from validated ERP URLs (platform image cache applies) or (b) no in-app images, photos open externally; D5 videos are links only, no third-party thumbnails; D6 classwork tile shows "This isn't available in the app yet." and makes no request (endpoint exposes staff passwords); D7 no share/save/download/upload, albums ordered by newest item.
- **Q38** write up the classwork credential exposure as a separate backend ask (independent of the app); no Laravel change.
- **Q16** stays OPEN.

## Answers received (2026-10-07, S10 approval)
- **Q36** option A — build School Information, Photo Gallery, Video Gallery and the Classwork Gallery unavailable state, all view-only.
- **Q37** yes — S10-D2…D7 with **D4(b)**: the strict no-caching approach. No React Native `Image` for photos; no intentional caching or persistence of gallery images; show photo titles/items in the app and open the actual photo externally after URL validation; videos are links only; no third-party video thumbnails; no download, save, share or in-app media caching. School information: `schoolDetailAPI`, the backend's actual field behaviour preserved (`title` = page type, `description` = HTML content), HTML shown safely as plain text, only http/https links tappable after URL validation, no invented content for empty data. Galleries: both album response shapes handled, deterministic album ordering. Classwork Gallery: must remain unavailable with "This isn't available in the app yet." / "Please ask your school."; `front_desk/send_attachment/create` is never called and its response is never sanitised or partially consumed as a workaround.
- **Q38** yes — the classwork credential-exposure issue is written up as a separate backend security ask ([backend-asks/S10-classwork-credential-exposure.md](backend-asks/S10-classwork-credential-exposure.md)); no Laravel/backend change.
- **Q16** remains OPEN. **Commit:** S10 stays uncommitted until you have reviewed it and separately approve the commit. **Device pass:** deferred; no new packages.

## S10 implementation notes (2026-10-07)
- Built as approved; deviations are listed in the S10 document §17 (text list instead of a thumbnail grid per D4(b), 30 items per page, fully specified album order, an unknown school-page tile shows the unavailable message, a second local token for a non-existent tenant).
- **Open:** review and sign-off of S10; commit approval; the coordinated device pass (explicit approval needed); next sub-module.

## Answers received (2026-10-07, S10 sign-off → S8)
- **S10:** signed off as done; commit approved (School Information, Photo Gallery, Video Gallery, the Classwork unavailable state, models, hooks, screens, registry/API changes, S10 tests, S10 documentation, the classwork credential-exposure backend security ask, and the tracker/decision/README updates; no Laravel, write/upload functionality, device/native changes, secrets or generated files). **S10b stays blocked on the backend.**
- The D4(b) strict no-caching approach is approved: no React Native `Image`, no image library, no intentional photo download/cache/storage, external browser/viewer only after URL validation, no share/download/save controls.
- The classwork endpoint (`front_desk/send_attachment/create`) must remain completely blocked: never called, no fallback; the backend security ask stays; Laravel is not modified.
- **Q16:** stays OPEN; synthetic / non-existent ids only. **Device pass:** deferred; do not start it.
- **Next module:** the next planned module (S8 — learning / LMS) only after presenting its scope/design and stopping for approval.

## S8 proposals (2026-10-07, awaiting your answers)
- **Q39 / S8-D1** scope. A (recommended): S8a (my discussions + conversations), S8b (Learn, at risk) and the Live Lecture message. B: S8a and the Live Lecture message only; Learn shows "This isn't available in the app yet." until the backend binds `studentContentAPI`. C: do not build S8 now. Virtual classroom, portfolio and leader board stay out of every option.
- **Q40** S8-D2 social uses the modern token-bound API only (`mine=1`), never the legacy one; D3 Learn uses `studentSubjectAPI` and `studentContentAPI` only, tile `api` ignored; D4 only the student's own discussions are shown, the tenant feed is never requested; D5 (option A) `studentContentAPI` with digit-validated ids, one chapter's items shown when opened, any `status:0` other than `No Data Found` is an error; D6 links open only externally (ERP files via `safeAttachmentUrl`, other plain https via `isSafeHttpUrl`), no download/cache/share, no image fetched; D7 no write of any kind.
- **Q41** add the Student Discipline tile (`child_remark`, 23 tenants) as S9c, view only, with the S9 health-data handling.
- **Q42** write up the `studentContentAPI` problems and the other S8 §10 items as a separate backend ask; no Laravel change.
- **Q16** stays OPEN. **Disclosure (S8 document §0):** a research probe of the modern social-collaborative list without `mine=1` returned one real public discussion post from tenant 1; only the first 320 characters were displayed and the response file was deleted unread; no further request to that feed will be made without `mine=1`.

## Answers received (2026-10-07, S8 approval)
- **Q39** option B — build S8a (Social Collaborative, view-only, the student's own discussions only) and S8c (Live Lecture, unavailable state only). **S8b Learn is not built**: its tile shows "This isn't available in the app yet." / "Please ask your school."
- **Q40** yes — S8-D2…D7 with these clarifications. S8a: only the modern token-bound API with `mine=1`; never request the broad/public feed; never show another student's or a public discussion; view only (no posting, commenting, editing, deleting); no author information beyond what is explicitly required and safely returned for the student's own records; external links validated; no images fetched automatically. S8b: do not call the content endpoint, no legacy fallback, no client-side workaround for the SQL/query-construction issue, keep the unavailable state until the backend endpoint is reviewed and fixed, document the exact backend risks. S8c: no endpoint, the approved unavailable state, no request.
- **Q41** approved — Student Discipline is added as **S9c**: view-only, S9 sensitive-data standard (in memory only, no console logging, no persistent storage, no sharing/export), no write/edit/delete, authenticated token-bound requests, synthetic ids only. Added to the tracker and the S9 document (§18); **not implemented** unless separately approved after S8.
- **Q42** yes — [backend-asks/S8-learn-content-endpoint.md](backend-asks/S8-learn-content-endpoint.md): SQL built from request values, no pagination, repeated queries per chapter/topic, CDN/external links, the required server-side validation/parameterisation and authorization review. No Laravel change.

## Q16 process correction (2026-10-07) — applies from now on
The S8 research probe that returned one real public discussion (S8 document §0) means Q16 stays open and is treated more strictly:
- Do **not** intentionally retrieve any real database row, even if it is publicly visible. Synthetic / non-existent ids only.
- If a supposedly synthetic probe unexpectedly returns a real row: **stop immediately, do not inspect or quote its contents, do not save it, and report it.**
- Do not use broad / list endpoints that can return real tenant data merely to inspect a response shape.
- Do not read real student, parent, teacher, discussion, health or school content. All production / live-data assumptions stay closed until Q16 is explicitly resolved.
How it was applied in S8: the local test requests the discussion list only with `mine=1` (scoped to the non-existent caller), asserts counts only, never prints or inspects a body, and the detail only for a non-existent id.

## S8 implementation notes (2026-10-07)
- Built as approved; deviations are listed in the S8 document §17. The one that touches shared code: an opt-in `bearerOnly` request option in the F1 client, so the two S8a GET calls do not repeat the JWT in the URL (default behaviour unchanged, tests pin both).
- **Open:** review and sign-off of S8 (including the `bearerOnly` change); commit approval; whether to implement S9c next; the coordinated device pass (explicit approval needed).

## Answers received (2026-10-07, S8 sign-off → S9c)
- **S8a + S8c:** signed off as done; commit approved (S8a view-only functionality, the Live Lecture and Learn unavailable states, discussion models/hooks/screens/API changes, S8 tests and documentation, the Learn backend security ask, the Q16 process-correction documentation, the S9c tracker/documentation updates, and the F1 `bearerOnly` change with its tests; no Learn implementation, no Learn content endpoint calls, no posting/commenting/edit/delete, no Laravel, device/native, secrets or generated files).
- **`bearerOnly` (F1) explicitly approved:** default behaviour for existing modules is unchanged; S8a GET requests use the Authorization Bearer header only and never put the JWT in a query parameter; the tests cover both the default and `bearerOnly`.
- **Q16:** stays open with the strict rule: synthetic / non-existent ids only; never inspect real response bodies; never use broad endpoints to discover response shapes; if any synthetic request unexpectedly returns real data, stop immediately and report it.
- **S9c — Student Discipline — approved as the next implementation (view only):** token-bound requests only; synthetic ids only for verification; data in memory only; no console logging; no persistent storage/cache/share/export; no write/edit/delete; no unnecessary ids or sensitive fields exposed; follow the backend's actual status/text values without inventing business states; external links validated through F1; no device/native work. Build and verify, **do not commit** until sign-off.

## S9c implementation notes (2026-10-07)
- Built as approved (view only, S9 sensitive-data standard). Details and the one interpretive choice (showing the backend's own 1 / 0 / -1 flag coding as Positive / Neutral / Negative, neutral-toned) are in the S9 document §19.
- **Open:** review and sign-off of S9c; commit approval; the next sub-module; the coordinated device pass (explicit approval needed).

## Answers received (2026-10-07, S9c sign-off → S13)
- **S9c:** signed off as done; commit approved (the Student Discipline view-only screen, API/model/hook changes, S9c tests, registry changes, S9c documentation and tracker updates, the approved S9 memory-only handling; no Laravel, write functionality, device/native changes, secrets or generated files).
- Security requirements stay approved: authenticated token-bound requests only; synthetic ids only for verification; data in memory only; no console logging; no persistent storage / cache / share / export; no write / edit / delete; no unnecessary sensitive fields or ids; external links through F1.
- **Q16:** stays open and strict: no real database row is to be intentionally retrieved or inspected; synthetic / non-existent ids only; no broad endpoints to discover response shapes; if a synthetic request unexpectedly returns real data, stop and report it. **Device pass:** deferred.
- **Next module:** the next planned module (S13 — Profile) — present its scope/design and stop for approval before implementation.

## S13 proposals (2026-10-07, awaiting your answers)
- **Q43 / S13-D1** scope. A (recommended): add the on-demand **My details** card to the Profile tab (view only). B: leave the Profile tab as it is (session-only) and close S13 as "no change needed". C: auto-load the details on open (more exposure; not recommended).
- **Q44** S13-D2 `GET api/own-profile` only, via `bearerOnly`, no fallback; D3 loaded only on **Show my details**, dropped on **Hide** (`gcTime: 0`); D4 mandatory identity cross-check (email, else name) that fails closed; D5 rows: mobile (plain text), date of birth, admission/joining year, address, blanks omitted, no id / image / role / school re-shown; D6 nothing logged, persisted, shared or exported, no photo, no write.
- **Q45** write up the S13 §13 backend items (above all the possible wrong-person lookup at `OwnProfileApiController.php:17`) as a separate backend ask; no Laravel change.
- **Q16** stays OPEN and strict; the S13 research made no probe at all.

## Answers received (2026-10-07, S13 approval)
- **Q43** option A — the on-demand "My details" card (Mobile, Birthdate, Admission year for students / Joining year for staff, Address); it loads **only** after the user taps "Show my details".
- **Q44** yes — S13-D2…D6. **Critical:** the identity cross-check is mandatory and fail-closed — the response must match the signed-in user's email case-insensitively; if the server email is empty the full name must match; if neither matches show "Your details can't be shown right now." and display no field of the rejected response; never fall back to showing it; never attempt another person's id. Privacy: load only on explicit action; "Hide details" removes the record from memory immediately; nothing persisted, cached, logged or shared; no profile images; no server id, role or school displayed; mobile number plain text, never tappable; blanks omitted, nothing invented. Authentication: modern token-bound `GET api/own-profile` with the approved `bearerOnly`; the JWT never in the URL; no student / staff id sent; the 422 academic-year case handled explicitly and safely; no legacy fallback. **S13b (editing, password change, photo change, any write) is not approved.**
- **Q45** yes — [backend-asks/S13-own-profile.md](backend-asks/S13-own-profile.md): student/staff detection by the exact profile name "Student", the possible wrong-person lookup, the need to authorize by the authenticated user's real role/type rather than display text, the academic-year dependency. No Laravel change.
- **Q16** remains strictly open (no real-data probes; synthetic ids only; never inspect real response bodies; stop and report if a synthetic request returns real data). **Device pass:** deferred.

## S13 implementation notes (2026-10-07)
- Built as approved; deviations are in the S13 document §15 (the request carries no query parameter at all; the identity check runs inside the query function so a rejected record is never cached; a name-only match is deliberately strict).
- **Open:** review and sign-off of S13a; commit approval; what comes next now that every planned module is done or recorded as future / blocked; the coordinated device pass (explicit approval needed).

## Answers received (2026-10-07, S13a sign-off → device pass)
- **S13a:** signed off as done; commit approved (the My Details card, Show/Hide memory lifecycle, fail-closed identity cross-check, profile API/model/hook changes, S13 tests and documentation, the backend ask, and the tracker/decision/README updates; no Laravel, editing, password / photo change or other write functionality, device/native changes, secrets or generated files). Approved explicitly: bare GET to `api/own-profile`, JWT in the Authorization header only, no query parameters, no legacy fallback, email match as the primary check, name match only when the server email is empty, reject and expose nothing on mismatch, `gcTime: 0`, synchronous query removal on Hide, no logging / persistence / sharing / exporting, no image fetching.
- **Q16:** remains open and strict. **No further feature implementation starts automatically.**
- **Next step:** a coordinated Device / Native Pass — first a dedicated scope document covering the checks listed in your message; **the native build is not started** until you explicitly approve the pass. S4b / file-picker work and backend-fix follow-ups remain separate future work and are not mixed into the device pass.

## Device / Native Pass proposals (2026-10-07, awaiting your answers)
- **Q46** approve the pass: A (recommended) the full pass; B build + launch + login screen + manifest/security + release build only; C do not start.
- **Q47** data source while Q16 is open: A a synthetic mock API (dev-only Node script in `tools/mock-api/`, no package, never bundled, records every request for the unsafe-endpoint audit) — recommended; B wait for a Q16 resolution and a test account; C none.
- **Q48** native project location: a scratch copy / worktree outside the repo (recommended) or `prebuild` in the repo with `/android` and `/ios` added to `.gitignore`.
- **Q49** who drives: I drive with `adb` (recommended) or you drive manually.
- **Q50** release verification: a local release APK signed with the debug key, never distributed, no keystore created or committed.
- **Q51** session-only `JAVA_HOME` (Android Studio's JDK) and `ANDROID_HOME`, with Gradle/Maven downloads — OK?
- **Q52** install `expo-asset` only if the device run proves it necessary (and report it).
- **Q16** stays OPEN and strict; the pass uses fabricated data only.

