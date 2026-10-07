# S3 — Student timetable and exam schedule

Status: **DONE** (signed off 2026-10-07) — implemented, tested, verified locally with synthetic ids only. Document approved 2026-10-07 (Q21, Q22 option c). Real-data check intentionally not done (Q16 open); device check deferred to the coordinated S1–S3(+) pass.
Class: **V1** · Role: Student · Depends on: **F1** ([F1](F1-legacy-transport.md), done), **S1/S2** (done — reuses the student gate, the per-user query hook, the date utilities, the attachment-host check and the screen/test patterns) · Decisions: D-03, D-09, D-13, D-17.
Facts cite file:line. `ev:` = [evidence/](../evidence/README.md). **[ASSUMPTION]** = not read from code. **[VERIFIED-LOCAL]** = observed on the local Laravel server on 2026-10-07 with synthetic ids only (student `0`) — **no real student data was read** (Q16).

## 1. What the student will be able to do
| Part | Menu tile (`screen_name`, tenants of 34) | The student can… |
|---|---|---|
| **S3a Timetable** | `time_table` (31) | pick a weekday from a Monday–Saturday strip (opens on today), see that day's periods in time order — period name, start–end time, subject, teacher; pull to refresh |
| **S3b Exam schedule** | `exam_schedule` (17) | see upcoming exams first (soonest first) and earlier ones below, each with title, date and weekday, and open the schedule file when there is one |
Read-only. No uploads, no new library, no native change (OTA-deliverable).

## 2. Existing web / mobile screens and Laravel endpoints
**Web:** nothing student-facing. Searched `D:/lms_k12` (`app`, `lib`, `components`) for `studentTimetableAPI` and `studentExamScheduleAPI` — **no match**. The web only has **staff** screens: `app/front_desk/classwisetimetable/page.tsx` ("View classwise timetable … read-only", staff picks a class), `app/front_desk/facultywisetimetable/page.tsx`, and `app/front_desk/exam_schedule/page.tsx` (a generic `ModuleWorkbench` configured in `app/front_desk/_lib/modules.ts:127-141`: publish a schedule per class with `date_`, `title` and a file field `attechment`, endpoint `front_desk/exam_schedule`). These define what the data means (the schedule is published *per class and division*), but are not reused as UI. **S3 is mobile-only, on the legacy mobile contract.**
**Production menu** (read-only SELECT on `mobile_homescreen`, 2026-10-07 — ev:menu_tiles.txt lines 13 and 50): `time_table` → `studentTimetableAPI`, params `student_id,syear,sub_institute_id,type`, **31** tenants; `exam_schedule` → `studentExamScheduleAPI`, same params, **17** tenants.
**Backend (read in full 2026-10-07):**
| Part | Route | Controller | Auth class |
|---|---|---|---|
| S3a | `POST /studentTimetableAPI` (`routes/web.php:476`) | `classwisetimetableController::studentTimetableAPI` (`app/Http/Controllers/school_setup/classwisetimetableController.php:284-377`) | JWT signature only; ids from the request |
| S3b | `POST /studentExamScheduleAPI` (`routes/student.php:182`) | `exam_scheduleController::studentExamScheduleAPI` (`app/Http/Controllers/front_desk/exam_schedule/exam_scheduleController.php:183-218`) | JWT signature only; ids from the request |
Flutter references (screen→endpoint and layout only, not proof): `lib/screens/student/tabbed.dart:195-300` (Mon–Sun strip, today selected first, period cards) and `lib/screens/student/lists_a.dart:296-314` (exam schedule list). Both screens exist in the old app, so the feature is established; the field names below come from the **backend code**, not from Flutter.

## 3. Timetable — request / response contract
**Request** `POST {base}/studentTimetableAPI`, through F1's `legacy.post` (form-encoded, identity block, Bearer):
| Field | Source | Rule (`:300-307`) |
|---|---|---|
| `student_id`, `sub_institute_id`, `syear` | session | all non-empty (`:304`), else HTTP 200 `{"status":0,"message":"Parameter Missing"}` **[VERIFIED-LOCAL]** |
| `type` | F1 sends `API` | `type=="JSON"` would make the response a real JSON response (`:372-375`); with `API` it is `json_encode` served as `text/html` **[VERIFIED-LOCAL]** — F1 parses both |
The app sends nothing else. A JSON body also works for this endpoint (it uses `$request->input`) **[VERIFIED-LOCAL]**, but F1's form encoding is used for consistency.
**Response** (success `{"status":1,"message":"Success","data":[…]}` — empty `data: []` for a non-existent student **[VERIFIED-LOCAL]**; the SQL ran without error, so it is valid under the local database's `sql_mode`). Row fields from the select (`:349-358`):
| Field | Meaning / quirk |
|---|---|
| `week_day` | `Mon`,`Tue`,`Wed`,`Thu`,`Fri`,`Sat` — a `CASE` over the stored codes `M T W H F S`; **any other stored code (e.g. Sunday) yields `null`** (`:349-356`) |
| `standard_name` | the class name (same for every row) |
| `subject_name` | **`GROUP_CONCAT`** of subject names for that weekday+period (comma-joined when several) |
| `teacher_name` | `GROUP_CONCAT` of teacher full names (same grouping) |
| `period_name` | `period.title`; `null` when the row has no period (LEFT JOIN) |
| `start_time`, `end_time` | `period.start_time/end_time`, a `TIME` column → `HH:MM:SS` (`database/migrations/2023_03_05_115658_create_period_table.php:22-23`); `null` without a period |
| `studentbatch`, `batch_id`, `batch_name`, `period_id` | batch bookkeeping and the period id; `batch_id`/`batch_name` come from one arbitrary row of a group |
Ordering and grouping: `GROUP BY period_id, week_day`, `ORDER BY week_day, period_id` (`:362-363`) — and because `week_day` is also the select alias, MySQL sorts it **alphabetically by the label** (Fri, Mon, Sat, Thu, Tue, Wed), not Monday-first (ev:student_tiles_backend.md row `time_table`). **The client must re-sort** by weekday and by start time.
Server filters worth knowing: the timetable rows are those of the student's **current enrollment class and division for `syear`** (`:359-361`); an INNER JOIN on `tbluser … status = 1` drops periods whose teacher is inactive (`:343`), and INNER JOINs on `subject` and `standard` drop periods with missing masters (`:335-342`). A period can therefore be missing without any sign; the app cannot detect it.
**Batch / elective periods (backend limitation):** the original per-student batch filter (`batch_id IS NULL OR batch_id = studentbatch`) is **commented out** (`:305-327`), so a period that has several batches comes back as **one row whose `subject_name` lists the subjects of all batches**. The app shows the text as the server sends it and does **not** split it on commas (a subject name may contain one). Whether a given student attends only one of those subjects cannot be derived from the response. Recorded as a backend ask (03 §7); not blocking.

## 4. Exam schedule — request / response contract
**Request** `POST {base}/studentExamScheduleAPI` through `legacy.post`; `student_id`, `sub_institute_id`, `syear` required (else "Parameter Missing" **[VERIFIED-LOCAL]**); nothing else is read (`type` is read but unused; check at `:202`, select at `:207-208`, `orderby date_ desc` at `:212`).
**Response:** `{"status":1,"message":"Success","data":[{"title","date_","file_name"}]}` — empty list for a non-existent student **[VERIFIED-LOCAL]**; fields from the select:
| Field | Meaning / quirk |
|---|---|
| `title` | free text (`string 250`, `…create_exam_schedule_table.php:21`) |
| `date_` | a `date` column (`:25`) → `YYYY-MM-DD`; the live database may differ from the migrations (project memory), so the app accepts ISO and `DD-MM-YYYY` through `toDateKey` |
| `file_name` | `''` when no file, otherwise an **absolute URL the server builds from its own host name**: `https://<SERVER_NAME>/storage/exam_schedule/<file>` |
Server order: `date_` **descending**. The rows have **no id**, and a student with two enrollment rows for the year would see each schedule twice (the join is on enrollment). The schedule is per class+division+year (`s.standard_id = e.standard_id AND s.section_id = e.division_id AND s.syear = e.syear`), filtered by `syear` and school.
**Attachment caveat (backend):** a schedule published from the **web** is stored under `public/exam_schedule/` (`exam_scheduleController.php:89`), which matches the read URL `/storage/exam_schedule/`, so those links should resolve. A schedule uploaded through the **teacher mobile flow** may not: ev:teacher_tiles_backend.md (row `t_exam_schedule`) records a field-name mismatch (the file is never stored) and, when a file is sent, a storage-disk vs `/storage/exam_schedule/` read-path mismatch. So a returned link **may not resolve** for those rows. The app cannot tell them apart; it shows the button when the URL is acceptable, and a dead link simply fails in the browser. Verify with real data later.

## 5. Student identity and security
- Identity only from the session via F1 (`student_id`, `sub_institute_id`, `syear`); a student cannot send another `student_id` (F1 §4.2). No id is read from route params, props or input; both screens take no parameters from the user.
- In-screen guards (same as S1): not a student → "Students only" and **no request**; no school year → "School year not set" and **no request**.
- Query cache keyed by user and year, cleared on sign-out (`useStudentQuery`; `App.tsx:26-27`); nothing persisted to disk.
- Server text (titles, subjects, teacher names) is rendered as plain `<Text>`; no links are made tappable in S3.
- Attachments: opened only after `safeAttachmentUrl()` (S1, built on F1's `resolveUrl`) accepts the host — an ERP host is re-based onto the configured API host (a dev build never opens production files), any other host or scheme is refused; no token is attached to the link.
- Backend weakness (not fixable here): neither controller compares `student_id` with the token, so any valid token can read any student's timetable and exam schedule (ev:student_tiles_backend.md caveat 1). The app only ever sends its own id.

## 6. Dependencies on F1 (and S1/S2)
| Reused | From | Used for |
|---|---|---|
| `legacy.post`, identity block, form encoding, text-first parsing, 401/419/422/500 mapping, host allow-list | F1 | both requests |
| `useStudentQuery`, `studentGate`, `StaleBanner` | S1 | guards, loading, error with retry, stale-data banner, per-user cache key |
| `toDateKey`, `localDateKey`, `longDate`, `shortDate`, `displayDate` | S1 `utils/dates.ts` | exam dates, upcoming/earlier split |
| `safeAttachmentUrl` | S1 `circularModel.ts` | exam schedule file link (imported as is; no refactor of S1) |
| `Card`, `Page`, `EmptyState`, `Button`, theme tokens | existing kit | layout |
No other module is needed. No dependency on the Home dashboard.

## 7. Navigation and tile integration
```
Menu / Home tile ─► Tile route ─► TileScreen (existing RBAC guard) ─► screenRegistry[screen_name]
      time_table    → TimetableScreen
      exam_schedule → ExamScheduleScreen
```
- Two new registry entries (`registry.ts`, same mechanism as S1/S2). Removing an entry restores today's fallback (`GenericDataScreen`).
- Both screens call **fixed paths**, not `tile.api` (as S1/S2), so a changed or empty DB value cannot break them. The tile title comes from the navigation header.
- No new route, tab or deep link. Teachers' `t_timetable` / `t_exam_schedule` are different tiles (T-series) and are **not** claimed.

## 8. UI, and loading / empty / error states
**S3a TimetableScreen** (top→bottom): "School year {syear}" caption; a **day strip** (new small `DayStrip` component: `Mon … Sat` chips, each ≥ 44 dp, selected state, a dot on days that have periods, "Today" noted in the accessibility label; an extra "Other" chip appears only if the server sent rows with no weekday); that day's period cards in start-time order — a time block ("9:00 AM – 9:45 AM"), the period name, subject (bold) and teacher. Opens on today's weekday; **Sunday opens on Monday** (the server never returns Sunday).
**S3b ExamScheduleScreen:** two groups — **Upcoming** (today and later, soonest first) and **Earlier** (most recent first); each card: title, "Tue, 12 Oct 2026", and an "Open schedule" button when the link passes the host check.
| State | UI |
|---|---|
| loading, no data | existing `Loading` |
| error, no data | `ErrorState` + Try again (HTTP 500/419/network messages from F1) |
| error while data cached | content stays + banner "Couldn't refresh — showing the last loaded data." |
| timetable empty (no rows at all) | `EmptyState` "No timetable published yet" + hint with the school year |
| selected day has no periods | inline "No periods on {Monday}." (the strip stays usable) |
| rows without a weekday | under an "Other" chip, never dropped silently |
| exam schedule empty | `EmptyState` "No exams scheduled" |
| only earlier exams | "Upcoming" shows "No upcoming exams." above the Earlier group |
| `syear` missing / not a student | same empty states as S1, no request |
| refreshing | pull-to-refresh on both screens |
Accessibility: each period/exam card is one accessible element with a combined label (e.g. "Period 2, 9:45 AM to 10:30 AM, Mathematics, Mrs Shah"); colour is never the only signal; touch targets ≥ 44 dp.
**UX decisions to confirm:** S3-D1 times shown in **12-hour** format with AM/PM (the Flutter app does the same); S3-D2 the day strip is **Monday–Saturday** and opens on today (Sunday → Monday); S3-D3 periods within a day sorted by **start time**, then `period_id`; S3-D4 exams split into Upcoming/Earlier instead of the server's single descending list; S3-D5 `subject_name`/`teacher_name` shown exactly as sent (no comma splitting); S3-D6 the exam file link reuses S1's `safeAttachmentUrl`.

## 9. Date, time and academic-year handling
- **Academic year:** both endpoints are called with the login's `mobile_syear` (`user.syear`) — there is no year switcher in V1. Both results are for that year only: the timetable needs a `timetable` row for `syear` (a school that has not rolled its timetable over shows an empty list at the start of a year — handled by the empty state, which names the year); the exam schedule is filtered by `e.syear`.
- **Dates:** exam `date_` is normalised with `toDateKey` (ISO or `DD-MM-YYYY`, no `Date` parsing, so no time-zone shift). "Today" and the Upcoming/Earlier split use the **device's local calendar date** (`localDateKey`) — assumed to match the school's local date **[ASSUMPTION]**; an exam dated today counts as Upcoming for the whole day.
- **Weekday:** derived from `week_day` labels for the timetable and computed from the date key (UTC arithmetic) for exams; today's weekday uses the device's local day.
- **Times:** `HH:MM[:SS]` strictly parsed (hours 0–23, minutes 0–59) and shown in 12-hour form; unreadable or missing times are omitted, never guessed. Periods are ordered by parsed start time; a period without a time sorts last.

## 10. Backend limitations and blocked functionality
No part of S3 is blocked. Limitations the UI works around or shows honestly:
1. Alphabetical weekday ordering → client re-sorts. 2. Sunday / unknown weekday → `null` → "Other" chip. 3. Batch/elective periods are concatenated (§3). 4. Periods can disappear silently when the teacher is inactive or a master record is missing. 5. `GROUP_CONCAT` text for subject/teacher (no structured list). 6. Exam rows carry no id and may be duplicated for a double enrollment → de-duplicated by title+date+file. 7. Exam file link built from `SERVER_NAME`; links for schedules uploaded through the teacher mobile flow may not resolve (mismatch recorded under T4c); web-published ones match the read path. 8. No ownership check on `student_id` (any token can read any student). 9. Both endpoints answer in `json_encode` with `text/html` — handled by F1.
Real row shapes (actual `week_day`/time values, batch rows, file names) are **verified from code only**; confirming them against real data waits for Q16.

## 11. Exact files expected to change (all under `D:/lms_k12_mobile_rn`)
**Modified (3)**
| File | Change |
|---|---|
| `src/api/student.ts` | **append** `fetchTimetable()`, `fetchExamSchedule()`, types and tolerant parsers (existing functions untouched) |
| `src/utils/dates.ts` | **append** `weekdayShort(key)` and `dateWithWeekday(key)` (S1's functions untouched) |
| `src/screens/registry.ts` | + `time_table`, `exam_schedule` |
**New**
`src/screens/student/timetableModel.ts` (pure: time parsing/12-hour, weekday normalisation, grouping, ordering, default day) · `src/screens/student/examScheduleModel.ts` (pure: de-duplication, Upcoming/Earlier split) · `src/screens/student/TimetableScreen.tsx` · `src/screens/student/ExamScheduleScreen.tsx` · `src/hooks/useTimetable.ts` · `src/hooks/useExamSchedule.ts` · `src/components/DayStrip.tsx`.
Tests: `__tests__/timetableModel.test.ts`, `examScheduleModel.test.ts`, `studentScheduleApi.test.ts`, `TimetableScreen.test.tsx`, `ExamScheduleScreen.test.tsx`, `DayStrip.test.tsx`, `studentSchedule.local.test.ts` (opt-in), plus additions to `dates.test.ts` and `registry.test.ts` (now seven names).
No `package.json`, native, Laravel or Next.js change; no new library; S1/S2 behaviour unchanged.

## 12. Tests
**Unit (Jest):**
- `timetableModel` — time parsing (`09:05:00`, `9:05`, out-of-range, empty, garbage), 12-hour formatting (midnight, noon, 12:30 PM, 00:15 AM), weekday normalisation (`Mon`…`Sat`, case/whitespace, `null`/unknown → Other), grouping by day, ordering by start time then period id and untimed last, `GROUP_CONCAT` text preserved (not split), default day (today's weekday; Sunday → Monday; a weekday with no periods still selectable), all-null rows.
- `examScheduleModel` — de-duplication, ISO and `DD-MM-YYYY` dates, unreadable dates (kept, in a third "Date to be confirmed" group — see the choice below), Upcoming (today inclusive, ascending) / Earlier (descending) split with an injected "today", empty groups.
- `dates` additions — `weekdayShort`/`dateWithWeekday` across month, year and leap boundaries.
- API (`studentScheduleApi`) — path `studentTimetableAPI`/`studentExamScheduleAPI`, form-encoding, identity block, **no other fields**, tolerant parsing (null fields, missing arrays, non-object rows), "Parameter Missing", 401, 419, HTTP 500 and HTML mapping.
**Component (RNTL):**
- `TimetableScreen` — day strip opens on today (date pinned) and Sunday→Monday; switching day shows that day's periods in time order; "Other" chip only when needed; empty timetable vs empty day; loading; error + Try again; stale banner; `syear` missing and non-student make **no request**; per-user cache key; accessibility labels.
- `ExamScheduleScreen` — Upcoming/Earlier grouping, "No upcoming exams.", attachment button only for an accepted host and it opens the re-based URL via `Linking`, none for foreign/bare/non-http, empty, loading, error + retry, stale banner, guards, per-user cache key.
- `DayStrip` — selection, dots, ≥ 44 dp style, accessibility state/label.
- `registry` — seven names.
**Regression:** all 232 existing tests pass unchanged; `npm run typecheck` clean.
**Choice to confirm on approval:** an exam row whose date cannot be read is **kept** and shown in a third "Date to be confirmed" group at the bottom rather than dropped, so no published exam disappears silently (recommended; say if you prefer dropping it).

## 13. Acceptance criteria
1. As a student, the `time_table` tile opens `TimetableScreen` and `exam_schedule` opens `ExamScheduleScreen` (not the generic data dump); removing the two registry lines restores the old behaviour.
2. Timetable: the strip opens on today (Sunday → Monday); each day lists its periods in start-time order with 12-hour times, period name, subject and teacher exactly as the server sent them; a day without periods says so; rows with no weekday are reachable under "Other".
3. Exam schedule: upcoming exams first (today inclusive), then earlier ones; weekday shown; duplicate rows collapsed; the file button appears only for an accepted host and opens the re-based URL.
4. Every state in §8 is reachable and correct; no crash on `status:0`, `null` fields, empty lists, unreadable dates or times, or an HTML 500/419.
5. No request is made for a non-student or without a school year; no id comes from the UI; the identity block is the session's own (tests).
6. `npm run typecheck` and `npm test` pass; no native or package change.
7. Local contract checks with synthetic ids pass (§14); the real-data check is **not** claimed and stays pending Q16.
8. Device/emulator checks in §15 are either done and recorded, or recorded as not done — never claimed.

## 14. Local-server verification plan (synthetic ids only — Q16)
Same setup as S1: `php artisan serve --host=127.0.0.1 --port=8000`, JWT signed locally with the app's own secret for student id `0` / tenant `0`, an opt-in loopback-only test `studentSchedule.local.test.ts` (skipped unless `LOCAL_*` variables are set; refuses any non-loopback URL). Checks, driving the **real client and fetch functions over real HTTP**:
| Check | Expected |
|---|---|
| `fetchTimetable()` for student 0 | success, empty list |
| `fetchExamSchedule()` for student 0 | success, empty list |
| bad token on each | `unauthorized` |
| missing school year on the session (calls made with an empty `syear`) | `validation` "Parameter Missing" |
| `Host: localhost:8000` | 419 message (already verified in F1; repeated once) |
Already done for this document (curl, 2026-10-07): both endpoints return success with `[]` for student 0, "Parameter Missing" without ids, 401 without a token, and also accept a JSON body.
**Not verifiable without real data (Q16):** real `week_day`/time values, batch rows, the order of real periods, real exam titles/dates, file names and whether the files resolve. These stay unverified and are listed as such in the actuals section after the build.

## 15. Device / emulator verification requirements
Unit and component tests cannot show real layout. Needed before S3 can claim "works on a device":
1. **Day strip** at 360 dp width and at a large font scale: all six chips visible or smoothly scrollable, ≥ 44 dp targets, selected state obvious.
2. **Time block** readability (12-hour, no wrapping of "9:45 AM – 10:30 AM").
3. **Pull-to-refresh** on both screens; loading and offline states (airplane mode).
4. **Open schedule** hands off to the system browser; a dead link fails gracefully.
5. **TalkBack/VoiceOver** reads each period and exam card as one sentence.
6. Midnight/day change: reopening the screen after the date changes selects the new day.
**Environment finding:** this machine has an Android SDK with an emulator and a `Pixel_10_Pro` AVD (`C:/Users/Asus/AppData/Local/Android/Sdk`, `~/.android/avd`), but `adb`/`emulator` are not on `PATH` and no run has been attempted. Using it would mean a local native dev build (`npx expo run:android`, which generates the git-ignored `android/` folder and needs a JDK/Gradle) or Expo Go, plus `adb reverse tcp:8000 tcp:8000` and a base URL of exactly `http://127.0.0.1:8000`. That is a heavier step than any so far, so it is **not** started; see question Q22.
Without a device run, S3's UI is verified by component tests and the Metro bundle check only, and the document will say so.

## 16. Dependencies, risks and rollback
- **Depends on:** F1, S1, S2 (all done and committed). Nothing else.
- **Risks:** (1) batch/elective periods may list subjects the student does not attend (server); (2) the real `week_day`/time formats are assumed from code; (3) exam links may be dead (upload-path mismatch); (4) device/local timezone differences around midnight; (5) a period can vanish server-side without a trace.
- **Rollback:** delete the two S3 lines in `src/screens/registry.ts` (the tiles fall back to `GenericDataScreen`, today's behaviour) or `git revert` the S3 commit; the `dates.ts` and `student.ts` additions are additive and unused after that. F1, S1 and S2 are unaffected. JS-only; once EAS Update is configured, `eas update:rollback` also works. No server or data change is made.

## 17. Questions (answered 2026-10-07: Q21 yes, Q22 option c; Q16 still open)
- **Q21** Approve this document and the UX decisions S3-D1…D6 (§8), and the "Date to be confirmed" group for unreadable exam dates (§12).
- **Q22** Device verification (§15): (a) will you run it on a phone/emulator after I build, (b) may I try the existing `Pixel_10_Pro` emulator with a local dev build (heavy: generates `android/`, needs JDK/Gradle; I would not commit generated native folders), or (c) accept component-test-only verification for S3 and defer device checks to a later batch covering S1–S3?
- Reminder: **Q16 stays open** — no real student data; the real-data check for S1, S2 and S3 waits for your explicit confirmation of the database environment.

## 18. What was actually done (2026-10-07)
Built in the approved order: timetable first, then exam schedule. Everything is **uncommitted** in the working tree (no commit authorisation for S3 yet). Q21 approved S3-D1…D6 and the "Date to be confirmed" group; Q22 chose **option (c)**: component/integration tests plus local-server verification now, and one coordinated device/emulator pass for S1–S3 later (no native project was generated).

### Files (all under `D:/lms_k12_mobile_rn`)
**Modified (3 source files — additions only: +66 lines, 0 lines removed; S1/S2 code is untouched)**
| File | Change as built |
|---|---|
| `src/api/student.ts` | appended `TimetableEntry` + `fetchTimetable()` and `ExamEntry` + `fetchExamSchedule()`; S1/S2 functions untouched |
| `src/utils/dates.ts` | appended `weekdayShort()` and `dateWithWeekday()` |
| `src/screens/registry.ts` | + `time_table`, `exam_schedule` |
**New (src, 7):** `screens/student/timetableModel.ts`, `examScheduleModel.ts`, `TimetableScreen.tsx`, `ExamScheduleScreen.tsx`; `components/DayStrip.tsx`; `hooks/useTimetable.ts`, `useExamSchedule.ts`.
**Tests:** new `timetableModel`, `examScheduleModel`, `studentScheduleApi`, `TimetableScreen`, `ExamScheduleScreen`, `DayStrip`, `studentSchedule.local` (opt-in); extended `dates.test.ts`, `registry.test.ts`; test helper `helpers/kit.tsx` (`pinToday` takes an optional date, default unchanged).
No `package.json`, native, Laravel or Next.js change; no new library. The S1 `studentGate`, `StaleBanner`, `useStudentQuery`, `safeAttachmentUrl`, date utilities and the `Card`/`Page`/`EmptyState`/`Button` kit were reused as they are.

### Deviations from the plan (all small; none changes a decision)
1. **Rows with nothing to show are skipped** by `buildTimetable` (no subject, no period name and no readable start time); the plan did not say. They are not counted, so a timetable made only of such rows shows "No timetable published yet". A row with *any one* of the three is kept.
2. **A timetable made only of unmapped-weekday periods is not "empty"**: the Other chip is the way in (tested), so nothing the server sent is hidden.
3. `normaliseDay` also accepts full day names (the server sends three-letter labels); it never guesses from prefixes (`Mo`, `U`, `M` → Other).
4. The strip's chip is `minWidth/minHeight: 52` (≥ 44 as planned) and the "Other" chip is named "Other days" for screen readers, with the caption "Periods without a weekday from your school."
5. A period without a readable time shows "—" in its time block (never an invented time) and sorts last.
6. The time block has a fixed width of 104; the exact look is not verified on a device (see limitations).
7. The test helper `pinToday` gained an optional argument so the Sunday/Monday/Saturday cases can be pinned; existing callers are unchanged.

### Tests (Jest) — full suite: 33 suites, **325 tests: 315 passed, 0 failed, 10 skipped** (the opt-in local tests); `npm run typecheck` clean. Before S3: 232 passing (S3 added 83).
| Suite | Tests | Covers |
|---|---|---|
| `timetableModel.test.ts` | 18 | weekday labels (full names, case, Sunday/empty/unknown/partial → Other); strict clock parsing; 12-hour formatting incl. midnight, noon, 1:05 PM; time ranges; grouping; **ordering by start time**, untimed last, equal times by numeric period id (10 after 9); Other bucket never dropped; GROUP_CONCAT text not split; empty-row skipping; Sunday→Monday default and no "today" on Sunday; spoken period label |
| `examScheduleModel.test.ts` | 9 | ISO and DD-MM-YYYY, trimming, de-duplication, unreadable dates kept, Upcoming (today inclusive, ascending) / Earlier (descending) split, same-date tie-break, every item in exactly one group |
| `studentScheduleApi.test.ts` | 10 | each endpoint's path, form-encoding, **identity block and nothing else**, field mapping with nulls, tolerant parsing (missing/malformed data, non-object rows), `text/html` body, "Parameter Missing", 401, 419, HTTP 500, HTML on a 200 |
| `TimetableScreen.test.tsx` | 19 | **loading/success** (opens on today, order, 12-hour times, text as sent); picking a day; a day with no periods; Monday–Saturday strip with no Sunday chip; **Sunday → Monday**, Monday, Saturday-empty; **Other chip** only when needed and a timetable of only unmapped periods; **empty state** naming the year, nothing-to-show rows; loading; error + retry; 419 message; stale banner; school year missing / non-student make **no request**; per-user cache |
| `ExamScheduleScreen.test.tsx` | 19 | **Upcoming/Earlier/Date to be confirmed** grouping and order with weekday labels; duplicate collapse; ISO and DD-MM-YYYY; "No upcoming exams."; **unreadable dates kept**; untitled exam; **link validation** (ERP host re-based onto the API host and opened; foreign host, look-alike, credentials-in-URL, bare name, empty, `javascript:` and `file:` refused; button only on acceptable cards); empty; loading; error + retry; stale banner; **401 shown as an error state**; guards; per-user cache |
| `DayStrip.test.tsx` | 5 | tab labels incl. "today" and "nothing scheduled", selected state, `onSelect` key, ≥ 44 dp in both directions, empty list |
| `dates.test.ts` / `registry.test.ts` | +2 / +1 | weekday helpers across month/year/leap boundaries; seven registered names, staff tiles `t_timetable`/`t_exam_schedule` not claimed |
| existing suites | unchanged | all 232 earlier tests pass unchanged, including S1/S2's |

### Acceptance criteria (§13)
| # | Criterion | Result |
|---|---|---|
| 1 | the two tiles open dedicated screens; removing the registry lines restores the old behaviour | ✅ registry test; ⚠️ not seen on a device |
| 2 | timetable: opens on today (Sunday → Monday), start-time order, 12-hour times, text as sent, empty day message, Other reachable | ✅ tests |
| 3 | exam schedule: upcoming first (today inclusive), then earlier, weekday shown, duplicates collapsed, file button only for an accepted host and opens the re-based URL | ✅ tests |
| 4 | every state reachable and correct; no crash on `status:0`, null fields, empty lists, unreadable dates/times, HTML 500/419 | ✅ tests |
| 5 | no request for a non-student or without a school year; no id from the UI; identity is the session's own | ✅ tests on both screens and the API tests |
| 6 | typecheck and tests pass; no native/package change | ✅ (also: `npx expo export --platform android` still bundles, 1056 modules, no unresolved modules) |
| 7 | local contract checks with synthetic ids pass; real-data check **not** claimed | ✅ synthetic ids only |
| 8 | device/emulator checks done or recorded as not done | recorded as **not done** (Q22 option c) |

### Verification against the local server (read-only, synthetic ids only — Q16)
`php artisan serve --host=127.0.0.1 --port=8000`; JWT signed locally with the app's secret for student id `0` / tenant `0`. The opt-in test drives the **real client and fetch functions over real HTTP** (Node `http`), alongside the S1 and S2 opt-in tests in the same run (10/10 passed):
| Check | Result |
|---|---|
| `fetchTimetable()` for student 0 | success, empty list ✅ (the grouped SQL runs without error) |
| `fetchExamSchedule()` for student 0 | success, empty list ✅ |
| bad token on both | `unauthorized` ✅ |
| session with an empty school year on both | `validation` "Parameter Missing" ✅ |
| base URL `http://localhost:8000` through the real client | `server` 419 "The server rejected the request. Check the app's server address." ✅ (temporary probe, removed) |
| opt-in test with `https://erp.triz.co.in` as base | refuses to run ✅ |
Also before the build (curl): both endpoints accept a form or a JSON body, return `text/html`, and answer 401 without a token. Server stopped afterwards (port 8000 free). The database was touched only by SELECTs for the non-existent student `0`.

### Known limitations
- **No real student data was read** (Q16): the real `week_day`/time values, batch/elective rows, the real order of periods, real exam titles/dates/file names and whether the files resolve are verified **from code only**.
- **Not run on a device or emulator** (Q22 option c): the day strip's look and scrolling at 360 dp and large font scales, the 52/44 dp targets, the 12-hour time block, pull-to-refresh, the browser hand-off for the exam file, and screen-reader reading are asserted by tests as props/labels/styles, **not observed**. The coordinated S1–S3 device pass (§15 checklist plus S1/S2 items) is still owed.
- **Server limits shown honestly, not fixed:** weekday order is alphabetical on the server (the client re-sorts); batch/elective periods arrive as one row with every batch's subjects (the app cannot tell which one the student attends); a period can vanish when its teacher is inactive or a master record is missing; subject and teacher are `GROUP_CONCAT` text; exam rows have no id; links to schedules uploaded through the teacher-mobile flow may be dead (web-published ones match the read path).
- "Today", the weekday strip default and the Upcoming/Earlier split use the **device's local date**, assumed to match the school's.
- Periods without a readable time sort last and show "—"; the weekday strip has no Sunday because the server never maps one.
- Jest's `fetch` is a stub, so unit tests mock `text()`; only the opt-in tests make real HTTP calls.

### Rollback
1. Delete the two S3 lines in `src/screens/registry.ts` (`time_table`, `exam_schedule`): the tiles fall back to `GenericDataScreen`, today's behaviour. Or `git revert` the S3 commit(s) once committed. 2. The additions to `student.ts` and `dates.ts` are additive and unused after that; S1, S2 and F1 are unaffected. 3. JS-only; once EAS Update is configured, `eas update:rollback` also works. No server or data change was made.

