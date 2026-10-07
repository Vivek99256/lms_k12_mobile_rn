# Backend route survey B (D:/next_lms_erp) - READ-ONLY, nothing modified

Route counts = grep count of `Route::(get|post|put|patch|delete|any|match|resource|apiResource)(` per file (a `Route::resource` counts 1 but expands to up to 7). Approximate.
"RSP" = app/Providers/RouteServiceProvider.php. Its `map()` is at RSP:62-134; each file has a `mapXRoutes()` method further down (named in the table).

## 1. How each file is registered
No route loading in bootstrap/ (only app.php + cache). Three files are NOT in RSP; their own service providers load them.

| File | Registered by | URL prefix | Middleware |
|---|---|---|---|
| routes/student.php | RSP mapStudentRoutes | none (inner `student`, `front_desk`, `student/api/*`) | `web`; groups add `session, menu, logRoute, check_permissions` (student.php:62); `api.session, session, menu, logRoute` (student.php:205) |
| routes/fees.php | RSP mapFeesRoutes | none (inner `fees`, `report`) | `web`; `session, menu, logRoute, check_permissions` (fees.php:70); per-route `api.session` (fees.php:116-133) |
| routes/lms.php | RSP maplmsRoutes | none (inner `lms`, `bazar`, `h5p`, `lms/api/teacher_resource`) | `web`; `session, menu, logRoute, check_permissions` (lms.php:78); `session` only (lms.php:416); lms_apiController block (lms.php:355-372) has only `web` |
| routes/g2g_lms.php | RSP mapG2gLmsRoutes | `api` -> `/api/g2g-lms/*` | `api` + `api.session, staff.only` (g2g_lms.php:35) |
| routes/hrms.php | RSP mapHrmsRoutes | none (inner `hrms`) | `web` + `session, menu, logRoute, check_permissions` (hrms.php:25,124) |
| routes/result.php | RSP mapResultRoutes | none (inner `result`, `easy_com`, `report`) | `web` + `session, menu, logRoute, check_permissions` (result.php:64) |
| routes/admission.php | RSP mapAdmissionRoutes | none (inner `admission`) | `web` + same four (admission.php:14) |
| routes/inventory.php | RSP mapInventoryRoutes | none (inner `inventory`) | `web` + same four (inventory.php:29) |
| routes/task_management.php | RSP mapTaskManagementRoutes | `api` | `api` + `api.session, staff.only` (task_management.php:84) |
| routes/talent_management.php | RSP mapTalentManagementRoutes | `api` | `api` + `api.session, staff.only` (talent_management.php:70) |
| routes/competency_management.php | RSP mapCompetencyManagementRoutes | `api` | `api` + `api.session, staff.only` (competency_management.php:63) |
| routes/organization_management.php | RSP mapOrganizationManagementRoutes | `api` | `api` + `api.session` only, no staff.only (organization_management.php:31) |
| routes/pal_api.php | app/Providers/PALServiceProvider.php:278 `loadRoutesFrom` | literal `api/pal/...` in file (pal_api.php:31,44) | no `api`/`web` group (so no throttle); `pal.auth` (pal_api.php:44); `api.jwt` only for pedagogy-engine (pal_api.php:31) |
| routes/pal_eso_api.php | PALServiceProvider.php:279 | `api/pal/eso` (pal_eso_api.php:22) | `pal.auth`; inner `eso.student` (pal_eso_api.php:58) |
| routes/ai.php | app/Providers/AiServiceProvider.php:88 | `config('ai.route_prefix','api/ai')` (ai.php:37) | `api` + `McpAuth, McpRateLimit, McpContextHydrator` (ai.php:40) |
| routes/mcp.php | app/Providers/McpServiceProvider.php:309 | `config('mcp.route_prefix','api/mcp')` (mcp.php:35) | `api, McpAuth, McpRateLimit, McpContextHydrator` (mcp.php:15) |
| routes/brain.php | RSP mapBrainRoutes | `api/brain` | `api` + `brain.auth, brain.tenant` + per-route `brain.permission:*` (brain.php:45) |
| routes/mobile_page_builder.php | RSP mapMobilePageBuilderRoutes | `api/mobile-page-builder` | `api` + `api.session` (mobile_page_builder.php:22) |

Mcp/Ai providers confirmed in config/app.php:180-181. PALServiceProvider registration in config/app.php: not checked (its boot() clearly loads the files, PALServiceProvider.php:276-280).

## 2. What the auth middleware means (token = GenTux JWT issued by ApiLoginController)
Groups: app/Http/Kernel.php:33-54.
- `web` group = EncryptCookies, StartSession, VerifyCsrfToken, plus `api.jwt` (Kernel.php:34-43). CSRF is skipped for `api/*`, `fees/*`, `circular/*` and the full URLs https://erp.triz.co.in/*, https://dev.triz.co.in/*, http://127.0.0.1:8000/* (VerifyCsrfToken.php:17-23). Other unprefixed web POSTs (e.g. `/studentAttendanceAPI`) are CSRF-exempt only through those host entries; on another host they would get 419 (not tested).
- `api` group = `throttle:1000,1`, SubstituteBindings, `api.jwt` (Kernel.php:45-51). Stateless.
- `api.jwt` (RequireApiJwt.php): only enforces on URIs matching `protect` patterns in config/api_guard.php (`protect` list ~api_guard.php:97-139). Matching requests need a Bearer JWT or a web login session, may only name the caller's own `sub_institute_id`, and `staff`-listed URIs 403 for students/parents. `public` list (api_guard.php:26-38) bypasses. Switch: `API_GUARD_ENFORCE` (api_guard.php:24). Unlisted routes are NOT protected by it.
- `api.session` (ApiSessionHydrator, Kernel.php:80): validates Bearer JWT and hydrates an in-memory legacy session from the claims (ApiSessionHydrator.php docblock; Concerns/HydratesLegacyApiSession.php). Nothing persisted. Token-only, usable by mobile.
- `staff.only` (RequireStaffRole.php): 403 JSON if token `is_student` or profile is student/parent. Students/parents cannot call these routes.
- `session` (SessionMiddleware.php:20-42): dual mode. If input `type` is `API` or `JSON` it validates the Bearer JWT and hydrates the session (no cookie). Otherwise it needs a browser session `user_id` and redirects to `route('home')`. So Blade-group routes are token-callable when the client sends `type=API` AND the controller ends in `is_mobile(...)`.
- `is_mobile($type,$url,$data,$redirect_type)` (app/Helpers/Helper.php:27-60): `type=API|JSON` -> `response()->json($data)`; else redirect/view.
- `pal.auth` (PalApiAuth.php): JWT required (401), payload normalised into `pal_auth`, students limited to their own learner record, staff limited to their school(s). `eso.student` = EsoStudentOnlyAuth (Kernel.php:85).
- `lms.auth` (LmsApiAuth.php): JWT but WARN-ONLY by default (`lms_content.api_auth_enforce` false): anonymous allowed + logged. Used in routes/platform.php, not in surveyed files.
- `McpAuth` (McpAuth.php:10-35) and `brain.auth`: JWT required.

## 3. Modules

### 3.1 routes/student.php (~169 calls, 285 lines): Blade CRUD + legacy JSON `*API` block
Controllers dir student/: 19 `return view(`, 156 `is_mobile(`, 98 json.
| Method | URI | Controller@method | Purpose / format |
|---|---|---|---|
| resource | /student/add_student, search_student, student_attendance, student_homework ... (student.php:63-101) | tblstudentController etc. | Blade CRUD, `is_mobile` fallback |
| POST | /studentAttendanceAPI (:179) | studentAttendanceController@studentAttendanceAPI | attendance + calendar; in-controller `jwtToken()->validate()` (studentAttendanceController.php:~623-635); `json_encode` |
| POST | /studentHealthAPI, /studentExamScheduleAPI, /studentDisciplineAPI, /studentLeaveApplicationAPI, /studentHostelAllocationAPI, /studentCertificateAPI, /studentInfirmaryAPI, /studentVaccinationAPI, /studentHWAPI, /schoolDetailAPI, /studentPhotoVideoGalleryAPI (:180-197) | various | student JSON |
| POST | /teacherLeaveApplicationListAPI, /teacherLeaveApplicationSaveAPI, /teacherSendSmsParentsAPI, /teacherSendEmailParentsAPI, /studentTeacherListAPI (:180-193) | leaveApplicationController etc. | teacher JSON |
| POST | /notificationHubAPI, /teacherAnnoucementAPI, /studentHomeworkAssignmentAPI, /teacherHomeworkAssignmentAPI, /studentSubjectAPI, /teacherStudentListAPI, /allStudentListAPI, /teacherParentcommunicationListAPI, /teacherParentcommunicationSaveAPI, /studentParentcommunicationListAPI, /add_communicationAPI (:231-243) | tblstudentController, studentHomeworkController, parentCommunicationController | JSON (401 JSON in tblstudentController.php:~1705) |
| POST | /circular/fetchData, /circular/TeacherFetchData, /homework/fetchData, /photo_video_gallary/fetchData, /photo_video_gallary/TeacherFetchData (:225-230) | circular/homework/gallery | JSON lists |
| GET | /circular/circular-types (:227) | circularTypeApiController@index | JSON |
| GET/POST | /student/api/student_certificate/{templates,search,preview,save,history}; /student/api/student_icard/*; /student/api/teacher_icard/* (:266-283) | StudentCertificateApiController, StudentIcardApiController, TeacherIcardApiController | Next.js JSON helpers, no extra middleware |
| resource | /front_desk/{parent_communication,leave_application,circular,dicipline,photo_video_gallary,exam_schedule,send_attachment} (:205-215) | resource controllers | `api.session, session, menu, logRoute`, dual |
Verdict: JSON-capable (legacy contract, auth inside controller). Admin screens (bulk update, icards, TC, reports) are Blade.

### 3.2 routes/fees.php (~151 calls, 334 lines)
fees/: 10 views, 274 `is_mobile`, 142 json.
| Method | URI | Controller@method | Purpose / format |
|---|---|---|---|
| resource | /fees/fees_collect, other_fees_collect, college_fees_collect, fees_config_master ... (:70-134) | fees_collect_controller etc. | Blade; `is_mobile($type,"fees/fees_collect/show",...)` (fees_collect_controller.php:61,370,972-978) |
| POST | /fees/PaidUnpaid, /fees/PaidUnpaidTeacher (:258-259) | fees_collect_controller | `session, check_permissions`; JSON (401 JSON ~line 3282) |
| GET | /fees/feesDetails/getDetails/{id}/{stud} (:264) | fees_collect_controller@retrieveDataByUserId | student fee detail |
| POST/GET | /fees/online_fees_payment_api/{gateway}, .../{gateway}/preview (:127-128) | online_fees_payment_api_controller@initiate/preview | `api.session` JSON, online pay |
| GET | /fees/receipt/reprint (:129) | receipt_reprint_api_controller@reprint | `api.session` |
| GET | /fees/online_payments, /online_payments/{id}, /audit_logs, /reconciliation/status (:130-133) | *_api_controller | `api.session` JSON (admin) |
| resource | /fees/online_fees_settings_api, update_fees_breackoff_api, map_year (:116,126,174) | *_api_controller | `api.session` admin setup |
| GET | /fees/online_fees_collect (:267) | online_fees_collect_controller@index | starts gateway flow in browser |
| GET/POST | /fees/{hdfc,axis,aggre_pay,icici,icici_orange,razorpay}/... Request/ResponseHandler (:276-303) | online_fees_collect_controller | gateway callbacks/HTML; web only |
Verdict: partial JSON. Dues/receipts/online-payment initiation have JSON paths; payment gateway pages need a webview. Other fees JSON (FeesDashboardApiController etc.) is in routes/api.php, not surveyed.

### 3.3 routes/lms.php (~261 calls, 599 lines) - native K-12 LMS
lms/: 15 views, 277 `is_mobile`, 564 json.
| Method | URI | Controller@method | Purpose / format |
|---|---|---|---|
| resource | /lms/{chapter,course,topic,subtopic,content}_master, content_library, lms_curriculum, lms_syllabus, lmsmapping, h5p | lms\chapterController etc. | Blade authoring (`is_mobile` dual) |
| GET/POST | /lms/pal/diagnostic, /diagnostic/chapter/{id}, POST /diagnostic/attempt/{id}/submit, GET .../result, /history/{chapterId} (lms.php:185-189) | lms\pal\palController | student diagnostic; `is_mobile($type,'lms/pal/diagnostic-exam',$res,'view')` (palController.php:2889) |
| GET/POST | /lms/pal/adaptive/{chapter/{id},concept/{id},progress/{id},concept-result/{id}}, POST /lms/pal/adaptive/answer (lms.php:191-195) | palController | adaptive practice; `answer` returns `response()->json` (palController.php:3105); CSRF-exempt (VerifyCsrfToken.php) |
| GET/POST | /lms/pal/plan/chapter/{id}, /mastery/chapter/{id}, /recall, /learn/concept/{id}, POST .../read (lms.php:200-224) | palController | plan/mastery/content |
| POST | /studentVirtualClassroomAPI, /studentPortfolioAPI, /studentSocialCollabrativeAPI, /studentSubjectAPI, /studentContentAPI, /studentQuestionPaperListAPI, /studentQuestionPaperAPI, /studentAssessmentAPI, /studentTransportAPI, /studentLeaderBoardAPI, /studentActivityStreamAPI, /studentBookListAPI, /studentSyllabusAPI, /studentQuestionPaperSaveAPI, /studentAssessmentDetailAPI, /lmsCategorywiseSubjectAPI, /trizStandardAPI (lms.php:355-372) | lms_apiController | legacy mobile JSON; JWT checked in controller (lms_apiController.php:272-284); `web` only |
| GET/POST | /lms/api/teacher_resource, /{id}, store, update/{id}, delete/{id} (lms.php:592-597) | TeacherResourceApiController | pure JSON (15 json, 0 view); route group has no auth middleware |
| GET | /careerExplore, /careerCluster, /allOccupation, /OccupationDetails, /interest* (lms.php:~397-415) | lmsCounsellingController | career counselling, no middleware |
| GET/POST | /studentAspiration, /studentAmbition, /studentOriginality, /careerAlignment, /studentCareerEvidence, /careerRecommendation (lms.php:416-436) | lmsCounsellingController, CareerRecommendationController | `session` only (JWT-hydrated) |
| GET | /upcoming, /today, /recent (lms.php:389-392) | lmsActivityStreamController | activity stream |
| POST | /ai/generate*, /generate-gamma-pdf (lms.php:437-450) | contentController | AI authoring (staff) |
Verdict: good student mobile support via `*API` POSTs and the `/lms/pal/*` routes with `type=API`; authoring is Blade. Newer `api/lms-*` JSON is in routes/api.php (api_guard protects `lms-courses/*`, `lms-homework/*`, ~api_guard.php:100-125), not surveyed.

### 3.4 routes/g2g_lms.php (~148 calls, 307 lines) - corporate "People & Competency" LMS
JSON only (G2gLms controllers: 0 `return view(`, 346 `response()->json`). `/api/g2g-lms/*`, `api.session + staff.only`.
| Group | Lines | Controller | Purpose |
|---|---|---|---|
| learning-dashboard / learning-catalog | 42 / 58 | LearningDashboardController / LearningCatalogController | dashboard, catalog |
| my-learning | 77-118: GET courses, courses/{id}, assessments, notes, certificates, discussions; POST progress, courses/{id}/complete, notes, certificates, discussions | MyLearningController | learner consumption |
| assignments | 121-135 | AssignmentsController | assign/review |
| sessions-calendar | 144-157 | SessionsCalendarController | ILT sessions, registration |
| certifications-records | 159-168 | CertificationsRecordsController | certificates, transcript |
| course-builder, administration-governance, assessments | 171, 217, 263 | CourseBuilder/Governance/Assessment/AiCourse | authoring/admin |
| public | GET /g2g-lms/certifications-records/certificates/verify/{code} (305-307) | CertificationsRecordsController@verify | public (also api_guard.php:29) |
Verdict: clean JSON, staff-only (students/parents get 403).

### 3.5 routes/hrms.php (~76 calls, 146 lines)
Whole file `web` + `session, menu, logRoute, check_permissions`; HRMS/: 10 views, 51 `is_mobile`, 67 json.
| Method | URI | Controller@method | Purpose |
|---|---|---|---|
| GET/POST | /payroll-type*, /employee-salary-structure, /monthly-payroll*, /payroll-report, /form16*, /salary-structure-report (hrms.php:27-69) | Payroll\PayrollController | payroll (Blade/PDF) |
| GET/POST | /hrms-attendance, /hrms-attendance-in-time/store, /hrms-attendance-out-time/store, /hrms-attendance-report, /show-hrms-attendance-report, /get-holidays, /get-present-days, /get-absent-days (hrms.php:81-111) | HRMS\HrmsController | punch + reports; partly JSON (HrmsController.php:~369) |
| resource | /hrms/designation_leave, leave_encashment, add_department, user_shift_master (hrms.php:125-129) | HrmsLeaveController etc. | Blade setup |
| GET | /hrms/myleave/{employeeId}, /hrms/leavehistory/{employeeId} (hrms.php:146-147; declared after the groups close, so no `hrms` prefix doubling and only `web`) | HrmsLeaveController@getLeaveDashboard / getLeaveHistory | leave balance/history |
Mobile HRMS JSON is in routes/api.php:134-138 (`api.session`, prefix `api/hrms`): GET `today`, POST `punch`, GET `attendance`, GET `leaves` -> `api\HrmsMobileApiController`. Leave application/approval controllers (`leave\*`) are declared in web.php, not surveyed.
Verdict: hrms.php is Blade/web; use api.php HrmsMobileApiController for mobile.

### 3.6 routes/result.php (~120 calls, 245 lines)
`web` + four-middleware (result.php:64). result/: 5 views, 157 `is_mobile`, 121 json.
| Method | URI | Controller@method | Purpose |
|---|---|---|---|
| resource | /result/student-result, student-result-remarks, std_grd_maping, approve_mobile_result (result.php:70-90) | studentResultController etc. | Blade |
| GET | /result/current_result, getPalMarks, getMapValue, result_personalize_marks (:117-121) | resultAPIController | lookups via `is_mobile` |
| GET | /result_personal_marks_api, /question_lists_api (:240-241) | resultPersonalizeMarksController | JSON |
| POST | /uploadResultAPI (:133) | upload_result_controller@uploadResultAPI | JSON, in-controller JWT (~:246-254) |
| POST | /studentResultPDFAPI (:214) | cbse result controller | PDF |
| GET | /api/get-grade-list, get-standard-list, get-division-list, get-subject-list, get-exam-name-list ... (:136-154,192-193,210) | AJAXController | dropdowns; protected by api_guard `get-*` |
Real JSON result API is routes/resultapi.php (not in my list): `api` prefix, `api.session` (resultapi.php:52,59); GET all-results and all-results/{id} ("student token", :243-245); student-result (:260-263); result-report.

### 3.7 routes/admission.php (~32 calls, 85 lines)
`web` + four-middleware (admission.php:14). admission/: 0 views, 46 json, 56 `is_mobile`.
| Method | URI | Controller | Purpose |
|---|---|---|---|
| resource | /admission/admission_enquiry, admission_registration, admission_confirmation, admission_follow_up, online_admission_confirm, admission_master (:15-21) | admission* | admissions CRM |
| any | /admission/admission_*_report (:34-42) | admissionReportController | reports |
| GET/POST | /admission/online-admission/{id}/{title}, /process-admission-enquiry, /admission-receipt (:65-68) | admissionEnquiryController | public enquiry form |
| GET/POST | /admission_enquiry, /admission_enquiry/store, /payment_proof (:79-81) | admissionEnquiryController | standalone ("hills") |
api_guard marks admission_* as staff-only (api_guard.php:~47-49). Verdict: staff web flow.

### 3.8 routes/inventory.php (~27 calls, 66 lines)
`web` + four-middleware (inventory.php:29). Nearly all `Route::resource` (add_inventory_item, vendor_master, generate_po, requisition, item_allocation ...). inventory/: 21 views, 104 `is_mobile`, 12 json. Blade-only in practice. `api/inventory/reports/*` is protected/staff in api_guard (api_guard.php:~58), controller InventoryApiController in api.php, not surveyed.

### 3.9 routes/task_management.php (~87 calls, 218 lines)
`api` + `api.session, staff.only` (task_management.php:84). 28 controllers (api/TaskManagement), 0 `return view(`; JSON built via trait ResolvesTaskManagementContext, so grep count of `response()->json` (8) is low.
| Method | URI | Controller@method | Purpose |
|---|---|---|---|
| GET | /api/task-management/session | SessionController@show | context |
| GET | /api/task-management/my-tasks, /my-tasks/{id} | MyTasksController@index/show | my tasks |
| PATCH | /api/task-management/my-tasks/{id}/status | MyTasksController@updateStatus | update status |
| GET | /api/task-management/tasks, /search | TaskListController@index, GlobalSearchController@index | list/search |
| GET/PATCH | /api/task-management/notifications, /{id}/read, /read-all | NotificationController | notifications |
| GET/POST | /api/task-management/workspace/{id}/time-entries{,/start,/stop}, /subtasks | TaskTimeTrackingController, TaskSubtaskController | time, subtasks |
| POST | /api/deadline-extension | DeadlineExtensionController@store | extension request |
Verdict: clean JSON, staff-only.

### 3.10 talent_management.php (~178), competency_management.php (~148), organization_management.php (~54)
Stateless JSON under `/api/...`; `api.session, staff.only` (org mgmt: `api.session` only). TalentManagement/: 63 files, 0 views, 398 json. OrganizationManagement/: 8 files, 0 views, 76 json.
- talent: onboarding (:138), performance (:184), mobility (:262), offboarding (:299).
- competency: employee profiles, certifications, development, `competency-library` (:215).
- org: `organization-management/{compliance-library,disciplinary-library,employee-directory,role-permissions}` (:40,80,90,120).
Verdict: clean JSON, HR back-office, staff-only.

### 3.11 routes/pal_api.php (~156 calls, 441 lines) and pal_eso_api.php (22 calls, 117 lines)
JSON, `pal.auth`. `/api/pal/*`, `/api/pal/eso/*`.
| Method | URI | Controller@method | Purpose |
|---|---|---|---|
| GET | /api/pal/learner-state/{id}, /mastery-map/{id}, /velocity/{id}, /plateau/{id}, /regression/{id} | PALAPIController | learner analytics |
| GET | /api/pal/dashboard/learner/{learnerId}, /dashboard/teacher | PALAPIController | dashboards |
| GET | /api/pal/pedagogy/recommend/{learnerId}/{conceptId}, /content/recommend/..., /content/practice/{learnerId}/{conceptId} | PALAPIController, PalContentIntelligenceController | recommendations |
| POST | /api/pal/content/next-variant | PalContentIntelligenceController | next variant |
| GET | /api/pal/coherence/{learner,next,remediation,explain}/... | CoherenceMapController | Neo4j-backed (memory note: Neo4j auth broken) |
| GET | /api/pal/workspace/students, /workspace/{learnerId} | PalWorkspaceController | teacher workspace |
| GET | /api/pal/pedagogy-engine/* (`api.jwt` only, pal_api.php:31-37) | PedagogyEngineController | reference |
| ESO student (pal_eso_api.php:58-): GET /diagnostic/{learnerId}/{conceptId}, POST .../submit, GET /next-action, /chapter-dashboard/{learnerId}/{chapterId}, /learning-path/{learnerId}, /student-dashboard/{learnerId}, /due-for-retrieval/{learnerId}; POST /practice/{learnerId}/{nodeId}/attempt, /cfu/.../check, /retrieval/.../check, /render | EsoEngineController | adaptive engine for students |
| ESO staff: GET /api/pal/eso/chapter-concepts/{chapterId}, /decision-log/..., /pilot/metrics, /reports/attainment | EsoEngineController, PilotMetricsController, AttainmentReportController | teacher reports |
Verdict: cleanest token JSON for adaptive learning; students allowed with ownership enforcement.

### 3.12 ai.php (~90 calls), mcp.php (4), brain.php (~93)
- ai.php: `/api/ai/*` capabilities, configuration, templates, modules usage/guardrails, workspace (context, agent run, workflow start), policies. JWT via McpAuth; scope from token (ai.php docblock :25-33). JSON (AI controllers: 0 views).
- mcp.php: POST `/api/mcp` (JSON-RPC, Laravel\Mcp) plus deprecated REST shim GET `/health`, POST `/initialize`, GET `/tools`, POST `/tools/call` (mcp.php:35-46).
- brain.php: `/api/brain/access`, `/navigation`, `/{tenantId}/{overview,foundation,search,departments,people,capabilities,ingestion,kasba,ai-assistant,settings,intelligence,signals,...}` with `brain.permission:*` (brain.php:45-60).
Verdict: JSON + token, admin/AI-platform surfaces.

### 3.13 routes/mobile_page_builder.php (13 calls, 50 lines)
`/api/mobile-page-builder/*`, `api.session`. GET `runtime/{slug}` (any authed user), `pages` CRUD/publish/versions/assets (admin enforced inside controllers), `source-pages`, `menu-pages` (mobile_page_builder.php:22-49). Related (routes/api.php): `mobile/bootstrap` (:100), `mobile/web-handoff` (:106), `mobile/web-handoff/claims` (:115, public per api_guard.php:30).

### 3.14 routes/web.php first 150 lines
Lines 1-72 are imports (school_setup, lms, library, leave, HRMS, Payroll, sqaa, Neo4j, Chatbot, Whatsapp). Routes begin at 73: `/lms/student-profile`, `/forgetting-curve`, `/class-insights`, `/teacher-dashboard`, `/knowledge-graph`, `/recommend-content`, `/track-content-view` (PedagogyEngineController); `/lms/adaptive-practice`, `/submit-practice`, `/diagnostic-assessment`, `/submit-diagnostic-assessment`, `/chapter-gate`, `/practice-history`, `/spaced-repetition` (assessmentQuestionController); `/lms/pedagogy-suggested-content`, `/store-suggested-content`; `/neo4j-test`; `/student-results/{stuId}`. None sit inside a middleware group (first group at web.php:258), so only the `web` group applies. Other groups: student (:366), school_setup (:374,618), generic (:546,615,840,854), agent (:796).

## 4. Mobile fit
| Module | Token JSON for mobile? | Evidence |
|---|---|---|
| PAL / ESO adaptive learning | Yes, clean, students allowed | pal_api.php:44, pal_eso_api.php:22,58, PalApiAuth.php |
| LMS student content/quizzes | Yes, legacy `*API` POSTs; plus `/lms/pal/*` with type=API | lms.php:355-372, 185-224 |
| Student portal (attendance, homework, circulars, leave, health, gallery, notices) | Yes, legacy `*API` POSTs | student.php:179-243 |
| Student results | Use resultapi.php `/api/result/all-results`; result.php is Blade with type=API fallback | resultapi.php:243-245, result.php:117-121 |
| Fees | Partial: `api.session` JSON for online-pay init/receipt/payments; collection desk Blade+type=API; gateway pages need webview | fees.php:116-133, 258-264, 276-303 |
| HRMS attendance/leave | Not in hrms.php (Blade); use api.php `hrms/today|punch|attendance|leaves` | hrms.php:25-146, api.php:134-138 |
| Task management | Yes, clean, staff-only | task_management.php:84 |
| G2G LMS | Yes, clean, staff-only | g2g_lms.php:35 |
| Talent / Competency / Org | JSON, staff back-office | files above |
| AI / MCP / Brain | JSON + JWT, admin/AI | ai.php:37-40, mcp.php:15,35, brain.php:45 |
| Mobile page builder/bootstrap/handoff | Yes | mobile_page_builder.php:22, api.php:100,106,115 |
| Admission | Blade, staff-only | admission.php:14, api_guard.php:~47 |
| Inventory | Blade-only (web handoff) | inventory.php:29 |

## 5. Caveats
- View-vs-json figures are grep counts over whole controller directories, not per route. Most legacy controllers return via `is_mobile()`, so the same method gives JSON for `type=API|JSON` and Blade/redirect otherwise (Helper.php:27-60). `return view(` counts therefore understate Blade-ness.
- Legacy `*API` POST routes sit in the `web` group and authenticate with `jwtToken()->validate()` inside the controller, not with `api.session`; they only get `api.jwt` tenant checks if listed in api_guard `protect`.
- Line numbers prefixed `~` are approximate (taken from grep context). Not checked: config/app.php registration of PALServiceProvider; routes/api.php beyond lines cited; functioning of Neo4j-backed endpoints; check_permissions/menu internals.
