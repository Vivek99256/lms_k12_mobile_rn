# 03 — Modules, sub-modules, classification and build order (step 2)

Date: 2026-10-07. Status: **PROPOSED — awaiting approval.** No code depends on this yet.
Sources: [evidence/](evidence/README.md). Facts cite evidence files (`ev:` = `docs/migration/evidence/`) which in turn cite file:line in the Laravel / Next.js / Flutter repos. Anything not read from code is marked **[ASSUMPTION]**.

## 0. What changed our understanding since step 1
1. **The real mobile feature set exists in data.** Read-only SELECTs (user-approved) on `mobile_homescreen` and `teacher_mobile_homescreen` show what schools actually enable today: student menu = 34 tenants, ~48 distinct tiles; staff menu = 38 tenants with profiles Teacher (1064 rows), Admin (559), ICT (14), School Admin (13). Output: [ev:menu_tiles.txt](evidence/menu_tiles.txt), query: [ev:menu_tiles_query.php.txt](evidence/menu_tiles_query.php.txt). Only rows with `status='Yes'` were counted (`status` is `Yes`/`No`, not 1/0).
2. **Most mobile screens are served by legacy endpoints, not `/api/*`.** Student/teacher tiles call `https://erp.triz.co.in/<bare path>` (e.g. `studentAttendanceAPI`), registered in the web group or with no middleware — see ev:student_tiles_backend.md, ev:teacher_tiles_backend.md.
3. **Several of those legacy endpoints are broken or unsafe on the backend** (listed per sub-module below). We cannot fix them (Laravel is read-only) — they become *blocked* items with a backend ask, not silent drops.
4. **The Flutter app is a reference, not proof.** Its own docs say the endpoints were ported from the old app and never run against a live server (`ev:flutter_ref.md`, caveat at top). Its README is stale. I used it only to learn which endpoint a screen calls and field names, then verified on the backend.
5. Q6 (dev server for probes) was left as the unfilled template in your reply, so I treat it as **NO**: everything here is from code. Verification of built screens will need an API to call — see Open Questions.

## 1. Classification rules (proposed — change them if you disagree)
| Class | Rule |
|---|---|
| **V1** | Appears in the production mobile menu of **≥ 5 tenants** for that role (from the DB query), OR is a platform necessity (login, home, profile, menu), AND a backend path exists that a token from `/api/api-login` can use. |
| **V1-blocked** | Meets the V1 usage rule but the backend path is missing/broken. Stays in V1 scope, **cannot be built until a backend fix or a decision**; flagged ⛔ with reason. |
| **Later** | Used by < 5 tenants today, or no menu row exists but the web app has it and a clean API exists (candidate for V1.1). |
| **Web-only** | Admin set-up/masters, builders, heavy reports/print, authoring, consoles. Reason is recorded; reachable through the existing web-handoff (D-07) where a web page exists. |

Priority inside V1 follows your order: **Student → Teacher → Admin**. Parents: out of V1 (Q2).

## 2. Constraints that apply to every module (design inputs)
| # | Constraint | Evidence | Consequence |
|---|---|---|---|
| C1 | Legacy endpoints are bare paths, not `/api/...`; the `api.jwt` guard never applies to them | ev:student_tiles_backend.md "Global facts"; ev:teacher_tiles_backend.md §0 | auth = "valid JWT signature"; tenant/user come from the request body. App must send the signed-in user's ids (D-09) |
| C2 | Web-group POSTs need a CSRF exemption: exempt only for `https://erp.triz.co.in/*`, `https://dev.triz.co.in/*`, `http://127.0.0.1:8000/*`, plus paths `circular/*`, `api/*`, `fees/*` (`app/Http/Middleware/VerifyCsrfToken.php:20-26`, verified). `teacherapi`/`adminapi` routes are outside the web group (no CSRF) | verified | Dev builds must point at dev.triz.co.in / erp.triz.co.in; a LAN or `localhost:8000` base URL returns **419** for most legacy endpoints |
| C3 | Tile `api` values are absolute `https://erp.triz.co.in/...` URLs stored in the DB; `GenericDataScreen` passes absolute URLs through unchanged (`src/api/client.ts:39-45,117-121`) | menu_tiles.txt; client.ts | A dev build (`EXPO_PUBLIC_API_BASE_URL=https://dev.triz.co.in`) would call **production** for tile endpoints. Proposal D-13: re-base tile URLs onto `env.apiBaseUrl` (keep the path) |
| C4 | Some controllers read `$_REQUEST`, which does not parse JSON bodies (`ev:backend_routes_A.md` §3 row 41 note; Flutter always sends **multipart** with an identity block, `ev:flutter_ref.md` auth section, `legacy_api.dart:32-77`) | | The current RN client posts JSON (`client.ts:69-72`). Proposal D-12: add a form/multipart transport option (uses built-in `fetch`/`FormData`, no new library) and a standard identity block |
| C5 | Many legacy endpoints skip auth unless `type=API` is sent (`studentResultPDFAPI`, `studentLeaveApplicationAPI`, `studentParentcommunicationListAPI`, `fees/PaidUnpaid` needs it to hydrate the token session) | ev:student_tiles_backend.md caveat 2 | Client always sends `type=API` (already the default in `client.ts:55-58`) |
| C6 | ≥ 6 response envelopes; validation failures often HTTP 200 with only a `response` key (no `status`); auth failure sometimes HTTP 200 `status:'2'`; JSON served as `text/html`; `status` **or** `status_code`; `data` can be an object keyed by id/title or a single object | ev:student_tiles_backend.md caveats 5-7; ev:teacher_tiles_backend.md caveat 6 | Extend `normalizeEnvelope` (`src/api/envelope.ts`) — it currently treats a `response`-only body as success. Parse body as text → JSON regardless of content-type |
| C7 | api-login tokens carry `id` (`tblstudent.id` for students, `tbluser.id` for staff) and **never expire** unless `JWT_TTL_MINUTES>0` (`ApiLoginController.php:426-432`); `syear` is not in the token — use `data.mobile_syear` | ev:student_tiles_backend.md global facts | Student `student_id` = login `data.id`; app already stores it |
| C8 | `api.session` routes return **422 "Academic Term Date Expired"** when the school has no current academic year row; `fees/PaidUnpaid` too | ev:backend_routes_A.md §2.2; ev:student_tiles_backend.md | UI needs a clear "school year not configured" state |
| C9 | Uploads have **no** size/type validation server-side; field names differ per endpoint | ev:flutter_ref.md §7, teacher_tiles_backend.md caveat 7 | App enforces limits itself (e.g. 10 MB / pdf-jpg-png where the modern API says so: `HomeworkSubmissionApiController.php:274-281`) |
| C10 | Push: only `POST /api/gcm_insert` (token registration); no FCM sender/consumer found in the Flutter app; pull-based `notificationHubAPI` is the only notification feature in use | ev:flutter_ref.md "Push / FCM" | Notification Hub = list screen in V1; real push = Later (needs server work to confirm) |
| C11 | Students and parents share `student_id` identity; the mobile role is derived from `user_profile_name` (`Student`/`Teacher`/`Admin`/…) | ev:flutter_ref.md auth; `utils/helpers.ts:2-6` | Role routing already exists; ICT / School Admin profiles use the staff menu |

## 3. Module map and classification
Legend — **Evidence** column = where the endpoint/route is documented. ⛔ = V1-blocked (reason given). *Tenants* = number of tenants whose menu enables the tile (of 34 student / 38 staff).

### 3.0 Foundation (prerequisites for everything; all V1)
| ID | Sub-module | Scope | Reuses / changes | Depends |
|---|---|---|---|---|
| F1 | Legacy transport + envelope | form/multipart option, identity block (`student_id/teacher_id/user_id/user_profile_id/...` from session), tile-URL re-basing (C3), tolerant envelope (C6), text-first JSON parse | extends `src/api/client.ts`, `envelope.ts`; tests in `__tests__/` | – |
| F2 | Tile resolver | fill `screenRegistry` by `screen_name`; aliases (e.g. `facility` = `facilities`; `rules` = `rules and regulations`); keep `GenericDataScreen` fallback; client-side handling of bootstrap quirks (host prefixed onto every `web_url` incl. `native_dynamic` keys — ev:backend_auth.md §5) | `src/screens/registry.ts`, `TileScreen.tsx` | F1 |
| F3 | List/detail/form UI kit | status chip, key-value row, date field, attachment row (open file via `Linking`), pull-to-refresh, empty/error/"year not configured" states | extends `components/ui.tsx` | – |
| F4 | Class pickers (staff) | academic term/year, standard → division → subject pickers (`/api/academic-terms`, `get_teacher_timetablewise{Standard,Subject,Division}` for teachers; `/get_adminSubject` etc. for admin — ev:teacher_tiles_backend.md) | new hook `useClassPickers`, endpoints in `src/api/academic.ts` | F1, F3 |
| F5 | File pick/upload/open | camera/photo/document picker + `FormData` upload + progress | **needs library approval** (D-08): `expo-image-picker`, `expo-document-picker` | F1 |

### 3.1 Student (priority 1)
| ID | Sub-module | Tiles / screen_name (tenants) | Backend path (route → auth) | Class |
|---|---|---|---|---|
| S1 | Home & notices | dashboard; `notification_hub` (34); `circular_events` (34); `academic_calendar` (25), `holiday_list` (31) | `POST api/student-dashboard/summary` (api.php:162, api.session); `notificationHubAPI` (student.php:231); `circular/fetchData` (student.php:225); `studentCalenderAPI` (cal.php:21) — all signature-only, ids from body | **V1**. Notes: circular needs `action`, hub needs non-empty `mobile_no`, circular 500s for a student with no enrollment that year |
| S2 | Attendance | `student_attendance` (31) | `studentAttendanceAPI` (student.php:179) → `{attendance_data[], calendar_data{holiday,event,vacation}}` | **V1** (smallest: first vertical slice) |
| S3 | Timetable & exams | `time_table` (31), `exam_schedule` (17) | `studentTimetableAPI` (web.php:476; client must re-sort weekdays), `studentExamScheduleAPI` (student.php:182) | **V1** |
| S4 | Homework & assignments | `home_work` (34) | S4a list: `studentHomeworkAssignmentAPI` (student.php:234, needs `action`). Modern alternative with token-bound identity: `lms-homework/my-submissions|detail/{id}` (api.php:306-310). S4b submit: `lms-homework/submission/store` multipart `files[]` pdf/jpg/png ≤10 MB, 1-5 files (api.php:307) | **V1** (S4a), S4b V1 after F5 |
| S5 | Results & reports | `result_pdf` (22+1), `wrt_progress` (10) | `uploadResultAPI` (result.php:133), `studentResultPDFAPI` (result.php:214; needs `term_id`; SQL-concat + heavy PDF generation + clobbers shared folder), `get_wrtreportAPI` (adminapi.php:93; returns one PDF URL; HTTP-200 `status:'2'`) | **V1** (PDF opens via `Linking`). Backend warnings recorded |
| S6 | Fees | `fees` (28) | S6a: `fees/PaidUnpaid` (fees.php:258; **must send `type=API`**; school from token; returns summary) and `studentFeesDetailAPI` (fees.php:327; session+check_permissions) for detail; S6b receipt PDF `/ajax_PDF_FeesReceipt` returns a quoted URL string (ev:flutter_ref.md); S6c online payment | S6a/S6b **V1**; S6c payment → **web-handoff** (gateway callbacks are HTML — ev:backend_routes_B.md fees). **Do not** build pay-by-token: `fees/get_online_receipt` has no auth (ev:teacher_tiles_backend.md caveat 2) |
| S7 | Leave & communication | `leave_application` (30), `parent_communication` (30), `subjects` (34, subject teachers) | list `studentLeaveApplicationAPI` (student.php:186, only authenticated with `type=API`); **submit is a different route** `POST front_desk/leave_application/add_leave_application` (student.php:224; `title`,`message`,`from_date`,`to_date` Y-m-d; file `attechment`); `add_communicationAPI` (student.php:235, needs `type`) + `studentParentcommunicationListAPI` (student.php:243); `studentTeacherListAPI` (student.php:180) | **V1** (leave submit with attachment after F5) |
| S8 | Learning (LMS) | `lms_subject` (7), `social_collabrative` (10), `live_lecture` (7), `leaderboard` (3), `portfolio` (3), `virtual_classroom` (3) | `studentSubjectAPI`/`studentSocialCollabrativeAPI`/`studentLeaderBoardAPI`/`studentPortfolioAPI`/`studentVirtualClassroomAPI` (lms.php:356-365); content list `studentContentAPI` (Flutter, **backend route not yet read** — step 3) | `lms_subject`, `social_collabrative`: **V1**; `leaderboard`, `portfolio`, `virtual_classroom`: **Later** (3 tenants); `live_lecture`: ⛔ no endpoint (menu row has the base URL as api) |
| S9 | My records | `health_details` (12), `height_weight` (13), `student_infirmary` (13), `student_consent` (12), `student_vaccination` (12), `student_certificate` (20), `student_transport` (14), `student_hostel` (11), `achievement_certificate` (7) | `studentHealthAPI` (student.php:181), `studentHWAPI` (:197), `studentInfirmaryAPI` (:195), `consentListAPI` (consent.php:14), `studentVaccinationAPI` (:196), `studentCertificateAPI` (:188), `studentTransportAPI` (lms.php:364); read-only lists, one generic "record list" screen with per-type field maps | health/HW/infirmary/consent/vaccination/certificate/transport **V1**; `student_hostel` ⛔ and `achievement_certificate` ⛔ (both read the school from `session()`, which token-only callers lack — ev:student_tiles_backend.md rows) |
| S10 | School info & galleries | `principal_desk`, `about_us`, `reach_us`, `school_timing`, `acadamic_activity`, `achievement`, `school_information`, `facility`, `rules` (21-33 each); `photos_gallery` (34), `video_gallery` (26); `classwork_gallery` (7) | `schoolDetailAPI` (student.php:184; `action` must equal stored type, no student ids); `studentPhotoVideoGalleryAPI` (student.php:185; data keyed by album); classwork: Flutter uses `/front_desk/send_attachment/create` (response key `sentData`) — **backend not yet verified** | school info + galleries **V1**; `classwork_gallery` **V1 pending verification** |
| S11 | Face-capture photos (student) | `capture_photos` (7) | `add_studentCapturePhotosAPI` (adminapi.php:95; `stu_image[]`) — upload only, no recognition backend | **Later** (camera + upload, no server-side value found) |
| S12 | Adaptive learning (PAL/ESO) | no production menu row | `pal_eso_api.php` (`pal.auth` + `eso.student`): student-dashboard, learning-path, diagnostic, next-action, practice (ev:backend_routes_B.md); web student dashboard is PAL-centred (ev:web_core.md) | **Later (V1.1 candidate — your call, see Q8)**; memory note: ESO nodes exist for tenant 1 only |
| S13 | Profile | Profile tab | `GET api/own-profile` (api.php:98, api.session) | **V1** (already a screen) |

### 3.2 Teacher (priority 2; ICT / School Admin profiles share these)
Tenants = Teacher profile (of 38). Auth class: **ACT** = `teacherapi` with `resolveActingTeacherId` (forces id = token id, header-only), **SIG** = signature only, **SESS** = `session` middleware with `type=API` (ev:teacher_tiles_backend.md §0).
| ID | Sub-module | Tiles (tenants) | Backend path → auth | Class |
|---|---|---|---|---|
| T1 | Home, profile, timetable, calendar, proxy | dashboard; `t_own_profile` (31); `t_timetable` (31), `t_calander` (17), `t_proxy` (17) | `POST api/teacher-dashboard/summary` (api.php:159) & `api/teacher-timetable/summary` (:160) (api.session, token-bound); `GET api/own-profile`; legacy `teacherTimetableAPI` (web.php:475, SIG); calendar `calendar/TeacherFetchData` (cal.php:23) **returns every school's events for that standard (no tenant filter)**; `get_proxy_master` (web.php:472, SIG) | dashboard/profile/timetable/proxy **V1** (prefer the token-bound `/api` timetable); calendar ⛔-data-leak: use student calendar endpoint or filter client-side only after owners fix (record) |
| T2 | Take student attendance | `t_take_attendance` (30+3) | class pickers (F4) + `allStudentListAPI` (student.php:240, SIG, returns any school's students — send own tenant) + `POST student/save_student_attendance` (student.php:132, SESS + body ids; `student[<id>]=P/A`, `standard_division="std||div"`) | **V1** |
| T3 | Homework (assign/list/review) | `t_homework` (32+3) | list `teacherHomeworkAssignmentAPI` (student.php:233, SIG); assign `POST student/student_homework` (student.php:91, SESS, multipart file `image`, `students[]`); modern token-bound alternative `lms-homework/store|review-list|review-store` (api.php:284,313-317, staff only) | **V1** (assign with file after F5) |
| T4 | Marks & exam schedule | `t_marks` (16+3), `t_coscholastic_mark` (16+3), `t_exam_schedule` (12), `t_wrt_progress` (8) | marks: `get_teacherResultExamList` (teacherapi.php:59, ACT) + `POST result/marks_entry` (result.php:62 group, SESS; ResultLock check); co-scholastic: list `get_teacherResultCoscholastic{Parent,}List` (teacherapi.php:61-64) + store (result.php:81; **takes tenant/syear from body**); exam schedule: `get_teacherExamSchedule`/`add_teacherExamSchedule` (teacherapi.php:80,66) — **upload field mismatch: Flutter sends `attachment`, backend reads `filename`** | marks, co-scholastic **V1**; exam schedule list **V1**, upload ⛔ (field mismatch → file never stored; app can send `filename` instead — to confirm in step 3); WRT progress **V1** (same endpoint as S5) |
| T5 | Communication | `t_circular` (29+3), `t_notification_parent` (29+3), `t_sms_parent` (16+3), `t_email_parent` (16+3), `t_parent_comm` (32+3), `t_message` (9), `t_notification_report` (34), `t_approve_leave` (33) | circular list/add `circular/TeacherFetchData` (student.php:226) + `add_adminCircularAPI` (adminapi.php:87, multipart `attachment[]`); notifications/sms/email: modern `api/easy_com/send-{notification,sms,email}-parents` (easycomapi.php:69,77,83, api.session, **no role check**) with legacy fallbacks; parent comm `teacherParentcommunication{List,Save}API` (student.php:241-242); notification report `GET api/easy_com/reports/notification` (easycomapi.php:96); leave approval `teacherLeaveApplication{List,Save}API` (student.php:192-193; class teachers only; status `Approved`/`Rejected`) | **V1**. `t_message`: endpoint `teacherAnnoucementAPI` exists (student.php:232) but response shape unconfirmed in Flutter → step-3 check |
| T6 | Student directory | `t_student_profile` (32+3) | `allStudentListAPI` (student.php:240; any-school read) | **V1** |
| T7 | Teaching content | `t_teach` (17), `t_teacher_dairy` (14), `t_teacher_resource` (14), `t_social_collobrative` (14), `t_virtual_classroom` (7), `t_portfolio_feedback` (7) | `get_teacher_timetablewiseSubject` + `get_teacherContentAPI` (teacherapi.php:47,43; ACT), `add_teacherLessonPlanning` (:51; ACT), `get_teacherResourceAPI` (:33), `teacherSocialCollabrativeAPI` (:21), `get_teacherVirtualClassroomAPI` (:27) — read-only in Flutter; uploads for content add exist on backend but unused | `t_teach` list, `t_teacher_dairy`, `t_teacher_resource`, `t_social_collobrative` **V1**; `t_virtual_classroom` **V1** (low priority); `t_portfolio_feedback` ⛔ (no backend route found: ev:teacher_tiles_backend.md row) |
| T8 | My attendance & leave (staff HR) | `t_my_attendance` (11), `t_punch_inout` (11), `t_my_leave` (8), `t_hrms`/`t_salary_slip`/`t_payroll` (3) | **use the token-bound modern API**: `GET api/hrms/today`, `POST api/hrms/punch` (server time), `GET api/hrms/attendance`, `GET api/hrms/leaves` (api.php:135-138); leave `api/leave/{options,requests,balances}` (api.php:923-941; needs `token` in body/query; identity from request — send own id). **Do not use** `/lms_data` (public arbitrary-table reader), `/hrms/myleave/{id}` (sample data) or `hrms_api.php` (injectable, embedded DB credentials) | attendance/punch/leave **V1**; payslip/payroll **Later** (only safe path is web handoff; rotate secrets is a backend ask) |
| T9 | Office tasks | `t_complain` (17), `t_task` (17), `t_requisition` (15), `t_visitor` (8) | `get_teachercomplaintAPI`/`add_teachercomplaintAPI` (teacherapi.php:76,78), `get_teachertaskAPI`/`add_teachertaskAPI` (:68,70; **list hides tasks not yet approved**), requisition `get_teacherRequisitionAPI` (:72; **teacher list throws SQL error → 500**) + `get_adminItemListAPI`, visitor `get_visitorAPI`/`add_visitorAPI` (**no auth; photo field mismatch `file_name` vs `visitor_photo`**) | complaint **V1**; task **V1** (shows approved only — recorded); requisition ⛔ (SQL error on list; add may work — step 3 test); visitor **Later/⛔** (unauthenticated write + SMS side effect: I recommend not building until fixed) |
| T10 | Teacher gallery | `t_photo_gallary` (34), `t_video_gallary` (3) | teacher list endpoint always returns "You can only add photo/video" (`photo_video_gallaryController.php:210-221`); admin list `get_adminPhotoVideoAPI` works | ⛔ teacher list (use admin list endpoint as workaround? — Q9) |
| T11 | Face attendance capture | `t_capture_attendance`/`t_capture_photos` (8) | uploads exist; **no recognition code**; fallback is an all-Absent roster | **Later** |
| T12 | PTM | `t_ptm` (2) | teacher `get_teacherPTMBookingList`, `add_teacherPTMStatus` (teacherapi.php:55-57; backend ready, no Flutter screen) | **Later** (2 tenants) |

### 3.3 Admin / school-admin (priority 3)
Admin profile (26 tenants) mostly gets the **same tile names as Teacher** — they map to the admin endpoint variants in `adminapi.php` (signature-only, **no role check**), so the Admin work is mainly adapters behind the T screens.
| ID | Sub-module | Tiles (Admin tenants) | Backend path | Class |
|---|---|---|---|---|
| A1 | Admin home | dashboard | `POST api/admin-dashboard/summary` (api.php:158, api.session, admin only) | **V1** |
| A2 | Admin communication & directories | `t_circular` (20), `t_notification_parent` (21), `t_email_parent`/`t_sms_parent` (13), `t_parent_comm` (23), `t_student_profile` (23), `t_teacher_profile` (17), `t_approve_leave` (12) | `add_adminCircularAPI` (adminapi.php:87), `add_SendNotificationAPI` (:91), easy_com modern endpoints, `get_adminStudentList`, `get_adminTeacherList` (:39), `get_adminLeaveApplication*` (:41,43) | **V1** (reuse T5/T6 screens). ⛔ admin parent-comm **reply**: backend requires `parent_communication_id`+`admin_id`, Flutter sent `parent_comm_id` — app can send the correct name (confirm in step 3) |
| A3 | Admin office | `t_complain` (21), `t_task` (20), `t_visitor` (18), `t_requisition` (12), `t_proxy` (19), `t_own_profile` (20), `t_photo_gallary` (23) | admin variants `get_complaintAPI`, `get_taskAPI`, `get_adminVisitorListAPI`, `get_adminAllRequisitionAPI`, `get_adminTodaysProxyListAPI`, `get_adminPhotoVideoAPI` | complaint/task/requisition/proxy/profile/gallery **V1** (admin variants work); admin complaint list hides complaints without a solver (INNER JOIN) — recorded; visitor as T9 |
| A4 | Admin leave authorisation | `t_leave_authorisation` (4) | `api/leave/requests?status=pending` + `leave-authorisation-store` (cross-tenant update by id only) | **Later** (4 tenants + unsafe write) |
| A5 | Admissions lists | `t_registration`/`t_confirmation` (1), `admission_enquiry` (1) | `api/admission_enquiry|registration` (api.php:434-453, staff JWT, tenant pinned) | **Later** (1 tenant); web-handoff meanwhile |
| A6 | Fees (admin) | `t_feescollect` (1, `native_dynamic fees_collect_summary`), `t_feescancel` (1) | `api/fees-dashboard/summary|defaulters` (api.php:142,145), `api/fees-cancel/search` (:553); Flutter's collect screen calls `studentFeesDetailAPI` **without `type=API` → 401** | **Later**; online-receipt endpoint has no auth → never call it from the app |
| A7 | Inward/outward, inventory requisition | `t_inward`/`t_outward` (1) | `routes/inward_outward.php` (session + permissions) | **Later** (1 tenant) |
| A8 | 9 page-builder rows (add house, quota, enquiry, discipline, health, height-weight, infirmary, vaccination, mark attendance) | webview `/mobile/custom/<slug>` (1 tenant each, `page_source=custom`) | `GET api/mobile-page-builder/runtime/{slug}` still exists (mobile_page_builder.php:19); web builder UI removed; `MobileFormFieldRegistry` lists the forms | **Later**: native forms from `MobileFormFieldRegistry`; today `TileScreen.tsx:27-33` shows "Not available in the app" for these |
| A9 | Module dashboards | (no tile) | `api/{admissions,students,library,hostel,transportation}-dashboard/summary` (api.php:149-153, staff JWT) | **Later** |

### 3.4 Web modules not in the mobile menu — full coverage of the web app
Every top-level folder of `D:/lms_k12/app` (ev:web_modules.md §1) is accounted for here. "→ Sx/Tx" = delivered by that sub-module.
| Web module (pages) | Mobile decision | Reason |
|---|---|---|
| fees (51) | collect/receipt view → S6, A6; **reports (14), masters (8), NACH, scheduler/workflow** → Web-only | heavy tables + Excel export, bank files, set-up |
| lms (42) | homework → S4/T3; student learning → S8; teacher diary/lesson plan → T7; **exam/question-paper builder, curriculum planning, analytics charts** → Web-only / Later | jsPDF/print builders, large tables; analytics = Later |
| pal (56) | student side → S12 (Later); **staff authoring/admin/coherence** → Web-only | authoring consoles; Neo4j auth issue (memory) |
| h5p (57) | Web-only | authoring builders (drag-drop, video, hotspots) |
| student (35) / students (12) | profile list → T6; attendance → T2/S2; **add/bulk update, reports, ID cards, certificates, health/discipline CRUD** → Web-only; students/dashboard,search → Later | CRUD + print + reports |
| result (25) / exam (8) | marks entry → T4; WRT → S5; **report-card printing, reports, masters, HPC, online exam** → Web-only / Later(online exam) | print/CBSE templates |
| admissions (18) / admission-Enquiry (1) | lists → A5 (Later); public enquiry form → Later (web-handoff) | 1 tenant |
| hrit (15) | my attendance/leave → T8; **policy, regularization, payroll setup/reports, Form-16** → Web-only | admin HR set-up |
| talent-management (11), organization-management (5+2), people-competency (9), capability-intelligence (5) | Web-only (Later for employee self-service) | HR back-office, staff-only JSON (`staff.only`), desktop-heavy |
| task-management (11) | **Later** (clean staff JSON: `/api/task-management/my-tasks`…) — distinct from the legacy `t_task` tile | needs its own design; Q8 |
| enterprise-brain (33), ai (12), ai-platforms/journey/reports, platform-* | Web-only | admin AI consoles; separate backend |
| Inventory (23), Transportation (15), hostel (28), library (13) | Web-only (config-driven masters); teacher requisition → T9; student transport → S9; library/hostel student views **Later** (no student endpoint found — ev:backend_routes_A.md §6) | masters/reports |
| front_desk (14) | circular → T5; gallery → S10/T10; leave/parent comm → S7/T5; timetables → T1; **create-timetable, masters** → Web-only | set-up |
| admin-services (22) | visitor/complaint → T9; PTM → T12 (Later); **petty cash, consent master, reports** → Web-only | back-office |
| easy_com (16) | send → T5; **gateway config, reports** → Web-only (notification report → T5) | config |
| general (14), academic_setup (8), user (5), integration (7), platform-services (4), Utility (8), teach-learn (11), settings, import-data, proxy_master, classteacher*, teachertransfer, user_log, sqaa*, bazar, reports (placeholders), migration-modules, document-templates/documents*, course-master/subjects/quiz/learning-outcome/chapters | Web-only | set-up, builders, imports, placeholders, authoring; duplicates/dead groups listed in ev:web_modules.md §3 are counted once |
| inward_outward (8) | Later (A7) | 1 tenant |
| career-explorer/awareness/counselling/intelligence (14) | Later | student-facing but no API traced (ev:web_modules.md "not found") |
| login (1), forgot-password (1) | login → V1 (exists); forgot-password → Later (BFF route, backend not traced) | |
| mobile-bridge, mobile_app_rights, native_dynamic_pages | Web-only (support the mobile app itself) | admin config of the app |

## 4. Auth, DB and API requirements
**Auth for V1:** every V1 sub-module uses a token from `POST /api/api-login` (`api.php:95`) as `Authorization: Bearer` (+ `token` field where the controller reads input — leave/attendance modern APIs, `hrms_api.php` excluded). No parent/OTP tokens (C7, Q2). Role gating: menu from `GET /api/mobile/bootstrap` (`api.php:100`) → `TileScreen` guard (exists). Server-side rights (`check_permissions`) depend on per-tenant `tblmenumaster.link` rows — **DB-dependent, not verified** (ev:teacher_tiles_backend.md caveat 12).

**DB requirements the app depends on (all exist; app never writes them directly):**
| Table / condition | Needed by | Failure mode if missing |
|---|---|---|
| `mobile_homescreen`, `teacher_mobile_homescreen` (rows per tenant, `status='Yes'`) | menu | empty menu |
| current `academic_year` row per school | all `api.session` routes, `fees/PaidUnpaid` | 422 "Academic Term Date Expired" |
| `tblstudent_enrollment` for student+year | circular, calendar, timetable, exam schedule, teacher list | 500/"Wrong Parameters" |
| `school_detail` rows (type text must equal `action`) | S10 school info | empty |
| `school_setup.is_lms` | S8 | content scope |
| `mobile_web_handoff_token` | web-handoff | 503 |
| `gcm_users` | push registration (Later) | – |
| per-module tables | listed per endpoint in ev:student_tiles_backend.md / ev:teacher_tiles_backend.md | – |
Note: `tblstudent.roll_no` is absent in the live DB (memory); no student V1 query touches it, only `tblstudent_enrollment.roll_no` (WRT report) — fine.

## 5. Dependencies and build order (proposed)
```
F1 ──┬─ F2 ── (every screen)
     ├─ F3 ── (every screen)
     ├─ F4 ── T2, T3, T4, T5, T7, A2, A3
     └─ F5 ── S4b, S7(leave attach), T3(assign file), T5(circular attach), T9(uploads)
```
| Phase | Sub-modules (in order) | Why this order |
|---|---|---|
| 0 Foundation | F1 → F2/F3 | every endpoint needs the transport/envelope fixes; no screen can be verified without them |
| 1 Student read-only | **S2 Attendance (first vertical slice, proves F1)** → S1 → S3 → S4a → S6a/b → S5 → S7 (lists) → S9 → S10 → S8 (V1 part) → S13 | read-only, highest tenant coverage (≥21 of 34 tenants for S1-S4, S6, S7, S10), no new library |
| 2 Student writes | F5 (library approval) → S4b → S7 (submit leave/communication) | uploads need picker libs |
| 3 Teacher | F4 → T1 → T2 → T3 → T5 → T4 → T6 → T7 → T8 → T9 (complaint, task) | attendance/homework/circular are the daily-use tiles (≥29 tenants) |
| 4 Admin | A1 → A2 → A3 | adapters over Teacher screens |
| 5 Later | S8 rest, S11, S12, T10-T12, A4-A9, task-management, payslips, push | after V1 is approved/shipped |
Rough size (relative, **[ASSUMPTION]**): F1-F3 small; each S sub-module small-to-medium; T2/T3/T4 medium; F4, F5, T5 medium.

## 6. Libraries (none approved yet — per D-08)
| Need | Candidate | First needed |
|---|---|---|
| File/photo pick & upload | `expo-image-picker`, `expo-document-picker` | S4b (Phase 2) |
| Open PDFs/links | none (use `Linking`, as `WebHandoffScreen` does) | S5 |
| Date input | none first (text `Field`); `@react-native-community/datetimepicker` only if needed | S7 / T2 |
| Push | `expo-notifications` — Later | – |
Adding a native module changes the fingerprint → store build (README OTA notes). Phases 0-1 need **no** new library, so they are OTA-deliverable.

## 7. Backend issues that gate or shape V1 (reported, not fixable here)
Full list: ev:student_tiles_backend.md caveats, ev:teacher_tiles_backend.md §3, ev:backend_routes_A.md §5.
Gating (⛔): `document_details` and `studentHostelAllocationAPI` (school read from session), `t_portfolio_feedback` and `live_lecture` (no endpoint), teacher gallery list (always "no data"), teacher requisition list (SQL error `u.status`), calendar `TeacherFetchData` (no tenant filter), visitor add (no auth).
Security-relevant for the owners (not blocking): public `/lms_data` arbitrary-table reader; unauthenticated `fees/get_online_receipt`; `public/hrms_api.php` embedded DB credentials + SQL injection; student tokens accepted by staff-only legacy endpoints; ids trusted from request bodies (cross-student/cross-tenant reads); OTP echoed in `check_otp`; SQL concatenation in `studentResultPDFAPI`, `notificationHubAPI`.
**The app never needs to call the insecure ones** (`/lms_data`, `get_online_receipt`, `hrms_api.php`); the plan routes around them.

## 8. Questions for approval
- **Q6 (repeat)** Is a dev server (or may I run `php artisan serve`) available so built screens can be verified against real responses? Without it, step 4 verification is unit tests + code reading only.
- **Q8** Confirm scope calls: (a) Student adaptive learning (PAL/ESO) = Later; (b) new `task-management` = Later; (c) ≥5-tenant threshold for V1 (§1).
- **Q9** For ⛔ items, which do you prefer? (i) leave blocked until the backend owners fix; (ii) use a documented workaround where one exists (e.g. teacher gallery via admin list endpoint; exam-schedule upload with field `filename`).
- **Q10** Approve D-11…D-16 (new, in 02-decisions.md): classification rules, transport/identity change in `client.ts`, tile-URL re-basing, no calls to insecure endpoints, first vertical slice = F1 + S2, tracker format.
- **Q11** After approval, step 3 starts with the document for **F1 + S2 (Attendance)** — OK?
