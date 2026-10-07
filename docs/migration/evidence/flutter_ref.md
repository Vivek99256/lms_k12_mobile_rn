# Flutter reference survey: D:/new_mobile_lms_k12 (read-only)

All paths below are relative to D:/new_mobile_lms_k12. Line numbers are file:line.
IMPORTANT CAVEAT: the docs state the Flutter client was NOT verified against a live server for most screens
(docs/api-migration-staff.md:5, docs/api-migration-student.md:3, docs/porting-notes-admin.md:3,
docs/porting-notes-teacher.md:3, docs/porting-notes-student.md:3). Endpoints come from the old GetX app
(d:/scholarclone) plus reading Laravel controllers. So "working" = ported from a previously shipped app, not re-proven.
Only docs/mobile-page-audit.md:2-4 was checked against the live DB (read-only).

## 0. README and memory are STALE vs the code
- README.md says there is a `core/route_mapper.dart`, `route_table.g.dart`, `POST /api/menu-rights`, `MobileMenuRepository.targetFor`,
  `ui/menu_page.dart`, `ui/search_page.dart`, web-handoff (README.md:7-24). NONE exist: lib/core has only api_client, auth_controller, config,
  dashboard_cache, feed, legacy_api, menu_controller, native_target, page_service, session, updater (ls lib/core). `tool/` is empty.
  grep "route_table|menu-rights|handoff|webview" over lib/ only hits comments (config.dart:9,16; native_target.dart:1; feed.dart:26).
- Actual menu source is the OLD-app home feed (see section 2), not menu-rights.
- No WebView package in pubspec.yaml:30-52; there is no WebView anywhere (native_target.dart:1-2).

## 1. Base config and auth

### Hosts
- `API_BASE_URL` default `https://dev.triz.co.in` (lib/core/config.dart:10-13); `WEB_BASE_URL` same default (config.dart:17-20).

### Login (all roles)
- `POST {base}/api/api-login`, JSON body `{email, password, type:'API'}` (lib/core/auth_controller.dart:65-69). Plain email + password.
- Success test: `data.user_token` non-empty AND `data.id|user_id` > 0, else shows `message` (auth_controller.dart:70-74; session.dart:73-75).
  (`response['data']` if a Map, otherwise the whole response: session.dart:53-55.)
- Fields read from login `data` (lib/core/session.dart:60-86): `user_token`, `id`/`user_id`, `sub_institute_id`, `client_id`,
  `user_profile_id`, `user_profile`/`user_profile_name`, `first_name`,`middle_name`,`last_name` (else `user_name`), `email`, `school_name`,
  `logo` (-> `{host_name or base}/admin_dep/images/{logo}`), `image`, `mobile_syear` (-> `syear`), `host_name`. Whole map kept as `session.raw`.
- Role = `user_profile_name` lowercased: `student` -> student screens, `teacher` -> teacher screens, anything else -> admin screens
  then teacher screens (lib/screens/screen_registry.dart:29-38; feed.dart:88; page_service.dart:76-81).
- Forgot password: `POST /forget-password` (root route, not /api) body `{user_email}`; fails if `res.success == false` (auth_controller.dart:87-98).
- Session persisted in flutter_secure_storage keys `session`,`sessionDate`,`lastActive` (auth_controller.dart:23-25). Expires at day rollover or
  30 min idle (config.dart:25; auth_controller.dart:39-44). Re-checked on app resume (auth_controller.dart:119-127).

### Token transport (two HTTP clients)
1. `ApiClient` (JSON): token as `Authorization: Bearer` AND as `token` in body/query (api_client.dart:17-19,31,46,82-86). >=400 throws ApiException(message) (api_client.dart:106-111).
2. `LegacyApi` (multipart/form-data POST, or GET with query): `Authorization: Bearer` + fields below in every request unless `withIdentity:false`
   (legacy_api.dart:18-20,32-43,53-56,64-76). Identity block sent on EVERY legacy call (legacy_api.dart:33-43):
   `token, sub_institute_id, syear (only if mobile_syear), user_id, teacher_id, admin_id, student_id (all = session.userId), user_profile_id, user_profile_name, type=API`.
   Note: student id = user id; there is no separate student id.
- Legacy envelope: `status` (or `status_code`) "1" ok, "0" error+`message`, "2" auth failure (-> 401 ApiException) (legacy_api.dart:21-22,108-112).
  `LegacyApi.ok` also accepts `success:true`, SUCCESS/TRUE, or a flat body with no status key (legacy_api.dart:119-125).
  HTTP >= 500 -> generic error (legacy_api.dart:101); 4xx JSON bodies are RETURNED not thrown (so status is hidden; docs/api-migration-staff.md:16).
- `PageService` (JSON, for Page-Builder/dashboard calls): query `type=API&sub_institute_id=&syear=` on URL; for non-GET also body `{type, sub_institute_id, syear, user_id, ...}`; bearer + `token` (page_service.dart:12-34).
  status "0"/"2" -> throws (page_service.dart:35-38).
- `callAuto(endpoint)` = POST first then GET (or reverse) on 405/404 (page_service.dart:42-55). Used for dashboards and dynamic pages.
- Admin-only helper `AdminHttp` sends PUT/DELETE with ALL params in the QUERY STRING, plus `type=API&token=` (lib/screens/admin/admin_common.dart:37-52).

## 2. Menu / home feed (decides which screens a user sees)
- Students: `POST /api/homescreen`; everyone else: `POST /teacher_homescreen` (root route). JSON body `{type:'API', sub_institute_id, user_id, user_profile_id, user_profile_name}` + token (lib/core/feed.dart:90-101). Success iff `status == '1'`, else `message` (feed.dart:102-104).
- Response `data` = list of sections: `main_title`, `main_itle_color` (sic), `main_title_background_image`, `menu_type` (Banner = single tile), `contents[]` (feed.dart:61-78).
- Each tile (`contents[]`): `sub_title`, `sub_title_icon`, `sub_title_api` (absolute URL of the screen's endpoint), `sub_title_api_param`, `screen_name`, `render_type` (`native`|`webview`|`native_dynamic`), `web_url` (feed.dart:30-38). A Banner row carries `screen_name` itself (feed.dart:68-70).
- Tile -> screen resolution (lib/screens/screen_registry.dart:41-72):
  1. ported Dart screen by `screen_name` + role (line 47)
  2. `render_type=='webview'` AND `web_url` path = `/mobile/custom/<slug>` -> Mobile Page Builder page (lines 51-54; native_target.dart:34-42). A webview row with any OTHER URL does NOT open a webview; it falls through.
  3. `render_type=='native_dynamic'` -> `DynamicPageScreen(pageKey: web_url)` (lines 55-57)
  4. tile has `sub_title_api` -> generic DataScreen: `POST item.api` (multipart+identity), renders `res.data` (lines 60-70)
  5. otherwise snackbar "enabled for you but is not available in this app yet" (lines 74-85)
- Students additionally: `GET /pending_fees` (LegacyApi, identity in query) -> `api_status=='1'`, `previous_fees`, `current_fees` (lib/ui/home_page.dart:40-46).
- Drawer: Home, My Profile, Dashboard, Share, Logout (lib/ui/home_shell.dart:187-196). "Dashboard" is the only entry point of the dashboard endpoints.
- Mobile Page Builder (reached only via step 2): `GET /api/mobile-page-builder/runtime/{slug}` -> `data.layout` (Map required) (page_service.dart:58-65);
  optional `layout.page.dataSource.endpoint` -> `svc.call(endpoint)` (native_screens.dart:110-113); button actions `type:'api'` with `endpoint`,`method` (default POST),`body` with `{{field}}` templating (native_screens.dart:138-143); select options from `optionsSource.endpoint` + `path` (ui/sdui/page_renderer.dart:360-366); search action/submitAction (page_renderer.dart:551-567, 597-623).
  Audit: only school 1 has builder pages; published ones include Mark Attendance #50, Add Student Registration #82 -> POST `student-registration` (docs/mobile-page-audit.md:4,123).
- Dynamic page: `GET /api/mobile/dynamic-page/{key}` -> `data.{title, data_endpoint, tiles[]}`; then `callAuto(data_endpoint)`; tiles read `display_key`/`field_key`/`field_type`/`label`/`drill_endpoint` (page_service.dart:68-73; native_screens.dart:282-284, 300-330). Drill = POST to `drill_endpoint`.

## 3. Role dashboards (drawer -> Dashboard)
Endpoint by role (page_service.dart:76-81), via `callAuto` (POST then GET), query `type=API&sub_institute_id=&syear=` (lib/ui/dashboard/dashboard_screen.dart:71-72):
- student: `/api/student-dashboard/summary`. Reads `enrollment{standard_name,section_name,syear}`, `summary{total_subjects,pending_homework,pending_assignments}`, `task_status[{label,value}]`, `pending_homework[{title,submission_date}]`, `pending_assignments[...]`, `recent_circulars[{title,date_}]`, `my_subjects[{subject_name}]` (dashboard_screen.dart:205-213,241-245).
- teacher: `/api/teacher-dashboard/summary`. `summary{total_classes,total_students,total_subjects,homework_to_review,assignments_to_grade}`, `my_classes[{standard_name,division_name}]`, `students_by_class[{label,students}]`, `assignments_to_grade[{title,student_submitted_date}]`, `recent_circulars`, `my_subjects` (dashboard_screen.dart:197-204,233-239).
- admin and all other profiles: `/api/admin-dashboard/summary`. `summary{total_students,total_staff,total_classes,fees_collected_today,admissions_this_year,homework_today,circulars_today,pending_parent_communications}`, `fee_collection_trend[{label,amount}]`, `students_by_class[{standard_name,students}]`, `recent_fee_receipts[{student_name,receipt_no,receiptdate,amount}]`, `upcoming_birthdays[{student_name,standard_name,division_name,dob}]` (dashboard_screen.dart:189-195,222-231,503-528).
- Offline cache: ONLY the dashboard. SharedPreferences key `dashboard_{userId}_{role}` stores `{ts,data}`, paint-from-cache then refresh, stale banner on failure; cleared on logout (lib/core/dashboard_cache.dart:10-37; dashboard_screen.dart:55-79,163-168; home_shell.dart:194). No other offline cache found (grep hive|sqflite|connectivity|offline in lib: no hits).

## 4. STUDENT native screens (screen_name -> endpoint). Registry: lib/screens/student/student_screens.dart:14-67
Convention: `Sx.url(a, fallback)` = the tile's `sub_title_api` if present, else the relative fallback shown (student_common.dart:18). All calls are LegacyApi multipart POST with the identity block unless stated. Rows are read from `res.data` (list; a map is flattened via values()).
Session-derived: `mobile_no` = `session.raw.mobile` or `raw.mobile_no`; `standard_id`, `std_name`, `division`, `term_data` from `session.raw` (student_common.dart:54; docs/porting-notes-student.md:50 notes login may not carry them).

| screen_name | endpoint | request params | response fields read | quirks |
|---|---|---|---|---|
| lms_subject / lms_pal | POST /studentSubjectAPI (lms.dart:36) | none beyond identity | `display_name`,`display_image`,`subject_id` | .svg icons skipped |
| (chapters) | POST /studentContentAPI (lms.dart:91) | `subject_id` | `data` MAP keyed by chapter -> `chapter_name`,`topicData[].name`,`topicData[].contentData[].{title,file_type,full_path}` (lms.dart:94,107,217-246) | file_type pdf/jpg/png/link else video player (lms.dart:184-197) |
| (test list/report list) | POST /studentQuestionPaperListAPI (lms.dart:152) | `subject_id` | `paper_name`,`time_allowed`,`total_ques`,`question_paper_id`|`id` (lms.dart:161-171) | |
| (quiz) | POST /studentQuestionPaperAPI (quiz.dart:70) | `question_paper_id` | `data` map whose first value is map of questions: `id`,`question_title`,`Answer[].{id,answer,correct_answer}` (quiz.dart:13-28,100-118) | HTML entities double-escaped (decodeEntities) |
| (quiz submit) | POST /studentQuestionPaperSaveAPI (quiz.dart:124-130) | `question_paper_id`, `question_list` csv, `given_ans` csv (answer ids, 0 if none), `original_ans` csv, `total_marks`='1' | status | scoring client side |
| (quiz report) | POST /studentAssessmentAPI (quiz_reports.dart:98) | `question_paper_id` | `data.attempted_data[]`: `paper_name`,`created_at`,`start_time`,`obtain_marks`,`total_right`,`total_wrong`,`online_exam_id` | |
| (quiz review) | POST /studentAssessmentDetailAPI (quiz_reports.dart:148) | `online_exam_id` | `data.online_answer_data[]`: `QUESTION_TEXT`,`ACTUAL_ANSWER`,`GIVEN_ANSWER` (quiz_reports.dart:151-157) | |
| virtual_classroom | POST /studentVirtualClassroomAPI (lists_a.dart:59) | - | `url`,`teacher_name`,`to_time`,`from_time`,`event_date`,`subject_name`,`chapter_name`,`topic_name` | |
| social_collabrative | NEW GET /api/lms/social-collaborative?mine=1&per_page=50&page=N, withIdentity:false, follows `meta.last_page` max 10 pages (lists_a.dart:106-113); thread GET /api/lms/social-collaborative/{id} -> `data.comments[].{message,created_at,author.name}` (lists_a.dart:161-165). Fallback POST /studentSocialCollabrativeAPI (lists_a.dart:118) | token only | list: `attachment_url`,`comment_count`,`title`,`description`,`created_at` | newThenLegacy fallback (student_common.dart:40-48) |
| leaderboard | NEW GET /api/lms/leaderboard withIdentity:false (lists_a.dart:230) -> `data.has_data`, `data.learner.{total_points,rank,class_size,medal}` (lists_a.dart:233-241). Fallback POST /studentLeaderBoardAPI (lists_a.dart:243) | token only | | `has_data:false` = empty |
| child_remark | POST /studentDisciplineAPI (lists_a.dart:281) | - | `message`,`discipline_date`,`discipline` | |
| exam_schedule | POST /studentExamScheduleAPI (lists_a.dart:300) | - | `title`,`file_name`,`date_` | |
| holiday_list | POST /studentCalenderAPI (lists_a.dart:319) | `action='holiday'`,`type='API'` (lists_a.dart:320) | `title`,`description`,`school_date` | |
| subjects | POST /studentTeacherListAPI (lists_a.dart:354) | - | `teacher_name`,`subject_name`,`image` | |
| home_work AND assignment | POST /studentHomeworkAssignmentAPI (lists_a.dart:374-375) | `action='Homework'` for BOTH screens (lists_a.dart:375) | `title`,`subject_name`,`date`,`description`,`file_name`,`user_image`; status 0 = empty | the `assignment` tile also sends 'Homework' (student_screens.dart:23-24) |
| notification_hub | POST /notificationHubAPI (lists_a.dart:17) | `mobile_no` | `NOTIFICATION_TYPE`,`NOTIFICATION_DESCRIPTION`,`NOTIFICATION_DATE`,`image` | silent on failure |
| student_attendance | POST /studentAttendanceAPI (calendars.dart:107) | `mobile_no` | `data.attendance_data[].{attendance_date,attendance_code}`, `data.calendar_data.holiday[].school_date` (calendars.dart:112-119) | |
| academic_calendar | POST /studentCalenderAPI (calendars.dart:191) | `mobile_no` | `school_date`,`event_type`,`title`,`description` | |
| circular_events | POST /circular/fetchData (tabbed.dart:70) twice | `action`='circular' / 'event' (tabbed.dart:64) | `date_`,`title`,`message`,`file_name` | |
| portfolio | POST /studentPortfolioAPI (tabbed.dart:85) | - | `title`,`created_at`,`description`,`file_name` | grouped by `title` |
| result_pdf | NEW POST /api/result/cbse-1t5-result/pdf (tabbed.dart:131); fallback POST /studentResultPDFAPI (tabbed.dart:137) | `term_id` (from `session.raw.term_data` else '' tabs, tabbed.dart:150-152) | `data` object or list -> `pdf_link`,`title` | 404 "No Record" = empty, no fallback (tabbed.dart:121,133) |
| time_table | POST /studentTimetableAPI (tabbed.dart:224) | - | `week_day`,`period_name`,`start_time`,`end_time`,`subject_name`,`teacher_name` | |
| wrt_progress | exam dropdown NEW GET /api/result/exam-master/dropdown?standard_id= (info.dart:165) -> `data[].{id,name}`; fallback GET /result/exam_master?standard_id= -> `Id`,`ExamTitle` (info.dart:170-173); report POST /get_wrtreportAPI (info.dart:189) | `from_date`,`to_date`,`exam_type` | `data.file_name`,`data.title` | `standard_id` from session.raw |
| classwork_gallery | GET /front_desk/send_attachment/create (info.dart:116) | query `from_date`,`to_date` (+identity) | `sentData[].{title,created_at,file_path}` (info.dart:117-128) | rows under `sentData` not `data` |
| about_us, principal_desk, school_information, achievement, school_timing, rules, facility, acadamic_activity, reach_us | POST /schoolDetailAPI (info.dart:15) | `action` = 'About Us','Principal Desk','School Information','Achievement','School Timing','Rules','Facility','Academic Activity','Reach Us' (student_screens.dart:57-66; info.dart:16) | `title`,`description` (HTML) | about_us always uses the fixed URL, others honour tile api |
| student_certificate | POST /studentCertificateAPI (info.dart:49) | - | `certificate_type`,`certificate_number`,`certificate_html` | HTML via flutter_widget_from_html |
| achievement_certificate | GET /document_details (records.dart:182-184) | `document_type='59'` | `document_title`,`file_name` | |
| leave_application | list POST /studentLeaveApplicationAPI (leave.dart:152); apply POST /front_desk/leave_application/add_leave_application (leave.dart:74) | apply: `message`,`apply_date`,`from_date`,`to_date`,`title`(reason), file field `attechment` (sic) (leave.dart:75-82) | list: `title`,`status`,`from_date`,`to_date`,`apply_date`,`message`,`reply`,`reply_on` | image picked resized 500x500 q50 (leave.dart:51) |
| parent_communication | list POST /studentParentcommunicationListAPI (communication.dart:76); send POST /add_communicationAPI (communication.dart:43) | send: `title`,`message` | `title`,`created_at`,`message`,`reply`,`reply_by`,`reply_on` | "null" string reply ignored |
| capture_photos (face attendance) | POST /get_studentCapturePhotosAPI (communication.dart:123); POST /add_studentCapturePhotosAPI (communication.dart:154) | upload files `stu_image[0..n]` | list `stu_image` | camera q80 500px (communication.dart:138) |
| fees | POST /studentFeesDetailAPI (fees.dart:39); receipt GET /ajax_PDF_FeesReceipt (fees.dart:154-159) | receipt: identity + `action='fees_collect_receipt'`,`receipt_id_html`=receipt_no | `data.PENDING[].{month,remain,PayNow}`, `data.PAID[].{paid_amount,receipt_no,receiptdate,payment_mode,bank_name,bank_branch,cheque_no,fees_html}` (fees.dart:44-46,96-123) | receipt response is a BARE quoted PDF URL string, not JSON (fees.dart:160-163) |
| photos_gallery / video_gallery | POST /studentPhotoVideoGalleryAPI (gallery.dart:25) | `action`='Photo'|'Video' | `data` map album->items: `album_title`,`file_name`,`title` (YouTube thumb from id) | |
| health_details | POST /studentHealthAPI (records.dart:117) | - | `doctor_name`,`date`,`doctor_contact`,`remarks`,`file` | |
| height_weight | POST /studentHWAPI (records.dart:26) | - | `doctor_name`,`date`,`height`,`weight` | |
| student_infirmary | POST /studentInfirmaryAPI (records.dart:41) | - | `medical_case_no`,`complaint`,`symptoms`,`disease`,`treatments`,`health_center`,... | |
| student_vaccination | POST /studentVaccinationAPI (records.dart:61) | - | `vaccination_type`,`note`,`date`,... | |
| student_consent | POST /consentListAPI (records.dart:76) | - | `title`,`consent_date`,`accountable_status`,`consent_status`,`amount` | |
| student_transport | POST /studentTransportAPI (records.dart:91) | - | `from_shift`,`from_bus`,`from_stop_name`,`to_*`,`gps_link` | |
| student_hostel | POST /studentHostelAllocationAPI (records.dart:154) | - | `hostel_name`,`room_name`,`bed_no`,`locker_no`,`warden`,... | |

## 5. TEACHER native screens. Registry: lib/screens/teacher/teacher_screens.dart:18-64
`isAdmin(args)` = any profile that is not 'teacher' (docs/porting-notes-teacher.md:50). All via LegacyApi multipart + identity. Files go through `UploadFile(field,path)` (legacy_api.dart:12-16).

Class picker (lib/screens/teacher/tk.dart; admin variant = kit/kit.dart CascadeFilter):
- Teacher: POST /get_teacher_timetablewiseStandard (tk.dart:197) -> `std_id`,`std_name`,`grade_id`; POST /get_teacher_timetablewiseDivision {standard_id} (tk.dart:252) -> `div_id`,`div_name`; POST /get_teacher_timetablewiseSubject {standard_id} (tk.dart:261) -> `sub_id`,`sub_name`.
- Admin: POST /get_adminAcademicSection (tk.dart:184; kit.dart:472) -> `id`,`short_name`|`title`; POST /get_adminStandard {grade_id} (kit.dart:496) -> `id`,`name`; POST /get_adminDivision {standard_id} (kit.dart:519) -> `id`,`name`; POST /get_adminSubject {standard_id} (kit.dart:529) -> `subject_id`,`subject_name`.
- Students: POST /allStudentListAPI (teacher, tk.dart:335) or /get_adminStudentList (admin; admin_common.dart:187,240) with `{standard_id, division_id, grade_id?}` -> `id`,`student_name`,`student_image`,`roll_no`,`enrollment_no`,`mobile`,`email`,`standard_name`,`division_name`,`dob`,`address` (tk.dart:335-342,348-372).

| screen_name | endpoint | request params | response fields | quirks |
|---|---|---|---|---|
| t_own_profile | none, session only | - | `session.raw.{first_name,last_name,image,birthdate,mobile,email,join_year,address}` (profile_screens.dart:34-47) | NO endpoint |
| t_student_profile | allStudentListAPI (see above) | | | read-only |
| t_message | POST /teacherAnnoucementAPI (simple_lists.dart:32) | `annoucement_type='SMS'` | `title`,`message`|`description`,`created_at` (response shape unknown, docs/porting-notes-teacher.md:79) | |
| t_proxy | teacher POST /get_proxy_master; admin POST /get_adminTodaysProxyListAPI (simple_lists.dart:54) | `from_date`,`to_date` (yyyy-MM-dd) | `sub_name`,`proxy_date`,`teacher_name`,`proxy_teacher_name`,`period_name`,`standard_name`,`division_name` | |
| t_virtual_classroom | POST /get_teacherVirtualClassroomAPI (simple_lists.dart:80) | - | `file_name`,`teacher_name`,`subject_name`... | |
| t_teacher_resource | POST /get_teacherResourceAPI (simple_lists.dart:122) | - | `title`,`file_name`,`subject_name`,`teacher_name` | |
| t_social_collobrative | POST /teacherSocialCollabrativeAPI (simple_lists.dart:148) | - | `ConversationData[]`,`student_name`,`image` | |
| t_notification_report | NEW GET /api/easy_com/reports/notification (simple_lists.dart:203); fallback GET /easy_com/notification_report/create (simple_lists.dart:204) | `from_date`,`to_date` | `student_name`,`standard_name`,`division_name`,`grade_name`,`notification_type`,`notification_text`,`notification_date` mapped to legacy keys (api_migration.dart:177-189) | server caps 5000 rows (docs/api-migration-staff.md:25) |
| t_calander | POST /calendar/TeacherFetchData (simple_lists.dart:281) | `standard_id` | `title`,... (keyword filtered client side) | |
| t_timetable / time_table | POST /teacherTimetableAPI (simple_lists.dart:346) | - | `week_day`,`periodname`,`lectures` | client filters by weekday |
| t_teach | subjects: teacher POST /get_teacher_timetablewiseSubject, admin POST /get_adminSubject (teach_screens.dart:43); chapters POST /get_teacherContentAPI (teach_screens.dart:74) | `standard_id`,`subject_id` | `topicData[]` | multipart (old app sent JSON, docs/porting-notes-teacher.md:59) |
| t_teacher_dairy | POST /add_teacherLessonPlanning (attendance_screens.dart:168) | `standard_id`,`division_id`,`subject_id`,`date`,`title` | status | |
| t_take_attendance / take_attendance | students list then POST /student/save_student_attendance (attendance_screens.dart:50-54) | `standard_division`="<std>\|\|<div>", `date`, `student[<studentId>]`='P'|'A'|'' | status | no /api equivalent (docs/api-migration-staff.md:43) |
| t_homework (teacher) | list POST /teacherHomeworkAssignmentAPI (homework_screens.dart:25); create POST /student/student_homework (homework_screens.dart:94-103) | list `action='Homework'`,`from_date`,`to_date`; create `title`,`description`,`submission_date`,`standard_id`,`division_id`,`subject_id`,`students[i]`; file field `image` (homework_screens.dart:104-105) | `student_name`,`file_name`... | |
| t_homework (admin) | POST /student/student_homework (admin/homework.dart:41-51) | same + `students[]` as ONE comma-joined field; file field `image` (required) | | |
| t_circular (teacher) | list POST /circular/TeacherFetchData (homework_screens.dart:190) `{standard_id}`; create POST /add_adminCircularAPI (homework_screens.dart:237) | create `title`,`message`,`type`,`date_`,`standard_id`,`division_id`,`action='API'`; file `attachment[0]` (homework_screens.dart:238-246) | `std_name`,`title`,`file_name`,`date_` | teacher uses the ADMIN add endpoint |
| t_circular (admin) | POST /add_adminCircularAPI (admin/circular.dart:39-48) | `title`,`message`,`type`,`date_`,`standard_id`,`division_id`; file `attachment[0]` | | |
| t_exam_schedule | list POST /get_teacherExamSchedule (homework_screens.dart:293); add POST /add_teacherExamSchedule (homework_screens.dart:341-343) | `title`,`date`,`standard_id`,`division_id`; file `attachment` | `title`,`date_`,`file_name` | |
| t_parent_comm / reply_parent_communication | teacher POST /teacherParentcommunicationListAPI + /teacherParentcommunicationSaveAPI; admin POST /get_adminParentCommunicationListAPI + /add_adminParentCommunicationSaveAPI (comm_screens.dart:30,35) | reply: `parent_comm_id`,`reply`,`reply_on`(DateTime.toString) | `parent_comm_id`,... | |
| t_approve_leave (teacher) | list POST /teacherLeaveApplicationListAPI; save POST /teacherLeaveApplicationSaveAPI (comm_screens.dart:134,139) | save `leave_app_id`,`reply`,`status` | `leave_app_id` | |
| t_approve_leave (admin) | list POST /get_adminLeaveApplicationListAPI; save POST /add_adminLeaveApplicationSaveAPI (admin/approve_leave.dart:23,66-70) | `leave_app_id`,`reply`,`status` ('Approved'/'Reject') | | |
| t_disclipline | NEW POST /student-care/discipline (comm_screens.dart:279; admin/discipline.dart:73) `student_id`,`dicipline`(sic),`message`,`date_`; fallback POST /add_teacherStudentDisciplineAPI `data`=json{student_id,dicipline,message} (comm_screens.dart:285) | | | write fallback rule docs/api-migration-staff.md:14 |
| t_sms_parent | NEW POST /api/easy_com/send-sms-parents (api_migration.dart:153-154) `grade`(section id),`standard`,`division`,`smsText`,`sendsms[<mobile>]='on'`; fallback POST /teacherSendSmsParentsAPI `sms_text`,`mobile_number[<studentId>]=<mobile>` (comm_screens.dart:382-384) | | | admin legacy: /add_adminSendSmsAPI (admin/send_message.dart:56) |
| t_notification_parent | NEW POST /api/easy_com/send-notification-parents `notificationText`,`sendNotification[<mobile>]='on'` (api_migration.dart:160-161); fallback POST /add_SendNotificationAPI `student_id` csv,`description` (comm_screens.dart:387-389) | | | |
| t_email_parent | NEW POST /api/easy_com/send-email-parents `subject`,`content`,`all_email` csv + class ids (api_migration.dart:163-164); fallback POST /teacherSendEmailParentsAPI `all_email`,`example-subject`,`content` (comm_screens.dart:394-397); admin /add_adminSendEmailAPI | | | |
| t_marks | terms NEW GET /api/academic-terms (marks_screens.dart:43) else GET /lms_data?table=academic_year&filters[sub_institute_id]&filters[syear] (marks_screens.dart:48-52); exams POST /get_teacherResultExamList `standard_id`,`term_id`,`grade_id`,`subject_id` (marks_screens.dart:77-78); save POST /result/marks_entry `data`=json{studentId:{exam_id,points,per,grade,comment}} (marks_screens.dart:168-187) | | exam rows `id`,`title`,`points` (max) | |
| t_photo_gallary / t_video_gallary / gallary | teacher POST /photo_video_gallary/TeacherFetchData `standard_id`,`type`; admin POST /get_adminPhotoVideoAPI (gallery_screens.dart:68-69); add POST /add_adminPhotoVideoAPI (gallery_screens.dart:372-384) | add: `standard_id`,`division_id`,`date_`,`album_title`,`title`,`type`('Photo'|'Video'),`youtube_link`; photo files `attachment[i]` | `data` map album->items or flat list | videos are link-only, no video upload |
| t_wrt_progress | exam GET /result/exam_master?standard_id (wrt_progress.dart:37) -> `Id`,`ExamTitle`; POST /get_wrtreportAPI `student_id`,`from_date`,`to_date`,`exam_type?` (wrt_progress.dart:67-72) | | `data.file_name` | |
| t_requisition | list teacher POST /get_teacherRequisitionAPI, admin POST /get_adminAllRequisitionAPI (office_screens.dart:44); items POST /get_adminItemListAPI (office_screens.dart:106) -> `id`,`title`; add POST /add_teacherRequisitionAPI (office_screens.dart:127-136) | `created_ip_address`(REQUIRED),`requisition_by`,`created_by`,`item_id`,`item_unit`,`item_qty`,`expected_delivery_time`,`remarks` | `item_name`,`requisition_status` | omitting `created_ip_address` fails validation (docs/porting-notes-teacher.md:90) |
| t_task | list teacher POST /get_teachertaskAPI, admin POST /get_taskAPI (office_screens.dart:177); add /add_teachertaskAPI or /add_taskAPI (office_screens.dart:289) | `title`,`description`,`date`,`allocated_to`; file `attachment` (office_screens.dart:299-304) | `TASK_TITLE`,`STATUS`,`TASK_ATTACHMENT` | |
| t_complain | list /get_teachercomplaintAPI or /get_complaintAPI (office_screens.dart:218); add /add_teachercomplaintAPI or /add_complaintAPI (office_screens.dart:289) | same as task | `TITLE`,`COMPLAINT_SOLUTION`,`COMPLAINT_ATTACHMENT` | |
| t_visitor | list teacher POST /get_visitorAPI, admin POST /get_adminVisitorListAPI (office_screens.dart:336) `from_date`,`to_date`; types POST /get_visitorTypeAPI (office_screens.dart:20); add POST /add_visitorAPI (office_screens.dart:417-428) | `appointment_type`,`visitor_type`,`name`,`contact`,`email`,`coming_from`,`to_meet`,`relation`,`purpose`,`visitor_idcard`,`meet_date`,`in_time`; photo field `file_name` | `name`,`visitor_photo` | |
| t_punch_inout / punch_in_out | status GET /hrms-inout-time (hrms_screens.dart:85) -> top-level `hrms_attendance{punchin_time,punchout_time,timestamp_diff}`,`button`('out'|in),`button_disable`; punch POST /hrms-in-time/store or /hrms-out-time/store (hrms_screens.dart:132-135) | in `punchin_time`,`address_in`; out `punchout_time`,`address_out`; photo `photo_in`/`photo_out`; time 'yyyy-MM-dd HH:mm:ss'; address = "lat, lng" | | needs GPS + front camera (hrms_screens.dart:94-122) |
| t_my_attendance | GET /lms_data?table=hrms_attendances (hrms_screens.dart:23-30,288) | `filters[user_id]`,`filters[sub_institute_id]`,`filters[day]`='MMM-yyyy',`order_by[column]`,`order_by[direction]=desc` | `day`,`punchin_time`,`punchout_time` | generic table API, unauthenticated per docs/porting-notes-teacher.md:87 |
| t_my_leave | balance NEW GET /api/hrms/leaves (hrms_screens.dart:337) `data.summary{total,used,remaining}`,`data.leave_types[{leave_type,total,used}]`, fallback GET /hrms/myleave/{userId} (hrms_screens.dart:338; returns SAMPLE numbers, docs/api-migration-staff.md:27,58); types GET /lms_data?table=hrms_leave_types (hrms_screens.dart:447,537) -> `id`,`leave_type`; apply NEW POST /api/leave/requests (hrms_screens.dart:479-486) `leave_type_id`,`day_type`,`from_date`,`to_date`|`slot`,`comment`; fallback POST /leave-apply `type_leave='Self'`,`leave_type`,... (hrms_screens.dart:487-494); history GET /api/leave/requests?employee_id (api_migration.dart:222) fallback lms_data hrms_emp_leaves (hrms_screens.dart:573) | | | |
| t_capture_photos | POST /get_studentCapturePhotosAPI `student_id`; POST /add_studentCapturePhotosAPI `student_id` + `stu_image[i]` (admin/student_attendance_photos.dart:44,65-67) | | `stu_image` | |
| t_capture_attendance | POST /add_studentCaptureAttendanceAPI `date`,`standard_id`,`division_id`, files `image[i]` (admin/capture_attendance.dart:52-54); POST /get_attendanceDataAPI `json_data` (line 68); save POST /student/save_student_attendance (line 98-103) `teacher_id`,`standard_division`,`date`,`student[<id>]` | | assumed shape, unverified (docs/porting-notes-admin.md:228) | |

## 6. ADMIN-only native screens. Registry: lib/screens/admin/admin_screens.dart:17-37
(Admin also reuses teacher screens above that branch on role.) Calls below not already listed:
| screen_name | endpoint | params / fields | quirks |
|---|---|---|---|
| t_teacher_profile | POST /get_adminTeacherList (admin/profiles.dart:83) | rows `image`,`user_profile_name`,`mobile`,`birthdate`,`email`, name fields | client-side search |
| t_student_profile | POST /allStudentListAPI via StudentPicker (admin/profiles.dart:177) | cascade params `grade_id`,`standard_id`,`division_id` (admin_common.dart:240-244) | |
| t_enquiry | list NEW GET /api/admission_enquiry (admission_list.dart:22,54), fallback GET /admission/admission_enquiry (admission_list.dart:16,56); create NEW POST /api/admission_enquiry (admission_form.dart:194-203) fallback legacy POST; edit PUT /api/admission_enquiry/{rowId} (admission_form.dart:170) fallback PUT /admission/admission_enquiry/{enquiry_no} (line 165) | body: `first_name`,`middle_name`,`last_name`,`mobile`,`email`,`date_of_birth`,`address`,`previous_school_name`,`followup_date`,`remarks`,`source_of_enquiry`,`send_sms`,`age`,`previous_standard`,`category`,`admission_standard`,`gender`,`enquiry_no`(client-computed max+1),`created_by`,`created_on` (admission_form.dart:121-135,194-203) | PUT params in QUERY STRING (AdminHttp). Legacy create uses key `Gender` and inverted send_sms ids (docs/porting-notes-admin.md:230) |
| t_registration / t_confirmation | list NEW GET /api/admission_registration (admission_list.dart:23); fallback GET /admission/admission_registration or /admission_confirmation (admission_list.dart:17-18); edit PUT /api/admission_registration/{rowId} (admission_form.dart:160) | confirmation is read-only | |
| t_feescollect | students via StudentPicker (needDivision) then POST /studentFeesDetailAPI?syear&sub_institute_id&student_id in URL, no identity (admin/fee_details.dart:58-67) -> `data.{STU_DATA,PENDING,PAID}`; pay POST /fees/get_online_receipt?syear,sub_institute_id,student_id,amount,bank_name,transactionid,fine=0,token(STU_DATA.token else admin token) (fee_details.dart:100-116) -> `receipt_html` (top or data) | `PENDING[].{month|month_this,remain}`, `PAID[].{receipt_no,receiptdate,payment_mode,bank_name,paid_amount,fees_html}` | all params in query string, empty body |
| t_leave_authorisation | list POST /show-leave-authorisation `from_date`,`to_date`,`leave_status='pending'` -> rows under `get_employee_leave_lists` (admin/leave_requests.dart:31-37), (NEW GET /api/leave/requests?status=pending first, api_migration.dart:222; docs/api-migration-staff.md:30); decide POST /leave-authorisation-store `id`,`hod_comment`,`hr_remarks`,`single_leave_status` lowercased (leave_requests.dart:116-121) | | decision stays legacy |
| t_inward / t_outward | list GET /inward_outward/add_inward or /add_outward (inward_outward.dart:17,37); lookups GET /inward_outward/add_place_master, /add_physical_file_location -> `id`,`title` (inward_outward_form.dart:61-67); create POST same path `place_id`,`file_location_id`,`outward_number`,`title`,`description`,`acedemic_year`(sic),`outward_date` + file `attachment` (inward_outward_form.dart:112-126); edit PUT {path}/{id} query-string (line 99-109); delete DELETE {path}/{id} (inward_outward.dart:51) | | edit cannot replace attachment |
| t_circular / t_homework / t_sms_parent / ... | see section 5 | | |

## 7. Files and uploads (field names)
Multipart via `http.MultipartFile.fromPath(field, path)` (legacy_api.dart:72-74); missing files silently skipped (legacy_api.dart:73).
- Student leave `attechment`; student face photos `stu_image[i]`
- Admin/teacher homework `image`; circular `attachment[0]`; exam schedule `attachment`; gallery `attachment[i]`; task/complaint `attachment`; visitor `file_name`; inward/outward `attachment`; capture attendance `image[i]`; punch `photo_in`/`photo_out`
- image_picker (q50/500px leave, q80 photos, camera front for punch); file_picker for docs (kit.dart:378-391 FileField allowed jpg,jpeg,png,pdf).

## 8. Push notifications / FCM
not found, searched in pubspec.yaml (no firebase_messaging/firebase_core), lib/ (grep firebase|fcm|messaging), android/app (no google-services.json), ios (no GoogleService-Info.plist). README.md:30-31 says "Not included yet: ... push notifications"; docs/porting-notes-student.md:42 says "FCM registration: not part of this task". No device-token registration endpoint is called anywhere. The only notification-like feature is the pull-based `notificationHubAPI` (student) and the legacy sender endpoints.

## 9. Code push
Shorebird (core/updater.dart:9-36) - not an API; checks for patches at HomeShell init (home_shell.dart:36).

## 10. Flutter screens with no real backend endpoint / unresolved
- t_own_profile (teacher/admin): session data only (profile_screens.dart:34-47).
- t_message: endpoint exists but response shape unknown (docs/porting-notes-teacher.md:79).
- Capture attendance step 2 contract unresolved (`get_attendanceDataAPI` json_data) (docs/porting-notes-admin.md:228).
- Admission confirmation create/edit not ported (docs/porting-notes-admin.md:220).
- Admission enquiry page-builder page #52 is a single image with no form (docs/mobile-page-audit.md:141); #16 has no action (line 140).
- Notification bell badge, student profile screen/tab data beyond session.raw, login OTP, Google sign-in: not ported (README.md:30; docs/porting-notes-student.md:42-44).
- Student `assignment` tile reuses homework endpoint with action 'Homework' (lists_a.dart:375).

## 11. Endpoint inventory by style (for RN reuse)
JWT/`/api/*` (token-only identity, safest): /api/api-login, /api/homescreen, /api/{student,teacher,admin}-dashboard/summary, /api/mobile-page-builder/runtime/{slug}, /api/mobile/dynamic-page/{key}, /api/lms/leaderboard, /api/lms/social-collaborative[/{id}], /api/result/cbse-1t5-result/pdf, /api/result/exam-master/dropdown, /api/academic-terms, /api/hrms/leaves, /api/leave/requests, /api/easy_com/{send-sms-parents,send-notification-parents,send-email-parents,reports/notification}, /api/admission_enquiry, /api/admission_registration, /student-care/discipline.
Legacy form-data (need body identity: student_id/teacher_id/user_id/sub_institute_id/syear/token/type=API): everything else in sections 4-6.
Root (non /api) routes: /teacher_homescreen, /forget-password, /pending_fees, /lms_data, /hrms-*, /leave-*, /admission/*, /inward_outward/*, /student/*, /circular/*, /front_desk/*, /fees/*, /ajax_PDF_FeesReceipt.
Known server quirks recorded by the Flutter authors: `api.session` returns 422 "Academic Term Date Expired" when no academic_year covers today and 401 for old-app tokens (docs/api-migration-student.md:43); legacy web-group routes can 419 (CSRF) on non-allowlisted hosts (docs/api-migration-staff.md:53).
