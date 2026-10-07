# S6 — Student fees

Status: **S6a DONE** (signed off 2026-10-07) — view-only fee summary implemented, tested, verified locally with synthetic ids only. Document approved 2026-10-07 (Q24 option A; Q25 S6-D2…D7 yes; Q26 S6b/c/d future scope only). Real-data check intentionally not done (Q16 open); device check deferred to the coordinated pass. The `PaidUnpaid` backend defect stays a backend issue (not to be fixed in this migration). **No payment, receipt or financial action exists in the app. S6b/S6c/S6d are NOT approved.**
Class: **V1 (at risk — see §9)** · Role: Student · Next in the approved build order (03 §5: … S4a → **S6a/b** → S5 → S7 …) · Depends on: **F1** (done — form-encoded legacy requests are **required** here), **S1** (done: student gate, per-user query hook, stale banner), S3/S4a (patterns) · Decisions: D-03, D-09, D-13, D-14, D-17.
Facts cite file:line. `ev:` = [evidence/](../evidence/README.md). **[ASSUMPTION]** = not read from code. **[VERIFIED-LOCAL]** = observed on the local Laravel server on 2026-10-07 using only non-existent ids (student `999999999` on real tenant `1`, or a non-existent tenant) — **no real student data was read** (Q16). **[VERIFIED-NO-DB]** = a PHP/Laravel behaviour checked with a small script that touches no database.

## 0. Scope map — what is proposed, and what is only identified
This is money, so the document keeps **view-only** and **action** functionality strictly apart. **Only S6a is proposed for building.** The rest is *identified* so nothing is dropped silently; none of it is proposed, and each needs its own document and your separate approval.
| Part | What | Kind | Proposed for this build? |
|---|---|---|---|
| **S6a** | Fee **summary** for the school year: total, paid, pending (three read-only numbers) | **view only** | **Yes — subject to the go/no-go decision S6-D1 (§16)** |
| S6b | Month-wise dues and the list of paid receipts | view only | **No — blocked by backend defects** (§3, §9) |
| S6c | Receipt document view / download (`ajax_PDF_FeesReceipt`, receipt HTML) | **financial document access** | **No** — not proposed; needs separate approval (§3) |
| S6d | Online payment ("Pay now" / gateway hand-off) | **financial action** | **No** — not proposed; needs separate approval (§3) |
S6a **never** initiates a payment, **never** fetches or downloads a receipt, and **never** writes anything. It has no "Pay now" button, no receipt link, and does not open the `PayNow` URL the server sometimes returns elsewhere.

## 1. What the student will be able to do (S6a)
See, for the current school year: **Total fees**, **Paid** and **Pending**, a "paid so far" bar with the same figures in words, and — if the student has paid more than the total — "Paid in advance". Pull to refresh. That is all; the screen says plainly that month-wise dues, receipts and online payment are not in the app yet.

## 2. Existing screens and Laravel endpoints (evidence)
| Source | Finding |
|---|---|
| **Web (D:/lms_k12)** | **No student-facing fee screen.** Searched `app`, `lib`, `components` for `PaidUnpaid`, `studentFeesDetailAPI`, `pending_fees`, `ajax_PDF_FeesReceipt`, `receipt/reprint`, `online_fees_payment_api`: matches are only the **staff** pages `app/fees/collect/page.tsx`, `app/fees/collect/[studentId]/page.tsx`, `app/fees/online-payment/[gateway]/page.tsx` and the BFF routes `app/api/fees/receipt-reprint`, `app/api/fees/online-payment/[gateway]`; no fee page checks `isStudent`. The web formats money as **INR** (`Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })` and `₹`, repeatedly in `app/fees` and `lib`). So S6 is **mobile-only**, on the legacy mobile contract. |
| **Production menu** (read-only SELECT on `mobile_homescreen`, 2026-10-07 — ev:menu_tiles.txt line 25) | `Fees Details` → `screen_name=fees` → `https://erp.triz.co.in/fees/PaidUnpaid`, params `student_id,sub_institute_id,syear`, **28 of 34** student tenants. The tile's own contract is the **summary** endpoint. |
| **Flutter** (reference only) | `lib/screens/student/fees.dart:11-140`: a *Pending / Paid* screen built on `studentFeesDetailAPI` (`PENDING[]`, `PAID[]`, a "Pay now" button on `PayNow`, a receipt viewer). Its docs say its endpoints were never run against a live server (ev:flutter_ref.md), and §3 shows why that screen cannot work as written. |
| **Current RN app** | the `fees` tile falls back to `GenericDataScreen`, which posts **JSON** without a student id — so today it fails (JSON body → HTTP 500 on `PaidUnpaid`, **[VERIFIED-LOCAL]** below). |
**Backend (read in full 2026-10-07)** — all in `app/Http/Controllers/fees/fees_collect/fees_collect_controller.php` unless noted; routes in `routes/fees.php`:
| Endpoint | Route | Method | Auth / identity |
|---|---|---|---|
| `POST fees/PaidUnpaid` | `fees.php:258`, `['session','check_permissions']`, **unnamed route** | `PaidUnpaid` `:2002-2192` | `session` middleware hydrates the token session when `type=API` (`SessionMiddleware.php:22-37`); the controller also checks the JWT and answers **HTTP 200** `{status:'2'}` on failure (`:2004-2015`); `student_id`/`sub_institute_id`/`syear` come from the **request** (`$_REQUEST`); the unnamed route has no menu row, so `check_permissions` enforces nothing (`checkPermission.php:30-45`) |
| `POST studentFeesDetailAPI` | `fees.php:327`, `['session','check_permissions']`, unnamed | `studentFeesDetailAPI` `:3274-3418` | **JWT check commented out** (`:3276-3288`); tenant taken **from the body and written into the session** (`:3297`) |
| `GET pending_fees` | `fees.php:334`, named `pending_fees` | `tillMonthPendingFees` `:3668-3775` | needs `type`; school from the token session, student from the request; rights depend on a `pending_fees` menu row (**DB-dependent, unverified**) |
| `GET ajax_PDF_FeesReceipt` | `fees.php:322` | `AJAXController.php` (~`:1779`) | `student_id`, `receipt_id_html` from the request; with `type=API` tenant/year also from the request (`:1802`) |
| `POST fees/get_online_receipt` | `fees.php:316` | `OnlineReceipt` | **no JWT or session check** — a payment-recording endpoint (ev:teacher_tiles_backend.md caveat 2) |
**No modern, token-bound student fee API exists.** Searched `routes/api.php` for `fees`: only `fees-dashboard/summary|defaulters` (staff), `fees-refund/*`, `fees-cancel/search`, `fees-circular*`, `fees/menu-categories` (all staff/admin); and the `api.session` group in `routes/fees.php:116-133` (`online_fees_payment_api/{gateway}` initiate/preview, `receipt/reprint`, `online_payments`, `audit_logs`, `reconciliation/status`) — payment, receipt and back-office routes, **not** a student fee view, and outside this scope.

## 3. Which API (S6-D2): legacy, and which endpoints — and which not
Because no modern student endpoint exists, S6 can only use legacy endpoints. Verdict per endpoint:
| Endpoint | Verdict | Why (evidence) |
|---|---|---|
| **`fees/PaidUnpaid`** | **Use for S6a** | the production tile's own contract; read-only; the tenant for the breakoff join comes from the token session (`:2100-2105`); validator, `status:'2'` and `Data Not Found.` paths all map cleanly to F1. **But see the defect in §9.** |
| `studentFeesDetailAPI` | **Do not use — blocked** | (1) With the `type=API` that F1 always sends (and that the `session` middleware needs to accept a token), the controller takes the **paid-list-only branch** (`isset($request->type)`, `:3383`) and returns a plain list — not the `STU_DATA / PENDING / PAID` object the Flutter screen reads. **[VERIFIED-LOCAL]**: `{"status":1,"message":"Success","data":[]}`. Without `type` the `session` middleware answers **401 "Unauthenticated."** **[VERIFIED-LOCAL]**. (2) In that branch `->when($request->type, fn($q) => $q->groupBy(...)->first())` (`:3375-3380`) makes `when()` return the **row object**, and `->get()` is then called on it → a fatal error for any student who has at least one receipt (**[VERIFIED-NO-DB]**: `when()` returns the `stdClass`, which has no `get()`). (3) The JWT check is commented out (`:3276-3288`) and the **tenant is taken from the request body and written into the session** (`:3297`), so a caller can read another school's student. (4) The response hands out an **encrypted payment token** (`STU_DATA.token`, `:3389-3400`) that the **unauthenticated** `fees/get_online_receipt` accepts, plus the receipt HTML (`fees_html`, `:3364`). Not usable safely; **no workaround that satisfies D-17 exists** (omitting `type` is a 401; there is no token-bound alternative). Backend ask in §9. |
| `pending_fees` | not used in S6a | works with `type=API` **[VERIFIED-LOCAL]** (`{status:1, api_status:0, previous_fees:0, current_fees:0, fees_months:[], studentData:{…}}`), but `api_status` is `1` only for tenant 254 and only with dues (`:3668-3775`, `$subinstArray=[254]`), its rights check is DB-dependent, and it returns a whole `studentData` record the app has no use for. Candidate for a later "due so far" card; **not** part of this proposal. |
| `ajax_PDF_FeesReceipt` | not used (S6c — identified only) | takes `student_id` and `receipt_id_html` from the request, deletes **every file** in the shared receipt folder before each run (`:1791`) so concurrent users clobber each other, and with `type=API` reads tenant/year from the request (`:1802`). |
| `fees/get_online_receipt` | **never** | unauthenticated payment recording. |

## 4. S6a API contract — `POST fees/PaidUnpaid`
Sent through F1's `legacy.post`: form-encoded, identity block from the session, Bearer header, `type=API`. **Form encoding is mandatory**: the controller reads `$_REQUEST` (`:2043-2045`), which is empty for a JSON body — **[VERIFIED-LOCAL]**: JSON body → HTTP **500**. The app sends only the identity block (no extra fields).
| Field | Source | Rule |
|---|---|---|
| `student_id`, `sub_institute_id`, `syear` | session | validator `required|numeric` (`:2018-2022`); failure → HTTP 200 `{"response":"","status":"0","message":{"student_id":["The student id field is required."]}}` (message is an **object**) **[VERIFIED-LOCAL]** |
**Observed responses [VERIFIED-LOCAL]:**
| Case | Response | F1 result |
|---|---|---|
| student has no fee structure (synthetic student, real tenant 1, year 2026) | `200 application/json {"response":{"bf_error":["No Breackoff Found."]},"status":"0","message":"Data Not Found."}` | `validation` error, message `Data Not Found.` |
| tenant has no current academic year | `422 {"success":false,"message":"Academic Term Date Expired",…}` | `validation`, that message |
| no token | `401 {"success":false,"message":"JWT token is required.",…}` | `unauthorized` (sign-out) |
| JSON body | `500` | `server` error |
**Success shape (from code `:2175-2191`; not observed — Q16):** `{"response":{"student_id":…,"breack_off_amount":…,"paid_amount":…,"unpaid_amount":…},"message":"Sucsess","status":"1"}` (`json_encode`, `text/html`). There is **no `data` key**: the app reads `Envelope.raw.response`. Amounts are numbers or numeric strings.
**Meaning of the numbers (from the SQL):**
- `breack_off_amount` = the sum of the student's fee **breakoff** (`fees_breackoff.amount`) over **all months of the fee year** (the year runs from `map_year.from_month` for 12 months, `:2043-2070`) plus `fees_breakoff_other` — a **whole-year** figure, not "due so far".
- `paid_amount` = `SUM(fees_collect.amount) + SUM(fees_collect.fees_discount)` for the year's month ids, plus `fees_paid_other` (`actual_amountpaid + fees_discount`) — so **discounts count as paid**.
- `unpaid_amount` = `breack_off_amount − paid_amount` computed in PHP (`:2184`); it can be **negative** (paid more than the total).
- Errors for "no data" are returned as `Data Not Found.` with a `response` of `year_error` ("Maping Year Error.", `:2036`) or `bf_error` ("No Breackoff Found.", `:2125`); F1 keeps only the message, so the two cannot be told apart — the app treats both as "no fee details for this school year".

## 5. Authentication and student identity
- Token and ids come only from the session via F1; a student cannot override `student_id` (F1 §4.2). No id is read from route params, props or text input. In-screen guards as S1–S4a: not a student → "Students only" and **no request**; no school year → "School year not set" and **no request**.
- The query key carries the user id and year; the cache is cleared on sign-out; nothing is written to disk; amounts are never logged.
- **Backend weaknesses (not fixable here; reported):** the endpoint trusts `student_id` from the request (any valid token can ask for another student's totals); it mixes the request's tenant (map-year and paid queries) with the session's tenant (breakoff join) (`:2100-2105`, `:2048-2052`); it builds SQL by string concatenation with request values (`:2105-2106`, `:2115`). The app only ever sends its own ids, from the session, as numbers.

## 6. UX and states (S6a)
**Screen:** caption "School year {syear}"; a main card "Pending fees" with the amount large, and a bar "Paid {n}% of ₹{total}" (text carries the meaning; colour only reinforces it); three rows — *Total fees for the year*, *Paid (includes any discounts)*, *Pending*; when paid exceeds the total: "Paid in advance ₹X" and Pending shows ₹0; a closing note: "These are whole-year totals. Month-wise dues, receipts and online payment are not in the app yet." (no link, no button).
| State | UI |
|---|---|
| loading, no data | existing `Loading` |
| error, no data | `ErrorState` + Try again (F1 messages). For an HTTP **500** the message is "The fees summary could not be loaded right now. If this keeps happening, please contact your school's accounts office." — it **does not claim a cause** |
| 422 year expired | the server's message ("Academic Term Date Expired") |
| `Data Not Found.` (no fee structure / no mapped year) | `EmptyState` "No fee details for school year {syear} yet" |
| error while cached | content stays + banner "Couldn't refresh — showing the last loaded data." |
| fully paid (`unpaid ≤ 0`) | main card says "No pending fees" |
| unreadable amounts | treated as an error ("The fees summary has an unexpected format."), never shown as ₹0 |
| `syear` missing / not a student | "School year not set" / "Students only"; no request |
| refreshing | pull-to-refresh |
Accessibility: the three figures are one accessible group with a spoken sentence ("Total ₹1,25,000. Paid ₹80,000, 64 percent. Pending ₹45,000."); the bar is hidden from screen readers (its words carry the meaning); touch targets are only the Try again / retry controls (≥ 44 dp).
**Money and year handling:** amounts are formatted as **₹ with Indian digit grouping** by a small pure function (`₹1,25,000`, `₹1,250.50`, trailing `.00` dropped, rounded to paise from integer paise to avoid float artefacts); no `Intl` dependency. **Currency is an assumption** — the API returns none; the web formats INR/`en-IN` (§2). The figures are for `user.syear` (the login's `mobile_syear`); there is no year switcher in V1, and the fee year can start in any month (`map_year.from_month`).
**Decisions to confirm:** **S6-D1** go/no-go (§16); **S6-D2** legacy `fees/PaidUnpaid` only (§3); **S6-D3** ₹ with Indian grouping; **S6-D4** "Pending" is the whole-year balance, labelled as such; **S6-D5** negative pending shown as "Paid in advance"; **S6-D6** the honest closing note, no pay/receipt controls; **S6-D7** never call `studentFeesDetailAPI`, `pending_fees`, `ajax_PDF_FeesReceipt` or `get_online_receipt` from the app.

## 7. Navigation and tile integration
`fees` tile → `TileScreen` (existing RBAC guard) → `screenRegistry["fees"]` → `FeesSummaryScreen`. One registry entry; removing it restores today's fallback. No new route. The dedicated screen calls a fixed path and ignores the tile's stored `api` (as S1–S4a). Home's dashboard is unchanged (the S1 dashboard does not show fees).

## 8. Security considerations
- **Financial data, handled minimally:** three numbers, in memory only (TanStack cache keyed by user, cleared on sign-out), never logged, never persisted, never put in a URL or a route param.
- **No financial action or document:** no payment, no receipt fetch/download/open, no `PayNow` link, no encrypted tokens read or stored. The parser reads only `response.breack_off_amount`, `paid_amount`, `unpaid_amount`; nothing else from the body is kept.
- **Identity:** session-only (F1); students cannot choose another `student_id`; in-screen guards; per-user cache.
- **Plain text only:** the only server text shown is the error message, as `<Text>`.
- **Never called, by design:** `studentFeesDetailAPI` (§3), `fees/get_online_receipt` (unauthenticated payment recording), `ajax_PDF_FeesReceipt`, `pending_fees`. A local test asserts that the S6a call touches only `/fees/PaidUnpaid`.
- Server-side risks recorded for the backend owners (§9), none introduced by the app.

## 9. Backend limitations and known risks — S6a is at risk
1. **Probable HTTP 500 for most students (code defect).** The two paid-amount subqueries join the standard table on the **wrong column**: `->join('standard as st', 'se.student_id', '=', 'st.id')` (`fees_collect_controller.php:2139` and `:2159`) — a student id compared with a standard id — whereas the breakoff query correctly uses `st.id = se.standard_id` (`:2102`). A student's paid rows survive only if some `standard` row happens to have the same id as the student. Otherwise the paid subquery returns nothing, `$paid_result` is an **empty Collection** — which is truthy — and `$paid_result[0]->paid_amt` (`:2179-2180`) raises "Undefined array key 0" (**[VERIFIED-NO-DB]**: an empty collection is truthy and `$c[0]` raises exactly that) → **HTTP 500**. **This is code reading, not an observed failure**: whether real students hit it depends on real ids and data, which Q16 forbids me to look at. If it holds, the production `Fees Details` tile fails for most students today, in every client.
2. A student with a fee structure and **no payments yet** reaches the same empty-collection crash even if the join were right (`:2179-2180`).
3. `unpaid_amount` is a **whole-year** balance (all 12 months), not "due so far" (`:2043-2070`, `:2184`); `paid_amount` includes discounts.
4. "No data" cases are not distinguishable (`year_error` vs `bf_error` both → `Data Not Found.`).
5. The endpoint needs a current academic year (`api.session` hydration → 422 otherwise, **[VERIFIED-LOCAL]**).
6. No ownership check (student id from the request); mixed request/session tenant; SQL built from request strings.
7. `studentFeesDetailAPI`, the only source of month-wise dues and receipts, is unusable and unsafe (§3) → **S6b/S6c cannot be built** until it is fixed.
**Backend asks (for the owners):** fix the two `standard` joins (or drop them — nothing selects from `st`); guard `$paid_result->isEmpty()`; read `student_id`/tenant from the token for students; for `studentFeesDetailAPI`: restore the JWT check, stop writing the request's tenant into the session, remove the `type`-branch `first()`-inside-`when()` bug, and stop returning `fees_html` and the encrypted payment token to clients; make `fees/get_online_receipt` require authentication.
**Consequence for the plan:** S6a is cheap to build and safe, but **may fail for most students until item 1 is fixed or disproved**. The app can only show an honest error. That is why the build is behind a go/no-go decision (S6-D1).

## 10. Dependencies
| Reused | From | Used for |
|---|---|---|
| `legacy.post` (form-encoded identity block, text-first parsing, `status:'2'`/401/419/422/500 mapping, the `response`-only body handling) | F1 | the request |
| `useStudentQuery`, `studentGate`, `StaleBanner` | S1 | guards, loading, error + retry, stale banner, per-user cache |
| `Card`, `Page`, `EmptyState`, theme tokens | existing kit | layout |
No dependency on S2–S4a code. Not used: F5, S4b, any payment/receipt code (none exists).

## 11. Exact files expected to change (all under `D:/lms_k12_mobile_rn`)
**Modified (2 — additions only):** `src/api/student.ts` (append `fetchFeeSummary()`, `parseFeeSummary()`, types), `src/screens/registry.ts` (+ `fees`).
**New:** `src/utils/money.ts` (`formatInr`), `src/screens/student/feesModel.ts` (pure: pending/credit/percent, spoken sentence, no-data mapping), `src/screens/student/FeesSummaryScreen.tsx`, `src/hooks/useFeeSummary.ts`.
Tests: `__tests__/money.test.ts`, `feesModel.test.ts`, `studentFeesApi.test.ts`, `FeesSummaryScreen.test.tsx`, `studentFees.local.test.ts` (opt-in), plus `registry.test.ts` (nine names).
No `package.json`, native, Laravel or Next.js change; no new library; S1–S4a behaviour unchanged.

## 12. Tests and acceptance criteria
**Unit:** `formatInr` — Indian grouping (`0`, `999`, `1,000`, `1,00,000`, `12,34,56,789`), paise (`1250.5` → `₹1,250.50`, `1250.00` → `₹1,250`), numeric strings, rounding (`0.005`, `0.1+0.2`), negatives refused/clamped, `NaN`/`Infinity`/`null` → not formatted; `feesModel` — pending/credit/percent (normal, fully paid, overpaid, total 0, paid > total, tiny totals), the spoken sentence, rounding of the percent, the no-data message mapping (`Data Not Found.` only, not other validation messages).
**API:** path `fees/PaidUnpaid`, **form-encoded** with the identity block and nothing else; success parsed from `response` (numbers and numeric strings); unreadable or missing amounts → an error, never zeros; `bf_error`/`year_error` bodies (`status:'0'`, `Data Not Found.`) → "no data" result; validator body with an **object** message; 422 year-expired; 401; HTTP 200 + `status:'2'` → unauthorized; 419; HTTP 500 and HTML; **no `studentFeesDetailAPI`, `pending_fees`, `ajax_PDF_FeesReceipt`, `get_online_receipt` URL is ever requested**.
**Component:** `FeesSummaryScreen` — loading; success (figures, bar words, spoken sentence); fully paid ("No pending fees"); overpaid ("Paid in advance"); no data; 500 hint without a cause claim; 422 message; other errors + Try again; stale banner; guards (no request); per-user cache; **no pay/receipt/link control exists on the screen**; `registry` — nine names.
**Regression:** all 411 existing tests pass; typecheck clean.
**Acceptance:**
1. The `fees` tile opens `FeesSummaryScreen`; removing the registry line restores the old behaviour.
2. The three figures and the bar come from `response.*` exactly, formatted as ₹ with Indian grouping; pending never shown negative; overpayment shown as "Paid in advance".
3. Every state in §6 is reachable and correct; unreadable amounts are an error, never ₹0.
4. The request is form-encoded with the session's own ids; no request for a non-student or without a school year; only `/fees/PaidUnpaid` is ever called.
5. No payment, receipt, link or token handling exists in the code.
6. `npm run typecheck` and `npm test` pass; no native/package change.
7. Local synthetic-id checks pass (§13); the real-data check is **not** claimed — and it is the only way to learn whether the §9 defect affects real students.

## 13. Local-server verification plan (synthetic ids only — Q16)
Same setup as S1–S4a: `php artisan serve --host=127.0.0.1 --port=8000`, JWTs signed locally; a **non-existent student `999999999` on tenant `1`** (and a non-existent tenant for the year case). An opt-in, loopback-only test `studentFees.local.test.ts` drives the real client and fetch functions over real HTTP:
| Check | Expected |
|---|---|
| `fetchFeeSummary()` for the non-existent student | "no data" result (the `bf_error` / `Data Not Found.` path) |
| tenant without a current academic year | `validation` "Academic Term Date Expired" |
| bad token | `unauthorized` |
| the call's URL | only `/fees/PaidUnpaid` (spy on fetch) |
| request encoding | form-encoded (a JSON body would 500 — already shown with curl) |
Already done for this document (curl, 2026-10-07): the results in §3 and §4. **Cannot be verified without real data (Q16):** the real success shape and values, whether the paid subquery returns rows for real students (§9.1), the real size of the figures, tenants where it works.

## 14. Device / coordinated-pass additions
For the later pass (you will approve the native build): the fees summary at 360 dp (large amount, bar, three rows, wrapping of long amounts such as `₹12,34,56,789.50`), the closing note, pull-to-refresh, and error/empty states.

## 15. Rollback
Delete the `fees` line in `src/screens/registry.ts` (the tile falls back to `GenericDataScreen`, today's behaviour) or `git revert` the S6a commit; the additions to `student.ts` are additive and unused afterwards; F1 and S1–S4a are unaffected. JS-only; no server or data change; nothing financial is ever written.

## 16. Decisions and questions (answered 2026-10-07: Q24 option A — build S6a; Q25 yes; Q26 S6b/c/d not documented or built yet; Q16 still open)
- **Q24 / S6-D1 — go or no-go for S6a?**
  - **Option A (recommended):** build S6a now — cheap, read-only, safe, and exactly the production tile's contract. It shows an honest error if the backend defect (§9.1) hits; when the backend is fixed it works with no app change. Tracker marks it **V1 at risk** until a real-data check or a backend fix settles §9.1.
  - **Option B:** do not build S6 now; record S6 as **V1-blocked on the backend defect**, send the §9 asks, and move to the next module (S5 results).
- **Q25** Confirm S6-D2…D7 (§6): legacy `fees/PaidUnpaid` only; ₹ with Indian grouping (currency is an assumption, §6); whole-year "Pending" label; "Paid in advance"; the honest closing note with no pay/receipt controls; never call the four listed endpoints.
- **Q26** S6b/S6c/S6d (month-wise dues, receipts, payment) are **not** proposed. Say if you want any of them documented later; they all depend on the backend fix in §9.7, and S6c/S6d are financial scopes needing your separate approval.
- **Q16 stays open** — no real student data.

## 17. What was actually done (2026-10-07)
Built as approved (Q24 option A; Q25 S6-D2…D7 yes; Q26 S6b/c/d not documented or built). **Strictly view only**: no payment, receipt, download, link or token handling exists. Everything is **uncommitted** on branch `migration/s6a-fees-summary` (created from `migration/s4a-homework-view`); you will review and approve the commit separately.

### Files (all under `D:/lms_k12_mobile_rn`)
**Modified (2 source files — additions only: +47 lines, 0 removed; S1–S4a code is untouched)**
| File | Change as built |
|---|---|
| `src/api/student.ts` | appended `fetchFeeSummary()`, `parseFeeSummary()`, `NO_FEE_DATA_MESSAGE`, `FeeSummary` (+ a strict `feeAmount` reader) |
| `src/screens/registry.ts` | + `fees` |
**New (src, 4):** `utils/money.ts` (`formatInr`), `screens/student/feesModel.ts` (`feeView`), `hooks/useFeeSummary.ts`, `screens/student/FeesSummaryScreen.tsx`.
**Tests (new, 5):** `money`, `feesModel`, `studentFeesApi`, `FeesSummaryScreen`, `studentFees.local` (opt-in); `registry.test.ts` extended (nine names + the S6a mapping).
No `package.json`, native, Laravel or Next.js change; no new library. The Laravel working tree still holds exactly the four pre-existing changes (`MobileFormFieldRegistry.php`, `routes/api.php`, `MobileBootstrapApiController.php`, `MobileBootstrapApiTest.php`) and nothing else.

### Deviations from the plan (all small; none changes a decision)
1. **`useFeeSummary` is its own `useQuery`, not `useStudentQuery`**, because the shared hook cannot turn retries off and you asked for no aggressive retrying. The app's default would retry a 5xx twice; this query never retries (`retry: false`), the student retries by hand with *Try again*. Same key shape (`user id`, `syear`) and the same sign-out cache clearing; `useStudentQuery` is untouched.
2. **`formatInr` formats a negative as `-₹1,500`** instead of refusing it (§12 said "refused/clamped"). The screen never passes a negative: `feeView` clamps pending to 0 and shows the excess as "Paid in advance".
3. **Unreadable amounts are rejected more strictly than planned:** empty string, `null`, booleans, arrays, comma-grouped text and values above 10¹² are errors ("The fees summary has an unexpected format."), because `Number('')` would otherwise turn a missing figure into ₹0.
4. **Percent bar is floored and capped at 99 while anything is pending**, so "100%" always means fully paid.
5. **Disclaimer wording** follows Q25: "These are whole-year totals as last loaded; they are not guaranteed to be real-time. Month-wise dues, receipts and online payment are not in the app yet."
6. Server failures of HTTP ≥ 500 show fee-specific wording that claims no cause; every other error keeps the shared F1 message (e.g. "Academic Term Date Expired").

### Tests (Jest) — typecheck clean; full suite: **476 passed, 0 failed, 20 skipped** (the five opt-in local suites) — S6a added 65 passing tests (was 411)
| Suite | Covers |
|---|---|
| `money.test.ts` | Indian grouping (0 … ₹12,34,56,789), paise shown only when present, float noise (0.1+0.2, 1.1×3, 19.999), negatives and "-₹0", unreadable input → "—" |
| `feesModel.test.ts` | pending from the **server's** balance, percent, fully paid, overpaid ("Paid in advance"), no 100% while pending, tiny share, total 0 (no bar), paise, spoken sentence |
| `studentFeesApi.test.ts` | path `fees/PaidUnpaid`, **form-encoded** identity block and nothing else, Bearer; **only that URL ever requested** (never detail/pending/receipt/online-receipt); cannot be pointed at another student; numbers and decimal strings, text/html, negative balance, true zeros; **ten unreadable-amount cases are errors, never zero**; `Data Not Found.` (both `bf_error` and `year_error`) → null; other validation messages are not "no data"; 422 year expired; 401; HTTP 200 + status "2"; HTTP 500 HTML; 419; network failure; one request, no retry |
| `FeesSummaryScreen.test.tsx` | loading → figures labelled whole-year; not-real-time disclaimer; spoken sentence; fully paid; overpaid; paise and grouping; **no button or link exists and no pay/receipt/download text**; empty state; **backend 500** (friendly text, no figures, no automatic retry, Try again works); **422** message; **401**; network error; **synthetic student**; unreadable amounts; stale banner after a failed refresh; non-student and no-year guards (no request); per-user cache |
| `registry.test.ts` | `fees` → `FeesSummaryScreen`; nine names |
| existing suites | all unchanged and passing |
One timing test in `text.test.ts` (`stripHtml` speed on adversarial input, from S4a) failed once during a heavy parallel run and passed on its own and in the final full run (476/476); recorded as a transient parallel-run observation, accepted at sign-off, unrelated to S6a.

### Acceptance criteria (§12)
| # | Criterion | Result |
|---|---|---|
| 1 | `fees` opens `FeesSummaryScreen`; removing the registry line restores the old behaviour | ✅ registry test; ⚠️ not seen on a device |
| 2 | three figures and the bar from `response.*`, ₹ with Indian grouping; pending never negative; overpayment as "Paid in advance" | ✅ tests |
| 3 | every §6 state reachable; unreadable amounts an error, never ₹0 | ✅ tests |
| 4 | form-encoded with the session's own ids; no request for a non-student or without a school year; only `/fees/PaidUnpaid` | ✅ tests (API, screen, local) |
| 5 | no payment, receipt, link or token handling in the code | ✅ code and tests (no button/link role, no such text) |
| 6 | typecheck and tests pass; no native/package change | ✅ |
| 7 | local synthetic-id checks pass; real-data check **not** claimed | ✅ synthetic ids only |

### Verification against the local server (read-only, synthetic ids only — Q16)
`php artisan serve --host=127.0.0.1 --port=8000`; JWTs signed locally for a **non-existent student `999999999` on tenant `1`** and on a non-existent tenant. The opt-in test drives the **real client and fetch function over real HTTP**: **4/4 passed** — no-fee-data student → `null`; bad token → `unauthorized`; tenant without a current academic year → `validation` "Academic Term Date Expired"; only `/fees/PaidUnpaid` requested. Server stopped afterwards (port 8000 free). The database was touched only by the endpoint's own SELECTs for non-existent ids.

### Backend defect — documented, not fixed (per your instruction)
**Evidence (code, read-only):**
- `app/Http/Controllers/fees/fees_collect/fees_collect_controller.php:2139` and `:2159`: the paid-amount subqueries join `standard as st` on `se.student_id = st.id` (a student id compared with a standard id), whereas the breakoff query correctly uses `st.id = se.standard_id` at `:2102`.
- `:2179-2180`: `$paid_result[0]->paid_amt` is read on a Collection that is truthy even when empty, so an empty paid result raises "Undefined array key 0" → HTTP 500. The same crash happens for a student with a fee structure and no payments yet.
- Verified without a database: an empty Collection is truthy and `$c[0]` raises exactly that error.
**What the app does:** on HTTP ≥ 500 it shows "The fees summary could not be loaded right now. If this keeps happening, please contact your school's accounts office.", no figures, a manual *Try again*, and a navigable screen. It never retries by itself and never invents values.
**Not established:** whether real students actually hit it — that needs real data (Q16) or a backend fix. No Laravel file was modified.

### Known limitations
- **No real student or fee data was read** (Q16): the real success body, the value ranges and which tenants work are verified **from code only**.
- **Not run on a device or emulator**: layout at 360 dp, long-amount wrapping, the bar and the retry flow are asserted by tests, not observed (items in §14 for the coordinated pass).
- Currency is an assumption (₹/INR, from the web's formatting); the API returns none.
- "Pending" is the whole-year balance (all months of the fee year), and "Paid" includes discounts — taken from the controller, labelled as such.
- S6b (month-wise dues), S6c (receipts) and S6d (online payment) are future scope only (S6b backend-dependent; S6c and S6d need separate financial-scope approvals) and are not documented or built.

### Rollback
1. Delete the `fees` line in `src/screens/registry.ts` (the tile falls back to `GenericDataScreen`, today's behaviour), or `git revert` the S6a commit once it exists. 2. The additions to `student.ts` are additive and unused afterwards; F1 and S1–S4a are unaffected. 3. JS-only; no server or data change was made, and nothing financial is ever written.

