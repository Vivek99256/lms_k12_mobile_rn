# S2 — Student attendance

Status: **DONE** (signed off 2026-10-07) — implemented and tested; contract verified locally with student id 0 only. **Real-data check intentionally not done**: the remote database is treated as potentially production until you confirm otherwise (Q16). Document approved 2026-10-07 (Q13, Q15); U-1, U-2, U-3 approved as proposed.
Class: **V1** · Role: Student · Priority: first vertical slice · Depends on: **F1** ([F1-legacy-transport.md](F1-legacy-transport.md)) · Decisions: D-02, D-03, D-09, D-15.
Facts cite file:line. `ev:` = [evidence/](../evidence/README.md). **[ASSUMPTION]** = not read from code. **[VERIFIED-LOCAL]** = observed on the local Laravel server 2026-10-07 (F1 §10).

## 1. What the student will be able to do
- See their attendance for the academic year as a month calendar: each school day marked Present / Absent, holidays, events and vacations marked, month and year totals with attendance %.
- Move between months, tap a day to see its status and any holiday/event/vacation titles and descriptions.
- Pull to refresh; see clear messages when loading, offline, empty, or the school year is not configured.
Read-only. No writes, no uploads, no new library.

## 2. Web screens and Laravel APIs this is based on
**Web:** there is **no** web screen where a student sees their own attendance. Searched `D:/lms_k12` (`app`, `lib`, `components`) for `studentAttendanceAPI` — no match. The web attendance pages are staff tools: `app/student/student_attendance/page.tsx` (teacher marks P/A; calls `get_adminAcademicSection/Standard/Division` and `student/…` via `/api/proxy`, lines 264-330, 465-713), `app/student/monthwise_student_attendance/page.tsx` (admin report). They define the meaning of the data (teacher saves `student[<id>]=P|A` per day) but are not reused as UI.
**So S2 is mobile-only, on the legacy mobile contract** used by the production menu and the Flutter app:
| Item | Evidence |
|---|---|
| Menu tile `screen_name=student_attendance` → `https://erp.triz.co.in/studentAttendanceAPI`, params `student_id,syear,sub_institute_id,type`; enabled in **31 of 34** student tenants | ev:menu_tiles.txt line 9 (read-only SELECT 2026-10-07) |
| Route `POST /studentAttendanceAPI` → `studentAttendanceController::studentAttendanceAPI` | `routes/student.php:179`; `app/Http/Controllers/student/studentAttendanceController.php:623-692` (read in full) |
| Flutter reference screen | `D:/new_mobile_lms_k12/lib/screens/student/calendars.dart:80-155`; colours P green, other-than-P red, holiday blue; sends an unused `mobile_no` |
| Auth class: JWT signature only, ids from request, no check that ids match the token | ev:student_tiles_backend.md row `student_attendance` |

## 3. API contract (read from code and verified locally)
**Request** `POST {EXPO_PUBLIC_API_BASE_URL}/studentAttendanceAPI` — sent through F1's `legacy.post` (identity block, urlencoded, Bearer header). The controller reads only `type`, `student_id`, `sub_institute_id`, `syear` (`studentAttendanceController.php:640-643`); the other identity fields are ignored. The app does **not** send `mobile_no`.
| Field | Source in the app | Rule on server |
|---|---|---|
| `student_id` | session `user.id` (= `tblstudent.id`, `ApiLoginController.php:413-420,442`) | non-empty |
| `sub_institute_id` | session | non-empty |
| `syear` | session `user.syear` (= login `mobile_syear`) | non-empty |
| `type` | `API` (F1) | not required here |
Missing any of the three → 200 `{"status":0,"message":"Parameter Missing"}` (`:691`) — **[VERIFIED-LOCAL]**.

**Response (success)** — HTTP 200, `Content-Type: text/html`, body JSON — **[VERIFIED-LOCAL]** (shape with empty arrays) and from code `:683-688`:
```json
{"status":1,"message":"Success","data":{
  "attendance_data":[{"attendance_date":"2026-10-05","attendance_code":"P"}],
  "calendar_data":{
    "holiday":[{"school_date":"…","title":"…","description":"…","event_type":"holiday"}],
    "event":[…], "vacation":[…]}}}
```
- `attendance_data`: all rows of `attendance_student` for the student+school+year with a non-null date, ordered by date (`:645-651`). `attendance_date` is a `date` in the migration (`database/migrations/…attendance_student…:21`), but migrations disagree with the live DB (memory note) → the app normalises by taking the first 10 characters.
- `calendar_data.*`: `calendar_events` joined to the student's enrollment via `find_in_set(standard_id, c.standard)` and same `syear`, filtered by `event_type` (`:653-681`). A student with **no enrollment row** for the year gets empty calendar arrays but still gets attendance rows (attendance query does not use enrollment).
- `attendance_code`: the backend writes whatever the teacher app sends — `P`, `A`, or `''` for unmarked students (`studentAttendanceController.php:253-333`, ev:teacher_tiles_backend.md row `t_take_attendance`). Other codes were **not found** in the backend writer (searched that controller); treat unknown codes defensively (below).

**Errors:** 401 `{"status":"2",…}` → F1 → global sign-out (existing). 419 on a non-exempt host → friendly message (F1). 5xx/HTML → generic server error.

**Mapping rules (app side, unit-tested):**
| Server value | App meaning |
|---|---|
| code `P` (case-insensitive) | Present |
| code `A` | Absent |
| `''`/null | not marked → treated as no record |
| any other code | "Other (<code>)", shown neutral, **not** counted in %  (decision U-2) |
| several rows for one date | last non-empty code wins (rows are ordered by date only; ties undefined — rare: student moved class) |
| `school_date`/`attendance_date` | date key = first 10 chars `YYYY-MM-DD`; no `Date` timezone parsing |
| %, per month and per year | `P / (P + A)` rounded to whole %, shown `—` when `P + A = 0` |

## 4. Authentication and identity
- Token and ids come only from `useAuthStore` (F1 §7); the screen takes no ids from route params. Student session: `student_id` cannot be overridden.
- In-screen guard (defence in depth on top of `TileScreen`'s menu check, `navigation/TileScreen.tsx:27-30`): if `!user.isStudent` render "This screen is for students".
- `user.syear` empty/null → "School year not configured" state **before** calling the API (avoids the "Parameter Missing" round trip).
- Backend gap (not fixable here): the server does not verify `student_id` against the token; reported in 03 §7.

## 5. Navigation and screen flow
```
Home / Menu tab ──tap tile "Student Attendance"──► Tile route (key "activity/student-attendance")
        TileScreen (existing guard: tile listed by backend)
              └─ screenRegistry["student_attendance"] ─► AttendanceScreen
                                    ├─ summary cards (month)  ├─ MonthCalendar  ├─ legend  ├─ day detail card
```
- Entry unchanged: `components/TileList.tsx:12-15` navigates to `Tile {key,title}`; `TileScreen.tsx:36-38` picks `screenRegistry[tile.screenName]` — S2 adds the registry entry only. Remove the entry → falls back to `GenericDataScreen` (current behaviour) = rollback.
- The dedicated screen calls the **fixed** path `studentAttendanceAPI` (typed contract), not `tile.api`, so a changed/absent DB value cannot break it. `tile` is used for the title only.

## 6. UI design (mobile-first, uses existing kit and theme)
- Layout (top→bottom): month header with ‹ ›; three stat cards for the month (Present, Absent, Holidays) + big attendance % ; `MonthCalendar`; legend; "Academic year" line (`182 present · 8 absent · 96%`); day detail card when a day is selected.
- `MonthCalendar` (**new reusable component**, also needed by S1's Academic Calendar): 7-column grid, Monday first **[ASSUMPTION, one constant — decision U-1]**, today ringed, cells ≥ 44 dp, selected day outlined. Cell = day number + status mark: Present = green fill + "P", Absent = red fill + "A", Holiday = blue fill, Vacation = amber dot, Event = purple dot. Colour is never the only signal (letter marks + `accessibilityLabel` like "12 October, Present, Holiday: Diwali").
- Month navigation bounded to the months between the earliest record (or current month) and the current month.
- Colours from `config/theme.ts` tokens (`success`, `danger`, `primary`, `candy`); text styles via existing `fonts`; motion via existing `FadeInUp`/`CountUp` (they honour reduce-motion, `components/motion.tsx`).
- States:
  | State | UI |
  |---|---|
  | loading (no data yet) | existing `Loading` |
  | error, no data | `ErrorState` with `userMessage(error)` + Retry (existing) |
  | error while data cached | keep calendar + one-line banner "Couldn't refresh — showing last loaded data" |
  | `syear` missing | `EmptyState` "School year not set — contact your school" |
  | OK but zero attendance rows and zero calendar rows | `EmptyState` "No attendance recorded yet" |
  | zero attendance but calendar entries | calendar + note "No attendance recorded yet" |
  | refreshing | pull-to-refresh (`Page onRefresh`) |
  | not a student | "This screen is for students" |
- UX decisions needing your confirmation: **U-1** week starts Monday (alternative Sunday). **U-2** unknown codes neutral & excluded from %. **U-3** if a day has both a recorded P/A and a holiday, the recorded attendance is the cell colour and the holiday appears as a badge + in the detail card (Flutter instead lets the holiday colour win).

## 7. Exact files that will change (all under `D:/lms_k12_mobile_rn`)
| File | Change |
|---|---|
| `src/api/student.ts` (**new**) | `fetchStudentAttendance(): Promise<AttendanceResponse>` using `legacy.post('studentAttendanceAPI')`; types `AttendanceRow`, `CalendarRow`, `AttendanceResponse`; tolerant of missing arrays |
| `src/screens/student/attendanceModel.ts` (**new**, pure) | date-key normalisation, code mapping, month-grid builder, summary/% maths, marker maps |
| `src/hooks/useStudentAttendance.ts` (**new**) | `useQuery(['student-attendance', userId, syear], …, staleTime 5 min, enabled only for a student with syear)` — cache is cleared on sign-out by `App.tsx:26-27` |
| `src/components/MonthCalendar.tsx` (**new**) | reusable calendar grid |
| `src/screens/student/AttendanceScreen.tsx` (**new**) | the screen (sections §6) |
| `src/screens/registry.ts` | add `student_attendance: AttendanceScreen` (file was designed for this: `registry.ts:10-14`) |
| `__tests__/attendanceModel.test.ts`, `__tests__/studentApi.test.ts`, `__tests__/AttendanceScreen.test.tsx` (**new**) | §8 |
| `docs/migration/STATUS.md`, this file | "what was actually done" after build |
No `package.json`, native, or Laravel/Next.js change. Follows D-03 layout (`src/screens/<role>/`, `src/api/<module>.ts`, `src/hooks/use*.ts`).

## 8. Tests
**Unit (Jest):** `attendanceModel` — date normalisation (`2026-10-05`, `2026-10-05 00:00:00`, ISO with `T`); code mapping (case, `''`, unknown); duplicate dates; month grid (Monday-first, 28/29/30/31-day months, leap Feb 2028, month starting Monday and Sunday, always 6 rows or fewer); %-rounding and `—` when 0/0; holiday/event/vacation marker merge; month bounds. `studentApi` — request carries the identity block and path `studentAttendanceAPI`; maps success; missing arrays → `[]`; `status:0` → validation error; non-student/no-syear not requested.
**Component (React Native Testing Library, already a devDependency; no existing component tests in the repo — first use, environment risk noted):** loading → data; error → Retry refetches; stale-data banner; `syear` null → not-configured; non-student → guard; empty state; month navigation clamps; tapping a day shows its detail; accessibility labels present.
**Regression:** all existing 20 tests + F1's tests pass; `npm run typecheck` clean; `npx expo lint` if configured **[ASSUMPTION: no lint script exists in package.json — to confirm]**.
**Integration (manual, local):** run local Laravel on `127.0.0.1:8000`, `EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:8000` (+ `adb reverse` on Android), sign in as a **test student**, open the tile, compare shown counts with a direct `studentAttendanceAPI` response. Requires a test account (Q12).

## 9. Security considerations
- Identity only from the session; student cannot request another student (F1 §4.2). Nothing user-controlled reaches the request.
- Token never logged; errors show server `message` only. Data is rendered as plain `<Text>` (calendar titles/descriptions are DB text; no HTML rendering, so no injection surface in the app).
- Cache is keyed per user and cleared on sign-out (`App.tsx:26-27`); nothing is persisted to disk (TanStack memory cache only).
- Relies on a backend that does not enforce ownership (any valid token can read any student). Recorded as a backend ask; the app cannot compensate beyond not exposing the id.
- Local dev must use `http://127.0.0.1:8000`, never production (F1 §12).

## 10. Acceptance criteria
1. Tapping "Student Attendance" as a student opens `AttendanceScreen` (not the generic data dump).
2. For a student with data, month totals and % equal a manual count from the API response; year line equals totals over all rows.
3. Holidays/events/vacations of the student's standard appear; the day detail lists them.
4. Each state in §6 is reachable and correct (tested); no crash on `status:0`, empty arrays, null `syear`, datetime strings.
5. Colour is never the only indicator; every cell has an accessibility label; touch targets ≥ 44 dp.
6. A non-student session cannot see data; a different `student_id` cannot be requested from the UI.
7. `npm run typecheck`, `npm test` pass; no native/package change; works when the tile's DB `api` is empty.
8. Verified against the local server with a test student (Q12); results appended to this document under "What was actually done".

## 11. Dependencies and rollback
- Needs F1 merged first. No dependency on F2 (only one registry line) or F3.
- Rollback: delete the registry entry (instant fallback to `GenericDataScreen`) or revert the S2 commit; JS-only, OTA-rollback capable. No data migration; nothing written to the server.

## 12. Known limits / not in S2
Academic-year switching (always the login `mobile_syear`); attendance for other students (staff, T2); daily attendance push notifications (Later); the student *Academic Calendar* and *Holiday List* tiles (S1 — will reuse `MonthCalendar` and `studentCalenderAPI`, `routes/cal.php:21`).


## 13. What was actually done (2026-10-07)
### Files (all under `D:/lms_k12_mobile_rn`)
| File | As built |
|---|---|
| `src/api/student.ts` (new) | `fetchStudentAttendance()` via `legacy.post('studentAttendanceAPI')`, no ids passed; tolerant `parseAttendance()`; types |
| `src/screens/student/attendanceModel.ts` (new, pure) | `dateKey`, `classifyCode` (U-2), `buildDayMap` (duplicates: last non-empty wins; attendance and calendar merge per day, U-3), `monthGrid` (Monday first, U-1), `summarise` / `monthSummary`, month bounds and clamp, long-date formatting (no `Intl`), `statusText`, `dayLabel` |
| `src/hooks/useStudentAttendance.ts` (new) | `useQuery(['student-attendance', userId, syear])`, enabled only for a student with a school year, 5-minute stale time |
| `src/components/MonthCalendar.tsx` (new) | reusable month grid: title, ‹ ›, weekday row, cells with `minHeight: 44`, P/A/code or H mark, holiday/vacation/event dots, accessibility labels |
| `src/screens/student/AttendanceScreen.tsx` (new) | month summary card (%, present/absent/holidays), calendar + legend, day detail, academic-year line, every state of §6 |
| `src/screens/registry.ts` | `student_attendance: AttendanceScreen` |
| `src/config/theme.ts` | two new tokens, `successSoft` and `warning` (`#d97706`, the web design-system warning colour) |
| `__tests__/attendanceModel.test.ts`, `studentApi.test.ts`, `AttendanceScreen.test.tsx`, `registry.test.ts` (new), `attendance.local.test.ts` (new, opt-in) | see below |

### Deviations from the plan
1. Added two theme tokens (the amber and soft-green tints did not exist in `theme.ts`).
2. `AttendanceScreen` ignores its `tile` prop (it uses the fixed endpoint, as designed); the registry type still passes it.
3. Stat figures are plain text, not `FadeInUp`/`CountUp` (simpler and testable; no information lost). Motion can be added later.
4. Added `registry.test.ts` and the opt-in `attendance.local.test.ts`, which were not in the original test list.
5. Month navigation bounds use the earliest/latest date of **any** record (attendance or calendar) plus today.

### Tests
- Model: date normalisation including invalid and leap dates; code mapping; duplicate dates; holiday + attendance merge; grids for Feb 2026 (starts Sunday), Mar 2026 (6 weeks), Jun 2026 (starts Monday), Oct 2026, leap Feb 2028; Sunday-first option; monthly/yearly maths, rounding (67%), null percent, "other" excluded; month arithmetic across years; bounds and clamp; labels.
- API: request path + identity (no `mobile_no`), success mapping, text/html body, `status:0`, 401, 419, tolerant parsing.
- Screen (React Native Testing Library — the first component tests in this repo, and they work on jest-expo): summary numbers, cell labels with the U-3 precedence, day-detail toggle, navigation clamped to the data, loading, error + Try again, stale-data banner, empty state, school-year-not-set (no request made), students-only (no request made), per-user cache key.
- Registry maps `student_attendance` and does not claim staff screen names.
- Full suite: **100 passed, 1 skipped, 0 failed**; typecheck clean.

### Acceptance criteria (§10)
| # | Criterion | Result |
|---|---|---|
| 1 | the tile opens `AttendanceScreen`, not the generic dump | ✅ registry test; ⚠️ not seen on a device or emulator |
| 2 | totals and % equal a manual count; year line = totals | ✅ hand-computed fixture (3 P, 1 A, 1 other → 75%) |
| 3 | holidays/events/vacations shown and in day detail | ✅ screen tests |
| 4 | every state reachable and correct; no crash on `status:0`, empty arrays, null `syear`, datetimes | ✅ tests |
| 5 | colour never the only indicator; labels; ≥ 44 dp | ✅ letter marks and labels asserted; ⚠️ 44 dp is a style value (`minHeight: 44`), **not measured on a device** |
| 6 | a non-student sees nothing; no other `student_id` selectable | ✅ tests (no request is made) |
| 7 | typecheck + tests pass; no native/package change; works with an empty tile `api` | ✅ (the screen never reads `tile.api`) |
| 8 | verified against the local server with a test student | ⚠️ **Partly.** Contract verified with student id 0 only (below). The test-student run was **not done** — see Q16 |

### Verification against the local server (read-only)
Same session as F1 §13: real HTTP through the real F1 client and `fetchStudentAttendance()` → success envelope with empty lists for id 0, three runs. The endpoint contract was also probed with curl in step 3 (form-encoded, JSON and body-token all accepted; served as `text/html`). **No real student row was read.**
Why: the `.env` database (a remote host named by `DB_HOST`) is a separate remote server from `erp.triz.co.in` (128.199.17.97) and `dev.triz.co.in` (202.47.117.61), and my memory notes describe it as holding live data. I cannot establish from code that it is *not* production, so, per your Q12 rule, I made no real-data call.
Not verified: a real student's data; the UI on a device or emulator; the 44 dp touch-target size; performance with a full year of rows.

### Known limitations
- The academic year is the login `mobile_syear` (no switcher). The set of attendance codes schools use is unknown (only `P`, `A` and empty were found in the backend writer); other codes are shown neutrally (U-2).
- The server does not verify that `student_id` belongs to the token (backend gap, reported); the app only sends the session's own id.
- A student with no enrollment row for the year sees attendance but no holidays or events (the server query joins on enrollment).
- Layout and `RefreshControl` were not exercised visually.

### Rollback
Delete the `student_attendance` line in `src/screens/registry.ts` (the tile falls back to `GenericDataScreen`, today's behaviour), or `git revert` the S2 change set; F1 stays. JS-only; no server change.
