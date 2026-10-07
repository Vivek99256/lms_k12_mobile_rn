# S10 — School information and galleries (student)

Status: **S10a DONE** (signed off 2026-10-07) — view-only school information, photo and video galleries and the classwork unavailable state implemented, tested, verified locally with synthetic ids only. Document approved 2026-10-07 (Q36 option A; Q37 S10-D2…D7 yes with D4(b): no images, photos and videos open externally only; Q38 classwork backend security ask written separately). Real-data check intentionally not done (Q16 open); device check deferred to the coordinated pass. **No image is rendered or fetched by the app; the classwork endpoint is never contacted and has no fallback. S10b stays blocked on the backend.**
Class: **V1** (school info, photo and video galleries) · **V1-blocked** (classwork gallery) · Role: Student · Next in the approved build order (03 §5: … S9 → **S10** → S8 → S13) · Depends on: **F1** (done — form-encoded legacy requests, `type=API`, `status` envelope, `legacy.get`), **S1** (done — student gate, per-user query hook, stale banner, `safeAttachmentUrl`, `isSafeHttpUrl`, `LinkedText`), S3/S5/S7/S9 (done — the "open a link with `Linking`" pattern, 30-row batches), S4a (`stripHtml`). · Decisions: D-03, D-09, D-13, D-14, D-17.
Facts cite file:line. `ev:` = [evidence/](../evidence/README.md). **[ASSUMPTION]** = not read from code. **[VERIFIED-LOCAL]** = observed on the local Laravel server on 2026-10-07 using only a **non-existent student (`999999999`, tenant `1`) and, for the school-wide endpoint, a non-existent tenant (`999999999`)** — **no real student data and no real school content was read** (Q16). **[VERIFIED-NO-DB]** = checked by reading code. Only read endpoints were called, and the classwork endpoint only with a synthetic student id (§3).

## 0. Scope map — what is proposed, what is blocked
| Part | Tiles (`screen_name`, tenants of 34) | Endpoint | Proposed? |
|---|---|---|---|
| **S10a.1** School information: Principal's Desk (`principal_desk` 33), About Us (`about_us` 25), Reach us (`reach_us` 25), School Timing (`school_timing` 25), Academic Activity (`acadamic_activity` 24), Achievement (`achievement` 24), School Information (`school_information` 24), Facility (`facility` 23 + 1 "Facilities"), Rules (`rules` 21 + 1 "Rules and Regulations") | `schoolDetailAPI` | **Yes** — nine text pages |
| **S10a.2** Photo gallery (`photos_gallery` 34) and Video gallery (`video_gallery` 26) | `studentPhotoVideoGalleryAPI` | **Yes** — albums; photos shown as thumbnails (S10-D4 option) and videos as links |
| **S10b** Classwork gallery (`classwork_gallery` 7) | `GET front_desk/send_attachment/create` (the only endpoint any client uses; the menu row has no `api`) | **No — blocked on a backend security defect** (§3, §10). The tile shows "This isn't available in the app yet." and makes no request |
Everything in S10 is **view only**: no upload, no album creation, no delete, no comment. The teacher/admin gallery tiles (`t_photo_gallary`, `t_video_gallary`) are staff modules and out of S10.

## 1. What the student will be able to do
- **School information:** open any of the nine pages and read the school's text for it (principal's message, about us, timing, rules …). Pull to refresh.
- **Photo gallery:** see the albums the school published for **the student's class and division**, open an album and see its photos (newest first); tap a photo to open it full-size in the phone's browser/viewer.
- **Video gallery:** see the albums and the videos in them; each video opens as a link in the phone's browser/YouTube app. (Videos are links only; the server stores no video files.)

## 2. Existing screens and Laravel endpoints (evidence)
| Source | Finding |
|---|---|
| **Web (D:/lms_k12)** | **No student-facing screen.** `app/front_desk/photo_video_gallary/page.tsx` mounts `GalleryAlbums` (`app/front_desk/_components/GalleryAlbums.tsx`): a **staff** screen with class pickers and "add album/photo" (`app/front_desk/_lib/modules.ts:40-44`, endpoint `api/front-desk/photo-video-gallery`, GET/POST/delete). Searched `app`, `lib`, `components` for `schoolDetailAPI`, `studentPhotoVideoGalleryAPI`, `send_attachment`, `classwork`: no student consumer; the `school_detail` table has **no web screen** at all (searched `school_detail`, `schoolDetail`, `school-detail`: only unrelated hits). So S10 is **mobile-only**, on the legacy contract. |
| **Production menu** (read-only SELECT on `mobile_homescreen`, 2026-10-07; ev:menu_tiles.txt) | lines 26 and 28 (galleries, 34 and 26), 30-40 (school information, 21-33 each; two tenants name `facility`/`rules` "Facilities"/"Rules and Regulations"), 48 (classwork_gallery, 7, **no `api`**). Staff gallery rows (lines 115-195) use `photo_video_gallary/TeacherFetchData`. |
| **Flutter** (reference only) | `info.dart:15-128`, `gallery.dart:25` (ev:flutter_ref.md lines 103, 104, 111): school info POSTs `schoolDetailAPI` with `action` = `'About Us'`, `'Principal Desk'`, `'School Information'`, `'Achievement'`, `'School Timing'`, `'Rules'`, `'Facility'`, `'Academic Activity'`, `'Reach Us'` and shows `title`/`description` (HTML); gallery POSTs with `action='Photo'|'Video'` and builds a YouTube thumbnail from the video id; classwork gallery GETs `front_desk/send_attachment/create` with `from_date`, `to_date` and reads `sentData[]`. Its docs say its endpoints were never run live. |
| **Current RN app** | the tiles fall back to `GenericDataScreen`: JSON body, `api_param` pasted in as one malformed key, **no `action` and no student id** — so `schoolDetailAPI` and the gallery answer "Parameter Missing" and the classwork tile has no `api` ("Coming soon"). Nothing useful is shown today. |
**Backend (read in full 2026-10-07, read-only):**
| Endpoint | Route | Method | Auth / identity |
|---|---|---|---|
| `POST schoolDetailAPI` | `routes/student.php:184` | `schooldetailController::schoolDetailAPI` `:200-233` | JWT always checked (`:203`); `action` and `sub_institute_id` from the **request**; no student id; `ucfirst(action)` must equal `school_detail.type` (`:215-222`); **any valid token can read any school's pages** (school information is public by nature) |
| `POST studentPhotoVideoGalleryAPI` | `routes/student.php:185` | `photo_video_gallaryController::studentPhotoVideoGalleryAPI` `:600-648` | JWT always checked (`:603`); `student_id`, `sub_institute_id`, `syear`, `action` from the **request**; no ownership check; albums are those of the class/division in that student's enrolment (`:620-622`) and `ai = 'Active'` |
| `GET front_desk/send_attachment/create` | `routes/student.php:215` (resource, group `api.session, session, menu, logRoute`) | `classworkAttachmentController::create` `:77-130` | with `type=API` the JWT is checked (`:83-86`) and tenant/year come from the request (`:106-107`); **`student_id` is only an optional filter** (`:119`) |
| Staff: `photo_video_gallary/TeacherFetchData`, `get_adminPhotoVideoAPI`, `add_adminPhotoVideoAPI`, modern `api/front-desk/photo-video-gallery` (GET/POST/update/delete, `routes/api.php:815-818`), `front_desk/send_attachment` store/update/destroy, `school_detail` resource | various | staff modules | tenant from the request; create/update/delete |
**No modern, student-token-bound API exists** for any of these.

## 3. Which API (S10-D2): legacy read endpoints; which one must not be called
| Endpoint | Verdict | Why |
|---|---|---|
| **`schoolDetailAPI`** | **Use for S10a.1** | the production tiles' own contract; read-only; parameterised query-builder SQL; JWT always checked (**[VERIFIED-LOCAL]** 401 without a token). The app sends the tile's fixed action text (§6) and its own tenant. |
| **`studentPhotoVideoGalleryAPI`** | **Use for S10a.2** | the production tiles' own contract; read-only; JWT always checked (**[VERIFIED-LOCAL]** 401 without a token); scoped to the student's class by the server. |
| **`GET front_desk/send_attachment/create`** | **Do not use — blocked** | **Credential exposure.** The response is `classWorkModel::with(['student', 'createdBy', 'updatedBy'])->…->toArray()` (`classworkAttachmentController.php:113`): every row embeds the **whole `tbluser` row of the staff member who created it** and of the one who updated it, and the whole `tblstudent` row. Neither `tbluserModel` nor `tblstudentModel` defines `$hidden` or `$visible` (searched: none), and `tbluserModel` has `password`, `plain_password` and `otp` among its attributes (`app/Models/user/tbluserModel.php:13-40`). So a student's phone would receive staff **passwords** (this ERP keeps a plain-text `plain_password` column; `ApiLoginController.php:327` reads it) for every classwork row. **[VERIFIED-NO-DB]** by code; not observable without real rows (Q16). Also: `student_id` is optional (`:119`), so a caller who omits it gets **every student's** classwork for the tenant. No workaround satisfies D-17 (the app cannot ask the server to omit the relations). Backend ask in §10. |
| staff gallery/classwork/`school_detail` routes, modern `api/front-desk/*` | **Never** | staff CRUD; tenant from the request; create/update/delete. |
**Observed [VERIFIED-LOCAL] with non-existent ids:** `schoolDetailAPI` (non-existent tenant) `200 {"status":1,"message":"Success","data":[]}`, missing `action` → `{"status":0,"message":"Parameter Missing"}`, no token → `401 {"status":"2",…}`; gallery (synthetic student) `Photo` and `Video` → `200 {"status":0,"message":"No Data Found"}`, missing `action` → `Parameter Missing`, no token → `401`; classwork `create` with a synthetic `student_id` → `200 {"from_date":…,"to_date":…,"sentData":[]}` (never called without a student id), no token → `401 {"success":false,…}`. The classwork call was made once, only to learn the response shape; S10 never makes it.

## 4. API contracts (through F1's `legacy.post`: form-encoded, identity block from the session, Bearer header, `type=API`; **plus the one `action` field the endpoint requires**)
**S10a.1 — `POST schoolDetailAPI`** with `action` (§6 table). Success (code `:218-225`): `{"status":1,"message":"Success","data":[{"title":"<school_detail.type>","description":"<school_detail.title>"}]}` — **the aliases are swapped**: `title` carries the page type and `description` carries the page's content (HTML — `school_detail.title` is a `text` column, migration `2023_03_05_115658`). Zero, one or several rows.
**S10a.2 — `POST studentPhotoVideoGalleryAPI`** with `action` = `Photo` or `Video`. Required non-empty: `student_id`, `sub_institute_id`, `syear`, `action`. Success (code `:624-640`): `{"status":1,"message":"Success","data":{"<album_title>":[{"album_title","title","file_name","date_","ai","type"}, …], …}}` — `data` is an **object keyed by album title** (a JSON **array** if the titles happen to be 0,1,2…, a PHP quirk the app must tolerate); `file_name` is `https://<server host>/storage/photo_video_gallary/<file>` for photos and the **raw stored link** for videos; items arrive newest first (`ORDER BY p.date_ DESC`, `:630`), but JavaScript reorders integer-like object keys, so the app orders albums itself. No data → `{"status":0,"message":"No Data Found"}`; missing parameter → `Parameter Missing`.
**Parsing (planned):** school info: a list of `{ content }` where content is the `description` text; gallery: flatten `data` (object or array) into items `{ album, title, file, date, type }` as plain text and group in the app. `No Data Found` (and only that message) is an **empty list** for the gallery; other validation messages are errors.

## 5. Student identity, session and academic year
- Token and ids come only from the session via F1; no id is read from route params, props or text input. In-screen guards as S1–S9: not a student → "Students only" and **no request**; no school year → "School year not set" and **no request** (school information does not need a year, but the shared guard keeps the behaviour uniform).
- The query keys carry the user id and year (and the action); the cache is cleared on sign-out; nothing is written to disk; no content is logged.
- **Academic year:** the gallery request carries `user.syear`; the server filters albums by year (`p.syear = s.syear`) and uses that year's enrolment, so the screen says "School year {syear}". School information is year-independent. These are legacy bare paths (no `api.session`), so there is **no "Academic Term Date Expired" state**.
- **Backend weakness (not fixable here):** the gallery takes `student_id` from the request with no ownership check; `schoolDetailAPI` accepts any tenant id (public information). The app sends only its own ids.

## 6. Data presentation and UX
**School information.** One screen component, nine registry names. Each name sends a **fixed action text** (the app never builds it from the tile's stored fields):
| `screen_name` | `action` sent |
|---|---|
| `about_us` | `About Us` |
| `principal_desk` | `Principal Desk` |
| `school_information` | `School Information` |
| `achievement` | `Achievement` |
| `school_timing` | `School Timing` |
| `rules` | `Rules` |
| `facility` | `Facility` |
| `acadamic_activity` | `Academic Activity` |
| `reach_us` | `Reach Us` |
(From Flutter `student_screens.dart:57-66`; the exact stored `type` text per school is **[ASSUMPTION]** — the server compares with `=` after `ucfirst`, `schooldetailController.php:215-222`, which MySQL's default collation treats case-insensitively. A school that stored a different wording gets the empty state, never an error.) The content is **HTML** written by the school: it is shown as **plain text** via `stripHtml` (headings, paragraphs and list items become lines/bullets; images, tables' layout, colours, fonts and link targets are lost) with `http(s)` URLs that appear in the text made tappable by the S1 `LinkedText` rule (opens in the phone's browser; `javascript:`, `tel:`, `intent:`, credentials never). Several rows are shown one under another. The page title is the tile's own title.
**Photo gallery.** Album list (title, number of photos, date of the newest item), albums ordered by their newest item. Opening an album shows its photos newest first, in a 2-column grid, 24 at a time with "Show more". A photo's thumbnail is the photo itself (S10-D4); tapping it opens the full-size photo through `Linking.openURL` after `safeAttachmentUrl` (the server host is re-based onto the configured API host; anything else is refused and shown as "Photo can't be opened from the app" with no image request).
**Video gallery.** Same album list; inside an album each video is a card with its title, date and an **Open video** button. `file_name` is a raw link (normally YouTube): it opens only if it passes `isSafeHttpUrl` (plain `http(s)`, no credentials) and only in the phone's browser/YouTube app. **No third-party thumbnail is requested** (the Flutter app fetched YouTube thumbnails; S10 does not contact any third party).
| State | UI |
|---|---|
| loading, no data | existing `Loading` |
| error, no data | `ErrorState` + Try again (F1 messages) |
| `Parameter Missing` | the server message + Try again |
| empty — school page | `EmptyState` "Nothing published yet" — "Your school has not added this page yet." |
| empty — gallery | `EmptyState` "No photos for your class yet" / "No videos for your class yet" (`No Data Found`) |
| error while cached | content stays + banner "Couldn't refresh — showing the last loaded data." |
| a link / photo cannot be opened | inline notice: "Couldn't open the file. Please try again or contact your school." |
| a photo thumbnail fails to load | a neutral placeholder box with the photo's title; the open button stays |
| `syear` missing / not a student | "School year not set" / "Students only"; no request |
| **classwork gallery tile** | `EmptyState` "This isn't available in the app yet." — "Please ask your school." **No request** (S10-D6) |
**Stale data:** school pages are cached 5 minutes like the other student reads; galleries 5 minutes. **Accessibility:** each album and photo is one group with a spoken sentence; thumbnails carry the photo title as their accessibility label; Open buttons ≥ 44 dp; status is words.

## 7. Navigation and tile integration
Registry: the nine school-information names → one `SchoolInfoScreen` configured by name; `photos_gallery` and `video_gallery` → `GalleryScreen` (photo/video mode); `classwork_gallery` → the existing `RecordUnavailableScreen` (S9). Screens ignore the tiles' stored `api`. Removing an entry restores today's fallback.

## 8. Security and privacy
- **Class photos show children.** Gallery content is shown only to a student of that class, held in the query cache (cleared on sign-out) and never logged. The app adds no share, save-to-gallery, export or download control. The photo **thumbnails are fetched by React Native's built-in `Image`**, whose native loader keeps its own memory/disk image cache that the app cannot switch off from JavaScript; that is a limit of the platform, stated openly (S10-D4 offers the alternative of no in-app images).
- **Links leave the app.** Photos open via `safeAttachmentUrl` (ERP host allow-list, re-based, credentials/`file:`/`javascript:`/`intent:` refused); video and in-text links via `isSafeHttpUrl`. The photo URLs are **public and unauthenticated** (`/storage/photo_video_gallary/…`); a backend limit.
- **No HTML is rendered.** School text is flattened by `stripHtml` and drawn as `<Text>`; scripts and styles are removed; `<img>` and `<iframe>` do nothing.
- **No third party is contacted** (no YouTube thumbnails, no maps).
- **Never called:** the classwork endpoint (credential exposure), every staff/CRUD route in §3. A local and a unit test assert that only the two read URLs are requested.
- **Identity:** session-only (F1); per-user cache; in-screen guards.

## 9. Dependencies
| Reused | From | Used for |
|---|---|---|
| `legacy.post` (form-encoded identity block + one `action` field, `type=API`, text-first parsing, `status`/`status:'2'`/401/419/500 mapping) | F1 | the requests |
| `useStudentQuery`, `studentGate`, `StaleBanner` | S1 | guards, loading, error + retry, stale banner, cache |
| `safeAttachmentUrl`, `isSafeHttpUrl`, `LinkedText`, `Linking.openURL(...)` pattern | S1, S3, S5, S7, S9 | links |
| `stripHtml`, `cleanText`, `toDateKey`/`displayDate`, 30-row batches | S4a, S7, S1 | text, dates, paging |
| `RecordUnavailableScreen` | S9 | the classwork tile |
No dependency on S2/S5a/S6a code. No new package: the built-in `Image` is used.

## 10. Backend limitations and known defects (for the owners; not to be fixed in this migration)
1. **Credential exposure in `front_desk/send_attachment/create`** (`classworkAttachmentController.php:113`; models without `$hidden`, `tbluserModel.php:13-40`): every classwork row embeds the creating and updating staff users' complete records (including `password` and `plain_password`) and the complete student record. The same endpoint backs the **staff** web report, so staff browsers receive these too. This is the most serious finding of the migration so far and should be fixed independent of the mobile app: select only the needed columns, or define `$hidden` on the user and student models.
2. The same endpoint **lists every student's classwork** when `student_id` is omitted (`:119`), and trusts a request-supplied `student_id` otherwise.
3. **Aliases swapped** in `schoolDetailAPI` (`type as title, title as description`, `:220`); content is raw HTML; the action wording must equal the stored `type`.
4. **No ownership check** on the gallery; photo URLs are public; videos are raw third-party links; `data` is an object keyed by album title (a JSON array when titles are 0,1,2… — keys that look like integers are also reordered by JavaScript).
5. `schoolDetailAPI` returns any tenant's pages to any valid token.
**Backend asks:** restrict the classwork response to the columns the screen needs and require a `student_id` (from the token for students); add `$hidden` for `password`, `plain_password`, `otp` on the user model; return the gallery as an ordered list of albums; serve photos through an authenticated route.
**Consequence for the plan:** S10a is not known to be affected by any defect that makes it fail. What cannot be known without real data (Q16): the real wording of `school_detail.type` per school, the HTML in real pages, how many albums/photos a class has, and whether photos and links resolve.

## 11. Exact files expected to change (all under `D:/lms_k12_mobile_rn`)
**Modified (2 — additions only):** `src/api/student.ts` (append `fetchSchoolDetail(action)`, `fetchGallery(kind)`, row types, `NO_GALLERY_MESSAGE`), `src/screens/registry.ts` (+ 12 entries: nine school-information names, `photos_gallery`, `video_gallery`, `classwork_gallery`).
**New (src):** `screens/student/schoolInfoModel.ts` (action map, text), `galleryModel.ts` (flatten object/array, group, order, link states), `SchoolInfoScreen.tsx`, `GalleryScreen.tsx`, `hooks/useSchoolInfo.ts` (+ gallery hook).
**Tests:** `schoolInfoModel`, `galleryModel`, `studentSchoolInfoApi` (both fetchers), `SchoolInfoScreen`, `GalleryScreen`, `studentSchoolInfo.local` (opt-in), plus `registry.test.ts` (thirty-four names).
No `package.json`, native, Laravel or Next.js change; no new library; S1–S9 behaviour unchanged.
**Build order (one at a time, each tested before the next):** school information (all nine) → photo gallery → video gallery → the classwork unavailable state.

## 12. Tests and acceptance criteria
**Models:** the nine action texts exactly (and that an unknown screen name has none); content → plain text (tags, scripts/styles removed, entities decoded after stripping, long input fast, empty → empty state), URLs in text become links only for plain `http(s)`; several rows kept in order; gallery: `data` as an object **and** as an array, integer-like album titles, album order by newest item, items newest first, missing/blank album title → "Album", counts, unreadable dates last; photo link states (ready re-based / none / unsafe, nine unsafe forms), video link states (`isSafeHttpUrl`, credentials/`javascript:`/`intent:`/`file:`/`tel:` refused, empty → none); 24-item and 30-row batches.
**API:** each path, **form-encoded** with the identity block **plus only the `action` field**, Bearer, `type=API`, session identity even if a caller passes another; success mapping (swapped aliases read correctly); both gallery shapes; `No Data Found` → empty (other validation messages stay errors); `Parameter Missing`; 401 and HTTP 200 status `2` → unauthorized; 419; 500 HTML; network; **only the two read URLs are ever requested — never `front_desk/send_attachment`, `classwork`, `TeacherFetchData`, `get_admin…`, `add_admin…`, `front-desk`, `school_detail` resource, add/update/delete**.
**Components:** per screen — loading; content; empty; errors + Try again; `Parameter Missing`; stale banner; guards (no request for a non-student); per-user cache; the tile's stored `api` ignored; text links open once via `Linking`, unsafe ones are plain text; gallery: albums → album → photos, thumbnails use only validated URLs and no image is requested for an unsafe one, thumbnail failure → placeholder, Open photo/video opens once, open failure → inline notice, **no share/save/download/upload control, no third-party request**; the classwork tile makes no request; `registry` — thirty-four names.
**Regression:** all 814 existing tests pass; typecheck clean.
**Acceptance:**
1. The twelve tiles open their dedicated screens; removing a registry line restores today's behaviour.
2. Every §6 state is reachable and correct; nothing hidden; ordering rules hold.
3. Requests are form-encoded with the session's own ids, `type=API` and the fixed action; no request for a non-student or without a year; only the two read URLs are ever called.
4. No upload, delete, share, save or download control; no third-party contact; HTML never rendered as markup.
5. `npm run typecheck` and `npm test` pass; no native/package change.
6. Local synthetic-id checks pass (§13); the real-data check is **not** claimed.

## 13. Local-server verification plan (synthetic ids only — Q16)
Same setup as S1–S9: `php artisan serve --host=127.0.0.1 --port=8000`, JWT signed locally. An opt-in, loopback-only test `studentSchoolInfo.local.test.ts` drives the real client and fetchers over real HTTP: `fetchSchoolDetail('About Us')` for a **non-existent tenant** → `[]` (so no real school content is read); both gallery kinds for a **non-existent student** → `[]` (the server's "No Data Found"); a bad token → `unauthorized`; the requests are only the two read paths, each with the Bearer token, `type=API` and the right `action`; the classwork path and every staff path are never requested. Already done for this document: the curl results in §3. **Cannot be verified without real data (Q16):** real page wording and HTML, album sizes, photo/video links.

## 14. Device / coordinated-pass additions
For the later pass: school pages at 360 dp (long text, bullets, links), the album list and 2-column photo grid (thumbnail loading, failure placeholder, memory with 24+ photos), opening a photo and a video in the browser/YouTube and returning, the behaviour with no viewer installed, pull-to-refresh, and the error/empty/unavailable states.

## 15. Rollback
Delete the twelve lines in `src/screens/registry.ts` (the tiles fall back to `GenericDataScreen`, today's behaviour) or `git revert` the S10 commit; the additions to `student.ts` are additive and unused afterwards; F1 and S1–S9 are unaffected. JS-only; no server or data change; nothing is written anywhere.

## 16. Decisions and questions (answered 2026-10-07: Q36 option A; Q37 yes with D4(b) — no in-app images; Q38 classwork backend security ask written separately; Q16 still open)
- **Q36 / S10-D1 — scope.** **Option A (recommended):** build school information (nine pages), the photo gallery and the video gallery, plus the "not available" state for the classwork tile, in the order in §11. **Option B:** school information and video gallery only (no in-app images — see D4). **Option C:** do not build S10 now; record it as pending and move to S8.
- **Q37** Confirm S10-D2…D7:
  - **D2** legacy read endpoints only; fixed action texts; screens ignore the tiles' stored `api`;
  - **D3** school pages as plain text from the HTML, with `http(s)` URLs tappable (S1 link rule); images, tables' layout and link targets are lost;
  - **D4** **photo thumbnails:** *(a, recommended)* show them in the app with the built-in `Image` from validated ERP URLs — the platform's own image cache applies and cannot be disabled from JavaScript; *(b)* no in-app images: albums list photo titles and each opens externally. Choose (b) if you want the strict "no caching" stance used for health data;
  - **D5** videos are links only, opened in the phone's browser, no third-party thumbnails;
  - **D6** the classwork gallery tile shows "This isn't available in the app yet." and makes no request, because the endpoint exposes staff passwords (§3, §10.1);
  - **D7** no share/save/download/upload anywhere in S10; albums ordered by newest item; school year shown for galleries, none for school pages.
- **Q38** The classwork credential exposure (§10.1) is serious and independent of the app. Say if you want it written up as a separate backend ask now (like the S9 one); I would not modify Laravel.
- **Q16 stays open** — no real student data.

## 17. What was actually done (2026-10-07)
Built as approved (Q36 option A in the order school information → photo gallery → video gallery → classwork unavailable state; Q37 S10-D2…D7 yes with **D4(b)**, the strict no-image approach; Q38 the classwork backend security ask written separately, no Laravel change). **Strictly view only**: no upload, delete, share, save, download or comment control exists; no write, staff, admin, `front_desk`, HR or classwork endpoint is ever contacted. Everything is **uncommitted** on branch `migration/s10-school-info-galleries` (created from `migration/s9-my-records`); you will review and approve the commit separately.

### Files (all under `D:/lms_k12_mobile_rn`)
**Modified (2 source files — additions only: +94 lines, 0 removed; S1–S9 code is untouched)**
| File | Change as built |
|---|---|
| `src/api/student.ts` | appended `fetchSchoolDetail(action)`, `fetchGallery(kind)`, `flattenGallery()` and the `SchoolDetailRow` / `GalleryItem` types, `NO_GALLERY_MESSAGE` |
| `src/screens/registry.ts` | + the nine school-information names, `photos_gallery`, `video_gallery`, `classwork_gallery` (→ `RecordUnavailableScreen`) |
**New (src, 5):** `screens/student/schoolInfoModel.ts` (action map, text), `galleryModel.ts` (albums, ordering, link states), `SchoolInfoScreen.tsx`, `GalleryScreen.tsx` (photo and video), `hooks/useSchoolInfo.ts`.
**Tests (new, 6):** `schoolInfoModel`, `galleryModel`, `studentSchoolInfoApi`, `SchoolInfoScreen`, `GalleryScreen`, `studentSchoolInfo.local` (opt-in); `registry.test.ts` extended (thirty-four names + the S10 mapping).
**Docs (new):** [backend-asks/S10-classwork-credential-exposure.md](../backend-asks/S10-classwork-credential-exposure.md) — the separate backend security ask (Q38); a document only.
No `package.json`, native, Laravel or Next.js change; **no new package**. `studentGate`, `StaleBanner`, `LinkedText`, `safeAttachmentUrl`, `isSafeHttpUrl`, `stripHtml`, `applySortKey`, `cleanText`, `LIST_PAGE_SIZE`, `RecordUnavailableScreen` and the UI kit were reused unchanged. The Laravel working tree still holds exactly its four earlier changes.

### Deviations from the plan / from S10-D2…D7 (all small; none weakens a decision)
1. **D4(b) as approved — no photo is rendered.** The plan's 2-column thumbnail grid is replaced by a text list: an album card (title, count, newest date) that expands to the photos' titles and dates, each with **Open photo**. The screens import no `Image` and no image library, and a test scans the code to prove it (below).
2. **Albums per page and photos per album are both 30 at a time** (the plan said 24 photos because of thumbnails).
3. **Album order is fully specified and tested:** newest item first; ties by title (case-insensitive), then first appearance; albums with no readable date last — independent of how the server's object keys are listed (including the integer-key reordering quirk).
4. **An album's title comes from each item's `album_title`;** the object key is only the fallback, and a missing title is "Album".
5. **A school-information tile whose screen name has no action text** shows "This isn't available in the app yet." / "Please ask your school." and makes no request (the plan did not say what that case shows). The pages draw no title of their own — the navigation header already shows the tile's title.
6. **Hooks share one file** (`useSchoolInfo.ts`: school page and gallery).
7. **The opt-in local test needs a second token** for a non-existent tenant, so that the school-wide pages are read for a tenant that has none (no real school content is read).
8. **`flattenGallery` is exported** from `student.ts` so both response shapes are tested directly.

### Requirements from your reply — how each is met
| Requirement | Result |
|---|---|
| no `Image`; no intentional caching or persistence of photos | no `Image` / `expo-image` / file-system / storage / sharing / `console` / `fetch(` in any S10 code (a test strips comments from the five S10 source files and asserts none appears); rendering and opening are tested with `fetch` spied: the app fetches nothing itself |
| photos open externally only after URL validation | `photoLink` → `safeAttachmentUrl` (ERP host allow-list, re-based onto the API host); tests: 5 unsafe forms rendered without a button and with "Photo can't be opened from the app"; nine unsafe forms in the model test |
| videos are external links only, no third-party thumbnails | `videoLink` → `isSafeHttpUrl`; opens in the phone's browser/YouTube; no image and no third-party request (spied) |
| no download, save, share | no such control (text scan of the rendered screen + allowed-button check) |
| school information via `schoolDetailAPI`, backend field behaviour preserved | `title` read as the page type and `description` as the HTML content; HTML flattened to plain text; only `http(s)` URLs in the text are tappable (`javascript:`, `tel:`, `intent:`, `file:`, credentials stay inert); empty/missing content shows the empty state, nothing invented |
| both album response shapes | object keyed by album title **and** numeric-key array (tested in the model and the API layer) |
| deterministic album ordering | §deviation 3, tested |
| classwork unavailable, exact text, endpoint never called | `RecordUnavailableScreen`: "This isn't available in the app yet." / "Please ask your school."; no query, no `fetch`; the server log of the local run has **0** `send_attachment` hits |
| no response bodies or sensitive data logged | no `console.*`; a test asserts no album/photo text reaches `console.log/info/warn/debug` |
| JWT / authenticated requests; synthetic ids only | every request is the F1 legacy call with the Bearer token and `type=API`; synthetic student and tenant only |

### Tests (Jest) — typecheck clean; full suite: **916 passed, 0 failed, 36 skipped** (the nine opt-in local suites) — S10 added 102 passing tests (was 814)
| Suite | Covers |
|---|---|
| `schoolInfoModel.test.ts` (8) | the nine exact action texts; unknown/empty/inherited names (`constructor`, `__proto__` …) have none; HTML → plain text; the swapped page type is ignored; scripts/styles removed, encoded tags stay text; URLs stay as text; empty rows dropped, order kept; 200 000-tag input fast |
| `galleryModel.test.ts` (28) | both shapes (object, numeric-key array), junk skipped, field mapping; **ordering** (newest album first, integer-like titles ordered by date, ties by title, undated last, deterministic, no mutation, items newest first); defaults for missing titles, unique keys; photo links (ready re-based, none, ten unsafe forms); video links (https/http ready, credentials/`javascript:`/`intent:`/`file:`/`tel:`/`vnd.youtube:`/bare id unsafe); the right rule per kind |
| `studentSchoolInfoApi.test.ts` (21) | for the school page and each gallery kind: authenticated form-encoded call = identity block + only `action`, `type=API`, session identity; only its own URL requested (never classwork / `front_desk` / `TeacherFetchData` / admin / school_detail / write); 401 and HTTP 200 status `2` → unauthorized; `Parameter Missing`; 500 HTML; 419; network; school page field mapping and nulls; both gallery shapes; `No Data Found` → empty while other validation messages stay errors; junk → empty |
| `SchoolInfoScreen.test.tsx` (24) | loading → plain text; **each of the nine pages sends its exact action**; tile `api` ignored (even a classwork URL); `http(s)` link tappable once, inert `javascript:`/`tel:`/`intent:`/`file:`, credentials not a link; several rows; empty/missing content → empty state; view only; 401; server error + Try again; `Parameter Missing`; stale banner; guards; per-user cache; unknown screen name → message, no request |
| `GalleryScreen.test.tsx` (20) | albums by newest item; opening an album lists titles with **no image role**; Open photo opens the re-based URL once and the app fetches nothing; five unsafe photo links; no-file item; open failure; 30 per album; empty state; tile `api` ignored; 401 / server error + Try again / `Parameter Missing` / stale banner; guards; per-user cache; videos (kind, count, Open video once, six unsafe forms, empty); **no share/save/download/upload, no console output, no image/storage/file-system/console/fetch in the S10 sources**; the classwork tile shows the exact message and contacts nothing |
| `registry.test.ts` | the S10 mappings; thirty-four names |
| existing suites | all unchanged and passing |

### Acceptance criteria (§12, adjusted for D4(b))
| # | Criterion | Result |
|---|---|---|
| 1 | the twelve tiles open their dedicated screens; removing a registry line restores today's behaviour | ✅ registry test; ⚠️ not seen on a device |
| 2 | every §6 state reachable and correct; nothing hidden; ordering holds | ✅ tests |
| 3 | form-encoded with the session's own ids, `type=API` and the fixed action; only the two read URLs | ✅ tests (API, screens, local) |
| 4 | no upload/delete/share/save/download; no third-party contact; HTML never markup; no `Image` | ✅ code and tests |
| 5 | typecheck and tests pass; no native/package change | ✅ |
| 6 | local synthetic-id checks pass; real-data check **not** claimed | ✅ synthetic ids only |

### Verification against the local server (read-only, synthetic ids only — Q16)
`php artisan serve --host=127.0.0.1 --port=8000`; JWTs signed locally for a **non-existent student `999999999` on tenant `1`** (galleries) and for that student on a **non-existent tenant `999999999`** (school pages, so no real school content is read). The opt-in test drives the **real client and fetchers over real HTTP**: **4/4 passed** — all nine school pages return `[]` for the non-existent tenant; both gallery kinds return `[]` (the server's "No Data Found") for the non-existent student; a bad token is `unauthorized` on each; only `/studentPhotoVideoGalleryAPI` and `/schoolDetailAPI` are requested, each with the Bearer token, `type=API` and the right `action`. The server log shows only those two paths, and **`send_attachment` appears 0 times**: the classwork endpoint was never contacted during the S10 flow. Server stopped afterwards (port 8000 free). (The single probe of the classwork endpoint with a synthetic student id, made while researching §3, was before the build and never repeated; its only purpose was to see the response shape.) No real student data and no real school content was read.

### Known limitations
- **No real data was read** (Q16): the real wording of `school_detail.type` per school, the real HTML of the pages, album sizes, and whether photo/video links resolve are verified **from code only**. A school that stored a different page-type wording gets the empty state, never an error.
- **Not run on a device or emulator**: layout at 360 dp, long school text, the expand/collapse feel, and the hand-off of a photo/video to the browser/YouTube are asserted by tests, not observed (checklist in §14, minus thumbnails).
- **Photos are not shown inside the app** (D4(b)); a student sees titles and dates and opens each photo in the phone's viewer. When the phone's viewer loads a photo, that browser/viewer applies its own cache; the app does not control it.
- **School text loses formatting** (images, tables, colours, link targets); only URLs written in the text are tappable.
- **Backend defects, not worked around and not fixed:** the classwork endpoint's credential exposure (see the backend ask); no ownership check on the gallery; public photo URLs; any valid token can read any school's pages; the `title`/`description` aliases are swapped; `data` is an object keyed by album title (or an array).
- **Current school year only** for galleries; school pages are year-independent.

### Rollback
1. Delete the twelve lines in `src/screens/registry.ts` (the tiles fall back to `GenericDataScreen`, today's behaviour), or `git revert` the S10 commit once it exists. 2. The additions to `student.ts` are additive and unused afterwards; F1 and S1–S9 are unaffected. 3. JS-only; no server or data change was made, and nothing is stored on the device.

