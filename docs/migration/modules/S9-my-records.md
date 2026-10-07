# S9 — My records (student health, care, transport and certificates)

Status: **S9a DONE** (signed off 2026-10-07) — seven view-only record lists and the unavailable state for hostel and achievement certificate implemented, tested, verified locally with synthetic ids only. Document approved 2026-10-07 (Q33 option A; Q34 S9-D2…D11 yes with the health-data requirements; Q35 backend ask written separately). Stricter health-data handling approved at sign-off (no console logging, no persistent storage, no share/export, `gcTime: 0`, cache dropped on unmount). Real-data check intentionally not done (Q16 open); device check deferred to the coordinated pass. **S9b (hostel, achievement certificate) stays blocked on the backend.**
Class: **V1** (seven lists) · **V1-blocked** (two tiles) · Role: Student · Next in the approved build order (03 §5: … S7 → **S9** → S10 → S8 → S13) · Depends on: **F1** (done — form-encoded legacy requests, `type=API`, `status` and `status_code` envelopes), **S1** (done — student gate, per-user query hook, stale banner, `safeAttachmentUrl`, `isSafeHttpUrl`), S3/S5/S7 (done — the "open a file with `Linking`" pattern, 30-row batches, `StatusPill`), S6a (done — `formatInr`), S4a (`stripHtml`). · Decisions: D-03, D-09, D-13, D-14, D-17.
Facts cite file:line. `ev:` = [evidence/](../evidence/README.md). **[ASSUMPTION]** = not read from code. **[VERIFIED-LOCAL]** = observed on the local Laravel server on 2026-10-07 using only a **non-existent student (`999999999`, tenant `1`)** — **no real student data was read** (Q16). **[VERIFIED-NO-DB]** = checked by reading code. Only read endpoints were called.

## 0. Scope map — what is proposed, what is blocked
Nine student tiles show a student's **own records**. All nine are **read-only lists** in every client that exists (Flutter `records.dart`, ev:flutter_ref.md lines 105-118): **no student write endpoint exists** for any of them (the add/edit/delete screens are staff-only, §2). Seven work with a token; two cannot work at all for a token-only caller.
| Part | Tile (`screen_name`) | Endpoint | Tenants (of 34) | Proposed? |
|---|---|---|---|---|
| S9a.1 | Height & Weight (`height_weight`) | `studentHWAPI` | 13 | **Yes** |
| S9a.2 | Vaccination (`student_vaccination`) | `studentVaccinationAPI` | 12 | **Yes** |
| S9a.3 | Health Details (`health_details`) | `studentHealthAPI` | 12 | **Yes** |
| S9a.4 | Infirmary (`student_infirmary`) | `studentInfirmaryAPI` | 13 | **Yes** |
| S9a.5 | Consent (`student_consent`) | `consentListAPI` | 12 | **Yes** |
| S9a.6 | Transport (`student_transport`) | `studentTransportAPI` | 14 | **Yes** |
| S9a.7 | Certificate (`student_certificate`) | `studentCertificateAPI` | 11 + 9 (two tiles, same screen name) | **Yes**, text-only (S9-D7) |
| S9b.1 | Hostel (`student_hostel`) | `studentHostelAllocationAPI` | 11 | **No — broken for token callers** (§3, §10). The tile shows "not available in the app yet" instead (S9-D10) |
| S9b.2 | Achievement Certificate (`achievement_certificate`) | `document_details` (GET) | 7 | **No — broken for token callers** (§3, §10). Same message |
All nine are **view only** by nature. Nothing in S9 creates, edits, deletes, signs, consents, uploads or pays. The consent list has **no "give consent" action** (none exists for students); the screen only shows what the school recorded.
S9 is the **most sensitive module so far**: infirmary, health, vaccination and height/weight records are children's health data (§8).

## 1. What the student will be able to do
Open any of the seven tiles and see the student's **own** records, newest first, as read-only cards; pull to refresh. Each screen says nothing can be changed here ("Records are added by your school."). Where a record has a document (health) or a bus-tracking link (transport) it opens only in the phone's browser/viewer after a link check.

## 2. Existing screens and Laravel endpoints (evidence)
| Source | Finding |
|---|---|
| **Web (D:/lms_k12)** | **No student-facing screen; the web pages are staff data entry.** `app/student/student_health/page.tsx:1-8`, `student_vaccination/page.tsx:1-8`, `student_hw/page.tsx:1-8` mount `StudentCareModule` (search a student, then add/edit/delete records: doctor, contact, date, remarks, file/height/weight/type/note); `student_infirmary/page.tsx` (330 lines, list/save/delete/search students); `student_certificate/page.tsx` mounts `StudentCertificateModule` ("issue" mode); transport and hostel pages are mapping/masters (`app/Transportation/*`, `app/hostel`). Searched `app`, `lib`, `components` for `studentHealthAPI`, `studentHWAPI`, `studentInfirmaryAPI`, `consentListAPI`, `studentVaccinationAPI`, `studentCertificateAPI`, `studentTransportAPI`, `studentHostelAllocationAPI`, `document_details`: **no consumer**; none of those pages checks `isStudent`. So S9 is **mobile-only**, on the legacy mobile contract. |
| **Production menu** (read-only SELECT on `mobile_homescreen`, 2026-10-07; ev:menu_tiles.txt) | lines 14 (achievement_certificate, 7), 29 (health_details, 12), 41 (student_transport, 14), 42 (height_weight, 13), 43 (student_infirmary, 13), 44 (student_consent, 12), 45 (student_vaccination, 12), 46 and 54 (student_certificate, 11 + 9), 47 (student_hostel, 11); each stores the endpoint above as its `api`. (Admin rows 105-108 are `webview` pages for staff.) |
| **Flutter** (reference only) | `records.dart:26-182`: the same eight POSTs and the GET, all read-only; certificate shows `certificate_html` through an HTML widget (`info.dart:49`); achievement certificate sends `document_type='59'`. Its docs say its endpoints were never run live (ev:flutter_ref.md). |
| **Current RN app** | the tiles fall back to `GenericDataScreen`: JSON body, `api_param` pasted in as one malformed key (`helpers.ts:10-21`), **no student id** — so every one answers "Parameter Missing" (or, for the GET route, 405 then an error). Nothing useful is shown today. |
**Backend (read in full 2026-10-07, read-only):**
| Endpoint | Route | Method | Auth / identity | Envelope |
|---|---|---|---|---|
| `POST studentHWAPI` | `routes/student.php:197` | `studentHWController::studentHWAPI` `:178-` | JWT **always** checked (`:182`; the other six at `student.php`-routed controllers likewise: vaccination `:183`, infirmary `:404`, consent `:160`, transport `lms_apiController.php:775`, health and certificate at the top of their methods); `student_id`, `sub_institute_id`, `syear` from the **request**; no ownership check | `status_code` |
| `POST studentVaccinationAPI` | `student.php:196` | `studentVaccinationController` `:179-` | same | `status_code` |
| `POST studentHealthAPI` | `student.php:181` | `studentHealthController` `:212-` | same, but **`syear` is not required or used** (all years) | **`status`** |
| `POST studentInfirmaryAPI` | `student.php:195` | `studentInfirmaryController` `:400-` | same | `status_code` |
| `POST consentListAPI` | `routes/consent.php:14` (outside the `session`/`check_permissions` group) | `consent_masterController` `:156-` | same | `status_code` |
| `POST studentTransportAPI` | `routes/lms.php:364` | `lms_apiController` `:772-` | same | **`status`** |
| `POST studentCertificateAPI` | `student.php:188` | `studentCertificateController` `:216-` | same | `status_code` |
| `POST studentHostelAllocationAPI` | `student.php:187` | `tblhostelRoomAllocationController` `:392-` | JWT checked, but **`sub_institute_id` is read from `session()`** (`:406`), which a token-only caller does not have | `status_code` |
| `GET document_details` | `student.php:250` | `studentTransferController::DocumentTypeDetails` `:538-575` | **no JWT**; also reads `sub_institute_id` from `session()` | `status_code` |
| Staff CRUD: `student-care/{module}`, `student-infirmary` (`routes/adminapi.php:109-117`), `front_desk`/`student/*` web routes, `consent/*` resources (`routes/consent.php:9-11`), certificate issue/generate (`studentCertificateController` other methods) | various | staff modules | tenant from the request; create/update/delete | — |
**No modern, student-token-bound API exists** for any of these (the only modern routes are the staff CRUD above).

## 3. Which API (S9-D2): legacy read endpoints; which to leave alone
| Endpoint | Verdict | Why |
|---|---|---|
| the seven list endpoints (§0) | **Use** | the production tiles' own contracts; read-only; parameterised query-builder SQL; **the JWT is checked on every call** (**[VERIFIED-LOCAL]** a call with `type=API` and no token was refused with 401 on four of them; the code shows the same unconditional check on all seven) — unlike the S7 leave/message lists there is no unauthenticated variant. The app always sends the Bearer token and `type=API`. |
| `studentHostelAllocationAPI` | **Do not use — blocked** | **[VERIFIED-LOCAL]** answers `{"status_code":0,"message":"Parameter Missing"}` for any token because the school comes from `session()` (`tblhostelRoomAllocationController.php:406`). No safe workaround exists (D-17): the app cannot create the missing web session, and sending the tenant elsewhere does not change what the controller reads. Backend ask in §10. |
| `GET document_details` | **Do not use — blocked** | **[VERIFIED-LOCAL]** `{"status_code":0,"message":"Sub Institute Id is Required"}`; no JWT check; `sub_institute_id` from `session()`; GET-only. Backend ask in §10. |
| modern `student-care/*`, `student-infirmary/*` (staff CRUD) | **Never** | create/update/delete; tenant from the request; `index` lists every student's records in the tenant. |
| `consent/*` resources, certificate issue/generate, `front_desk`/`student/*` web routes | **Never** | staff screens and writes. |
A test asserts that S9 touches only the seven read URLs (§12).

## 4. API contracts (all through F1's `legacy.post`: form-encoded, identity block from the session, Bearer header, `type=API`; **no extra fields**)
Required non-empty: `student_id`, `sub_institute_id`, `syear` (health: only the first two), else HTTP 200 `{"status[_code]":0,"message":"Parameter Missing"}`. **Observed [VERIFIED-LOCAL], synthetic student, real tenant, year 2026:** all seven answered `200 text/html` with `{"status[_code]":1,"message":"Success","data":[]}`; with `type=API` and no token → `401 {"status":"2","message":"JWT token is required.","data":[]}` (checked on health, certificate, consent and hostel); missing `student_id` (health) / `syear` (height-weight) → `Parameter Missing`; a JSON body works for certificate (the controllers read `$request->input`).
Success rows (from code; **not observed with data — Q16**):
| Part | Row fields the app reads (everything else is ignored) | Notes |
|---|---|---|
| HW `:178-` | `id, doctor_name, doctor_contact, height, weight, date` (`d-m-Y`) | server `ORDER BY date` ascending; no units sent |
| Vaccination `:179-` | `id, doctor_name, doctor_contact, vaccination_type, note, date` (`d-m-Y`) | `ORDER BY date` ascending |
| Health `:212-` | `doctor_name, doctor_contact, remarks, date` (`d-m-Y`), `file` | `file` is **always a URL**: `…/storage/frontdesk/<file>`, or `…/storage/frontdesk/noimages.png` when there is no file (`:240-246`) — the placeholder must be treated as "no file"; `ORDER BY date` ascending; envelope `status` |
| Infirmary `:400-` | `id, doctor_name, doctor_contact, medical_case_no, date, complaint, symptoms, disease, treatments, medical_close_date, health_center` (`d-m-Y`) | no ORDER BY |
| Consent `:156-` | `ID, title, consent_date` (`d-m-Y`), `accountable_status, consent_status, amount` | `imprest_head_id` and `created_by` (internal ids) are **dropped**; the SQL `if(status = NULL,'Pending',status)` is never true in SQL, so a pending consent arrives as `null` — the author's intent is "Pending"; no ORDER BY |
| Transport `:772-` | `id, from_shift, from_bus, from_stop_name, to_shift, to_bus, to_stop_name, gps_link` | six INNER JOINs: a student with only a pick-up **or** only a drop is not listed at all; `gps_link` omitted when empty; envelope `status` |
| Certificate `:216-` | `id, certificate_type, certificate_number, certificate_html, created_at` | the controller returns every column (`:236-239`); the table has only these columns plus tenant/year/student (migration `2023_03_05_115658`); no ORDER BY |
**Parsing:** each fetcher returns a list of plain-text rows (nulls → `''`); a non-list `data` is an empty list; the HTML of a certificate is kept as text for `stripHtml` only. `Parameter Missing` is an error state. No field is parsed into a number except where noted (§6).

## 5. Student identity, session and academic year
- Token and ids come only from the session via F1; no id is read from route params, props or text input. In-screen guards as S1–S7: not a student → "Students only" and **no request**; no school year → "School year not set" and **no request** (health does not need a year, but the shared guard keeps the behaviour uniform).
- The query key carries the user id and year; the cache is cleared on sign-out; nothing is written to disk; record text is never logged.
- **Academic year:** each request carries `user.syear`; HW, vaccination, infirmary, consent, transport and certificates are filtered by year on the server, so the screens say "School year {syear}". **Health records are not filtered by year** (all years): that screen says "All years". There is no year switcher. These are legacy bare paths (no `api.session`), so there is **no "Academic Term Date Expired" state**.
- **Backend weakness (not fixable here):** none of the endpoints checks that the student in the request is the token's student. The app only sends its own id.

## 6. Data presentation and UX
Every list: caption, then one card per record, newest first (S9-D3), 30 rows at a time with "Show more", plus the note "Records are added by your school." Dates are `d-m-Y` strings read with `toDateKey`/`displayDate` (raw text when unreadable, nothing invented). Empty/`null` text fields are simply not shown; a record is never dropped.
| Screen | Card | Order key |
|---|---|---|
| Height & Weight | date; "Height {height}" and "Weight {weight}" **as recorded, no unit added** (S9-D8); doctor | date, newest first |
| Vaccination | vaccination type (title), date, note, doctor | date |
| Health Details | date; remarks; doctor; **Open document** when `file` is a real file | date |
| Infirmary | date + complaint (title); symptoms, disease, treatments, health centre, case no., doctor, "Closed {medical_close_date}" when present, "Open" when not | date |
| Consent | title; status pill (`consent_status` as sent; empty → **Pending**); date; amount (`formatInr` when numeric, else the text as sent); accountable status | consent date |
| Transport | pick-up: shift, bus, stop; drop: shift, bus, stop; **Track bus** when `gps_link` passes the link rule (S9-D5) | server order (a student normally has one mapping) |
| Certificate | type (title), number, issue date (`created_at`), **"View text"** expands the certificate's text (S9-D7) | issue date |
**Doctor contact** is shown as plain text and is **not** tappable or dialled (S9-D6). **Health `file`** → `safeAttachmentUrl`, placeholder `noimages.png` (any case) = no file; unsafe link → "Document can't be opened from the app", row kept. **Transport `gps_link`** is a third-party tracking URL, not an ERP file: it uses the S1 rule `isSafeHttpUrl` (http(s) only, no credentials) and opens in the phone's browser.
**Certificates:** `certificate_html` is the full rendered certificate. The app has no HTML renderer (and adds none). "View text" shows `stripHtml` of it — tags, images, tables' layout and styling are lost — under the notice "Text version. For the official certificate, ask your school." (S9-D7). Nothing is rendered as markup; scripts and styles are removed by `stripHtml`.
| State | UI |
|---|---|
| loading, no data | existing `Loading` |
| error, no data | `ErrorState` + Try again (F1 messages) |
| `Parameter Missing` | the server message + Try again |
| empty | `EmptyState` "No {records} for school year {syear}" (health: "No health records") — "Records are added by your school." |
| error while cached | content stays + banner "Couldn't refresh — showing the last loaded data." |
| link cannot be opened | inline notice under the card: "Couldn't open the file. Please try again or contact your school." |
| `syear` missing / not a student | "School year not set" / "Students only"; no request |
| **hostel / achievement certificate tile** | `EmptyState` "Not available in the app yet" — "Please ask your school." **No request** (S9-D10) |
**Stale data:** 5-minute stale time. **Accessibility:** each card is one group with a spoken sentence; status is words; Open/Track/View text are ≥ 44 dp buttons.

## 7. Navigation and tile integration
Nine registry entries: `height_weight`, `student_vaccination`, `health_details`, `student_infirmary`, `student_consent`, `student_transport`, `student_certificate` (both certificate tiles) → dedicated screens; `student_hostel`, `achievement_certificate` → one small "not available" screen. Dedicated screens **ignore each tile's stored `api`** and call the fixed read endpoint. Removing an entry restores today's fallback for that tile. The seven lists share one `RecordListScreen` layout driven by a per-type configuration (the plan's "one generic record-list screen with per-type field maps"); each type has its own tested model.

## 8. Security and privacy
- **Children's health data.** Infirmary complaints/diseases/treatments, vaccinations, health remarks and body measurements are shown only to the signed-in student, kept in memory only (TanStack cache keyed by user, cleared on sign-out), never logged, never persisted, never put in a route param or URL, and never shared. The app adds no export, share, copy-all or screenshot control. (Blocking screenshots would need a native module; not proposed.)
- **Documents leave the app.** A health `file` is a **public, unauthenticated** URL (`/storage/frontdesk/<file>`, possibly a medical report). It opens only through `Linking.openURL` after `safeAttachmentUrl` (S1; ERP host allow-list, re-based onto the configured API host, credentials/`file:`/`javascript:`/`intent:` refused); no in-app viewer, **no download, cache, persistence or sharing**. The public URL itself is a backend limit.
- **Tracking link.** `gps_link` is opened only if it is a plain `http(s)` URL without credentials; it carries no token from the app.
- **Plain text only:** every field is rendered as `<Text>`; the certificate HTML is flattened by `stripHtml`, never rendered as markup.
- **Doctor phone numbers** are shown as text only, never as `tel:` links.
- **Identity:** session-only (F1); students cannot choose another `student_id`; per-user cache; in-screen guards.
- **Never called, by design:** every endpoint marked Never or blocked in §3. A local and a unit test assert that only the seven read URLs are requested.

## 9. Dependencies
| Reused | From | Used for |
|---|---|---|
| `legacy.post` (form-encoded identity block, `type=API`, text-first parsing, `status`/`status_code`/`status:'2'`/401/419/500 mapping) | F1 | the requests |
| `useStudentQuery`, `studentGate`, `StaleBanner` | S1 | guards, loading, error + retry, stale banner, per-user cache |
| `safeAttachmentUrl`, `isSafeHttpUrl`, `Linking.openURL(...)` pattern | S1, S3, S5, S7 | opening the health document and the tracking link |
| `StatusPill`, 30-row batches, `cleanText`, `toDateKey`/`displayDate` | S4a, S7, S1 | consent status, paging, dates |
| `formatInr` | S6a | the consent amount |
| `stripHtml` | S4a | certificate text |
No dependency on S2/S5a code. Not used: F5, any write code (none exists).

## 10. Backend limitations and known defects (for the owners; not to be fixed in this migration)
1. **`studentHostelAllocationAPI`** reads the school from `session()` (`tblhostelRoomAllocationController.php:406`) → always "Parameter Missing" for mobile tokens. **`document_details`** reads it from `session()` too, has no JWT check and is GET-only (`studentTransferController.php:538-575`). Neither can be used until they read the tenant from the token or request.
2. **No ownership check** on any of the nine (student id from the request).
3. **Public, unauthenticated document URLs** (health `file` under `/storage/frontdesk/`).
4. **Health records have no year filter** (`syear` is neither required nor used, `studentHealthController.php:232`).
5. **Transport INNER JOINs** hide students with only one direction mapped; **`gps_link`** is a third-party URL.
6. **Orders differ:** three lists come ascending by date, three have no ORDER BY; the app sorts newest first.
7. **Mixed envelopes** (`status` for health and transport, `status_code` for the rest); `consent_status` is `null` for pending because of a never-true SQL comparison; units for height/weight are not sent.
8. **`studentCertificateAPI` does `select *`** and returns the whole certificate HTML for every certificate on every call.
**Backend asks:** read the school from the token for hostel and `document_details`; derive the student from the token; serve documents through an authenticated route; add `ORDER BY` and a year filter to health; send units for height/weight; return `Pending` explicitly for consent.
**Consequence for the plan:** the seven lists are not known to be affected by any defect that makes them fail. What cannot be known without real data (Q16): real row shapes and values, the real height/weight units, whether health files resolve, how large certificate HTML is, and how many records a student has.

## 11. Exact files expected to change (all under `D:/lms_k12_mobile_rn`)
**Modified (2 — additions only):** `src/api/student.ts` (append seven fetchers, row types and a small shared record-list helper), `src/screens/registry.ts` (+ nine entries).
**New (src):** `screens/student/recordsModel.ts` (per-type row models: order, dates, text cleaning, status, amount, file/link state, placeholder detection, certificate text), `screens/student/RecordListScreen.tsx` (shared layout), seven thin screen files (`HeightWeightScreen.tsx`, `VaccinationScreen.tsx`, `HealthDetailsScreen.tsx`, `InfirmaryScreen.tsx`, `ConsentScreen.tsx`, `TransportScreen.tsx`, `CertificatesScreen.tsx`), `screens/student/RecordUnavailableScreen.tsx` (hostel and achievement certificate), and seven one-line hooks (`hooks/useStudentRecords.ts` exporting them).
**Tests:** `recordsModel`, `studentRecordsApi`, one screen test per list (seven), `RecordUnavailableScreen`, `studentRecords.local` (opt-in), plus `registry.test.ts` (twenty-two names).
No `package.json`, native, Laravel or Next.js change; no new library; S1–S7 behaviour unchanged.
**Build order (one at a time, each tested before the next):** height & weight → vaccination → health details → infirmary → consent → transport → certificates → the unavailable screen.

## 12. Tests and acceptance criteria
**Models (per type):** newest-first ordering (both date formats, unreadable last, ties keep the server order, no mutation); title/field fallbacks; `null`/blank fields omitted but the row kept; consent status (empty → Pending, other text as sent), amount (numeric → ₹, text as sent); health file states (real file → ready re-based; `noimages.png` any case → none; foreign/look-alike/credentials/`javascript:`/`file:` → unsafe, row kept); transport `gps_link` (https accepted, credentials/`javascript:`/`intent:` refused, empty → none); certificate text (tags, scripts/styles removed, entities decoded after stripping, long input stays fast, empty HTML → "no text"); the 30-row page size; doctor contact kept as text.
**API:** each path, **form-encoded** with the identity block and nothing else, Bearer, `type=API`, student id from the session even if a caller passes another; success mapping with nulls; **internal ids (`imprest_head_id`, `created_by`) absent from the parsed rows**; both envelopes (`status`, `status_code`); non-list data → empty; `Parameter Missing` → validation; 401 and HTTP 200 status `2` → unauthorized; 419; 500 HTML; network; **only the seven read URLs are ever requested — never `studentHostelAllocationAPI`, `document_details`, `student-care`, `student-infirmary`, `consent/`, `front_desk`, `add_`/`update`/`delete`**.
**Components (per screen):** loading; rows; empty state; errors + Try again; `Parameter Missing`; stale banner; guards (no request for a non-student or without a year); per-user cache; "Records are added by your school" note; **no input, submit or edit control exists** (no button except Try again, Show more, Open document, Track bus, View text); unsafe link → message and no button; open failure → inline notice; the stored tile `api` is ignored (a tile whose `api` is another endpoint still requests only the fixed read URL); health "All years" caption; the unavailable screen makes no request; `registry` — twenty-two names.
**Regression:** all 638 existing tests pass; typecheck clean.
**Acceptance:**
1. The nine tiles open their dedicated screens; removing a registry line restores today's behaviour for that tile.
2. Rows show exactly the §6 fields; nothing is hidden; the ordering rules hold.
3. Every §6 state is reachable and correct.
4. Requests are form-encoded with the session's own ids and `type=API`; no request for a non-student or without a school year; only the seven read URLs are ever called.
5. No create, edit, delete, consent, upload or payment code or control exists; no phone number is dialled; no file is downloaded, cached or shared.
6. `npm run typecheck` and `npm test` pass; no native/package change.
7. Local synthetic-id checks pass (§13); the real-data check is **not** claimed.

## 13. Local-server verification plan (synthetic ids only — Q16)
Same setup as S1–S7: `php artisan serve --host=127.0.0.1 --port=8000`, JWT signed locally for a **non-existent student `999999999` on tenant `1`**. An opt-in, loopback-only test `studentRecords.local.test.ts` drives the real client and the seven fetchers over real HTTP:
| Check | Expected |
|---|---|
| each of the seven fetchers | `[]` |
| bad token on each | `unauthorized` |
| requests made | only the seven read paths (spy on fetch); never hostel, `document_details` or any write/staff path |
| every request | Bearer token and `type=API` |
Already done for this document (curl, 2026-10-07, synthetic student, **read endpoints only**): the results in §4 and §3. **Cannot be verified without real data (Q16):** real rows, values, units, health files, certificate sizes, GPS links.

## 14. Device / coordinated-pass additions
For the later pass: the seven lists at 360 dp (long remarks, symptoms and certificate text wrap; pills), "Show more", opening a real health document and a tracking link in the browser/viewer and returning, behaviour with no viewer installed, the certificate text view, pull-to-refresh, and the error/empty/unavailable states.

## 15. Rollback
Delete the nine lines in `src/screens/registry.ts` (the tiles fall back to `GenericDataScreen`, today's behaviour) or `git revert` the S9 commit; the additions to `student.ts` are additive and unused afterwards; F1 and S1–S7 are unaffected. JS-only; no server or data change; nothing is written anywhere.

## 16. Decisions and questions (answered 2026-10-07: Q33 option A — all seven lists plus the unavailable state; Q34 yes; Q35 backend ask written separately, no Laravel change; Q16 still open)
- **Q33 / S9-D1 — scope.** **Option A (recommended):** build all seven lists (S9a.1–7) plus the "not available" screen for hostel and achievement certificate, in the order in §11. **Option B:** build six lists and leave certificates (HTML) for later. **Option C:** do not build S9 now; record it as blocked and move to S10. Because this is health data, B or C are reasonable if you want a smaller first step.
- **Q34** Confirm S9-D2…D11:
  - **D2** legacy read endpoints only, dedicated screens ignoring the tiles' stored `api`;
  - **D3** every list newest first by its record date (three come oldest first from the server);
  - **D4** health data handled as in §8 — in memory only, never logged/persisted/shared;
  - **D5** the health document opens via `safeAttachmentUrl` (placeholder `noimages.png` = no file) and the bus-tracking link via `isSafeHttpUrl`, both only in the phone's browser/viewer, no download/cache/share;
  - **D6** doctor contact numbers shown as text, never tappable;
  - **D7** certificates shown as a **text version** (`stripHtml`) with the notice "Text version. For the official certificate, ask your school.";
  - **D8** height and weight shown as recorded, **no units invented**;
  - **D9** consent: empty status → Pending, amount via ₹ formatting when numeric, internal ids dropped, no consent action;
  - **D10** hostel and achievement certificate tiles show "Not available in the app yet" and make no request (today they show a raw error);
  - **D11** never call any endpoint marked Never or blocked in §3.
- **Q35** The two blocked tiles (S9b) need backend changes (§10.1); say if you want the backend ask written up separately. No further S9 write scope exists (the add/edit screens are staff modules).
- **Q16 stays open** — no real student data.

## 17. What was actually done (2026-10-07)
Built as approved (Q33 option A in the order height & weight → vaccination → health details → infirmary → consent → transport → certificates → blocked-tile message; Q34 S9-D2…D11 yes with the additional requirements below; Q35 backend ask written separately, no Laravel change). **Strictly view only**: no input, edit, share, export, consent, upload, payment or delete control exists, and no write, staff or broken endpoint is ever contacted. Everything is **uncommitted** on branch `migration/s9-my-records` (created from `migration/s7-leave-communication`); you will review and approve the commit separately.

### Files (all under `D:/lms_k12_mobile_rn`)
**Modified (2 source files — additions only: +172 lines, 0 removed; S1–S7 code is untouched)**
| File | Change as built |
|---|---|
| `src/api/student.ts` | appended seven fetchers (`fetchHeightWeight`, `fetchVaccinations`, `fetchHealthRecords`, `fetchInfirmaryRecords`, `fetchConsents`, `fetchTransport`, `fetchCertificates`) and their row types |
| `src/screens/registry.ts` | + `height_weight`, `student_vaccination`, `health_details`, `student_infirmary`, `student_consent`, `student_transport`, `student_certificate`, `student_hostel`, `achievement_certificate` |
**New (src, 5):** `screens/student/recordsModel.ts` (all per-type row models), `RecordListScreen.tsx` (shared layout), `RecordScreens.tsx` (the seven thin screens), `RecordUnavailableScreen.tsx`; `hooks/useStudentRecords.ts` (seven hooks).
**Tests (new, 4):** `recordsModel`, `studentRecordsApi`, `RecordScreens`, `studentRecords.local` (opt-in); `registry.test.ts` extended (twenty-two names + the S9 mappings).
**Docs (new):** [backend-asks/S9-blocked-tiles.md](../backend-asks/S9-blocked-tiles.md) — the separate backend ask for Hostel and Achievement Certificate (Q35); a document only.
No `package.json`, native, Laravel or Next.js change; **no new package**. `studentGate`, `StaleBanner`, `StatusPill`, `safeAttachmentUrl`, `isSafeHttpUrl`, `leaveStatus`, `applySortKey`, `cleanText`, `LIST_PAGE_SIZE`, `formatInr`, `stripHtml` and the date utilities were reused unchanged. The Laravel working tree still holds exactly its four earlier changes.

### Deviations from the plan / from S9-D2…D11 (all small; none weakens a decision)
1. **Stricter than D4: no retention after the screen closes.** Your instruction was that health data must never be cached. The seven record screens therefore do **not** use the shared `useStudentQuery` (5-minute cache); `useStudentRecords.ts` uses `gcTime: 0` and `staleTime: 0`, so the query data is **dropped from memory as soon as the screen unmounts** (a test asserts the query cache is empty after unmount). While a screen is open the data is held in the in-memory query state it needs to render and to keep showing the last list with a "Couldn't refresh" banner. Leaving the screen and coming back fetches again.
2. **The seven thin screens share one file** (`RecordScreens.tsx`) and the hooks one file, instead of seven screen files and seven hook files.
3. **Unavailable-state wording** is exactly your Q34 text, "This isn't available in the app yet." with the hint "Please ask your school." (the plan had "Not available in the app yet").
4. **Height & weight cards use the measurement date as the title** (no separate date line); the values are shown as recorded with no unit.
5. **Infirmary** shows a "Closed"/"Open" pill (Closed when a close date exists); **consent** reuses the S7 status mapping (empty/`null` → Pending; Approved/Rejected/Pending get their tone; any other word is shown as sent, neutral).
6. **Rows with an unreadable date** show that raw text as their title (nothing invented); with no date at all they get the type's default title ("Measurement", "Health record", …).
7. **Local test has three checks** (empty lists, bad token, only-the-seven-paths with Bearer + `type=API`).

### Requirements from your reply — how each is met
| Requirement | Result |
|---|---|
| health data in memory only; never logged, persisted, cached, shared or exposed in debug output | no `console.*` call in any S9 file (grep clean); a test renders and opens records with spies on `console.log/info/warn/debug` and `SecureStore.setItemAsync` and finds no record text and no write; the query data is dropped on unmount (deviation 1); no share/export control exists |
| `noimages.png` = no health document | `isPlaceholderFile` (any case, any query) → no button and no message |
| health shows "All years" | caption "All years" (never "School year") |
| doctor numbers plain text only | rendered as `Doctor contact: …` text; a test presses it and asserts no `openURL`/`canOpenURL`, no link or button role |
| newest first where the backend is oldest-first | all lists sort newest first; unreadable dates last; ties keep the server order |
| null consent = Pending | ✅ |
| certificates text-only with the notice | `stripHtml` text behind "View text"; notice "Text version. For the official certificate, ask your school." |
| never invent height/weight units | ✅ (a test scans the rendered row for units) |
| do not fabricate missing transport data | pick-up/drop lines are built only from the fields sent; a missing direction or part is not shown |
| hostel and achievement certificate never call their endpoints | `RecordUnavailableScreen`: no query, no `fetch`; shows "This isn't available in the app yet." |
| JWT on every call | every request is the F1 legacy call with the Bearer token and `type=API` |
| no new package | none added |

### Tests (Jest) — typecheck clean; full suite: **814 passed, 0 failed, 32 skipped** (the eight opt-in local suites) — S9 added 176 passing tests (was 638)
| Suite | Covers |
|---|---|
| `recordsModel.test.ts` (20) | newest-first ordering for each type (unreadable last, ties, no mutation); no unit ever added; empty/`null` fields left out, rows kept; doctor/contact as text fields; health file states (placeholder in five spellings = none, real file re-based, seven unsafe links with the message and the row kept); infirmary title/fields/closed-open; consent status (Pending, tones, other text), amount (₹ when numeric, text as sent, blank omitted), no internal ids; transport route lines never fabricated, tracking link (https accepted, six unsafe forms refused); certificates (stripped text, script removed, encoded tags stay text, empty HTML = no text, 200 000-tag input fast, type fallback) |
| `studentRecordsApi.test.ts` (56) | for **each of the seven fetchers**: authenticated form-encoded call with the identity block and nothing else, `type=API`, session identity even if a caller passes another student, **only its own URL requested — never hostel, `document_details`, `student-care`, `student-infirmary`, `consent/`, `front_desk`, add/update/delete/store/payment/upload**, non-list data → empty, non-object rows skipped, `Parameter Missing` (both envelopes), 401 + HTTP 200 status `2` (sign-out hook fires), 500 HTML, 419, network, `text/html` JSON; plus field mapping for all seven (numbers → text, nulls → empty, consent internal ids not read, health placeholder URL kept for the model) |
| `RecordScreens.test.tsx` (99) | for **each of the seven screens** (table-driven): loading → records newest first with caption and the "added by your school" note; **view only** (no input/edit/share/export/consent/pay text; only allowed buttons); empty state; 401; server error + Try again; `Parameter Missing`; stale banner; guards; per-user cache; tile `api` ignored; 30-row "Show more"; **query data dropped after unmount**. Plus: health documents (placeholder, real file opens once re-based, unsafe links, open failure, "All years"); doctor numbers not tappable; no units; consent Pending/₹/no action; transport (no fabricated drop, Track bus opens, unsafe link message); certificates ("View text"/"Hide text", notice, HTML never markup, no text → no button); **no logging, no storage writes**; hostel + achievement certificate tiles show the message and make **no request** |
| `registry.test.ts` | the nine S9 mappings; twenty-two names |
| existing suites | all unchanged and passing |

### Acceptance criteria (§12)
| # | Criterion | Result |
|---|---|---|
| 1 | nine tiles open their dedicated screens; removing a registry line restores today's behaviour | ✅ registry test; ⚠️ not seen on a device |
| 2 | rows show exactly the §6 fields, nothing hidden, ordering rules hold | ✅ tests |
| 3 | every §6 state reachable and correct | ✅ tests |
| 4 | form-encoded with the session's own ids and `type=API`; no request for a non-student or without a year; only the seven read URLs | ✅ tests (API, screens, local) |
| 5 | no create/edit/delete/consent/upload/payment control; no number dialled; no file downloaded, cached or shared | ✅ code and tests |
| 6 | typecheck and tests pass; no native/package change | ✅ |
| 7 | local synthetic-id checks pass; real-data check **not** claimed | ✅ synthetic ids only |

### Verification against the local server (read-only, synthetic ids only — Q16)
`php artisan serve --host=127.0.0.1 --port=8000`; a JWT signed locally for a **non-existent student `999999999` on tenant `1`**. The opt-in test drives the **real client and the seven fetchers over real HTTP**: **3/3 passed** — all seven return `[]`; a bad token is `unauthorized` on every one; exactly the seven read paths are requested, each with the Bearer token and `type=API`, and none of hostel, `document_details`, staff or write paths. The server log after the run shows only `/studentHWAPI`, `/studentVaccinationAPI`, `/studentHealthAPI`, `/studentInfirmaryAPI`, `/consentListAPI`, `/studentTransportAPI`, `/studentCertificateAPI`. Server stopped afterwards (port 8000 free). The research probes before the build (also synthetic, read-only) are in §3/§4. No real student, health, consent, transport or certificate data was read.

### Known limitations
- **No real data was read** (Q16): real row shapes and values, real height/weight units, whether health files resolve, certificate HTML size and record counts are verified **from code only**. Local health-file and tracking links cannot be opened (the server builds them from its own host), so link handling is covered by unit/component tests.
- **Not run on a device or emulator**: layout at 360 dp, long remarks and certificate text, the hand-off to the browser/viewer and the no-viewer notice are asserted by tests, not observed (checklist in §14).
- **Memory only, not a guarantee against the OS:** JS memory can be swapped or captured by tools outside the app; screenshots cannot be blocked without a native module (not added).
- **Backend defects, not worked around and not fixed:** no ownership check on any endpoint; public health-document URLs; health has no year filter; transport hides a student with only one direction mapped; three lists arrive oldest first (re-sorted by the app); hostel and `document_details` cannot work for token callers — see [the backend ask](../backend-asks/S9-blocked-tiles.md).
- **Certificates are a text version only** (formatting, images and tables lost), by decision.
- **Current school year only** (health: all years); no year switcher.

### Rollback
1. Delete the nine lines in `src/screens/registry.ts` (the tiles fall back to `GenericDataScreen`, today's behaviour), or `git revert` the S9 commit once it exists. 2. The additions to `student.ts` are additive and unused afterwards; F1 and S1–S7 are unaffected. 3. JS-only; no server or data change was made, and nothing is stored on the device.



## 18. S9c — Student Discipline (added 2026-10-07; implemented — see §19)
Added to the plan on your Q41 answer after the S8 audit found the student tile **Student Discipline** (`child_remark`, **23** of 34 student tenants, ev:menu_tiles.txt line 11) had no module. **No S9c code exists yet; implementation needs your separate approval after S8.** Facts below are from code and from one local probe with a non-existent student.
| | |
|---|---|
| Endpoint | `POST studentDisciplineAPI` — `routes/student.php:183`; `diciplineController::studentDisciplineAPI` `app/Http/Controllers/front_desk/dicipline/diciplineController.php:276-` |
| Auth / identity | the JWT is checked on every call (**[VERIFIED-LOCAL]** 401 without a token); `student_id`, `sub_institute_id`, `syear` from the request; no ownership check (same as every S9 endpoint) |
| Query | parameterised query builder on table `dicipline`: `dicipline as discipline, message, date_ as discipline_date, flag` where `syear`, `sub_institute_id`, `student_id` match (`:296-301`) |
| Response | `{"status":1,"message":"Success","data":[{discipline, message, discipline_date, flag}]}`; `Parameter Missing` when an id is missing. **[VERIFIED-LOCAL]** `{"status":1,"message":"Success","data":[]}` for the synthetic student |
| Flutter | `lists_a.dart:281`: shows `discipline`, `message`, `discipline_date` (ev:flutter_ref.md line 90) |
| Meaning of `flag` | not established from code (**[ASSUMPTION]**: a category/severity set by staff); it would be shown as sent, never interpreted |
**Approved requirements for S9c (Q41), to be built later with the same shape as S9:**
- view only; **no** write, edit or delete (the staff discipline entry screens and `student-care/discipline` are never called);
- the S9 sensitive-data standard: data in memory only while the screen is open (`gcTime: 0`, dropped on unmount), **no console logging, no persistent storage, no sharing or exporting**;
- authenticated requests only (Bearer token, `type=API`, F1 legacy transport; the session student id);
- newest first by `discipline_date`; plain text; nothing invented; unreadable dates shown as sent;
- verification with synthetic / non-existent ids only (Q16): the local test would assert counts only and never inspect a body.
Open points for the S9c document: how to show `flag` (as sent, unlabelled), and whether the screen needs an extra privacy note. Tracker row: S9c "proposed — awaiting implementation approval".

## 19. S9c — what was actually done (2026-10-07) — signed off and committed (DONE)
Built as approved after the S8 sign-off: **Student Discipline, view only**, on branch `migration/s9c-student-discipline` (created from `migration/s8-learning`), **uncommitted** — you will review and approve the commit separately. The endpoint, fields and requirements were already fully specified in §18, so no further details were needed before building.

### Files (all under `D:/lms_k12_mobile_rn`)
**Modified (5 source files — +65 lines, 2 lines changed; S1–S10 behaviour unchanged):** `src/api/student.ts` (`DisciplineRecord`, `fetchDiscipline`), `src/screens/student/recordsModel.ts` (`disciplineFlag`, `disciplineRows`), `src/screens/student/RecordScreens.tsx` (`DisciplineScreen`), `src/hooks/useStudentRecords.ts` (`useDiscipline`), `src/screens/registry.ts` (+ `child_remark`).
**Tests (new, 4):** `disciplineModel`, `studentDisciplineApi`, `DisciplineScreen`, `studentDiscipline.local` (opt-in); `registry.test.ts` extended (thirty-eight names).
No `package.json`, native, Laravel or Next.js change; no new package. It reuses S9's shared list screen and its memory-only hooks unchanged.

### How each requirement is met
| Requirement | Result |
|---|---|
| view only; no write / edit / delete | no input or button exists on the screen (the test asserts zero buttons and no link); the staff entry routes and `student-care/discipline` are never referenced (code scan and request test) |
| authenticated, token-bound request only | `POST studentDisciplineAPI` through F1's legacy transport: Bearer header, token, `type=API`, the session's student id; a caller's other ids are ignored |
| data in memory only; no console logging; no persistent storage / cache / share / export | the S9 record hooks (`gcTime: 0`, `staleTime: 0`): the query data is dropped when the screen unmounts (tested); a test spies `console.log/info/warn/debug` and `SecureStore.setItemAsync` while rendering a sensitive note and finds no text and no write; a code scan of the three shared files finds no `console.`, storage, sharing or file-system use and no write call; no share / export control |
| no unnecessary ids or sensitive fields | the server sends none; the parser reads only `discipline`, `message`, `discipline_date`, `flag` — a test feeds extra `id`, `student_id`, `created_by` and a teacher name and finds none of them in the output; the card shows only the type, date, flag word and message |
| follow the backend's actual values; invent no business state | the **type** is shown exactly as stored (the web offers Bad, Good, Check, Excellent); the **flag** is shown in the backend's own words for its own coding (`1` Positive, `0` Neutral, `-1` Negative — `diciplineController.php:185-186`, `:333-334`, and the web form), a blank flag shows nothing, an unknown value is shown as sent; there is no "resolved / pending / severity" anything, and every pill is neutral-toned |
| external links through F1 | the record has no link, file or URL; nothing is ever opened |
| synthetic ids only; Q16 strict | see below |
| no device / native work | none |

### Tests — typecheck clean; full suite: **1028 passed, 0 failed, 44 skipped** (the eleven opt-in local suites) — S9c added 34 passing tests (was 994)
| Suite | Covers |
|---|---|
| `disciplineModel.test.ts` (11) | the flag coding and its neutral tone, blank / `null` flag → no pill, unknown flag as sent; newest first (both date formats), unreadable dates last and shown as sent, ties keep the server order, no mutation, nothing dropped; type as sent with a plain default; message as plain text (an empty message keeps the row); only title, date, flag and message are carried; extra server fields never carried |
| `studentDisciplineApi.test.ts` (7) | authenticated form-encoded call (identity block only, `type=API`, session student even if a caller passes another); **only its own URL, never a staff / entry / write route**; exact field mapping from the server's aliases (nulls → empty, ids / staff names ignored); non-list data and junk rows → empty; `Parameter Missing`; 401 + status `2`; 500 HTML / 419 / network |
| `DisciplineScreen.test.tsx` (15) | registry mapping; loading → notes newest first with type, date, flag word and message; no invented states; view only (no input, no button, no link, no share / export / edit / delete text, nothing opened); empty state; 401; server error + Try again; `Parameter Missing`; stale banner; guards; per-user cache; tile `api` ignored; **query data dropped on unmount; no storage write, no console output; code scan** |
| `registry.test.ts` | `child_remark` → `DisciplineScreen`; thirty-eight names |
| existing suites | all unchanged and passing |

### Verification against the local server (read-only, synthetic id, strict Q16, counts only)
`php artisan serve --host=127.0.0.1 --port=8000`; a JWT signed locally for the **non-existent student `999999999` on tenant `1`**. The opt-in test drives the real client and fetcher over real HTTP and **asserts the count only, never printing or inspecting a body**: **3/3 passed** — **0** notes returned for the non-existent student; a bad token is `unauthorized`; exactly one POST to `studentDisciplineAPI` is made, with the Bearer token, `type=API` and the session student id, and no staff, entry or write route. The server log shows only `/studentDisciplineAPI`. The endpoint filters by the caller's own `student_id` (`diciplineController.php:296-301`), so a non-existent student can only receive an empty list; no real row was returned or inspected. Server stopped afterwards (port 8000 free).

### Deviations
1. **The flag words.** Showing "Positive / Neutral / Negative" for `1 / 0 / -1` is the one interpretation in the screen; it is the backend's and the web's own coding, not a new state. Unknown values are shown as sent, so nothing is lost if a school uses other values.
2. Every pill is neutral-toned (no red for Negative) — a deliberate choice for a child's record; say if you want tones.
3. Otherwise none: it is the S9 pattern with one more type.

### Known limitations
- **No real data was read** (Q16): the real wording of types and messages, the real flag values in use, and note volumes are verified from code only.
- **Not run on a device** (long messages wrap — checklist as for S9).
- **Backend:** no ownership check on the endpoint (student id from the request); `flag` is stored as a number and the type is free text.

### Rollback
Delete the `child_remark` line in `src/screens/registry.ts` (the tile falls back to `GenericDataScreen`, today's behaviour) or `git revert` the S9c commit; the additions are additive and unused afterwards. JS-only; no server or data change; nothing is stored on the device.

