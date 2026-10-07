# Backend ask — Learn content endpoint (`studentContentAPI`) needs review and a fix (S8b)

Written 2026-10-07 for the Laravel/backend owners. This is a request, not a change: **no Laravel file was modified by the mobile migration.** Until the endpoint is reviewed and fixed, the mobile **Learn** tile shows "This isn't available in the app yet." / "Please ask your school." and the app **never calls `studentContentAPI`**, has **no legacy fallback**, and does **not** try to work around the query-construction problem on the client (decision S8 / Q39 option B, Q40).
Evidence cites `D:/next_lms_erp` (read-only). **[VERIFIED-NO-DB]** = established by reading code. **[VERIFIED-LOCAL]** = observed once on 2026-10-07 on a local `php artisan serve` with a locally signed token for a non-existent student (`999999999`, tenant `1`): `subject_id=1` answered `{"status":0,"message":"No Data Found"}` and a missing subject answered `Parameter Missing`; no real row was returned and no conclusion about real data is drawn.

## The endpoint
- `POST studentContentAPI`, `routes/lms.php:360`, `App\Http\Controllers\lms\lms_apiController::studentContentAPI`, `app/Http/Controllers/lms/lms_apiController.php:359-482` (an earlier copy at `:272-` is commented out). It is the endpoint behind the student **Learn** flow (subject → chapters → topics → content) of the Flutter app (ev:flutter_ref.md: `lms.dart:91`).
- Companion: `studentSubjectAPI` (`:175-268`), which supplies the subject ids.

## Problems found
### 1. SQL is built from request values
- `topic_master` is read with `"... WHERE sub_institute_id = '".$sub_institute_id."' AND chapter_id = '".$chapter_id."' ..."` (`:419-421`) where `$sub_institute_id` is the **request value** (`:372`; `subject_id` is `:374`).
- The content queries concatenate `AND subject_id = '".$subject_id."'` where `$subject_id` is the **request value** (`:448`, `:459`).
- Both are reachable by any caller with a valid JWT (the JWT is only a signature check, `:361-368`). Values should be bound parameters, cast to integers, or taken from the token — not concatenated. A third site builds `content_category = '".$tval['name']."'` from a database value (`:459`), a second-order injection if a category name ever contains a quote.
- `$subInstituteIdsStr` is correctly passed through `intval` (`:380-382`); the same care is missing for the two values above.

### 2. No pagination; unbounded response
- One call returns **every** visible chapter of the subject, each with its topics and every content row (`:386-473`). There is no `limit`, `page` or `chapter_id` parameter, so large subjects produce very large responses and long requests on a phone.

### 3. A query per chapter and per topic (N+1)
- Inside `foreach ($chapterdata ...)` (`:416`) it runs a `topic_master` query (`:419`) or a `content_master` query (`:424-433`) for each chapter, and inside the nested `foreach ($topicData ...)` a further `content_master` query **per topic** (`:442-462`). The number of queries grows with chapters × topics. These should be one or two joined/`IN` queries, or fetched lazily per chapter on demand.

### 4. `SELECT *` over content rows
- `SELECT *, if(filename = '', '', ...) as full_path FROM content_master` (`:442-448`, `:455-460`) returns every column of every content row, including internal columns the screen does not need. Select only the columns the client uses (`id`, `title`, `file_type`, `full_path`, ordering).

### 5. CDN / external content links
- A file's link is `concat(env('DO_PATH'), 'public', file_folder, '/', filename)` — a **content-CDN host, not the ERP host** — and for `file_type = 'link'` the stored `filename` is returned as-is (`:444-446`, `:457-458`). The client cannot validate these against the ERP host allow-list. If links must point at the CDN, document the host(s) and file types so clients can allow-list them; ideally serve files through an authenticated route or signed, expiring URLs.
- For LMS schools (`school_setup.is_lms = 'Y'`) tenant **1**'s shared content is included (`:376-378`); confirm that is intended for every student.

### 6. Authorization review
- The student is taken from the request (`student_id`), not the token, and there is **no ownership check**. The standard group is derived from that student's enrolment (`:395-407`), so a caller who changes `student_id` reads another student's learning scope. Please derive the student from the token for student tokens.
- `show_hide` and `availability` are applied, but whether *this* student may see a chapter (standard, elective, lock/availability windows) should be reviewed end to end.

## What is wanted
1. Bind or cast **every** request value (and the category name) in all queries; never concatenate.
2. Add paging or a per-chapter parameter; return a flat, bounded, ordered payload.
3. Replace the per-chapter/per-topic queries with a fixed number of queries.
4. Select explicit columns instead of `SELECT *`.
5. Document the CDN host(s) for files, or serve files through an authenticated/signed route.
6. Take the student from the token and review who may see which chapters.
7. Prefer a modern, token-bound, student-scoped endpoint (like `api/lms-homework/my-submissions` or `api/lms/social-collaborative`) for the Learn flow.

## Acceptance checks for the backend change (suggested)
- A value such as `1' OR '1'='1` in `subject_id` or `sub_institute_id` returns a validation error or no data, never extra rows; the executed SQL shows bound parameters.
- A subject with many chapters returns a bounded response in a bounded number of queries (check the query log).
- A student token cannot read another student's content by changing `student_id`.
- File links point only at documented hosts.

## What the mobile app does meanwhile
Nothing: the Learn tile is an honest "not available" message. `studentSubjectAPI` is also unused. A new sub-module (own document and approval, verified with synthetic ids first) could present subjects → chapters → items once the endpoint is fixed; nothing here authorises it.
