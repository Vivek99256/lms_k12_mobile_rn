# 01 — Understanding of the three codebases (step 1)

Date: 2026-10-07. Facts cite file:line (paths relative to each repo). Assumptions are marked **[ASSUMPTION]**. Details and more citations: [evidence/](evidence/README.md).

## A. Mobile repo (`D:/lms_k12_mobile_rn`, "Teach Connect")

**State.** Git: one commit ("Initial commit"); `src/`, `App.tsx`, `__tests__/`, `app.config.ts`, `eas.json`, README are **uncommitted/untracked**, `app.json` deleted. Baseline verified today: `npm run typecheck` clean; `jest` 4 suites / 20 tests pass.

**Stack** (`package.json`): Expo ~57, React Native 0.86.3, React 19.2.3, TypeScript strict, React Navigation 7 (native-stack + bottom-tabs), TanStack Query 5 (server state), Zustand 5 (auth session only), expo-secure-store, expo-updates (EAS Update, fingerprint runtime), expo-linear-gradient, `@expo/vector-icons`, Inter font, Jest + Testing Library. No form, file-picker, camera, date-picker, chart, push or WebView library installed.

**Structure** (`src/`): `api/` (client, envelope, errors) · `auth/` · `config/` (env, theme) · `menu/` (menuApi, buildMenu, types) · `rbac/permissions.ts` · `navigation/` (RootNavigator, TileScreen) · `screens/` (Home, Login, Menu, Profile, `registry.ts`, `shared/`) · `components/` (ui, DataView, TileList, motion) · `hooks/useBootstrap.ts` · `updates/` · `utils/`. Tests in `__tests__/` (api, envelope, permissions).

**How it works today**
- Login: `POST api/api-login` `{email,password,type:'API'}` → `data.user_token` stored in SecureStore (`auth/authStore.ts:31-42`). No refresh/logout; 401 or `status:'2'` signs out.
- Every request (`api/client.ts:48-103`): adds `type=API&sub_institute_id&syear` (query for GET, body for others), `Authorization: Bearer`, and also `token` in query/body. `normalizeEnvelope` (`api/envelope.ts`) collapses the backend's envelope families into one result or a typed `ApiError`.
- Menu = RBAC: `GET api/mobile/bootstrap` (fallback to legacy `homescreen`/`teacher_homescreen` on 404) returns sections→tiles; `buildMenu` → tiles keyed `section/title`. `TileScreen` is the single gate (`canAccessScreen`); renders by `render_type`: `webview` → `WebHandoffScreen` (single-use ticket, opens system browser), else `screenRegistry[screen_name]` (**currently empty**, `screens/registry.ts:10`), else `GenericDataScreen` (generic `DataView` of whatever JSON) if the tile has an `api`, else "Coming soon".
- Home: role dashboard `student-dashboard|teacher-dashboard|admin-dashboard/summary` (`utils/helpers.ts:2-6`).
- UI kit exists: `Page, Loading, ErrorState, EmptyState, Card, Button, Field, Screen` (`components/ui.tsx`), motion helpers, theme tokens copied from the web (`config/theme.ts`).

**Discrepancies found in the repo (not fixed)**
1. `AGENTS.md` instructs "Use Expo Router … routes in `src/app/`", but the code uses React Navigation and has no `src/app/`. → D-02.
2. `package.json` `typescript ~6.0.3`, `jest ~29.7` etc. are as installed; nothing wrong, noted only because AGENTS.md says to read the Expo version before coding (Expo 57 docs).
3. `.claude/settings.json` in this repo has permissions that reference another project's scratchpad paths (harmless).

## B. Laravel backend (`D:/next_lms_erp`, read-only)

**Scale.** ~7.5k lines of routes in 40 files; 964 routes in the 22 API-ish files surveyed alone. Laravel 12.69.2.

**Four kinds of API surface** (registration: `app/Providers/RouteServiceProvider.php:58-131`):
1. **Modern token-bound JSON** (`api.session` middleware: JWT → in-memory session from the *token*, not the body — `HydratesLegacyApiSession.php:25-45,73-75`): `routes/api.php` (450), `resultapi.php` (185), `easycomapi.php` (36), `g2g_lms.php`, `task_management.php`, `talent/competency/organization_management.php`, `pal_api.php`, `pal_eso_api.php`, `mobile_page_builder.php`, `api_hostel.php`, `documents.php`.
2. **Legacy `*API` POSTs** that validate the JWT signature inside the controller and trust tenant/user fields from the **body**: `routes/teacherapi.php` (34) and `adminapi.php` (63) — registered with **no prefix and no middleware** (`:390-399`); and the classic student/parent routes `routes/student.php:179-243`, `lms.php:356-372`, `fees.php:327`, `web.php:353,475-476`, `cal.php`, `ptm.php`, `consent.php`.
3. **Blade resource routes** (web group) that answer JSON only when the request carries `type=API` + Bearer (`SessionMiddleware.php:22-37`, `Helper.php is_mobile():27-60`): most of student/fees/result/admission/inventory/hrms/hostel/frontdesk setup & reports.
4. **Pure-web/Blade only** → web handoff.

**Auth (decisive facts)**
- `POST /api/api-login` (`api.php:95`, throttle 20/min) takes `email` (email-format), `password`, `type`; looks up staff (tbluser) then student (tblstudent); returns `{status:1, data:{…, user_token, erp_rights, user_profile, user_profile_id, sub_institute_id, mobile_syear, is_admin, client_id…}, academicTerms, academicYears, subjects}`. Failures `status:0` with 422/401/403 (`ApiLoginController.php:24-477`).
- JWT payload `{id, sub_institute_id, is_admin, client_id, user_profile_id, is_student}`; **no expiry unless env `JWT_TTL_MINUTES>0`** (`:426-432`). No refresh, no logout endpoint.
- **Parent/OTP logins issue a different token** `{student_id, sub_institute_id}` — no `id`, no `exp` (`apiController.php:336-343`) — which `api.session` and `RequireApiJwt` reject ("Invalid token payload"). Teacher/admin OTP tokens likewise (`teacher_check_otp` `:531-536`, `adminapiController.php:148-153`). Parents have no account of their own; they log in by the student's mobile number (OTP flow) and receive all children in `data[]`.
- Tenant/role are text/tenant-specific: roles are per-tenant `tbluserprofilemaster` names (Admin, Teacher, Student, Parent, Super Admin synthetic when `is_admin` 1/2). Rights: `tblgroupwise_rights` + `tblindividual_rights` (individual overrides group); menu from `tblmenumaster` (`link` = route name).
- `config/api_guard.php` + `RequireApiJwt` (`api.jwt`) enforce a JWT only for listed `api/*` URL patterns; student/parent tokens are blocked on the `staff` list. teacherapi/adminapi are never covered (no `api/` prefix).

**Response envelopes: at least six families** (evidence/backend_routes_A.md §2.3): legacy `{status:'1'|'0'|'2',message,data}` (token failure sometimes HTTP 200), `{status_code,message,data,errors}`, `{success,message,data,errors,meta}`, `{status,message,summary…}` dashboards, `json_encode` strings served as text/html, OTP `{status,data:[…]}`. Validation = 422 in some families, HTTP 200 `{response:{field:[msg]}}` in others. The existing `normalizeEnvelope` already handles most; verify per module.

**Mobile-specific endpoints**: `GET /api/mobile/bootstrap` (`api.php:100`, uncommitted in Laravel), `POST /api/mobile/web-handoff` (`:106`; 60 s single-use ticket → ERP Blade or Next.js `/mobile-bridge`), `GET /api/mobile/dynamic-page/{pageKey}`, `/api/mobile-page-builder/*`, `POST /api/gcm_insert` (only push-token registration; body `mobile_no`,`sub_institute_id`,`gcm_regid`…; no unregister), `POST /api/playscreen` (app-version JSON). `MobileFormFieldRegistry` (uncommitted) lists form schemas for add_student, edit_student, attendance, house, quota, discipline, height/weight, health, vaccination, infirmary.

**Where the menu's `screen_name` values come from: not found in code** (backend survey; exact folders searched not recorded — re-check before relying on it). They are per-tenant DB rows (`mobile_homescreen`, `teacher_mobile_homescreen`; template tenant `sub_institute_id=1`), only Admin/Teacher/Student profiles configurable. → needs DB read (D-05/Q4).

**Mobile-suitable JSON by module** (full list in evidence)
| Area | Student/parent | Teacher | Admin/staff |
|---|---|---|---|
| Dashboard | `student-dashboard/summary` (api.php:162) | `teacher-dashboard/summary` (:159) | `admin-dashboard/summary` (:158) + 5 module dashboards (:149-153) |
| Homework/assignments | `lms-homework/list|detail|my-submissions|submission/store`, `lms-assignment/submission-list|store` (api.php:283-310,374-375) | `lms-homework/store`, `review-*` (:284,313-317) | – |
| LMS/learning | `lms-courses`, `lms-chapters`, `lms-chapter-content`, `pal_eso_api.php` (best fit for adaptive learning), `lms/pal/*` | `g2g_lms` (staff only) | – |
| Results/exams | `result/current-result`, `all-results` (resultapi.php:244-251), `studentExamScheduleAPI` | marks entry `result/marks-entry/*` (:193-200) | result admin |
| Attendance | `studentAttendanceAPI` (student.php:179, legacy) | `/api/attendance/*` (token via body), student attendance in student.php | graphs (broken, see risks) |
| Timetable | `studentTimetableAPI` (web.php:475-476, legacy) | `teacher-timetable/summary` (:160), `get_teacher_timetablewise*` | – |
| Fees | `studentFeesDetailAPI` (fees.php:327, session+check_permissions), online-pay init (fees.php:116-133, `api.session`) — gateway callbacks are HTML → webview | `teacher-fee-dues/summary` | `fees-dashboard/summary|defaulters` (:142,145) |
| Communication | notices/circular & parent-communication legacy (student.php) | same | `easy_com/*` (easycomapi.php) |
| Calendar/PTM/consent | `studentCalenderAPI`, `ptm*API`, `consentListAPI` | `get_teacherPTMBookingList`… | – |
| HR self-service | – | `hrms/today|punch|attendance|leaves` (api.php:135-138), `leave/*` | HR modules (talent/competency, staff only) |
| Tasks | – | `task-management/*` (staff only, clean JSON) | same |
| Transport/hostel/library/inventory/admission | only admin-style endpoints found (hostel-setup, transportation-setup, `*-dashboard/summary`) | – | mostly Blade → web handoff |

**Backend risks that affect mobile (cannot be fixed here; record only)** — evidence/backend_routes_A.md §5, backend_auth.md:
- Identity taken from the request body even with a valid token (homework list, result `current-result`, leave/attendance `user_id`, `lms-chapters`, adminapi/teacherapi tenant & user).
- Some endpoints with no auth (`/calendar/fetchData`, `/api/v1/documents*` defaulting to user 1/school 1, `/teacherListAPI`, `/get_Syear`); `easy_com` send endpoints reachable by a student token.
- OTP echoed in the `check_otp` response and hard-coded test OTPs; teacher/admin login throws on unknown mobile.
- `get_feesGraphAPI` hard-codes a 2019 date; `get_attendanceGraphAPI` ignores `date`.
- `MobileBootstrapApiController.php:61-63` prefixes the host onto every `web_url` including `native_dynamic` page keys; Banner rows folded into `contents`.
- Mobile build must therefore not rely on the backend to enforce *UI* role limits; hide by menu **and** expect 403s.

## C. Web app (`D:/lms_k12`, read-only)

**Stack.** Next.js 16.3.6, React 19. Plain `fetch` (no SWR/React Query/axios). shadcn/radix UI, recharts + chart.js, tiptap (only rich-text editor), jspdf, react-day-picker/date-fns. 1045 `page.tsx`.

**Calling the backend** (3 patterns): direct `${baseUrl}/api/...` with Bearer (`lib/erp-client.ts`); via Next relay `/api/proxy?path=` (`app/api/proxy/route.ts`) for legacy controllers (`legacyRequest`, `lib/erp-legacy.ts:158`: body `status '0'|'2'` = failure); Next route handlers `app/api/*` (69; fees 22). Legacy controllers get `type=API&sub_institute_id&syear&user_id[&term_id]` — same convention the RN client already implements.

**Auth/roles on web.** Login `POST /api/api-login` (`contexts/AuthContext.tsx:221`); token in localStorage `userData.user_token`; no 401 handler; 30-min inactivity logout. Sidebar is fully server-driven: `POST /api/menu-rights` (`app/hooks/useMenuRights.ts:131`) → level 1/2/3 tree; per-action rights `GET /api/permissions?modules=` (advisory). Dashboard only has 3 buckets (teacher/student/admin-fallback — `app/dashboard/_lib/resolveDashboardRole.ts`); **no parent UI on web**. Academic year/term is a single global selector (`Header.tsx`), class filters via `GET api/class-teachers`.

**Module size (pages):** h5p 57 (authoring) · pal 56 · fees 51 · lms 42 · student 35 · enterprise-brain 33 · hostel 28 (each module duplicated hyphen/underscore) · result 25 · Inventory 23 (config-driven wrappers) · admin-services 22 · admissions 18 · easy_com 16 · hrit 15 · Transportation 15 · front_desk 14 · general 14 · library 13 · ai 12 · students 12 · task-management 11 · talent-management 11 · teach-learn 11 · people-competency 9 · ≈30 smaller. Full table: evidence/web_modules.md.

**Hard on mobile (web-only candidates):** admin setup/masters (general/*, academic_setup, fees/master, result/master, inventory/transport/hostel masters, user/*), heavy export/print reports (fees reports XLSX, student reports, payroll), document builders (tiptap + dnd + jspdf), drag-drop/graph editors (import-data, xyflow pages, h5p authoring), report-card/ID-card/certificate printing, enterprise-brain & ai-stack consoles. No maps anywhere on web.

**Dead/duplicate on web:** hostel hyphen/underscore pairs, `Utility/student-transfer` vs `transfer-student`, `student` vs `students`, `organization-management` vs `organization_managment`, `documents` vs `documents_new`, empty `frontdesk`/`exam-assessment`, static showcase pages (ai-platforms, ai-journey, platform-roadmap). Counted once in the module plan.

**Mobile bits already in web:** `/mobile-bridge` (ticket → session), admin `general/mobile_app_rights` & `native_dynamic_pages`; page builder removal staged-uncommitted (28 files). No PWA, no push/FCM code.

## D. What we could not establish (and what would settle it)
| Gap | Searched in | To settle |
|---|---|---|
| Actual `screen_name`/`api` values per role | backend code (per survey) | read-only query of `mobile_homescreen`/`teacher_mobile_homescreen` (Q4) |
| Parent experience (web has none; backend: OTP login only, token incompatible with api.session) | web app/, AuthContext, backend auth | product decision (Q2) |
| Auth on `/api/attendance/*`, `check_permissions` effect on unnamed routes | routes/api.php, middleware | test against a dev server during the relevant module |
| Production base URL for teacherapi/adminapi ("bare" vs `/api`) | RouteServiceProvider:390-399 vs `MobileFormFieldRegistry` comments "relative to /api" | confirm against dev server before building teacher/admin legacy modules |
| Legacy student endpoint request/response shapes (student.php:179-243 etc.) | not yet opened — surveyed only as route list | done per sub-module in step 3 docs |
| Push notifications (server side sends?) | api.php `gcm_insert`, grep FCM | check `gcm_users` consumers before building push |
