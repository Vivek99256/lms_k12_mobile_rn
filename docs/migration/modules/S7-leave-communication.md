# S7 — Leave and communication (student)

Status: **S7c, S7a, S7b DONE** (signed off 2026-10-07) — view-only subject teachers, leave applications and messages implemented, tested, verified locally with synthetic ids only. Document approved 2026-10-07 (Q30 option A; Q31 S7-D2…D8 yes; Q32 S7d/S7e future scope). Real-data check intentionally not done (Q16 open); device check deferred to the coordinated pass. **All three screens are view only; no write endpoint is contacted. S7d and S7e are not implemented.**
Class: **V1** · Role: Student · Next in the approved build order (03 §5: … S5 → **S7 (lists)** → S9 …) · Depends on: **F1** (done — form-encoded legacy requests, `type=API`, the `status_code` envelope), **S1** (done — student gate, per-user query hook, stale banner, `safeAttachmentUrl`), S3/S5 (done — the "open a file with `Linking`" pattern), S4a (done — `StatusPill`, 30-row batches). S2/S6a are patterns only · Decisions: D-03, D-09, D-13, D-14, D-17.
Facts cite file:line. `ev:` = [evidence/](../evidence/README.md). **[ASSUMPTION]** = not read from code. **[VERIFIED-LOCAL]** = observed on the local Laravel server on 2026-10-07 using only a **non-existent student (`999999999`, tenant `1`)** — **no real student data was read** (Q16). **[VERIFIED-NO-DB]** = checked by reading code. **No write endpoint was called, even with missing parameters** (a mistake would insert a row into a database that may be production).

## 0. Scope map — view-only versus anything that writes
The three student tiles in this area bundle *reading* and *writing*. This document keeps them apart. **Only the three view-only sub-modules are proposed.** The two write features are identified so nothing is dropped silently; neither is proposed, and each needs its own document and your separate approval.
| Part | What | Kind | Tiles (of 34 student tenants) | Proposed for this build? |
|---|---|---|---|---|
| **S7a** | **My leave applications**: the student's own requests, with status, dates, reason and the staff reply | **view only** | `leave_application` (30) | **Yes** |
| **S7b** | **My messages to school**: the student's own parent-communication messages and the staff replies | **view only** | `parent_communication` (30) | **Yes** |
| **S7c** | **Subject teachers**: the teachers and subjects of the student's class | **view only** | `subjects` (34) | **Yes** |
| S7d | **Apply for leave** (text and optional attachment) | **WRITE** — inserts a row, may store an uploaded file | same `leave_application` tile | **No** — needs your separate approval (and the F5 file-picker libraries for the attachment) |
| S7e | **Send a message to school** | **WRITE** — inserts a row | same `parent_communication` tile | **No** — needs your separate approval |
| – | Teacher/admin side: approve leave, reply to messages, admin lists | staff, **WRITE** | `t_approve_leave`, `t_parent_comm` | **Out of S7** (teacher modules; not student) |
S7a/b/c **never** call a create, send, reply, approve or upload endpoint, and have **no** compose form, **no** submit button and **no** file picker. They send only the signed-in student's identity block (F1 pins it).

## 1. What the student will be able to do
- **Leave:** see each leave request they made — the reason (title), the dates, a status (Approved / Rejected / Pending), their own note, when they applied, the attachment link, and the staff reply with who replied and when. Newest first.
- **Messages:** see each message they sent to the school and the reply (or "Awaiting reply"). Newest first.
- **Subject teachers:** see each teacher of their class and the subjects they teach.
- Pull to refresh on all three. Each screen says plainly what it does not do yet: *"Applying for leave isn't available in the app yet."*, *"Sending a message isn't available in the app yet."*

**V1 gap to be aware of:** the web has **no student screen** for either feature, so until S7d/S7e exist a student cannot apply or write from the app at all (they can only do so in the old Flutter app, if their school still uses it). The text above is honest about it. Closing the gap is S7d/S7e (§0, §16).

## 2. Existing screens and Laravel endpoints (evidence)
| Source | Finding |
|---|---|
| **Web (D:/lms_k12)** | **No student-facing screen.** `app/students/leave/page.tsx` only redirects to `/front_desk/leave_application`; `app/front_desk/leave_application/page.tsx` and `app/front_desk/parent_communication/page.tsx` are 7-line wrappers around `ModuleWorkbench` with `reportModules.leave` / `reportModules.parentCommunication` (`app/front_desk/_lib/reports.ts:4-48`): **staff report screens** ("Review student leave requests…", "Review parent messages and the replies recorded by school staff"), GET `front_desk/{leave_application,parent_communication}/create` with a date filter. Searched `app`, `lib`, `components` for `leave_application`, `parent_communication`, `add_communication`, `studentLeaveApplicationAPI`: no student path. The modern `api/leave/*` routes (`routes/api.php:923-967`) are **employee leave management** (HR), not student leave. So S7 is **mobile-only**, on the legacy mobile contract. |
| **Production menu** (read-only SELECT on `mobile_homescreen`, 2026-10-07; ev:menu_tiles.txt) | `Leave Application` → `screen_name=leave_application` → `https://erp.triz.co.in/studentLeaveApplicationAPI`, params `syear,sub_institute_id,type,student_id,message,apply_date,fr…` — **30** tenants (line 51). `Parent Communication` → `screen_name=parent_communication` → **`add_communicationAPI` — the WRITE endpoint**, params `sub_institute_id,syear,type,student_id,title,message` — **30** (line 52). `Subject Teachers` → `subjects` → `studentTeacherListAPI` — **34** (line 27). Staff: `t_approve_leave` (`teacherLeaveApplicationListAPI`, 12 + 33 + 1), `t_parent_comm` (23 + 32 + 3 + 1 + 1). |
| **Flutter** (reference only) | `leave.dart:74-152`: list `POST studentLeaveApplicationAPI`; apply `POST front_desk/leave_application/add_leave_application` with `message, apply_date, from_date, to_date, title`, file field `attechment`. `communication.dart:43-76`: list `POST studentParentcommunicationListAPI`; send `POST add_communicationAPI` (`title`, `message`); a reply of the string `"null"` is ignored. `lists_a.dart:354`: subject teachers (`teacher_name`, `subject_name`, `image`) (ev:flutter_ref.md lines 93, 107, 108; its docs say its endpoints were never run live). |
| **Current RN app** | the three tiles fall back to `GenericDataScreen`, which posts **JSON** with `api_param` pasted in as one malformed key (`parseApiParam`, `helpers.ts:10-21`) and **no student id**. For the Parent Communication tile that means **every open and every pull-to-refresh POSTs to the write endpoint** `add_communicationAPI`; it does not insert anything only because `student_id`, `title` and `message` are missing (the server answers "Parameter Missing", `parentCommunicationController.php:332`). The dedicated screen removes that accidental call. |
**Backend (read in full 2026-10-07, read-only):**
| Endpoint | Route | Method | Auth / identity |
|---|---|---|---|
| `POST studentLeaveApplicationAPI` **(read)** | `routes/student.php:186` | `leaveApplicationController::studentLeaveApplicationAPI` `:400-441` | JWT checked **only when `type == "API"`** (`:402-414`); `student_id`, `sub_institute_id`, `syear` from the **request** (`:416-418`); no ownership check |
| `POST studentParentcommunicationListAPI` **(read)** | `routes/student.php:243` | `parentCommunicationController::studentParentcommunicationListAPI` `:507-550` | JWT checked **only when `type == 'API'`** (`:510-523`); identity from the request; no ownership check |
| `POST studentTeacherListAPI` **(read)** | `routes/student.php:180` | `studentAttendanceController::studentTeacherListAPI` `:697-` | JWT **always** checked (`:699-706`); identity from the request; no ownership check |
| `POST front_desk/leave_application/add_leave_application` **(WRITE)** | `routes/student.php:224` | `leaveApplicationController::add_leave` `:291-352` | JWT always; inserts `leave_applications`; may store an upload |
| `POST add_communicationAPI` **(WRITE)** | `routes/student.php:235` | `parentCommunicationController::add_communicationAPI` `:295-336` | JWT always; inserts `parent_communication` |
| `POST teacherLeaveApplicationListAPI` / `SaveAPI` (staff) | `routes/student.php:192-193` | `leaveApplicationController` `:444-`, `:510-` | staff approve/reject leave (writes `status`, `reply`) |
| `POST teacherParentcommunicationListAPI` / `SaveAPI` (staff) | `routes/student.php:241-242` | `parentCommunicationController` | staff reply (writes) |
| `get_adminLeaveApplicationListAPI`, `add_adminLeaveApplicationSaveAPI`, `get_adminParentCommunicationListAPI`, `add_adminParentCommunicationSaveAPI` (admin) | `routes/adminapi.php:41-47` | `adminapiController` | admin list/reply |
| `front_desk/leave_application` and `front_desk/parent_communication` **resources** (`create`, `store`, `update`, `destroy`, …) | `routes/student.php:205-207` (group `api.session, session, menu, logRoute`) | the same controllers | staff web screens; `create` with `type=API` takes **tenant and year from the request** and lists **every student's** messages (`parentCommunicationController.php:53-100`) |
**No modern, student-token-bound API exists** for any of these (searched `routes/api.php`, `routes/*api*.php`, `routes/frontdesk.php` for leave/communication: only the employee-leave and staff routes above).

## 3. Which API (S7-D2): legacy, read endpoints only — and which endpoints must NOT be called
| Endpoint | Verdict | Why |
|---|---|---|
| **`studentLeaveApplicationAPI`** | **Use for S7a** | the production tile's own contract; read-only; parameterised query-builder SQL (`leaveApplicationController.php:420-431`); the app always sends `type=API` and the Bearer token, so the JWT check runs (**[VERIFIED-LOCAL]** 401 without a token when `type=API`). Backend privacy defect recorded in §10. |
| **`studentParentcommunicationListAPI`** | **Use for S7b** | the list endpoint the Flutter app uses; read-only; query-builder SQL (`:530-541`); explicit `ORDER BY date_ DESC`. **Not** the tile's stored `api` (`add_communicationAPI` is a write). |
| **`studentTeacherListAPI`** | **Use for S7c** | the production tile's own contract; JWT always required; read-only (`:697-`). |
| `front_desk/leave_application/add_leave_application` | **Never in S7a/b/c** (S7d) | WRITE; inserts a row, may store a file with no size or type limits (`:320-328`). |
| `add_communicationAPI` | **Never in S7a/b/c** (S7e) | WRITE; inserts a row (`:318-328`). It is also the Parent Communication tile's stored `api`, so the dedicated screen **ignores the tile's stored URL**. |
| `teacherLeaveApplicationListAPI`/`SaveAPI`, `teacherParentcommunicationListAPI`/`SaveAPI`, `get_admin…`/`add_admin…` | **Never** | staff endpoints; the save ones modify leave status and replies. |
| `front_desk/leave_application`, `front_desk/parent_communication` (resource routes, incl. `create`) | **Never** | staff web screens; `create` lists every student's messages in the tenant (`parentCommunicationController.php:53-100`); `store/update/destroy` write. Whether a student token is refused depends on `check_permissions` menu rows — **not established** (probing it would read other students' data, Q16). |
| `api/leave/*`, `hrms/myleave` | **Never** | employee/HR leave, unrelated to a student. |
A test asserts that S7a/b/c touch only the three read URLs (§12).

## 4. API contracts (all sent through F1's `legacy.post`: form-encoded, identity block from the session, Bearer header, `type=API`; **no extra fields**)
**S7a — `POST studentLeaveApplicationAPI`.** Required non-empty: `student_id`, `sub_institute_id`, `syear` (else `{"status":0,"message":"Parameter Missing"}`, `:420`/`:437`). Success (from code `:420-435`, **not observed with data — Q16**): `{"status":1,"message":"Success","data":[{"title","message","files","apply_date","from_date","to_date","status","reply","reply_by","reply_on"}]}` where `files` is `''` or an absolute `https://<server host>/storage/leave_application/<file>`, `apply_date` and `reply_on` are `d-m-Y H:i:s`, `from_date`/`to_date` are `Y-m-d`, `status` is the free-text column (`NULL`/empty while pending; the staff API accepts only `Approved` or `Rejected`, `:524`), `reply_by` is the replying user's name (empty when none). There is **no row id and no ORDER BY**, so the order is undefined.
**S7b — `POST studentParentcommunicationListAPI`.** Required: the same three. Success (code `:530-545`): `{"status_code":1,"message":"Success","data":[{"title","message","created_at","reply","reply_on","reply_by"}]}` — **`status_code`, not `status`**; `created_at` is the raw timestamp `Y-m-d H:i:s`, `reply_on` is `d-m-Y`, ordered by `date_` descending. Missing parameters → `{"status_code":0,"message":"Parameter Missing"}`.
**S7c — `POST studentTeacherListAPI`.** Required: the same three. The student's class and division come from `tblstudent_enrollment` for that year; no enrollment → `{"status":0,"message":"Wrong Parameters"}` (`:748`). Success (code `:709-746`): `{"status":1,"message":"Success","data":[{"teacher_name","image","mobile","subject_name"}]}`; `subject_name` is a **comma-joined** list, ordered by teacher name.
**Observed [VERIFIED-LOCAL], synthetic student, real tenant, year 2026:**
| Call | Response | F1 result |
|---|---|---|
| leave list, `type=API` + token | `200 text/html {"status":1,"message":"Success","data":[]}` | success, empty |
| leave list, `type=API`, **no token** | `401 {"status":"2","message":"JWT token is required.","data":[]}` | `unauthorized` |
| leave list, **no `type`, no token** | `200 {"status":1,"message":"Success","data":[]}` — **served without authentication** | n/a (the app always sends `type=API`) |
| leave list, JSON body; missing `syear` | success (the controller reads `$request->input`); `{"status":0,"message":"Parameter Missing"}` | validation |
| message list, `type=API` + token | `200 {"status_code":1,"message":"Success","data":[]}` | success, empty |
| message list, no token (+`type=API`) / no token and no `type` | `401 {"status":"2",…}` / **`200` served without authentication** | `unauthorized` / n/a |
| message list, missing `student_id` | `200 {"status_code":0,"message":"Parameter Missing"}` | validation |
| subject teachers, token | `200 {"status":0,"message":"Wrong Parameters"}` (no enrollment) | validation "Wrong Parameters" → **empty** (below) |
| subject teachers, no token | `401 {"status":"2",…}` | `unauthorized` |
**Parsing (planned):** a list under `data` (non-list → empty); each row field read as plain text (nulls → `''`); for S7b a reply equal to `null` (any case) counts as no reply (Flutter does the same); S7c: `Wrong Parameters` (and only that message) is an **empty list** ("no class for this year"), other validation messages are errors. No field is parsed into a number.

## 5. Student identity, session and academic year
- Token and ids come only from the session via F1; no id is read from route params, props or text input. In-screen guards as S1–S6a: not a student → "Students only" and **no request**; no school year → "School year not set" and **no request**.
- The query key carries the user id and year; the cache is cleared on sign-out; nothing is written to disk; message text is never logged.
- **Academic year:** each request carries `user.syear` (the login's `mobile_syear`); the server filters leave and messages by `syear` and resolves the class from the enrolment of that year. These are legacy bare paths (no `api.session`), so there is **no "Academic Term Date Expired" state**. There is no year switcher, so earlier years' leave and messages are not reachable (S7a/b show "School year {syear}").
- **Backend weakness (not fixable here):** all three endpoints take `student_id` from the request with no ownership check, and two of them skip authentication without `type=API` (§10). The app only ever sends its own id and always sends `type=API`.

## 6. Data presentation
**S7a (leave):** card per request, newest first by `apply_date` (parsed via `toDateKey`; rows with an unreadable date go last, ties keep the server order). Card: reason (title; "Leave request" if empty); date range via `displayDate` ("12 Oct 2026 – 14 Oct 2026", one date when equal, raw text when unreadable, nothing invented); status pill: `Approved` (success), `Rejected` (danger), empty/null → `Pending` (warning), any other text shown as-is (neutral); the student's note as plain text (no links, no HTML); "Applied {date}"; the attachment as **Open attachment** (§8) when its link passes `safeAttachmentUrl`, else "Attachment can't be opened from the app" (row never hidden), nothing when there is no file; the reply block ("Reply from {name} · {date}: {text}") only when the reply text is non-empty. 30 rows at a time with "Show more (N more)" (S4a pattern).
**S7b (messages):** card per message in the server's order (already newest first): title ("Message" if empty), the message as plain text, "Sent {date}" (from `created_at`; raw text if unreadable), then either the reply block (reply text, "{reply_by} · {reply_on}") or "Awaiting reply". 30 at a time.
**S7c (teachers):** card per teacher in the server's order (by name): the name ("Teacher" if empty) and the subjects as separate lines split on `,` (trimmed, empty pieces dropped; none → no subject line). **The teacher's mobile number and the image URL are not shown or used** (S7-D6): the mobile number is personal data the student does not need on this screen (and the Flutter screen did not use it), and server-built image URLs are ignored as in S1.
**No calculation:** nothing is counted, summed or derived beyond sorting and the Pending default.

## 7. UX and states
| State | UI |
|---|---|
| loading, no data | existing `Loading` |
| error, no data | `ErrorState` + Try again (F1 messages: network, 401 session expired, 5xx) |
| `Parameter Missing` (validation) | the server message, with Try again |
| empty — leave | `EmptyState` "No leave requests for school year {syear}" — "Applying for leave isn't available in the app yet." |
| empty — messages | `EmptyState` "No messages for school year {syear}" — "Sending a message isn't available in the app yet." |
| empty — teachers (also `Wrong Parameters`) | `EmptyState` "No subject teachers to show yet" — "Your class timetable has not been set up for school year {syear}." |
| error while cached | content stays + banner "Couldn't refresh — showing the last loaded data." |
| attachment cannot be opened (`Linking.openURL` fails) | inline notice under the card: "Couldn't open the file. Please try again or contact your school." |
| `syear` missing / not a student | "School year not set" / "Students only"; no request |
| refreshing | pull-to-refresh |
A short footer on the leave and message screens (when not empty) repeats the "isn't available in the app yet" sentence so the limit is visible without an empty list. **Stale data:** 5-minute stale time, as S1–S6a. **Accessibility:** each card is one group with a spoken sentence ("Sick leave, 12 to 14 October, Approved. Reply from Mrs Shah."); status is words, never colour alone; Open attachment is a ≥ 44 dp button.

## 8. Security and privacy
- **Sensitive content.** A leave reason or a message to school can carry health or family information. It is shown only to the signed-in student, kept in memory only (TanStack cache keyed by user, cleared on sign-out), never logged, never persisted, never put in a route param or URL.
- **Attachments leave the app.** The student's own leave attachment (possibly a medical note) is a **public, unauthenticated** `/storage/leave_application/<file>` URL built by the server. S7a opens it only through `Linking.openURL` after `safeAttachmentUrl` (S1; host allow-list, re-base onto the configured API host, credentials/`file:`/`javascript:`/`intent:` refused), exactly as S5 does for result PDFs: no in-app viewer, **no download, cache, persistence or sharing**. The public URL itself is a backend limit the app cannot change.
- **Plain text only:** titles, notes, replies, names are rendered as `<Text>`; no HTML, no link detection.
- **No write path exists in S7a/b/c:** no compose field, submit, picker, retry-of-a-write. The only side effect of the screens is `Linking.openURL` for an attachment.
- **Never called, by design:** the endpoints in §3 marked Never. A local and a unit test assert the three read URLs are the only ones requested.
- **Identity:** session-only (F1); students cannot choose another `student_id`; in-screen guards; per-user cache.
- **Phone numbers:** the subject teacher's `mobile` field is dropped at parse time and never rendered or dialled.

## 9. Dependencies
| Reused | From | Used for |
|---|---|---|
| `legacy.post` (form-encoded identity block, `type=API`, text-first parsing, `status`/`status_code`/`status:'2'`/401/419/500 mapping) | F1 | the requests |
| `useStudentQuery`, `studentGate`, `StaleBanner` | S1 | guards, loading, error + retry, stale banner, per-user cache |
| `safeAttachmentUrl` and the `Linking.openURL(...)` pattern | S1, S3, S5 | opening the leave attachment |
| `StatusPill`, 30-row "Show more" pattern, `toDateKey`/`displayDate` | S4a, S1 | status, batches, dates |
| `Card`, `Button`, `Page`, `EmptyState`, theme tokens | existing kit | layout |
No dependency on S2/S6a code. Not used: F5 (pickers), S4b, any write code (none exists).

## 10. Backend limitations and known defects (for the owners; not to be fixed in this migration)
1. **Unauthenticated reads.** `studentLeaveApplicationAPI` (`leaveApplicationController.php:402`) and `studentParentcommunicationListAPI` (`parentCommunicationController.php:510`) check the JWT **only when `type == "API"`**; **[VERIFIED-LOCAL]** without a token and without `type` both answered normally. Anyone who can guess a student id and tenant can read that student's leave reasons, notes, replies and messages (a privacy defect, especially for health-related reasons).
2. **No ownership check** on any of the three read endpoints (student id from the request).
3. **Public, unauthenticated attachment URLs** (`/storage/leave_application/<file>`); the leave upload has no size or type validation (`add_leave :320-328`).
4. **No row id and no ORDER BY** in the leave list (`:420-431`), so ordering and de-duplication cannot rely on the server; the app sorts by `apply_date`.
5. **Mixed envelopes:** leave and teachers use `status`; messages use `status_code`; validation failures are HTTP 200 (`Parameter Missing`, `Wrong Parameters`).
6. **`status` is free text** (`NULL` until staff reply; staff API accepts only `Approved`/`Rejected`, `:524`).
7. **The Parent Communication tile points at the write endpoint** (`add_communicationAPI`), so any client that calls a tile's stored `api` as a read will hit a write endpoint.
8. `studentTeacherListAPI` returns teachers' mobile numbers and a server-built image URL.
9. **Writes can't be safely verified here** (relevant to S7d/S7e): both write endpoints insert into the connected database, which may be production (Q16). A write sub-module would need a confirmed non-production database, or tests with mocked transport only.
**Backend asks:** require the JWT unconditionally on the two list endpoints; derive the student from the token for student tokens; serve attachments through an authenticated route; add a row id and `ORDER BY` to the leave list; point the Parent Communication tile at a read endpoint (or add a `list` action).
**Consequence for the plan:** S7a/b/c are not known to be affected by any defect that makes them fail; what cannot be known without real data (Q16): real row shapes, real `status` values, whether attachments resolve, and the real volume per student.

## 11. Exact files expected to change (all under `D:/lms_k12_mobile_rn`)
**Modified (2 — additions only):** `src/api/student.ts` (append `fetchLeaveApplications()`, `fetchParentMessages()`, `fetchSubjectTeachers()`, row types, `NO_CLASS_MESSAGE`), `src/screens/registry.ts` (+ `leave_application`, `parent_communication`, `subjects`).
**New (src):** `screens/student/leaveModel.ts`, `communicationModel.ts`, `subjectTeachersModel.ts`; `screens/student/LeaveApplicationsScreen.tsx`, `ParentCommunicationScreen.tsx`, `SubjectTeachersScreen.tsx`; `hooks/useLeaveApplications.ts`, `useParentMessages.ts`, `useSubjectTeachers.ts`.
**Tests:** `leaveModel`, `communicationModel`, `subjectTeachersModel`, `studentLeaveApi` (all three fetchers), `LeaveApplicationsScreen`, `ParentCommunicationScreen`, `SubjectTeachersScreen`, `studentLeaveComm.local` (opt-in), plus `registry.test.ts` (thirteen names).
No `package.json`, native, Laravel or Next.js change; no new library; S1–S5a behaviour unchanged.
**Build order (one sub-module at a time):** S7c subject teachers → S7a leave → S7b messages, each tested before the next.

## 12. Tests and acceptance criteria
**Models:** leave — newest-first by `apply_date` (both date formats, with time part, unreadable last, ties keep order), date-range text (equal dates, reversed, unreadable), status mapping (`Approved`, `Rejected`, empty/null → Pending, unknown text neutral, case/whitespace), reply block only for non-empty reply, attachment state (none / ready / unsafe, nine unsafe links), 30-row batches; messages — reply `null`/`NULL`/blank = awaiting, date text, order kept; teachers — subjects split/trim/empty, name fallback, the mobile and image fields absent from the parsed row.
**API:** each path, **form-encoded** with the identity block and nothing else, Bearer, `type=API`, student id from the session even if a caller passes another; success mapping with nulls; non-list data → empty; **`status_code` envelope** for messages; `Parameter Missing` → validation; `Wrong Parameters` → empty list (S7c) while other validation messages stay errors; 401 and HTTP 200 `status:'2'` → unauthorized; 419; 500 HTML; network; **only the three read URLs are ever requested — never `add_leave_application`, `add_communicationAPI`, `teacher…`, `admin…`, `front_desk/…`, `api/leave`**; one request per fetch.
**Components (per screen):** loading; rows; empty state (+ "isn't available yet" sentence); errors + Try again; stale banner; guards (no request for a non-student or without a year); per-user cache; leave: status pills, reply block, attachment open (valid link opens once, unsafe link has no button and a message, open failure → inline notice); **no text input, submit button or file picker on any screen** (no `textbox`/`button` role other than Try again, Show more, Open attachment); `registry` — thirteen names; the Parent Communication tile **does not** request `add_communicationAPI` even though its stored `api` is that URL.
**Regression:** all 543 existing tests pass; typecheck clean.
**Acceptance:**
1. The three tiles open their dedicated screens; removing a registry line restores today's behaviour for that tile.
2. Rows show exactly the fields in §6; nothing is hidden; the order rules hold.
3. Every §7 state is reachable and correct.
4. Requests are form-encoded with the session's own ids and `type=API`; no request for a non-student or without a school year; only the three read URLs are ever called.
5. No create, send, reply, approve or upload code or control exists.
6. `npm run typecheck` and `npm test` pass; no native/package change.
7. Local synthetic-id checks pass (§13); the real-data check is **not** claimed.

## 13. Local-server verification plan (synthetic ids only — Q16)
Same setup as S1–S5a: `php artisan serve --host=127.0.0.1 --port=8000`, JWT signed locally for a **non-existent student `999999999` on tenant `1`**. An opt-in, loopback-only test `studentLeaveComm.local.test.ts` drives the real client and fetchers over real HTTP:
| Check | Expected |
|---|---|
| `fetchLeaveApplications()` / `fetchParentMessages()` | `[]` / `[]` |
| `fetchSubjectTeachers()` for a student with no enrolment | `[]` (the server's "Wrong Parameters") |
| bad token on each | `unauthorized` |
| URLs requested | only the three read paths (spy on fetch); **no write endpoint is ever contacted** |
Already done for this document (curl, 2026-10-07, synthetic student, **read endpoints only; no write endpoint was called**): the results in §4. **Cannot be verified without real data (Q16):** real rows, statuses, attachments, teacher lists, volumes. **Not verified, deliberately:** anything that writes (S7d/S7e) — see §10.9.

## 14. Device / coordinated-pass additions
For the later pass: the three lists at 360 dp (long reasons and replies wrap, status pills), "Show more", opening a real attachment in the browser/viewer and returning, behaviour with no viewer installed, pull-to-refresh, and the error/empty states.

## 15. Rollback
Delete the three lines in `src/screens/registry.ts` (the tiles fall back to `GenericDataScreen`, today's behaviour — including, for Parent Communication, its accidental POST to the write endpoint) or `git revert` the S7 commit; the additions to `student.ts` are additive and unused afterwards; F1 and S1–S5a/S6a are unaffected. JS-only; no server or data change; nothing is written anywhere.

## 16. Decisions and questions (answered 2026-10-07: Q30 option A — build S7c, S7a, S7b; Q31 yes; Q32 S7d/S7e not documented further or built; Q16 still open)
- **Q30 / S7-D1 — scope.** **Option A (recommended):** build S7c, S7a and S7b as view-only screens (in that order). **Option B:** build only S7a and S7b (leave and messages), skipping subject teachers for now. **Option C:** do not build S7 now; record it as backend-blocked and move to S9. Under A or B the V1 gap in §1 remains until S7d/S7e.
- **Q31** Confirm S7-D2…D8:
  - **D2** legacy read endpoints only (§3) — `studentLeaveApplicationAPI`, `studentParentcommunicationListAPI`, `studentTeacherListAPI` — with the dedicated screens **ignoring the tiles' stored `api`** (so the Parent Communication tile stops posting to a write endpoint);
  - **D3** leave order newest first by `apply_date`; status mapping with **empty = Pending**; replies shown only when non-empty (and a reply of `null` is no reply);
  - **D4** attachments open only in the phone's browser/viewer after F1 link validation — no in-app viewer, download, cache or share (as S5);
  - **D5** 30-row "Show more" batches, current school year only, no filters;
  - **D6** the teacher's **mobile number and image are not shown or used**;
  - **D7** the honest "isn't available in the app yet" sentences for leave application and sending a message;
  - **D8** never call any endpoint listed Never in §3 (all write, staff, admin and HR routes).
- **Q32** S7d (apply for leave) and S7e (send a message) are **not proposed**. Both are writes; say if you want either documented next. They need your separate approval, a confirmed non-production database (or mocked-transport-only tests, §10.9), and — for the leave attachment — the F5 picker libraries. A text-only S7e needs no new library.
- **Q16 stays open** — no real student data.

## 17. What was actually done (2026-10-07)
Built as approved (Q30 option A in the order S7c → S7a → S7b; Q31 S7-D2…D8 yes; Q32 S7d/S7e not documented further or built). **Strictly view only**: no form, text field, submit button or file picker exists on any of the three screens, and no write, staff, admin, `front_desk` or HR endpoint is ever contacted. Everything is **uncommitted** on branch `migration/s7-leave-communication` (created from `migration/s5a-result-pdfs`); you will review and approve the commit separately.

### Files (all under `D:/lms_k12_mobile_rn`)
**Modified (2 source files — additions only: +92 lines, 0 removed; S1–S6a code is untouched)**
| File | Change as built |
|---|---|
| `src/api/student.ts` | appended `fetchSubjectTeachers()`, `fetchLeaveApplications()`, `fetchParentMessages()`, their row types and `NO_CLASS_MESSAGE` |
| `src/screens/registry.ts` | + `subjects`, `leave_application`, `parent_communication` |
**New (src, 10):** `screens/student/listHelpers.ts` (`LIST_PAGE_SIZE`, `cleanText`), `subjectTeachersModel.ts`, `leaveModel.ts`, `communicationModel.ts`; `SubjectTeachersScreen.tsx`, `LeaveApplicationsScreen.tsx`, `ParentCommunicationScreen.tsx`; `hooks/useSubjectTeachers.ts`, `useLeaveApplications.ts`, `useParentMessages.ts`.
**Tests (new, 7):** `leaveModel`, `studentListModels` (messages, teachers, helpers), `studentLeaveCommApi`, `SubjectTeachersScreen`, `LeaveApplicationsScreen`, `ParentCommunicationScreen`, `studentLeaveComm.local` (opt-in); `registry.test.ts` extended (thirteen names + the S7 mapping).
No `package.json`, native, Laravel or Next.js change; no new library. `useStudentQuery`, `studentGate`, `StaleBanner`, `StatusPill`, `safeAttachmentUrl`, the date utilities and the UI kit were reused unchanged. The Laravel working tree still holds exactly its four earlier changes.

### Deviations from the plan (all small; none changes a decision)
1. **A small shared file `listHelpers.ts`** (the 30-row page size and `cleanText`, which turns the literal text `null` into nothing) instead of repeating them in each model.
2. **No separate `parse…` functions**: the fetchers map rows with the existing `list()` reader (as S3/S5a). The behaviour in §4 is unchanged.
3. **Wording of the write-unavailable sentences** follows Q31/D7 exactly: "Apply for leave — This isn't available in the app yet." and "Send a message — This isn't available in the app yet." (the plan had "Applying for leave isn't available…"). They appear in the empty state and as a footer under the list.
4. **The message and teacher model tests share one file** (`studentListModels.test.ts`) with the helper tests, rather than three files.
5. **One extra guard test** in `ParentCommunicationScreen.test.tsx` runs the real client and fetcher and asserts that only `studentParentcommunicationListAPI` is requested although the tile's stored `api` is `add_communicationAPI`.
6. **`unmount()` is awaited in tests** (it is asynchronous in this RNTL version; see S5a §18).

### Tests (Jest) — typecheck clean; full suite: **638 passed, 0 failed, 29 skipped** (the seven opt-in local suites) — S7 added 95 passing tests (was 543)
| Suite | Covers |
|---|---|
| `leaveModel.test.ts` | **status** (empty/blank/`null` → Pending warning; Approved/Rejected/Pending in any case; any other text shown as sent, neutral — no status invented); apply-time sort key (`d-m-Y H:i:s`, ISO, unreadable); date range (two dates, one when equal, one readable, raw text, none, reversed); **ordering** (newest first by date and time, unreadable last, ties keep the server order, no mutation, no row dropped, unique keys); title fallback, plain-text note and dates; **staff reply visible only with text** (blank and `null` are no reply, `null` name is no name); **attachment** none / ready (re-based) / nine unsafe links with the row kept |
| `studentListModels.test.ts` | `cleanText` and the 30-row size; messages keep the server order, sent date and raw-text fallback, title fallback, reply `null`/blank = awaiting; teachers: server order, subjects split/trim/de-duplicate, name fallback, **the parsed row carries no mobile number or image** |
| `studentLeaveCommApi.test.ts` | for **each of the three fetchers**: **authenticated** (Bearer + token), form-encoded identity block and nothing else, `type=API`, session identity even if a caller passes another student, **no write, staff, admin, `front_desk` or HR URL requested**, non-list data → empty, non-object rows skipped, **401 / HTTP 200 status `2`** → unauthorized (sign-out hook fires), 500 HTML, 419, network, `text/html` JSON; teachers: **mobile and image dropped**, `Wrong Parameters` → empty while other validation messages stay errors; leave: field mapping with nulls; messages: **`status_code` envelope** (`1` success, `0` Parameter Missing → validation, `"2"` → unauthorized) and never `add_communicationAPI` |
| `SubjectTeachersScreen.test.tsx` (9) | loading → rows with subject lines in server order; **no button, link, phone number or image**; name fallback; empty state; 401; server error + Try again; stale banner; guards; per-user cache |
| `LeaveApplicationsScreen.test.tsx` (17) | newest first with dates, status, note, applied date; **empty status = Pending** and Approved/Rejected/other shown as written; **staff reply** with who and when, absent when blank or `null`; 30-row "Show more"; **view only** (no button/link role, unavailable-write wording); **attachment**: valid link opens once re-based onto the API host, four unsafe links have no button and a clear message, no file → nothing, open failure → inline notice, the app fetches nothing itself; empty state with the wording; 401; server error + Try again; `Parameter Missing`; stale banner; guards; per-user cache |
| `ParentCommunicationScreen.test.tsx` (12) | server order with sent date and reply/"Awaiting reply" (spoken labels); `null`/blank reply = awaiting; 30-row batches; **view only** (no button, link, input or placeholder; unavailable-write wording); empty state; 401; server error + Try again; `Parameter Missing` from the `status_code` envelope; stale banner; guards; per-user cache; **the write endpoint is never contacted** (real client, tile stores `add_communicationAPI`) |
| `registry.test.ts` | the three S7 mappings; thirteen names |
| existing suites | all unchanged and passing |

### Acceptance criteria (§12)
| # | Criterion | Result |
|---|---|---|
| 1 | the three tiles open their dedicated screens; removing a registry line restores today's behaviour for that tile | ✅ registry test; ⚠️ not seen on a device |
| 2 | rows show exactly the §6 fields, nothing hidden, ordering rules hold | ✅ tests |
| 3 | every §7 state reachable and correct | ✅ tests |
| 4 | form-encoded with the session's own ids and `type=API`; no request for a non-student or without a year; only the three read URLs | ✅ tests (API, screens, local) |
| 5 | no create, send, reply, approve or upload code or control | ✅ code and tests (no input/button/link role beyond Try again, Show more, Open attachment) |
| 6 | typecheck and tests pass; no native/package change | ✅ |
| 7 | local synthetic-id checks pass; real-data check **not** claimed | ✅ synthetic ids only |

### Verification against the local server (read-only, synthetic ids only — Q16)
`php artisan serve --host=127.0.0.1 --port=8000`; a JWT signed locally for a **non-existent student `999999999` on tenant `1`**. The opt-in test drives the **real client and fetchers over real HTTP**: **6/6 passed** — leave list `[]`; message list `[]` (`status_code` envelope); subject teachers `[]` (the server's "Wrong Parameters" for a student with no enrolment); a bad token is `unauthorized` on each; only the three read paths are requested; every request carries the Bearer token and `type=API`. The server log after the run shows exactly `/studentLeaveApplicationAPI`, `/studentParentcommunicationListAPI` and `/studentTeacherListAPI` and nothing else. Server stopped afterwards (port 8000 free). No write endpoint was contacted, even with missing parameters, and no real student, leave, message or attachment data was read.

### Known limitations
- **No real data was read** (Q16): real row shapes, real `status` values, attachment links, volumes and teacher lists are verified **from code only**. The local server builds `https://<its own host>/…` attachment links, so link handling is covered by unit/component tests, not by a live open.
- **Not run on a device or emulator**: layout at 360 dp, status pills, "Show more", the hand-off of an attachment to the browser/viewer and the no-viewer notice are asserted by tests, not observed (checklist in §14).
- **Backend defects, not worked around and not fixed** (as you instructed): the leave and message list endpoints skip the JWT check unless `type=API` is sent (the app always sends it, so the check always runs; it is never weakened); no ownership check on any of the three; public attachment URLs; the leave list has no id or ORDER BY (the app sorts by apply date); the Parent Communication tile stores a write endpoint (the dedicated screen ignores it). Teachers' mobile numbers and image URLs arrive in the response and are discarded when it is read.
- **V1 gap (by decision):** a student cannot apply for leave or send a message from the app until S7d/S7e (future scope, separate approval, safe non-production verification; S7d also needs the F5 picker libraries). The screens say so.
- **Current school year only**: no year switcher.

### Rollback
1. Delete the three lines in `src/screens/registry.ts` (the tiles fall back to `GenericDataScreen`, today's behaviour — including, for Parent Communication, its accidental POST to the write endpoint), or `git revert` the S7 commit once it exists. 2. The additions to `student.ts` are additive and unused afterwards; F1 and S1–S5a/S6a are unaffected. 3. JS-only; no server or data change was made, and nothing is stored on the device.

