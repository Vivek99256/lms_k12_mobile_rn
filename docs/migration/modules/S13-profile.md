# S13 — Profile

Status: **S13a DONE** (signed off 2026-10-07) — the on-demand "My details" card implemented, tested, verified locally with a non-existent user (statuses only). Document approved 2026-10-07 (Q43 option A; Q44 S13-D2…D6 with the mandatory fail-closed identity cross-check; Q45 backend ask written). Real-data check intentionally not done (Q16 strict); device check deferred to the coordinated pass. **Details load only after "Show my details"; a rejected record exposes nothing. S13b (editing, password, photo) is not approved.**
Class: **V1** · Roles: Student first (all roles share the Profile tab) · Last planned module in the approved build order (03 §5: … S10 → S8 → **S13**) · Depends on: **F1** (done — non-legacy JSON client, the approved opt-in `bearerOnly` GET option), the auth store (login fields), S1/S9 patterns (sensitive-data handling) · Decisions: D-03, D-09, D-13, D-14, D-17.
Facts cite file:line. `ev:` = [evidence/](../evidence/README.md). **[ASSUMPTION]** = not read from code. **[VERIFIED-NO-DB]** = established by reading code. **No probe of any kind was made for this document** (Q16 strict): everything below is from code. The one endpoint involved is scoped to the caller's own id, and the build's local check would use only a non-existent student.

## 0. Scope map
| Part | What | Kind | Proposed? |
|---|---|---|---|
| **S13a** | **My details** on the Profile tab: mobile, birthdate, admission/joining year, address — fetched on demand from the school's own record and shown as plain text | view only | **Yes** |
| – | What the Profile tab already shows from the login (name, role, email, school, app version, update id) and **Sign out** | unchanged | kept as is |
| S13b | Edit profile, change password, change photo | **WRITE** | **No** — no endpoint is proposed or documented; needs its own approval |
Nothing in S13 writes anything. No profile photo is fetched (the server sends a file name only, and S10 settled that the app fetches no images).

## 1. What the user will be able to do
Open the Profile tab (as today). Tap **Show my details** to load and see the details the school holds for them — mobile number, date of birth, admission year (students) or joining year (staff), address. Tap **Hide details** to remove them from the screen and from memory. Nothing else changes. The details are not loaded until the user asks.

## 2. Existing screens and Laravel endpoints (evidence)
| Source | Finding |
|---|---|
| **Current RN app** | `src/screens/ProfileScreen.tsx:12-72` is **session-only — no network call**: initials, name, role, then rows for email, role, school, app version, update id (`:23-29`) and a **Sign out** button (`:69`). It is the Profile bottom tab for every role (`src/navigation/RootNavigator.tsx:65`). |
| **Web (D:/lms_k12)** | **No consumer** of `own-profile` (searched `app`, `lib`, `components`): the endpoint is a mobile endpoint (its own comment says "Read-only mobile endpoint; legacy controllers remain unchanged", `OwnProfileApiController.php:9`). |
| **Flutter** (reference only) | the staff "own profile" screen reads the **login session** only (`first_name, last_name, image, birthdate, mobile, email, join_year, address`; `profile_screens.dart:34-47`, ev:flutter_ref.md lines 130, 194: "NO endpoint"); the drawer has "My Profile" (ev:flutter_ref.md line 61). |
| **Backend** | `GET api/own-profile` — `routes/api.php:98`, group `api.session`; `OwnProfileApiController::show` `app/Http/Controllers/api/OwnProfileApiController.php:13-46`. |
**Contract (from code):** identity comes from the verified token only (`user_id`, `sub_institute_id`, `user_profile_name` read from the hydrated session, `:15-17`); **no id is accepted from the request**. A student is looked up in `tblstudent` (`id, first_name, middle_name, last_name, email, mobile, dob as birthdate, admission_year as join_year, address, image, user_profile_id`), anyone else in `tbluser` (`…, birthdate, join_year, …`), always with `id = user_id`, `sub_institute_id = tenant` and `status = 1` (`:20-21`). Not found → `404 {"success":false,"message":"Profile not found.","data":null}` (`:24`). Success → `{"success":true,"message":"Profile fetched successfully.","data":{"id","full_name","email","mobile","birthdate","join_year","address","image","user_profile","school_name"}}` (`:27-43`). Like every `api.session` route it answers **422 "Academic Term Date Expired"** when the school has no current academic year (`HydratesLegacyApiSession.php`, ev:backend_routes_A.md §2.2) and 401 without a valid token.

## 3. Which API (S13-D2): the modern, token-bound endpoint
`GET api/own-profile` is the only profile endpoint a token can use, it is read-only, and it takes no id. **Use it**, through the non-legacy client with the approved `bearerOnly` option (the JWT in the Authorization header only, never in the URL). No legacy fallback exists or is wanted. Not used: `allStudentListAPI`, `get_adminTeacherList`, `student_profile` lists (other people's profiles; staff modules), anything under `student/*` profile CRUD.

## 4. Backend risk that shapes the design — a possible wrong-person profile
`show()` decides "student or staff" by `session('user_profile_name') === 'Student'` (`OwnProfileApiController.php:17`). That session value is the **profile-master name** for the token's `user_profile_id` (`HydratesLegacyApiSession.php:102-107`, `:131`), not the token's own `is_student` claim (`:71`, `:135`). If a school names its student profile differently (for example "STUDENT", "Students" or "Student " with a space), a student's token falls to the **staff branch** and the controller looks up **`tbluser` with the student's numeric id** — which can be a **different person** (a staff member of the same school with the same number). The response would then carry that person's name, mobile, birthdate and address. **[VERIFIED-NO-DB]** by code; whether any real school is configured this way cannot be known without real data (Q16).
**Consequence for the app (fail closed):** the Profile tab already knows who is signed in (login name and email). Before showing any detail it **checks that the returned record is the same person** — the email matches (case-insensitive, trimmed) or, when the server's email is empty, the full name matches (case-insensitive, whitespace-normalised). If neither matches, it shows "Your details can't be shown right now." and **nothing from the response is displayed**. This costs nothing in the normal case and prevents showing someone else's address.

## 5. Data presentation and UX
- **On-demand (S13-D3).** The Profile screen is unchanged until the user taps **Show my details**. The request is made then; the details are shown in a card under the existing rows; **Hide details** unmounts the card, which drops the data from memory (the query uses `gcTime: 0`, as in S9). Leaving the app, signing out or the tab being unmounted also drops it; the existing sign-out clears the whole query cache.
- **Rows shown (plain text, no links):** *Mobile* (never tappable), *Date of birth* (via the app's date helper, raw text when unreadable), *Admission year* for students / *Joining year* for staff (as sent), *Address* (as sent, wrapped). A blank, `null` or missing value is omitted, never replaced by a made-up one. **Not shown:** the server's `id`, `image`, role and school (the login already supplies role and school and they are not re-fetched), nothing about other people.
- **No image** is fetched or shown (the server sends a file name only).
| State | UI |
|---|---|
| not requested | the existing Profile screen + the **Show my details** button |
| loading | inline `Loading` in the card |
| error | inline message + Try again (F1 messages: network, 5xx, 401 session-expired sign-out) |
| 404 "Profile not found." | "Your details aren't available." (no retry loop) |
| 422 no current academic year | the server's message "Academic Term Date Expired" with Try again |
| identity cross-check fails (§4) | "Your details can't be shown right now." — nothing from the response is shown |
| all fields empty | "Your school hasn't added more details yet." |
| error after details were shown | the details stay and a "Couldn't refresh" notice appears |
| unreadable/odd values | shown as sent |
**Stale data:** none kept; every Show fetches again. **Accessibility:** one group per row with its label; buttons ≥ 44 dp.

## 6. Security and privacy
- **Personal data of the user** (and for a student, a child's address and date of birth): fetched only on request, shown to the signed-in user, in memory only while shown, never logged, persisted, shared or exported; no copy/share control; the mobile number is plain text, not a link.
- **Token handling:** the JWT travels in the Authorization header only (`bearerOnly`); no id is sent.
- **Wrong-person guard** (§4): no field is displayed unless the record provably belongs to the signed-in user.
- **No image, no third party, no write** of any kind.
- **Roles:** the same endpoint serves students, teachers and admins (different tables). The staff branch is verified by code only; the build's local check uses only a non-existent student id.

## 7. Dependencies
| Reused | From | Used for |
|---|---|---|
| non-legacy `api.get` with `bearerOnly` | F1 (approved with S8) | the request |
| `useAuthStore` (name, email, `isStudent`, sign-out), `Card`, `Button`, `Loading`, `ErrorState`, theme | existing | layout, identity check |
| `displayDate`, `cleanText` | S1, S7 | text |
| the S9 `gcTime: 0` memory-only pattern | S9 | dropping the data on hide |
No new package. The existing Profile layout and Sign out are untouched.

## 8. Exact files expected to change (all under `D:/lms_k12_mobile_rn`)
**Modified (1):** `src/screens/ProfileScreen.tsx` (add the **Show my details** button and the card; the existing rows and Sign out unchanged).
**New:** `src/api/profile.ts` (`fetchOwnProfile()` + the `OwnProfile` type — separate from `student.ts` because the endpoint serves every role), `src/screens/profile/profileModel.ts` (rows, identity check, date text), `src/screens/profile/MyDetails.tsx` (the on-demand card), `src/hooks/useOwnProfile.ts`.
**Tests:** `profileModel`, `profileApi`, `MyDetails`, `ProfileScreen` (existing behaviour pinned + the new button), `ownProfile.local` (opt-in).
No `package.json`, native, Laravel or Next.js change.

## 9. Tests and acceptance criteria
**Model:** the identity check (email equal ignoring case and spaces; email empty → name equal ignoring case and whitespace; both different → refuse; both empty → refuse; a staff record with the same id but another person → refuse); rows (mobile, date of birth in words or raw, admission vs joining label by role, address; blank / `null` / missing omitted; nothing invented; no id, image, role or school row); all-empty → the empty state.
**API:** `GET api/own-profile` with the Authorization header and **no `token` in the URL**, no id of any kind sent, `type`/`sub_institute_id`/`syear` as for other modern calls; success mapping (nulls → empty); `image` and `id` not exposed in the UI model; 401 (sign-out hook), 404 "Profile not found.", 422 "Academic Term Date Expired", 500, 419, network; no other URL requested.
**Components:** the Profile screen is unchanged until the button is pressed and makes **no request** on open; Show → loading → details; Hide removes them and the query cache is empty afterwards; each error state; the cross-check refusal shows the message and **none** of the returned text; no console output, no storage writes; mobile number is plain text (no link role, pressing it opens nothing); Sign out and the existing rows still work; a non-student session works the same (staff wording "Joining year").
**Regression:** all 1028 existing tests pass; typecheck clean.
**Acceptance:** (1) the Profile tab behaves exactly as today until **Show my details** is pressed; (2) details appear only after a provably-own record is returned; (3) Hide drops the data; (4) the token is never in a URL and no id is sent; (5) no image, no link, no write, no logging or storage; (6) typecheck and tests pass; (7) the local check uses a non-existent student only and asserts the status/count, never a body.

## 10. Local-server verification plan (synthetic id only — strict Q16)
`php artisan serve --host=127.0.0.1 --port=8000`; a locally signed JWT for the **non-existent student `999999999` on tenant `1`**. An opt-in, loopback-only test calls the real `fetchOwnProfile()`: it must end in **404 "Profile not found."** (the endpoint can only look up the token's own id, which does not exist), a bad token must be `unauthorized`, a non-existent tenant must be 422, and the request must have no `token` in its URL and no id parameter. It asserts statuses only and never inspects a body. **Not verified (Q16):** real profile values, the staff branch, whether any real school has a differently named student profile (§4).

## 11. Device / coordinated-pass additions
Show / Hide at 360 dp (long addresses wrap), the card after rotation and app resume, sign-out clearing, and the behaviour with no network.

## 12. Rollback
Revert the one `ProfileScreen.tsx` change (the Profile tab returns to its session-only form) or `git revert` the S13 commit; the new files are unused afterwards. JS-only; no server or data change; nothing is stored on the device.

## 13. Backend limitations and asks (for the owners; not to be fixed in this migration)
1. **Possible wrong-person lookup** (§4): decide student-vs-staff from the token's `is_student` claim (or `user_profile_id`), not from a profile-master name equal to the literal `Student` (`OwnProfileApiController.php:17`).
2. The endpoint needs a **current academic year** (422 otherwise) although a profile does not depend on the year.
3. It returns `image` as a bare file name (no URL, no folder) and the internal `id`.
4. It exposes the staff and student date of birth, mobile and address to the account holder only — correct — but the response carries no indication of which table it came from, which is what makes the §4 check necessary on the client.

## 14. Decisions and questions (answered 2026-10-07: Q43 option A; Q44 yes with the critical fail-closed requirement; Q45 backend ask written; Q16 strict)
- **Q43 / S13-D1 — scope.** **Option A (recommended):** add the on-demand **My details** card (Show / Hide) described above. **Option B:** leave the Profile tab as it is (session-only); S13 is then closed as "no change needed". **Option C:** auto-load the details when the tab opens (more exposure; not recommended).
- **Q44** Confirm S13-D2…D6:
  - **D2** `GET api/own-profile` only, via `bearerOnly`; no legacy fallback, no other profile endpoint;
  - **D3** details are loaded only when the user taps **Show my details** and dropped on **Hide** (`gcTime: 0`);
  - **D4** the identity cross-check (§4) is mandatory and fails closed;
  - **D5** rows: mobile (plain text), date of birth, admission/joining year, address; no id, image, role or school re-shown; blanks omitted;
  - **D6** nothing is logged, persisted, shared or exported; no photo is fetched; no write (S13b stays out).
- **Q45** Write up the §13 backend items (especially the possible wrong-person lookup) as a separate backend ask, like S8–S10? No Laravel change.
- **Q16 stays open** — strict; this document made no probe at all.

## 15. What was actually done (2026-10-07) — signed off and committed (DONE)
Built as approved (**Q43 option A**: the on-demand "My details" card; **Q44** S13-D2…D6 with the critical fail-closed identity cross-check; **Q45** the backend ask written separately, no Laravel change). **S13b (edit profile, change password, change photo) is not built and not approved.** Everything is **uncommitted** on branch `migration/s13-profile` (created from `migration/s9c-student-discipline`); you will review and approve the commit separately.

### Files (all under `D:/lms_k12_mobile_rn`)
**Modified (1):** `src/screens/ProfileScreen.tsx` (+12 lines, 1 changed): the **Show my details** button / card and the Hide handler; the existing rows and **Sign out** are unchanged.
**New (src, 4):** `api/profile.ts` (`fetchOwnProfile`, `OwnProfile`), `screens/profile/profileModel.ts` (`sameAccount`, `detailsFrom`), `screens/profile/MyDetails.tsx` (the card), `hooks/useOwnProfile.ts` (`useMyDetails`).
**Tests (new, 4):** `profileModel`, `profileApi`, `ProfileScreen`, `ownProfile.local` (opt-in).
**Docs (new):** [backend-asks/S13-own-profile.md](../backend-asks/S13-own-profile.md) (Q45).
No `package.json`, native, Laravel or Next.js change; **no new package**; no change to F1 (the already-approved `bearerOnly` option is used as is).

### Requirements from your reply — how each is met
| Requirement | Result |
|---|---|
| loads **only** after "Show my details" | the card (and so the query) exists only while shown; the Profile screen makes no request on open — tested (`fetchOwnProfile` and `fetch` not called, query cache empty) |
| identity cross-check mandatory and fail-closed | runs **inside the query function**, so the raw server record is never stored: the cache holds only `{kind:'mismatch'}` or the derived display rows of a provably-own record |
| email must match case-insensitively; if the server email is empty, the full name must match | `sameAccount`: server email present → must equal the login email (case-insensitive, trimmed); a different email is a mismatch **even if the name matches** (no fall-back); an unknown login email cannot be verified → mismatch; server email empty (or `null`/blank) → full name must equal the login name (case-insensitive, whitespace-normalised, both non-empty); anything else → mismatch |
| mismatch message and **no field** from a rejected response | "Your details can't be shown right now."; tests inject a different person's name, email, mobile, birthdate, year and address and assert that **none** of those strings appears anywhere in the rendered tree or in the cache, for four mismatch cases |
| never fall back because other fields look plausible | tested (different email + same name → rejected; empty email + different name → rejected; neither → rejected) |
| never another person's id | no id of any kind is sent: the request has **no query string at all** (`withSession: false`) and no body; the function takes no parameters |
| Hide removes the record from memory immediately | the Hide handler calls `queryClient.removeQueries` synchronously and unmounts the card; the query also has `gcTime: 0`; tested (cache empty right after pressing Hide, also from the rejected and error states; showing again fetches again) |
| no persistence, caching, logging, sharing; no profile image | no storage / console / share code; a test with console and `SecureStore` spies finds no profile text and no write; the server's `image` is never read, no `Image`, no `fetch` by the app |
| no server id, role or school shown | not read from the response at all (`OwnProfile` has six fields); tested with extra fields present |
| mobile number plain text, never tappable | rendered as `<Text>`; pressing it opens nothing; no link role |
| blank values omitted, nothing invented | `null` / blank / missing rows are left out; if nothing remains: "Your school hasn't added more details yet." |
| modern token-bound `GET api/own-profile`, `bearerOnly`, JWT never in the URL, no legacy fallback | tested: GET, `Authorization: Bearer …` header, URL equals `https://…/api/own-profile` exactly (no `token`, no `type`/tenant/year, no id), no body; the default GET behaviour of other modules is pinned unchanged |
| 422 academic-year handled explicitly and safely | the server's "Academic Term Date Expired" is shown with **Try again**, no profile text is shown, and Try again refetches; the local run confirms the 422 for a tenant without a current year |
| both matching and mismatching identity tested | ✅ (model: 20 tests; screen: matching by email case, matching by name when the server email is empty, four rejections) |
| no write, no S13b | none |

### Deviations (small)
1. **`withSession: false`** — the plan said the request would carry `type`/`sub_institute_id`/`syear` "as for other modern calls"; to honour "do not send a student/staff id" strictly it carries **nothing** in the URL (the token alone identifies the user, and `api.session` sets `type=API` itself).
2. **The state "error after details were shown" from the plan is not needed**: the card never refetches by itself; Try again exists only on the error states.
3. **A login name that falls back to the email** (when a user has no first/last name, `mapLogin.ts:8`) can never equal a server full name, so with an empty server email such a user is shown "can't be shown right now" — the fail-closed direction.
4. **Staff with a middle name** (the server's `full_name` includes it, the login name does not) are rejected by the name rule when their server email is empty; the email rule is the normal path and is unaffected.
5. The identity check lives in the query function rather than in the component (so the rejected record is never cached); the plan only required that it run before display.

### Tests — typecheck clean; full suite: **1084 passed, 0 failed, 48 skipped** (the twelve opt-in local suites) — S13 added 56 passing tests (was 1028)
| Suite | Covers |
|---|---|
| `profileModel.test.ts` (20) | the identity rule in every branch (email equal / case / spaces, different email even with a matching name, unknown login email, a staff record of another person, empty server email with matching / different / empty names, `null` email, nothing to compare); rejected → nothing from the record; row order and labels (Admission vs Joining year); blanks omitted; unreadable birthdate as sent; no id / image / role / school |
| `profileApi.test.ts` (12) | bare GET, header-only token, **no query string at all**, no body, no id, takes no parameters; only that URL; mapping of six fields (numbers → text), no id / image / role / school; junk or missing data → an empty record (rejected by the check); 401, 404, 422, 500, 419, network; the default GET behaviour of other modules unchanged |
| `ProfileScreen.test.tsx` (24) | unchanged tab and no request on open; Sign out; Show → rows (student and staff labels); mobile not tappable; Hide empties the cache; show again refetches; blanks; all-empty message; extra server fields never shown; four rejections exposing zero fields and caching only `mismatch`; two acceptances; 404 / 422 + Try again / 401 / 500 / network; Hide from error and rejected states; no storage write, console output or fetch; no share / edit / photo control |
| existing suites | all unchanged and passing |

### Verification against the local server (read-only, non-existent user, strict Q16, statuses only)
`php artisan serve --host=127.0.0.1 --port=8000`; locally signed JWTs for the **non-existent user `999999999` on tenant `1`** and on a non-existent tenant. The opt-in test asserts **statuses and URL shape only and never inspects a body**: **4/4 passed** — **404 "Profile not found."** (the endpoint can only look up the token's own id, which does not exist, so no row could be returned); **422 "Academic Term Date Expired"** for a tenant without a current year; **401** for a bad token; and every request is a bare `GET /api/own-profile` with the JWT only in the `Authorization` header, an empty query string and no body. Server stopped afterwards (port 8000 free). No real row was returned or inspected, and no probe other than these was made.

### Known limitations
- **Not verified with real data** (Q16): real profile values, the staff branch (`tbluser`), and whether any real school names its student profile differently (the wrong-person risk) — the cross-check protects the user either way.
- **Not run on a device** (long addresses wrap — checklist in §11).
- **Name-only matching is strict by design:** a legitimate user whose server email is empty and whose login name differs in spelling or middle name sees "can't be shown right now" rather than a possibly-wrong record.
- **Backend:** see the backend ask (role detection by display name, wrong-person lookup, academic-year dependency).

### Rollback
Revert the one `ProfileScreen.tsx` change (the Profile tab returns to its session-only form) or `git revert` the S13 commit; the four new source files are unused afterwards. JS-only; no server or data change; nothing is stored on the device.

