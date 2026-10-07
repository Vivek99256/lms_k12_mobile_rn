# S4a — Student homework: list and detail (view only)

Status: **DONE** (signed off 2026-10-07) — view-only homework implemented, tested, verified locally with synthetic ids only. Document approved 2026-10-07 (Q23). Real-data check intentionally not done (Q16 open); device check deferred to the coordinated pass. **S4b (submit/upload) is NOT approved and not started.**
Class: **V1** · Role: Student · Next in the approved build order (03 §5: S2 → S1 → S3 → **S4a** → S6 → S5 → S7 …) · Depends on: **F1** (done), **S1** (done: student gate, per-user query hook, stale banner, attachment-host check, due-date wording, date utilities, `Segmented`), S2/S3 (done: patterns only) · Decisions: D-03, D-09, D-13, D-17.
Facts cite file:line. `ev:` = [evidence/](../evidence/README.md). **[ASSUMPTION]** = not read from code. **[VERIFIED-LOCAL]** = observed on the local Laravel server on 2026-10-07 with synthetic ids only (a non-existent student `999999999` on a real tenant, or student `0`) — **no real student data was read** (Q16).
Scope: **view only**. Submitting homework (file upload) is **S4b** and needs F5 (picker libraries, not yet approved); S4a shows no submit button.

## 1. What the student will be able to do
- See their homework as a list, filtered **To do / Submitted / All**, each row with subject, title, assigned date, due date (in words, overdue marked in text) and a status label (Not submitted, Awaiting review, Reviewed, …).
- Tap a row to expand it and read the full details: instructions, teacher, class, the teacher's attachment (opened in the browser), the questions for question-bank homework, and — if they have already submitted — their own submission (status, date, remarks, files) and the teacher's remarks once published.
- Pull to refresh; load older items in pages of 30.

## 2. Existing screens and Laravel endpoints (evidence)
**The web already has this screen, and it runs on the modern token-bound API:**
| Web (D:/lms_k12) | Evidence |
|---|---|
| Student list = `StudentHomeworkSubmissionView` (a self-scoped table: subject, title, date, status badge) | `app/lms/homework/submission/page.tsx:55-62, 232-262` (`isStudentSession()` → student view); data via `listMySubmissions()` = `POST lms-homework/my-submissions` (`app/lms/homework/api.ts:1042`) |
| Student detail page (clicking a title opens `/lms/homework/{id}`) | `app/lms/homework/[id]/page.tsx` — "Assignment details" (description, teacher), reference attachment or question list, "Your submission" (attempt, status, submitted date, remarks, files, teacher remarks **only when feedback is published**, an AI score line only when AI status is "Evaluated"); data via `POST lms-homework/detail/{id}` (`api.ts:956`) |
| Student status wording | `app/lms/_shared/submission-status.ts` (`studentSubmissionStatus`): Reviewed / Not submitted / AI Evaluating / AI Evaluated / Evaluation Failed / Awaiting Review; the file's own comment says AI score, failure reason etc. "stay on the teacher-facing pages" for the *list* |
**Production menu** (read-only SELECT on `mobile_homescreen`, 2026-10-07 — ev:menu_tiles.txt line 23): `home_work` → legacy `studentHomeworkAssignmentAPI`, params `action,student_id,syear,sub_institute_id`, **34 of 34** student tenants.
**Backend (read in full 2026-10-07):**
| Use | Route | Controller | Auth class |
|---|---|---|---|
| **List (chosen)** | `POST /api/lms-homework/my-submissions` (`routes/api.php:310`, `api.session`; also in the `api_guard` protect list `lms-homework/*`, `config/api_guard.php:115`) | `HomeworkSubmissionApiController::mySubmissions` (`app/Http/Controllers/api/lms/HomeworkSubmissionApiController.php:719-780`) | **token-bound**: for a student the id comes from the verified session and the body id is ignored (`submissionStudentId`, `:72-79`) |
| **Detail (chosen)** | `POST /api/lms-homework/detail/{id}` (`routes/api.php:306`, `api.session`) | `HomeworkSubmissionApiController::detail` (`:160-241`) | token-bound **and ownership-checked**: a student whose id differs from `homework.student_id` gets 403 (`:174-179`) |
| Legacy (not used) | `POST /studentHomeworkAssignmentAPI` (`routes/student.php:234`) | `studentHomeworkController::studentHomeworkAssignmentAPI` (`app/Http/Controllers/student/studentHomeworkController.php:536-599`) | JWT signature only; ids and `action` from the request |
Flutter reference (screen→endpoint, not proof): `lib/screens/student/lists_a.dart:371-395` — a list from the **legacy** endpoint with `action: 'Homework'` showing title, subject, date, description, attachment.

## 3. Decision S4a-D1 — which API (needs your approval)
| | **Modern** (`my-submissions` + `detail/{id}`) — **recommended** | Legacy (`studentHomeworkAssignmentAPI`) — the tile's own contract |
|---|---|---|
| Used by | the **web** student screens | the old Flutter app; the 34 tenants' menu rows |
| Identity | from the token; student cannot read another's rows; detail ownership-checked | from the request body; no ownership check (IDOR) |
| Due date | ✅ `submission_date` | ❌ not returned (although the column exists) |
| Submission status, files, teacher remarks | ✅ | ❌ |
| Description / instructions | only via `detail/{id}` (one extra request per opened row) | ✅ in the list |
| Empty result | success with `data: []` **[VERIFIED-LOCAL]** | `status: 0` "No homework found" — an *error* envelope that would need special-casing **[VERIFIED-LOCAL]** |
| Needs a current academic year | **yes** — `api.session` answers 422 "Academic Term Date Expired" otherwise (same dependency as the S1 dashboard) | no |
| Also needed later | S4b (submit) uses the same API family | – |
**Recommendation:** modern API, no legacy fallback in S4a (S4a-D2). Reason: it is what the web proves, it is the only one that carries the due date and status that make a homework list useful, it is token-bound, and S4b will need it anyway. The legacy endpoint stays documented here as a **fallback to add only if** the (later, real-data) check shows the modern API failing for many tenants — adding it now would double the code paths with nothing to test it against. The dedicated screen ignores the tile's stored `api` (fixed paths, as in S1–S3).

## 4. API contracts
### 4.1 List — `POST api/lms-homework/my-submissions`
Sent with the existing non-legacy `api.post` (as the S1 dashboard): JSON body, F1 adds `type`, `sub_institute_id`, `syear`, `token` from the session; the app sends **no** student id (and the server would ignore one). **[VERIFIED-LOCAL]**: with a non-existent student on a real tenant the call returned `200 {"status_code":1,"message":"SUCCESS","data":[]}`; without a token `401 {"success":false,"message":"Authentication required","data":null,"errors":null}`.
Success row (fields from `:738-777`; the real values are **not** verified — Q16):
| Field | Meaning / quirk |
|---|---|
| `id` | homework row id (one row per student per homework) |
| `title`, `subject_id`, `subject_name` | `subject_name` is `null` when the subject master is missing |
| `date`, `submission_date` | the model has **no** date cast for these (`studentHomeworkModel.php:68-79`), so they are the column values `YYYY-MM-DD` (columns are `date`: `…create_homework_table.php:26,31`) or `null`; the app also reads ISO and `DD-MM-YYYY` through `toDateKey` |
| `date_fmt`, `submission_date_fmt` | `DD-MM-YYYY` strings or `null` (the app reads the raw fields and falls back to these) |
| `reference_file_url` | `''` or the teacher's attachment, **built from the request's own scheme+host** (`:736`, `:756`) — so it points at the API host; no `SERVER_NAME` problem as in the legacy endpoints |
| `source_type` | `attachment` (default), `question_bank` or `exam_paper` |
| `status` | `null` = **not submitted**; otherwise the submission status (`Pending` is used when the old flow marked completion without a status; also `Submitted`, `Under Review`, `Reviewed`, `Rejected` per the web's `statusVariant`) (`:743`, `:760`) |
| `submission_files[]` | `{id, file_path, file_url, original_name, mime_type, file_size}`; empty unless submitted |
| `submission_remarks`, `teacher_remarks` | text or `null` |
| `ai_status` | `''`/`null`, `Checking`, `Evaluated`, `OCR Failed`, `Evaluation Failed`, `Failed` (ev: submission-status.ts) |
| `ai_score`, `ai_total_questions`, `ai_percentage`, `ai_failure_reason`, `reviewed_pdf_path`, `evaluated_at` | teacher-side detail; **not shown in the list** |
| `feedback_published` | boolean: the teacher has released feedback to the student |
Server behaviour: **no `type` field and no type filter** (the list is every `homework` row of the student), unpaged, `ORDER BY id DESC`, one extra subject query per row (`:740`), ordered by `id DESC` (`:733`). Both writers of `homework` rows store `type = "Homework"` (`studentHomeworkController.php:239`, `StudentHomeworkApiController.php:257`), so in practice the list equals the tile's "Homework" set **[ASSUMPTION: no other writer]**. The select is `*`, so a database without the 2026-09-11 submission columns still answers (attributes are `null`) — consistent with the successful call above.
### 4.2 Detail — `POST api/lms-homework/detail/{id}`
`{id}` is a **numeric id taken from a list row** (validated `^\d+$` before it is put in the path); body = F1's session fields only. Success `{status_code:1, message, data:{homework:{…}, submissions:[…]}}` (`:206-239`):
- `homework`: `id, title, description, subject_name, standard_name, division_name, date, submission_date, teacher_name, reference_file_url, sourceType, questions[{id, question_title, description, question_type_id, points}]` — `questions` is filled only for `question_bank`/`exam_paper` homework (`:190-203`); question text can contain **HTML**.
- `submissions`: `[]` or **one** entry (`:126-153`): `status, submission_remarks, teacher_remarks, ai_status, ai_score, ai_total_questions, ai_percentage, ai_marks, teacher_marks, max_marks, submitted_at(_fmt), feedback_published, files[]`, plus teacher-side fields the app does not read (`ai_failure_reason`, `evaluation_mode`, `reviewed_pdf_path`, `evaluated_at`).
Failures **[VERIFIED-LOCAL]**: unknown or non-numeric id → `404 {"status_code":0,"message":"Homework not found"}`; code also gives `403 "You are not allowed to view this homework."` for another student's row (`:176-178`) and the usual `api.session` 401/422. F1 maps 404 → a `server` error carrying the server's message, 403 → `forbidden`, 422 → `validation`, 401 → `unauthorized` (sign-out).

## 5. Dependencies on F1 / S1 / S2 / S3
| Reused | From | Used for |
|---|---|---|
| non-legacy `api.post`, session fields, text-first parsing, status mapping, 401 sign-out | F1 | both calls (same pattern as `fetchStudentDashboard`) |
| `useStudentQuery`, `studentGate`, `StaleBanner` | S1 | student/year guards, loading, error + retry, stale banner, per-user cache key |
| `Segmented` | S1 | To do / Submitted / All |
| `toDateKey`, `shortDate`, `displayDate`, `localDateKey`; `dueLabel`, `isOverdue` (`dashboardModel.ts`) | S1 | dates and due wording ("Overdue · 5 Oct 2026") |
| `safeAttachmentUrl`, `LinkedText` | S1 | reference/submitted file links; links inside the instructions |
| `Card`, `Page`, `Button`, `EmptyState`, theme | existing | layout |
No dependency on S2/S3 code. **Not** used: F5 (no uploads), the legacy endpoint.

## 6. Student identity and security
- List and detail are **token-bound**: the app sends no student id; the server pins the student from the JWT (`:72-79`) and rejects another student's detail with 403 (`:174-179`). The only id sent is the homework id from a list row, validated as digits.
- In-screen guards as S1–S3: not a student → "Students only" and **no request**; no school year → "School year not set" and **no request**.
- Query keys carry the user id and year; the cache is cleared on sign-out; detail keys also carry the homework id; nothing is written to disk.
- **All server text is plain `<Text>`**: instructions, remarks, titles, file names. **HTML in question text is stripped to plain text** (tag removal + basic entities) — never rendered as markup, no WebView. Links in the instructions use S1's `LinkedText` (http/https only).
- **File links** (teacher attachment, submitted files) open only after `safeAttachmentUrl()` — an ERP host is re-based onto the configured API host; anything else (foreign host, credentials, non-http scheme, bare names) shows no button. No token is attached; these are public storage URLs.
- Teacher remarks are shown **only when `feedback_published` is true**; AI/teacher marks and failure reasons are not shown (the web's list keeps them teacher-side; its detail shows only an "AI score" line when evaluated — see S4a-D6).
- Backend weaknesses recorded, not fixable here: the list is unpaged; the modern endpoints depend on a current academic year; the legacy endpoint (not used) has no ownership check.

## 7. Navigation and tile integration
```
Menu / Home tile ─► Tile route ─► TileScreen (existing RBAC guard) ─► screenRegistry["home_work"] ─► HomeworkScreen
                                                   list (filter: To do | Submitted | All)
                                                     └─ tap a row ─► expands in place ─► fetches detail/{id}
Home dashboard "View all pending homework" (S1) ─► the same tile (already wired via useOpenScreen)
```
- One new registry entry; removing it restores today's fallback (`GenericDataScreen`).
- **No new route or screen type** (S4a-D3): details expand inside the card, like the circulars. This keeps the existing navigation untouched.
- The detail request is made by a child component that exists only while a row is expanded, so collapsed rows cost nothing.

## 8. UX decisions (to confirm)
- **S4a-D1** modern API for list and detail (§3). **S4a-D2** no legacy fallback in S4a.
- **S4a-D3** details expand in place (no new route).
- **S4a-D4** filter chips **To do / Submitted / All**, default **To do**. *To do* = not submitted, sorted by **due date** (soonest first; items without a due date last); *Submitted* and *All* = newest assigned first. "To do" empty → "All caught up — no homework to do." with a hint to choose All.
- **S4a-D5** status label follows the web helper: `Reviewed` (status Reviewed) · `Rejected` (status Rejected) · `Not submitted` (status `null` and no files) · `AI evaluating` / `AI evaluated` / `Evaluation failed` (from `ai_status`) · otherwise `Awaiting review`. Always text (plus a coloured pill), never colour alone.
- **S4a-D6** in the detail, mirror the web student view: show remarks and files; teacher remarks **only when feedback is published**; an "AI score: x / y (z%)" line **only when `ai_status` is Evaluated** (the web detail does this; the web list does not). *Alternative:* hide the AI score from students entirely — say if you prefer that.
- **S4a-D7** question text: HTML stripped to plain text; the question's points shown if present.
- **S4a-D8** the list shows 30 rows and a "Show more" button (the server returns everything).
- Row layout: subject (small, above), title (bold, max 2 lines collapsed), "Assigned 5 Oct 2026 · Due 12 Oct 2026" (or "Overdue · 5 Oct 2026" in the danger colour **and** words), status pill. Touch target ≥ 44 dp for the whole row.

## 9. Loading, error, empty and stale states
| State | UI |
|---|---|
| list loading, no data | existing `Loading` |
| list error, no data | `ErrorState` + Try again (F1 messages; 422 shows "Academic Term Date Expired" as the server says) |
| list error while cached | content stays + banner "Couldn't refresh — showing the last loaded data." |
| no homework at all | `EmptyState` "No homework yet" |
| "To do" has nothing | `EmptyState` "All caught up — no homework to do." (filter stays usable) |
| "Submitted" has nothing | "Nothing submitted yet." |
| detail loading | inline "Loading details…" inside the card |
| detail error | inline message + Try again (404 "Homework not found", 403 message, network, 500…); the list stays usable |
| `school year` missing / not a student | "School year not set" / "Students only"; no request |
| refreshing | pull-to-refresh refreshes the list and any open detail |
Accessibility: each collapsed row is one button with a combined label ("Fractions, Maths, due 12 Oct 2026, Not submitted") and `expanded` state; targets ≥ 44 dp; no information only in colour.

## 10. Backend limitations
1. Unpaged list, newest id first, with a subject query per row (cost grows with history). 2. Modern endpoints need a current academic year (422 otherwise). 3. No `type` field, so the list cannot be limited to "Homework" client-side (assumed identical, §4.1). 4. The description is not in the list (one request per opened row). 5. `status === null` means not submitted, `Pending` means "completed by the old flow"; semantics inferred from code (`:743`, `:760`). 6. Question text may contain HTML; maths or formatting is lost when stripped. 7. File links are built from the request host (good) but the files themselves live under `/storage/student/…` and `submission_files[].file_path` (existence not verifiable here). 8. The real `date` string format, `status` values in use and file URLs are **verified from code only** (Q16). 9. Submitting is not part of S4a; until S4b the student submits on the website.
Nothing is blocked.

## 11. Exact files expected to change (all under `D:/lms_k12_mobile_rn`)
**Modified (2 — additions only)**
| File | Change |
|---|---|
| `src/api/student.ts` | **append** `fetchHomeworkList()`, `fetchHomeworkDetail(id)`, types and tolerant parsers |
| `src/screens/registry.ts` | + `home_work` |
**New**
`src/screens/student/homeworkModel.ts` (pure: status label, filter, sort, due ordering, paging window, id validation) · `src/screens/student/HomeworkScreen.tsx` · `src/screens/student/HomeworkDetail.tsx` (child component that loads the detail) · `src/hooks/useHomeworkList.ts`, `src/hooks/useHomeworkDetail.ts` · `src/components/StatusPill.tsx` (label + tone, reusable by later modules) · `src/utils/text.ts` (`stripHtml`).
Tests: `__tests__/homeworkModel.test.ts`, `text.test.ts`, `studentHomeworkApi.test.ts`, `HomeworkScreen.test.tsx`, `HomeworkDetail.test.tsx`, `StatusPill.test.tsx`, `studentHomework.local.test.ts` (opt-in), and additions to `registry.test.ts` (eight names).
No `package.json`, native, Laravel or Next.js change; no new library; S1/S2/S3 behaviour unchanged (`useStudentQuery` is reused as is).

## 12. Tests and acceptance criteria
**Unit:** `homeworkModel` — status label for every combination (null status, `Pending`, `Submitted`, `Under Review`, `Reviewed`, `Rejected`, files without status, each AI status, unknown AI value), filters, ordering (To do by due date with undated last; Submitted/All newest first), overdue vs due today vs future, undated, paging windows, id validation (`12` ok; `abc`, `1/2`, `12;`, empty rejected); `stripHtml` (tags, entities, line breaks, nested, script content removed, plain text unchanged, empty/`null`).
**API:** list and detail — path, JSON body from the session (no student id, no legacy fields), mapping with nulls, files array, tolerant parsing, empty list, `status_code:0` bodies, 401, 403, 404 ("Homework not found"), 422 ("Academic Term Date Expired"), 419, HTTP 500/HTML.
**Component:** `HomeworkScreen` — loading, success, filters and their empty states, default "To do", sorting, show-more, error + retry, stale banner, guards (no request), per-user cache; `HomeworkDetail` — expands and fetches only then, instructions, teacher/class, attachment button only for accepted hosts, questions with HTML stripped, submission section, teacher remarks **only** when feedback is published, AI line **only** when evaluated, 404/403/network errors with retry, links in the instructions http(s)-only; `StatusPill` — label and accessibility; `registry` — eight names.
**Regression:** all 315 existing tests pass; typecheck clean.
**Acceptance:**
1. The `home_work` tile opens `HomeworkScreen` (not the generic dump); removing the registry line restores the old behaviour.
2. The list shows subject, title, assigned and due dates (in words, overdue in text) and a status label; the filters work; the default is To do; a row expands to its details loaded from `detail/{id}`.
3. Teacher remarks appear only when feedback is published; the AI line only when evaluated; HTML never renders as markup; file links only for accepted hosts.
4. Every state in §9 is reachable and correct; no crash on `null` fields, empty lists, unreadable dates, unknown statuses, an HTML 500 or a 404/403 on detail.
5. No request for a non-student or without a school year; the app never sends a student id; the only id sent is a validated homework id.
6. `npm run typecheck` and `npm test` pass; no native/package change.
7. Local synthetic-id checks pass (§13); the real-data check is **not** claimed (Q16); device checks are deferred to the coordinated pass.

## 13. Local-server verification plan (synthetic ids only — Q16)
Same setup as S1–S3 (`php artisan serve --host=127.0.0.1 --port=8000`, JWT signed locally with the app's own secret). The list and detail need a token that `api.session` accepts, i.e. a **non-existent student id on a real tenant** (e.g. `999999999` on tenant `1`), exactly as the S1 dashboard check; an opt-in, loopback-only test `studentHomework.local.test.ts` drives the real client and fetch functions over real HTTP:
| Check | Expected |
|---|---|
| `fetchHomeworkList()` for the non-existent student | success, empty list (already seen with curl) |
| `fetchHomeworkDetail(1)` / a large id | `server` error 404 carrying "Homework not found" (already seen with curl) |
| bad token on both | `unauthorized` |
| `fetchHomeworkDetail('abc')` | rejected by the app **before** any request (no fetch) |
| tenant that does not exist | `validation` "Academic Term Date Expired" (as in S1) |
Already done for this document (curl, 2026-10-07): the list, a missing detail and a bad id behave as above; the legacy endpoint answers "No homework found" (`status 0`) for student 0 and "Parameter Missing" without `action`.
**Cannot be verified without real data (Q16):** real row shapes and date strings, real `status`/`ai_status` values, submission files, teacher remarks, question HTML, real attachment URLs, how many rows a real student has.

## 14. Device / coordinated-pass additions
For the later coordinated pass (you will approve the native build): in addition to the S1–S3 list, check the homework list (filter chips, 44 dp rows, expand/collapse, long instructions wrapping), the detail loading/error inline states, the attachment hand-off to the browser, and pull-to-refresh with an open row.

## 15. Rollback
Delete the `home_work` line in `src/screens/registry.ts` (the tile falls back to `GenericDataScreen`, today's behaviour) or `git revert` the S4a commit; the additions to `student.ts` are additive and unused afterwards; S1–S3 and F1 are unaffected. JS-only; no server or data change.

## 16. Questions (answered 2026-10-07: Q23 yes; D1/D2 modern API with no legacy fallback; D6 show the AI score when evaluated; Q16 still open)
- **Q23** Approve this document and S4a-D1…D8 — in particular **D1/D2 (modern API, no legacy fallback)** and **D6 (AI score line shown like the web, or hidden)**.
- **Q16 stays open** — no real student data; the real-data check for S1–S4a waits for your explicit confirmation of the database environment.

## 17. What was actually done (2026-10-07)
Built as approved (Q23: S4a-D1…D8 yes; D2 — **no legacy fallback**, the legacy endpoint stays unused; D6 — AI score line shown when evaluated, hidden otherwise). **View only**: no submit button, no upload, nothing from S4b. Everything is **uncommitted** in the working tree; you will review and approve the commit separately.

### Files (all under `D:/lms_k12_mobile_rn`)
**Modified (2 source files — additions only: +155 lines, 0 removed; S1/S2/S3 code is untouched)**
| File | Change as built |
|---|---|
| `src/api/student.ts` | appended `fetchHomeworkList()`, `fetchHomeworkDetail(id)`, `parseHomeworkList()`, `parseHomeworkDetail()`, `isHomeworkId()` and their types (+ one `ApiError` import) |
| `src/screens/registry.ts` | + `home_work` |
**New (src, 7):** `utils/text.ts` (`stripHtml`); `components/StatusPill.tsx`; `hooks/useHomeworkList.ts`, `useHomeworkDetail.ts`; `screens/student/homeworkModel.ts`, `HomeworkScreen.tsx`, `HomeworkDetail.tsx`.
**Tests:** new `text`, `homeworkModel`, `studentHomeworkApi`, `HomeworkScreen`, `HomeworkDetail`, `StatusPill`, `studentHomework.local` (opt-in); `registry.test.ts` extended (eight registered names + the teacher's homework tile is not claimed).
No `package.json`, native, Laravel or Next.js change; no new library. `useStudentQuery`, `studentGate`, `StaleBanner`, `Segmented`, `LinkedText`, `safeAttachmentUrl`, `dueLabel`/`isOverdue` and the date utilities were reused unchanged.
**The legacy `studentHomeworkAssignmentAPI` is not referenced anywhere in the app code**; a local test asserts the list call goes only to `/api/lms-homework/my-submissions`.

### Deviations from the plan (all small; none changes a decision)
1. **Id validation lives in the API layer** (`isHomeworkId` in `student.ts`), not in the model as §11 said, so the guard sits next to the URL it protects; the detail component also uses it to refuse an id before any request.
2. **One row open at a time** (opening another closes the first). §7 said "expands in place" without saying how many.
3. **Counts in the filter chips** ("To do (4)", "Submitted (2)", "All (6)") — an addition; the chips' spoken labels carry them too.
4. **Disabled-query case:** if the detail query is not enabled (a non-student session) the component renders nothing instead of an error; the list never mounts it for a non-student anyway.
5. The F1 non-legacy client puts `type`, `sub_institute_id` and `syear` in the URL query as well as the body (existing behaviour since F1); the API tests compare the path only.
6. A submitted file whose link fails the host check still shows its **name** (just no Open button), so the student can see what was submitted.
7. The "Questions" block shows "1 mark / N marks" next to a question when points are present.

### Tests (Jest) — full suite: 40 suites, **427 tests: 411 passed, 0 failed, 16 skipped** (the four opt-in local suites); `npm run typecheck` clean. Before S4a: 315 passing (S4a added 96).
| Suite | Tests | Covers |
|---|---|---|
| `text.test.ts` | 8 | `stripHtml`: plain text unchanged, non-strings, tags, block tags → line breaks and bullets, script/style removed with content (also unclosed, upper-case), entities decoded **after** stripping so an encoded tag stays visible text, unknown/control entities untouched, whitespace collapse, long and adversarial input stays fast |
| `homeworkModel.test.ts` | 19 | defaults (To do, 30); `isSubmitted`; **every status wording** (not submitted, Reviewed, Rejected, AI evaluating/evaluated/failed incl. spaced/odd case, Awaiting review, files-without-status); **filters** and counts; **due-date sorting** (overdue first, undated and unreadable last, DD-MM-YYYY, ties by assigned date then id); newest-first for Submitted/All, non-mutation, non-numeric ids; due wording, overdue only while to do, row label |
| `studentHomeworkApi.test.ts` | 13 | list is token-bound JSON with **no student id and no legacy fields**, never the legacy URL; row mapping with `_fmt` fallbacks, nulls, empty-string status; list rows carry no remarks/scores/URLs; empty and malformed data; **401, 422, 419, 500, HTML**; `isHomeworkId` (digits only; `../1`, `1/2`, `%2e%2e`, `12;` … refused); detail path and body; **invalid id refused with no request**; detail mapping incl. single submission; `feedback_published` coercion; tolerant parsing; **404 "Homework not found"**, 403, 401, 422 |
| `HomeworkScreen.test.tsx` | 26 | **default To do**, order by due date; **Submitted / All filters** and order; overdue in words and only for to-do; status words; **empty states** (no homework, To do empty, Submitted empty); **30-row batches** (35 rows → 30 + "Show more (5 more)", no button at 30, filter change resets); **expand/collapse** (no detail request until opened, loads only that id, loading inline, collapse, one open at a time, inline 404 with retry, non-digit id makes no request); **loading, error + retry, 422 message, 401 as an error state, stale banner**; guards (no request); per-user cache; untitled row |
| `HomeworkDetail.test.tsx` | 27 | content (teacher, class, instructions, not-submitted note); **http(s)-only links** in instructions, credential/`file:`/`intent:` text inert; **question HTML → plain text** (tags, entities, `<br>`, script content removed, encoded script stays text, description fallback, marks wording); **attachment link validation** (ERP host re-based onto the API host and opened; API host kept; foreign, look-alike, credentials, bare name, empty, `javascript:`, `file:` → no button); submission block (status, date, own note, files with Open only for acceptable links, empty status shown as submitted); **teacher remarks only when feedback is published** (and non-empty); **AI score line only when evaluated** (case-insensitive, shown before publication as on the web, partial scores, hidden for none/Checking/failed/other, "AI is checking…" without a score, hidden when not submitted); **404 with retry**, 403, 401, loading, stale notice, invalid id makes no request, non-student renders nothing, per-user per-id cache |
| `StatusPill.test.tsx` | 2 | word and spoken label; distinct tint per tone |
| `registry.test.ts` | +1 | `home_work` → `HomeworkScreen`; eight names; teacher tile not claimed |
| existing suites | unchanged | all 315 earlier tests pass unchanged (F1, S1, S2, S3) |

### Acceptance criteria (§12)
| # | Criterion | Result |
|---|---|---|
| 1 | `home_work` opens `HomeworkScreen`; removing the registry line restores the old behaviour | ✅ registry test; ⚠️ not seen on a device |
| 2 | list with subject, title, assigned/due dates in words, status; filters work; default To do; a row expands to details from `detail/{id}` | ✅ tests |
| 3 | teacher remarks only when published; AI line only when evaluated; HTML never as markup; file links only for accepted hosts | ✅ tests |
| 4 | every state in §9 reachable and correct; no crash on null fields, empty lists, unreadable dates, unknown statuses, HTML 500, 404/403 on detail | ✅ tests |
| 5 | no request for a non-student or without a school year; no student id sent; only a validated homework id | ✅ tests (list, detail, API) |
| 6 | typecheck and tests pass; no native/package change | ✅ (and `npx expo export --platform android` still bundles: 1063 modules, no unresolved modules) |
| 7 | local synthetic-id checks pass; real-data check **not** claimed; device checks deferred | ✅ synthetic ids only |

### Verification against the local server (read-only, synthetic ids only — Q16)
`php artisan serve --host=127.0.0.1 --port=8000`; JWTs signed locally with the app's secret for a **non-existent student `999999999` on tenant `1`** (and on a non-existent tenant for the year-expired case). The opt-in test drives the **real client and fetch functions over real HTTP**; run together with the S1–S3 opt-in tests, **16/16 passed**:
| Check | Result |
|---|---|
| `fetchHomeworkList()` | success, empty list ✅ |
| `fetchHomeworkDetail('1')` and a huge id | `server` error, **HTTP 404 "Homework not found"** ✅ |
| bad token on list and detail | `unauthorized` ✅ |
| `fetchHomeworkDetail('abc')` / `'1/2'` | refused by the app, **fetch never called** ✅ |
| tenant without a current academic year | `validation` "Academic Term Date Expired" ✅ |
| the list call's URL | only `/api/lms-homework/my-submissions`; the legacy URL is never requested ✅ |
| opt-in test with `https://erp.triz.co.in` as base | refuses to run ✅ |
Server stopped afterwards (port 8000 free). The database was touched only by SELECTs for non-existent students/tenants.

### Known limitations
- **No real student data was read** (Q16): real row shapes, the `date`/`submission_date` strings, the `status` and `ai_status` values in use, submission files, teacher remarks, question HTML and real attachment URLs are verified **from code only**. Ownership enforcement on `detail` (403 for another student's homework) is also code-read, not observed.
- **Not run on a device or emulator**: layout, 44 dp targets, the expand/collapse feel and the browser hand-off are asserted by tests, not observed. The S4a items are in §14 for the coordinated pass.
- **View only**: a student still submits on the website until S4b (needs the F5 picker libraries, not approved).
- **Server behaviour shown honestly, not fixed:** unpaged list with a subject query per row; modern endpoints need a current academic year (422 otherwise); the description needs one detail request per opened row; `type` is not returned, so "Homework" is assumed to be everything in the list (both writers store `Homework`).
- **`stripHtml` is a deliberately simple text extractor**, not an HTML parser: formatting, links' targets and maths markup are lost, and a tag whose attribute contains a `>` leaves a fragment of text behind (rare). It never produces markup.
- Teacher remarks and the AI score follow the web's rules; marks, failure reasons and the reviewed PDF are not shown.
- Jest's `fetch` is a stub, so unit tests mock `text()`; only the opt-in tests make real HTTP calls.

### Rollback
1. Delete the `home_work` line in `src/screens/registry.ts` (the tile falls back to `GenericDataScreen`, today's behaviour), or `git revert` the S4a commit once it exists. 2. The additions to `student.ts` are additive and unused afterwards; F1, S1, S2 and S3 are unaffected. 3. JS-only; once EAS Update is configured, `eas update:rollback` also works. No server or data change was made.

