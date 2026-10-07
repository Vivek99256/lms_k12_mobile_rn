# S1 — Student home: dashboard, notification hub, circulars & events, academic calendar & holiday list

Status: **DONE** (signed off 2026-10-07) — implemented, tested, verified locally with synthetic ids only. Document approved 2026-10-07 (Q17-Q19). Real-data check intentionally not done (Q16 open).
Class: **V1** · Role: Student · Depends on: **F1** ([F1](F1-legacy-transport.md), done) and **S2** ([S2](S2-student-attendance.md), done — reuses `MonthCalendar`, the date/month model and the hook/screen pattern) · Decisions: D-03, D-07, D-09, D-13, D-17.
Facts cite file:line. `ev:` = [evidence/](../evidence/README.md). **[ASSUMPTION]** = not read from code. **[VERIFIED-LOCAL]** = observed on the local Laravel server on 2026-10-07 using only non-existent student ids (0 or 999999999) — **no real student data was read** (Q16).

## 1. What the student will be able to do
| Part | Menu tile (`screen_name`, tenants of 34) | The student can… |
|---|---|---|
| **S1a Home dashboard** | Home tab (not a tile) | see their class, three headline counts, homework/assignment progress, pending homework and assignments with due dates, the latest circulars and their subjects — instead of today's generic key/value dump |
| **S1b Notification hub** | `notification_hub` (34) | read their notifications newest-first, grouped by day, with type icon, text, tappable web links; pull to refresh; load older ones in pages |
| **S1c Circulars & events** | `circular_events` (34) | switch between Circulars and Events, read each (expand for the full text), open an attachment |
| **S1d Academic calendar / holidays** | `academic_calendar` (25), `holiday_list` (31) | browse a month calendar of holidays, vacations and events with day detail (reusing S2's `MonthCalendar`); see the holiday list in date order |
Read-only. No uploads, no new library, no native change (OTA-deliverable).

## 2. Existing web screens and Laravel APIs this is based on
**Web:** only the dashboard has a web counterpart, and it is partial. `app/api/dashboard/student/route.ts` proxies `POST /api/student-dashboard/summary` and `app/dashboard/_lib/dashboard-api.ts:158-182` declares `StudentDashboardSummary`, but the web student landing page `app/dashboard/StudentDashboard.tsx` renders the **PAL chapter dashboard** (`fetchAutoStudentDashboard`, lines 1-60), not this summary. PAL/ESO is **Later** (Q8). Searched `D:/lms_k12` (`app`, `lib`, `components`) for `notificationHubAPI`, `circular/fetchData`, `studentCalenderAPI` — **no matches**: notifications, circulars and calendar are mobile-only legacy endpoints (the web circular pages are staff tools: `app/front_desk/circular/*`).
**Backend (read in full 2026-10-07):**
| Part | Route | Controller | Auth class |
|---|---|---|---|
| S1a | `POST /api/student-dashboard/summary` (`routes/api.php:162`, `api.session`) | `RoleDashboardApiController::studentSummary` (`app/Http/Controllers/api/RoleDashboardApiController.php:305-410`) | token-bound: tenant, user, year, `is_student` from the JWT; 403 for non-students (`:313`) |
| S1b | `POST /notificationHubAPI` (`routes/student.php:231`) | `tblstudentController::notificationHubAPI` (`app/Http/Controllers/student/tblstudentController.php:1699-1765`) | JWT signature only; ids from request |
| S1c | `POST /circular/fetchData` (`routes/student.php:225`) | `circularController::fetchData` (`app/Http/Controllers/front_desk/circular/circularController.php:96-185`) | JWT signature only; ids from request |
| S1d | `POST /studentCalenderAPI` (`routes/cal.php:21`) | `calendar_controller::studentCalenderAPI` (`app/Http/Controllers/calendar/calendar/calendar_controller.php:281-322`) | JWT signature only; ids from request |
Flutter references (screen→endpoint only, not proof): `lib/ui/dashboard/dashboard_screen.dart:204-215` (student sections), `lib/screens/student/lists_a.dart:14-52` (notification hub), `lib/screens/student/tabbed.dart:56-70` (circular tabs, `action` = `circular` / `event`), `lists_a.dart:316-336` (holiday list = `action: holiday`).

## 3. API contracts

### 3.1 S1a — `POST api/student-dashboard/summary`
Sent with the existing non-legacy `api.post` (token-bound route; JSON accepted — it reads the session, not the body). Optional `syear`/`term_id` are not sent (current year).
Success (**[VERIFIED-LOCAL]** shape, non-existent student on a real tenant; field meanings from `:305-410`):
```json
{"status":"1","message":"Success",
 "summary":{"total_subjects":0,"pending_homework":0,"pending_assignments":0},
 "enrollment":null | {"syear","standard_id","standard_name","section_id","section_name"},
 "my_subjects":[{"id","subject_code","subject_name","short_name","subject_type"}],
 "pending_homework":[{"id","title","subject_id","date","submission_date"}],          // ≤10, completion_status 'N'
 "pending_assignments":[{"id","title","subject_id","submission_date","exam_id"}],    // ≤10, submission 'N'
 "recent_circulars":[{"id","title","date_"}],                                        // ≤5, own standard+division
 "task_status":[{"label":"Homework done","value":n},{"label":"Homework pending",…},{"label":"Assignments submitted",…},{"label":"Assignments pending",…}],
 "achievements":[]}
```
There is **no `data` key**: the payload is top-level, so the app reads `Envelope.raw`. Observed failures: **422** `{"success":false,"message":"Academic Term Date Expired"}` when the school has no current year (tenant that does not exist — **[VERIFIED-LOCAL]**); **403** `{"status":"0","message":"This dashboard is available to students only."}` for a non-student token — **[VERIFIED-LOCAL]**; **401** `{"success":false,"message":"Invalid token payload"}` for an empty user/tenant id — **[VERIFIED-LOCAL]** (`HydratesLegacyApiSession.php:70-75`).
Server facts the UI must respect: `my_subjects` come from `student_optional_subject` only, so they may be empty or partial (`:326-337`); pending homework is **not** limited to the current year (`:339-346`, the `homework` query has no `syear` filter) — shown as is; `achievements` is always empty (`:402-407`, the code comment says no live source) — **not rendered**; homework/assignment rows carry `subject_id`, not a name.

### 3.2 S1b — `POST notificationHubAPI` (legacy; F1 `legacy.post`)
| Field | Source | Rule (`:1711-1724`) |
|---|---|---|
| `student_id`, `sub_institute_id`, `syear` | session (F1 identity block) | all non-empty (`:1720`) else `{"status":0,"message":"Parameter Missing"}` **[VERIFIED-LOCAL]** |
| `mobile_no` | **constant `'0'`** (decision S1-D2) | must be non-empty, otherwise **unused** — the lookup that used it is commented out (`:1757`); empty → "Parameter Missing" **[VERIFIED-LOCAL]**; `'0'` accepted → `{"status":1,"message":"Success","data":[]}` **[VERIFIED-LOCAL]** |
Row (from the SQL, `:1721-1757`): `ID, NOTIFICATION_TYPE, STUDENT_ID, Status, NOTIFICATION_DESCRIPTION, NOTIFICATION_DATE ('dd-mm-yyyy'), image, side_image, color_code`. Types the SQL knows: Homework, Assignment, Circular, Photo Gallery, Video Gallery, Notification, Student Remarks, Leave Application, Parent Communication (others get a default). Ordered `ID DESC`, **no limit or paging**, grouped by type/date/description (so duplicates collapse). The meaning of `Status` is **not found in code** (searched that controller; no consumer) → the app does not use it (no unread badge). `image`/`side_image` are absolute URLs built from `$_SERVER['SERVER_NAME']` (always `https`) → **ignored** (decision S1-D3). Server quirk: filtered by `student_id` and `syear` only — **not** by school (`:1755`); the app sends only its own id, so this does not affect it; reported to backend owners (03 §7).

### 3.3 S1c — `POST circular/fetchData` (legacy)
| Field | Source | Rule |
|---|---|---|
| `student_id`, `sub_institute_id`, `syear` | session | validator `required|numeric` (`:113-118`) — failure is HTTP 200 `{"status":"0","message":{"action":["The action field is required."]},"data":[]}` **[VERIFIED-LOCAL]** (message is an **object**, not a string) |
| `action` | `'circular'` or `'event'` (Flutter's literals, `tabbed.dart:56-70`) | **required**; matched with `circular_type.type = action` (`:170`). **The stored type names are not known** (no read of `circular_type` yet) → **[ASSUMPTION]** that MySQL's default case-insensitive comparison matches `Circular`/`Event`; verified only after Q17 |
| `type` | F1 always adds `type=API` | harmless: the controller builds an extra condition from it but never appends it to the query (`:155-157`; read) |
**Form encoding is mandatory here**: the controller reads `$_REQUEST['sub_institute_id']` (`:123`), which is empty for a JSON body. **[VERIFIED-LOCAL]** — same request as form → reaches the enrollment lookup; as JSON → `ErrorException: Undefined array key "sub_institute_id"` at `circularController.php:123`. F1's urlencoded legacy transport is therefore a hard requirement.
A student with **no enrollment row** for the year → `$result[0]` undefined → **HTTP 500** (`:153`) **[VERIFIED-LOCAL]** (`ErrorException: Undefined array key 0`). F1 turns any 500 into a `server` error; S1c adds a specific hint (§6).
Success row (`c.*` plus): `id, title, message, date_ ('dd-mm-yyyy'), file_name ('' or absolute URL https://<SERVER_NAME>/storage/circular/<file>), circular_type, standard_id, division_id, …`; ordered newest first; only circulars whose `division_id` equals the student's division (a circular with a null division is never shown — server behaviour, `:167`).

### 3.4 S1d — `POST studentCalenderAPI` (legacy)
`student_id`, `sub_institute_id`, `syear` required (else "Parameter Missing"); optional `action` filters `calendar_events.event_type` (`:303-313`). Returns `data: [{school_date, title, description, event_type}]` ordered by date — empty list for a non-existent student **[VERIFIED-LOCAL]**.
- `academic_calendar` → no `action` → all event types; `holiday_list` → `action: 'holiday'` (DB tile params + Flutter).
- Event types: `holiday`, `event`, `vacation` — the values S2's endpoint filters on (`studentAttendanceController.php:653-681`) and that the staff-side `calendar_controller::fetchData` validates (`type in:holiday,event,vacation`, `calendar_controller.php:93-98`, per ev:backend_routes_A.md §3 row 23). The full list stored in `calendar_events` was **not** checked; any other value is shown as an event.
- **Null rows (inferred, not run):** without `action` the query is `enrollment LEFT JOIN calendar_events`, so a student with an enrollment but **no matching events** yields one row of all `NULL`s (`:303-313`, SQL semantics). The parser drops rows without a valid `school_date` (the existing `dateKey` already does).

## 4. Authentication and user identity
- Dashboard: token-only (`api.session`); nothing user-supplied is sent. The `HomeScreen` already shows the generic dashboard for any role — S1a replaces it **only when `user.isStudent`**; staff keep the existing generic section unchanged.
- Legacy parts: F1 identity block from the session; a student cannot send another `student_id` (F1 §4.2). No id is ever read from route params, props or text input.
- Every screen: in-screen guard `if (!user?.isStudent)` → "Students only" and **no request** (same as S2); `user.syear` empty → "School year not set" and no request.
- Backend weakness (not fixable here): legacy endpoints do not compare `student_id` with the token (any valid token can read any student). Reported; the app only sends its own id.

## 5. Navigation and tile integration
```
Home tab ── HomeScreen ── Dashboard section ─ student? → StudentDashboard   (else existing generic)
                                              └ "View all" rows → open tile by screen_name (circular_events, home_work)
Menu/Home tile ─► Tile route ─► TileScreen (existing guard) ─► screenRegistry[screen_name]
      notification_hub → NotificationHubScreen      circular_events → CircularsScreen
      academic_calendar → AcademicCalendarScreen    holiday_list    → HolidayListScreen
```
- `screenRegistry` gets four entries (`registry.ts`, same mechanism as S2). Removing an entry restores today's fallback (`GenericDataScreen`).
- The dedicated screens call **fixed paths**, not `tile.api` (as S2), so a changed/empty DB value cannot break them.
- "View all" links use a tiny new hook `useOpenScreen(screenName)` that finds the tile in the already-loaded bootstrap menu and navigates to `Tile {key,title}`; if the tile is not in the user's menu the link is simply not shown (RBAC unchanged — `TileScreen` still re-checks).

## 6. UI design (mobile-first; existing kit and theme)
**S1a StudentDashboard** (top→bottom): class card ("Class 7 · A — 2026"); three stat cards (Subjects, Pending homework, Pending assignments); a progress bar "Tasks done / total" from `task_status` (two bars: homework, assignments; text values beside them — not colour-only); *Pending homework* list (title, "Due 12 Oct", overdue marked in text "Overdue"); *Pending assignments* list; *Recent circulars* (title, date, "View all"); *My subjects* chips (hidden when empty). Subject name shown beside a task only when `subject_id` matches an entry in `my_subjects` (otherwise omitted — no guessing).
**S1b NotificationHubScreen:** sections by day ("Today", "Yesterday", "12 October 2026"); card = type icon (existing `tileEmoji(type)`) + type label + description + time-ago-free date; `http(s)` links in text are tappable (`Linking`, scheme-checked); first 30 shown, "Show more" adds 30 (server returns everything; this bounds rendering).
**S1c CircularsScreen:** segmented control *Circulars | Events* (new tiny `Segmented` component, `Pressable`s, no library); cards collapsed to 3 lines, tap to expand; date; attachment button when `file_name` is present **and** passes the host check (§8).
**S1d AcademicCalendarScreen:** `MonthCalendar` (Monday first) + month event list below + day detail; month navigation bounded to the data and today (S2 model). **HolidayListScreen:** grouped by month, date-ordered; the next upcoming holiday scrolled into view is **not** in scope (plain list).
**States (all parts):**
| State | UI |
|---|---|
| loading, no data | existing `Loading` (dashboard: existing `Skeleton` cards, as today) |
| error, no data | `ErrorState` + Try again (dashboard: the existing non-blocking card, so the menu below still shows) |
| error while data cached | content stays + one-line banner "Couldn't refresh — showing the last loaded data" (same as S2) |
| empty | `EmptyState`: "No notifications yet", "No circulars published" / "No events announced", "No events in the calendar", "No holidays listed"; dashboard: `enrollment:null` → class card says "No class found for this school year" |
| circulars HTTP 500 | `ErrorState` with the hint "This can happen if you are not enrolled for the current school year." |
| dashboard 422 | message from the server ("Academic Term Date Expired") in the dashboard card |
| `syear` missing / not a student | same empty states as S2, no request |
| refreshing | pull-to-refresh on every screen; Home refresh also refreshes the dashboard query |
Accessibility: every row is one accessible element with a combined label; touch targets ≥ 44 dp; colour never the only signal.
**UX decisions to confirm:** S1-D1 the dashboard section is replaced (not added to) for students; S1-D2 `mobile_no` = `'0'`; S1-D3 server image URLs ignored; S1-D5 client-side "Show more" for notifications; S1-D6 links in notification text are tappable (http/https only).

## 7. Exact files that will change (all under `D:/lms_k12_mobile_rn`)
**Modified**
| File | Change |
|---|---|
| `src/api/student.ts` | **append** `fetchStudentDashboard`, `fetchNotifications`, `fetchCirculars(action)`, `fetchStudentCalendar(action?)` + tolerant parsers + types (S2's `fetchStudentAttendance` untouched) |
| `src/screens/registry.ts` | + 4 entries |
| `src/screens/HomeScreen.tsx` (`Dashboard` at lines 22-52, refresh at 86) | student → `<StudentDashboard/>`; pull-to-refresh also invalidates the dashboard queries |
| `src/screens/student/AttendanceScreen.tsx` | import `monthDays` from the new shared file instead of the private copy (**behaviour-neutral; S2's 11 screen tests cover it**) — decision S1-D4 |
**New**
`src/screens/student/calendarDays.ts` (moved `monthDays`) · `src/screens/student/dashboardModel.ts` · `StudentDashboard.tsx` · `notificationModel.ts` · `NotificationHubScreen.tsx` · `circularModel.ts` · `CircularsScreen.tsx` · `calendarModel.ts` · `AcademicCalendarScreen.tsx` · `HolidayListScreen.tsx` · `src/hooks/useStudentDashboard.ts` · `useNotificationHub.ts` · `useCirculars.ts` · `useStudentCalendar.ts` · `src/navigation/useOpenScreen.ts` · `src/components/Segmented.tsx` · `src/utils/dates.ts` (accepts `YYYY-MM-DD…` and `DD-MM-YYYY`, relative day labels) · `src/utils/links.ts` (find/validate http(s) links).
No `package.json`, native, Laravel or Next.js change. Layout follows D-03.
**Suggested build order inside S1 (one commit each, one approval):** S1d calendar → S1b notifications → S1c circulars → S1a dashboard + Home integration.

## 8. Security considerations
- Identity only from the session (F1); no ids from UI; students-only guards; no request without a school year.
- **All text from the server is rendered as plain `<Text>`** (titles, messages, descriptions). Links: only substrings matching `https?://…` become tappable; `javascript:`, `intent:`, `file:`, `tel:` etc. are never made tappable.
- **Attachments** (`file_name`): opened only after `resolveUrl()` (F1) accepts the host — an allow-listed ERP host is re-based onto the configured API host (so dev builds never open production files); anything else is not shown. No token is attached to the link (public storage URLs). Consequence: against a local server (`SERVER_NAME` = `127.0.0.1`, no port) attachments are hidden — not testable locally **[ASSUMPTION about local `SERVER_NAME`]**.
- **Remote images are not loaded** (notification `image`/`side_image`): no third-party fetches, no hotlinking, no tracking.
- Sensitive text (notifications can contain remarks about the student) is **not logged**, not persisted to disk (TanStack memory cache only, cleared on sign-out `App.tsx:26-27`, keyed by user).
- `mobile_no` placeholder avoids sending the student's phone number to an endpoint that ignores it.
- Server-side risks recorded, not fixable here: SQL built by string concatenation in `notificationHubAPI` (`:1755`); no ownership check; `notificationHubAPI` ignores the school. The app sends only numeric ids taken from its own login response.
- A single failing part must not break the others: each screen/query is independent; the dashboard failure never hides the menu (existing behaviour kept).

## 9. Tests
**Unit (Jest):** `dates` (both formats, invalid dates, relative labels Today/Yesterday with injected "now"); `links` (extracts http/https, rejects other schemes, trailing punctuation, no catastrophic backtracking on long input); `dashboardModel` (parse incl. `enrollment:null`, missing arrays, progress maths, overdue by date, subject-name lookup only on match); `notificationModel` (parse, day grouping, paging windows, unknown types, `Status` ignored); `circularModel` (parse rows, `message` object→string handling for the validation shape, attachment accepted/re-based/rejected); `calendarModel` (split by `event_type`, unknown → event, null rows dropped, month grouping for the holiday list); API functions (path, identity block, `action` values, **`mobile_no` is `'0'`**, success/`status:0`/401/403/422/500 mapping, dashboard read from `raw`).
**Component (RNTL):** each screen — loading, success, empty, error + retry, stale banner, `syear` missing, students-only (no request), per-user cache key; circulars — tab switch refetches with the other `action`, expand/collapse, 500 hint, attachment hidden for a foreign host; notifications — grouping headers, "Show more", link press calls `Linking.openURL` only for http(s); calendar — month navigation, day detail, holiday list order; dashboard — sections render from a fixture, hidden when empty, "View all" shown only when the tile exists; Home — student gets `StudentDashboard`, staff keep the generic dashboard; registry test extended with the 4 names.
**Regression:** all 100 existing tests pass unchanged (S2 screen tests cover the `monthDays` move); `npm run typecheck` clean.
**Local integration (opt-in, loopback-only, non-existent ids):** extend the existing guarded test: notification hub (id 0 → `[]`), calendar (id 0 → `[]`), circulars (id 0 → the `server` error, documenting the no-enrollment 500), dashboard with a non-existent student on a tenant that has a current year (→ empty summary).
**Not possible without real data / device:** seeing real notifications, circulars with attachments, a real enrollment, real dashboard numbers, layout on a device (§11, Q16).

## 10. Acceptance criteria
1. As a student, Home shows the new dashboard sections from `student-dashboard/summary`; staff still see the existing generic dashboard; a dashboard error never hides the menu.
2. The four tiles open the dedicated screens (not the generic dump); removing the registry lines restores the old behaviour.
3. Notification hub: newest first, grouped by day, text selectable/links tappable for http(s) only, "Show more" adds 30, never loads remote images.
4. Circulars: two tabs send `action=circular` / `action=event` form-encoded; a 500 shows the enrollment hint; attachments only for allow-listed hosts.
5. Calendar: month grid with Monday first, holidays/vacations/events marked and listed, null rows ignored; holiday list ordered by date.
6. Every state in §6 is reachable and correct (tested); no crash on `status:0`, an object-valued `message`, empty/null fields, unknown event types or notification types.
7. No request is made for a non-student or without a school year; no id is read from the UI.
8. `npm run typecheck` and `npm test` pass; no native/package change.
9. Local contract checks with non-existent ids pass (§9); the real-data check is **not** claimed and is recorded as pending Q16.

## 11. Dependencies, risks and rollback
- **Depends on:** F1 (legacy transport — form-encoding is required for circulars, verified), S2 (`MonthCalendar`, `attendanceModel` date/month functions, hook/screen/test patterns, registry). No dependency on S3-S10.
- **Risks:** (1) `circular_type` names unverified (Q17); (2) a circulars 500 is indistinguishable from a real server fault, so the hint is advisory; (3) notifications are unpaged on the server — a student with thousands of rows downloads them all; (4) dashboard pending-homework ignores the school year (server); (5) attachment links cannot be tested locally.
- **Rollback:** delete the four registry lines and the student branch in `HomeScreen.tsx` (or `git revert` the S1 commits); S2 and F1 are unaffected. The `monthDays` move is the only change to a done module — revert it with the same commit. JS-only; no server or data change.

## 12. Questions (answered 2026-10-07: Q17 yes, Q18 yes, Q19 yes; Q16 still open)
- **Q17** May I run a read-only `SELECT` on the lookup table `circular_type` (no student data) to confirm the names behind `action=circular|event`? Otherwise the circulars tabs ship on the Flutter literals and are verified only with real data later.
- **Q18** Approve S1-D1…D6 (§6) and the S1-D4 move of `monthDays` (touches S2).
- **Q19** Approve this document so S1 can be built in the order in §7, stopping for sign-off at the end.
- Reminder: the real-data check for S1 (and S2) stays pending until you confirm the database environment (Q16).


## 13. What was actually done (2026-10-07)
Built in the approved order: calendar → notifications → circulars → dashboard + Home. Everything is **uncommitted** in the working tree (commit only on your explicit approval).

### Q17 — the one approved SELECT
`select id, type from circular_type order by id` (lookup table, no student data) returned **`1 | Circular`, `2 | Event`**. A literal comparison `'circular' = 'Circular'` is true under the connection's collation, but the column's own collation was not checked, so the app sends the **exact stored names** `Circular` / `Event` (not Flutter's lowercase literals).

### Files (all under `D:/lms_k12_mobile_rn`)
**Modified (6)**
| File | Change as built |
|---|---|
| `src/api/student.ts` | appended `fetchStudentCalendar(action?)`, `fetchNotifications()`, `fetchCirculars(kind)`, `fetchStudentDashboard()`, `parseDashboard()` and their types; S2's `fetchStudentAttendance`/`parseAttendance` untouched |
| `src/screens/registry.ts` | + `academic_calendar`, `holiday_list`, `notification_hub`, `circular_events` |
| `src/screens/HomeScreen.tsx` | existing generic `Dashboard` renamed `GenericDashboard` (unchanged); new `Dashboard` wrapper renders `StudentDashboard` for `user.isStudent`, else `GenericDashboard`; pull-to-refresh also invalidates `['student-dashboard']` and `['dashboard']`. No test hooks left in the source |
| `src/screens/student/AttendanceScreen.tsx` | private `monthDays` removed, imported from `calendarDays.ts` (S1-D4); behaviour identical |
| `src/screens/student/attendanceModel.ts` | `dayLabel(key, d, includeStatus = true)` — optional third parameter (see deviation 3) |
| `__tests__/registry.test.ts` | now checks all five registered names |
**New (src, 21):** `utils/dates.ts`, `utils/links.ts`; `screens/student/` — `calendarDays.ts`, `calendarModel.ts`, `notificationModel.ts`, `circularModel.ts`, `dashboardModel.ts`, `gate.tsx`, `AcademicCalendarScreen.tsx`, `HolidayListScreen.tsx`, `NotificationHubScreen.tsx`, `CircularsScreen.tsx`, `StudentDashboard.tsx`; `components/` — `Segmented.tsx`, `LinkedText.tsx`; `hooks/` — `useStudentQuery.ts`, `useStudentCalendar.ts`, `useNotificationHub.ts`, `useCirculars.ts`, `useStudentDashboard.ts`; `navigation/useOpenScreen.ts`.
No `package.json`, native, Laravel or Next.js change; no new library.

### Deviations from the plan
1. **Circular `action` = `Circular` / `Event`** (exact `circular_type` names, see Q17) instead of the lowercase literals planned from Flutter.
2. **Extra shared files not listed in §7:** `useStudentQuery.ts` (one query hook with the student/year guard and per-user key, used by the four hooks), `gate.tsx` (the shared "students only / school year not set / loading / error" states and the stale banner), `LinkedText.tsx` (safe tappable links), `__tests__/helpers/kit.tsx` and `nodeFetch.ts` (test support). They only avoid copy-pasted guard code.
3. **`dayLabel` / `monthDays` gained an optional flag** so the academic calendar's screen-reader labels do not say "No attendance recorded" (found while testing; wording was wrong for a calendar). S2's default behaviour is unchanged and S2's tests still pass.
4. **Dashboard refinements:** counts of 10 show as `10+` and the progress bar is hidden when pending is capped (the server returns at most 10 pending items, so the real ratio is unknown); progress rows are matched by the server's exact labels and hidden if the labels change.
5. **`utils/dates.ts`** (accepts ISO and `DD-MM-YYYY`) is new; S2's `attendanceModel.dateKey` was left alone (no unrelated refactor).
6. **Circulars tabs stay visible** when a tab fails (error and retry appear below the tabs), so a failing tab never traps the student.
7. **Stat figures and bars use plain views**, no animated counters (as in S2), so they are testable and calm.

### Tests (Jest) — full suite: 26 suites, **238 tests: 232 passed, 0 failed, 6 skipped** (the opt-in local tests); `npm run typecheck` clean. Baseline before S1 was 100 passing.
| Suite | Tests | Covers |
|---|---|---|
| `dates.test.ts` | 9 | ISO and `DD-MM-YYYY`, impossible dates, digit-run edge, shifting across months/years/leap day, headings, never throws |
| `links.test.ts` | 9 | only safe http(s) links; refuses `javascript:`/`tel:`/`intent:`/`file:`/credentials-in-URL; parts always join to the original; long-text and adversarial-input guards |
| `calendarModel.test.ts` | 10 | event kinds, dropping all-NULL rows, de-duplication, ordering, day map, month grouping, label without attendance wording |
| `notificationModel.test.ts` | 8 | day grouping and headings, unknown dates → "Earlier", page limiting (30) |
| `circularModel.test.ts` | 5 | attachment host rules: production link re-based onto the API host, foreign/look-alike/credential hosts refused, bare names, non-http schemes |
| `dashboardModel.test.ts` | 8 | `10+` cap, due labels (today/future/overdue), subject lookup only on match, progress ratio and its cap rule, class label |
| `studentHomeApi.test.ts` | 18 | each endpoint's path, form-encoding, identity block, `mobile_no` = `0`, image/Status ignored, `action` names, 500/403/422/401/"Parameter Missing" mapping, dashboard read from the top-level payload, tolerant parsing |
| `AcademicCalendarScreen.test.tsx` | 11 | grid and month list, labels, day detail, navigation clamped, empty month, unknown event type, empty/error/retry/stale, guards |
| `HolidayListScreen.test.tsx` | 8 | `action=holiday`, month grouping and order, non-holiday rows excluded, empty/error/stale, separate cache, guards |
| `NotificationHubScreen.test.tsx` | 12 | grouping, "Show more" (30 then all), tappable http(s) links only, no remote images, Earlier, empty/error/stale, per-user cache, guards |
| `CircularsScreen.test.tsx` | 13 | exact `Circular`/`Event` requests, tab switching, expand/collapse, attachment open (re-based) and refusal cases, 500 hint (only for 500), retry, stale, untitled/unreadable date, guards |
| `StudentDashboard.test.tsx` | 13 | sections from a fixture, due words, subject-only-when-own, `10+`, "View all" only for menu tiles and opening them, `enrollment: null`, compact error with retry (never blocks Home), stale notice, per-user cache, non-student renders nothing and makes no request |
| `HomeScreen.test.tsx` | 4 | student gets the new dashboard (generic summary not requested); teacher and admin keep the generic dashboard; pull-to-refresh refreshes the menu and both dashboard queries |
| `useOpenScreen.test.tsx` | 3 | `canOpen` only for listed tiles, `open` navigates with key/title, does nothing for an unlisted screen |
| `registry.test.ts` | 3 | all five registered names; no staff names claimed |
| existing suites | unchanged | F1/S2 suites (client, envelope, url, legacyTransport, studentApi, attendanceModel, AttendanceScreen, permissions, apiParam) all pass; `calendarModel`'s check of the shared `monthDays` helper also pins S2's label wording |
| `studentHome.local.test.ts`, `attendance.local.test.ts` | 5 + 1 (opt-in) | see verification below |

### Acceptance criteria (§10)
| # | Criterion | Result |
|---|---|---|
| 1 | student Home shows the new dashboard; staff unchanged; a dashboard error never hides the menu | ✅ Home + dashboard tests (compact card, not a full-screen state) |
| 2 | the four tiles open dedicated screens; removing registry lines restores the old behaviour | ✅ registry test; ⚠️ not seen on a device/emulator |
| 3 | notifications: newest first, grouped, http(s)-only links, "Show more" +30, no remote images | ✅ tests |
| 4 | circulars: two tabs, form-encoded `Circular`/`Event`, 500 hint, attachments only for allow-listed hosts | ✅ tests + local check that form-encoding reaches the lookup |
| 5 | calendar: Monday first, kinds marked and listed, null rows ignored; holiday list ordered | ✅ tests |
| 6 | every state reachable and correct; no crash on `status:0`, object message, empty/null fields, unknown types | ✅ tests |
| 7 | no request for a non-student or without a school year; no id read from the UI | ✅ tests on every screen |
| 8 | typecheck and tests pass; no native/package change | ✅ |
| 9 | local contract checks with synthetic ids pass; real-data check **not** claimed | ✅ synthetic ids only; real data pending Q16 |

### Verification against the local server (read-only, synthetic ids only — Q16)
`php artisan serve --host=127.0.0.1 --port=8000`; JWTs signed locally with the app's secret (student id 0 / tenant 0 for legacy endpoints; non-existent student `999999999` on a real tenant for the dashboard, because `api.session` rejects an empty id or tenant). The opt-in tests drive the **real client and fetch functions over real HTTP**:
| Check | Result |
|---|---|
| `notificationHubAPI` with `mobile_no=0` | success, empty list ✅ (without `mobile_no`: "Parameter Missing" ✅ earlier probe) |
| `studentCalenderAPI` with and without `action=holiday` | success, empty lists ✅ |
| `circular/fetchData` form-encoded, both kinds | HTTP 500 → `server` error with status 500 ✅ (documented no-enrollment behaviour: `Undefined array key 0`, `circularController.php:153`) |
| `circular/fetchData` with a **JSON body** | HTTP 500 at `circularController.php:123` (`Undefined array key "sub_institute_id"`) ✅ — proves F1's form-encoding is required |
| `student-dashboard/summary`, non-existent student on a real tenant | success: `enrollment: null`, zero counts, four `task_status` labels exactly as the model expects ✅ |
| same, bad token | `unauthorized` ✅; unknown tenant → 422 "Academic Term Date Expired" ✅; non-student token → 403 ✅ (earlier probes) |
| opt-in test with `https://erp.triz.co.in` as base | refuses to run ✅ |
Server stopped afterwards (port 8000 free). The only database access was SELECTs through the app for non-existent ids, plus the single approved `circular_type` SELECT.

### Known limitations
- **No real student data was read** (Q16): real notification text, circular messages and attachments, real class/subject/homework numbers, and the server's `Status` and `circular_type` use in practice are unverified. Attachment links cannot be exercised locally (the server builds them from its own host name, which is not the API host).
- **Not run on a device or emulator:** layout, the pull gesture and 44 dp targets are styles asserted by tests, not measured.
- **Pre-existing dependency problem found, not fixed:** `expo-asset` is installed only under `node_modules/expo/node_modules`, so `expo-font` (used by `@expo/vector-icons`, which `RootNavigator`/`TileList` already import) cannot resolve it from the top level. It makes any Jest test that imports those icons fail ("Cannot find module 'expo-asset'"); the Home test therefore mocks `@expo/vector-icons`. **Whether the app bundles on a device is unverified** — if it does not, `npx expo install expo-asset` is the fix and needs your approval (new direct dependency).
- The Home refresh test reads `onRefresh` from the React fiber (RNTL hides function props on host elements); it is test-only and brittle to React internals.
- Server-side limits that the UI works around or shows honestly: notifications are unpaged (client "Show more" only limits rendering); pending counts are capped at 10 and ignore the school year; `my_subjects` may be empty; circulars with a null division are never returned; the `Status` column is unexplained so no unread badge; an enrollment with no events can return one all-NULL calendar row (inferred; dropped by the model).
- A circulars HTTP 500 cannot be told from a real server fault, so the enrollment hint is advisory.
- Weeks start on Monday (one constant, `WEEK_STARTS_ON`).
- jest-expo stubs `fetch`; unit tests mock `text()` and only the opt-in tests make real HTTP calls.

### Rollback
1. Remove the four S1 lines from `src/screens/registry.ts` (tiles fall back to `GenericDataScreen`, today's behaviour) and the student branch in `HomeScreen.tsx`'s `Dashboard` wrapper — or `git revert` the S1 commit(s) once committed. 2. The `monthDays` move and the `dayLabel` optional parameter are behaviour-neutral for S2; revert them in the same commit. 3. F1 and S2 are unaffected. JS-only; once EAS Update is configured, `eas update:rollback` also works. No server or data change was made.
