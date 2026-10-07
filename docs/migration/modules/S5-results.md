# S5 — Student results

Status: **S5a DONE** (signed off 2026-10-07) — view-only result-PDF list implemented, tested, verified locally with synthetic ids only. Document approved 2026-10-07 (Q27 option A; Q28 S5-D2…D6 yes; D3 id-ascending order, external viewer only; Q29 S5b/c/d future/blocker items). Real-data check intentionally not done (Q16 open); device check deferred to the coordinated pass. **The app downloads, caches, shares and calculates nothing. S5b, S5c, S5d must not be implemented.**
Class: **V1** · Role: Student · Next in the approved build order (03 §5: … S6a → **S5** → S7 …) · Depends on: **F1** (done — form-encoded legacy requests and `resolveUrl`), **S1** (done — student gate, per-user query hook, stale banner, `safeAttachmentUrl`), S3 (done — the "open a file with `Linking`" pattern). S2/S4a/S6a are patterns only, no code dependency · Decisions: D-03, D-09, D-13, D-14, D-17.
Facts cite file:line. `ev:` = [evidence/](../evidence/README.md). **[ASSUMPTION]** = not read from code. **[VERIFIED-LOCAL]** = observed on the local Laravel server on 2026-10-07 using only a **non-existent student (`999999999`, tenant `1`)** — **no real student data was read** (Q16). **[VERIFIED-NO-DB]** = checked by reading code or running PHP that touches no database.

## 0. Scope map — what is proposed, and what is only identified
S5 on the production menu is **two tiles that open PDF files** (ev:menu_tiles.txt lines 12, 15, 53). Nothing on the server returns a student's marks as data that is safe to show (§3). So S5 is a **document-access** module: the app lists the files and opens them; it never calculates or shows marks, percentages or grades itself.
| Part | What | Kind | Proposed for this build? |
|---|---|---|---|
| **S5a** | **Result PDFs**: the term-wise report-card files the school uploaded for the student, for the school year; "Open" hands the file link to the phone's browser/viewer | **view only** (read a list, open a public file link) | **Yes — subject to S5-D1/D3 (§17)** |
| S5b | **WRT progress report** (`get_wrtreportAPI`): the server generates a PDF on demand | view only, but heavy and side-effecting | **No** — blocked by backend and by a missing app input (§3, §10) |
| S5c | The one tenant whose Result tile points at `studentResultPDFAPI` | view only | **No** — unauthenticated, injectable and destructive endpoint (§3, §10). The tile shows an honest "not available in the app yet" message instead of calling it (S5-D4) |
| S5d | Native marks / grades / percentages / rank | view only | **No** — no safe, student-bound marks API exists (§3). Later / backend-dependent |
S5a **never** triggers PDF generation on the server, **never** writes anything, and **never** sends a student id other than the signed-in student's own (F1 pins it).

## 1. What the student will be able to do (S5a)
Open "Result PDF" and see, for the current school year, one row per term the school has published a file for — the term name (e.g. "Term 1") and an **Open** button. A term with no file yet shows "No file uploaded yet". Pull to refresh. Opening a file sends its link to the phone's browser or PDF viewer (as Exam Schedule does in S3); the app itself does not download, store, cache or share the file.

## 2. Existing screens and Laravel endpoints (evidence)
| Source | Finding |
|---|---|
| **Web (D:/lms_k12)** | **No student-facing results screen.** Every result page is staff-only: `app/result/report-card/page.tsx` (generate report cards for a class from templates; the "View saved results" link at `:226` goes to `api/result/all-results`), `app/result/upload-result/page.tsx` (staff upload one PDF per student per term; the "View" link at `:324` is `${API_BASE_URL}/storage/upload_result/${row.fileName}`), `app/result/student-result-remarks`, masters. Searched `app/result`, `lib/result`, `components` for `isStudent`, `uploadResultAPI`, `studentResultPDFAPI`, `get_wrtreportAPI`: no student path (the only hit is `lib/result/masters.ts:568`, a master slug). So S5 is **mobile-only**, on the legacy mobile contract. |
| **Production menu** (read-only SELECT on `mobile_homescreen`, 2026-10-07; ev:menu_tiles.txt) | `Result PDF` → `screen_name=result_pdf` → `https://erp.triz.co.in/uploadResultAPI` (params `student_id,sub_institute_id,syear`) in **22 of 34** student tenants (line 12); **the same `screen_name`** → `studentResultPDFAPI` in **1** tenant (line 15); `WRT Progress Report` → `wrt_progress` → `get_wrtreportAPI` (params incl. `type,from_date,to_date`) in **10** tenants (line 53). The staff menus also carry `t_wrt_progress` (5 + 8) and `t_marks` (21): teacher screens, out of scope here. |
| **Flutter** (reference only) | `lib/screens/student/tabbed.dart:121-152`: *Result PDF* calls **`/api/result/cbse-1t5-result/pdf`** with a `term_id` taken from login data, falling back to `studentResultPDFAPI`; it never uses `uploadResultAPI`, which is what 22 tenants' tiles actually point at (ev:flutter_ref.md; its docs say its endpoints were never run live). `info.dart:165-189`: WRT report needs an exam from `GET /api/result/exam-master/dropdown?standard_id=` plus dates. |
| **Current RN app** | both tiles fall back to `GenericDataScreen`, which posts JSON with no student block. For `uploadResultAPI` the server happens to read `$request->input`, so it answers (**[VERIFIED-LOCAL]** below) but the generic screen shows a raw list. For `studentResultPDFAPI` the call fails validation (`term_id` required). |
**Backend (read in full 2026-10-07, read-only):**
| Endpoint | Route | Method | Auth / identity |
|---|---|---|---|
| `POST uploadResultAPI` | `routes/result.php:133` | `upload_result_controller::uploadResultAPI` `:242-284` | JWT **signature** check (`$this->jwtToken()->validate()`, `:246`) → 401 `{status:'2'}`; `student_id`, `sub_institute_id`, `syear` taken from the **request** (`:258-260`); no ownership check |
| `POST studentResultPDFAPI` | `routes/result.php:214` (named) | `cbse_1t5_result_controller::studentResultPDFAPI` `:762-` | JWT checked **only when `type == "API"`** (`:765`); identity from the request; **raw SQL built from request strings** (`:809-880`) |
| `POST get_wrtreportAPI` | `routes/adminapi.php:93` | `adminapiController::get_wrtreportAPI` `:2278-2640` | JWT checked, but a failure is **HTTP 200** `{status:'2'}` (`:2280-2287`); identity from the request |
| `GET api/result/all-results`, `GET api/result/all-results/{id}` | `routes/resultapi.php:244-245`, group `api.session` | `AllResultsApiController` → `allResultController` | token-bound **list** (student = token user id, `allResultController.php:16`); `{id}` has **no ownership check** (`AllResultsApiController.php:50`) |
| `POST api/result/cbse-1t5-result/pdf` | `routes/resultapi.php:274` | `Cbse1t5ResultApiController::pdf` `:100-` → delegates to `studentResultPDFAPI` (`:116`) | `api.session`, but `student_id` from the **body**; inherits the SQL concatenation |
| `GET api/result/current-result` / `GET current_result` | `routes/resultapi.php:251`, `routes/result.php:120` | `resultAPIController::currentResult` `:96-` | `student_id` optional from the request; **without it the query aggregates every student of the class** (`:131-135`) |
| WRT modern: `api/result/wrt-progress-report[/show]`, `api/result/exam-master/dropdown` | `routes/resultapi.php:289-290`, `:63` | `WrtProgressReportApiController` | class-level (`grade`, `standard`, `division`): staff screens, not student-bound |
**No modern, student-token-bound results API exists.** The only token-bound result route that identifies the student from the token is the `all-results` *list*, and its companion `show` is unsafe (§3).

## 3. Which API (S5-D2): legacy `uploadResultAPI`, and which endpoints not
| Endpoint | Verdict | Why (evidence) |
|---|---|---|
| **`uploadResultAPI`** | **Use for S5a** | the production tile's own contract for 22 of 34 tenants; read-only; parameterised query-builder SQL (no concatenation, `upload_result_controller.php:262-273`); requires a valid JWT (401 otherwise, **[VERIFIED-LOCAL]**); returns only the files **staff uploaded** for that student and year; the files live in `storage/upload_result/`, a folder the generators below never wipe (they clear `result_pdf/` and `WRT_result_pdf/`). It does not need a school-year row (a legacy bare path, no `api.session`), so there is no "Academic Term Date Expired" state. |
| `studentResultPDFAPI` | **Do not use — blocked** | (1) **No authentication at all** unless `type=API` is sent: **[VERIFIED-LOCAL]** a request with no token and no `type` got a normal answer (`{"status":0,"message":"No Record"}`, `:765`). (2) **SQL injection**: request values are concatenated into SQL (`:809-880`, e.g. `:851` `result_html`). (3) The "approved for mobile" gate is **commented out** — `// AND is_allowed='Y'` at `:853` — although the school's approval screen writes `result_html.is_allowed` (`approve_mobile_result_controller.php:106,121`), so unapproved report cards are served. (4) Generates PDFs synchronously and **deletes every file in `storage/result_pdf/`** on each run (`:886`, `:992`), so one student's request can break another's link. (5) Tenant-specific fee logic (`== '195'`, `:862`). (6) Needs `term_id` (the app has none). No safe use exists: sending `type=API` fixes only (1). Backend asks in §10. |
| `api/result/all-results` (list) | **Not used** | token-bound, but with no `is_allowed` filter (`allResultController.php:22`: only tenant and student), so it lists **unapproved** report cards; and it is useless without `show`. **[VERIFIED-LOCAL]** `{"success":true,…,"data":[]}` for the synthetic student. |
| `api/result/all-results/{id}` | **Never** | **IDOR**: only checks that the row exists (`AllResultsApiController.php:50`) — any id returns any student's report card as a PDF; the link is `http://` (`allResultController.php:82`, mixed content); wipes `result_pdf/` (`:62`). |
| `api/result/cbse-1t5-result/pdf` | **Never** | `student_id` from the body, then the injectable legacy method (`Cbse1t5ResultApiController.php:116`). **[VERIFIED-LOCAL]** 404 "No Record" for the synthetic student. |
| `current_result` / `api/result/current-result` | **Never** | raw `result_marks` sums with no approval gate, no ownership, and class-wide aggregates when `student_id` is missing (`resultAPIController.php:131-135`). Not a published result. |
| `get_wrtreportAPI` | not used in S5a (S5b — identified only) | see §10: needs the student's class and an exam id the app does not have; with no exam id or dates the exam query is `exam_id = NULL` and `BETWEEN NULL AND NULL`, i.e. **empty** (`WRT_progress_report_controller.php:193-194`); heavy and wipes `WRT_result_pdf/` (`adminapiController.php:2603`); validation failure comes back as `status:'1'` with `data: []`. |

## 4. S5a API contract — `POST uploadResultAPI`
Sent through F1's `legacy.post`: form-encoded, identity block from the session, Bearer header, `type=API`. The app sends only the identity block — **no extra fields** — and the student id and tenant come from the session; a screen cannot override them (F1 §4.2). (The server also accepts a JSON body here — **[VERIFIED-LOCAL]** — but F1's form encoding is used for uniformity with every other legacy call.)
| Field | Source | Rule |
|---|---|---|
| `student_id`, `sub_institute_id`, `syear` | session (`syear` = login `mobile_syear`) | all three must be non-empty, else the server answers `{"status":0,"message":"Parameter Missing"}` (`:279-280`) |
**Observed responses [VERIFIED-LOCAL]:**
| Case | Response | F1 result |
|---|---|---|
| synthetic student, real tenant, year 2026 | `200 text/html {"status":1,"message":"Success","data":[]}` | success, empty list |
| no token | `401 application/json {"status":"2","message":"JWT token is required.","data":[]}` | `unauthorized` (sign-out) |
| JSON body | same success (the controller reads `$request->input`) | — |
**Success shape (from code `:262-277`; not observed with data — Q16):** `{"status":1,"message":"Success","data":[{"id":…,"syear":…,"sub_institute_id":…,"student_id":…,"term_name":"…","file_name":"https://<server host>/storage/upload_result/<file>"}]}`; `file_name` is `''` when the row has no file. There is one row per term (`GROUP BY ur.term_id`); `term_name` comes from `academic_year.title` joined on term and tenant **without a year condition**, so a term title can come from another year's row (the title is normally the same). The link's host is the **server's own `SERVER_NAME`**, always `https://`.
**Parsing (planned):** accept a list under `data`; a non-list `data` is an empty list (as S3/S4a); each row → `{ id, term: term_name, file: file_name }` as plain text; **no number, mark or date is parsed**.

## 5. Student identity, session and academic year
- Token and ids come only from the session via F1. No id is read from route params, props or text input. In-screen guards as S1–S6a: not a student → "Students only" and **no request**; no school year → "School year not set" and **no request**.
- The query key carries the user id and year; the cache is cleared on sign-out; nothing is written to disk; links are never logged.
- **Academic year:** the request carries `user.syear` (the login's `mobile_syear`); the screen says "School year {syear}". There is **no year or term switcher** in V1, so earlier years' report cards are not reachable in the app; the server filters `ur.syear = syear` (`:271`). **No term id is sent** — the server returns every term of the year in one answer.
- **Backend weakness (reported, not fixable here):** the endpoint trusts `student_id` from the request, so any valid token could list another student's files. The app only ever sends its own id.

## 6. Data presentation, unknown values and "calculations"
- **The app calculates nothing.** There is no percentage, grade, rank, total or pass/fail logic in S5. **Source of truth for every mark and grade is the PDF the school uploaded** (`upload_result.file_name`, written by the staff upload screen); the app shows only the term name and a link.
- **Row text:** `term_name` as sent (trimmed); an empty or missing name shows "Term" (never blank, never dropped); the row stays visible.
- **Unreadable / unusable values:** a row with an empty `file_name` shows "No file uploaded yet" and **no Open button**; a link that fails the host check (§8) shows "This file can't be opened from the app" and **no Open button** — the row is never hidden. A `data` that is not a list is an empty list. Duplicate terms (two rows with the same name and link) collapse to one.
- **Order:** rows keep the server's order, stable-sorted by row `id` ascending, i.e. the order the school created them (the server's `GROUP BY` order is not defined). **[ASSUMPTION]** that ascending upload order reads as Term 1, Term 2; the rule is a decision (S5-D3).
- **Marks that cannot be read:** n/a — marks live inside the PDF, and the app never reads the PDF.

## 7. UX and states (S5a)
**Screen:** caption "School year {syear}"; a card per term: the term name and either **Open** (secondary button), "No file uploaded yet", or "This file can't be opened from the app"; a closing note: "Your marks and grades are in the PDF your school published. Opening a file uses your phone's browser or PDF viewer."
| State | UI |
|---|---|
| loading, no data | existing `Loading` |
| error, no data | `ErrorState` + Try again (F1 messages: network, 401 session expired, 5xx) |
| `Parameter Missing` (validation) | the server message, with Try again |
| empty list | `EmptyState` "No results published yet" — "Your school has not published a result file for school year {syear}. Please contact your school if you expected one." |
| error while cached | content stays + banner "Couldn't refresh — showing the last loaded data." |
| the file link cannot be opened (`Linking.openURL` rejects) | an inline notice under the row: "Couldn't open the file. Please try again or contact your school." (S3 silently ignores this; S5 reports it) |
| `syear` missing / not a student | "School year not set" / "Students only"; no request |
| the one `studentResultPDFAPI` tenant (§3) | `EmptyState` "Result PDFs aren't available in the app yet" — "Please ask your school for your report card." **No request is made** (S5-D4) |
| refreshing | pull-to-refresh |
**Stale data:** 5-minute stale time, as S1–S6a; a staff upload after that appears on the next refresh. **Accessibility:** each card is one group ("Term 1, file available"); Open is a ≥ 44 dp button labelled "Open Term 1 result PDF"; no information is colour-only.
**Which tile gets which behaviour:** the registry maps the `result_pdf` *screen name*, which both the 22-tenant and the 1-tenant tile share. The screen reads its tile's stored `api` **only to recognise the blocked endpoint**: if its last path segment is `studentResultPDFAPI` it shows the "not available yet" state; otherwise it calls the fixed `uploadResultAPI` path (as S1–S6a ignore the stored URL).

## 8. Security considerations
- **Report cards are personal data.** In memory only (TanStack cache keyed by user, cleared on sign-out), never logged, never persisted, never put in a route param.
- **Opening a file leaves the app.** `Linking.openURL(link)` after `safeAttachmentUrl` (S1): only `http(s)`, host re-based onto the configured API host when it is the ERP host, any unknown or look-alike host, credentials in the URL, `file:`, `javascript:`, `intent:` refused. No token is attached (storage files are public — see below). The app does not download, cache, share or re-host the file.
- **The file URLs are unauthenticated and public** (`/storage/upload_result/<file>`, built by the server; the same links the staff web page uses, `app/result/upload-result/page.tsx:324`). Anyone holding a link can read the report card; the app cannot change that. Whether file names are guessable depends on how the upload names them — **not established** (Q16). Recorded as a backend risk (§10).
- **Not called, by design:** `studentResultPDFAPI`, `api/result/all-results` (list and `{id}`), `api/result/cbse-1t5-result/pdf`, `current_result`/`api/result/current-result`, `get_wrtreportAPI`. A local test asserts that the S5a call touches only `/uploadResultAPI`.
- **Plain text only:** the term name is shown as `<Text>`; no HTML from the server is rendered.
- **No PDF is opened inside the app**, so no PDF parser or WebView runs in the app's process.
- **Identity:** session-only (F1); students cannot choose another `student_id`; in-screen guards; per-user cache.
- Server-side risks recorded for the backend owners (§10); none introduced by the app.

## 9. Dependencies
| Reused | From | Used for |
|---|---|---|
| `legacy.post` (form-encoded identity block, text-first parsing, `status:'2'`/401/419/500 mapping) | F1 | the request |
| `useStudentQuery`, `studentGate`, `StaleBanner` | S1 | guards, loading, error + retry, stale banner, per-user cache |
| `safeAttachmentUrl` (`circularModel.ts:11`) and the `Linking.openURL(...).catch` pattern | S1, S3 | link validation, opening files |
| `Card`, `Button`, `Page`, `EmptyState`, theme tokens | existing kit | layout |
No dependency on S2/S4a/S6a code. Not used: F5, S4b, S6b–d, any auth change.

## 10. Backend limitations and known defects (for the owners; not to be fixed in this migration)
1. **`studentResultPDFAPI`** (`cbse_1t5_result_controller.php:762-`): unauthenticated without `type=API` (`:765`); SQL concatenation of request values (`:809-880`); the `is_allowed='Y'` gate commented out (`:853`); deletes all of `storage/result_pdf/*` on each call (`:886`, `:992`); synchronous PDF generation; needs `term_id`; hard-coded school `195` fee gate (`:862`, message at `:963`).
2. **`api/result/all-results/{id}`** (`AllResultsApiController.php:50`, `allResultController.php:28-85`): no ownership check, serves any student's report card; `http://` link (`:82`); wipes `result_pdf/` (`:62`). The list (`allResultController.php:16-22`) ignores `is_allowed`.
3. **`api/result/cbse-1t5-result/pdf`** takes `student_id` from the body and inherits (1).
4. **`current_result`** (`resultAPIController.php:96-137`): no ownership, class-wide aggregates when `student_id` is omitted, raw marks (not a published result).
5. **`get_wrtreportAPI`** (`adminapiController.php:2278-2640`): needs `exam_type` and a date range or the exam query is empty (`WRT_progress_report_controller.php:193-194`); validation failure is `status:'1'` + `data: []` + `response` (`:2289`); wipes `WRT_result_pdf/` (`:2603`); student id from the request. The app has **no input for it**: the student's standard id is in the login response (`ApiLoginController.php:336-354`, `studentAcademic`) but the app's session does not keep it, and the exam list needs a separate call (`exam-master/dropdown?standard_id=`). Building S5b would first need an auth/session change (F1/F3 scope) — **not proposed**.
6. **`uploadResultAPI`** itself: no ownership check (student id from the request); `term_name` is joined without a year condition; public, unauthenticated file URLs.
**Backend asks:** read the student from the token for students on every endpoint above; add the `is_allowed='Y'` filter back and to `all-results`; parameterise the SQL in `studentResultPDFAPI`; give each generated PDF a per-request folder or name instead of wiping a shared folder; serve report-card files through an authenticated route.
**Consequence for the plan:** S5a depends only on the staff-upload flow and is **not** known to be affected by any defect above. What cannot be known without real data (Q16): whether real students have rows in `upload_result`, whether those rows carry files, and whether the file links open.

## 11. Exact files expected to change (all under `D:/lms_k12_mobile_rn`)
**Modified (2 — additions only):** `src/api/student.ts` (append `fetchResultFiles()`, `parseResultFiles()`, types), `src/screens/registry.ts` (+ `result_pdf`).
**New:** `src/screens/student/resultsModel.ts` (pure: row text, order, duplicate collapse, openable-link decision, blocked-endpoint check), `src/screens/student/ResultPdfScreen.tsx`, `src/hooks/useResultFiles.ts`.
**Tests:** `__tests__/resultsModel.test.ts`, `studentResultsApi.test.ts`, `ResultPdfScreen.test.tsx`, `studentResults.local.test.ts` (opt-in), plus `registry.test.ts` (ten names).
No `package.json`, native, Laravel or Next.js change; no new library; S1–S6a behaviour unchanged.

## 12. Tests and acceptance criteria
**Model:** row text (trimmed, "Term" fallback); order by id ascending incl. non-numeric ids and ties; duplicate collapse; empty and missing file; unsafe links (foreign host, look-alike, credentials, `javascript:`, `file:`, bare name, empty); ERP-host link re-based onto the API host; blocked-endpoint recogniser (`studentResultPDFAPI` in any case/with query string/absolute or relative; `uploadResultAPI`, `null`, other paths are not blocked).
**API:** path `uploadResultAPI`, **form-encoded** with the identity block and nothing else, Bearer; student id from the session even if a caller passes another; success mapping (strings, numbers, nulls, empty `file_name`); `data` missing / not a list → empty; `Parameter Missing` (status 0) → validation; 401 and HTTP 200 `status:'2'` → unauthorized; 419; HTTP 500 HTML; network failure; **only `/uploadResultAPI` is ever requested** (never the five other endpoints); one request per fetch.
**Component:** loading → rows; Open opens the validated link with `Linking.openURL` and does nothing for unsafe links; "No file uploaded yet"; "This file can't be opened from the app"; open failure → inline notice; empty state; 401; 5xx + Try again; network; validation message; stale banner after a failed refresh; guards (no request for a non-student or without a year); per-user cache; **the blocked-endpoint tile makes no request and shows the "not available" state**; no marks, grades or numbers are rendered; `registry` — ten names.
**Regression:** all 476 existing tests pass; typecheck clean.
**Acceptance:**
1. The `result_pdf` tile opens `ResultPdfScreen`; removing the registry line restores today's behaviour.
2. One row per term from `uploadResultAPI`, with Open only for acceptable links; nothing hidden; the order rule holds.
3. Every state in §7 is reachable and correct.
4. The request is form-encoded with the session's own ids; no request for a non-student or without a school year; only `/uploadResultAPI` is ever called.
5. The app calculates and displays no mark, percentage, grade or rank.
6. `npm run typecheck` and `npm test` pass; no native/package change.
7. Local synthetic-id checks pass (§13); the real-data check is **not** claimed.

## 13. Local-server verification plan (synthetic ids only — Q16)
Same setup as S1–S6a: `php artisan serve --host=127.0.0.1 --port=8000`, JWTs signed locally; a **non-existent student `999999999` on tenant `1`**. An opt-in, loopback-only test `studentResults.local.test.ts` drives the real client and fetch function over real HTTP:
| Check | Expected |
|---|---|
| `fetchResultFiles()` for the non-existent student | `[]` |
| bad token | `unauthorized` |
| the call's URL | only `/uploadResultAPI` (spy on fetch) |
| request encoding | form-encoded |
Already done for this document (curl against the local server, 2026-10-07, synthetic student, **no file was generated or deleted** because no record exists — Laravel's tree still holds only its four earlier changes): the results in §3 and §4 — `uploadResultAPI` 200/401, `studentResultPDFAPI` with and without `type`/token, `get_wrtreportAPI` 200/`status:'2'`/`status:'1'`+`response`, `all-results` 200/404/401, `cbse-1t5-result/pdf` 404, `exam-master/dropdown` 200 empty.
**Cannot be verified without real data (Q16):** the real success rows, whether real students have result files, whether the file links resolve, file naming, and the order in which the server returns rows. The link host is the server's own name, so a local run yields `https://127.0.0.1/...` links that cannot be opened — the link rules are unit-tested instead.

## 14. Device / coordinated-pass additions
For the later pass (you will approve the native build): the result list at 360 dp (long term names wrap), Open handing a real file to the browser/PDF viewer, return to the app afterwards, behaviour with no PDF viewer installed (the inline notice), pull-to-refresh, and the error/empty states.

## 15. Rollback
Delete the `result_pdf` line in `src/screens/registry.ts` (the tile falls back to `GenericDataScreen`, today's behaviour) or `git revert` the S5a commit; the additions to `student.ts` are additive and unused afterwards; F1 and S1–S6a are unaffected. JS-only; no server or data change; nothing is written anywhere.

## 16. What "done" does not include
S5b (WRT progress report), S5c (`studentResultPDFAPI`), S5d (native marks/grades), in-app PDF viewing, downloading or sharing files, other school years, any result-related staff screen. All are future scope and need your separate approval.

## 17. Decisions and questions (answered 2026-10-07: Q27 option A — build S5a; Q28 yes incl. D3; Q29 S5b/c/d not documented or built; Q16 still open)
- **Q27 / S5-D1 — go or no-go for S5a?**
  - **Option A (recommended):** build S5a now — read-only, no calculation, and exactly the production tile's contract for 22 of 34 tenants. It is not known to be affected by any backend defect; real behaviour (rows, files) can only be learned with real data.
  - **Option B:** do not build S5 now; record S5 as backend-blocked and move to the next module (S7 leave and communication).
- **Q28** Confirm S5-D2…D6:
  - **D2** legacy `uploadResultAPI` only (§3);
  - **D3** the order rule (row id ascending), "No file uploaded yet" / "can't be opened" states, and **opening files in the phone's browser/viewer only — no in-app viewer, download, cache or share**. Opening a student's report card is the whole purpose of this module, but it is document access, so I am asking explicitly;
  - **D4** the one `studentResultPDFAPI` tenant sees "not available in the app yet" and no request is made (today that tile only shows a validation error);
  - **D5** no native marks/grades/percentages, ever from the endpoints in §3;
  - **D6** never call `studentResultPDFAPI`, `api/result/all-results`, `api/result/cbse-1t5-result/pdf`, `current_result`/`api/result/current-result` or `get_wrtreportAPI` from the app.
- **Q29** S5b (WRT progress report), S5c and S5d are **not proposed**. Say if you want any documented later; S5b needs a session/auth change first (§10.5).
- **Q16 stays open** — no real student data.

## 18. What was actually done (2026-10-07)
Built as approved (Q27 option A; Q28 S5-D2…D6 yes; D3 id-ascending order and external-viewer-only opening; Q29 S5b/c/d not documented or built). **Strictly view only**: the app reads, validates and hands a link to the phone; it downloads, caches, persists, shares and calculates nothing. Everything is **uncommitted** on branch `migration/s5a-result-pdfs` (created from `migration/s6a-fees-summary`); you will review and approve the commit separately.

### Files (all under `D:/lms_k12_mobile_rn`)
**Modified (2 source files — additions only: +24 lines, 0 removed; S1–S6a code is untouched)**
| File | Change as built |
|---|---|
| `src/api/student.ts` | appended `fetchResultFiles()` and the `ResultFile` type |
| `src/screens/registry.ts` | + `result_pdf` |
**New (src, 3):** `screens/student/resultsModel.ts` (`resultRows`, `isBlockedResultTile`), `screens/student/ResultPdfScreen.tsx`, `hooks/useResultFiles.ts`.
**Tests (new, 4):** `resultsModel`, `studentResultsApi`, `ResultPdfScreen`, `studentResults.local` (opt-in); `registry.test.ts` extended (ten names + the S5a mapping).
No `package.json`, native, Laravel or Next.js change; no new library. `useStudentQuery`, `studentGate`, `StaleBanner`, `safeAttachmentUrl` and the UI kit were reused unchanged. The Laravel working tree still holds exactly its four earlier changes.

### Deviations from the plan (all small; none changes a decision)
1. **No separate `parseResultFiles()`**: the existing `list()` reader does the mapping, as for S3's exam schedule. The behaviour in §4 is unchanged.
2. **The Open button reads "Open PDF"** and the spoken context ("Term 1, file available") sits on the row's group label. The shared `Button` has no accessibility-label prop and I did not change shared UI to add one (§7 had planned a per-term label on the button).
3. **The screen is split in two**: `ResultPdfScreen` checks the tile first and returns the "not available" state for a `studentResultPDFAPI` tile *before* any hook runs, so no query is created for it; `ResultList` holds the hook. The recogniser is exact on the last path segment (`isBlockedResultTile`), so `studentResultPDFAPIv2` or `…/studentResultPDFAPI/other` are not blocked.
4. **The local test has three checks, not four**: request encoding is covered by the unit tests; the opt-in test covers the empty list, the bad token and the "only `/uploadResultAPI`" assertion.
5. **Open failures are caught for synchronous throws as well as rejections** (both give the same inline notice, which only the pressed row shows).
6. **`unmount()` is asynchronous in this RNTL version.** My first draft of the component test did not await it and the next test saw the old tree; fixed by awaiting (test-only; the S6a test has the same un-awaited call in its last test, where it is harmless, and was left as committed).

### Tests (Jest) — typecheck clean; full suite: **543 passed, 0 failed, 23 skipped** (the six opt-in local suites) — S5a added 67 passing tests (was 476)
| Suite | Covers |
|---|---|
| `resultsModel.test.ts` | order by id ascending (numeric, not text), non-numeric/empty ids after numeric ones in server order, ties, no mutation; validated link → `ready` and re-based onto the API host; no file (empty/blank) → `none`; **nine unsafe links** (foreign host, look-alike, credentials, `javascript:`, `file:`, `intent:`, `ftp:`, bare name, relative path) → `unsafe` with the row kept; "Term" fallback and trimming; duplicates collapse (different files for one term do not); empty input and unique keys; `isBlockedResultTile` (6 blocked spellings, 8 not blocked) |
| `studentResultsApi.test.ts` | **authenticated request**: path `uploadResultAPI`, form-encoded, Bearer, identity block and nothing else, `type=API`; student and year from the session even if a caller passes others; **only that URL is requested** (never `studentResultPDFAPI`, `all-results`, `cbse-1t5-result`, `current_result`/`current-result`, `get_wrtreportAPI`); mapping with nulls and numeric ids; **empty list and missing/null/non-list data → `[]`**; non-object rows skipped; `text/html` JSON; **401** (and the sign-out hook fires); HTTP 200 + status `2`; `Parameter Missing` → validation; 500 HTML, 419, network |
| `ResultPdfScreen.test.tsx` (24) | loading → rows in id order with the school year; the "marks are in the PDF" note; **no marks, percentages, grades or ranks rendered**; empty state; synthetic student; **no-file state** (no button); **unsafe-link state** (five bad links: message shown, no button, nothing opened); **valid-link opening** (`Linking.openURL` once, with the re-based link; only the pressed row's link); open rejection and synchronous throw → inline notice, screen stays usable; **nothing is fetched by the app itself, the only side effect is `openURL`**; **401**, server error + Try again, network, `Parameter Missing`; **stale banner** after a failed refresh (rows and Open stay); **academic-year state** (no year → "School year not set", no request); non-student guard; per-user cache; **the `studentResultPDFAPI` tile** (three spellings) shows "not available" and makes **no request** and has no button; the `uploadResultAPI` tile and a tile with no stored api both load the list |
| `registry.test.ts` | `result_pdf` → `ResultPdfScreen`; ten names |
| existing suites | all unchanged and passing |

### Acceptance criteria (§12)
| # | Criterion | Result |
|---|---|---|
| 1 | `result_pdf` opens `ResultPdfScreen`; removing the registry line restores today's behaviour | ✅ registry test; ⚠️ not seen on a device |
| 2 | one row per term from `uploadResultAPI`, Open only for acceptable links, nothing hidden, order rule holds | ✅ tests |
| 3 | every §7 state reachable and correct | ✅ tests (blocked-tile, open-failure, stale, empty, errors, guards) |
| 4 | form-encoded with the session's own ids; no request for a non-student or without a year; only `/uploadResultAPI` ever called | ✅ tests (API, screen, local) |
| 5 | no mark, percentage, grade or rank calculated or displayed | ✅ code (nothing parses the file or any number) and a render test |
| 6 | typecheck and tests pass; no native/package change | ✅ |
| 7 | local synthetic-id checks pass; real-data check **not** claimed | ✅ synthetic ids only |

### Verification against the local server (read-only, synthetic ids only — Q16)
`php artisan serve --host=127.0.0.1 --port=8000`; a JWT signed locally for a **non-existent student `999999999` on tenant `1`**. The opt-in test drives the **real client and fetch function over real HTTP**: **3/3 passed** — the non-existent student gets `[]` from `/uploadResultAPI`; a bad token is `unauthorized`; none of the six unsafe endpoint names is ever requested (the server log shows only `/uploadResultAPI`). Server stopped afterwards (port 8000 free). `uploadResultAPI` only SELECTs rows for the given ids; a non-existent student has none, so no file was read, generated, deleted or opened. The research probes of the unsafe endpoints (before the build) likewise created or removed no file.

### Known limitations
- **No real student or result data was read** (Q16): the real success rows, whether real students have files, whether the file links resolve and how files are named are verified **from code only**. The local server builds `https://<its own host>/…` links, which cannot be opened, so link handling is covered by unit and component tests, not by a live open.
- **Not run on a device or emulator**: layout at 360 dp, the hand-off to the browser/PDF viewer, returning to the app and the no-PDF-viewer notice are asserted by tests, not observed (checklist in §14).
- **Backend limits, not worked around (as you instructed):** the endpoint takes the student id from the request (no ownership check); the file URLs are public and unauthenticated; `term_name` is joined without a year condition; the row order from the server is undefined, so the id-ascending rule is the app's own (an assumption that it reads Term 1, Term 2, … — Q28/D3 approved).
- **Current school year only**: no year or term switcher, so earlier years' report cards are not reachable.
- **The one `studentResultPDFAPI` tenant** sees "Result PDFs aren't available in the app yet" instead of the validation error it saw before; it can use the web.
- S5b (WRT), S5c and S5d remain future/blocker items and are not documented further.

### Rollback
1. Delete the `result_pdf` line in `src/screens/registry.ts` (both Result tiles fall back to `GenericDataScreen`, today's behaviour), or `git revert` the S5a commit once it exists. 2. The addition to `student.ts` is additive and unused afterwards; F1 and S1–S6a are unaffected. 3. JS-only; no server or data change was made, and nothing is stored on the device.

