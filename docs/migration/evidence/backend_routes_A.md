# Laravel backend route survey A (mobile-callable JSON/API routes)

Repo: `D:/next_lms_erp` (Laravel 12.69.2, `vendor/laravel/framework/src/Illuminate/Foundation/Application.php:48`). Read-only survey.
Files covered: api, teacherapi, adminapi, resultapi, easycomapi, user, settings, ptm, consent, frontdesk, visitor_management, tranceport, driver_management, api_hostel, hostel_management, cal, documents, inward_outward, skill, implementation, custom_module, platform (all under `routes/`).

How this was built: a script parsed each route file (group prefix + middleware inherited per group, `Route::controller()` groups resolved, `->middleware()` chains read, commented routes captured), then I cross-checked parsed line numbers against `grep` of the files (3 swallowed routes added by hand: visitor_management.php:15, skill.php:15/17/18). Total live routes parsed: **964** (api 450, resultapi 185, adminapi 63, easycomapi 36, teacherapi 34, user 24, settings 26, frontdesk 26, tranceport 19, custom_module 18, hostel_management 17, platform 16, others small). "Purpose" in the big tables is derived from the method name (not hand-written for each route). Request/response detail is hand-verified only for the key endpoints in section 3. All `file:line` are in `D:/next_lms_erp` unless stated.

Auth column legend in the inventory tables: `RT:x` = route-level middleware x; `G` / `G+staff` = covered by the global `api.jwt` guard list (section 2.2); `CTRL:token (...)` = the controller method (or a private helper it calls, up to 2 levels) validates a JWT itself (script grep of uncommented code, not a manual read of every method); `CTRL:session() only` = only reads session, no token check found; `NONE-FOUND` = no route middleware, not in api_guard, and no auth call found in the method; `PUBLIC` = login/OTP by design.

---------------------------------------------------------------------

## 1. How each file is registered (RouteServiceProvider)

`app/Providers/RouteServiceProvider.php`: `map()` at :58-131 calls one `map*` per file. Only `Route::namespace` + optional `prefix`/`middleware`; no route model bindings of note. `boot()` has the Laravel-default route loading commented out (:41-50).

| File | URL prefix | Middleware at registration | RSP lines | Notes |
|---|---|---|---|---|
| routes/api.php | `/api` | `api` group | :238-243 | `api` group = `throttle:1000,1`, SubstituteBindings, `api.jwt` (Kernel.php:47-53) |
| routes/resultapi.php | `/api` | `api` | :270-275 | file adds `api.session` per group (resultapi.php:52, :59) |
| routes/easycomapi.php | `/api` | `api` | :284-289 | file adds prefix `easy_com` + `api.session` (easycomapi.php:36) |
| routes/api_hostel.php | `/api` | `api` | :155-161 | file adds `api.session` (api_hostel.php:12) |
| routes/documents.php | `/api/documents` | `api` | :447-451 | file adds `api.session` (documents.php:42; routes at :45,:48,:51) |
| routes/platform.php | `/api/platform` | `api` | :431-435 | per-route `lms.auth` + `perm:` |
| routes/teacherapi.php | **none** (URL is bare, e.g. `/teacher_homescreen`) | **NONE** (not web, not api: no CSRF, no throttle, no `api.jwt`) | :390-393 | auth is inside each controller method |
| routes/adminapi.php | **none** (e.g. `/admin_login`, `/get_adminStudentList`) | **NONE** | :396-399 | same as above |
| routes/user.php, settings.php, ptm.php, consent.php, frontdesk.php, visitor_management.php, tranceport.php, hostel_management.php, cal.php, inward_outward.php, skill.php, implementation.php | none | `web` group (EncryptCookies, StartSession, VerifyCsrfToken, `api.jwt`; Kernel.php:34-45) | user :246-250, settings :253-257, ptm :334-338, consent :327-331, frontdesk :362-366, visitor :306-310, tranceport :348-352, hostel_mgmt :299-303, cal :341-345, inward_outward :313-317, skill :409-413, implementation :369-373 | resource-style Blade routes; each group adds `session,menu,logRoute,check_permissions` |
| routes/custom_module.php | none | `web` | :148-153 | `session,menu,logRoute` only, no `check_permissions` (custom_module.php:6); the donation routes at :36-37 do carry `check_permissions` |
| routes/driver_management.php | - | **NOT REGISTERED** | - | no `map*` method references it; grep over app/, bootstrap/, config/, routes/ finds only the file itself. Its controller `driver_masterController` is not even imported (driver_management.php:4-6). Dead file. |

Other route files registered in the same provider but outside this survey: web, result, student, inventory, fees, admission, lms, hrms, brain, mobile_page_builder, talent/organization/task/competency management, g2g_lms (RSP :58-131).

CSRF: `app/Http/Middleware/VerifyCsrfToken.php:22-27` exempts `api/*`, `circular/*`, `fees/*` and the full URLs `https://erp.triz.co.in/*`, `https://dev.triz.co.in/*`, `http://127.0.0.1:8000/*`. So on those hosts every web-group POST (e.g. `/ptmBookAPI`, `/consentListAPI`) is CSRF-exempt; on any other host a mobile POST to a web-group route without an XSRF token would 419. teacherapi/adminapi are outside the web group so CSRF never applies.

---------------------------------------------------------------------

## 2. Authentication model that decides what a mobile app can call

### 2.1 Four different token shapes (this is the main compatibility trap)

| Issued by | JWT payload | Source | Works with `api.session` / `RequireApiJwt`? |
|---|---|---|---|
| `POST /api/api-login` (email + password; staff **and** students) | `{id, sub_institute_id, is_admin, client_id, user_profile_id, is_student}` plus `iat`/`exp` only if env `JWT_TTL_MINUTES>0` | ApiLoginController.php:417-434 | **Yes** |
| `POST /api/check_otp` (student/parent OTP) | `{student_id, sub_institute_id}` only. No `id`, no `exp` | apiController.php:336-343 | **No**: both require `id` (HydratesLegacyApiSession.php:73-75; RequireApiJwt.php:152-154 -> 401 "Invalid token payload") |
| `POST /api/teacher_check_otp` | `{teacher_id, sub_institute_id}`. No `id`, no `exp` | apiController.php:531-536 | **No**. Also every teacherapi method calls `resolveActingTeacherId()` which needs `payload.id` (teacherapiController.php:75-80) and returns 403 "Token context could not be resolved." So an OTP-login teacher token is rejected by all 33 teacherapi call sites |
| `POST /admin_check_otp` | `{exp(+30d), user_id, sub_institute_id, mobile}` | adminapiController.php:148-153 | **No** (no `id`). adminapi methods only check the signature, so it works there |

Conclusion for a new app: log in with `/api/api-login` and send `Authorization: Bearer <data.user_token>`. The OTP flows are legacy (their tokens only satisfy signature-only checks such as the ptm/consent/calendar/admin endpoints).

Token transport: `GenTux GetsJwtToken` reads `Authorization: Bearer ...`, else input `token` unless env `JWT_HEADER_ONLY=true|1` (vendor/generationtux/jwt-artisan/src/GetsJwtToken.php:31-39, :50-54). The Leave and Attendance controllers additionally **require the token in the `token` input** (ResolvesLeaveContext.php:29, ResolvesAttendanceContext.php:32) and answer 401 "Token not provided" to a header-only call; they also take `user_id` from the request body (ResolvesLeaveContext.php:~44-49 `user_id` => request input) rather than the token. The `/api/hrms/*` routes (api.php:134-139) are the token-bound alternative.

### 2.2 Middleware you will meet

- `api.jwt` (RequireApiJwt) is attached to **both** `web` (Kernel.php:44) and `api` (Kernel.php:51) groups, but it only acts on request paths starting `api/` that match `config/api_guard.php:88-124` `protect` list (RequireApiJwt.php:65-94, path test :96-104). When it acts it needs a valid Bearer JWT or a web session (:40-47), forces `sub_institute_id` in the body to equal the token school unless the caller is multi-school admin (:49-56, :199-210), and 403s student/parent tokens for the `staff` list (config/api_guard.php:54-86; RequireApiJwt.php:58-60). `config/api_guard.php:28-41` `public` = `POST online_admission_confirm`, g2g certificate verify, `mobile/web-handoff/claims`, WhatsApp webhooks. Kill switch `API_GUARD_ENFORCE` (config/api_guard.php:26). Because it matches on the **path**, routes in teacherapi/adminapi (no `api/` prefix, no group) are never covered.
- `api.session` (ApiSessionHydrator -> HydratesLegacyApiSession.php:25-45, 64-174): validates Bearer JWT, then fills an in-memory session (user_id, sub_institute_id, syear, term_id, user_profile_id/name, is_admin, is_student, class-teacher arrays) from the **token**, not the body; forces `type=API` (:42). Syear/term default to the current academic year; if none is current it returns 422 `{success:false,message:"Academic Term Date Expired"}` (:83-96). Optional body `syear`/`term_id` override (:80-81).
- `staff.only` (RequireStaffRole.php:36-49): 403 `{status_code:0,message}` for student/parent. `lms.auth` (LmsApiAuth.php:50-): JWT check but **warn-only by default** (`lms_content.api_auth_enforce` defaults false, LmsApiAuth.php:55-58) so an anonymous call is logged and let through. `perm:` (RequirePermission) likewise warn-only per comment at routes/documents.php:125-128. `check_permissions` (checkPermission.php:30-110) looks the **route name** up in `tblmenumaster.link` (:38-40); for an unnamed route the lookup runs with a null name (`link IS NULL`), so whether any rights apply is not verified.
- `session` (SessionMiddleware.php:22-37): if request `type` is `API` or `JSON` it validates the Bearer JWT and hydrates session (so legacy Blade resource routes become callable by a mobile client that sends `type=API` + Bearer, **provided the token has `id`**); otherwise requires a login session. `menu` is skipped for `type=API|JSON` (MenuMiddleware.php:34-36). Legacy controllers then answer JSON via `is_mobile()` (Helpers/Helper.php:27-60), which renames `status_code` to upper-cased `status`.

### 2.3 Response envelopes in use (a client needs an adapter per family)

| Family | Shape | Where |
|---|---|---|
| Legacy teacher/admin/student | `json_encode()` string (Content-Type text/html), `{status:1|0,message,data}`; validation failure = HTTP 200 `{response:{field:[msg]}}` (no status key); token failure = HTTP 401 `{status:'2',message,data:[]}` | teacherapi/adminapi (e.g. adminapiController.php:206-228, 412-421), ptm/consent/calendar |
| Legacy but `status_code` | `{status_code:1|0,message,data}` | ptm/consent/user teacherListAPI (e.g. ptmattenedstatusController.php:243-262) |
| LMS homework / assignment | `{status_code:1|0,message,data,...}`; 422 `{status_code:0,message,errors}` | StudentHomework/HomeworkSubmission/LmsAssignment/ApiLmsCourse controllers |
| Role dashboards, teacher timetable, fees dashboard | `{status:'1',message:'Success',summary...}`; 403 `{status:'0',message}` | RoleDashboardApiController.php:174-191 etc. |
| New envelope | `{success:true|false,message,data,errors}` (+`meta`) | resultapi (BaseResultApiController.php:30-54), easycomapi (BaseEasyComApiController.php:43-69), bootstrap/own-profile/hrms |
| Setup CRUD modules | `{status_code,message,errors,data}` | Transportation/AcademicSetup/GeneralSetup/Inventory/CustomField (TransportationApiController.php:30-33) |
| Login | `{status:1,message,data{...,user_token},academicTerms,...}` (api-login) vs `json_encode` `{status:'1',data:[...]}` (OTP flows) | ApiLoginController.php:437-476 |

Validation failures return HTTP 422 in some families and HTTP 200 in others.

---------------------------------------------------------------------

## 3. Key mobile endpoints, hand-verified (request, validation, response, with file:line)

Role tags: S = student/parent token, T = teacher, A = admin, C = common. "Auth" = what actually gates it. Identity-trust notes in the last column of each row are findings, not assumptions.

### 3.1 Common / session / bootstrap

| # | Endpoint | Role | Auth | Request + validation | Response | Notes |
|---|---|---|---|---|---|---|
| 1 | `POST /api/api-login` (api.php:95) -> ApiLoginController@login :24-477 | C | none (throttle:20,1) | `email` required\|email, `password` required, `type` nullable\|string (:26-30; `type` read at :42, no further use found in file). Staff looked up first in tbluser (status=1), else tblstudent by email (:44-91); legacy md5 allowed for students (:82); passwords upgraded by verifyAndUpgradePassword (:54, :632) | 200 `{status:1,message,api_login_url,data:{id,user_name,first_name,middle_name,last_name,email,mobile,gender,birthdate,address,user_profile,user_profile_id,profile_parent_id,sub_institute_id,mobile_syear,client_id,is_admin,join_year,image,last_login,short_code,school_name,logo,institute_type,multi_school,hrms_rights,user_token,host_name,erp_rights},academicTerms[],academicYears[],student_academic[],subjects{<school>:[{id,subject_code,subject_name,short_name,subject_type,status}]}}` (:437-476). 422 `{status:0,message:'Parameter Missing',errors}` (:33-37); 401 `{status:0,message:'Invalid User Id And Password'}` (:55-58,76-86) | Only login whose token works with every `api.session` route. `exp` only if `JWT_TTL_MINUTES>0` (:428-432) |
| 2 | `GET /api/academic-terms` (api.php:96) -> ApiLoginController@academicTerms :487-499 | C | G (config/api_guard.php:89) | query `sub_institute_id`, `syear` (no validation) | `{success:true,data:[academic_year rows]}` | school pinned to token by guard |
| 3 | `GET /api/mobile/bootstrap` (api.php:100) -> MobileBootstrapApiController@show :23-95 | C | RT:api.session | none; identity from token | `{success,message,data:{user:{id,sub_institute_id,user_profile_id,user_profile_name,is_student,is_admin,school_name},menu:[{main_title,menu_type,color,background_image,contents:[{title,icon,api,api_param,screen_name,render_type,web_url,open_mode}]}]}}` (:79-94). Table `mobile_homescreen` for students else `teacher_mobile_homescreen` (:35) | Safer replacement for legacy `/api/homescreen` and `/teacher_homescreen` (class doc :15-19) |
| 4 | `POST /api/homescreen` (api.php:82, duplicate at :86) -> apiController@homescreen :683-784 | S | header JWT signature only (:686) | body `sub_institute_id` required\|numeric, `user_profile_id` required\|numeric, `user_profile_name` required (:705-709) - **client-chosen**, so a token for one role can request another role's menu (bootstrap doc :15-19) | json_encode string `{status:'1',message,data:[{main_title,menu_type,main_itle_color(sic),main_title_background_image,contents:[{sub_title,sub_title_icon,sub_title_api,sub_title_api_param,screen_name,render_type,web_url,open_mode}]}]}`; Banner rows carry `api,api_param,screen_name` instead of `contents` (:742-751); token failure is HTTP **200** `{status:'2'}` (:686-695); validation failure puts messages under `response` (:712) | |
| 5 | `GET /api/own-profile` (api.php:98) -> OwnProfileApiController@show :13-43 | C | RT:api.session | none | `{success,message,data:{id,full_name,email,mobile,birthdate,join_year,address,image,user_profile,school_name}}`; 404 `{success:false,message:'Profile not found.',data:null}` (:23-30) | student detected by `user_profile_name==='Student'` (:17) |
| 6 | `POST /api/mobile/web-handoff` (api.php:106) -> MobileWebHandoffApiController@create :47-132 | C | RT:api.session | `web_url` required\|string\|max:2000 (:58); must resolve to a trusted host else 422 (:75-85) | `{status:'1',message,data:{url,expires_in:60}}` (:122-129); 60 s single-use ticket (TICKET_TTL_SECONDS :41); 503 if table `mobile_web_handoff_token` missing (:49-55) | opens ERP/Next.js pages already logged in |
| 7 | `GET /api/mobile/web-handoff/claims` (api.php:115) -> :143-175 | C | public by design (config/api_guard.php:32); the single-use ticket authenticates | query `ticket` (422 if empty :149-151) | identity JSON (identityPayload) or 401 expired (:172) | CORS-dependent |
| 8 | `GET /api/mobile/dynamic-page/{pageKey}` (api.php:120) -> MobileDynamicPageApiController@show :27-65 | C | RT:api.session | path `pageKey` | `{status:'1',message,data:{page_key,title,data_endpoint,tiles:[{field_key,display_key,label,field_type,drill_endpoint}]}}`; 404 not configured; 503 tables missing (:29-31, 42) | schema only, live data comes from `data_endpoint` |
| 9 | `POST /api/gcm_insert` (api.php:87) -> apiController@gcm_insert :877-939 | C | header JWT signature (:880) | `mobile_no` required\|string, `sub_institute_id` required, `gcm_regid`,`imei_no`,`curr_version`,`new_version` nullable\|string (:895-902); upsert on (sub_institute_id,mobile_no) into `gcm_users` (:912-926) | 200 `{status:1,message:'Record Added|Updated Successfully'}`; 401 `{status:'2'}`; 422 `{status:0,message:'Parameter Missing',errors}` | the only push-token registration route in these files; tenant/mobile from body, not token |
| 10 | `GET/PUT /api/dashboard-preferences/{dashboardKey}` (api.php:168-171) -> UserDashboardPreferenceApiController :30-97 | C | RT:api.session | PUT: `hidden_widgets` present\|array\|max:100, `hidden_widgets.*` string regex `[a-z0-9][a-z0-9._-]{0,99}` (:45-48) | `{status:'1',dashboard_key,hidden_widgets[],updated_at}` | owner = token user + is_student (:77-85) |

### 3.2 Student / parent

| # | Endpoint | Auth | Request + validation | Response | Notes |
|---|---|---|---|---|---|
| 11 | `POST /api/login` (api.php:79) -> apiController@login :18-125 (OTP step 1) | public, throttle:20,1 | `mobile` required\|numeric (:23-25). Matches tblstudent.mobile / mother_mobile / student_mobile joined to active sms_api_details, excludes school 254 (:54-71) | json_encode string `{status:'1'|'0',message,data:[]}` (:117-124) | **Hard-coded OTP `123456` for two phone numbers (:82-83, teacher flow :165-166).** For school ids [328..341,61] the OTP is the DOB as ddmmyy (:81,84-85). OTP stored in tblstudent.otp (:108-115) |
| 12 | `POST /api/check_otp` (api.php:81) -> :204-403 (step 2) | public, throttle:10,1 | `mobile`,`otp` required\|numeric (:209-212) but the lookups read `$_REQUEST` directly before validation (:215-255). One entry per child | json_encode `{status,message,data:[{student_id,enrollment_no,sub_institute_id,mobile,otp,first_name,middle_name,father_name,mother_name,image_path,image,last_name,roll_no,std_name,section,division,address,email,gender,house,birthday,is_lms,school_logo,school_name,syear,standard_id,division_id,user_profile_name,user_profile_id,term_data[],token,lms_user_id}]}` (:358-392) | **Echoes the OTP in the response (:363).** Token payload lacks `id`/`exp` (:336-343) so it cannot call api.session routes. A parent logging in by mobile gets all children in `data[]`; there is no separate parent endpoint set in these files |
| 13 | `POST /api/student-dashboard/summary` (api.php:162) -> RoleDashboardApiController@studentSummary :305-410 | RT:api.session | none; optional `syear`,`term_id`. 403 `{status:'0',message}` unless `is_student` (:313) | `{status,message,summary:{total_subjects,pending_homework,pending_assignments},enrollment,my_subjects,pending_homework,pending_assignments,recent_circulars,task_status:[{label,value}],achievements:[]}` (:390-408) | token-bound identity |
| 14 | `POST /api/lms-homework/list` (api.php:283) -> StudentHomeworkApiController@index :20-91 | G (config/api_guard.php:115): Bearer needed, `sub_institute_id` must equal token school | body (no validation): `sub_institute_id`,`syear`,`user_profile_name`,`user_id`,`standard_id`,`subject_id`,`division_id`,`from_date`,`to_date`,`type`(default `Homework`) (:22-31). `user_profile_name=='Student'` -> `h.student_id=user_id` (:51-52) | `{status_code:1,message:'SUCCESS',data:[{id,title,description,date,submission_date,student_id,standard_id,division_id,subject_id,image,type,standard_name,division_name,subject_name}]}` (:46,86-90) | `user_id` and `user_profile_name` come from the body, so one student can read another's list within the school; the newer `my-submissions` below pins to the token |
| 15 | `POST /api/lms-homework/my-submissions` (api.php:310) -> HomeworkSubmissionApiController@mySubmissions :719-780 | RT:api.session; student id forced from token (:72-79) | optional `sub_institute_id`,`syear` | `{status_code:1,message,data:[{id,title,subject_id,subject_name,date,date_fmt,submission_date,submission_date_fmt,reference_file_url,source_type,status,submission_files[],submission_remarks,teacher_remarks,ai_status,ai_failure_reason,ai_score,ai_total_questions,ai_percentage,reviewed_pdf_path,evaluated_at,feedback_published}]}` (:745-777) | pending rows included |
| 16 | `POST /api/lms-homework/detail/{id}` (api.php:306) -> :160-241 | RT:api.session; 403 if homework.student_id != token student (:174-179) | path `id`; optional `sub_institute_id`,`syear` filters (:162-168) | `{status_code:1,message,data:{homework:{id,title,description,subject_id,subject_name,standard_id,standard_name,division_id,division_name,date,submission_date,created_by,teacher_name,reference_file_url,sourceType,questions[]},submissions:[entry]}}` (:214-239); entry shape :126-153 | |
| 17 | `POST /api/lms-homework/submission/store` (api.php:307) -> :272-372 | RT:api.session | multipart: `homework_id` required\|numeric, `files` required\|array\|min:1\|max:5, `files.*` file\|mimes:pdf,jpg,jpeg,png\|max:10240 (KB), `remarks` nullable\|string, `sub_institute_id`,`syear` nullable\|numeric (:274-281). 403 if not own homework (:306-308); 422 if status Under Review/Reviewed (:310-312) | 201 `{status_code:1,message:'Homework submitted successfully',data:{submission:{...}}}` (:365-371); 422 `{status_code:0,message:'Validation failed',errors}` (:284) | AI evaluation job dispatched with `(int)$sub_institute_id` from the body (:346): omitted -> 0 |
| 18 | `POST /api/lms-assignment/submission-list` and `/submission-store` (api.php:374-375, override the unguarded L341-342) -> LmsAssignmentApiController :691-823 | RT:api.session; student id forced from token (:149-156) | list: `sub_institute_id`,`syear` required (manual 422 :697-702). store: multipart `image[<assignment_id>]` files (:746-752); no mime/size rule found in :736-823 | list `{status_code:1,message,data:[lms_assignment row + subject_name,exam_pdf_url,submission_file_url,homework_file_url,created_date_fmt,submission_date_fmt]}` (:706-728); store `{status_code,message,updated}` 200/422 (:818-822) | |
| 19 | `POST/GET /api/lms-courses` (api.php:226) -> ApiLmsCourseController@index :62-86 | G (config:114) | `sub_institute_id` (body\|query\|session, 422 if missing :70-75), `syear`,`user_profile_name`,`user_id` | `{status_code:1,message,lms_subject,content_category,sub_institute_id}` (:79-85) | `POST /api/lms-chapter-content` :704 needs `chapter_id` required\|integer (:706-708); `POST /api/lms-chapters` :764 blocks student/parent using the **client-supplied** `user_profile_name` first (:767-777) |
| 20 | `GET /api/result/all-results` and `/{id}` (resultapi.php:244-245) -> AllResultsApiController :28-60 | RT:api.session | list: `search`,sort,page (BaseResultApiController.php:261-268); show: path `id` | `{success,message,data[],meta:{pagination}}`; show returns the PDF link for `result_html.id` | show only checks `result_html.id` exists (:47-50): no tenant or student scoping found in the file |
| 21 | `GET /api/result/current-result` (resultapi.php:251) -> ResultLookupApiController@currentResult :109-128 | RT:api.session | `standard` required\|integer, `student_id` required\|integer, `subject_id` nullable\|integer (:112-117); sub_institute_id/syear default from session (:23-27) | `{success,message,data:{standard totals, subject/exam marks, chapter analysis, profile}}` | `student_id` is not compared with the token user (no check found in file) |
| 22 | `POST /studentCalenderAPI` (cal.php:21) -> calendar_controller@studentCalenderAPI :281-322 | header JWT signature only (:284) | `student_id`,`sub_institute_id`,`syear` all non-empty else `{status:0,message:'Parameter Missing'}`; optional `action` = event_type | `{status:1,message:'Success',data:[{school_date,title,description,event_type}]}` | works with OTP tokens (signature-only) |
| 23 | `GET /calendar/fetchData` (cal.php:22) -> :89-146 | **NONE-FOUND** | `student_id`,`sub_institute_id`,`syear` required\|numeric, `type` in:holiday,event,vacation,"" (:93-98) | `{response:[calendar_events rows],success:true}` | unauthenticated student calendar read |
| 24 | `POST /consentListAPI` (consent.php:14) -> consent_masterController@consentListAPI :156-197 | JWT signature only (:160) | `student_id`,`sub_institute_id`,`syear` | `{status_code:1,message,data:[{ID,title,consent_date,accountable_status,consent_status,amount,imprest_head_id,created_by}]}` | |
| 25 | `POST /ptmTeacherListAPI`,`/ptmBookingTimeAPI`,`/ptmBookingStatusAPI`,`/ptmBookAPI` (ptm.php:15-18) -> ptmattenedstatusController :387, :329, :269, :222 | JWT signature only (:226,273,333,391) | common: `student_id`,`sub_institute_id`,`syear`; `ptmBookingTimeAPI` +`date`; `ptmBookingStatusAPI` +`time_slot_id`; `ptmBookAPI` +`booking_id`(=time slot id),`teacher_id`,`date` (all manual non-empty checks) | `{status_code:1,message:'Success'}` / `{status_code:0,message:'Parameter Missing'}`; book inserts `ptm_booking_master` CONFIRM_STATUS='Confirm' (:243-251) | tenant and student from body |
| 26 | `GET /api/lms/leaderboard`, `/filters`, `/rankings`, `/{userId}`; `GET/POST /api/lms/social-collaborative...` (api.php:394-397, 414-421) | RT:api.session | see controllers (not deep-read) | | listed only |

### 3.3 Teacher

| # | Endpoint | Auth | Request + validation | Response | Notes |
|---|---|---|---|---|---|
| 27 | `POST /api/teacherlogin` (api.php:83) / `POST /api/teacher_check_otp` (api.php:84) -> apiController :127-202 / :489-582 | public, throttle 20 / 10 | `mobile` required\|numeric (+`otp` for check) (:131-133, 494-497); OTP rows updated only for profiles Teacher/Employee (:192) but check_otp matches any active tbluser with that mobile+otp (:504-522) | json_encode; check_otp `data{teacher_id,user_name,first_name,middle_name,last_name,sub_institute_id,standard_division,standard_division_title,email,mobile,otp,birthdate,address,gender,image,join_year,school_logo,school_name,user_profile_name,user_profile_id,syear,term_data[],token}` (:546-570) | `$data = $data[0]` unguarded (:158, :525): unknown mobile raises an undefined-offset error (500). Echoes OTP (:557). Token lacks `id` (see 2.1) |
| 28 | `POST /api/teacher-dashboard/summary` (api.php:159) -> RoleDashboardApiController@teacherSummary :194-303 | RT:api.session; 403 unless teacher (:200-203) | none | `{status,message,summary:{total_classes,total_students,total_subjects,homework_to_review,assignments_to_grade},my_classes,my_subjects,assignments_to_grade,recent_circulars,students_by_class}` (:287-302) | |
| 29 | `POST /api/teacher-timetable/summary` (api.php:160) -> TeacherTimetableApiController@summary :28-64 | RT:api.session; only profile `teacher`/`lms teacher` (:34-38) | none | `{status:'1',message,timetable:[{week_day,period_id,period_title,start_time,end_time,subject_id,subject_name,standard_id,standard_name,division_id,division_name}]}` | source = `timetable.teacher_id = token user` |
| 30 | `POST /api/teacher/assignments/standards` and `/divisions` (api.php:49, inline) -> TeacherAssignmentMobileApiController :4 | RT:api.session | divisions: `standard_id` required\|integer; abort 401 if no session ids | `{status:1,data:[{id,name}]}` | one-line minified controller file |
| 31 | `POST /api/lms-homework/store` (api.php:284) -> StudentHomeworkApiController@store :93-286 | G+staff (config:72) | `sub_institute_id` required\|numeric, `syear` required\|numeric, `students` required_unless:assign_mode,all, `assign_mode` nullable\|in:selected,all, `title` required\|string, `description` nullable\|string, `standard_id` required\|numeric, `subject_id` required\|numeric, `submission_date` nullable\|string (:95-105); extras `division_id`,`teacher_id`,`source_type`(attachment\|question_bank\|exam_paper),`question_ids`,`exam_paper_id`,`image` file,`prompt` | 201 `{status_code:1,message:'Homework Added successfully',homework_ids:[...]}` (:281-285); 422 `{status_code:0,message:'Validation failed',errors}` / "Select at least one student." / 404 "Students Not Found with syear X" | `created_by` = body `teacher_id` or `X-User-Id` header (:262), not the token |
| 32 | `POST /api/lms-homework/review-list`, `/review-detail/{id}`, `/review-store`, `/review-reprocess/{id}` (api.php:313-317) -> HomeworkSubmissionApiController :378-575 | RT:api.session+staff.only | review-store: `submission_id` required\|numeric, `teacher_remarks` nullable\|string, `status` required\|in:Under Review,Reviewed,Rejected, `publish` nullable\|boolean, `marks` nullable\|array, `marks.*.question_no` required_with:marks\|numeric (:457-464) | `{status_code:1,message,data:{...entry}}` (:506-510); review-list rows `{submission_id,homework_id,student_id,student_name,roll_no,standard,division,subject,title,status,ai_status,ai_score,ai_percentage,submitted_at,submitted_at_fmt}` (:400-405) | `find($id)` with no tenant filter in reviewDetail (:427) and reviewStore (:472): a staff token can open another school's submission by id |
| 33 | `POST /teacher_homescreen` (teacherapi.php:19) -> teacherapiController@teacher_homescreen :195-286 | CTRL:token via resolveActingTeacherId (:197, helper :56-106) | body `sub_institute_id`,`user_profile_id` required\|numeric, `user_profile_name` required (:209-213) | same menu structure as #4 from `teacher_mobile_homescreen`; status/response keys as legacy | `/api/mobile/bootstrap` is the token-bound equivalent |
| 34 | `POST /get_teacher_timetablewiseStandard` / `...Subject` / `...Division` (teacherapi.php:45-49) -> :1019 / :1057 / :1100 | CTRL:token (acting teacher forced to token user unless admin, :94-105) | `teacher_id`,`syear`,`sub_institute_id` required\|numeric (+`standard_id` for Subject/Division) (:1032-1036, 1071-1076, 1114-1119) | `{status:1,message:'Success',data:[{std_id,std_name,grade_id}]}` (:1044-1049); validation failure = `{response:{...}}` HTTP 200 | |
| 35 | `POST /get_teacherPTMBookingList` / `/add_teacherPTMStatus` (teacherapi.php:55-57) -> :1251 / :1294 | CTRL:token | list: `teacher_id`,`syear`,`sub_institute_id` required\|numeric (:1259-1263); status: `teacher_id`,`booking_id` numeric, `status` in:Yes,No, `remarks`,`ip_address` required, `entry_date` date, `syear`,`sub_institute_id` (:1302-1311) | list `{status:1,message,data:[{ID,DATE,TEACHER_ID,TIME_SLOT_ID,CONFIRM_STATUS,STUDENT_ID,CREATED_ON,SUB_INSTITUTE_ID,PTM_ATTENDED_STATUS,PTM_ATTENDED_REMARKS,PTM_ATTENDED_ENTRY_DATE,FROM_TIME,TO_TIME,PTM_DATE}]}`; save `{status:1,message:'Record Added'}` | |
| 36 | `POST /add_teacherLessonPlanning` (teacherapi.php:51) -> :1151-1196 | CTRL:token | `teacher_id`,`user_profile_id`,`standard_id`,`subject_id`,`division_id` numeric, `date` date, `title` required, `syear`,`sub_institute_id` (:1159-1169); `description` optional | `{status:1,message:'Record Added'}` | `grade_id` hard-coded `'1'` (:1181) |
| 37 | `POST /get_teachertaskAPI` / `/add_teachertaskAPI` (teacherapi.php:68-70) -> :1493 / :1544 | CTRL:token | add: `sub_institute_id`,`syear`,`teacher_id` numeric, `title`,`allocated_to` required, `date` date (:1561-1568) | legacy `{status,message}` | |
| 38 | `GET /api/hrms/today`, `POST /api/hrms/punch`, `GET /api/hrms/attendance`, `GET /api/hrms/leaves` (api.php:135-138) -> HrmsMobileApiController :19-68 | RT:api.session; user/tenant from token (:14-17) | punch: `action` required\|in:in,out, `address` nullable\|string\|max:1000 (:28); attendance: `month` YYYY-MM (:48-49) | `{success:true,data:{id,day,punchin_time,punchout_time,timestamp_diff}}` (:70-74); leaves `{success,data:{summary:{total,used,remaining},leave_types:[{leave_type,total,used}]}}` (:67); 422 `{success:false,message}` for double punch (:34,38,39) | staff-only (404 otherwise :58). Best staff self-service surface |
| 39 | `GET/POST /api/leave/requests`, `GET /api/leave/options`, `/balances` (api.php:932-941) -> Leave\LeaveRequestApiController :40-368 | CTRL:token, but only via `token` input (ResolvesLeaveContext.php:29); not RT, not in api_guard | store: `leave_type_id` required\|integer\|exists, `day_type` required\|in:full,half, `from_date` required\|date, `to_date` required_if:day_type,full\|date\|after_or_equal:from_date, `slot` required_if:day_type,half\|in:first_half,second_half, `comment` required\|string\|max:255, `employee_id` nullable\|integer\|exists:tbluser,id, `department_id` nullable (:154-162); list `per_page`(1-200),`page`,`sort_by`,`sort_dir`,filters (:47-58) | store `{status:1,message,data:{id}}` 201/200 (:222-226); validation 422 `{status:0,message,errors}` | employee = body `employee_id` or body `user_id` (:174), tenant from token: any token holder in a school can file/decide leave for another employee; `decision` (:232-278) has no role check found |
| 40 | `GET /api/attendance/my-attendance`, `POST /api/attendance/punch-in`, `/punch-out` (api.php:989-991) -> Attendance\AttendanceTrackingApiController :35, :202, :258 | CTRL:token via `token` input (ResolvesAttendanceContext.php:32) | my-attendance needs `user_id` (400 if missing :47); punch-in `employee`,`indate`,`intime` required (:210-214); punch-out `employee`,`outdate` (:266-270) | `{status:0|1,message,...}` | employee id from body |
| 41 | `POST /api/result/marks-entry/create...` family (resultapi.php:193-200) -> MarksEntryApiController | RT:api.session | `GET create` needs `grade`,`standard`,`division`,`term`,`subject`,`exam_master`,`exam` (:42-50); `POST /` body `values` required\|array\|min:1, `values.*.exam_id` required (:75-78) shape `{values:{<student_id>:{exam_id,points,...}}}`; `POST approve` `term_id,standard_id,division_id,subject_id,exam_id,approve` (:101-107) | `{success,message,data}` | legacy controllers read `$_REQUEST`: send query/form fields, not a raw JSON body (StudentAttendanceMasterApiController.php:16-19) |

### 3.4 Admin

| # | Endpoint | Auth | Request + validation | Response | Notes |
|---|---|---|---|---|---|
| 42 | `POST /admin_login`, `/admin_check_otp` (adminapi.php:25-26) -> adminapiController :39-112 / :114-198 | public, no throttle (route has none; adminapi has no middleware group) | `mobile` required\|numeric (+`otp`) (:43-45,118-121); only profiles with `parent_id=1` (:54,129) | json_encode `{status,message,data:{user_id,user_name,...,otp,...,school_logo,school_name,user_profile_name,user_profile_id,syear,term_data[],token}}` (:163-185) | `$data = $data[0]` unguarded (:65); hard-coded OTP `123456` for 9979176562 (:74-75); echoes OTP (:172); token `exp` +30d (:149) |
| 43 | `POST /api/admin-dashboard/summary` (api.php:158) -> RoleDashboardApiController@adminSummary :44-192 | RT:api.session; 403 unless admin profile (:52-54, isAdminProfile :29-42) | none | `{status,message,summary:{total_students,total_staff,total_classes,fees_collected_today,admissions_this_year,homework_today,circulars_today,pending_parent_communications},upcoming_birthdays[],recent_fee_receipts[],fee_collection_trend[],students_by_class[]}` (:174-191) | |
| 44 | `POST /api/fees-dashboard/summary`, `/defaulters` (api.php:142,145) -> FeesDashboardApiController :22-177 / :202- | RT:api.session+check_permissions | `sub_institute_id` required, `syear` required, `month_id`,`grade_id`,`standard_id`,`section_id` nullable, `from_date`,`to_date` nullable\|date (:24-33) | `{status:'1',message,context{...},summary{collected_amount,collected_display,demand_amount,outstanding_amount,collection_rate,...},collection_vs_target,headwise[],payment_mode_mix[]}` (:169-177) | tenant is the **body** `sub_institute_id` and not in the api_guard list, so no tenant == token check found in this path (RequireApiJwt does not run for `fees-dashboard/*`); route is unnamed so check_permissions looks up a null route name (checkPermission.php:38-44) - effect not verified |
| 45 | `POST /get_adminStudentList` (adminapi.php:37) -> :409-489 | JWT signature only (:412); tenant from body | `sub_institute_id`,`syear` required\|numeric; optional `grade_id`,`standard_id`,`division_id` (:431-434) | `{status:1,data:[{id,student_name,syear,enrollment_no,roll_no,dob,address,mobile,email,student_image,standard_id,division_id,academic_section,standard_name,division_name,gender,admission_year,mother_name,father_name}]}`; `{status:0,message:'No Record'}` | any valid token (even a student's, any school) can list any school's students |
| 46 | `POST /get_attendanceGraphAPI`, `/get_feesGraphAPI` (adminapi.php:63-65) -> :1212 / :1344 | JWT signature only | `sub_institute_id`,`syear` required\|numeric, `date` required\|date (:1235-1239, 1367-1371) | per-class present/absent counts / fees chart (`{status:1,message:'Success',data:chart}` :1483-1485) | **bugs**: attendance ignores `date` and uses today (:1244); fees graph hard-codes `$date="2019-08-22"` (:1376) and its join string `"se ON s.id = ..."` is malformed SQL (:1380): treat as stale/broken |
| 47 | `POST /get_adminLeaveApplicationListAPI` (adminapi.php:41) -> :541-597 and `POST /add_adminLeaveApplicationSaveAPI` (adminapi.php:43) -> :599-647 | JWT signature only | list: `sub_institute_id`,`syear` (:559-562); save: `sub_institute_id`,`syear`,`admin_id`,`leave_app_id` numeric, `reply`,`status` required (:622-629) | list `{status:1,data:[{leave_app_id,student_name,student_image,std_name,title,message,file_name,apply_date,reply,reply_on,reply_by,status}]}`; save `{status:1,message:'Record Added'}` | `reply_by` = body `admin_id`; no role check found |
| 48 | `POST /add_adminCircularAPI` (adminapi.php:87) -> :2103-2154; `POST /add_SendNotificationAPI` (adminapi.php:91) -> :2157-; `POST /add_adminSendSmsAPI` (adminapi.php:59) -> :1053-; `POST /add_adminSendEmailAPI` -> :1116- | JWT signature only | circular: `syear`,`user_id`,`sub_institute_id` numeric, `standard_id`,`division_id` (comma lists),`title`,`message` required, `type` in:1,2, `date_` date (:2119-2129); notification: `sub_institute_id`,`syear`,`user_id` numeric, `student_id` (comma list),`description` (:2172-2178); sms: `admin_id`,`sub_institute_id`,`mobile_number`,`sms_text`,`syear` (:1075-1081) | `{status:1,message:'Record Added'}` style | any token can send SMS/notification for any school |
| 49 | `GET /api/easy_com/send-notification-parents/options`, `/recipients`, `POST /api/easy_com/send-notification-parents` (easycomapi.php:75-77) -> SendNotificationParentsApiController :35, :52, :103 | RT:api.session; **no `staff.only`** and no role check found in BaseEasyComApiController.php or the controller | recipients: `grade`,`standard`,`division` required, `admission_year` nullable (:56-61); send: `grade`,`standard`,`division` required, `notificationText` required\|string\|max:1000, `sendNotification[<mobile>]=on` at least one (:107-114) | `{success,message,data{...stu_data[]}}` / validation 422 `{success:false,message,data:null,errors}` | a student token reaches the staff send endpoints; same for send-sms/email/whatsapp (easycomapi.php:68-83) |
| 50 | `GET/POST /api/mobile/dynamic-page-admin/*` (api.php:126-132) | RT:api.session + in-controller gate admin/super admin/is_admin>=1 (MobileDynamicPageAdminApiController.php:31-38) | | 403 `{status:'0',message}` otherwise | |
| 51 | `GET/POST /api/mobile-app-rights/*`, `/api/groupwise-rights`, `/api/individual-rights`, `/api/users`, `/api/user-profiles` (api.php:756-781) | CTRL:token + actor/permission check (e.g. UserManagementApiController.php:46-92) | | `{status_code,...}` | admin web UI backing; low mobile relevance |

---------------------------------------------------------------------

## 4. Stale / duplicate / commented-out / dead

| Item | Evidence |
|---|---|
| `routes/driver_management.php` never registered | RouteServiceProvider has no map for it (map() :58-131); controller class not imported (driver_management.php:4-6); only route `GET /driver/van_driver_report` (:7) |
| Duplicate `POST /api/homescreen` | api.php:82 and api.php:86 (same controller method) |
| Duplicate `lms-assignment/*` block | api.php:334-347 (no middleware) re-declared at :361-369 (`api.session`+`staff.only`) and :374-375 (`api.session`). Laravel stores routes by method+URI and the later one overwrites (vendor/laravel/framework/src/Illuminate/Routing/RouteCollection.php:65), so the guarded copies win for subjects, students, exam-papers, store, list, annotate-*, submission-list/store. Only `bulk-delete` (:339) and `ai-status/{id}` (:343) exist solely in the unguarded block (still JWT-guarded through api_guard `lms-assignment/*`, config/api_guard.php:112). `upload-homework` exists only at :365 |
| `GET /api/testkey` | api.php:90-92 only registered in `local`/`testing`; mints a JWT without credentials (comment api.php:88-89) |
| Commented routes | tranceport.php:44-45 (`api/get-to_bus-list`, `api/get-to_stop-list`); hostel_management.php:20 (`listhosteltype`); cal.php:31-34 comment records five Neo4j assessment routes removed on 2026-09-04 because their controller does not exist |
| Odd mapping | `PUT /api/leave/leave-types/{id}` -> `LeaveTypeApiController@store` (api.php:951, same method as the POST at :950) |
| Dead/suspicious dynamic route | custom_module.php:21-25 builds `Route::get('table?id=<id>')` inside a foreach over a DB query at route-registration time (query runs on every route boot; URI contains `?`) |
| Two document APIs | `/api/documents/*` (documents.php, `api.session`) vs `/api/v1/documents/*` (api.php:1010-1030, no auth, see 5) |
| Two leave/attendance surfaces | `/api/hrms/*` (token-bound) vs `/api/leave/*`,`/api/attendance/*` (body-bound) |
| Bad class-in-file | `get_feesGraphAPI` (adminapiController.php:1344-1490) hard-coded date + malformed join (see #46) |
| Mixed-case `route::get` | implementation.php:13-14 (works, PHP function/class names are case-insensitive) |

---------------------------------------------------------------------

## 5. Routes lacking authentication (route-level and, where checked, controller-level)

Evidence for "none" = no route middleware, not matched by `config/api_guard.php` protect list (lines 88-124), and no token/session identity check in the method (script grep of uncommented code + manual reads above).

| Route(s) | File:line | Observation |
|---|---|---|
| ALL of teacherapi.php (34) and adminapi.php (63) | registered with no middleware (RSP :390-399) | auth is per-method; 1 teacherapi + 1 adminapi method have none: `POST /teacherListAPI` (user.php:61 -> tbluserController.php:494-519; the JWT block is commented out at :498-505) and `POST /get_Syear` (adminapi.php:27 -> adminapiController.php:200-231) |
| `POST /add_visitorAPI` (teacherapi.php:87) and `POST /visitor_management/add_visitor_master` (visitor_management.php:23) | -> visitor_masterController@store :153- | JWT block commented out (:163-172); `type=API`/`webForm` takes `sub_institute_id`,`user_id` from the body. Public form by design (visitor_management.php:22 "store (public)") |
| `GET /calendar/fetchData` | cal.php:22 -> calendar_controller.php:89-146 | no token; student calendar by `student_id` |
| `GET /map_student/fetchData`, `GET /ajaxCheckRemainCapacity`, `DELETE /map_student/bulk-delete` | tranceport.php:38-40 | outside the `session` group; destroy reads `delete_students[]` (map_student_controller.php:521-533); CSRF-exempt on the three listed hosts |
| `GET /transportation/transportationLists/studentLists/{t_id}/{t_s_id}` | tranceport.php:42 | outside group, session-only read |
| `GET /api/get-bus-list`, `/api/get-stop-list` | tranceport.php:36-37 | `get-*` is protected by api_guard (config:106) so a JWT or session is needed |
| `GET /get-intents-list` | implementation.php:16 | no auth found |
| `GET /conversational_ai/genkitDetailsAPI`, `/MockQueriesAPI` | implementation.php:13-14 | `session` middleware (login session or type=API+JWT) |
| `GET /menuLevel2` | custom_module.php:39 | outside the middleware group |
| `POST /neo4j/assessment` | cal.php:30 | no auth found (route is in cal.php under `Route::prefix('neo4j')`) |
| `/api/v1/documents*`, `/api/v1/trash/*`, `/api/v1/search/parse`, `/api/v1/browse/tree`, `/api/v1/tags`, `/api/v1/audit` (20 routes) | api.php:1010-1030 | no middleware, not in api_guard; DocumentController trusts `X-User-Id`/`X-Sub-Institute-Id` headers or body and **defaults to user 1 / school 1** (DocumentController.php:46-47) |
| `GET /api/fields-configuration*` (6) | api.php:892-897 | CustomFieldApiController has `jwtToken()->validate()` in `context()` (CustomFieldApiController.php:22-28) (script shows NONE-FOUND for the method because of indirection; treat as token-checked) |
| `/api/academic-setup/*`, `/api/general-setup/*`, `/api/transportation-setup/*`, `/api/inventory/*` | api.php:475-497 | token-checked inside via `context()` (TransportationApiController.php:35-61 etc.); `user_id` and `sub_institute_id` in the body must equal the token's `id`/tenant or 403 `Token context does not match the request.` (TransportationApiController.php:63-65); actor must be an active tbluser (:67-77) |
| `POST /api/update-message`, `/api/incoming-message`, `/api/whats-send-app`, `/api/whats-comming-app`, `GET /api/crm-whatsapp`, `/crm-whatsapp-update` | api.php:64-73, 186-187 | public webhooks (config/api_guard.php:34-40, TODO V1.1 shared secret); closures at :64,:68 only log the body; crm routes use `withoutMiddleware(Authenticate::class)` |
| `POST /api/homescreen`, `/gcm_insert`, `/playscreen` | api.php:82,85,87 | token signature only / none (`playscreen` returns app-version info) |
| `GET /api/migration-modules/{module}` (+POST, DELETE) | api.php:182-184 | no route auth; not in api_guard; controller-level check not located in this survey (not found, searched routes and config only) |
| `POST /api/admissions-dashboard/summary`, `students-`, `library-`, `hostel-`, `transportation-dashboard/summary` | api.php:149-153 | comment says stateless, no session middleware (:146-148) but they ARE in api_guard protect+staff lists (config:94-95, 60) so they need a staff JWT |
| `POST /api/lms/gamma-content-master` | api.php:273 | comment (:268-271) says unauthenticated; it is in the api_guard protect+staff list (config:81,118) |
| `lms.auth` routes (`/api/permissions`, `/api/lms/content/*`, `/api/lms/coherence-map*`, `/api/platform/*`) | api.php:203,246-248,260-261,706-721; platform.php | `lms.auth` is warn-only unless `lms_content.api_auth_enforce` is true (LmsApiAuth.php:55-60) |

Identity-trust gaps worth knowing even where a token is required (all verified above): homework list `user_id`/`user_profile_name` from body (#14); result `student_id` (#21); leave/attendance `user_id`/`employee` from body (#39,#40); `lms-chapters` role from body (#19); teacher `created_by` from body (#31); `review*` and `submissionAiStatus` use `find($id)` without tenant (HomeworkSubmissionApiController.php:245,427,472); `result/all-results/{id}` unscoped (#20); easycom send endpoints with no staff gate (#49); adminapi signature-only (#45-48).

---------------------------------------------------------------------

## 6. Where the legacy student/parent mobile endpoints actually live (NOT in the assigned files)

Searched `routes/*.php` for `API'`: the classic student/parent app routes are registered elsewhere (web group, bare URLs). Another survey should cover them: `routes/student.php:179-243` (studentAttendanceAPI, studentTeacherListAPI, studentHealthAPI, studentExamScheduleAPI, studentDisciplineAPI, schoolDetailAPI, studentPhotoVideoGalleryAPI, studentLeaveApplicationAPI, studentHostelAllocationAPI, studentCertificateAPI, teacherSendSmsParentsAPI, teacherSendEmailParentsAPI, teacherLeaveApplicationListAPI/SaveAPI, studentInfirmaryAPI, studentVaccinationAPI, studentHWAPI, notificationHubAPI, teacherAnnoucementAPI, teacherHomeworkAssignmentAPI, studentHomeworkAssignmentAPI, add_communicationAPI, studentSubjectAPI, teacherStudentListAPI, allStudentListAPI, teacherParentcommunicationListAPI/SaveAPI, studentParentcommunicationListAPI); `routes/lms.php:356-372` (studentVirtualClassroomAPI ... trizStandardAPI); `routes/fees.php:327` (studentFeesDetailAPI, `session`+`check_permissions`); `routes/web.php:353,475-476` (profileAPI, teacherTimetableAPI, studentTimetableAPI); `routes/result.php:133,214,241`. Within the assigned files, student **fees, timetable, daily attendance, circulars/notices and chat have no dedicated student endpoint**; `student-dashboard/summary` (#13) is the only aggregate. Library, hostel (student view) and transport (student view) likewise: only admin-style endpoints exist here (`/api/hostel-setup/*`, `/api/transportation-setup/*`, `*-dashboard/summary`).

---------------------------------------------------------------------

## 7. Business-module quick index (where to look in section 8)

| Module | Mobile-useful routes in the assigned files |
|---|---|
| Login/bootstrap | api-login, login/check_otp, teacherlogin/teacher_check_otp, admin_login/admin_check_otp, mobile/bootstrap, own-profile, homescreen, gcm_insert, academic-terms |
| Attendance (student) | none student-facing; admin: `get_attendanceGraphAPI`, `add_studentCaptureAttendanceAPI`, `get_attendanceDataAPI`, `get_studentCapturePhotosAPI` (adminapi.php:63,95-101); result term attendance `result/student-attendance-master` (resultapi.php:145-146) |
| Staff attendance / HR | hrms/*, leave/*, attendance/* (my-attendance, punch-in/out), department/jobrole endpoints |
| Homework / assignments | lms-homework/*, lms-assignment/* |
| Timetable | teacher-timetable/summary, get_teacher_timetablewise*, /get_adminTodaysProxyListAPI |
| Exams / results | result/* (185 routes), get_teacherResultExamList, add_teacherExamSchedule/get_teacherExamSchedule |
| Fees | fees-dashboard/*, fees-refund/*, fees-cancel/search, fees-circular*, get_feesGraphAPI (broken), teacher-fee-dues/summary |
| Students / admission | get_adminStudentList/Search, bulk-students, student-*, admission_* (staff), online_admission_confirm (public) |
| Teachers / HR | get_adminTeacherList, teacher-transfer, class-teachers, users, user-profiles, rights |
| Communication | easy_com/*, add_adminCircularAPI/get_adminCircularAPI, add_SendNotificationAPI, add_adminSendSms/Email, parent communication (adminapi.php:45-47), complaints, task |
| PTM / consent / visitor | ptm*API, get_teacherPTMBookingList, add_teacherPTMStatus, consentListAPI, visitor APIs |
| Calendar | studentCalenderAPI, calendar/fetchData, calendar/TeacherFetchData, calendar/calendar-api-* |
| Transport | transportation-setup/*, transportation-dashboard/summary, api/get-bus-list|get-stop-list, studentTransportAPI is in lms.php |
| Library / inventory | library-dashboard/summary, inventory/* |
| Hostel | hostel-setup/*, hostel-dashboard/summary |
| Front desk | front-desk/*, petty-cash/*, photo-video-gallery |
| Docs / platform | documents/*, v1/documents/*, platform/*, document-templates/* |

---------------------------------------------------------------------

## 8. Full route inventory (generated)

Per file, grouped by business module. `L` = line in that route file. `Route MW` excludes the group-level `api`/`web`. Resource routes (`RESOURCE`) expand to the usual 7 Laravel routes under the printed URI.


### api.php  (450 routes, 0 commented)
Registration: prefix `api`; api group = throttle:1000,1 + SubstituteBindings + api.jwt; RouteServiceProvider.php:238-243 (mapApiRoutes)

**Dashboards** (28)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 48 | GET | `/api/student-assessment` | `StudentGraphController@getStudentAssessment` | - | G | get Student Assessment |
| 62 | GET | `/api/student-results/{stuId}/graph` | `neo4jGraph\StudentResultGraphController@show` | - | G | show |
| 142 | POST | `/api/fees-dashboard/summary` | `api\FeesDashboardApiController@summary` | api.session,check_permissions | RT:api.session+check_permissions | summary |
| 145 | POST | `/api/fees-dashboard/defaulters` | `api\FeesDashboardApiController@defaulters` | api.session,check_permissions | RT:api.session+check_permissions | defaulters |
| 149 | POST | `/api/admissions-dashboard/summary` | `api\AdmissionsDashboardApiController@summary` | - | G+staff | summary |
| 150 | POST | `/api/students-dashboard/summary` | `api\StudentsDashboardApiController@summary` | - | G+staff | summary |
| 151 | POST | `/api/library-dashboard/summary` | `api\LibraryDashboardApiController@summary` | - | G+staff | summary |
| 152 | POST | `/api/hostel-dashboard/summary` | `api\HostelDashboardApiController@summary` | - | G+staff | summary |
| 153 | POST | `/api/transportation-dashboard/summary` | `api\TransportationDashboardApiController@summary` | - | G+staff | summary |
| 158 | POST | `/api/admin-dashboard/summary` | `api\RoleDashboardApiController@adminSummary` | api.session | RT:api.session | admin Summary |
| 159 | POST | `/api/teacher-dashboard/summary` | `api\RoleDashboardApiController@teacherSummary` | api.session | RT:api.session | teacher Summary |
| 160 | POST | `/api/teacher-timetable/summary` | `api\TeacherTimetableApiController@summary` | api.session | RT:api.session | summary |
| 161 | POST | `/api/teacher-fee-dues/summary` | `api\TeacherFeeDuesApiController@summary` | api.session | RT:api.session | summary |
| 162 | POST | `/api/student-dashboard/summary` | `api\RoleDashboardApiController@studentSummary` | api.session | RT:api.session | student Summary |
| 430 | POST | `/api/lms-result-dashboard/summary` | `api\lms\LmsResultDashboardApiController@summary` | api.session,staff.only | RT:api.session+staff.only | summary |
| 906 | GET | `/api/attendance-weekly` | `api\HRITDashboard\AttendanceApiController@weeklySummary` | - | G+staff | weekly Summary |
| 907 | GET | `/api/KPI-HRITDashboard` | `api\HRITDashboard\AttendanceApiController@KPI` | - | G+staff | KPI |
| 908 | GET | `/api/employee-attendance-monthly-report` | `api\HRITDashboard\AttendanceApiController@employeeMonthlyReport` | - | G+staff | employee Monthly Report |
| 910 | GET | `/api/jobroles-by-department` | `api\HRITDashboard\JobroleApiController@getDepartmentWise` | - | G+staff | get Department Wise |
| 911 | GET | `/api/leave-distribution` | `api\HRITDashboard\LeaveDistribution@leaveDistribution` | - | CTRL:token (jwtToken) | leave Distribution |
| 925 | GET | `/api/leave/dashboard` | `api\Leave\LeaveDashboardController@index` | - | CTRL:token (leaveContext) | index |
| 926 | GET | `/api/leave/trend` | `api\Leave\LeaveDashboardController@trend` | - | CTRL:token (leaveContext) | trend |
| 927 | GET | `/api/leave/department-summary` | `api\Leave\LeaveDashboardController@departmentSummary` | - | CTRL:token (leaveContext) | department Summary |
| 928 | GET | `/api/leave/type-distribution` | `api\Leave\LeaveDashboardController@typeDistribution` | - | CTRL:token (leaveContext) | type Distribution |
| 929 | GET | `/api/leave/holidays/upcoming` | `api\Leave\LeaveDashboardController@upcomingHolidays` | - | CTRL:token (leaveContext) | upcoming Holidays |
| 944 | GET | `/api/leave/reports/summary` | `api\Leave\LeaveReportApiController@summary` | - | CTRL:token (leaveContext) | summary |
| 1000 | GET | `/api/attendance/weekly-summary` | `api\Attendance\AttendanceDashboardApiController@weeklySummary` | - | CTRL:token (attendanceContext) | weekly Summary |
| 1001 | GET | `/api/attendance/kpi` | `api\Attendance\AttendanceDashboardApiController@kpi` | - | CTRL:token (attendanceContext) | kpi |

**Homework / assignments** (50)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 49 | POST | `/api/teacher/assignments/standards` | `api\TeacherAssignmentMobileApiController@standards` | api.session | RT:api.session | standards |
| 49 | POST | `/api/teacher/assignments/divisions` | `api\TeacherAssignmentMobileApiController@divisions` | api.session | RT:api.session | divisions |
| 280 | POST | `/api/lms-homework/get-subjects` | `api\lms\StudentHomeworkApiController@getSubjects` | - | G | get Subjects |
| 281 | POST | `/api/lms-homework/get-chapters` | `api\lms\StudentHomeworkApiController@getChapters` | - | G | get Chapters |
| 283 | POST | `/api/lms-homework/list` | `api\lms\StudentHomeworkApiController@index` | - | G | index |
| 284 | POST | `/api/lms-homework/store` | `api\lms\StudentHomeworkApiController@store` | - | G+staff | store |
| 285 | POST | `/api/lms-homework/show/{id}` | `api\lms\StudentHomeworkApiController@show` | - | G | show |
| 286 | POST | `/api/lms-homework/update/{id}` | `api\lms\StudentHomeworkApiController@update` | - | G+staff | update |
| 287 | POST | `/api/lms-homework/delete/{id}` | `api\lms\StudentHomeworkApiController@destroy` | - | G+staff | destroy |
| 288 | POST | `/api/lms-homework/bulk-delete` | `api\lms\StudentHomeworkApiController@bulkDelete` | - | G+staff | bulk Delete |
| 289 | POST | `/api/lms-homework/students` | `api\lms\StudentHomeworkApiController@studentsList` | - | G+staff | students List |
| 290 | POST | `/api/lms-homework/homework-subjects` | `api\lms\StudentHomeworkApiController@homeworkSubjects` | - | G | homework Subjects |
| 292 | POST | `/api/lms-homework/submission-list` | `api\lms\StudentHomeworkApiController@submissionList` | - | G | submission List |
| 293 | POST | `/api/lms-homework/submission-store` | `api\lms\StudentHomeworkApiController@submissionStore` | - | G | submission Store |
| 294 | POST | `/api/lms-homework/submission-report` | `api\lms\StudentHomeworkApiController@submissionReport` | - | G | submission Report |
| 295 | POST | `/api/lms-homework/ai-status/{id}` | `api\lms\StudentHomeworkApiController@aiEvaluationStatus` | - | G | ai Evaluation Status |
| 306 | POST | `/api/lms-homework/detail/{id}` | `api\lms\HomeworkSubmissionApiController@detail` | api.session | RT:api.session ; G | detail |
| 307 | POST | `/api/lms-homework/submission/store` | `api\lms\HomeworkSubmissionApiController@submit` | api.session | RT:api.session ; G | submit |
| 308 | POST | `/api/lms-homework/submission/ai-status/{id}` | `api\lms\HomeworkSubmissionApiController@submissionAiStatus` | api.session | RT:api.session ; G | submission Ai Status |
| 309 | POST | `/api/lms-homework/submission-file/{id}` | `api\lms\HomeworkSubmissionApiController@downloadFile` | api.session | RT:api.session ; G | download File |
| 310 | POST | `/api/lms-homework/my-submissions` | `api\lms\HomeworkSubmissionApiController@mySubmissions` | api.session | RT:api.session ; G | my Submissions |
| 313 | POST | `/api/lms-homework/review-list` | `api\lms\HomeworkSubmissionApiController@reviewList` | api.session,staff.only | RT:api.session+staff.only ; G | review List |
| 314 | POST | `/api/lms-homework/review-detail/{id}` | `api\lms\HomeworkSubmissionApiController@reviewDetail` | api.session,staff.only | RT:api.session+staff.only ; G | review Detail |
| 315 | POST | `/api/lms-homework/review-store` | `api\lms\HomeworkSubmissionApiController@reviewStore` | api.session,staff.only | RT:api.session+staff.only ; G | review Store |
| 317 | POST | `/api/lms-homework/review-reprocess/{id}` | `api\lms\HomeworkSubmissionApiController@reviewReprocess` | api.session,staff.only | RT:api.session+staff.only ; G | review Reprocess |
| 324 | POST | `/api/lms-homework/question-bank/types` | `api\lms\HomeworkQuestionBankApiController@questionTypes` | api.session,staff.only | RT:api.session+staff.only ; G | question Types |
| 325 | POST | `/api/lms-homework/question-bank/questions` | `api\lms\HomeworkQuestionBankApiController@questions` | api.session,staff.only | RT:api.session+staff.only ; G | questions |
| 334 | POST | `/api/lms-assignment/subjects` | `api\lms\LmsAssignmentApiController@subjects` | - | G | subjects |
| 335 | POST | `/api/lms-assignment/students` | `api\lms\LmsAssignmentApiController@students` | - | G | students |
| 336 | POST | `/api/lms-assignment/exam-papers` | `api\lms\LmsAssignmentApiController@examPapers` | - | G | exam Papers |
| 337 | POST | `/api/lms-assignment/store` | `api\lms\LmsAssignmentApiController@store` | - | G | store |
| 338 | POST | `/api/lms-assignment/list` | `api\lms\LmsAssignmentApiController@index` | - | G | index |
| 339 | POST | `/api/lms-assignment/bulk-delete` | `api\lms\LmsAssignmentApiController@bulkDelete` | - | G+staff | bulk Delete |
| 341 | POST | `/api/lms-assignment/submission-list` | `api\lms\LmsAssignmentApiController@submissionList` | - | G | submission List |
| 342 | POST | `/api/lms-assignment/submission-store` | `api\lms\LmsAssignmentApiController@submissionStore` | - | G | submission Store |
| 343 | POST | `/api/lms-assignment/ai-status/{id}` | `api\lms\LmsAssignmentApiController@aiEvaluationStatus` | - | G | ai Evaluation Status |
| 345 | POST | `/api/lms-assignment/annotate-list` | `api\lms\LmsAssignmentApiController@annotateList` | - | G | annotate List |
| 346 | POST | `/api/lms-assignment/annotate-questions` | `api\lms\LmsAssignmentApiController@annotateQuestions` | - | G | annotate Questions |
| 347 | POST | `/api/lms-assignment/annotate-store` | `api\lms\LmsAssignmentApiController@annotateStore` | - | G | annotate Store |
| 361 | POST | `/api/lms-assignment/subjects` | `api\lms\LmsAssignmentApiController@subjects` | api.session,staff.only | RT:api.session+staff.only ; G | subjects |
| 362 | POST | `/api/lms-assignment/students` | `api\lms\LmsAssignmentApiController@students` | api.session,staff.only | RT:api.session+staff.only ; G | students |
| 363 | POST | `/api/lms-assignment/exam-papers` | `api\lms\LmsAssignmentApiController@examPapers` | api.session,staff.only | RT:api.session+staff.only ; G | exam Papers |
| 364 | POST | `/api/lms-assignment/store` | `api\lms\LmsAssignmentApiController@store` | api.session,staff.only | RT:api.session+staff.only ; G | store |
| 365 | POST | `/api/lms-assignment/upload-homework` | `api\lms\LmsAssignmentApiController@uploadHomework` | api.session,staff.only | RT:api.session+staff.only ; G | upload Homework |
| 366 | POST | `/api/lms-assignment/list` | `api\lms\LmsAssignmentApiController@index` | api.session,staff.only | RT:api.session+staff.only ; G | index |
| 367 | POST | `/api/lms-assignment/annotate-list` | `api\lms\LmsAssignmentApiController@annotateList` | api.session,staff.only | RT:api.session+staff.only ; G | annotate List |
| 368 | POST | `/api/lms-assignment/annotate-questions` | `api\lms\LmsAssignmentApiController@annotateQuestions` | api.session,staff.only | RT:api.session+staff.only ; G | annotate Questions |
| 369 | POST | `/api/lms-assignment/annotate-store` | `api\lms\LmsAssignmentApiController@annotateStore` | api.session,staff.only | RT:api.session+staff.only ; G | annotate Store |
| 374 | POST | `/api/lms-assignment/submission-list` | `api\lms\LmsAssignmentApiController@submissionList` | api.session | RT:api.session ; G | submission List |
| 375 | POST | `/api/lms-assignment/submission-store` | `api\lms\LmsAssignmentApiController@submissionStore` | api.session | RT:api.session ; G | submission Store |

**Other** (5)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 64 | POST | `/api/whats-send-app` | `(closure)` | - | NONE (closure) | (closure) |
| 68 | POST | `/api/whats-comming-app` | `(closure)` | - | NONE (closure) | (closure) |
| 593 | GET/POST | `/api/interactions` | `api\InteractionLogController@index` | - | G+staff | index |
| 594 | POST | `/api/interactions/store` | `api\InteractionLogController@store` | - | G+staff | store |
| 595 | POST | `/api/interactions/{id}/update` | `api\InteractionLogController@update` | - | G+staff | update |

**Communication / notices / chat** (22)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 72 | POST | `/api/update-message` | `WhatsappController@updateDeliveryStatus` | - | NONE-FOUND | update Delivery Status |
| 73 | POST | `/api/incoming-message` | `WhatsappController@incomingMessage` | - | NONE-FOUND | incoming Message |
| 186 | GET | `/api/crm-whatsapp` | `WhatsappController@whatsappCRM` | withoutMiddleware(Authenticate) | NONE-FOUND | whatsapp CRM |
| 187 | GET | `/api/crm-whatsapp-update` | `WhatsappController@updateCRMWhatsappStatus` | withoutMiddleware(Authenticate) | NONE-FOUND | update CRMWhatsapp Status |
| 791 | GET | `/api/complaints` | `api\ComplaintApiController@index` | - | CTRL:token (via authenticate()) | index |
| 792 | POST | `/api/complaints` | `api\ComplaintApiController@store` | - | CTRL:token (via authenticate()) | store |
| 793 | POST | `/api/complaints/{id}/delete` | `api\ComplaintApiController@destroy` | - | CTRL:token (via authenticate()) | destroy |
| 794 | POST | `/api/complaints/{id}` | `api\ComplaintApiController@update` | - | CTRL:token (via authenticate()) | update |
| 815 | GET | `/api/front-desk/photo-video-gallery` | `api\PhotoVideoGallaryApiController@index` | - | CTRL:token (via authenticate()) | index |
| 816 | POST | `/api/front-desk/photo-video-gallery` | `api\PhotoVideoGallaryApiController@store` | - | CTRL:token (via authenticate()) | store |
| 817 | POST | `/api/front-desk/photo-video-gallery/{id}/delete` | `api\PhotoVideoGallaryApiController@destroy` | - | CTRL:token (via authenticate()) | destroy |
| 818 | POST | `/api/front-desk/photo-video-gallery/{id}` | `api\PhotoVideoGallaryApiController@update` | - | CTRL:token (via authenticate()) | update |
| 877 | GET | `/api/document-templates/merge-fields` | `api\DocumentTemplateApiController@mergeFields` | - | G+staff | merge Fields |
| 878 | GET | `/api/document-templates/merge-data` | `api\DocumentTemplateApiController@mergeData` | - | G+staff | merge Data |
| 880 | GET | `/api/document-templates` | `api\DocumentTemplateApiController@index` | - | G+staff | index |
| 881 | GET | `/api/document-templates/{id}/versions` | `api\DocumentTemplateApiController@versions` | - | G+staff | versions |
| 883 | GET | `/api/document-templates/{id}` | `api\DocumentTemplateApiController@show` | - | G+staff | show |
| 884 | POST | `/api/document-templates` | `api\DocumentTemplateApiController@store` | - | G+staff | store |
| 885 | POST | `/api/document-templates/{id}/duplicate` | `api\DocumentTemplateApiController@duplicate` | - | G+staff | duplicate |
| 886 | POST | `/api/document-templates/{id}/restore/{version}` | `api\DocumentTemplateApiController@restore` | - | G+staff | restore |
| 887 | POST | `/api/document-templates/{id}/delete` | `api\DocumentTemplateApiController@destroy` | - | G+staff | destroy |
| 888 | POST | `/api/document-templates/{id}` | `api\DocumentTemplateApiController@update` | - | G+staff | update |

**Authentication / session / bootstrap** (39)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 79 | POST | `/api/login` | `api\apiController@login` | throttle:20,1 | PUBLIC (login/OTP, throttled) | login |
| 80 | POST | `/api/login_hills` | `api\apiController@login_hills` | throttle:20,1 | PUBLIC (login/OTP, throttled) | login hills |
| 81 | POST | `/api/check_otp` | `api\apiController@check_otp` | throttle:10,1 | PUBLIC (login/OTP, throttled) | check otp |
| 82 | POST | `/api/homescreen` | `api\apiController@homescreen` | - | CTRL:token (jwtToken,jwtPayload) | homescreen |
| 83 | POST | `/api/teacherlogin` | `api\apiController@teacherlogin` | throttle:20,1 | PUBLIC (login/OTP, throttled) | teacherlogin |
| 84 | POST | `/api/teacher_check_otp` | `api\apiController@teacher_check_otp` | throttle:10,1 | PUBLIC (login/OTP, throttled) | teacher check otp |
| 85 | POST | `/api/playscreen` | `api\apiController@playscreen` | - | NONE-FOUND (app version info) | playscreen |
| 86 | POST | `/api/homescreen` | `api\apiController@homescreen` | - | CTRL:token (jwtToken,jwtPayload) | homescreen |
| 87 | POST | `/api/gcm_insert` | `api\apiController@gcm_insert` | - | CTRL:token (jwtToken) | gcm insert |
| 91 | GET | `/api/testkey` | `api\apiController@testkey` | - | NONE-FOUND | testkey |
| 95 | POST | `/api/api-login` | `api\ApiLoginController@login` | throttle:20,1 | PUBLIC (login/OTP, throttled) | login |
| 96 | GET | `/api/academic-terms` | `api\ApiLoginController@academicTerms` | - | G | academic Terms |
| 98 | GET | `/api/own-profile` | `api\OwnProfileApiController@show` | api.session | RT:api.session | show |
| 100 | GET | `/api/mobile/bootstrap` | `api\MobileBootstrapApiController@show` | api.session | RT:api.session | show |
| 106 | POST | `/api/mobile/web-handoff` | `api\MobileWebHandoffApiController@create` | api.session | RT:api.session | create |
| 115 | GET | `/api/mobile/web-handoff/claims` | `api\MobileWebHandoffApiController@claims` | - | NONE-FOUND | claims |
| 120 | GET | `/api/mobile/dynamic-page/{pageKey}` | `api\MobileDynamicPageApiController@show` | api.session | RT:api.session | show |
| 126 | GET | `/api/mobile/dynamic-page-admin/registry` | `api\MobileDynamicPageAdminApiController@registry` | api.session | RT:api.session | registry |
| 127 | GET | `/api/mobile/dynamic-page-admin/pages` | `api\MobileDynamicPageAdminApiController@index` | api.session | RT:api.session | index |
| 128 | POST | `/api/mobile/dynamic-page-admin/pages` | `api\MobileDynamicPageAdminApiController@store` | api.session | RT:api.session | store |
| 129 | POST | `/api/mobile/dynamic-page-admin/pages/{id}` | `api\MobileDynamicPageAdminApiController@update` | api.session | RT:api.session | update |
| 130 | POST | `/api/mobile/dynamic-page-admin/pages/{id}/fields` | `api\MobileDynamicPageAdminApiController@addField` | api.session | RT:api.session | add Field |
| 131 | POST | `/api/mobile/dynamic-page-admin/fields/{fieldId}` | `api\MobileDynamicPageAdminApiController@updateField` | api.session | RT:api.session | update Field |
| 132 | DELETE | `/api/mobile/dynamic-page-admin/fields/{fieldId}` | `api\MobileDynamicPageAdminApiController@deleteField` | api.session | RT:api.session | delete Field |
| 168 | GET | `/api/dashboard-preferences/{dashboardKey}` | `api\UserDashboardPreferenceApiController@show` | api.session | RT:api.session | show |
| 170 | PUT | `/api/dashboard-preferences/{dashboardKey}` | `api\UserDashboardPreferenceApiController@update` | api.session | RT:api.session | update |
| 195 | POST | `/api/menu-rights` | `api\MenuRightsController@getMenuRightsLevelWise` | - | G | get Menu Rights Level Wise |
| 196 | GET | `/api/master-menu-rights` | `api\MenuRightsController@getMasterMenuApi` | - | G | get Master Menu Api |
| 203 | GET | `/api/permissions` | `api\PermissionsController@index` | lms.auth | RT:lms.auth | index |
| 209 | GET/POST | `/api/fees/menu-categories` | `api\FeesMenuCategoryApiController@index` | api.session,check_permissions | RT:api.session+check_permissions | index |
| 213 | GET/POST | `/api/teach-learn/menu-categories` | `api\TeachLearnMenuCategoryApiController@index` | api.session,check_permissions | RT:api.session+check_permissions | index |
| 220 | GET/POST | `/api/modules/menu-categories` | `api\ModuleMenuCategoryApiController@index` | api.session,check_permissions | RT:api.session+check_permissions | index |
| 221 | GET/POST | `/api/modules/menu-categories/registry` | `api\ModuleMenuCategoryApiController@registry` | api.session,check_permissions | RT:api.session+check_permissions | registry |
| 776 | GET | `/api/mobile-app-rights/bootstrap` | `api\MobileAppMenuRightsApiController@bootstrap` | - | CTRL:token (authorizeAction) | bootstrap |
| 777 | GET | `/api/mobile-app-rights/{profileId}/rights` | `api\MobileAppMenuRightsApiController@rights` | - | CTRL:token (authorizeAction) | rights |
| 778 | POST | `/api/mobile-app-rights/rights` | `api\MobileAppMenuRightsApiController@saveRights` | - | CTRL:token (authorizeAction) | save Rights |
| 779 | GET | `/api/mobile-app-rights/config` | `api\MobileAppMenuRightsApiController@configIndex` | - | CTRL:token (authorizeAction) | config Index |
| 780 | POST | `/api/mobile-app-rights/config` | `api\MobileAppMenuRightsApiController@createConfig` | - | CTRL:token (authorizeAction) | create Config |
| 781 | POST | `/api/mobile-app-rights/config/{id}` | `api\MobileAppMenuRightsApiController@updateConfig` | - | CTRL:token (authorizeAction) | update Config |

**HRMS / leave / staff attendance** (61)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 135 | GET | `/api/hrms/today` | `api\HrmsMobileApiController@today` | api.session | RT:api.session | today |
| 136 | POST | `/api/hrms/punch` | `api\HrmsMobileApiController@punch` | api.session | RT:api.session | punch |
| 137 | GET | `/api/hrms/attendance` | `api\HrmsMobileApiController@attendance` | api.session | RT:api.session | attendance |
| 138 | GET | `/api/hrms/leaves` | `api\HrmsMobileApiController@leaves` | api.session | RT:api.session | leaves |
| 277 | GET | `/api/ai-sop/department-job-roles` | `api\AiSopGenerationController@departmentJobRoles` | - | G+staff | department Job Roles |
| 470 | APIRESOURCE | `/api/class-teachers` | `api\ClassTeacherApiController@resource` | - | NONE-FOUND (method not located) | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on ClassTeacherApiController |
| 473 | POST | `/api/teacher-daily-reports/search` | `api\TeacherDailyReportApiController@search` | - | CTRL:token (via context()) | search |
| 474 | GET | `/api/teacher-daily-reports/{teacherId}/details` | `api\TeacherDailyReportApiController@details` | - | CTRL:token (via context()) | details |
| 726 | GET | `/api/departments` | `HRMS\departmentController@index` | - | G+staff | index |
| 727 | GET | `/api/departments/create` | `HRMS\departmentController@create` | - | G+staff | create |
| 728 | GET | `/api/department-employee-lists` | `HRMS\departmentController@departmentEmpLists` | - | G+staff | department Emp Lists |
| 729 | GET | `/api/sub-department-list` | `HRMS\departmentController@subDepartmentList` | - | G+staff | sub Department List |
| 730 | GET | `/api/department-employee-list` | `HRMS\departmentController@departmentEmployeeList` | - | G+staff | department Employee List |
| 731 | GET | `/api/departments/hierarchy` | `HRMS\departmentController@hierarchy` | - | G+staff | hierarchy |
| 736 | GET | `/api/departments-management` | `HRMS\departmentController@indexManagement` | - | CTRL:token (via managementTokenContext()) | index Management |
| 737 | POST | `/api/departments-management` | `HRMS\departmentController@storeManagement` | - | CTRL:token (via managementTokenContext()) | store Management |
| 740 | POST | `/api/departments-management/merge` | `HRMS\departmentController@merge` | - | CTRL:token (via managementTokenContext()) | merge |
| 741 | POST | `/api/departments-management/reorder` | `HRMS\departmentController@reorder` | - | CTRL:token (via managementTokenContext()) | reorder |
| 742 | GET | `/api/departments-management/export` | `HRMS\departmentController@export` | - | CTRL:token (via managementTokenContext()) | export |
| 743 | GET | `/api/departments-management/employees` | `HRMS\departmentController@employees` | - | CTRL:token (via managementTokenContext()) | employees |
| 746 | POST | `/api/departments-management/{id}/employees` | `HRMS\departmentController@assignEmployees` | - | CTRL:token (via managementTokenContext()) | assign Employees |
| 747 | DELETE | `/api/departments-management/{id}/employees` | `HRMS\departmentController@unassignEmployees` | - | CTRL:token (via managementTokenContext()) | unassign Employees |
| 748 | GET | `/api/departments-management/{id}/impact` | `HRMS\departmentController@impact` | - | CTRL:token (via managementTokenContext()) | impact |
| 749 | PATCH | `/api/departments-management/{id}/head` | `HRMS\departmentController@setHead` | - | CTRL:token (via managementTokenContext()) | set Head |
| 750 | PUT/PATCH | `/api/departments-management/{id}` | `HRMS\departmentController@updateManagement` | - | CTRL:token (via managementTokenContext()) | update Management |
| 751 | DELETE | `/api/departments-management/{id}` | `HRMS\departmentController@destroyManagement` | - | CTRL:token (via managementTokenContext()) | destroy Management |
| 784 | GET | `/api/teacher-transfer` | `api\TeacherTransferApiController@index` | - | CTRL:token (authorizeRequest) | index |
| 785 | POST | `/api/teacher-transfer` | `api\TeacherTransferApiController@store` | - | CTRL:token (authorizeRequest) | store |
| 932 | GET | `/api/leave/options` | `api\Leave\LeaveOptionsController@index` | - | CTRL:token (leaveContext) | index |
| 933 | GET | `/api/leave/balances` | `api\Leave\LeaveOptionsController@balances` | - | CTRL:token (leaveContext) | balances |
| 936 | GET | `/api/leave/requests` | `api\Leave\LeaveRequestApiController@index` | - | CTRL:token (leaveContext) | index |
| 937 | POST | `/api/leave/requests` | `api\Leave\LeaveRequestApiController@store` | - | CTRL:token (leaveContext) | store |
| 938 | POST | `/api/leave/requests/bulk-decision` | `api\Leave\LeaveRequestApiController@bulkDecision` | - | CTRL:token (leaveContext) | bulk Decision |
| 939 | GET | `/api/leave/requests/{id}` | `api\Leave\LeaveRequestApiController@show` | - | CTRL:token (leaveContext) | show |
| 940 | POST | `/api/leave/requests/{id}/decision` | `api\Leave\LeaveRequestApiController@decision` | - | CTRL:token (leaveContext) | decision |
| 941 | DELETE | `/api/leave/requests/{id}` | `api\Leave\LeaveRequestApiController@destroy` | - | CTRL:token (leaveContext) | destroy |
| 945 | GET | `/api/leave/reports/register` | `api\Leave\LeaveReportApiController@register` | - | CTRL:token (leaveContext) | register |
| 946 | GET | `/api/leave/reports/balance` | `api\Leave\LeaveReportApiController@balance` | - | CTRL:token (leaveContext) | balance |
| 949 | GET | `/api/leave/leave-types` | `api\Leave\LeaveTypeApiController@index` | - | CTRL:token (leaveContext) | index |
| 950 | POST | `/api/leave/leave-types` | `api\Leave\LeaveTypeApiController@store` | - | CTRL:token (leaveContext) | store |
| 951 | PUT | `/api/leave/leave-types/{id}` | `api\Leave\LeaveTypeApiController@store` | - | CTRL:token (leaveContext) | store |
| 952 | PATCH | `/api/leave/leave-types/{id}/status` | `api\Leave\LeaveTypeApiController@toggleStatus` | - | CTRL:token (leaveContext) | toggle Status |
| 953 | DELETE | `/api/leave/leave-types/{id}` | `api\Leave\LeaveTypeApiController@destroy` | - | CTRL:token (leaveContext) | destroy |
| 956 | GET | `/api/leave/holidays` | `api\Leave\HolidayApiController@index` | - | CTRL:token (leaveContext) | index |
| 957 | POST | `/api/leave/holidays` | `api\Leave\HolidayApiController@store` | - | CTRL:token (leaveContext) | store |
| 958 | PUT | `/api/leave/holidays/{id}` | `api\Leave\HolidayApiController@update` | - | CTRL:token (leaveContext) | update |
| 959 | DELETE | `/api/leave/holidays/{id}` | `api\Leave\HolidayApiController@destroy` | - | CTRL:token (leaveContext) | destroy |
| 960 | GET | `/api/leave/weekdays` | `api\Leave\HolidayApiController@weekdays` | - | CTRL:token (leaveContext) | weekdays |
| 961 | POST | `/api/leave/weekdays` | `api\Leave\HolidayApiController@storeWeekdays` | - | CTRL:token (leaveContext) | store Weekdays |
| 964 | GET | `/api/leave/workflow` | `api\Leave\LeaveWorkflowApiController@workflow` | - | CTRL:token (leaveContext) | workflow |
| 965 | PUT | `/api/leave/workflow` | `api\Leave\LeaveWorkflowApiController@saveWorkflow` | - | CTRL:token (leaveContext) | save Workflow |
| 966 | GET | `/api/leave/roles` | `api\Leave\LeaveWorkflowApiController@roles` | - | CTRL:token (leaveContext) | roles |
| 967 | PUT | `/api/leave/roles` | `api\Leave\LeaveWorkflowApiController@saveRoles` | - | CTRL:token (leaveContext) | save Roles |
| 971 | GET | `/api/leave/distribution` | `api\Leave\LeaveDistributionApiController@index` | - | CTRL:token (leaveContext) | index |
| 989 | GET | `/api/attendance/my-attendance` | `api\Attendance\AttendanceTrackingApiController@myAttendance` | - | CTRL:token (attendanceContext) | my Attendance |
| 990 | POST | `/api/attendance/punch-in` | `api\Attendance\AttendanceTrackingApiController@punchIn` | - | CTRL:token (attendanceContext) | punch In |
| 991 | POST | `/api/attendance/punch-out` | `api\Attendance\AttendanceTrackingApiController@punchOut` | - | CTRL:token (attendanceContext) | punch Out |
| 994 | GET | `/api/attendance/report-filters` | `api\Attendance\AttendanceReportApiController@filters` | - | CTRL:token (attendanceContext) | filters |
| 995 | GET | `/api/attendance/employees` | `api\Attendance\AttendanceReportApiController@employees` | - | CTRL:token (attendanceContext) | employees |
| 996 | GET | `/api/attendance/day-detail` | `api\Attendance\AttendanceReportApiController@dayDetail` | - | CTRL:token (attendanceContext) | day Detail |
| 997 | GET | `/api/attendance/latest-activity-date` | `api\Attendance\AttendanceReportApiController@latestActivityDate` | - | CTRL:token (attendanceContext) | latest Activity Date |

**Teachers / staff users & rights** (21)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 165 | POST | `/api/teacher-icard/mine` | `api\TeacherIcardApiController@mine` | api.session | RT:api.session | mine |
| 471 | GET | `/api/user-logs/bootstrap` | `api\UserLogReportApiController@bootstrap` | - | CTRL:token (via context()) | bootstrap |
| 472 | POST | `/api/user-logs/search` | `api\UserLogReportApiController@search` | - | CTRL:token (via context()) | search |
| 756 | GET | `/api/users` | `api\UserManagementApiController@index` | - | CTRL:token (authorizeAction) | index |
| 757 | POST | `/api/users` | `api\UserManagementApiController@store` | - | CTRL:token (authorizeAction) | store |
| 758 | GET | `/api/users/{id}` | `api\UserManagementApiController@show` | - | CTRL:token (authorizeAction) | show |
| 759 | POST | `/api/users/{id}` | `api\UserManagementApiController@update` | - | CTRL:token (authorizeAction) | update |
| 760 | POST | `/api/users/{id}/deactivate` | `api\UserManagementApiController@destroy` | - | CTRL:token (authorizeAction) | destroy |
| 761 | GET | `/api/user-profiles` | `api\UserManagementApiController@profiles` | - | CTRL:token (authorizeAction) | profiles |
| 762 | POST | `/api/user-profiles` | `api\UserManagementApiController@storeProfile` | - | CTRL:token (authorizeAction) | store Profile |
| 763 | POST | `/api/user-profiles/{id}` | `api\UserManagementApiController@updateProfile` | - | CTRL:token (authorizeAction) | update Profile |
| 764 | POST | `/api/user-profiles/{id}/delete` | `api\UserManagementApiController@destroyProfile` | - | CTRL:token (authorizeAction) | destroy Profile |
| 765 | GET | `/api/user-reports/bootstrap` | `api\UserManagementApiController@reportBootstrap` | - | CTRL:token (authorizeAction) | report Bootstrap |
| 766 | POST | `/api/user-reports/search` | `api\UserManagementApiController@report` | - | CTRL:token (authorizeAction) | report |
| 769 | GET | `/api/groupwise-rights` | `api\GroupwiseRightsApiController@index` | - | CTRL:token (authorizeAction) | index |
| 770 | GET | `/api/groupwise-rights/{profileId}/matrix` | `api\GroupwiseRightsApiController@matrix` | - | CTRL:token (authorizeAction) | matrix |
| 771 | POST | `/api/groupwise-rights` | `api\GroupwiseRightsApiController@store` | - | CTRL:token (authorizeAction) | store |
| 772 | GET | `/api/individual-rights` | `api\IndividualRightsApiController@index` | - | CTRL:token (authorizeAction) | index |
| 773 | GET | `/api/individual-rights/{profileId}/users` | `api\IndividualRightsApiController@users` | - | CTRL:token (authorizeAction) | users |
| 774 | GET | `/api/individual-rights/{profileId}/{userId}/matrix` | `api\IndividualRightsApiController@matrix` | - | CTRL:token (authorizeAction) | matrix |
| 775 | POST | `/api/individual-rights` | `api\IndividualRightsApiController@store` | - | CTRL:token (authorizeAction) | store |

**Fees / petty cash / finance** (21)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 174 | POST | `/api/fees-refund/search` | `api\FeesRefundApiController@search` | api.session | RT:api.session | search |
| 175 | POST | `/api/fees-refund/detail/{studentId}` | `api\FeesRefundApiController@detail` | api.session | RT:api.session | detail |
| 176 | POST | `/api/fees-refund/save` | `api\FeesRefundApiController@save` | api.session | RT:api.session | save |
| 553 | POST | `/api/fees-cancel/search` | `fees\fees_cancel\feesCancelController@search` | api.session,check_permissions | RT:api.session+check_permissions | search |
| 570 | POST | `/api/fees-circular/filters` | `fees\fees_circular\feesCircularController@index` | api.session,check_permissions | RT:api.session+check_permissions | index |
| 571 | POST | `/api/fees-circular/students` | `fees\fees_circular\feesCircularController@showStudent` | api.session,check_permissions | RT:api.session+check_permissions | show Student |
| 572 | POST | `/api/fees-circular/generate` | `fees\fees_circular\feesCircularController@showCircular` | api.session,check_permissions | RT:api.session+check_permissions | show Circular |
| 573 | POST | `/api/fees-circular-master` | `fees\fees_circular\feesCircularMasterController@index` | api.session,check_permissions | RT:api.session+check_permissions | index |
| 574 | POST | `/api/fees-circular-master/store` | `fees\fees_circular\feesCircularMasterController@store` | api.session,check_permissions | RT:api.session+check_permissions | store |
| 575 | POST | `/api/fees-circular-master/{id}/update` | `fees\fees_circular\feesCircularMasterController@update` | api.session,check_permissions | RT:api.session+check_permissions | update |
| 576 | POST | `/api/fees-circular-master/{id}/delete` | `fees\fees_circular\feesCircularMasterController@destroy` | api.session,check_permissions | RT:api.session+check_permissions | destroy |
| 829 | GET | `/api/petty-cash/heads` | `api\PettyCashApiController@headIndex` | - | CTRL:token (via authenticate()) | head Index |
| 830 | POST | `/api/petty-cash/heads` | `api\PettyCashApiController@headStore` | - | CTRL:token (via authenticate()) | head Store |
| 831 | POST | `/api/petty-cash/heads/{id}/delete` | `api\PettyCashApiController@headDestroy` | - | CTRL:token (via authenticate()) | head Destroy |
| 832 | POST | `/api/petty-cash/heads/{id}` | `api\PettyCashApiController@headUpdate` | - | CTRL:token (via authenticate()) | head Update |
| 833 | GET | `/api/petty-cash/report` | `api\PettyCashApiController@report` | - | CTRL:token (via authenticate()) | report |
| 834 | GET | `/api/petty-cash` | `api\PettyCashApiController@index` | - | CTRL:token (via authenticate()) | index |
| 835 | GET | `/api/petty-cash/{id}` | `api\PettyCashApiController@show` | - | CTRL:token (via authenticate()) | show |
| 836 | POST | `/api/petty-cash` | `api\PettyCashApiController@store` | - | CTRL:token (via authenticate()) | store |
| 837 | POST | `/api/petty-cash/{id}/delete` | `api\PettyCashApiController@destroy` | - | CTRL:token (via authenticate()) | destroy |
| 838 | POST | `/api/petty-cash/{id}` | `api\PettyCashApiController@update` | - | CTRL:token (via authenticate()) | update |

**Platform / documents / settings / admin tooling** (49)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 182 | GET | `/api/migration-modules/{module}` | `api\MigrationModulesApiController@index` | - | CTRL:token (via guard()) | index |
| 183 | POST | `/api/migration-modules/{module}` | `api\MigrationModulesApiController@store` | - | CTRL:token (via guard()) | store |
| 184 | DELETE | `/api/migration-modules/{module}/{id}` | `api\MigrationModulesApiController@destroy` | - | CTRL:token (via guard()) | destroy |
| 190 | GET | `/api/compliance/list` | `settings\instituteDetailController@index` | - | G+staff | index |
| 191 | POST | `/api/compliance/create` | `settings\instituteDetailController@store` | - | G+staff | store |
| 192 | POST | `/api/compliance/update/{id}` | `settings\instituteDetailController@update` | - | G+staff | update |
| 193 | POST | `/api/compliance/delete/{id}` | `settings\instituteDetailController@destroy` | - | G+staff | destroy |
| 475 | GET | `/api/academic-setup/{module}` | `api\AcademicSetupApiController@index` | - | CTRL:token (via context()) | index |
| 476 | POST | `/api/academic-setup/{module}` | `api\AcademicSetupApiController@store` | - | CTRL:token (via context()) | store |
| 477 | PUT/PATCH | `/api/academic-setup/{module}/{id}` | `api\AcademicSetupApiController@update` | - | CTRL:token (via context()) | update |
| 478 | DELETE | `/api/academic-setup/{module}/{id}` | `api\AcademicSetupApiController@destroy` | - | CTRL:token (via context()) | destroy |
| 486 | GET | `/api/general-setup/{module}` | `api\GeneralSetupApiController@index` | - | CTRL:token (via context()) | index |
| 487 | POST | `/api/general-setup/{module}` | `api\GeneralSetupApiController@store` | - | CTRL:token (via context()) | store |
| 488 | PUT/PATCH | `/api/general-setup/{module}/{id}` | `api\GeneralSetupApiController@update` | - | CTRL:token (via context()) | update |
| 489 | DELETE | `/api/general-setup/{module}/{id}` | `api\GeneralSetupApiController@destroy` | - | CTRL:token (via context()) | destroy |
| 490 | GET | `/api/general-setup/{module}/tags` | `api\GeneralSetupApiController@tags` | - | CTRL:token (via context()) | tags |
| 558 | GET | `/api/import/tables` | `api\ImportApiController@tables` | api.session | RT:api.session | tables |
| 559 | POST | `/api/import/parse` | `api\ImportApiController@parse` | api.session | RT:api.session | parse |
| 560 | POST | `/api/import/process` | `api\ImportApiController@process` | api.session | RT:api.session | process |
| 561 | POST | `/api/import/match-fields` | `api\ImportApiController@matchFields` | api.session | RT:api.session | match Fields |
| 867 | GET | `/api/onboarding-modules/overview` | `api\OnboardingApiController@overview` | api.session | RT:api.session | overview |
| 868 | GET | `/api/onboarding-modules/modules/{moduleKey}` | `api\OnboardingApiController@show` | api.session | RT:api.session | show |
| 869 | POST | `/api/onboarding-modules/steps/{stepId}` | `api\OnboardingApiController@updateStep` | api.session | RT:api.session | update Step |
| 892 | GET | `/api/fields-configuration` | `api\CustomFieldApiController@index` | - | CTRL:token (via context()) | index |
| 893 | POST | `/api/fields-configuration/update-sort` | `api\CustomFieldApiController@updateSortOrder` | - | CTRL:token (via context()) | update Sort Order |
| 894 | POST | `/api/fields-configuration` | `api\CustomFieldApiController@store` | - | CTRL:token (via context()) | store |
| 895 | GET | `/api/fields-configuration/{id}` | `api\CustomFieldApiController@show` | - | CTRL:token (via context()) | show |
| 896 | POST | `/api/fields-configuration/{id}` | `api\CustomFieldApiController@update` | - | CTRL:token (via context()) | update |
| 897 | POST | `/api/fields-configuration/{id}/delete` | `api\CustomFieldApiController@destroy` | - | CTRL:token (via context()) | destroy |
| 1010 | GET | `/api/v1/documents` | `api\v1\DocumentController@index` | - | NONE-FOUND | index |
| 1011 | POST | `/api/v1/documents` | `api\v1\DocumentController@store` | - | NONE-FOUND | store |
| 1012 | GET | `/api/v1/documents/{id}` | `api\v1\DocumentController@show` | - | NONE-FOUND | show |
| 1013 | PATCH | `/api/v1/documents/{id}` | `api\v1\DocumentController@update` | - | NONE-FOUND | update |
| 1014 | DELETE | `/api/v1/documents/{id}` | `api\v1\DocumentController@destroy` | - | NONE-FOUND | destroy |
| 1015 | GET | `/api/v1/trash/documents` | `api\v1\DocumentController@trash` | - | NONE-FOUND | trash |
| 1016 | POST | `/api/v1/trash/documents/{id}/restore` | `api\v1\DocumentController@restore` | - | NONE-FOUND | restore |
| 1017 | DELETE | `/api/v1/trash/documents/{id}` | `api\v1\DocumentController@purge` | - | NONE-FOUND | purge |
| 1018 | POST | `/api/v1/documents/{id}/confirm` | `api\v1\DocumentController@confirm` | - | NONE-FOUND | confirm |
| 1019 | POST | `/api/v1/documents/{id}/tags` | `api\v1\DocumentController@updateTags` | - | NONE-FOUND | update Tags |
| 1020 | GET | `/api/v1/documents/{id}/preview` | `api\v1\DocumentController@preview` | - | NONE-FOUND | preview |
| 1021 | GET | `/api/v1/documents/{id}/download` | `api\v1\DocumentController@download` | - | NONE-FOUND | download |
| 1022 | GET | `/api/v1/documents/{id}/versions` | `api\v1\DocumentController@getVersions` | - | NONE-FOUND | get Versions |
| 1023 | POST | `/api/v1/documents/{id}/versions` | `api\v1\DocumentController@addVersion` | - | NONE-FOUND | add Version |
| 1024 | POST | `/api/v1/documents/{id}/versions/{versionNumber}/restore` | `api\v1\DocumentController@restoreVersion` | - | NONE-FOUND | restore Version |
| 1025 | GET | `/api/v1/documents/{id}/related` | `api\v1\DocumentController@related` | - | NONE-FOUND | related |
| 1027 | POST | `/api/v1/search/parse` | `api\v1\DocumentController@parseSearch` | - | NONE-FOUND | parse Search |
| 1028 | GET | `/api/v1/browse/tree` | `api\v1\DocumentController@tree` | - | NONE-FOUND | tree |
| 1029 | GET | `/api/v1/tags` | `api\v1\DocumentController@tags` | - | NONE-FOUND | tags |
| 1030 | GET | `/api/v1/audit` | `api\v1\DocumentController@audit` | - | NONE-FOUND | audit |

**LMS content / courses / question bank / AI** (113)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 226 | GET/POST | `/api/lms-courses` | `api\ApiLmsCourseController@index` | - | G | index |
| 227 | GET/POST | `/api/lms-courses/search` | `api\ApiLmsCourseController@search` | - | G | search |
| 228 | POST | `/api/lms-chapter-concepts` | `api\ApiLmsCourseController@getChapterConcepts` | - | G | get Chapter Concepts |
| 229 | POST | `/api/lms-chapters` | `api\ApiLmsCourseController@chapters` | - | G | chapters |
| 230 | POST | `/api/lms-chapter-content` | `api\ApiLmsCourseController@chapterContent` | - | G | chapter Content |
| 231 | POST | `/api/lms-questions` | `api\ApiLmsCourseController@getLmsQuestions` | - | G | get Lms Questions |
| 232 | POST | `/api/lms-question-bank` | `api\ApiLmsCourseController@getQuestionBank` | - | G | get Question Bank |
| 233 | POST | `/api/lms-question-bank/create` | `api\ApiLmsCourseController@createQuestionBank` | - | G+staff | create Question Bank |
| 234 | POST | `/api/lms-question-bank/update` | `api\ApiLmsCourseController@updateQuestionBank` | - | G+staff | update Question Bank |
| 235 | POST | `/api/lms-question-bank/delete` | `api\ApiLmsCourseController@deleteQuestionBank` | - | G+staff | delete Question Bank |
| 236 | POST | `/api/lms-question-bank/review` | `api\ApiLmsCourseController@reviewQuestionBank` | - | G+staff | review Question Bank |
| 237 | GET | `/api/question-mapping-levels` | `api\ApiLmsCourseController@getQuestionMappingLevels` | - | G | get Question Mapping Levels |
| 242 | GET/POST | `/api/question-bank/filters` | `api\ApiQuestionBankController@filters` | - | G | filters |
| 243 | GET/POST | `/api/question-bank/search` | `api\ApiQuestionBankController@search` | - | G | search |
| 244 | GET/POST | `/api/question-bank/question-types` | `api\ApiQuestionBankController@questionTypes` | - | G | question Types |
| 245 | POST | `/api/lms-chapters/store` | `api\ApiLmsCourseController@storeChapter` | - | G+staff | store Chapter |
| 246 | POST | `/api/lms-create-content` | `api\ApiLmsCourseController@createContent` | lms.auth,perm:lms.content,create | RT:lms.auth+perm:lms.content,create | create Content |
| 247 | POST | `/api/lms-store-content` | `api\ApiLmsCourseController@storeContent` | lms.auth,perm:lms.content,create | RT:lms.auth+perm:lms.content,create | store Content |
| 248 | POST | `/api/lms-chapter-content/upload` | `api\ApiLmsCourseController@uploadContent` | lms.auth,perm:lms.content,create | RT:lms.auth+perm:lms.content,create | upload Content |
| 260 | GET | `/api/lms/content/authoring-vocabulary` | `api\lms\ContentAuthoringController@vocabulary` | lms.auth | RT:lms.auth | vocabulary |
| 261 | POST | `/api/lms/content/author` | `api\lms\ContentAuthoringController@store` | lms.auth,perm:lms.content,create | RT:lms.auth+perm:lms.content,create | store |
| 262 | POST | `/api/lms-content-mapping-values` | `api\ApiLmsCourseController@getContentMappingValues` | - | G | get Content Mapping Values |
| 263 | POST | `/api/lms-store-subject` | `api\ApiLmsCourseController@storeSubject` | - | G+staff | store Subject |
| 273 | POST | `/api/lms/gamma-content-master` | `lms\contentController@storeGammaContent` | throttle.contentgen | G+staff | store Gamma Content |
| 275 | GET | `/api/ai-sop` | `api\AiSopGenerationController@index` | - | G+staff | index |
| 276 | GET | `/api/ai-platforms` | `api\AiPlatformController@index` | - | G | index |
| 278 | POST | `/api/ai-sop/generate` | `api\AiSopGenerationController@generate` | - | G+staff | generate |
| 279 | POST | `/api/ai-sop/store` | `api\AiSopGenerationController@store` | - | G+staff | store |
| 394 | GET | `/api/lms/leaderboard` | `api\lms\LmsLeaderboardApiController@index` | api.session | RT:api.session | index |
| 395 | GET | `/api/lms/leaderboard/filters` | `api\lms\LmsLeaderboardApiController@filters` | api.session | RT:api.session | filters |
| 396 | GET | `/api/lms/leaderboard/rankings` | `api\lms\LmsLeaderboardApiController@rankings` | api.session | RT:api.session | rankings |
| 397 | GET | `/api/lms/leaderboard/{userId}` | `api\lms\LmsLeaderboardApiController@show` | api.session | RT:api.session | show |
| 403 | GET | `/api/lms/leaderboard-master` | `api\lms\LmsLeaderboardMasterApiController@index` | api.session,staff.only | RT:api.session+staff.only | index |
| 404 | POST | `/api/lms/leaderboard-master` | `api\lms\LmsLeaderboardMasterApiController@store` | api.session,staff.only | RT:api.session+staff.only | store |
| 405 | GET | `/api/lms/leaderboard-master/{id}` | `api\lms\LmsLeaderboardMasterApiController@show` | api.session,staff.only | RT:api.session+staff.only | show |
| 407 | PUT | `/api/lms/leaderboard-master/{id}` | `api\lms\LmsLeaderboardMasterApiController@update` | api.session,staff.only | RT:api.session+staff.only | update |
| 409 | DELETE | `/api/lms/leaderboard-master/{id}` | `api\lms\LmsLeaderboardMasterApiController@destroy` | api.session,staff.only | RT:api.session+staff.only | destroy |
| 414 | GET | `/api/lms/social-collaborative` | `api\lms\LmsSocialCollaborativeApiController@index` | api.session | RT:api.session | index |
| 415 | GET | `/api/lms/social-collaborative/lookups/subjects` | `api\lms\LmsSocialCollaborativeApiController@subjects` | api.session | RT:api.session | subjects |
| 416 | GET | `/api/lms/social-collaborative/lookups/chapters` | `api\lms\LmsSocialCollaborativeApiController@chapters` | api.session | RT:api.session | chapters |
| 417 | GET | `/api/lms/social-collaborative/lookups/topics` | `api\lms\LmsSocialCollaborativeApiController@topics` | api.session | RT:api.session | topics |
| 418 | GET | `/api/lms/social-collaborative/{id}` | `api\lms\LmsSocialCollaborativeApiController@show` | api.session | RT:api.session | show |
| 420 | POST | `/api/lms/social-collaborative` | `api\lms\LmsSocialCollaborativeApiController@store` | api.session | RT:api.session | store |
| 421 | POST | `/api/lms/social-collaborative/{id}/comments` | `api\lms\LmsSocialCollaborativeApiController@storeComment` | api.session | RT:api.session | store Comment |
| 468 | GET | `/api/question-paper/{id}/pdf` | `api\ApiQuestionPaperController@pdf` | - | G | pdf |
| 469 | APIRESOURCE | `/api/question-paper` | `api\ApiQuestionPaperController@resource` | - | G | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on ApiQuestionPaperController |
| 498 | POST | `/api/question-paper/search` | `api\ApiQuestionPaperController@search` | - | G | search |
| 505 | GET | `/api/question-paper-templates/paper/{paperId}` | `api\QuestionPaperTemplateApiController@paper` | - | G | paper |
| 506 | GET | `/api/question-paper-templates` | `api\QuestionPaperTemplateApiController@index` | - | G | index |
| 507 | GET | `/api/question-paper-templates/{id}` | `api\QuestionPaperTemplateApiController@show` | - | G | show |
| 508 | POST | `/api/question-paper-templates` | `api\QuestionPaperTemplateApiController@store` | - | G+staff | store |
| 509 | PUT/PATCH/POST | `/api/question-paper-templates/{id}` | `api\QuestionPaperTemplateApiController@update` | - | G+staff | update |
| 510 | DELETE | `/api/question-paper-templates/{id}` | `api\QuestionPaperTemplateApiController@destroy` | - | G+staff | destroy |
| 518 | GET | `/api/exam-evaluation/answer-key/{paperId}` | `api\ExamEvaluationApiController@answerKey` | - | G+staff | answer Key |
| 519 | GET | `/api/exam-evaluation/sheets/{id}` | `api\ExamEvaluationApiController@sheet` | - | G+staff | sheet |
| 520 | GET | `/api/exam-evaluation/sheets/{id}/file` | `api\ExamEvaluationApiController@file` | - | G+staff | file |
| 521 | POST | `/api/exam-evaluation/sheets/{id}/review` | `api\ExamEvaluationApiController@review` | - | G+staff | review |
| 522 | POST | `/api/exam-evaluation/sheets/{id}/reprocess` | `api\ExamEvaluationApiController@reprocess` | - | G+staff | reprocess |
| 523 | DELETE | `/api/exam-evaluation/sheets/{id}` | `api\ExamEvaluationApiController@destroySheet` | - | G+staff | destroy Sheet |
| 524 | GET | `/api/exam-evaluation/batches` | `api\ExamEvaluationApiController@index` | - | G+staff | index |
| 525 | POST | `/api/exam-evaluation/batches` | `api\ExamEvaluationApiController@store` | - | G+staff | store |
| 526 | GET | `/api/exam-evaluation/batches/{id}` | `api\ExamEvaluationApiController@show` | - | G+staff | show |
| 527 | POST | `/api/exam-evaluation/batches/{id}/sheets` | `api\ExamEvaluationApiController@uploadSheets` | - | G+staff | upload Sheets |
| 528 | POST | `/api/exam-evaluation/batches/{id}/publish` | `api\ExamEvaluationApiController@publish` | - | G+staff | publish |
| 529 | DELETE | `/api/exam-evaluation/batches/{id}` | `api\ExamEvaluationApiController@destroy` | - | G+staff | destroy |
| 537 | GET | `/api/assessment-blueprints/chapters` | `api\AssessmentBlueprintApiController@chapters` | - | G+staff | chapters |
| 542 | GET | `/api/assessment-blueprints/hpc-options` | `api\AssessmentBlueprintApiController@hpcOptions` | - | G+staff | hpc Options |
| 543 | POST | `/api/assessment-blueprints/hpc-options` | `api\AssessmentBlueprintApiController@saveHpcOptions` | - | G+staff | save Hpc Options |
| 544 | POST | `/api/assessment-blueprints/hpc-options/reset` | `api\AssessmentBlueprintApiController@resetHpcOptions` | - | G+staff | reset Hpc Options |
| 545 | POST | `/api/assessment-blueprints/clone` | `api\AssessmentBlueprintApiController@clone` | - | G+staff | clone |
| 546 | GET | `/api/assessment-blueprints` | `api\AssessmentBlueprintApiController@index` | - | G+staff | index |
| 547 | POST | `/api/assessment-blueprints` | `api\AssessmentBlueprintApiController@store` | - | G+staff | store |
| 548 | GET | `/api/assessment-blueprints/{id}` | `api\AssessmentBlueprintApiController@show` | - | G+staff | show |
| 549 | PUT/PATCH/POST | `/api/assessment-blueprints/{id}` | `api\AssessmentBlueprintApiController@update` | - | G+staff | update |
| 550 | DELETE | `/api/assessment-blueprints/{id}` | `api\AssessmentBlueprintApiController@destroy` | - | G+staff | destroy |
| 579 | GET/POST | `/api/intelligence/lesson-plans` | `api\lms\IntelligenceLessonPlanApiController@index` | - | G+staff | index |
| 582 | GET/POST | `/api/intelligence/curriculum-planning` | `api\lms\CurriculumPlanningApiController@index` | - | G+staff | index |
| 587 | GET/POST | `/api/intelligence/curriculum-planning/chapter` | `api\lms\CurriculumPlanningApiController@chapter` | - | G+staff | chapter |
| 590 | GET/POST | `/api/intelligence/monthly-plan` | `api\lms\MonthlyPlanApiController@index` | - | G+staff | index |
| 598 | GET/POST | `/api/intelligence/lesson-plan-detail` | `api\lms\LessonPlanDetailApiController@index` | - | G+staff | index |
| 601 | POST | `/api/intelligence/lesson-plan-periods` | `api\lms\LessonPlanPeriodApiController@store` | - | G+staff | store |
| 602 | POST | `/api/intelligence/lesson-plan-periods/{id}/update` | `api\lms\LessonPlanPeriodApiController@update` | - | G+staff | update |
| 603 | POST | `/api/intelligence/lesson-plan-periods/{id}/delete` | `api\lms\LessonPlanPeriodApiController@destroy` | - | G+staff | destroy |
| 606 | GET/POST | `/api/intelligence/lesson-plan-lookup/chapters` | `api\lms\LessonPlanLookupApiController@chapters` | - | G+staff | chapters |
| 607 | GET/POST | `/api/intelligence/lesson-plan-lookup/periods` | `api\lms\LessonPlanLookupApiController@periods` | - | G+staff | periods |
| 620 | GET/POST | `/api/lesson-intelligence/dropdowns` | `api\lms\LessonIntelligenceApiController@dropdowns` | - | G+staff | dropdowns |
| 621 | GET/POST | `/api/lesson-intelligence/dropdowns/filter` | `api\lms\LessonIntelligenceApiController@dropdownFilter` | - | G+staff | dropdown Filter |
| 624 | GET/POST | `/api/lesson-intelligence/capacity` | `api\lms\LessonIntelligenceApiController@capacity` | - | G+staff | capacity |
| 625 | GET/POST | `/api/lesson-intelligence/calendar-events` | `api\lms\LessonIntelligenceApiController@calendarEvents` | - | G+staff | calendar Events |
| 628 | GET/POST | `/api/lesson-intelligence/macro-plan/show` | `api\lms\LessonIntelligenceApiController@showMacroPlan` | - | G+staff | show Macro Plan |
| 629 | POST | `/api/lesson-intelligence/macro-plan` | `api\lms\LessonIntelligenceApiController@storeMacroPlan` | - | G+staff | store Macro Plan |
| 632 | GET/POST | `/api/lesson-intelligence/meso-plan/{planId}/teachers` | `api\lms\LessonIntelligenceApiController@mesoPlanTeachers` | - | G+staff | meso Plan Teachers |
| 633 | GET/POST | `/api/lesson-intelligence/meso-plan/{planId}/periods` | `api\lms\LessonIntelligenceApiController@mesoPlanPeriods` | - | G+staff | meso Plan Periods |
| 634 | POST | `/api/lesson-intelligence/meso-plan/{planId}` | `api\lms\LessonIntelligenceApiController@storeMesoPlan` | - | G+staff | store Meso Plan |
| 637 | POST | `/api/lesson-intelligence/micro-plan/period/{periodId}` | `api\lms\LessonIntelligenceApiController@storeMicroPlan` | - | G+staff | store Micro Plan |
| 638 | POST | `/api/lesson-intelligence/micro-plan/plan/{planId}/batch` | `api\lms\LessonIntelligenceApiController@storeMicroPlanBatch` | - | G+staff | store Micro Plan Batch |
| 654 | POST | `/api/intelligence/questions/generate` | `api\lms\IntelligenceQuestionGenerationApiController@generate` | api.session,staff.only,throttle.qgen | RT:api.session+staff.only ; G+staff | generate |
| 665 | POST | `/api/intelligence/content/generate` | `api\lms\IntelligenceContentGenerationApiController@generate` | api.session,staff.only,throttle.contentgen | RT:api.session+staff.only ; G+staff | generate |
| 669 | GET | `/api/semantic-intelligence` | `api\lms\SemanticIntelligenceApiController@index` | - | G+staff | index |
| 670 | GET | `/api/semantic-intelligence/{extraction_id}/result` | `api\lms\SemanticIntelligenceApiController@show` | - | G+staff | show |
| 671 | GET | `/api/semantic-intelligence/rows` | `api\lms\SemanticIntelligenceApiController@rows` | - | G+staff | rows |
| 678 | GET | `/api/lms/concept-intelligence/lookup` | `api\lms\ConceptIntelligenceIndexController@lookup` | - | G | lookup |
| 679 | GET | `/api/lms/concept-intelligence/{chapterId}/index` | `api\lms\ConceptIntelligenceIndexController@show` | - | G | show |
| 683 | GET/POST | `/api/lms/concept-intelligence/tab-labels` | `api\lms\ConceptIntelligenceTabLabelApiController@index` | - | G | index |
| 684 | POST | `/api/lms/concept-intelligence/tab-labels/update` | `api\lms\ConceptIntelligenceTabLabelApiController@update` | - | G+staff | update |
| 685 | POST | `/api/lms/concept-intelligence/tab-labels/reset` | `api\lms\ConceptIntelligenceTabLabelApiController@reset` | - | G+staff | reset |
| 706 | GET | `/api/lms/coherence-map` | `api\lms\CoherenceMapApiController@show` | lms.auth | RT:lms.auth | show |
| 711 | GET | `/api/lms/coherence-map/concept/{conceptId}` | `api\lms\CoherenceMapApiController@showForConcept` | lms.auth | RT:lms.auth | show For Concept |
| 717 | POST | `/api/lms/coherence-map/relations/bulk` | `api\lms\CoherenceMapApiController@bulkReview` | lms.auth,perm:lms.curriculum,update | RT:lms.auth+perm:lms.curriculum,update | bulk Review |
| 718 | POST | `/api/lms/coherence-map/relations` | `api\lms\CoherenceMapApiController@storeRelation` | lms.auth,perm:lms.curriculum,update | RT:lms.auth+perm:lms.curriculum,update | store Relation |
| 719 | PATCH | `/api/lms/coherence-map/relations/{source}/{id}` | `api\lms\CoherenceMapApiController@reviewRelation` | lms.auth,perm:lms.curriculum,update | RT:lms.auth+perm:lms.curriculum,update | review Relation |
| 721 | DELETE | `/api/lms/coherence-map/relations/{source}/{id}` | `api\lms\CoherenceMapApiController@destroyRelation` | lms.auth,perm:lms.curriculum,update | RT:lms.auth+perm:lms.curriculum,update | destroy Relation |
| 882 | GET | `/api/document-templates/{id}/versions/{version}` | `api\DocumentTemplateApiController@versionContent` | - | G+staff | version Content |

**Admission** (17)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 434 | GET | `/api/admission_enquiry` | `api\admissionEnquiryAPIController@index` | - | G+staff | index |
| 435 | POST | `/api/admission_enquiry` | `api\admissionEnquiryAPIController@store` | - | G+staff | store |
| 436 | PUT/PATCH | `/api/admission_enquiry/{id}` | `api\admissionEnquiryAPIController@update` | - | G+staff | update |
| 437 | DELETE | `/api/admission_enquiry/{id}` | `api\admissionEnquiryAPIController@destroy` | - | G+staff | destroy |
| 442 | GET | `/api/online_admission_confirm` | `api\onlineAdmissionConfirmAPIController@index` | - | G+staff | index |
| 443 | POST | `/api/online_admission_confirm` | `api\onlineAdmissionConfirmAPIController@store` | - | NONE-FOUND | store |
| 444 | GET | `/api/online_admission_confirm/{id}` | `api\onlineAdmissionConfirmAPIController@show` | - | G+staff | show |
| 445 | PUT/PATCH | `/api/online_admission_confirm/{id}` | `api\onlineAdmissionConfirmAPIController@update` | - | G+staff | update |
| 446 | DELETE | `/api/online_admission_confirm/{id}` | `api\onlineAdmissionConfirmAPIController@destroy` | - | G+staff | destroy |
| 450 | GET | `/api/admission_registration` | `api\admissionRegistrationAPIController@index` | - | G+staff | index |
| 451 | GET | `/api/admission_registration/{id}/edit` | `api\admissionRegistrationAPIController@edit` | - | G+staff | edit |
| 452 | PUT/PATCH | `/api/admission_registration/{id}` | `api\admissionRegistrationAPIController@update` | - | G+staff | update |
| 453 | DELETE | `/api/admission_registration/{id}` | `api\admissionRegistrationAPIController@destroy` | - | G+staff | destroy |
| 454 | POST | `/api/admission_student` | `api\admissionRegistrationAPIController@saveStudent` | - | G+staff | save Student |
| 455 | GET | `/api/ajax_getDivision` | `api\admissionRegistrationAPIController@ajax_getDivision` | - | G+staff | ajax get Division |
| 460 | GET | `/api/admission_without_confirmation_report_v2` | `api\admissionRegistrationAPIController@indexWithoutConfirmationReport` | - | G+staff | index Without Confirmation Report |
| 461 | GET | `/api/admission_without_confirmation_report_v2/{id}/edit` | `api\admissionRegistrationAPIController@editWithoutConfirmationReport` | - | G+staff | edit Without Confirmation Report |

**Students (setup / care / registration)** (4)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 480 | POST | `/api/transportation-setup/student-mappings/bulk` | `api\TransportationApiController@bulkStore` | - | CTRL:token (via context()) | bulk Store |
| 481 | POST | `/api/transportation-setup/student-mappings/bulk-delete` | `api\TransportationApiController@bulkDestroy` | - | CTRL:token (via context()) | bulk Destroy |
| 799 | GET | `/api/consents/students` | `api\ConsentApiController@students` | - | CTRL:token (via authenticate()) | students |
| 879 | GET | `/api/document-templates/preview-students` | `api\DocumentTemplateApiController@previewStudents` | - | G+staff | preview Students |

**Transport** (4)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 482 | GET | `/api/transportation-setup/{module}` | `api\TransportationApiController@index` | - | CTRL:token (via context()) | index |
| 483 | POST | `/api/transportation-setup/{module}` | `api\TransportationApiController@store` | - | CTRL:token (via context()) | store |
| 484 | PUT/PATCH | `/api/transportation-setup/{module}/{id}` | `api\TransportationApiController@update` | - | CTRL:token (via context()) | update |
| 485 | DELETE | `/api/transportation-setup/{module}/{id}` | `api\TransportationApiController@destroy` | - | CTRL:token (via context()) | destroy |

**Library / inventory / inward-outward** (7)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 491 | GET | `/api/inventory/{module}` | `api\InventoryApiController@index` | - | CTRL:token (via context()) | index |
| 492 | GET | `/api/inventory/reports/{module}` | `api\InventoryApiController@reportIndex` | - | G+staff | report Index |
| 493 | GET | `/api/inventory/receivables/items` | `api\InventoryApiController@poItems` | - | CTRL:token (via context()) | po Items |
| 494 | POST | `/api/inventory/{module}` | `api\InventoryApiController@store` | - | CTRL:token (via context()) | store |
| 495 | POST | `/api/inventory/receivables/multiple` | `api\InventoryApiController@saveReceivables` | - | CTRL:token (via context()) | save Receivables |
| 496 | PUT/PATCH | `/api/inventory/{module}/{id}` | `api\InventoryApiController@update` | - | CTRL:token (via context()) | update |
| 497 | DELETE | `/api/inventory/{module}/{id}` | `api\InventoryApiController@destroy` | - | CTRL:token (via context()) | destroy |

**PTM / consent / visitor / front desk** (9)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 800 | GET | `/api/consents` | `api\ConsentApiController@index` | - | CTRL:token (via authenticate()) | index |
| 801 | POST | `/api/consents/delete` | `api\ConsentApiController@destroy` | - | CTRL:token (via authenticate()) | destroy |
| 802 | POST | `/api/consents` | `api\ConsentApiController@store` | - | CTRL:token (via authenticate()) | store |
| 808 | GET | `/api/front-desk/report` | `api\FrontDeskApiController@report` | - | CTRL:token (via authenticate()) | report |
| 809 | GET | `/api/front-desk` | `api\FrontDeskApiController@index` | - | CTRL:token (via authenticate()) | index |
| 820 | GET | `/api/front-desk/{id}` | `api\FrontDeskApiController@show` | - | CTRL:token (via authenticate()) | show |
| 821 | POST | `/api/front-desk` | `api\FrontDeskApiController@store` | - | CTRL:token (via authenticate()) | store |
| 822 | POST | `/api/front-desk/{id}/delete` | `api\FrontDeskApiController@destroy` | - | CTRL:token (via authenticate()) | destroy |
| 823 | POST | `/api/front-desk/{id}` | `api\FrontDeskApiController@update` | - | CTRL:token (via authenticate()) | update |


### teacherapi.php  (34 routes, 0 commented)
Registration: prefix `(none)`; NO group middleware at all (no web, no api, no api.jwt, no CSRF, no throttle); RouteServiceProvider.php:390-393 (mapTeacherApiRoutes)

**Authentication / session / bootstrap** (1)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 19 | POST | `/teacher_homescreen` | `api\teacherapiController@teacher_homescreen` | - | CTRL:token (resolveActingTeacherId,jwtPayload) | teacher homescreen |

**LMS content / courses / question bank / AI** (12)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 21 | POST | `/teacherSocialCollabrativeAPI` | `api\teacherapiController@teacherSocialCollabrativeAPI` | - | CTRL:token (resolveActingTeacherId) | teacher Social Collabrative API |
| 23 | POST | `/add_teacherSocialCollabrativeAPI` | `api\teacherapiController@add_teacherSocialCollabrativeAPI` | - | CTRL:token (resolveActingTeacherId) | add teacher Social Collabrative API |
| 25 | POST | `/add_teacherContentAPI` | `api\teacherapiController@add_teacherContentAPI` | - | CTRL:token (resolveActingTeacherId) | add teacher Content API |
| 27 | POST | `/get_teacherVirtualClassroomAPI` | `api\teacherapiController@get_teacherVirtualClassroomAPI` | - | CTRL:token (resolveActingTeacherId) | get teacher Virtual Classroom API |
| 29 | POST | `/add_teacherVirtualClassroomAPI` | `api\teacherapiController@add_teacherVirtualClassroomAPI` | - | CTRL:token (resolveActingTeacherId) | add teacher Virtual Classroom API |
| 31 | POST | `/get_teacherResourceFieldAPI` | `api\teacherapiController@get_teacherResourceFieldAPI` | - | CTRL:token (resolveActingTeacherId) | get teacher Resource Field API |
| 33 | POST | `/get_teacherResourceAPI` | `api\teacherapiController@get_teacherResourceAPI` | - | CTRL:token (resolveActingTeacherId) | get teacher Resource API |
| 35 | POST | `/add_teacherResourceAPI` | `api\teacherapiController@add_teacherResourceAPI` | - | CTRL:token (resolveActingTeacherId) | add teacher Resource API |
| 37 | POST | `/add_teacherQuestionAnswerAPI` | `api\teacherapiController@add_teacherQuestionAnswerAPI` | - | CTRL:token (resolveActingTeacherId) | add teacher Question Answer API |
| 43 | POST | `/get_teacherContentAPI` | `api\teacherapiController@get_teacherContentAPI` | - | CTRL:token (resolveActingTeacherId) | get teacher Content API |
| 51 | POST | `/add_teacherLessonPlanning` | `api\teacherapiController@add_teacherLessonPlanning` | - | CTRL:token (resolveActingTeacherId) | add teacher Lesson Planning |
| 53 | POST | `/add_teacherLessonPlanningExecution` | `api\teacherapiController@add_teacherLessonPlanningExecution` | - | CTRL:token (resolveActingTeacherId) | add teacher Lesson Planning Execution |

**Students (setup / care / registration)** (1)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 39 | POST | `/add_teacherStudentDisciplineAPI` | `api\teacherapiController@add_teacherStudentDisciplineAPI` | - | CTRL:token (resolveActingTeacherId) | add teacher Student Discipline API |

**Teachers / staff users & rights** (9)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 41 | POST | `/get_teacherSubjectAPI` | `api\teacherapiController@get_teacherSubjectAPI` | - | CTRL:token (resolveActingTeacherId) | get teacher Subject API |
| 55 | POST | `/get_teacherPTMBookingList` | `api\teacherapiController@get_teacherPTMBookingList` | - | CTRL:token (resolveActingTeacherId) | get teacher PTMBooking List |
| 57 | POST | `/add_teacherPTMStatus` | `api\teacherapiController@add_teacherPTMStatus` | - | CTRL:token (resolveActingTeacherId) | add teacher PTMStatus |
| 68 | POST | `/get_teachertaskAPI` | `api\teacherapiController@get_teachertaskAPI` | - | CTRL:token (resolveActingTeacherId) | get teachertask API |
| 70 | POST | `/add_teachertaskAPI` | `api\teacherapiController@add_teachertaskAPI` | - | CTRL:token (resolveActingTeacherId) | add teachertask API |
| 72 | POST | `/get_teacherRequisitionAPI` | `api\teacherapiController@get_teacherRequisitionAPI` | - | CTRL:token (resolveActingTeacherId) | get teacher Requisition API |
| 74 | POST | `/add_teacherRequisitionAPI` | `api\teacherapiController@add_teacherRequisitionAPI` | - | CTRL:token (resolveActingTeacherId) | add teacher Requisition API |
| 76 | POST | `/get_teachercomplaintAPI` | `api\teacherapiController@get_teachercomplaintAPI` | - | CTRL:token (resolveActingTeacherId) | get teachercomplaint API |
| 78 | POST | `/add_teachercomplaintAPI` | `api\teacherapiController@add_teachercomplaintAPI` | - | CTRL:token (resolveActingTeacherId) | add teachercomplaint API |

**Timetable / calendar** (3)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 45 | POST | `/get_teacher_timetablewiseStandard` | `api\teacherapiController@get_teacher_timetablewiseStandard` | - | CTRL:token (resolveActingTeacherId) | get teacher timetablewise Standard |
| 47 | POST | `/get_teacher_timetablewiseSubject` | `api\teacherapiController@get_teacher_timetablewiseSubject` | - | CTRL:token (resolveActingTeacherId) | get teacher timetablewise Subject |
| 49 | POST | `/get_teacher_timetablewiseDivision` | `api\teacherapiController@get_teacher_timetablewiseDivision` | - | CTRL:token (resolveActingTeacherId) | get teacher timetablewise Division |

**Exams / results** (5)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 59 | POST | `/get_teacherResultExamList` | `api\teacherapiController@get_teacherResultExamList` | - | CTRL:token (resolveActingTeacherId) | get teacher Result Exam List |
| 61 | POST | `/get_teacherResultCoscholasticParentList` | `api\teacherapiController@get_teacherResultCoscholasticParentList` | - | CTRL:token (resolveActingTeacherId) | get teacher Result Coscholastic Parent List |
| 64 | POST | `/get_teacherResultCoscholasticList` | `api\teacherapiController@get_teacherResultCoscholasticList` | - | CTRL:token (resolveActingTeacherId) | get teacher Result Coscholastic List |
| 66 | POST | `/add_teacherExamSchedule` | `api\teacherapiController@add_teacherExamSchedule` | - | CTRL:token (resolveActingTeacherId) | add teacher Exam Schedule |
| 80 | POST | `/get_teacherExamSchedule` | `api\teacherapiController@get_teacherExamSchedule` | - | CTRL:token (resolveActingTeacherId) | get teacher Exam Schedule |

**PTM / consent / visitor / front desk** (3)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 85 | POST | `/get_visitorAPI` | `visitor_management\visitor_masterController@get_visitorAPI` | - | CTRL:token (jwtToken) | get visitor API |
| 87 | POST | `/add_visitorAPI` | `visitor_management\visitor_masterController@store` | - | CTRL:session() only | store |
| 89 | POST | `/get_visitorTypeAPI` | `visitor_management\visitor_masterController@get_visitorTypeAPI` | - | CTRL:token (jwtToken) | get visitor Type API |


### adminapi.php  (63 routes, 0 commented)
Registration: prefix `(none)`; NO group middleware at all; RouteServiceProvider.php:396-399 (mapAdminApiRoutes)

**Authentication / session / bootstrap** (3)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 25 | POST | `/admin_login` | `api\adminapiController@admin_login` | - | PUBLIC (login/OTP, throttled) | admin login |
| 26 | POST | `/admin_check_otp` | `api\adminapiController@admin_check_otp` | - | PUBLIC (login/OTP, throttled) | admin check otp |
| 27 | POST | `/get_Syear` | `api\adminapiController@get_Syear` | - | NONE-FOUND | get Syear |

**Other** (5)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 29 | POST | `/get_adminAcademicSection` | `api\adminapiController@get_adminAcademicSection` | - | CTRL:token (jwtToken) | get admin Academic Section |
| 31 | POST | `/get_adminStandard` | `api\adminapiController@get_adminStandard` | - | CTRL:token (jwtToken) | get admin Standard |
| 33 | POST | `/get_adminDivision` | `api\adminapiController@get_adminDivision` | - | CTRL:token (jwtToken) | get admin Division |
| 35 | POST | `/get_adminSubject` | `api\adminapiController@get_adminSubject` | - | CTRL:token (jwtToken) | get admin Subject |
| 79 | POST | `/get_adminItemListAPI` | `api\adminapiController@get_adminItemListAPI` | - | CTRL:token (jwtToken) | get admin Item List API |

**Students (setup / care / registration)** (20)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 37 | POST | `/get_adminStudentList` | `api\adminapiController@get_adminStudentList` | - | CTRL:token (jwtToken) | get admin Student List |
| 104 | POST | `/get_adminStudentSearch` | `api\StudentSearchApiController@search` | - | CTRL:token (jwtToken) | search |
| 105 | PUT | `/get_adminStudentSearch/{studentId}` | `api\StudentSearchApiController@update` | - | CTRL:token (jwtToken) | update |
| 106 | GET | `/bulk-students/metadata` | `api\BulkStudentApiController@metadata` | - | CTRL:token (via authenticate()) | metadata |
| 107 | POST | `/bulk-students/search` | `api\BulkStudentApiController@search` | - | CTRL:token (via authenticate()) | search |
| 108 | PUT | `/bulk-students` | `api\BulkStudentApiController@update` | - | CTRL:token (via authenticate()) | update |
| 109 | GET | `/student-infirmary` | `api\StudentInfirmaryApiController@index` | - | CTRL:token (via authenticate()) | index |
| 110 | GET | `/student-infirmary/students` | `api\StudentInfirmaryApiController@students` | - | CTRL:token (via authenticate()) | students |
| 111 | POST | `/student-infirmary` | `api\StudentInfirmaryApiController@store` | - | CTRL:token (via authenticate()) | store |
| 112 | PUT | `/student-infirmary/{id}` | `api\StudentInfirmaryApiController@update` | - | CTRL:token (via authenticate()) | update |
| 113 | DELETE | `/student-infirmary/{id}` | `api\StudentInfirmaryApiController@destroy` | - | CTRL:token (via authenticate()) | destroy |
| 114 | GET | `/student-care/{module}` | `api\StudentCareApiController@index` | - | CTRL:token (via authenticate()) | index |
| 115 | POST | `/student-care/{module}` | `api\StudentCareApiController@store` | - | CTRL:token (via authenticate()) | store |
| 116 | PUT | `/student-care/{module}/{id}` | `api\StudentCareApiController@update` | - | CTRL:token (via authenticate()) | update |
| 117 | DELETE | `/student-care/{module}/{id}` | `api\StudentCareApiController@destroy` | - | CTRL:token (via authenticate()) | destroy |
| 122 | POST | `/student-optional-subject/search` | `api\StudentOptionalSubjectApiController@search` | - | CTRL:token (via guard()) | search |
| 123 | PUT | `/student-optional-subject` | `api\StudentOptionalSubjectApiController@sync` | - | CTRL:token (via guard()) | sync |
| 124 | GET | `/student-registration/metadata` | `api\StudentRegistrationApiController@metadata` | - | CTRL:token (via guard()) | metadata |
| 125 | GET | `/student-registration/next-enrollment-no` | `api\StudentRegistrationApiController@nextEnrollmentNo` | - | CTRL:token (via guard()) | next Enrollment No |
| 126 | POST | `/student-registration` | `api\StudentRegistrationApiController@store` | - | CTRL:token (via guard()) | store |

**Teachers / staff users & rights** (1)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 39 | POST | `/get_adminTeacherList` | `api\adminapiController@get_adminTeacherList` | - | CTRL:token (jwtToken) | get admin Teacher List |

**HRMS / leave / staff attendance** (3)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 41 | POST | `/get_adminLeaveApplicationListAPI` | `api\adminapiController@get_adminLeaveApplicationListAPI` | - | CTRL:token (jwtToken) | get admin Leave Application List API |
| 43 | POST | `/add_adminLeaveApplicationSaveAPI` | `api\adminapiController@add_adminLeaveApplicationSaveAPI` | - | CTRL:token (jwtToken) | add admin Leave Application Save API |
| 57 | POST | `/get_adminTodaysProxyListAPI` | `api\adminapiController@get_adminTodaysProxyListAPI` | - | CTRL:token (jwtToken) | get admin Todays Proxy List API |

**Communication / notices / chat** (18)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 45 | POST | `/get_adminParentCommunicationListAPI` | `api\adminapiController@get_adminParentCommunicationListAPI` | - | CTRL:token (jwtToken) | get admin Parent Communication List API |
| 47 | POST | `/add_adminParentCommunicationSaveAPI` | `api\adminapiController@add_adminParentCommunicationSaveAPI` | - | CTRL:token (jwtToken) | add admin Parent Communication Save API |
| 49 | POST | `/get_adminPhotoVideoAPI` | `api\adminapiController@get_adminPhotoVideoAPI` | - | CTRL:token (jwtToken) | get admin Photo Video API |
| 51 | POST | `/add_adminPhotoVideoAPI` | `api\adminapiController@add_adminPhotoVideoAPI` | - | CTRL:token (jwtToken) | add admin Photo Video API |
| 59 | POST | `/add_adminSendSmsAPI` | `api\adminapiController@add_adminSendSmsAPI` | - | CTRL:token (jwtToken) | add admin Send Sms API |
| 61 | POST | `/add_adminSendEmailAPI` | `api\adminapiController@add_adminSendEmailAPI` | - | CTRL:token (jwtToken) | add admin Send Email API |
| 67 | POST | `/get_taskAPI` | `api\adminapiController@get_taskAPI` | - | CTRL:token (jwtToken) | get task API |
| 69 | POST | `/add_taskAPI` | `api\adminapiController@add_taskAPI` | - | CTRL:token (jwtToken) | add task API |
| 71 | POST | `/get_complaintAPI` | `api\adminapiController@get_complaintAPI` | - | CTRL:token (jwtToken) | get complaint API |
| 73 | POST | `/add_complaintAPI` | `api\adminapiController@add_complaintAPI` | - | CTRL:token (jwtToken) | add complaint API |
| 75 | POST | `/get_adminAllRequisitionAPI` | `api\adminapiController@get_adminAllRequisitionAPI` | - | CTRL:token (jwtToken) | get admin All Requisition API |
| 77 | POST | `/get_adminRequisitionByListAPI` | `api\adminapiController@get_adminRequisitionByListAPI` | - | CTRL:token (jwtToken) | get admin Requisition By List API |
| 81 | POST | `/add_adminRequisitionAPI` | `api\adminapiController@add_adminRequisitionAPI` | - | CTRL:token (jwtToken) | add admin Requisition API |
| 83 | POST | `/get_RequisitionStatusAPI` | `api\adminapiController@get_RequisitionStatusAPI` | - | CTRL:token (jwtToken) | get Requisition Status API |
| 85 | POST | `/adminApprovedRequisitionAPI` | `api\adminapiController@adminApprovedRequisitionAPI` | - | CTRL:token (jwtToken) | admin Approved Requisition API |
| 87 | POST | `/add_adminCircularAPI` | `api\adminapiController@add_adminCircularAPI` | - | CTRL:token (jwtToken) | add admin Circular API |
| 89 | POST | `/get_adminCircularAPI` | `api\adminapiController@get_adminCircularAPI` | - | CTRL:token (jwtToken) | get admin Circular API |
| 91 | POST | `/add_SendNotificationAPI` | `api\adminapiController@add_SendNotificationAPI` | - | CTRL:token (jwtToken) | add Send Notification API |

**PTM / consent / visitor / front desk** (2)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 53 | POST | `/get_adminPTMBookingTodaysListAPI` | `api\adminapiController@get_adminPTMBookingTodaysListAPI` | - | CTRL:token (jwtToken) | get admin PTMBooking Todays List API |
| 55 | POST | `/get_adminVisitorListAPI` | `api\adminapiController@get_adminVisitorListAPI` | - | CTRL:token (jwtToken) | get admin Visitor List API |

**Dashboards** (2)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 63 | POST | `/get_attendanceGraphAPI` | `api\adminapiController@get_attendanceGraphAPI` | - | CTRL:token (jwtToken) | get attendance Graph API |
| 65 | POST | `/get_feesGraphAPI` | `api\adminapiController@get_feesGraphAPI` | - | CTRL:token (jwtToken) | get fees Graph API |

**Exams / results** (1)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 93 | POST | `/get_wrtreportAPI` | `api\adminapiController@get_wrtreportAPI` | - | CTRL:token (jwtToken,jwtPayload) | get wrtreport API |

**Attendance (student)** (4)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 95 | POST | `/add_studentCapturePhotosAPI` | `api\adminapiController@add_studentCapturePhotosAPI` | - | CTRL:token (jwtToken) | add student Capture Photos API |
| 97 | POST | `/add_studentCaptureAttendanceAPI` | `api\adminapiController@add_studentCaptureAttendanceAPI` | - | CTRL:token (jwtToken) | add student Capture Attendance API |
| 99 | POST | `/get_attendanceDataAPI` | `api\adminapiController@get_attendanceDataAPI` | - | CTRL:token (jwtToken) | get attendance Data API |
| 101 | POST | `/get_studentCapturePhotosAPI` | `api\adminapiController@get_studentCapturePhotosAPI` | - | CTRL:token (jwtToken) | get student Capture Photos API |

**LMS content / courses / question bank / AI** (4)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 118 | GET | `/student-setup/{resource}` | `api\StudentSetupApiController@index` | - | CTRL:token (via guard()) | index |
| 119 | POST | `/student-setup/{resource}` | `api\StudentSetupApiController@store` | - | CTRL:token (via guard()) | store |
| 120 | PUT | `/student-setup/{resource}/{id}` | `api\StudentSetupApiController@update` | - | CTRL:token (via guard()) | update |
| 121 | DELETE | `/student-setup/{resource}/{id}` | `api\StudentSetupApiController@destroy` | - | CTRL:token (via guard()) | destroy |


### resultapi.php  (185 routes, 0 commented)
Registration: prefix `api`; api group; RouteServiceProvider.php:270-275

**Exams / results** (183)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 53 | GET | `/api/sqaa/levels` | `api\sqaa\SqaaApiController@levels` | api.session | RT:api.session | levels |
| 54 | GET | `/api/sqaa/entry/{menuId}` | `api\sqaa\SqaaApiController@entry` | api.session | RT:api.session | entry |
| 55 | POST | `/api/sqaa/entry` | `api\sqaa\SqaaApiController@store` | api.session | RT:api.session | store |
| 56 | GET | `/api/sqaa/document-report` | `api\sqaa\SqaaApiController@documentReport` | api.session | RT:api.session | document Report |
| 62 | GET | `/api/result/exam-master/create` | `api\result\ExamMasterApiController@create` | api.session | RT:api.session | create |
| 63 | GET | `/api/result/exam-master/dropdown` | `api\result\ExamMasterApiController@dropdown` | api.session | RT:api.session | dropdown |
| 64 | DELETE | `/api/result/exam-master/bulk` | `api\result\ExamMasterApiController@bulkDestroy` | api.session | RT:api.session | bulk Destroy |
| 65 | GET | `/api/result/exam-master` | `api\result\ExamMasterApiController@index` | api.session | RT:api.session | index |
| 66 | POST | `/api/result/exam-master` | `api\result\ExamMasterApiController@store` | api.session | RT:api.session | store |
| 67 | GET | `/api/result/exam-master/{id}` | `api\result\ExamMasterApiController@show` | api.session | RT:api.session | show |
| 68 | PUT | `/api/result/exam-master/{id}` | `api\result\ExamMasterApiController@update` | api.session | RT:api.session | update |
| 69 | DELETE | `/api/result/exam-master/{id}` | `api\result\ExamMasterApiController@destroy` | api.session | RT:api.session | destroy |
| 72 | GET | `/api/result/exam-type-master/create` | `api\result\ExamTypeMasterApiController@create` | api.session | RT:api.session | create |
| 73 | GET | `/api/result/exam-type-master/dropdown` | `api\result\ExamTypeMasterApiController@dropdown` | api.session | RT:api.session | dropdown |
| 74 | DELETE | `/api/result/exam-type-master/bulk` | `api\result\ExamTypeMasterApiController@bulkDestroy` | api.session | RT:api.session | bulk Destroy |
| 75 | GET | `/api/result/exam-type-master` | `api\result\ExamTypeMasterApiController@index` | api.session | RT:api.session | index |
| 76 | POST | `/api/result/exam-type-master` | `api\result\ExamTypeMasterApiController@store` | api.session | RT:api.session | store |
| 77 | GET | `/api/result/exam-type-master/{id}` | `api\result\ExamTypeMasterApiController@show` | api.session | RT:api.session | show |
| 78 | PUT | `/api/result/exam-type-master/{id}` | `api\result\ExamTypeMasterApiController@update` | api.session | RT:api.session | update |
| 79 | DELETE | `/api/result/exam-type-master/{id}` | `api\result\ExamTypeMasterApiController@destroy` | api.session | RT:api.session | destroy |
| 82 | GET | `/api/result/grade-master/create-data/{id}` | `api\result\GradeMasterApiController@createData` | api.session | RT:api.session | create Data |
| 83 | GET | `/api/result/grade-master/dropdown` | `api\result\GradeMasterApiController@dropdown` | api.session | RT:api.session | dropdown |
| 84 | DELETE | `/api/result/grade-master/bulk` | `api\result\GradeMasterApiController@bulkDestroy` | api.session | RT:api.session | bulk Destroy |
| 85 | GET | `/api/result/grade-master` | `api\result\GradeMasterApiController@index` | api.session | RT:api.session | index |
| 86 | POST | `/api/result/grade-master` | `api\result\GradeMasterApiController@store` | api.session | RT:api.session | store |
| 87 | DELETE | `/api/result/grade-master/{id}` | `api\result\GradeMasterApiController@destroy` | api.session | RT:api.session | destroy |
| 90 | GET | `/api/result/standard-grade-mapping/create` | `api\result\StdGradeMappingApiController@create` | api.session | RT:api.session | create |
| 91 | GET | `/api/result/standard-grade-mapping/dropdown` | `api\result\StdGradeMappingApiController@dropdown` | api.session | RT:api.session | dropdown |
| 92 | DELETE | `/api/result/standard-grade-mapping/bulk` | `api\result\StdGradeMappingApiController@bulkDestroy` | api.session | RT:api.session | bulk Destroy |
| 93 | GET | `/api/result/standard-grade-mapping` | `api\result\StdGradeMappingApiController@index` | api.session | RT:api.session | index |
| 94 | POST | `/api/result/standard-grade-mapping` | `api\result\StdGradeMappingApiController@store` | api.session | RT:api.session | store |
| 95 | GET | `/api/result/standard-grade-mapping/{id}` | `api\result\StdGradeMappingApiController@show` | api.session | RT:api.session | show |
| 96 | PUT | `/api/result/standard-grade-mapping/{id}` | `api\result\StdGradeMappingApiController@update` | api.session | RT:api.session | update |
| 97 | DELETE | `/api/result/standard-grade-mapping/{id}` | `api\result\StdGradeMappingApiController@destroy` | api.session | RT:api.session | destroy |
| 100 | DELETE | `/api/result/working-day-master/bulk` | `api\result\WorkingDayMasterApiController@bulkDestroy` | api.session | RT:api.session | bulk Destroy |
| 101 | GET | `/api/result/working-day-master` | `api\result\WorkingDayMasterApiController@index` | api.session | RT:api.session | index |
| 102 | POST | `/api/result/working-day-master` | `api\result\WorkingDayMasterApiController@store` | api.session | RT:api.session | store |
| 103 | GET | `/api/result/working-day-master/{id}` | `api\result\WorkingDayMasterApiController@show` | api.session | RT:api.session | show |
| 104 | PUT | `/api/result/working-day-master/{id}` | `api\result\WorkingDayMasterApiController@update` | api.session | RT:api.session | update |
| 105 | DELETE | `/api/result/working-day-master/{id}` | `api\result\WorkingDayMasterApiController@destroy` | api.session | RT:api.session | destroy |
| 108 | GET | `/api/result/result-remark-master/dropdown` | `api\result\ResultRemarkMasterApiController@dropdown` | api.session | RT:api.session | dropdown |
| 109 | DELETE | `/api/result/result-remark-master/bulk` | `api\result\ResultRemarkMasterApiController@bulkDestroy` | api.session | RT:api.session | bulk Destroy |
| 110 | GET | `/api/result/result-remark-master` | `api\result\ResultRemarkMasterApiController@index` | api.session | RT:api.session | index |
| 111 | POST | `/api/result/result-remark-master` | `api\result\ResultRemarkMasterApiController@store` | api.session | RT:api.session | store |
| 112 | GET | `/api/result/result-remark-master/{id}` | `api\result\ResultRemarkMasterApiController@show` | api.session | RT:api.session | show |
| 113 | PUT | `/api/result/result-remark-master/{id}` | `api\result\ResultRemarkMasterApiController@update` | api.session | RT:api.session | update |
| 114 | DELETE | `/api/result/result-remark-master/{id}` | `api\result\ResultRemarkMasterApiController@destroy` | api.session | RT:api.session | destroy |
| 117 | GET | `/api/result/result-master/dropdown` | `api\result\ResultMasterApiController@dropdownList` | api.session | RT:api.session | dropdown List |
| 118 | DELETE | `/api/result/result-master/bulk` | `api\result\ResultMasterApiController@bulkDestroy` | api.session | RT:api.session | bulk Destroy |
| 119 | GET | `/api/result/result-master` | `api\result\ResultMasterApiController@index` | api.session | RT:api.session | index |
| 120 | POST | `/api/result/result-master` | `api\result\ResultMasterApiController@store` | api.session | RT:api.session | store |
| 121 | GET | `/api/result/result-master/{id}` | `api\result\ResultMasterApiController@show` | api.session | RT:api.session | show |
| 122 | PUT | `/api/result/result-master/{id}` | `api\result\ResultMasterApiController@update` | api.session | RT:api.session | update |
| 123 | DELETE | `/api/result/result-master/{id}` | `api\result\ResultMasterApiController@destroy` | api.session | RT:api.session | destroy |
| 126 | GET | `/api/result/exam-creation/create` | `api\result\ExamCreationApiController@create` | api.session | RT:api.session | create |
| 127 | GET | `/api/result/exam-creation/dropdown` | `api\result\ExamCreationApiController@dropdownList` | api.session | RT:api.session | dropdown List |
| 128 | DELETE | `/api/result/exam-creation/bulk` | `api\result\ExamCreationApiController@bulkDestroy` | api.session | RT:api.session | bulk Destroy |
| 129 | GET | `/api/result/exam-creation` | `api\result\ExamCreationApiController@index` | api.session | RT:api.session | index |
| 130 | POST | `/api/result/exam-creation` | `api\result\ExamCreationApiController@store` | api.session | RT:api.session | store |
| 131 | GET | `/api/result/exam-creation/{id}` | `api\result\ExamCreationApiController@show` | api.session | RT:api.session | show |
| 132 | PUT | `/api/result/exam-creation/{id}` | `api\result\ExamCreationApiController@update` | api.session | RT:api.session | update |
| 133 | DELETE | `/api/result/exam-creation/{id}` | `api\result\ExamCreationApiController@destroy` | api.session | RT:api.session | destroy |
| 136 | GET | `/api/result/result-book-master/dropdown` | `api\result\ResultBookMasterApiController@dropdownList` | api.session | RT:api.session | dropdown List |
| 137 | DELETE | `/api/result/result-book-master/bulk` | `api\result\ResultBookMasterApiController@bulkDestroy` | api.session | RT:api.session | bulk Destroy |
| 138 | GET | `/api/result/result-book-master` | `api\result\ResultBookMasterApiController@index` | api.session | RT:api.session | index |
| 139 | POST | `/api/result/result-book-master` | `api\result\ResultBookMasterApiController@store` | api.session | RT:api.session | store |
| 140 | GET | `/api/result/result-book-master/{id}` | `api\result\ResultBookMasterApiController@show` | api.session | RT:api.session | show |
| 141 | PUT | `/api/result/result-book-master/{id}` | `api\result\ResultBookMasterApiController@update` | api.session | RT:api.session | update |
| 142 | DELETE | `/api/result/result-book-master/{id}` | `api\result\ResultBookMasterApiController@destroy` | api.session | RT:api.session | destroy |
| 149 | GET | `/api/result/consolidate-report` | `api\result\ConsolidateReportApiController@index` | api.session | RT:api.session | index |
| 152 | GET | `/api/result/co-scholastic-master/create` | `api\result\CoScholasticMasterApiController@create` | api.session | RT:api.session | create |
| 153 | GET | `/api/result/co-scholastic-master/dropdown` | `api\result\CoScholasticMasterApiController@dropdown` | api.session | RT:api.session | dropdown |
| 154 | DELETE | `/api/result/co-scholastic-master/bulk` | `api\result\CoScholasticMasterApiController@bulkDestroy` | api.session | RT:api.session | bulk Destroy |
| 155 | GET | `/api/result/co-scholastic-master` | `api\result\CoScholasticMasterApiController@index` | api.session | RT:api.session | index |
| 156 | POST | `/api/result/co-scholastic-master` | `api\result\CoScholasticMasterApiController@store` | api.session | RT:api.session | store |
| 157 | GET | `/api/result/co-scholastic-master/{id}` | `api\result\CoScholasticMasterApiController@show` | api.session | RT:api.session | show |
| 158 | PUT | `/api/result/co-scholastic-master/{id}` | `api\result\CoScholasticMasterApiController@update` | api.session | RT:api.session | update |
| 159 | DELETE | `/api/result/co-scholastic-master/{id}` | `api\result\CoScholasticMasterApiController@destroy` | api.session | RT:api.session | destroy |
| 162 | GET | `/api/result/co-scholastic/create` | `api\result\CoScholasticApiController@create` | api.session | RT:api.session | create |
| 163 | GET | `/api/result/co-scholastic/dropdown` | `api\result\CoScholasticApiController@dropdown` | api.session | RT:api.session | dropdown |
| 164 | DELETE | `/api/result/co-scholastic/bulk` | `api\result\CoScholasticApiController@bulkDestroy` | api.session | RT:api.session | bulk Destroy |
| 165 | GET | `/api/result/co-scholastic` | `api\result\CoScholasticApiController@index` | api.session | RT:api.session | index |
| 166 | POST | `/api/result/co-scholastic` | `api\result\CoScholasticApiController@store` | api.session | RT:api.session | store |
| 167 | GET | `/api/result/co-scholastic/{id}` | `api\result\CoScholasticApiController@show` | api.session | RT:api.session | show |
| 168 | PUT | `/api/result/co-scholastic/{id}` | `api\result\CoScholasticApiController@update` | api.session | RT:api.session | update |
| 169 | DELETE | `/api/result/co-scholastic/{id}` | `api\result\CoScholasticApiController@destroy` | api.session | RT:api.session | destroy |
| 172 | GET | `/api/result/hpc-skillset/create` | `api\result\ResultSkillsetApiController@create` | api.session | RT:api.session | create |
| 173 | GET | `/api/result/hpc-skillset/dropdown` | `api\result\ResultSkillsetApiController@dropdown` | api.session | RT:api.session | dropdown |
| 174 | DELETE | `/api/result/hpc-skillset/bulk` | `api\result\ResultSkillsetApiController@bulkDestroy` | api.session | RT:api.session | bulk Destroy |
| 175 | GET | `/api/result/hpc-skillset` | `api\result\ResultSkillsetApiController@index` | api.session | RT:api.session | index |
| 176 | POST | `/api/result/hpc-skillset` | `api\result\ResultSkillsetApiController@store` | api.session | RT:api.session | store |
| 177 | GET | `/api/result/hpc-skillset/{id}` | `api\result\ResultSkillsetApiController@show` | api.session | RT:api.session | show |
| 178 | PUT | `/api/result/hpc-skillset/{id}` | `api\result\ResultSkillsetApiController@update` | api.session | RT:api.session | update |
| 179 | DELETE | `/api/result/hpc-skillset/{id}` | `api\result\ResultSkillsetApiController@destroy` | api.session | RT:api.session | destroy |
| 182 | GET | `/api/result/hpc-activity-master/create` | `api\result\ResultActivityMasterApiController@create` | api.session | RT:api.session | create |
| 183 | GET | `/api/result/hpc-activity-master/activity-lists` | `api\result\ResultActivityMasterApiController@activityLists` | api.session | RT:api.session | activity Lists |
| 184 | DELETE | `/api/result/hpc-activity-master/sub-activity/{id}` | `api\result\ResultActivityMasterApiController@subActivityDestroy` | api.session | RT:api.session | sub Activity Destroy |
| 185 | DELETE | `/api/result/hpc-activity-master/bulk` | `api\result\ResultActivityMasterApiController@bulkDestroy` | api.session | RT:api.session | bulk Destroy |
| 186 | GET | `/api/result/hpc-activity-master` | `api\result\ResultActivityMasterApiController@index` | api.session | RT:api.session | index |
| 187 | POST | `/api/result/hpc-activity-master` | `api\result\ResultActivityMasterApiController@store` | api.session | RT:api.session | store |
| 188 | GET | `/api/result/hpc-activity-master/{id}` | `api\result\ResultActivityMasterApiController@show` | api.session | RT:api.session | show |
| 189 | PUT | `/api/result/hpc-activity-master/{id}` | `api\result\ResultActivityMasterApiController@update` | api.session | RT:api.session | update |
| 190 | DELETE | `/api/result/hpc-activity-master/{id}` | `api\result\ResultActivityMasterApiController@destroy` | api.session | RT:api.session | destroy |
| 193 | GET | `/api/result/marks-entry/create` | `api\result\MarksEntryApiController@create` | api.session | RT:api.session | create |
| 194 | POST | `/api/result/marks-entry/approve` | `api\result\MarksEntryApiController@approve` | api.session | RT:api.session | approve |
| 195 | POST | `/api/result/marks-entry/marks-approval` | `api\result\MarksEntryApiController@marksApproval` | api.session | RT:api.session | marks Approval |
| 196 | POST | `/api/result/marks-entry/marks-dd` | `api\result\MarksEntryApiController@marksDd` | api.session | RT:api.session | marks Dd |
| 197 | POST | `/api/result/marks-entry/co-scholastic-marks-dd` | `api\result\MarksEntryApiController@coScholasticMarksDd` | api.session | RT:api.session | co Scholastic Marks Dd |
| 198 | POST | `/api/result/marks-entry/get-result` | `api\result\MarksEntryApiController@getResult` | api.session | RT:api.session | get Result |
| 199 | GET | `/api/result/marks-entry` | `api\result\MarksEntryApiController@index` | api.session | RT:api.session | index |
| 200 | POST | `/api/result/marks-entry` | `api\result\MarksEntryApiController@store` | api.session | RT:api.session | store |
| 203 | GET | `/api/result/co-scholastic-marks-entry/create` | `api\result\CoScholasticMarksEntryApiController@create` | api.session | RT:api.session | create |
| 204 | POST | `/api/result/co-scholastic-marks-entry/approve` | `api\result\CoScholasticMarksEntryApiController@approve` | api.session | RT:api.session | approve |
| 205 | GET | `/api/result/co-scholastic-marks-entry` | `api\result\CoScholasticMarksEntryApiController@index` | api.session | RT:api.session | index |
| 206 | POST | `/api/result/co-scholastic-marks-entry` | `api\result\CoScholasticMarksEntryApiController@store` | api.session | RT:api.session | store |
| 209 | GET | `/api/result/hpc-activity-entry/create` | `api\result\ResultActivityMarksApiController@create` | api.session | RT:api.session | create |
| 210 | GET | `/api/result/hpc-activity-entry` | `api\result\ResultActivityMarksApiController@index` | api.session | RT:api.session | index |
| 211 | POST | `/api/result/hpc-activity-entry` | `api\result\ResultActivityMarksApiController@store` | api.session | RT:api.session | store |
| 214 | GET | `/api/result/hpc-entry-v1/create` | `api\result\ResultActivityMarksV1ApiController@create` | api.session | RT:api.session | create |
| 215 | GET | `/api/result/hpc-entry-v1` | `api\result\ResultActivityMarksV1ApiController@index` | api.session | RT:api.session | index |
| 216 | POST | `/api/result/hpc-entry-v1` | `api\result\ResultActivityMarksV1ApiController@store` | api.session | RT:api.session | store |
| 219 | GET | `/api/result/result-template/tags` | `api\result\ResultTemplateApiController@tags` | api.session | RT:api.session | tags |
| 220 | GET | `/api/result/result-template/dropdown` | `api\result\ResultTemplateApiController@dropdown` | api.session | RT:api.session | dropdown |
| 221 | DELETE | `/api/result/result-template/bulk` | `api\result\ResultTemplateApiController@bulkDestroy` | api.session | RT:api.session | bulk Destroy |
| 222 | GET | `/api/result/result-template` | `api\result\ResultTemplateApiController@index` | api.session | RT:api.session | index |
| 223 | POST | `/api/result/result-template` | `api\result\ResultTemplateApiController@store` | api.session | RT:api.session | store |
| 224 | GET | `/api/result/result-template/{id}` | `api\result\ResultTemplateApiController@show` | api.session | RT:api.session | show |
| 225 | PUT | `/api/result/result-template/{id}` | `api\result\ResultTemplateApiController@update` | api.session | RT:api.session | update |
| 226 | DELETE | `/api/result/result-template/{id}` | `api\result\ResultTemplateApiController@destroy` | api.session | RT:api.session | destroy |
| 229 | GET | `/api/result/student-result-remarks/students` | `api\result\StudentResultRemarksApiController@students` | api.session | RT:api.session | students |
| 230 | GET | `/api/result/student-result-remarks` | `api\result\StudentResultRemarksApiController@index` | api.session | RT:api.session | index |
| 231 | POST | `/api/result/student-result-remarks` | `api\result\StudentResultRemarksApiController@store` | api.session | RT:api.session | store |
| 234 | GET | `/api/result/approve-mobile-result/create` | `api\result\ApproveMobileResultApiController@create` | api.session | RT:api.session | create |
| 235 | GET | `/api/result/approve-mobile-result` | `api\result\ApproveMobileResultApiController@index` | api.session | RT:api.session | index |
| 236 | POST | `/api/result/approve-mobile-result` | `api\result\ApproveMobileResultApiController@store` | api.session | RT:api.session | store |
| 239 | GET | `/api/result/upload-result/create` | `api\result\UploadResultApiController@create` | api.session | RT:api.session | create |
| 240 | GET | `/api/result/upload-result` | `api\result\UploadResultApiController@index` | api.session | RT:api.session | index |
| 241 | POST | `/api/result/upload-result` | `api\result\UploadResultApiController@store` | api.session | RT:api.session | store |
| 244 | GET | `/api/result/all-results` | `api\result\AllResultsApiController@index` | api.session | RT:api.session | index |
| 245 | GET | `/api/result/all-results/{id}` | `api\result\AllResultsApiController@show` | api.session | RT:api.session | show |
| 248 | GET | `/api/result/personalize-marks` | `api\result\ResultLookupApiController@personalizeMarks` | api.session | RT:api.session | personalize Marks |
| 249 | GET | `/api/result/pal-marks` | `api\result\ResultLookupApiController@palMarks` | api.session | RT:api.session | pal Marks |
| 250 | GET | `/api/result/map-value` | `api\result\ResultLookupApiController@mapValue` | api.session | RT:api.session | map Value |
| 251 | GET | `/api/result/current-result` | `api\result\ResultLookupApiController@currentResult` | api.session | RT:api.session | current Result |
| 254 | GET | `/api/result/result-report` | `api\result\ResultReportApiController@index` | api.session | RT:api.session | index |
| 255 | POST | `/api/result/result-report/show` | `api\result\ResultReportApiController@show` | api.session | RT:api.session | show |
| 256 | GET | `/api/result/result-report/standardwise-subjects` | `api\result\ResultReportApiController@standardwiseSubjects` | api.session | RT:api.session | standardwise Subjects |
| 257 | GET | `/api/result/result-report/download-overall-excel` | `api\result\ResultReportApiController@downloadOverallExcel` | api.session | RT:api.session | download Overall Excel |
| 260 | GET | `/api/result/student-result/create` | `api\result\StudentResultApiController@create` | api.session | RT:api.session | create |
| 261 | POST | `/api/result/student-result/save-html` | `api\result\StudentResultApiController@saveHtml` | api.session | RT:api.session | save Html |
| 262 | GET | `/api/result/student-result` | `api\result\StudentResultApiController@index` | api.session | RT:api.session | index |
| 263 | POST | `/api/result/student-result` | `api\result\StudentResultApiController@store` | api.session | RT:api.session | store |
| 266 | GET | `/api/result/classwise-grade-report/create` | `api\result\ClasswiseGradeReportApiController@create` | api.session | RT:api.session | create |
| 267 | GET | `/api/result/classwise-grade-report/exam-create-names` | `api\result\ClasswiseGradeReportApiController@examCreateNames` | api.session | RT:api.session | exam Create Names |
| 268 | GET | `/api/result/classwise-grade-report` | `api\result\ClasswiseGradeReportApiController@index` | api.session | RT:api.session | index |
| 271 | GET | `/api/result/cbse-1t5-result` | `api\result\Cbse1t5ResultApiController@index` | api.session | RT:api.session | index |
| 272 | POST | `/api/result/cbse-1t5-result/show` | `api\result\Cbse1t5ResultApiController@show` | api.session | RT:api.session | show |
| 273 | POST | `/api/result/cbse-1t5-result/save-html` | `api\result\Cbse1t5ResultApiController@saveHtml` | api.session | RT:api.session | save Html |
| 274 | POST | `/api/result/cbse-1t5-result/pdf` | `api\result\Cbse1t5ResultApiController@pdf` | api.session | RT:api.session | pdf |
| 277 | GET | `/api/result/cbse-1t5-t2-result` | `api\result\Cbse1t5T2ResultApiController@index` | api.session | RT:api.session | index |
| 278 | POST | `/api/result/cbse-1t5-t2-result/show` | `api\result\Cbse1t5T2ResultApiController@show` | api.session | RT:api.session | show |
| 281 | GET | `/api/result/cbse-11-t2-result` | `api\result\Cbse11T2ResultApiController@index` | api.session | RT:api.session | index |
| 282 | POST | `/api/result/cbse-11-t2-result/show` | `api\result\Cbse11T2ResultApiController@show` | api.session | RT:api.session | show |
| 285 | GET | `/api/result/wrt-report` | `api\result\WrtReportApiController@index` | api.session | RT:api.session | index |
| 286 | POST | `/api/result/wrt-report/show` | `api\result\WrtReportApiController@show` | api.session | RT:api.session | show |
| 289 | GET | `/api/result/wrt-progress-report` | `api\result\WrtProgressReportApiController@index` | api.session | RT:api.session | index |
| 290 | POST | `/api/result/wrt-progress-report/show` | `api\result\WrtProgressReportApiController@show` | api.session | RT:api.session | show |
| 293 | GET | `/api/result/overall-mark-report` | `api\result\OverallMarkReportApiController@index` | api.session | RT:api.session | index |
| 294 | POST | `/api/result/overall-mark-report/show` | `api\result\OverallMarkReportApiController@show` | api.session | RT:api.session | show |
| 297 | GET | `/api/result/dropdowns/standards` | `api\result\DropdownApiController@standards` | api.session | RT:api.session | standards |
| 298 | GET | `/api/result/dropdowns/divisions` | `api\result\DropdownApiController@divisions` | api.session | RT:api.session | divisions |
| 299 | GET | `/api/result/dropdowns/subjects` | `api\result\DropdownApiController@subjects` | api.session | RT:api.session | subjects |
| 300 | GET | `/api/result/dropdowns/all-subjects` | `api\result\DropdownApiController@allSubjects` | api.session | RT:api.session | all Subjects |
| 301 | GET | `/api/result/dropdowns/exam-names` | `api\result\DropdownApiController@examNames` | api.session | RT:api.session | exam Names |
| 302 | GET | `/api/result/dropdowns/exam-masters` | `api\result\DropdownApiController@examMasters` | api.session | RT:api.session | exam Masters |
| 303 | GET | `/api/result/dropdowns/subjects-by-create-exam` | `api\result\DropdownApiController@subjectsByCreateExam` | api.session | RT:api.session | subjects By Create Exam |
| 304 | GET | `/api/result/dropdowns/exams-by-create-exam` | `api\result\DropdownApiController@examsByCreateExam` | api.session | RT:api.session | exams By Create Exam |
| 305 | GET | `/api/result/dropdowns/chapters` | `api\result\DropdownApiController@chapters` | api.session | RT:api.session | chapters |
| 306 | GET | `/api/result/dropdowns/topics` | `api\result\DropdownApiController@topics` | api.session | RT:api.session | topics |
| 307 | GET | `/api/result/dropdowns/exams` | `api\result\DropdownApiController@exams` | api.session | RT:api.session | exams |
| 308 | GET | `/api/result/dropdowns/co-scholastic-parents` | `api\result\DropdownApiController@coScholasticParents` | api.session | RT:api.session | co Scholastic Parents |
| 309 | GET | `/api/result/dropdowns/co-scholastics` | `api\result\DropdownApiController@coScholastics` | api.session | RT:api.session | co Scholastics |
| 310 | GET | `/api/result/dropdowns/activity-masters` | `api\result\DropdownApiController@activityMasters` | api.session | RT:api.session | activity Masters |

**Attendance (student)** (2)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 145 | GET | `/api/result/student-attendance-master/create` | `api\result\StudentAttendanceMasterApiController@create` | api.session | RT:api.session | create |
| 146 | POST | `/api/result/student-attendance-master` | `api\result\StudentAttendanceMasterApiController@store` | api.session | RT:api.session | store |


### easycomapi.php  (36 routes, 0 commented)
Registration: prefix `api`; api group; RouteServiceProvider.php:284-289 (file itself prefixes easy_com + api.session)

**Communication / notices / chat** (36)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 43 | GET | `/api/easy_com/sms-api` | `api\easy_com\SmsApiMasterApiController@index` | api.session | RT:api.session | index |
| 44 | POST | `/api/easy_com/sms-api` | `api\easy_com\SmsApiMasterApiController@store` | api.session | RT:api.session | store |
| 45 | GET | `/api/easy_com/sms-api/{id}` | `api\easy_com\SmsApiMasterApiController@show` | api.session | RT:api.session | show |
| 46 | PUT/PATCH | `/api/easy_com/sms-api/{id}` | `api\easy_com\SmsApiMasterApiController@update` | api.session | RT:api.session | update |
| 47 | DELETE | `/api/easy_com/sms-api/{id}` | `api\easy_com\SmsApiMasterApiController@destroy` | api.session | RT:api.session | destroy |
| 50 | GET | `/api/easy_com/smtp` | `api\easy_com\SmtpApiController@index` | api.session | RT:api.session | index |
| 51 | POST | `/api/easy_com/smtp` | `api\easy_com\SmtpApiController@store` | api.session | RT:api.session | store |
| 52 | POST | `/api/easy_com/smtp/test` | `api\easy_com\SmtpApiController@test` | api.session | RT:api.session | test |
| 53 | GET | `/api/easy_com/smtp/{id}` | `api\easy_com\SmtpApiController@show` | api.session | RT:api.session | show |
| 54 | PUT/PATCH | `/api/easy_com/smtp/{id}` | `api\easy_com\SmtpApiController@update` | api.session | RT:api.session | update |
| 55 | DELETE | `/api/easy_com/smtp/{id}` | `api\easy_com\SmtpApiController@destroy` | api.session | RT:api.session | destroy |
| 58 | GET | `/api/easy_com/whatsapp-api` | `api\easy_com\WhatsappApiConfigApiController@index` | api.session | RT:api.session | index |
| 59 | POST | `/api/easy_com/whatsapp-api` | `api\easy_com\WhatsappApiConfigApiController@store` | api.session | RT:api.session | store |
| 60 | GET | `/api/easy_com/whatsapp-api/{id}` | `api\easy_com\WhatsappApiConfigApiController@show` | api.session | RT:api.session | show |
| 61 | PUT/PATCH | `/api/easy_com/whatsapp-api/{id}` | `api\easy_com\WhatsappApiConfigApiController@update` | api.session | RT:api.session | update |
| 62 | DELETE | `/api/easy_com/whatsapp-api/{id}` | `api\easy_com\WhatsappApiConfigApiController@destroy` | api.session | RT:api.session | destroy |
| 68 | GET | `/api/easy_com/send-sms-parents/recipients` | `api\easy_com\SendSmsParentsApiController@recipients` | api.session | RT:api.session | recipients |
| 69 | POST | `/api/easy_com/send-sms-parents` | `api\easy_com\SendSmsParentsApiController@send` | api.session | RT:api.session | send |
| 71 | GET | `/api/easy_com/send-sms-staff/groups` | `api\easy_com\SendSmsStaffApiController@groups` | api.session | RT:api.session | groups |
| 72 | GET | `/api/easy_com/send-sms-staff/recipients` | `api\easy_com\SendSmsStaffApiController@recipients` | api.session | RT:api.session | recipients |
| 73 | POST | `/api/easy_com/send-sms-staff` | `api\easy_com\SendSmsStaffApiController@send` | api.session | RT:api.session | send |
| 75 | GET | `/api/easy_com/send-notification-parents/options` | `api\easy_com\SendNotificationParentsApiController@options` | api.session | RT:api.session | options |
| 76 | GET | `/api/easy_com/send-notification-parents/recipients` | `api\easy_com\SendNotificationParentsApiController@recipients` | api.session | RT:api.session | recipients |
| 77 | POST | `/api/easy_com/send-notification-parents` | `api\easy_com\SendNotificationParentsApiController@send` | api.session | RT:api.session | send |
| 79 | GET | `/api/easy_com/send-whatsapp-parents/recipients` | `api\easy_com\SendWhatsappParentsApiController@recipients` | api.session | RT:api.session | recipients |
| 80 | POST | `/api/easy_com/send-whatsapp-parents` | `api\easy_com\SendWhatsappParentsApiController@send` | api.session | RT:api.session | send |
| 82 | GET | `/api/easy_com/send-email-parents/recipients` | `api\easy_com\SendEmailParentsApiController@recipients` | api.session | RT:api.session | recipients |
| 83 | POST | `/api/easy_com/send-email-parents` | `api\easy_com\SendEmailParentsApiController@send` | api.session | RT:api.session | send |
| 89 | GET | `/api/easy_com/reports/sms/options` | `api\easy_com\SmsReportApiController@options` | api.session | RT:api.session | options |
| 90 | GET | `/api/easy_com/reports/sms` | `api\easy_com\SmsReportApiController@index` | api.session | RT:api.session | index |
| 92 | GET | `/api/easy_com/reports/email/options` | `api\easy_com\EmailReportApiController@options` | api.session | RT:api.session | options |
| 93 | GET | `/api/easy_com/reports/email` | `api\easy_com\EmailReportApiController@index` | api.session | RT:api.session | index |
| 95 | GET | `/api/easy_com/reports/notification/options` | `api\easy_com\NotificationReportApiController@options` | api.session | RT:api.session | options |
| 96 | GET | `/api/easy_com/reports/notification` | `api\easy_com\NotificationReportApiController@index` | api.session | RT:api.session | index |
| 98 | GET | `/api/easy_com/reports/register-parent` | `api\easy_com\RegisterParentReportApiController@index` | api.session | RT:api.session | index |
| 100 | GET | `/api/easy_com/reports/whatsapp` | `api\easy_com\WhatsappReportApiController@index` | api.session | RT:api.session | index |


### user.php  (24 routes, 0 commented)
Registration: prefix `(none)`; web group (session, CSRF, api.jwt); RouteServiceProvider.php:246-250

**LMS content / courses / question bank / AI** (7)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 17 | RESOURCE | `/user/add_groupwise_rights` | `user\tblgroupwise_rightsController@resource` | session,menu,logRoute,check_permissions | RT:session+check_permissions | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on tblgroupwise_rightsController |
| 25 | RESOURCE | `/user/user_profile_wise_menu_rights` | `user\tbluserProfileWiseMenuController@resource` | session,menu,logRoute,check_permissions | RT:session+check_permissions | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on tbluserProfileWiseMenuController |
| 27 | RESOURCE | `/user/user_contact_details` | `user\tbluserContactDetails@resource` | session,menu,logRoute,check_permissions | RT:session+check_permissions | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on tbluserContactDetails |
| 36 | RESOURCE | `/user/add_individual_rights` | `user\tblindividual_rightsController@resource` | session,menu,logRoute,check_permissions | RT:session+check_permissions | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on tblindividual_rightsController |
| 53 | RESOURCE | `/user/add_user_profile` | `user\tbluserprofilemasterController@resource` | session,menu,logRoute,check_permissions | RT:session+check_permissions | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on tbluserprofilemasterController |
| 55 | RESOURCE | `/user/add_user` | `user\tbluserController@resource` | session,menu,logRoute,check_permissions | RT:session+check_permissions | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on tbluserController |
| 57 | RESOURCE | `/user/user_report` | `user\userReportController@resource` | session,menu,logRoute,check_permissions | RT:session+check_permissions | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on userReportController |

**Authentication / session / bootstrap** (5)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 18 | RESOURCE | `/user/add_mobileapp_menu_rights` | `user\mobileapp_menu_rightsController@resource` | session,menu,logRoute,check_permissions | RT:session+check_permissions | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on mobileapp_menu_rightsController |
| 29 | GET | `/user/mobile_app_menu_rights` | `user\tblmobileAppMenuRightsController@create` | session,menu,logRoute,check_permissions | RT:session+check_permissions | create |
| 30 | POST | `/user/mobile_app_menu_rights/store` | `user\tblmobileAppMenuRightsController@store` | session,menu,logRoute,check_permissions | RT:session+check_permissions | store |
| 31 | POST | `/user/mobile_app_menu_rights/update` | `user\tblmobileAppMenuRightsController@store` | session,menu,logRoute,check_permissions | RT:session+check_permissions | store |
| 43 | GET | `/user/ajax_mobile_app_menu_rights` | `user\tblmobileAppMenuRightsController@displayMobileAppMenuRights` | session,menu,logRoute,check_permissions | RT:session+check_permissions | display Mobile App Menu Rights |

**HRMS / leave / staff attendance** (3)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 24 | RESOURCE | `/user/add_user_past_education` | `user\tbluserPastEducationController@resource` | session,menu,logRoute,check_permissions | RT:session+check_permissions | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on tbluserPastEducationController |
| 45 | POST | `/user/add_experience/store` | `user\tbluserController@add_experience` | session,menu,logRoute,check_permissions | RT:session+check_permissions | add experience |
| 47 | POST | `/user/experience-detail/{id}` | `user\tbluserController@experience_destroy` | session,menu,logRoute,check_permissions | RT:session+check_permissions | experience destroy |

**Teachers / staff users & rights** (9)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 32 | GET | `/user/ajax_groupwiserights` | `user\tblgroupwise_rightsController@displayGroupwiseRights` | session,menu,logRoute,check_permissions | RT:session+check_permissions | display Groupwise Rights |
| 34 | GET | `/user/ajax_pasteducation` | `user\tbluserPastEducationController@addUpdateUserPastEducation` | session,menu,logRoute,check_permissions | RT:session+check_permissions | add Update User Past Education |
| 37 | GET | `/user/ajax_profileWiseUsers` | `user\tblindividual_rightsController@profileWiseUsers` | session,menu,logRoute,check_permissions | RT:session+check_permissions | profile Wise Users |
| 39 | GET | `/user/ajax_individualrights` | `user\tblindividual_rightsController@displayIndividualRights` | session,menu,logRoute,check_permissions | RT:session+check_permissions | display Individual Rights |
| 41 | GET | `/user/ajax_user_profile_wise_rights` | `user\tbluserProfileWiseMenuController@displayUserProfileWiseRights` | session,menu,logRoute,check_permissions | RT:session+check_permissions | display User Profile Wise Rights |
| 54 | POST | `/user/ajax_userProfile_Data_Create` | `user\tblgroupwise_rightsController@ajax_userProfile_Data_Create` | session,menu,logRoute,check_permissions | RT:session+check_permissions | ajax user Profile Data Create |
| 56 | POST | `/user/show_user_report` | `user\userReportController@searchUser` | session,menu,logRoute,check_permissions | RT:session+check_permissions | search User |
| 58 | POST | `/user/user_document/{id}` | `user\tbluserController@addUserDocument` | session,menu,logRoute,check_permissions | RT:session+check_permissions | add User Document |
| 61 | POST | `/teacherListAPI` | `user\tbluserController@teacherListAPI` | - | NONE-FOUND | teacher List API |


### settings.php  (26 routes, 0 commented)
Registration: prefix `(none)`; web group; RouteServiceProvider.php:253-257

**LMS content / courses / question bank / AI** (11)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 19 | RESOURCE | `/settings/smtp_setting` | `settings\smtpController@resource` | session,menu,logRoute,check_permissions | RT:session+check_permissions | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on smtpController |
| 20 | RESOURCE | `/settings/biomatrix` | `settings\biomatrixController@resource` | session,menu,logRoute,check_permissions | RT:session+check_permissions | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on biomatrixController |
| 25 | RESOURCE | `/settings/templatemaster` | `settings\templateMasterController@resource` | session,menu,logRoute,check_permissions | RT:session+check_permissions | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on templateMasterController |
| 27 | RESOURCE | `/settings/institute_detail` | `settings\instituteDetailController@resource` | session,menu,logRoute,check_permissions | RT:session+check_permissions | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on instituteDetailController |
| 28 | RESOURCE | `/settings/manage_institute` | `settings\manageInstituteController@resource` | session,menu,logRoute,check_permissions | RT:session+check_permissions | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on manageInstituteController |
| 29 | RESOURCE | `/settings/announcements` | `settings\announcementController@resource` | session,menu,logRoute,check_permissions | RT:session+check_permissions | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on announcementController |
| 32 | RESOURCE | `/settings/master_setup` | `settings\masterSetupSelectController@resource` | session,menu,logRoute,check_permissions | RT:session+check_permissions | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on masterSetupSelectController |
| 35 | RESOURCE | `/settings/configurations` | `settings\configurationController@resource` | session,menu,logRoute,check_permissions | RT:session+check_permissions | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on configurationController |
| 41 | RESOURCE | `/settings/organization_data` | `settings\organizationDetailsController@resource` | session,menu,logRoute,check_permissions | RT:session+check_permissions | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on organizationDetailsController |
| 49 | RESOURCE | `/settings/email_template` | `communication\emailTemplateController@resource` | session,menu,logRoute,check_permissions | RT:session+check_permissions | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on emailTemplateController |
| 54 | RESOURCE | `/settings/add_fields` | `settings\tblcustomfieldsController@resource` | session,menu,logRoute | RT:session | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on tblcustomfieldsController |

**Platform / documents / settings / admin tooling** (6)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 21 | GET | `/settings/setsession` | `settings\tblcustomfieldsController@setsession` | session,menu,logRoute,check_permissions | RT:session+check_permissions | setsession |
| 22 | GET | `/settings/setinstitute` | `settings\tblcustomfieldsController@setinstitute` | session,menu,logRoute,check_permissions | RT:session+check_permissions | setinstitute |
| 33 | GET | `/settings/triz_skills` | `settings\TrizSkillsController@triz_skills` | session,menu,logRoute,check_permissions | RT:session+check_permissions | triz skills |
| 37 | GET | `/settings/getFeildLists` | `settings\configurationController@getFeildLists` | session,menu,logRoute,check_permissions | RT:session+check_permissions | get Feild Lists |
| 38 | POST | `/settings/restoreData` | `settings\configurationController@restoreData` | session,menu,logRoute,check_permissions | RT:session+check_permissions | restore Data |
| 55 | POST | `/settings/add_fields/update_sort` | `settings\tblcustomfieldsController@updateSortOrder` | session,menu,logRoute | RT:session | update Sort Order |

**Communication / notices / chat** (7)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 23 | POST | `/settings/check-email` | `settings\smtpController@CheckEmail` | session,menu,logRoute,check_permissions | RT:session+check_permissions | Check Email |
| 26 | GET | `/settings/view_all_tag` | `settings\templateMasterController@viewAllTag` | session,menu,logRoute,check_permissions | RT:session+check_permissions | view All Tag |
| 44 | GET | `/settings/email_template/import_legacy` | `communication\emailTemplateController@importLegacy` | session,menu,logRoute,check_permissions | RT:session+check_permissions | import Legacy |
| 45 | GET | `/settings/email_template/preview_legacy` | `communication\emailTemplateController@previewLegacy` | session,menu,logRoute,check_permissions | RT:session+check_permissions | preview Legacy |
| 46 | GET | `/settings/email_template/{id}/preview_pdf` | `communication\emailTemplateController@previewPdf` | session,menu,logRoute,check_permissions | RT:session+check_permissions | preview Pdf |
| 47 | POST | `/settings/email_template/preview` | `communication\emailTemplateController@preview` | session,menu,logRoute,check_permissions | RT:session+check_permissions | preview |
| 48 | POST | `/settings/email_template/send_test` | `communication\emailTemplateController@sendTest` | session,menu,logRoute,check_permissions | RT:session+check_permissions | send Test |

**Dashboards** (1)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 30 | GET | `/settings/announcement_dashboard` | `settings\announcementController@dashboardData` | session,menu,logRoute,check_permissions | RT:session+check_permissions | dashboard Data |

**Teachers / staff users & rights** (1)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 36 | POST | `/settings/update-rights-order` | `settings\configurationController@updateMenuSortOrder` | session,menu,logRoute,check_permissions | RT:session+check_permissions | update Menu Sort Order |


### ptm.php  (7 routes, 0 commented)
Registration: prefix `(none)`; web group; RouteServiceProvider.php:334-338

**LMS content / courses / question bank / AI** (2)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 9 | RESOURCE | `/ptm/add_ptm_time_slot_master` | `ptm\ptmtimeslotmasterController@resource` | session,menu,logRoute,check_permissions | RT:session+check_permissions | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on ptmtimeslotmasterController |
| 10 | RESOURCE | `/ptm/add_ptm_attened_status` | `ptm\ptmattenedstatusController@resource` | session,menu,logRoute,check_permissions | RT:session+check_permissions | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on ptmattenedstatusController |

**PTM / consent / visitor / front desk** (4)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 11 | GET | `/ptm/ptm_report` | `ptm\ptmattenedstatusController@ptmReport` | session,menu,logRoute,check_permissions | RT:session+check_permissions | ptm Report |
| 15 | POST | `/ptmBookAPI` | `ptm\ptmattenedstatusController@ptmBookAPI` | - | CTRL:token (jwtToken) | ptm Book API |
| 16 | POST | `/ptmBookingStatusAPI` | `ptm\ptmattenedstatusController@ptmBookingStatusAPI` | - | CTRL:token (jwtToken) | ptm Booking Status API |
| 17 | POST | `/ptmBookingTimeAPI` | `ptm\ptmattenedstatusController@ptmBookingTimeAPI` | - | CTRL:token (jwtToken) | ptm Booking Time API |

**Teachers / staff users & rights** (1)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 18 | POST | `/ptmTeacherListAPI` | `ptm\ptmattenedstatusController@ptmTeacherListAPI` | - | CTRL:token (jwtToken) | ptm Teacher List API |


### consent.php  (4 routes, 0 commented)
Registration: prefix `(none)`; web group; RouteServiceProvider.php:327-331

**LMS content / courses / question bank / AI** (3)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 10 | RESOURCE | `/consent/add_consent_master` | `consent\consent_masterController@resource` | session,menu,logRoute,check_permissions | RT:session+check_permissions | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on consent_masterController |
| 11 | RESOURCE | `/consent/delete_consent_master` | `consent\delete_consent_masterController@resource` | session,menu,logRoute,check_permissions | RT:session+check_permissions | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on delete_consent_masterController |
| 12 | RESOURCE | `/consent/report_consent_master` | `consent\report_consent_masterController@resource` | session,menu,logRoute,check_permissions | RT:session+check_permissions | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on report_consent_masterController |

**PTM / consent / visitor / front desk** (1)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 14 | POST | `/consentListAPI` | `consent\consent_masterController@consentListAPI` | - | CTRL:token (jwtToken) | consent List API |


### frontdesk.php  (26 routes, 0 commented)
Registration: prefix `(none)`; web group; RouteServiceProvider.php:362-366

**LMS content / courses / question bank / AI** (16)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 24 | RESOURCE | `/frontdesk/frontdesk` | `frontdesk\frontdeskController@resource` | session,menu,logRoute,check_permissions | RT:session+check_permissions | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on frontdeskController |
| 25 | RESOURCE | `/frontdesk/task` | `frontdesk\taskController@resource` | session,menu,logRoute,check_permissions | RT:session+check_permissions | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on taskController |
| 26 | RESOURCE | `/frontdesk/complaint` | `frontdesk\complaintController@resource` | session,menu,logRoute,check_permissions | RT:session+check_permissions | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on complaintController |
| 27 | RESOURCE | `/frontdesk/pettycashmaster` | `frontdesk\PettyCashMasterController@resource` | session,menu,logRoute,check_permissions | RT:session+check_permissions | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on PettyCashMasterController |
| 28 | RESOURCE | `/frontdesk/pettycash` | `frontdesk\PettyCashController@resource` | session,menu,logRoute,check_permissions | RT:session+check_permissions | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on PettyCashController |
| 35 | RESOURCE | `/frontdesk/syllabus` | `front_desk\syllabus\syllabusController@resource` | session,menu,logRoute,check_permissions | RT:session+check_permissions | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on syllabusController |
| 36 | RESOURCE | `/frontdesk/user_log` | `front_desk\user_log\user_logController@resource` | session,menu,logRoute,check_permissions | RT:session+check_permissions | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on user_logController |
| 37 | RESOURCE | `/frontdesk/book_list` | `front_desk\book_list\book_listController@resource` | session,menu,logRoute,check_permissions | RT:session+check_permissions | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on book_listController |
| 38 | RESOURCE | `/frontdesk/schooldetail` | `front_desk\school_detail\schooldetailController@resource` | session,menu,logRoute,check_permissions | RT:session+check_permissions | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on schooldetailController |
| 41 | RESOURCE | `/frontdesk/pettycashreport` | `frontdesk\PettyCashReportController@resource` | session,menu,logRoute,check_permissions | RT:session+check_permissions | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on PettyCashReportController |
| 44 | GET | `/frontdesk/generateSyllabus` | `front_desk\syllabus\syllabusController@GenrateAISyllabus` | session,menu,logRoute,check_permissions | RT:session+check_permissions | Genrate AISyllabus |
| 48 | RESOURCE | `/front_desk/timetableAI` | `front_desk\timetableController@resource` | api.session,session,menu,logRoute,check_permissions | RT:api.session+session+check_permissions | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on timetableController |
| 49 | RESOURCE | `/front_desk/timetableAIV1` | `front_desk\timetableAiController@resource` | api.session,session,menu,logRoute,check_permissions | RT:api.session+session+check_permissions | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on timetableAiController |
| 50 | RESOURCE | `/front_desk/create-timetable` | `school_setup\timetableController@resource` | api.session,session,menu,logRoute,check_permissions | RT:api.session+session+check_permissions | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on timetableController |
| 54 | RESOURCE | `/front_desk/add_cast` | `front_desk\castController@resource` | api.session,session,menu,logRoute,check_permissions | RT:api.session+session+check_permissions | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on castController |
| 55 | RESOURCE | `/front_desk/dicipline-Master` | `front_desk\dicipline\diciplineMasterController@resource` | api.session,session,menu,logRoute,check_permissions | RT:api.session+session+check_permissions | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on diciplineMasterController |

**PTM / consent / visitor / front desk** (2)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 30 | GET | `/frontdesk/frontdesk_report_index` | `frontdesk\frontdeskController@frontDeskReportIndex` | session,menu,logRoute,check_permissions | RT:session+check_permissions | front Desk Report Index |
| 33 | POST | `/frontdesk/frontdesk_report` | `frontdesk\frontdeskController@frontDeskReport` | session,menu,logRoute,check_permissions | RT:session+check_permissions | front Desk Report |

**Communication / notices / chat** (2)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 39 | GET | `/frontdesk/task_report` | `frontdesk\taskController@taskReportIndex` | session,menu,logRoute,check_permissions | RT:session+check_permissions | task Report Index |
| 40 | GET | `/frontdesk/complaint_report` | `frontdesk\complaintController@complaintReportIndex` | session,menu,logRoute,check_permissions | RT:session+check_permissions | complaint Report Index |

**Fees / petty cash / finance** (1)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 42 | POST | `/frontdesk/ajax_getpettycashreport` | `frontdesk\PettyCashReportController@getpettycashreport` | session,menu,logRoute,check_permissions | RT:session+check_permissions | getpettycashreport |

**Timetable / calendar** (3)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 51 | GET | `/front_desk/add_remove_Batch_Timetable` | `school_setup\timetableController@getBatchTimetable` | api.session,session,menu,logRoute,check_permissions | RT:api.session+session+check_permissions | get Batch Timetable |
| 52 | GET | `/front_desk/Delete_Timetable` | `school_setup\timetableController@deleteTimetable` | api.session,session,menu,logRoute,check_permissions | RT:api.session+session+check_permissions | delete Timetable |
| 53 | GET | `/front_desk/add_new_stdandardDiv` | `school_setup\timetableController@addNewStdandardDiv` | api.session,session,menu,logRoute,check_permissions | RT:api.session+session+check_permissions | add New Stdandard Div |

**HRMS / leave / staff attendance** (2)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 59 | RESOURCE | `/face_attendance/student_face_attendance` | `front_desk\studentFaceAttendanceController@resource` | session,menu,logRoute,check_permissions | RT:session+check_permissions | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on studentFaceAttendanceController |
| 60 | RESOURCE | `/face_attendance/class_face_attendance` | `front_desk\classFaceAttendanceController@resource` | session,menu,logRoute,check_permissions | RT:session+check_permissions | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on classFaceAttendanceController |


### visitor_management.php  (8 routes, 0 commented)
Registration: prefix `(none)`; web group; RouteServiceProvider.php:306-310

**LMS content / courses / question bank / AI** (1)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 7 | RESOURCE | `/visitor_management/add_visitor_master` | `visitor_management\visitor_masterController@resource` | session,menu,logRoute,check_permissions | RT:session+check_permissions | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on visitor_masterController |

**PTM / consent / visitor / front desk** (4)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 8 | GET | `/visitor_management/show_visitor_report` | `visitor_management\visitor_masterController@show_visitor_report` | session,menu,logRoute,check_permissions | RT:session+check_permissions | show visitor report |
| 10 | POST | `/visitor_management/show_visitor_report_data` | `visitor_management\visitor_masterController@show_visitor_report_data` | session,menu,logRoute,check_permissions | RT:session+check_permissions | show visitor report data |
| 18 | GET | `/visitor_management/add_visitor_master/create` | `visitor_management\visitor_masterController@create` | - | CTRL:token (jwtToken) | create |
| 23 | POST | `/visitor_management/add_visitor_master` | `visitor_management\visitor_masterController@store` | - | CTRL:session() only | store |

**Students (setup / care / registration)** (1)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 13 | GET | `/visitor_management/get_student` | `visitor_management\visitor_masterController@getStudent` | session,menu,logRoute,check_permissions | RT:session+check_permissions | get Student |

**Authentication / session / bootstrap** (2)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 14 | GET | `/visitor_management/sendOtpVisitor` | `visitor_management\visitor_masterController@sendOTPVisitor` | session,menu,logRoute,check_permissions | RT:session+check_permissions | send OTPVisitor |
| 15 | POST | `/visitor_management/confirmOtp` | `visitor_management\visitor_masterController@confirmOTP` | session,menu,logRoute,check_permissions | RT:session+check_permissions | confirm OTP |


### tranceport.php  (19 routes, 2 commented)
Registration: prefix `(none)`; web group; RouteServiceProvider.php:348-352

**LMS content / courses / question bank / AI** (12)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 20 | RESOURCE | `/transportation/add_driver` | `transportation\add_driver\add_driver_controller@resource` | session,menu,logRoute,check_permissions | RT:session+check_permissions | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on add_driver_controller |
| 21 | RESOURCE | `/transportation/add_vehicle` | `transportation\add_vehicle\add_vehicle_controller@resource` | session,menu,logRoute,check_permissions | RT:session+check_permissions | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on add_vehicle_controller |
| 22 | RESOURCE | `/transportation/add_route` | `transportation\add_route\add_route_controller@resource` | session,menu,logRoute,check_permissions | RT:session+check_permissions | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on add_route_controller |
| 23 | RESOURCE | `/transportation/add_stop` | `transportation\add_stop\add_stop_controller@resource` | session,menu,logRoute,check_permissions | RT:session+check_permissions | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on add_stop_controller |
| 24 | RESOURCE | `/transportation/map_route_bus` | `transportation\map_route_bus\map_route_bus_controller@resource` | session,menu,logRoute,check_permissions | RT:session+check_permissions | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on map_route_bus_controller |
| 25 | RESOURCE | `/transportation/map_route_stop` | `transportation\map_route_stop\map_route_stop_controller@resource` | session,menu,logRoute,check_permissions | RT:session+check_permissions | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on map_route_stop_controller |
| 26 | RESOURCE | `/transportation/map_student` | `transportation\map_student\map_student_controller@resource` | session,menu,logRoute,check_permissions | RT:session+check_permissions | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on map_student_controller |
| 27 | RESOURCE | `/transportation/send_late_sms` | `transportation\send_late_sms\send_late_sms_controller@resource` | session,menu,logRoute,check_permissions | RT:session+check_permissions | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on send_late_sms_controller |
| 28 | RESOURCE | `/transportation/van_wise_report` | `transportation\van_wise_report\van_wise_report_controller@resource` | session,menu,logRoute,check_permissions | RT:session+check_permissions | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on van_wise_report_controller |
| 29 | RESOURCE | `/transportation/transport_rate` | `transportation\transport_rate\transportRateController@resource` | session,menu,logRoute,check_permissions | RT:session+check_permissions | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on transportRateController |
| 30 | RESOURCE | `/transportation/transport_shift` | `transportation\add_shift\shiftController@resource` | session,menu,logRoute,check_permissions | RT:session+check_permissions | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on shiftController |
| 31 | RESOURCE | `/transportation/van_wise_students_detail_report` | `transportation\van_wise_students_detail\van_wise_students_detail_report_controller@resource` | session,menu,logRoute,check_permissions | RT:session+check_permissions | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on van_wise_students_detail_report_controller |

**Transport** (3)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 33 | POST | `/transportation/show_van_wise_report` | `transportation\van_wise_report\van_wise_report_controller@showVanWiseReport` | session,menu,logRoute,check_permissions | RT:session+check_permissions | show Van Wise Report |
| 36 | GET | `/api/get-bus-list` | `AJAXController@getBusList` | - | G | get Bus List |
| 37 | GET | `/api/get-stop-list` | `AJAXController@getStopList` | - | G | get Stop List |

**Students (setup / care / registration)** (4)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 38 | GET | `/map_student/fetchData` | `transportation\map_student\map_student_controller@fetchData` | - | NONE-FOUND | fetch Data |
| 39 | GET | `/ajaxCheckRemainCapacity` | `transportation\map_student\map_student_controller@ajaxChackRemainCapacity` | - | NONE-FOUND | ajax Chack Remain Capacity |
| 40 | DELETE | `/map_student/bulk-delete` | `transportation\map_student\map_student_controller@destroy` | - | NONE-FOUND | destroy |
| 42 | GET | `/transportation/transportationLists/studentLists/{t_id}/{t_s_id}` | `transportation\van_wise_students_detail\van_wise_students_detail_report_controller@retrieveDataByUserId` | - | CTRL:session() only | retrieve Data By User Id |

Commented-out routes in tranceport.php:
- L44 `Route::get('api/get-to_bus-list', 'AJAXController@getBusList');`
- L45 `Route::get('api/get-to_stop-list', 'AJAXController@getStopList');`


### driver_management.php  (1 routes, 0 commented)
Registration: prefix `-`; NOT REGISTERED anywhere; no map* method references it (grep over app, bootstrap, config, routes returned only the file itself)

**Transport** (1)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 7 | GET | `/driver/van_driver_report` | `driver_masterController@index` | (NOT REGISTERED),session,menu,logRoute,check_permissions | NOT REGISTERED | index |


### api_hostel.php  (4 routes, 0 commented)
Registration: prefix `api`; api group; RouteServiceProvider.php:155-161

**Hostel** (4)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 13 | GET | `/api/hostel-setup/{module}` | `api\HostelSetupApiController@index` | api.session | RT:api.session | index |
| 14 | POST | `/api/hostel-setup/{module}` | `api\HostelSetupApiController@store` | api.session | RT:api.session | store |
| 15 | PUT/PATCH | `/api/hostel-setup/{module}/{id}` | `api\HostelSetupApiController@update` | api.session | RT:api.session | update |
| 16 | DELETE | `/api/hostel-setup/{module}/{id}` | `api\HostelSetupApiController@destroy` | api.session | RT:api.session | destroy |


### hostel_management.php  (17 routes, 1 commented)
Registration: prefix `(none)`; web group; RouteServiceProvider.php:299-303

**LMS content / courses / question bank / AI** (11)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 19 | RESOURCE | `/hostel_management/add_hostel_type_master` | `hostel_management\hosteltypemasterController@resource` | session,menu,logRoute,check_permissions | RT:session+check_permissions | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on hosteltypemasterController |
| 21 | RESOURCE | `/hostel_management/add_room_type_master` | `hostel_management\room_type_masterController@resource` | session,menu,logRoute,check_permissions | RT:session+check_permissions | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on room_type_masterController |
| 22 | RESOURCE | `/hostel_management/add_admission_category_master` | `hostel_management\admission_category_masterController@resource` | session,menu,logRoute,check_permissions | RT:session+check_permissions | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on admission_category_masterController |
| 23 | RESOURCE | `/hostel_management/add_hostel_master` | `hostel_management\hostel_masterController@resource` | session,menu,logRoute,check_permissions | RT:session+check_permissions | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on hostel_masterController |
| 24 | RESOURCE | `/hostel_management/add_hostel_visitor_master` | `hostel_management\hostel_visitor_masterController@resource` | session,menu,logRoute,check_permissions | RT:session+check_permissions | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on hostel_visitor_masterController |
| 25 | RESOURCE | `/hostel_management/add_hostel_building_master` | `hostel_management\hostel_building_masterController@resource` | session,menu,logRoute,check_permissions | RT:session+check_permissions | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on hostel_building_masterController |
| 26 | RESOURCE | `/hostel_management/add_hostel_floor_master` | `hostel_management\hostel_floor_masterController@resource` | session,menu,logRoute,check_permissions | RT:session+check_permissions | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on hostel_floor_masterController |
| 27 | RESOURCE | `/hostel_management/add_hostel_room_master` | `hostel_management\hostel_room_masterController@resource` | session,menu,logRoute,check_permissions | RT:session+check_permissions | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on hostel_room_masterController |
| 28 | RESOURCE | `/hostel_management/show_hostel_visitor_report` | `hostel_management\hostel_visitor_reportController@resource` | session,menu,logRoute,check_permissions | RT:session+check_permissions | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on hostel_visitor_reportController |
| 29 | RESOURCE | `/hostel_management/hostel_room_allocation` | `hostel_management\tblhostelRoomAllocationController@resource` | session,menu,logRoute,check_permissions | RT:session+check_permissions | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on tblhostelRoomAllocationController |
| 30 | RESOURCE | `/hostel_management/hostel_report` | `hostel_management\hostel_reportController@resource` | session,menu,logRoute,check_permissions | RT:session+check_permissions | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on hostel_reportController |

**Hostel** (5)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 31 | GET | `/hostel_management/room_report` | `hostel_management\hostel_reportController@roomIndex` | session,menu,logRoute,check_permissions | RT:session+check_permissions | room Index |
| 32 | POST | `/hostel_management/show_room_report` | `hostel_management\hostel_reportController@roomReport` | session,menu,logRoute,check_permissions | RT:session+check_permissions | room Report |
| 34 | POST | `/hostel_management/hostelList` | `hostel_management\hostel_masterController@hostelList` | session,menu,logRoute,check_permissions | RT:session+check_permissions | hostel List |
| 35 | POST | `/hostel_management/hostelWiseRoomList` | `hostel_management\hostel_room_masterController@hostelWiseRoomList` | session,menu,logRoute,check_permissions | RT:session+check_permissions | hostel Wise Room List |
| 37 | POST | `/hostel_management/show_hostel_report` | `hostel_management\hostel_reportController@showHostelReport` | session,menu,logRoute,check_permissions | RT:session+check_permissions | show Hostel Report |

**Students (setup / care / registration)** (1)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 33 | POST | `/hostel_management/student_hostel_room_allocation` | `hostel_management\tblhostelRoomAllocationController@student_hostel_room_allocation` | session,menu,logRoute,check_permissions | RT:session+check_permissions | student hostel room allocation |

Commented-out routes in hostel_management.php:
- L20 `Route::get('listhosteltype', 'hostel_management\hosteltypemasterController@listhosteltype')->name('listhosteltype');`


### cal.php  (8 routes, 0 commented)
Registration: prefix `(none)`; web group; RouteServiceProvider.php:341-345

**LMS content / courses / question bank / AI** (2)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 9 | RESOURCE | `/calendar/calendar` | `'calendar\calendar\calendar_controller')@resource` | session,menu,logRoute,check_permissions | RT:session+check_permissions | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on calendar_controller') |
| 30 | POST | `/neo4j/assessment` | `neo4J\addAssesmentController@store` | - | NONE-FOUND | store |

**Timetable / calendar** (6)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 16 | POST | `/calendar/calendar-api-store` | `calendar\calendar\calendar_api_controller@store` | session,menu,logRoute,check_permissions | RT:session+check_permissions | store |
| 17 | GET | `/calendar/calendar-api-list` | `calendar\calendar\calendar_api_controller@index` | session,menu,logRoute,check_permissions | RT:session+check_permissions | index |
| 21 | POST | `/studentCalenderAPI` | `calendar\calendar\calendar_controller@studentCalenderAPI` | - | CTRL:token (jwtToken) | student Calender API |
| 22 | GET | `/calendar/fetchData` | `calendar\calendar\calendar_controller@fetchData` | - | NONE-FOUND | fetch Data |
| 23 | POST | `/calendar/TeacherFetchData` | `calendar\calendar\calendar_controller@TeacherFetchData` | - | CTRL:token (jwtToken) | Teacher Fetch Data |
| 24 | GET | `/calendar/searchByDate` | `calendar\calendar\calendar_controller@searchByDate` | - | CTRL:session() only | search By Date |


### documents.php  (3 routes, 0 commented)
Registration: prefix `api/documents`; api group; RouteServiceProvider.php:447-451

**Platform / documents / settings / admin tooling** (3)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 45 | GET | `/api/documents/sources` | `api\Documents\DocumentAggregationController@sources` | api.session | RT:api.session | sources |
| 48 | GET | `/api/documents/recent` | `api\Documents\DocumentAggregationController@recent` | api.session | RT:api.session | recent |
| 51 | GET | `/api/documents` | `api\Documents\DocumentAggregationController@index` | api.session | RT:api.session | index |


### inward_outward.php  (6 routes, 0 commented)
Registration: prefix `(none)`; web group; RouteServiceProvider.php:313-317

**LMS content / courses / question bank / AI** (6)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 13 | RESOURCE | `/inward_outward/add_physical_file_location` | `inward_outward\physical_file_locationController@resource` | session,menu,logRoute,check_permissions | RT:session+check_permissions | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on physical_file_locationController |
| 14 | RESOURCE | `/inward_outward/add_place_master` | `inward_outward\place_masterController@resource` | session,menu,logRoute,check_permissions | RT:session+check_permissions | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on place_masterController |
| 15 | RESOURCE | `/inward_outward/add_inward` | `inward_outward\inwardController@resource` | session,menu,logRoute,check_permissions | RT:session+check_permissions | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on inwardController |
| 16 | RESOURCE | `/inward_outward/add_outward` | `inward_outward\outwardController@resource` | session,menu,logRoute,check_permissions | RT:session+check_permissions | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on outwardController |
| 17 | RESOURCE | `/inward_outward/show_inward_report` | `inward_outward\inward_reportController@resource` | session,menu,logRoute,check_permissions | RT:session+check_permissions | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on inward_reportController |
| 18 | RESOURCE | `/inward_outward/show_outward_report` | `inward_outward\outward_reportController@resource` | session,menu,logRoute,check_permissions | RT:session+check_permissions | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on outward_reportController |


### skill.php  (9 routes, 0 commented)
Registration: prefix `(none)`; web group; RouteServiceProvider.php:409-413

**Platform / documents / settings / admin tooling** (3)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 10 | GET | `/skill/matrix` | `skill\SkillMatrixController@index` | session,menu,logRoute,check_permissions | RT:session+check_permissions | index |
| 11 | POST | `/skill/matrix/save` | `skill\SkillMatrixController@store` | session,menu,logRoute,check_permissions | RT:session+check_permissions | store |
| 13 | GET | `/skill/jobdescription` | `skill\SkillMatrixController@JobDescription` | session,menu,logRoute,check_permissions | RT:session+check_permissions | Job Description |

**HRMS / leave / staff attendance** (4)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 12 | GET | `/skill/jobrole` | `skill\SkillMatrixController@JobRole` | session,menu,logRoute,check_permissions | RT:session+check_permissions | Job Role |
| 16 | RESOURCE | `/skill/jobroleOccupation` | `lms\library\jobOccupationController@resource` | session,menu,logRoute,check_permissions | RT:session+check_permissions | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on jobOccupationController |
| 17 | RESOURCE | `/skill/jobroleSkill` | `lms\library\jobroleSkillController@resource` | session,menu,logRoute,check_permissions | RT:session+check_permissions | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on jobroleSkillController |
| 18 | RESOURCE | `/skill/jobroleTask` | `lms\library\jobroleTaskController@resource` | session,menu,logRoute,check_permissions | RT:session+check_permissions | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on jobroleTaskController |

**LMS content / courses / question bank / AI** (2)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 14 | GET | `/skill/assessment_library` | `skill\SkillMatrixController@AssessmentLibrary` | session,menu,logRoute,check_permissions | RT:session+check_permissions | Assessment Library |
| 15 | GET(view) | `/skill/gap_analysis` | `Route::view skill.assessment.gap_analysis` | session,menu,logRoute,check_permissions | RT:session+check_permissions | Route::view skill.assessment.gap analysis |


### implementation.php  (4 routes, 0 commented)
Registration: prefix `(none)`; web group; RouteServiceProvider.php:369-373

**LMS content / courses / question bank / AI** (1)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 9 | RESOURCE | `/implementation/add_implementation` | `implementation\implementation_MasterController@resource` | session,menu,logRoute,check_permissions | RT:session+check_permissions | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on implementation_MasterController |

**Platform / documents / settings / admin tooling** (3)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 13 | GET | `/conversational_ai/genkitDetailsAPI` | `settings\conversationalAIController@genkitDetailsAPI` | session | RT:session | genkit Details API |
| 14 | GET | `/conversational_ai/MockQueriesAPI` | `settings\conversationalAIController@MockQueriesAPI` | session | RT:session | Mock Queries API |
| 16 | GET | `/get-intents-list` | `settings\conversationalAIController@getIntentsList` | - | NONE-FOUND | get Intents List |


### custom_module.php  (18 routes, 0 commented)
Registration: prefix `(none)`; web group; RouteServiceProvider.php:148-153

**Platform / documents / settings / admin tooling** (16)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 7 | GET | `/custom-module/tables` | `custom_module\CustomModuleController@tables` | session,menu,logRoute | RT:session | tables |
| 8 | GET | `/custom-module/table-create/{id?}` | `custom_module\CustomModuleController@tableCreate` | session,menu,logRoute | RT:session | table Create |
| 9 | POST | `/custom-module/table-store` | `custom_module\CustomModuleController@tableStore` | session,menu,logRoute | RT:session | table Store |
| 10 | DELETE | `/custom-module/table-delete/{id}` | `custom_module\CustomModuleController@tableDelete` | session,menu,logRoute | RT:session | table Delete |
| 13 | GET | `/custom-module/table-column-create/{id}` | `custom_module\CustomModuleController@tableColumnCreate` | session,menu,logRoute | RT:session | table Column Create |
| 14 | POST | `/custom-module/table-column-store/{id}` | `custom_module\CustomModuleController@tableColumnStore` | session,menu,logRoute | RT:session | table Column Store |
| 15 | GET | `/custom-module/table-column-create/{id}/column/{colId}` | `custom_module\CustomModuleController@tableColumnCreate` | session,menu,logRoute | RT:session | table Column Create |
| 16 | DELETE | `/custom-module/table-column-delete/{id}/column/{colId}` | `custom_module\CustomModuleController@tableColumnDelete` | session,menu,logRoute | RT:session | table Column Delete |
| 19 | GET | `/custom-module/create-db-table/{id}` | `custom_module\CustomModuleController@createDBTable` | session,menu,logRoute | RT:session | create DBTable |
| 24 | GET | `/custom-module/table?id=` | `?` | session,menu,logRoute | RT:session | ? |
| 26 | GET | `/custom-module/{id}` | `custom_module\CustomModuleController@crudIndex` | session,menu,logRoute | RT:session | crud Index |
| 27 | GET | `/custom-module/create-view/{id}` | `custom_module\CustomModuleController@crudCreate` | session,menu,logRoute | RT:session | crud Create |
| 28 | GET | `/custom-module/create-view/{id}/update/{recordId}` | `custom_module\CustomModuleController@crudCreate` | session,menu,logRoute | RT:session | crud Create |
| 29 | POST | `/custom-module/create-view-store/{id}` | `custom_module\CustomModuleController@crudStore` | session,menu,logRoute | RT:session | crud Store |
| 30 | DELETE | `/custom-module/view-delete/{id}` | `custom_module\CustomModuleController@viewDelete` | session,menu,logRoute | RT:session | view Delete |
| 39 | GET | `/menuLevel2` | `custom_module\CustomModuleController@menuLevel2` | - | NONE-FOUND | menu Level2 |

**LMS content / courses / question bank / AI** (1)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 36 | RESOURCE | `/donation_collection` | `custom_module\customMapModule\donationController@resource` | session,menu,logRoute,check_permissions | RT:session+check_permissions | Laravel resource CRUD (index/create/store/show/edit/update/destroy) on donationController |

**Fees / petty cash / finance** (1)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 37 | GET | `/donation_report` | `custom_module\customMapModule\donationController@donationReport` | session,menu,logRoute,check_permissions | RT:session+check_permissions | donation Report |


### platform.php  (16 routes, 0 commented)
Registration: prefix `api/platform`; api group; RouteServiceProvider.php:431-435

**Platform / documents / settings / admin tooling** (7)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 47 | GET | `/api/platform/registry` | `api\Platform\RegistryController@index` | lms.auth | RT:lms.auth | index |
| 67 | GET | `/api/platform/scheduler` | `api\Platform\SchedulerController@index` | lms.auth | RT:lms.auth | index |
| 68 | PUT | `/api/platform/scheduler` | `api\Platform\SchedulerController@update` | lms.auth,perm:platform.scheduler,update | RT:lms.auth+perm:platform.scheduler,update | update |
| 77 | GET | `/api/platform/workflow` | `api\Platform\WorkflowController@index` | lms.auth | RT:lms.auth | index |
| 78 | POST | `/api/platform/workflow` | `api\Platform\WorkflowController@store` | lms.auth,perm:platform.workflow,create | RT:lms.auth+perm:platform.workflow,create | store |
| 80 | PUT | `/api/platform/workflow/{id}` | `api\Platform\WorkflowController@update` | lms.auth,perm:platform.workflow,update | RT:lms.auth+perm:platform.workflow,update | update |
| 83 | DELETE | `/api/platform/workflow/{id}` | `api\Platform\WorkflowController@destroy` | lms.auth,perm:platform.workflow,delete | RT:lms.auth+perm:platform.workflow,delete | destroy |

**Communication / notices / chat** (3)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 57 | GET | `/api/platform/notifications` | `api\Platform\NotificationController@index` | lms.auth | RT:lms.auth | index |
| 58 | PUT | `/api/platform/notifications` | `api\Platform\NotificationController@update` | lms.auth,perm:platform.notification,update | RT:lms.auth+perm:platform.notification,update | update |
| 60 | PUT | `/api/platform/notifications/channels` | `api\Platform\NotificationController@updateChannel` | lms.auth,perm:platform.notification,update | RT:lms.auth+perm:platform.notification,update | update Channel |

**Transport** (6)

| L | Method | URI | Controller@method | Route MW | Auth | Purpose (from method name) |
|---|---|---|---|---|---|---|
| 132 | GET | `/api/platform/events/overview` | `api\Platform\EventBusController@overview` | lms.auth,lms.staff,perm:platform.eventbus,view | RT:lms.auth+lms.staff+perm:platform.eventbus,view | overview |
| 133 | GET | `/api/platform/events/stream` | `api\Platform\EventBusController@stream` | lms.auth,lms.staff,perm:platform.eventbus,view | RT:lms.auth+lms.staff+perm:platform.eventbus,view | stream |
| 134 | GET | `/api/platform/events/failures` | `api\Platform\EventBusController@failures` | lms.auth,lms.staff,perm:platform.eventbus,view | RT:lms.auth+lms.staff+perm:platform.eventbus,view | failures |
| 135 | GET | `/api/platform/events/deliveries` | `api\Platform\EventBusController@deliveries` | lms.auth,lms.staff,perm:platform.eventbus,view | RT:lms.auth+lms.staff+perm:platform.eventbus,view | deliveries |
| 136 | GET | `/api/platform/events/audit` | `api\Platform\EventBusController@audit` | lms.auth,lms.staff,perm:platform.eventbus,view | RT:lms.auth+lms.staff+perm:platform.eventbus,view | audit |
| 137 | GET | `/api/platform/events/integrations` | `api\Platform\EventBusController@integrations` | lms.auth,lms.staff,perm:platform.eventbus,view | RT:lms.auth+lms.staff+perm:platform.eventbus,view | integrations |

