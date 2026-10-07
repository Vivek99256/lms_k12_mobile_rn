# Laravel backend (D:/next_lms_erp) - auth, authorization, mobile contract (read-only survey)

All paths relative to D:/next_lms_erp. Line numbers are from the files as read (working tree, branch student_workflow, includes uncommitted changes).

## 1. Login flows

Route mounting: routes/api.php is mounted with prefix `api` + middleware group `api` (app/Providers/RouteServiceProvider.php:238-244). Group `api` = `throttle:1000,1`, SubstituteBindings, `api.jwt` (app/Http/Kernel.php:47-52).

| Endpoint | Route def | Controller | Request | Who |
|---|---|---|---|---|
| POST /api/api-login | routes/api.php:95 (throttle:20,1) | ApiLoginController@login (app/Http/Controllers/api/ApiLoginController.php:24) | `email` required|email, `password` required, `type` nullable|string (:26-30) | Staff (tbluser) first, else student (tblstudent) by email, status='1' (:43-48, :60-90) |
| POST /api/login | routes/api.php:79 (throttle:20,1) | apiController@login (apiController.php:18) | `mobile` required|numeric (:24) | Parent/student OTP step 1: sends SMS OTP, writes tblstudent.otp |
| POST /api/check_otp | api.php:81 (throttle:10,1) | apiController@check_otp (:204) | `mobile`, `otp` numeric (:209-211) | OTP step 2; returns list of students matching mobile / mother_mobile / student_mobile |
| POST /api/teacherlogin, /api/teacher_check_otp | api.php:83-84 | apiController@teacherlogin (:127), teacher_check_otp (:489) | `mobile`, `otp` | Teacher OTP flow (tbluser by mobile, status=1 :520-522) |
| POST /api/login_hills | api.php:80 | apiController@login_hills (:941) | mobile | Hills-school variant |
| POST /admin_login, /admin_check_otp | routes/adminapi.php:25-26 | adminapiController | not read in detail | Admin OTP (not read further) |
| GET /api/testkey | api.php:88-91 | apiController@testkey (:786) | - | ONLY registered when env is local/testing; mints JWT for fixed payload |

Web login (Blade) is POST /login (routes/web.php:342) -> loginController@index; captcha is only enforced there (loginController.php:25,50-60: `captchaText` must equal env('CAPTCHA') or pass `captcha` rule). No captcha reference in ApiLoginController.php, apiController.php or routes/api.php (grep for "captcha" found only config/app.php:171,201, config/captcha.php:4, loginController.php). So api-login and OTP endpoints have NO captcha; only throttle.

### /api/api-login response (ApiLoginController.php)
Status/HTTP matrix:
| Case | HTTP | body | line |
|---|---|---|---|
| validation fail | 422 | `{status:0, message:"Parameter Missing", errors:{...}}` | :32-38 |
| bad email/password (staff or student) | 401 | `{status:0, message:"Invalid User Id And Password"}` | :54-58, :74-86 |
| no menu rights (rightsMenusIds==0) | 403 | `{status:0, message:"Please Contact Administrator For ERP Rights"}` | :160-166 |
| no active academic term today | 422 | `{status:0, message:"Academic Term Date Expired"}` | :216-222, :270-277 |
| success | 200 | `{status:1, message:"User Successfully Login", api_login_url, data:{...}, academicTerms:[], academicYears:[], student_academic:[], subjects:{}}` | :437-486 |

`status` here is an INT 0/1 (not the string '1'/'2' of legacy endpoints).
`data` keys (:442-471): id, user_name, first_name, middle_name, last_name, email, mobile, gender, birthdate, address, user_profile (name from tbluserprofilemaster), user_profile_id, profile_parent_id, sub_institute_id, mobile_syear (school_setup.syear), client_id, is_admin, join_year, image, last_login, short_code, school_name, logo, institute_type, multi_school, hrms_rights, **user_token**, host_name (env APP_URL), **erp_rights** (comma-separated tblmenumaster ids string).
Student detection: student rows are given `plain_password="student"` literal and checked later (:66, :99) - students get `is_admin=""`, `client_id=""`.
Password check: Hash::check, else legacy plaintext (staff) / md5 (students), upgraded to bcrypt on success (:632-655).
is_admin semantics from code: 1 = client-level admin (tblclient lookup, :190-196), 2 = super admin across hardcoded schools [254,195,47,72,1] (:204,:243,:261). A staff user with user id 1002 has a special rights query (:114).

### Token
- Library: generationtux/jwt-artisan ^2.0 (composer.json:14) -> firebase/php-jwt driver (vendor/generationtux/jwt-artisan/src/Drivers/FirebaseDriver.php:29-51). Algorithm env JWT_ALGO default HS256 (src/JwtToken.php:126-129); secret env JWT_SECRET (.env.example:74).
- Sent as `Authorization: Bearer <token>` (vendor/.../GetsJwtToken.php:31); fallback to request input named `token` unless JWT_HEADER_ONLY=true (:34-37, JWT_INPUT default 'token' :102).
- Payload api-login: `{id, sub_institute_id, is_admin, client_id, user_profile_id, is_student}` (ApiLoginController.php:416-423). Expiry ONLY if env JWT_TTL_MINUTES>0 -> adds iat/exp (:426-432); default 0 = never expires. .env.example has no JWT_TTL_MINUTES line (grep of .env.example showed JWT_SECRET/ALGO/LEEWAY/INPUT/HEADER only).
- No refresh endpoint and no API logout endpoint found (searched routes/api.php for logout|refresh: no hits; web /logout only flushes session, loginController.php:464-471).
- **Legacy OTP tokens have a different payload**: student `{student_id, sub_institute_id}` (apiController.php:336-340, token :343, returned as `data[i].token` :389); teacher `{teacher_id, sub_institute_id}` (:531-538). No `id`, no exp (exp commented out :337, :530). These tokens are rejected by `api.session` ("Invalid token payload", HydratesLegacyApiSession.php, `empty($userId)` check) and by RequireApiJwt. So an RN app must use /api/api-login (email+password) to get a token usable on api.session routes. OTP flow tokens only work with the legacy "validate signature only" endpoints (homescreen etc.).
- OTP specifics: hardcoded OTP "123456" for two mobile numbers (apiController.php:81-83) and DOB-derived OTP (ddmmyy) for a list of sub_institute_ids (:80,:84-85) - security smell; OTP SMS text varies per school.
- Legacy OTP response envelope: `json_encode({status:'0'|'1', message, data:[...]})` with `status` a STRING and HTTP 200 always (apiController.php:17, :137-139, returns `json_encode`).

## 2. Middleware / tenancy

Aliases (app/Http/Kernel.php:62-105): `jwt`=GenTux JwtMiddleware(:78), `api.session`=ApiSessionHydrator(:80), `api.jwt`=RequireApiJwt(:81, also in both `web` and `api` groups :44,:51), `lms.auth`=LmsApiAuth, `perm`=RequirePermission, `staff.only`=RequireStaffRole, `lms.staff`, `check_permissions`=checkPermission, `session`=SessionMiddleware, `menu`, `pal.auth`, `eso.student`, `brain.*`, `throttle.qgen`, `throttle.contentgen`.

| Middleware | Behaviour (file:line) |
|---|---|
| api.session (ApiSessionHydrator.php; logic in Concerns/HydratesLegacyApiSession.php) | Validates bearer JWT (401 `{success:false,message:"Token Auth Failed",data:null,errors:null}`), requires `id` and `sub_institute_id` in payload (else 401 "Invalid token payload"), resolves current academic term (422 `{success:false,message:"Academic Term Date Expired"}` if none; request `syear`/`term_id` override), builds in-memory session keys: user_id, sub_institute_id, syear, term_id, user_profile_id, user_profile_name ("Super Admin" when is_admin 1 or 2), profile_parent_id, client_id, is_admin, is_student, academicTerms, academicYears, institute_type, erpcode, school_name, user_name/name/email for staff, classTeacher* arrays for profile named "Teacher". Also **merges `type=API` into the request** (hydrate...:~38). Tenant/user come ONLY from token. |
| api.jwt = RequireApiJwt (config/api_guard.php) | No-op unless route path (minus `api/`) matches `protect` list (RequireApiJwt.php isProtected). When protected: needs bearer JWT or web session; if request `sub_institute_id` differs from token school -> 403 "Not valid for this school" unless is_admin=2 or is_admin=1 with same client (mayActForSchool); `staff` list -> 403 for student/parent. Error body `{success:false,message,data:null,errors:null}`. It does NOT hydrate session. |
| session (SessionMiddleware.php) | Web routes: when request input `type` is API or JSON -> same JWT hydration; else needs web session. This is how many legacy web-group routes are callable by mobile with `type=API`. |
| check_permissions (checkPermission.php:23-80) | Skips if session profile is "Super Admin"; looks up tblmenumaster by route NAME == `link`, then tblindividual_rights then tblgroupwise_rights; enforces can_view/add/edit/delete (throws AuthorizationException). |
| lms.auth (LmsApiAuth.php) | Sets request attribute `lms_auth`; unauthenticated passes through (warn-only) unless config lms_content.api_auth_enforce is true. |
| staff.only (RequireStaffRole.php) | 403 `{status_code:0,message:"You are not authorized to access this resource"}` if is_student or profile name student/parent. |
| throttle | api group 1000/min (Kernel.php:49); login 20/min; OTP verify 10/min. RateLimiter::for('api') defined RouteServiceProvider.php:476 (not read). |

config/api_guard.php: keys `enforce` (env API_GUARD_ENFORCE, default true, :26), `public` (:28-42: POST online_admission_confirm, certificate verify, `mobile/web-handoff/claims`, WhatsApp webhooks), `webform` (get-standard-list, get-division-list when type=webForm), `staff` (admin-only URL patterns), `protect` (:88-139: ~60 patterns incl. `get-*`, `lms-*`, `menu-rights`, `master-menu-rights`, `student-results/*`, `academic-terms`...). Routes with their own middleware (api.session, lms.auth) are "deliberately not listed" (:16-18). Public by omission: any api route not matching `protect` AND not behind api.session/lms.auth has NO auth enforcement at middleware level (e.g. /api/homescreen validates JWT inside the controller only).

Many legacy controllers validate the signature only and trust body tenant fields: apiController@homescreen (apiController.php:683-700 validates token, then takes sub_institute_id / user_profile_id / user_profile_name from body, :705-707). teacherapiController has stronger per-controller check resolveActingTeacherId (decodes JWT `id`, `sub_institute_id`, checks tbluser status=1 :60-100; non-admin forced to self).

Artisan "Kernel guard": app/Console/Kernel.php:178-195 logs every artisan invocation and, in bootstrap(), `exit(1)` if the full argv matches `/\b(db:seed|schema|fresh|refresh)\b/i` (:190-193). Unrelated to HTTP.

CORS: config/cors.php - paths ['*'], methods/headers ['*'], origins from env CORS_ALLOWED_ORIGINS default '*', pattern default `#^https://lms-k12-[a-z0-9-]+\.vercel\.app$#`, supports_credentials false, exposed_headers []. Native apps are not CORS-bound.

## 3. Response envelope conventions (inconsistent)

Counts across app/Http/Controllers/api (90 entries): files containing `'status_code' =>` 50, `'status' => '` (string) 71, `'status' => <int>` 65, `'success' =>` 27, `'status' => true/false` 16 (grep).

| Controller (file) | Success | Error |
|---|---|---|
| ApiLoginController | `{status:1,message,data,...}` 200 | `{status:0,message}` 401/403/422 |
| apiController (OTP/homescreen) | `json_encode {status:'1',message,data}` 200 | `{status:'0'}` or `{status:'2',message:'Token Auth Failed',data:[]}` (homescreen: HTTP 200!, apiController.php:690-694) |
| teacherapiController | `{status:'1',message,data}` | `{status:'2',...}` 401/403 (:60-91); `{status:0,message}` 400 (:883) |
| OwnProfileApiController | `{success:true,message,data}` | `{success:false,message,data:null}` 404 (:24-27) |
| MobileBootstrapApiController | `{success:true,message,data}` | (via api.session) `{success:false,message,data:null,errors:null}` |
| MobilePageBuilderApiController | `{status:'1',data}` (:53-55) | `{status:'0'|'2',message}` 503/401/404 |
| MobileDynamicPageApiController | `{status:'1',message,data}` | `{status:'0',message,data:[]}` 404/503 |
| MobileWebHandoffApiController | create(): `{status:'1',message,data:{url,expires_in}}`; claims(): `{status:1,...}` | `{status:'0'|'2',...}` 422/401/503; claims errors use int 0 |
| MobileAppMenuRightsApiController | `{status_code:1,message,data}` (:259) | `{status_code:0|2,message,errors,data:[]}` (:22-30, 401/403/422) |
| HrmsMobileApiController | `{success:true,data}` | `{success:false,message}` 422/404 |
| LeaveRequestApiController | `{status:1,message,year,data,pagination:{page,per_page,total,last_page}}` (:80-90) | `{status:0,message}` 404/422 |
| ApiQuestionBankController | `{status:true,message,data,meta:{page,per_page,total,last_page,...}}` (:455-466) | - |
| Compliance/Disciplinary/EmployeeDirectory | data + `pagination:{current_page,per_page,total,last_page}` (ComplianceLibraryController.php:98-107) | - |
| TeacherAssignmentMobileApiController | `{status:1,data}` ; uses `abort_if(...,401)` (Laravel HTML/JSON default) | |
| ComplaintApiController | `{status_code:..}` mixed (:49-77) | |
| PermissionsController | `{status_code:1,message:'SUCCESS',authenticated,...,data}` | `{status_code:0,...}` HTTP 200 when unauthenticated |

Helper `is_mobile($type,...)` (app/Helpers/Helper.php:27-45): for type API/JSON converts `status_code` to `status` (strtoupper, i.e. string) and returns JSON - the legacy Blade controllers return `status` string via this path.
=> RN client must write a tolerant normaliser: success may be `success===true`, `status` in {1,'1',true,'SUCCESS'?}, or `status_code===1`; auth failure may be `status:'2'`/`status_code:2` and sometimes HTTP 200. Pagination has three shapes: `pagination.{page|current_page,per_page,total,last_page}` or `meta.{...}`; many list endpoints return unpaginated arrays.

## 4. Roles & permissions model

Tables (database/migrations/2023_03_05_115658_*): `tbluserprofilemaster` (id, parent_id, name, description, sort_order, status, sub_institute_id, client_id + later role_key, data_scope[self/team/department/organization], is_system: app/Models/user/tbluserprofilemasterModel.php:13-24, migration 2026_08_19_175501), `tblgroupwise_rights` (menu_id, profile_id, can_view/add/edit/delete, sub_institute_id, dashboard_right, + is_mobile int default 0), `tblindividual_rights` (same plus user_id; + is_mobile), `tblmenumaster` (id, parent_menu_id, level, link=route name, sort_order, status, menu_type, quick_menu, sub_institute_id and client_id as comma lists used with FIND_IN_SET: ApiLoginController.php:104,MenuRightsController.php:54,80).
Users: staff in `tbluser` (user_profile_id, is_admin, client_id, sub_institute_id, status); students in `tblstudent` (user_profile_id). Parents have no own account: the OTP flow authenticates via student mobile fields (apiController.php check_otp :237-246); profile name "Parent" is recognised only by guards (RequireStaffRole.php BLOCKED_PROFILES; api_guard staff list).
Role naming: by profile NAME strings per tenant (no global enum): "Super Admin" (synthetic session name for is_admin 1|2), "Admin"/"admin"/"ADMIN", "School Admin", "Teacher", "Student"/"student", "Parent". Checks are case-sensitive string compares scattered (MenuRightsController.php:46,111,115; HydratesLegacyApiSession "Teacher"; ApiLoginController :299 profile named exactly 'Teacher').
Effective rights: individual rights override group rights (checkPermission.php:57-61; MobileAppMenuRightsApiController.php:81-113 same). Menu ids user may see = GROUP_CONCAT of menu ids from join of rights tables (ApiLoginController.php:99-157) returned as `erp_rights` string. POST /api/menu-rights (routes/api.php:195, MenuRightsController@getMenuRightsLevelWise) builds the sidebar tree but takes `user_id`, `user_profile_name`, `client_id`, `is_admin` from the REQUEST BODY (MenuRightsController.php:25-30), only school id is checked by api.jwt - treat as trust-the-client.
Module RBAC (newer): config/rbac_modules.php maps module name -> tblmenumaster.link; app/Services/Rbac/PermissionService; GET /api/permissions?modules=a,b behind lms.auth (routes/api.php:203, PermissionsController.php) returns per-action flags; `perm:module,action` middleware is warn-only unless config lms_content.api_auth_enforce.
File permission helpers: not found as a distinct "file permission" helper; upload endpoints rely on api.session/lms.auth only (searched app/Helpers/Helper.php, app/Http/Middleware).

## 5. Mobile-specific endpoints

Dispatch concept: mobile menu rows are DB data, not code. Tables `mobile_homescreen` (students) and `teacher_mobile_homescreen` (teachers/admins). Columns: sub_institute_id, user_profile_id, user_profile_name, main_title, menu_type ('Heading' default | 'Banner'), main_title_color_code, main_title_background_image, sub_title_of_main, sub_title_icon, sub_title_api, sub_title_api_param, main_sort_order, sub_title_sort_order, screen_name varchar(50), status ('Yes'), (create migration 2023_03_05_115658_create_mobile_homescreen_table.php:15-37) + render_type ('native'|'webview'|'native_dynamic', default 'native'), web_url (text), open_mode ('in_app'|'external') (2026_09_22_200000 migration), + page_source ('external' default, or 'custom') and custom_page_id -> mobile_pages (2026_09_24_100100 migration :31-48).
**screen_name VALUES: not found in code** (searched app/, routes/, database/, docs/ for "screen_name": only column reads/writes in apiController, teacherapiController, MobileBootstrapApiController, MobileAppMenuRightsApiController, tblmobileAppMenuRightsController, MobileAppService; no seed list). They are per-tenant DB rows; the template tenant is sub_institute_id=1 (MobileAppMenuRightsApiController.php:194-202 `defaultRightsRows` reads rows where sub_institute_id=1). To enumerate real values, query `SELECT DISTINCT screen_name,render_type,web_url FROM mobile_homescreen / teacher_mobile_homescreen` (not done: would require hitting the remote database named in .env).
Only profiles named Admin, Teacher, Student can be configured via the admin API (MobileAppMenuRightsApiController.php:19 CONFIG_PROFILES). Student rows -> mobile_homescreen; everything else -> teacher_mobile_homescreen (:144-147). No Parent menu config -> parent logins (student rows) use the Student table keyed by the student's own user_profile_id.

### GET /api/mobile/bootstrap  (routes/api.php:100, behind api.session; MobileBootstrapApiController.php, UNCOMMITTED; test tests/Feature/MobileBootstrapApiTest.php)
Request: bearer token only (query params ignored by design, test :29-35). Identity from hydrated session (:19-22). profileName = tbluserprofilemaster.name by id (:30). Table = mobile_homescreen if token `is_student` else teacher_mobile_homescreen (:35). Filters status='Yes', user_profile_id, user_profile_name=profileName, sub_institute_id; ordered main_sort_order, sub_title_sort_order (:38-48). If profile name empty or table missing -> empty menu.
Response 200:
```
{success:true, message:"Bootstrap fetched successfully.",
 data:{ user:{id, sub_institute_id, user_profile_id, user_profile_name, is_student, is_admin(int), school_name},
        menu:[ {main_title, menu_type, color, background_image,
                contents:[ {title(sub_title_of_main||main_title), icon, api, api_param, screen_name,
                            render_type('native' default), web_url(absolute or null), open_mode('in_app'|'external')} ]} ]}}
```
(:77-97). Errors: 401 from api.session (`{success:false,message,data:null,errors:null}`), 422 Academic Term Date Expired.
Caveats found: (a) lines 61-63 absolutise ANY non-empty web_url against request host, including for render_type=native_dynamic where web_url is a page_key (the legacy renderKeys() deliberately leaves page_key untouched, apiController.php:~620-640) -> bootstrap will return `https://host/<page_key>` for native_dynamic rows; the RN app must strip it or the controller needs fixing. (b) Bootstrap does not special-case Banner rows (legacy homescreen returns `api`/`api_param` at section level for menu_type 'Banner'; here Banner rows are folded into `contents`). (c) is_admin users use teacher_mobile_homescreen with their real profile name (e.g. "Admin"), not "Super Admin". (d) Sections are keyed by main_title only (:51-52), duplicates across menu_type merge.

### POST /api/homescreen (legacy, apiController.php:683) and POST /teacher_homescreen (routes/teacherapi.php:18, teacherapiController.php:195)
Request body: `sub_institute_id` numeric required, `user_profile_id` numeric required, `user_profile_name` required (validated :704-708). Auth: valid JWT signature (homescreen: invalid -> HTTP 200 `{status:'2',message:'Token Auth Failed',data:[]}`; teacher: HTTP 401 same body). Tenant/role come from the BODY (security gap; bootstrap replaces it). NOTE routes/teacherapi.php and routes/adminapi.php are mounted WITHOUT `api` prefix and WITHOUT the api middleware group (RouteServiceProvider.php:390-400), so the URL is `/teacher_homescreen`, `/admin_login`, `/student-setup/{resource}` (no /api, no throttle, no api.jwt) - unless the web server rewrites; MobileFormFieldRegistry comments call `student-setup/house` "relative to /api" so verify on the deployed host.
Response `{status:'1',message:'Success',data:[ section ]}` where Banner section = `{main_title, menu_type:'Banner', main_itle_color (typo preserved), main_title_background_image, api, api_param, screen_name, render_type, web_url, open_mode}` and Heading section = `{main_title, menu_type, main_itle_color, main_title_background_image, contents:[{sub_title, sub_title_icon, sub_title_api, sub_title_api_param, screen_name, render_type, web_url, open_mode}]}` (apiController.php:723-775). Validation failure returns HTTP 200 `{status:'1', data:[], response:{...}}` (:704-708 sets only `response`).
renderKeys (apiController.php:639-682): webview row without web_url degrades to native; relative web_url made absolute against request host; native_dynamic passes page_key through.

### POST /api/mobile/web-handoff  (routes/api.php:106, api.session; MobileWebHandoffApiController@create :47)
Request: `web_url` required|string|max:2000. Target must be same-host path or CORS-trusted origin else 422 `{status:'0',message:'The requested page is not a trusted destination.',data:[]}` (:69-80). 503 if table mobile_web_handoff_token missing. Stores sha256(ticket) + identity snapshot (user_id, sub_institute_id, user_profile_id, is_admin, client_id, is_student, syear, term_id, target_url, expires_at=now+60s) (:93-112).
Response `{status:'1',message:'Success',data:{url, expires_in:60}}` (:122-131). `url` = `route('mobile.bridge.enter',{ticket})` => GET /mobile-bridge/enter?ticket= (routes/web.php:255, MobileWebBridgeController@enter, burns ticket, regenerates session, hydrateSessionFromClaims, redirects to target_url, any failure redirects to route 'home') for same-host Blade pages; or `{scheme}://{host}/mobile-bridge?ticket=` on the trusted cross-origin Next.js frontend (:301-310).
GET /api/mobile/web-handoff/claims?ticket=... (routes/api.php:117, public per api_guard.php:32): returns `{status:1,message,redirect_path,data:{id,user_name,first_name,last_name,email,user_profile,user_profile_id,sub_institute_id,client_id,is_admin,term_id,mobile_syear,school_name,short_code,institute_type,host_name,user_token},academicTerms,academicYears}` - same shape as api-login so lms_k12's persistLoginPayload can consume it; mints a NEW api JWT (no exp) (:236-274). Errors: 422 missing ticket, 401 `{status:0,message:'This link has expired...'}` for unknown/expired/used (:149-173).
RN note: WebView of Blade page = open `data.url` (cookie session); WebView of lms_k12 page = open data.url (bridge page stores claims in localStorage then navigates to redirect_path).

### GET /api/mobile/dynamic-page/{pageKey} (routes/api.php:120, api.session; MobileDynamicPageApiController@show)
Returns `{status:'1',message:'Success',data:{page_key,title,data_endpoint,tiles:[{field_key,display_key,label,field_type,drill_endpoint}]}}` for render_type native_dynamic (tenant from session; 404 `{status:'0',message:'This page is not configured.'}`). Schema only; live data comes from `data_endpoint`.
Admin side: /api/mobile/dynamic-page-admin/{registry,pages,pages/{id},pages/{id}/fields} (api.php:125-131).

### Mobile Page Builder (routes/mobile_page_builder.php, prefix `api/mobile-page-builder` + `api` group, all `api.session`; RouteServiceProvider.php:462-467)
GET runtime/{slug} (any user; published only) -> `{status:'1',data:{page:{name,slug},...}}`; admin: GET/POST pages, GET pages/{id}, POST pages/{id}, POST pages/{id}/draft, /publish, GET /versions, DELETE pages/{id}, POST pages/{id}/assets (multipart field `file`, image, max 10240 KB: MobilePageBuilderAdminApiController.php:422), GET source-pages, source-pages/{key}, menu-pages. Used when menu rows have page_source='custom'. app/Support/MobileFormFieldRegistry.php: hand-curated map of existing ERP form pages -> field definitions + submit endpoint, keys: add_student, edit_student, attendance (list), add_house, student_quota, dicipline, student_height_weight, student_health, student_vaccination, student_infirmary (registry :46-440; the uncommitted diff adds add_house..student_infirmary, +209 lines). Each entry: type, label, matchLink (tblmenumaster.link), submit{method,endpoint,successMessage}, fields[{key,label,inputType,required,options|optionsSource}] (see :47-130). Accessors pages()/get()/keyForMenuLink() (:457-496).

### Mobile menu-rights admin API (routes/api.php:776-781, MobileAppMenuRightsApiController)
GET mobile-app-rights/bootstrap, GET {profileId}/rights, POST rights, GET/POST config, POST config/{id}. Needs `sub_institute_id` and `user_id` in the request that MUST equal the token's id/tenant (403 otherwise, :53-58). Envelope `status_code`. Permission: Admin/"Super Admin" profile or rights row on menu link `add_mobileapp_menu_rights.index` (:81-113). NOT behind api.session (manual JWT).

Other mobile-relevant: GET /api/own-profile (api.php:98, api.session). POST /api/playscreen (apiController.php:584) returns hardcoded version/maintenance JSON `{status:1,data:{android:{appVersion:"1.0.20",isUpdate,isComplusory,is_maintenance,maintenance_message,message},ios:{...}}}` (no auth). HRMS mobile: routes/api.php:134 `api.session` prefix `hrms` -> HrmsMobileApiController (check-in/out, leaves). Teacher: POST /api/teacher/assignments/standards|divisions (api.php:49, api.session). Teacher legacy API set in routes/teacherapi.php (POST, root-mounted, ~35 endpoints get_teacher*/add_teacher*). Attendance self-service GET /api/attendance/my-attendance, POST punch-in/punch-out (api.php:987-1000; middleware not declared at route level - not verified).

## 6. Uploads, CORS, throttling, versioning, push

- Multipart field names found (grep hasFile/file()): `fileToUpload` (adminapiController.php:1134, SendEmailParentsApiController.php:227), `attachment` (adminapiController.php:1585,1706), `stu_image[]`/`image[]` arrays (adminapiController.php:2697,2792), `filename` (ApiLmsCourseController.php:1003,1514), `ATTACHEMENT` (ComplaintApiController.php:91), `VISITOR_PHOTO` (FrontDeskApiController.php:117), `sheet`/`sheets[]` (ExamEvaluationApiController.php:230), `csv_file` (ImportApiController.php:38), `item_attachment`, `logo` (InventoryApiController.php:1041,1052), `file` (page-builder assets). No uniform convention; send `type=API` plus tenant fields as form fields when the route is a legacy one.
- CORS: see section 2 (browser-only, wildcard default).
- Rate limits: global 1000/min per route group `api`; login 20/min; OTP verify 10/min; throttle.qgen / throttle.contentgen on AI generators; MCP has own limiter (McpRateLimit).
- API versioning: none globally. Only `Route::prefix('v1')` for IDMS documents (routes/api.php:1009+). Mobile endpoints are unversioned.
- Push: POST /api/gcm_insert (routes/api.php:87; apiController.php:877-940). Requires valid bearer JWT (401 `{status:'2',message:'Token Auth Failed',data:[]}`), body `mobile_no` string required, `sub_institute_id` required, optional `gcm_regid`, `imei_no`, `curr_version`, `new_version`; upserts `gcm_users` keyed by (sub_institute_id, mobile_no); success `{status:1,message:'Record Added|Updated Successfully'}`, 422 `{status:0,message:'Parameter Missing',errors}`. Sender side: app/Helpers/Helper.php send_FCM_Notification2 (legacy FCM endpoint :1799) and send_FCM_Notification (service-account JSON per school :1842+). No per-user device-token model beyond gcm_users (mobile number keyed, so one token per mobile+school; a parent with several children shares it). No logout/unregister endpoint found.

## Key gotchas for the React Native app
1. Use POST /api/api-login (email+password) -> `data.user_token`; legacy OTP tokens lack `id` and fail api.session.
2. Send `Authorization: Bearer <user_token>`; no refresh and by default no expiry (unless JWT_TTL_MINUTES set) - plan for 401 -> re-login.
3. Prefer GET /api/mobile/bootstrap over /api/homescreen (tenant/role from token). Fix needed: native_dynamic web_url gets host-prefixed in bootstrap.
4. Normalise envelopes (success/status/status_code) and treat `status:'2'` as auth failure even on HTTP 200.
5. Legacy routes need `sub_institute_id`, `syear`, `user_id` etc. in body and often `type=API`; api.session sets type=API automatically.
6. adminapi.php/teacherapi.php are mounted at root, not /api - confirm deployed URL.
7. screen_name vocabulary is tenant DB data (template tenant sub_institute_id=1), not in repo.
