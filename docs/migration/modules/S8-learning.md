# S8 — Learning (LMS) for students

Status: **S8a + S8c DONE** (signed off 2026-10-07) — view-only own-discussions Social Collaborative and the Live Lecture unavailable state implemented, tested, verified locally with synthetic ids only (counts only). Document approved 2026-10-07 with **Q39 option B** (S8b Learn NOT built — unavailable state); Q40 S8-D2…D7 with clarifications; Q41 S9c added to the plan; Q42 Learn-content backend ask written. The additive F1 `bearerOnly` option is approved (default behaviour unchanged; S8a sends the JWT in the Authorization header only, never in the URL). Real-data check intentionally not done (Q16 open, applied strictly); device check deferred. **S8b Learn stays blocked on the backend.**
Class: **V1** (Social Collaborative, Learn) · **V1-blocked** (Live Lecture) · **Later** (Virtual Classroom, Portfolio, Leader Board — 3 tenants each) · Role: Student · Next in the approved build order (03 §5: … S10 → **S8** → S13) · Depends on: **F1** (done — form-encoded legacy requests, `type=API`, the non-legacy JSON client with the Bearer token), **S1** (done — student gate, per-user query hook, stale banner, `safeAttachmentUrl`, `isSafeHttpUrl`), S3/S5/S7/S9/S10 (done — the "open a link with `Linking`" pattern, 30-row batches), S4a (modern token-bound API pattern, `stripHtml`, `isHomeworkId`). · Decisions: D-03, D-09, D-13, D-14, D-17.
Facts cite file:line. `ev:` = [evidence/](../evidence/README.md). **[ASSUMPTION]** = not read from code. **[VERIFIED-LOCAL]** = observed on the local Laravel server on 2026-10-07 using a **non-existent student (`999999999`, tenant `1`)**. **[VERIFIED-NO-DB]** = checked by reading code. Only read endpoints were called.

## 0. A disclosure about this research (Q16)
While probing the modern social-collaborative list I called `GET api/lms/social-collaborative` **without** `mine=1`. For a student token that endpoint returns the tenant's **public** discussions as well as the caller's own (`LmsSocialCollaborativeService.php:287-293`), so a synthetic student on the real tenant `1` received **one real, public discussion post**. I displayed only the first 320 characters of the response (an id, a title naming a science chapter, the description "testing", `public`, and ids); the rest — including any author name — was **not read**, and the saved response file was **deleted unread**. No student record was addressed, but this is real content from a database that may be production, so I am recording it here and in the tracker rather than treating it as nothing. **Consequences:** (1) every later check of this endpoint uses `mine=1` (scoped to the synthetic user, so empty), the 404 detail, 401 and 422 only; (2) the design below shows **only the student's own discussions**, never the tenant feed (§6, S8-D4); (3) the tenant-wide feed can be verified only with mocked transport until you lift Q16.

## 0b. Scope map — what is proposed, what is blocked, what is not S8
| Part | Tile (`screen_name`, tenants of 34) | Endpoint | Class | Proposed? |
|---|---|---|---|---|
| **S8a** | Social Collaborative (`social_collabrative`, 10) | modern `GET api/lms/social-collaborative?mine=1` and `…/{id}` (token-bound) | V1 | **Yes** — view only: my discussions and each conversation |
| **S8b** | Learn (`lms_subject`, 7) | `studentSubjectAPI` (subjects) → `studentContentAPI` (chapters, topics, content) | V1, **at risk** (§3, §10) | **Yes, with S8-D5 option A** — subjects, chapters, topics and content titles; files and links open externally. Option B/C block it |
| S8c | Live Lecture (`live_lecture`, 7) | **none** — the menu row stores only the base URL `https://erp.triz.co.in` (ev:menu_tiles.txt line 17) | V1-blocked | **No endpoint exists.** The tile shows "This isn't available in the app yet." and makes no request |
| S8d | Virtual Classroom (`virtual_classroom`, 3) | `studentVirtualClassroomAPI` | Later | **No** (below the 5-tenant rule); its response carries each meeting's **password** (§3) |
| S8e | Portfolio (`portfolio`, 3) | `studentPortfolioAPI` | Later | **No** |
| S8f | Leader Board (`leaderboard`, 3) | modern `GET api/lms/leaderboard` | Later | **No** (it also shows a fabricated "Bronze" medal and classmates' names, §3) |
| – | Start a discussion, comment, quizzes / tests (`studentQuestionPaper*`, `studentAssessment*`), activity stream, book list, syllabus | write or untiled endpoints | – | **Not proposed.** Posting and commenting are writes; the quiz save is a write that stores an attempt; none is a production student tile |
S8a and S8b are **view only**: no post, comment, answer, attempt, upload or submission. A student who wants to ask a question or take a test still uses the website until a separate write module is approved.
**Plan gap found while auditing the menu (not S8):** the student tile **Student Discipline** (`child_remark`, **23** of 34 tenants, `studentDisciplineAPI`) is in neither the module plan nor the tracker. It is a small read-only list of the same shape as S9 (`routes/student.php:183`; `diciplineController.php:276-`, rows `{discipline, message, discipline_date, flag}`; **[VERIFIED-LOCAL]** empty list for the synthetic student, 401 without a token). I propose adding it as **S9c** (Q41). The only other student tiles without a module are `capture_photos` (S11, Later) and `wrt_progress` (S5b, blocked).

## 1. What the student will be able to do
- **Social Collaborative:** see the discussions *they* started (title, text, subject link, when, number of replies, attachment) and open one to read the whole conversation, oldest message first, with who wrote each message. Pull to refresh. Posting and replying are not in the app yet.
- **Learn:** see their subjects, open a subject to see its chapters, a chapter to see its topics (or content categories), and a topic to see the learning items (title and type); an item opens in the phone's browser/viewer. No attempts, no scores.

## 2. Existing screens and Laravel endpoints (evidence)
| Source | Finding |
|---|---|
| **Web (D:/lms_k12)** | The LMS screens are the staff authoring and learner course screens of the Next.js app (course/lesson-plan, `app/lms/*`, `components/domain/lms`); the learner side uses `ApiLmsCourseController` and the modern `lms/*` routes. The mobile tiles are legacy bare-path endpoints. `app/lms/data/socialCollaborative.ts` backs the web Social & Collaborative page, which calls the modern `api/lms/social-collaborative` (open to students and staff alike, per the backend comment at `routes/api.php:385-391`); the mobile "Learn" tile has no twin I could find in the web student path **[ASSUMPTION — not exhaustively searched beyond the LMS folders]**. |
| **Production menu** (read-only SELECT on `mobile_homescreen`, 2026-10-07; ev:menu_tiles.txt lines 17-22) | `Social Collaborative` → `studentSocialCollabrativeAPI` (10); `Learn` → `studentSubjectAPI` (7); `Live Lecture` → base URL only (7); `Leader Board` (3), `Portfolio` (3), `Virtual Classroom` (3). Staff rows (`t_social_collobrative`, `t_virtual_classroom`, `t_portfolio_feedback`, 4 each) are out of S8. |
| **Flutter** (reference only) | `lms.dart:36-246`: subjects (`studentSubjectAPI`) → content map (`studentContentAPI`, keyed by chapter, `topicData[].contentData[]{title,file_type,full_path}`) → tests (`studentQuestionPaperListAPI`, `…API`, `…SaveAPI`, reports); `lists_a.dart:106-241`: social collaborative **already uses the modern `GET /api/lms/social-collaborative?mine=1&per_page=50&page=N` and `/{id}`** with the legacy POST as fallback; leaderboard modern `/api/lms/leaderboard`. Its docs say its endpoints were never run live (ev:flutter_ref.md lines 80-89, 99). |
| **Current RN app** | the tiles fall back to `GenericDataScreen`: JSON body, `api_param` as one malformed key, **no student id** — the legacy ones answer "Parameter Missing"; `live_lecture` posts to the site root. |
**Backend (read in full 2026-10-07, read-only):**
| Endpoint | Route | Method | Auth / identity |
|---|---|---|---|
| `GET api/lms/social-collaborative`, `GET …/{id}` | `routes/api.php:414-418`, group `api.session` | `LmsSocialCollaborativeApiController` `:37-72` → `LmsSocialCollaborativeService` | **token-bound**: tenant, year, user and `is_student` come from the verified token (`api.php:385-391`); a student sees public discussions, their own, and classmates' (`LmsSocialCollaborativeService.php:277-309`); 422 "Academic Term Date Expired" without a current year (**[VERIFIED-LOCAL]**) |
| `POST api/lms/social-collaborative`, `POST …/{id}/comments` | `api.php:420-421` | `store`, `storeComment` | **WRITES** — never called |
| `POST studentSubjectAPI` | `routes/lms.php:359` | `lms_apiController::studentSubjectAPI` `:175-` | JWT always checked (`:177`); identity from the request; no ownership check; the query is parameterised query-builder SQL (`:200-258`); only `allow_content = 'Yes'` subjects; for LMS schools (`school_setup.is_lms = 'Y'`) it also returns tenant **1**'s shared courses with a `Triz-` name prefix (`:221-226`) |
| `POST studentContentAPI` | `routes/lms.php:360` | `lms_apiController::studentContentAPI` `:359-482` (the earlier copy at `:272-` is commented out) | JWT always checked (`:361-368`); needs `student_id`, `sub_institute_id`, `syear`, `subject_id`; chapters/topics/content for the student's standard group (`:386-413`); **see §10** |
| `GET api/lms/leaderboard` (+ `filters`, `rankings`, `{userId}`) | `api.php:394-397` | `LmsLeaderboardApiController` | token-bound, read-only |
| `POST studentVirtualClassroomAPI`, `studentPortfolioAPI`, `studentLeaderBoardAPI` | `lms.php:356-365` | `lms_apiController` `:24-`, `:76-`, `:677-` | JWT always; identity from the request |
| `lms-chapters`, `lms-chapter-content`, `lms-courses` (modern course API) | `routes/api.php:226-231` | `ApiLmsCourseController` | `lms-chapters` refuses students (403, `:766-773`); `lms-chapter-content` and `lms-courses` have **no auth middleware** and read the tenant from the request — not usable |
| `studentQuestionPaperListAPI`, `…API`, `…SaveAPI`, `studentAssessmentAPI`, `…DetailAPI`, `studentActivityStreamAPI`, `studentBookListAPI`, `studentSyllabusAPI`, `lmsCategorywiseSubjectAPI` | `lms.php:361-376` | `lms_apiController` | tests / writes / untiled — not proposed |

## 3. Which API (S8-D2/D3): modern for social, legacy for Learn — and what must not be called
| Endpoint | Verdict | Why |
|---|---|---|
| **modern `GET api/lms/social-collaborative?mine=1` and `/{id}`** | **Use for S8a** | token-bound identity (nothing from the body), explicit per-role visibility rules in the service, pagination, read-only; same choice as S4a. `mine=1` restricts the list to the caller's own discussions (`LmsSocialCollaborativeService.php:74-76`). **[VERIFIED-LOCAL]** `mine=1` → `{"success":true,…,"data":[],"meta":{"current_page":1,"per_page":50,"total":0,"last_page":1}}`; unknown id → 404 "This discussion is not available."; no token → 401; non-existent tenant → 422. The legacy `studentSocialCollabrativeAPI` is **not** used (identity from the body). |
| `studentSubjectAPI` | **Use for S8b** | JWT always checked; parameterised SQL; read-only; **[VERIFIED-LOCAL]** `{"status":1,"message":"Success","data":[]}` for the synthetic student, 401 without a token. |
| `studentContentAPI` | **Use for S8b only under S8-D5 option A — flagged at risk** | JWT always checked, read-only, non-destructive. But (1) it **concatenates request values into SQL**: `subject_id` (`:448`, `:459`) and `sub_institute_id` (`:419-421`) go straight into query strings — the app sends only digits taken from the subjects list and validates them (as S4a/`isHomeworkId`), so the app cannot inject, but the endpoint remains injectable for any other caller; (2) it runs **a query per chapter and per topic** with `SELECT *` (`:416-462`) and no paging, so a big subject can be slow and large; (3) file links are `env('DO_PATH').'public'…` (a CDN host, not the ERP host) or raw links (the `file_type = 'link'` branch, `:444-446`); (4) tenant 1's shared content is included for LMS schools. **[VERIFIED-LOCAL]** `subject_id=1` for the synthetic student → `{"status":0,"message":"No Data Found"}`; missing subject → `Parameter Missing`. |
| `lms-chapter-content`, `lms-courses`, `lms-chapters` | **Never** | no authentication / refuses students / tenant from the request. |
| `POST api/lms/social-collaborative` and `…/comments` | **Never in S8** | writes. |
| `studentQuestionPaper*`, `studentAssessment*` | **Never in S8** | the save stores a quiz attempt (a write). |
| `studentVirtualClassroomAPI` | not in S8 (Later) | its rows carry the meeting **`password`** next to the join `url` (ev:student_tiles_backend.md row 35) — personal-risk data that would need its own decision. |
| `GET api/lms/leaderboard` | not in S8 (Later) | token-bound, but `learner.medal` is a **hard-coded "Bronze"** (`LmsLeaderboardService.php:45`, "no tier logic exists anywhere in the ERP") and `toppers` lists classmates; it would need two decisions. **[VERIFIED-LOCAL]** `{"success":true,…,"data":{"has_data":false,"learner":{…,"rank":null,"class_size":0,"medal":"Bronze"},"modules":[],"toppers":[]}}`. |
| `live_lecture` | no endpoint | S8c message only. |
A test asserts that S8 touches only the permitted URLs (§12).

## 4. API contracts
**S8a (non-legacy client, JSON + Bearer, `type`/`sub_institute_id`/`syear`/`token` added by F1 as for S4a):**
- `GET api/lms/social-collaborative` with `mine=1`, `per_page=50`, `page=N` (the app follows `meta.last_page`, capped at 10 pages = 500 discussions). Success (`LmsSocialCollaborativeService::presentDoubt` `:420-436`): `{"success":true,"message":"…","data":[{"id","title","description","visibility","subject_id","chapter_id","topic_id","attachment_url"|null,"created_at","total_days","comment_count","author":{"user_id","name","type","class","avatar_url"}}],"meta":{"current_page","per_page","total","last_page"}}`.
- `GET api/lms/social-collaborative/{id}` (id = digits only, validated before the request): the same object plus `comments:[{"id","doubt_id","message","created_at","author":{…}}]` oldest first (`:118-130`, `:456-478`). 404 `This discussion is not available.`
- Errors: 401 unauthorized (sign-out), 422 "Academic Term Date Expired", others via F1.
**S8b (`legacy.post`, form-encoded, identity block, `type=API`):**
- `studentSubjectAPI` → `{"status":1,"data":[{standard_id, subject_id, display_name, allow_content, display_image, sort_order, elective_subject, subject_category, status, sub_institute_id}]}`; `display_image` is built **without a `/`** (`CONCAT('https://…/storage', display_image)`, `:243-247`) and is **ignored** (no images, as S1-D3/S10-D4).
- `studentContentAPI` + `subject_id` → `{"status":1,"data":{"<chapter_id>":{chapter_id, chapter_name, chapter_desc, standard_id, subject_id, availability, add_content, topicData:[{id?, name?/topic_name, …, contentData:[{title, file_type, filename, full_path, …}]}]}}}` — an **object keyed by chapter id**, topics under `topicData`, content under each topic; `status:0` + `No Data Found` when empty. The exact topic/content field names beyond those used by the Flutter app (`chapter_name`, `topicData[].name`, `contentData[].{title,file_type,full_path}`) are **[ASSUMPTION]** from `SELECT *`; the parser reads only those and ignores the rest.
**Parsing (planned):** social: `data` list → rows; `comments` list; all text plain; ids as digit strings. Learn: subjects → `{subject_id, name, category}`; content → chapters (object → list, ordered by `sort_order` then id), topics, items `{title, type, url}`; `No Data Found` → empty list (that message only).

## 5. Student identity, session and academic year
- S8a: identity comes **only from the verified token** (no student id is sent or accepted); the year comes from the login (`syear`) and the server returns 422 when the school has no current academic year — a clear "School year not set up" state. S8b: F1 pins `student_id`/tenant/year to the session; `subject_id` is a digit string taken from the subjects response, validated before use.
- In-screen guards as S1–S10: not a student → "Students only", no request; no school year → "School year not set", no request. The cache key carries user id and year (and subject id); cleared on sign-out; nothing persisted; no content logged.
- **Backend weakness:** the legacy Learn endpoints take the student from the request with no ownership check. The modern social endpoints do not.

## 6. Data presentation and UX
**Social Collaborative (S8a).** A list of *my* discussions, newest first (the server order), 30 at a time with "Show more" (or by server page). Card: title; the text (`stripHtml`-safe plain text); "Shared with everyone" / "Private" from `visibility` as sent; created date; "{n} replies"; an **Open attachment** button when `attachment_url` passes the link rule (S8-D6). Tapping a card opens the conversation: the discussion, then each message — author name and class as the server presents them, date, text — oldest first. **No composer, no reply, no like.** The classmates' and teachers' names that appear are only those who commented on the student's own discussion (the app never lists the tenant feed — §0, S8-D4).
**Learn (S8b).** Level 1: subjects (name; category from the server; the `Triz-` prefix the server adds for shared courses is shown as sent), ordered by `sort_order`. Level 2: a subject's chapters (name, description as plain text), ordered by `sort_order`. Level 3: topics (or content categories) and under each the items: title, type (`pdf`, `link`, `video`, … as sent), **Open** when the link passes the rule (S8-D6); items without a usable link show the title only. No progress, no completion, no scores. A closing note: "Tests and quizzes aren't available in the app yet."
| State | UI |
|---|---|
| loading, no data | existing `Loading` |
| error, no data | `ErrorState` + Try again (F1 messages) |
| 422 no current year | "Academic Term Date Expired" as the server says it, with Try again |
| empty — discussions | "You haven't started any discussions" — "Posting isn't available in the app yet." |
| empty — subjects / chapters | "No learning content for school year {syear} yet" (`No Data Found`) |
| error while cached | content stays + banner "Couldn't refresh — showing the last loaded data." |
| 404 on a conversation | inline "This discussion is not available." with Try again |
| a link cannot be opened | inline notice: "Couldn't open the file. Please try again or contact your school." |
| `syear` missing / not a student | "School year not set" / "Students only"; no request |
| **Live Lecture tile** | `EmptyState` "This isn't available in the app yet." — "Please ask your school." **No request** |
**Stale data:** 5 minutes. **Accessibility:** each card one group with a spoken sentence; buttons ≥ 44 dp; status in words.

## 7. Navigation and tile integration
Registry: `social_collabrative` → `SocialCollaborativeScreen` (list + conversation); `lms_subject` → `LearnScreen` (subjects → chapters → items, in one screen with an in-screen back stack, no new route); `live_lecture` → the existing `RecordUnavailableScreen`. Screens ignore the tiles' stored `api`. Removing an entry restores today's fallback.

## 8. Security and privacy
- **Peers' content.** Discussions can contain classmates' names and text. S8a shows only the student's own discussions and the conversations on them; it never requests the tenant feed (§0).
- **Links leave the app.** Attachments and learning-item links open only through `Linking.openURL` after validation (S8-D6); no in-app viewer, **no download, cache or sharing**; photos/avatars (`avatar_url`) and `display_image` are ignored — **no image is fetched** (S10-D4 stance).
- **Plain text only:** titles, descriptions, messages and names are rendered as `<Text>`; HTML is flattened by `stripHtml`.
- **Writes:** none exist in S8a/b.
- **Never called:** every endpoint marked Never or "not in S8" in §3. A test asserts it.
- **Identity:** token-only for social; session-pinned for Learn; guards; per-user cache.
- **SQL-injection exposure of `studentContentAPI`** is a backend defect; the app sends only validated digits (S8-D5).

## 9. Dependencies
| Reused | From | Used for |
|---|---|---|
| non-legacy `api.get` (JSON + Bearer), `legacy.post` | F1 | the requests |
| `useStudentQuery`, `studentGate`, `StaleBanner` | S1 | guards, loading, error + retry, stale banner, cache |
| `safeAttachmentUrl`, `isSafeHttpUrl`, `Linking.openURL(...)` pattern | S1, S3, S5, S9, S10 | links |
| `stripHtml`, `cleanText`, `LIST_PAGE_SIZE`, `toDateKey`/`displayDate`, `RecordUnavailableScreen` | S4a, S7, S9 | text, paging, dates, the Live Lecture message |
No new package.

## 10. Backend limitations and known defects (for the owners; not to be fixed in this migration)
1. **`studentContentAPI` builds SQL from request values** — `subject_id` and `sub_institute_id` (`lms_apiController.php:419-421`, `:448`, `:459`) — so any authenticated caller can inject; and it issues a query per chapter and per topic with `SELECT *`, unpaged.
2. `studentSubjectAPI` and the other legacy LMS endpoints take the student from the request (no ownership check); `display_image` is built without a `/`.
3. **Learning files are on a CDN host** (`DO_PATH`), raw links are returned as stored; no authenticated download route.
4. **`studentVirtualClassroomAPI` returns the meeting password** with the join URL; **the leaderboard shows a fixed "Bronze" medal**; both matter only for the Later tiles.
5. `live_lecture` has no endpoint at all (its menu row stores the site root).
6. The modern social API returns tenant-wide public discussions to any student unless `mine=1` is sent (by design, but see §0).
7. `lms-chapter-content` and `lms-courses` have no authentication.
**Backend asks:** bind `studentContentAPI`'s queries and add paging; derive the student from the token; return a per-student content list from a token-bound modern endpoint (the web learner screens already need one); remove the meeting password from the student response or serve it only on demand; remove or implement real tiers for the medal; provide a Live Lecture endpoint.
**Consequence for the plan:** S8a is not known to be affected by any defect. S8b depends on `studentContentAPI` and is **at risk** (security posture, size, link hosts). What cannot be known without real data (Q16): real subject/chapter/content shapes and sizes, link hosts, discussion volumes.

## 11. Exact files expected to change (all under `D:/lms_k12_mobile_rn`)
**Modified (2 — additions only):** `src/api/student.ts` (append `fetchMyDiscussions()`, `fetchDiscussion(id)`, `fetchLearnSubjects()`, `fetchLearnContent(subjectId)`, row types, `isDiscussionId`, `isSubjectId`), `src/screens/registry.ts` (+ `social_collabrative`, `lms_subject`, `live_lecture`).
**New (src):** `screens/student/discussionModel.ts`, `learnModel.ts`, `SocialCollaborativeScreen.tsx`, `LearnScreen.tsx`, `hooks/useLearning.ts`.
**Tests:** `discussionModel`, `learnModel`, `studentLearningApi`, `SocialCollaborativeScreen`, `LearnScreen`, `studentLearning.local` (opt-in), plus `registry.test.ts` (thirty-seven names).
No `package.json`, native, Laravel or Next.js change; no new library; S1–S10 behaviour unchanged.
**Build order (one at a time, each tested before the next):** Social Collaborative (list, then conversation) → Learn (subjects, then chapters/items) → the Live Lecture message.

## 12. Tests and acceptance criteria
**Models:** discussions — order kept, `visibility` words, plain-text description, reply count, attachment link states (ready/none/unsafe, nine unsafe forms), date text, missing author → "Unknown user"; conversation — oldest first (by date then id), author name/class, empty comments; `isDiscussionId`/`isSubjectId` (digits only; `../1`, `1/2`, `%2e%2e`, `12;`, `1 OR 1=1`, `'`, empty, huge refused); Learn — object-of-chapters → ordered list, topics with `name`/`topic_name` fallbacks, items with title/type/link, unreadable fields left out, nothing invented, link rule (ERP files re-based; CDN/other https via `isSafeHttpUrl`; credentials/`javascript:`/`intent:`/`file:`/`tel:` refused), `No Data Found` → empty.
**API:** social — non-legacy GET with Bearer, `mine=1`, `per_page=50`, `page` paging until `last_page` and capped at 10, **no student id sent**, detail path with a validated id (invalid id refused with no request), 401 / 404 / 422 / 500 / network / 419; Learn — form-encoded identity block, `subject_id` validated digits and sent as the only extra field, both envelopes, `No Data Found`, `Parameter Missing`, 401 + status `2`; **only the permitted URLs are ever requested — never `POST api/lms/social-collaborative` (create or comment), `…/comments`, `lms-chapter-content`, `lms-courses`, `lms-chapters`, `studentQuestionPaper*`, `studentAssessment*`, virtual classroom, portfolio, leaderboard, activity stream, add/update/delete/upload**.
**Components:** per screen — loading; list; empty; errors + Try again; 422; stale banner; guards (no request for a non-student or without a year); per-user cache; **no input, composer, reply, like, attempt or upload control exists**; links open once after validation, unsafe ones show a message and no button; open failure → inline notice; conversation 404 → inline message; Learn navigation (subjects → chapters → items → back); the unavailable Live Lecture message makes no request; `registry` — thirty-seven names.
**Regression:** all 916 existing tests pass; typecheck clean.
**Acceptance:**
1. The three tiles open their dedicated screens; removing a registry line restores today's behaviour.
2. Every §6 state is reachable and correct; nothing hidden; ordering rules hold.
3. Social requests carry no student id and use `mine=1`; Learn requests are form-encoded with the session's ids and validated digit ids; no request for a non-student or without a year; only the permitted URLs.
4. No write, attempt, comment, post or upload code or control exists; no image is fetched; no download/cache/share.
5. `npm run typecheck` and `npm test` pass; no native/package change.
6. Local synthetic-id checks pass (§13); the real-data check is **not** claimed.

## 13. Local-server verification plan (synthetic ids only — Q16)
Same setup as S1–S10: `php artisan serve --host=127.0.0.1 --port=8000`, JWT signed locally for the **non-existent student `999999999` on tenant `1`** (and on a non-existent tenant for the 422 case). An opt-in, loopback-only test `studentLearning.local.test.ts` drives the real client and fetchers over real HTTP: `fetchMyDiscussions()` with `mine=1` → `[]`; `fetchDiscussion('999999999')` → 404 "This discussion is not available."; a non-existent tenant → 422 "Academic Term Date Expired"; a bad token → `unauthorized`; `fetchLearnSubjects()` → `[]`; `fetchLearnContent('1')` → `[]` (the server's "No Data Found"); the requests are only the four permitted paths; **the tenant-wide feed (no `mine`) is never requested**. Already done for this document: the curl results in §3 (one of which produced the disclosure in §0). **Cannot be verified without real data (Q16):** the real shape of discussions, comments, subjects, chapters, topics and content, link hosts, sizes, and the tenant feed.

## 14. Device / coordinated-pass additions
For the later pass: the discussion list and conversation at 360 dp (long text, many replies), the Learn drill-down with a large subject (response size and time), opening an attachment / learning item / video link and returning, behaviour with no viewer installed, pull-to-refresh, the 422 state, and the unavailable message.

## 15. Rollback
Delete the three lines in `src/screens/registry.ts` (the tiles fall back to `GenericDataScreen`, today's behaviour) or `git revert` the S8 commit; the additions to `student.ts` are additive and unused afterwards; F1 and S1–S10 are unaffected. JS-only; no server or data change; nothing is written anywhere.

## 16. Decisions and questions (answered 2026-10-07: Q39 option B; Q40 yes with clarifications; Q41 S9c added; Q42 backend ask written; Q16 still open and now applied strictly — see the process correction in 02-decisions.md)
- **Q39 / S8-D1 — scope.** **Option A (recommended):** build S8a (my discussions + conversation, view only), S8b (Learn, view only, with the S8-D5 caveats) and the Live Lecture message. **Option B:** S8a and the Live Lecture message only; Learn shows "This isn't available in the app yet." until the backend binds `studentContentAPI`. **Option C:** do not build S8 now. The three Later tiles (virtual classroom, portfolio, leader board) stay out of all options.
- **Q40** Confirm S8-D2…D7:
  - **D2** social uses the modern token-bound API only (`mine=1`), never the legacy `studentSocialCollabrativeAPI`;
  - **D3** Learn uses `studentSubjectAPI` and `studentContentAPI` only, with the stored tile `api` ignored;
  - **D4** only the student's **own** discussions are shown — the tenant feed (public and classmates' posts) is never requested;
  - **D5** *(option A only)* `studentContentAPI` is called with digit-validated ids, treated as at-risk (injectable, per-chapter queries), size-capped by showing one chapter's items only when opened, and any `status:0` other than `No Data Found` is an error;
  - **D6** links: attachment URLs and learning items open only in the phone's browser/viewer — ERP-hosted files through `safeAttachmentUrl` (re-based), other plain `https` hosts (the content CDN, raw links) through `isSafeHttpUrl`; no download/cache/share; **no image is fetched** (avatars and subject images ignored);
  - **D7** no write of any kind; the unavailable wording "This isn't available in the app yet." for Live Lecture and "…isn't available in the app yet" notes for posting and tests.
- **Q41** The **Student Discipline** tile (`child_remark`, 23 tenants) was missed by the plan. Add it as **S9c** (view-only list like S9)? Behaviour records are sensitive; I would apply the S9 health-data handling (in memory only while the screen is open, no logging).
- **Q42** Write up the `studentContentAPI` problems and the other §10 items as a separate backend ask (as for S9/S10)? No Laravel change.
- **Q16 stays open** — and §0 records one real public post that a probe returned; nothing further from that endpoint will be requested without `mine=1`.

## 17. What was actually done (2026-10-07)
Built as approved (**Q39 option B**: S8a Social Collaborative, view only, the student's own discussions only; S8c Live Lecture unavailable state; **S8b Learn not built** — its tile shows the unavailable state; Q40 S8-D2…D7 with the clarifications below; Q41 Student Discipline added to the plan as S9c, not implemented; Q42 the Learn-content backend ask written separately, no Laravel change). **Strictly view only.** Everything is **uncommitted** on branch `migration/s8-learning` (created from `migration/s10-school-info-galleries`); you will review and approve the commit separately.

### Files (all under `D:/lms_k12_mobile_rn`)
**Modified (3 source files — +97 lines, 1 line changed)**
| File | Change as built |
|---|---|
| `src/api/student.ts` | appended `fetchMyDiscussions()`, `fetchDiscussion(id)`, `isDiscussionId()` and the `Discussion` / `DiscussionComment` / `DiscussionDetail` types |
| `src/screens/registry.ts` | + `social_collabrative`, `lms_subject` and `live_lecture` (both → `RecordUnavailableScreen`) |
| `src/api/client.ts` | **the one touch to F1:** a new opt-in request option `bearerOnly` (default off) that stops a GET repeating the JWT as `?token=` in the URL (one condition changed, one option added) — see deviation 1 |
**New (src, 3):** `screens/student/discussionModel.ts`, `SocialCollaborativeScreen.tsx`, `hooks/useDiscussions.ts`.
**Tests (new, 6):** `discussionModel`, `studentDiscussionApi`, `SocialCollaborativeScreen`, `learningUnavailable`, `clientBearerOnly`, `studentDiscussions.local` (opt-in); `registry.test.ts` extended (thirty-seven names + the S8 mappings).
**Docs (new/updated):** [backend-asks/S8-learn-content-endpoint.md](../backend-asks/S8-learn-content-endpoint.md) (Q42); S9 document §18 (S9c added to the plan, not implemented); this document; `STATUS.md`, `02-decisions.md`.
No `package.json`, native, Laravel or Next.js change; no new package. The Laravel working tree still holds exactly its four earlier changes.

### Requirements from your reply — how each is met
| Requirement | Result |
|---|---|
| modern token-bound API with `mine=1` only | `fetchMyDiscussions()` takes no parameters and always sends `mine=1`, `per_page=50`, `page=N` (`GET api/lms/social-collaborative`); tests assert **every** page request has `mine=1`, that extra arguments are ignored, that a static scan of the code finds no `mine: 0/false` and no `visibility` / `search` / `subject_id` / `chapter_id` in any query, and the local run asserts `mine=1` on every list request |
| never request the broad / public feed | not possible through the fetcher (above); the only non-`mine` request in the whole app flow is the detail of an id taken from the student's own list |
| never show another student's / a public discussion | **two locks**: `mine=1` on the server, and the model drops every row whose author is not provably the signed-in student (other id, empty id); a conversation whose discussion is not the student's own renders "This discussion is not available." and nothing of its content (tested with a public discussion by someone else) |
| view only: no post, comment, edit, delete | no input, composer or such control; the POST routes (`api/lms/social-collaborative`, `…/comments`) are never referenced — a code scan finds exactly two `api.get` uses and no `api.post` |
| author information limited to what is needed | the list shows **no** author information; a conversation shows each message's display name (and "You" for the student) — class, avatar and ids are neither read into the UI nor displayed |
| external links validated | attachments: ERP-hosted files through `safeAttachmentUrl` (re-based), other plain https (the content CDN) through `isSafeHttpUrl`; credentials, `javascript:`, `file:`, `intent:`, `tel:`, relative paths refused with a message and no button |
| no images fetched automatically | no `Image`; avatars ignored; the screen test spies `fetch` and finds no call |
| Learn: content endpoint never called; no legacy fallback; no client-side workaround | `lms_subject` → the unavailable screen (no query, no request); a code scan finds none of `studentContentAPI`, `studentSubjectAPI` or the other legacy LMS endpoint names anywhere in `src`; the local server log shows 0 hits |
| Live Lecture: no endpoint, approved unavailable state, no request | ✅ (same screen, tested with `fetch` spied) |
| Q16 strictness | the local run asserts **counts only**, never prints or inspects a response body, and requests only `mine=1` (scoped to the non-existent caller), the detail of a non-existent id and error cases |

### Deviations (all small; deviation 1 touches F1)
1. **A small additive change to the F1 client (`bearerOnly`).** F1 repeats the JWT as `?token=` in the URL of every GET. S8a is the first module whose only available endpoints are GETs, and a JWT in a URL ends up in server access logs. I added an opt-in request option, default off, and used it for the two S8a calls; the token then travels only in the `Authorization` header (which `api.session` endpoints read — every probe in this migration used the header alone). Existing behaviour is unchanged (`clientBearerOnly.test.ts` pins both the default and the new option; all earlier client tests pass). It is easy to revert if you would rather not touch F1.
2. **Only 30 discussions are shown at a time** (client-side "Show more") after fetching up to 10 pages (500) of 50.
3. **The conversation opens inside the same screen** (list ↔ conversation with a "Back to my discussions" button), not as a new route.
4. **The Learn tile's registry entry is `RecordUnavailableScreen`** (S9's component) — "This isn't available in the app yet." / "Please ask your school." — and `studentSubjectAPI` is also left unused, because the subjects list is the first step of the Learn flow you asked me not to build.
5. **An extra whole-`src` scan test** (`learningUnavailable.test.tsx`) guards the "never reaches" rules for every future change.
6. **The list hook wraps the fetcher** (`() => fetchMyDiscussions()`) so the query library cannot pass it any argument.
7. **A bad-token check requested `/api/lms/social-collaborative/1`** (a detail for id 1) in the local run: the request is rejected with 401 before any controller code runs, so no row can be involved; every other request used `mine=1` or the non-existent id `999999999`.

### Tests (Jest) — typecheck clean; full suite: **994 passed, 0 failed, 41 skipped** (the ten opt-in local suites) — S8 added 78 passing tests (was 916)
| Suite | Covers |
|---|---|
| `discussionModel.test.ts` (23) | own-only filter (other / empty / padded ids, number or string user id), newest first (ties by id, undated last), plain-text description, visibility words, reply count, **no author fields in rows**; attachment link rule (none, ERP re-based, CDN https, nine unsafe forms); conversation: refused when not own, oldest first, "You" / display name / "Unknown", plain text, **no class / avatar / id shown**, undated last, input not mutated |
| `studentDiscussionApi.test.ts` (15) | GET with `mine=1`, `per_page=50`, `page`, no student id; **token only in the header, never in the URL**; **every** page carries `mine=1`, follows `last_page`, capped at 10; takes no parameters (extra arguments ignored); field mapping (class / avatar not read); junk → empty; 401 / 422 / 500 / 419 / network; detail by validated id (11 bad ids refused with no request), 404, comments mapping; **no write, Learn-content, legacy LMS or leaderboard URL is ever requested** |
| `SocialCollaborativeScreen.test.tsx` (22) | loading → own discussions only (others / unknown authors never shown), no author info, view only, 30 at a time, empty state, tile `api` ignored (no `fetch`); attachments (valid opens once, unsafe none, open failure); conversation (oldest first, "You", names, no composer, Back, not-available for someone else's content, 404, no class / avatar / image); 401, 422, server error + Try again, stale banner, guards, per-user cache, no console output |
| `learningUnavailable.test.tsx` (14) | Learn and Live Lecture show the exact message, make no request, and have no buttons; **no source file mentions any Learn / legacy LMS endpoint in code**; the social path appears only in the two `api.get` fetchers with `mine: 1` constant |
| `clientBearerOnly.test.ts` (3) | default GET still sends `?token=`; `bearerOnly` removes only that; POST bodies unchanged |
| `registry.test.ts` | the S8 mappings; thirty-seven names |
| existing suites | all unchanged and passing |

### Verification against the local server (read-only, synthetic ids only, strict Q16)
`php artisan serve --host=127.0.0.1 --port=8000`; JWTs signed locally for the **non-existent student `999999999` on tenant `1`** and, for the year case, on a **non-existent tenant**. The opt-in test drives the **real client and fetchers over real HTTP and asserts counts only**: **5/5 passed** — `mine=1` returns **0** discussions and every list request carries `mine=1` and no `?token=`; a non-existent discussion id is a 404 "This discussion is not available."; a tenant without a current year is a 422 "Academic Term Date Expired"; a bad token is `unauthorized`; only GET requests to the two social-collaborative paths are made. The server log shows only `/api/lms/social-collaborative` (4×, all with `mine=1`), `/api/lms/social-collaborative/1` (the 401 case) and `/api/lms/social-collaborative/999999999`; **0** hits for `studentContentAPI`, `studentSubjectAPI`, `studentSocialCollabrativeAPI` or `comments`. Server stopped afterwards (port 8000 free). **No row of any kind was returned or inspected.**

### Known limitations
- **No real data was read** (Q16): the real discussion and comment shapes, volumes and attachment hosts are verified **from code only**. A student with no discussions sees the empty state; a student with some sees them — neither is observed.
- **Not run on a device or emulator** (checklist in §14, minus Learn).
- **Learn is unavailable** until the backend endpoint is reviewed and fixed ([backend ask](../backend-asks/S8-learn-content-endpoint.md)); posting and replying are unavailable by decision.
- **Backend:** the tenant feed is still returned by the server to any student who omits `mine`; the app cannot and does not.
- **Attachment hosts:** CDN links are opened after a plain-https check, not an ERP-host check (S8-D6).

### Rollback
1. Delete the three lines in `src/screens/registry.ts` (the tiles fall back to `GenericDataScreen`, today's behaviour) or `git revert` the S8 commit; the additions to `student.ts` are additive and unused afterwards. 2. To undo the F1 touch, remove the `bearerOnly` option and its one condition in `client.ts` (and `clientBearerOnly.test.ts`). 3. JS-only; no server or data change was made, and nothing is stored on the device.

