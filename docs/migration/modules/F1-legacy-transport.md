# F1 — Legacy transport, identity and envelope adapter

Status: **DONE** — implemented, tested and verified locally (2026-10-07); signed off by you 2026-10-07. Document approved 2026-10-07 (Q14, Q15).
Class: V1 foundation · Depends on: nothing · Blocks: every sub-module that calls a legacy endpoint (all of S1-S10, T2-T12, A2-A3) · Decisions it implements: D-09, D-12, D-13, D-14 (see [02-decisions.md](../02-decisions.md)).
Facts cite file:line. `ev:` = [evidence/](../evidence/README.md). **[ASSUMPTION]** marks anything not read from code. **[VERIFIED-LOCAL]** = observed on the local Laravel server on 2026-10-07 (see §10).

## 1. What the user gets
Nothing visible by itself. F1 makes the app able to talk to the ERP's legacy endpoints correctly and safely, so S2 (and every later module) works. It also stops two latent problems in the current client: (a) tile endpoints can send the user's token to whatever host the database row names, (b) a dev build silently calls production.

## 2. Existing web screens and Laravel APIs reused
- **Web screens:** none (this is plumbing). The web equivalent of the transport is `legacyRequest` in `D:/lms_k12/lib/erp-legacy.ts:158` (relays through `/api/proxy`, treats body `status` `'0'`/`'2'` as failure, unwraps Laravel `{errors:{f:[msg]}}`) — ev:web_core.md §4. Mobile calls the ERP directly, so it needs its own equivalent.
- **Laravel:** no endpoint is added or changed. The behaviour F1 must satisfy:
  | Fact | Evidence |
  |---|---|
  | Legacy endpoints are bare paths (`/studentAttendanceAPI`), not `/api/...`; `api.jwt` never applies; auth = valid JWT signature; ids come from the request | ev:student_tiles_backend.md "Global facts"; `routes/student.php:179` |
  | Token read from `Authorization: Bearer` **or** input `token` | `vendor/generationtux/jwt-artisan/src/GetsJwtToken.php:31-39` (ev:backend_routes_A.md §2.1) — **[VERIFIED-LOCAL]** both work |
  | `teacherapiController::resolveActingTeacherId` reads the payload from the **header only** | `teacherapiController.php:66-73` (ev:teacher_tiles_backend.md §0) → always send the header |
  | Some endpoints skip auth unless `type=API` is sent; `fees/PaidUnpaid` needs it to hydrate the session | ev:student_tiles_backend.md caveat 2 |
  | CSRF: web-group POSTs return **419** unless host is `erp.triz.co.in`, `dev.triz.co.in`, `127.0.0.1:8000` or path is `circular/*`, `fees/*`, `api/*` | `app/Http/Middleware/VerifyCsrfToken.php:20-26` — **[VERIFIED-LOCAL]** `localhost:8000` → 419, `127.0.0.1:8000` → ok |
  | Responses are `json_encode` strings served as `text/html` (HTTP 200 even for "Parameter Missing"); 401 bodies are `{status:'2',message,data:[]}` | **[VERIFIED-LOCAL]**; ev:student_tiles_backend.md caveats 5-6 |
  | Some controllers read `$_REQUEST` (does not parse JSON bodies); `$request->input` parses both | ev:backend_routes_A.md §3 row 41. **[VERIFIED-LOCAL]** `studentAttendanceAPI` accepted form-encoded, JSON, and body-`token` |
  | Validation failures often HTTP 200 with only a `response` key | ev:teacher_tiles_backend.md caveat 6 (e.g. `adminapiController.php:206-228`) |

## 3. Current mobile code that F1 touches (read 2026-10-07)
| File | Relevant lines | Behaviour today |
|---|---|---|
| `src/api/client.ts` | 7-11 `SessionContext {token, subInstituteId, syear}` | no user id / profile → cannot build the legacy identity block |
| | 39-46 `buildUrl` | absolute URLs pass through unchanged → token sent to any host |
| | 63-72 headers/body | JSON only; `common` = `type, sub_institute_id, syear`; token also in body/query |
| | 88-94 | `await res.json()`; on failure only 401/403 tolerated |
| | 117-130 `callAuto` | POST then GET fallback on 404/405 |
| `src/api/envelope.ts` | 29-54 | success if no status key even for a `{response:{...}}`-only body; 419 falls into the generic `>= 400` branch |
| `src/auth/authStore.ts` | 71-80 `configureApi.getSession` | returns `{token, subInstituteId, syear}` only |
| `src/auth/types.ts` | 2-14 `AuthUser` | already has `id, userProfileId, userProfileName, isStudent, subInstituteId, syear` |
| `src/screens/shared/GenericDataScreen.tsx` | 13-24 | `callAuto(tile.api!, parseApiParam(tile.apiParam))` |
| `src/config/env.ts` | 1-4 | `apiBaseUrl`, `appEnv` |
| `__tests__/client.test.ts` | 7-8 mock `res.json()` | tests must be updated for text-first parsing |

## 4. Design
### 4.1 Session context carries the user identity
`SessionContext` gains `userId`, `userProfileId`, `userProfileName`, `isStudent` (all from `AuthUser`; `authStore.ts` `getSession` passes them). Nothing new is stored; `AuthUser` already holds them (`auth/types.ts:2-14`).

### 4.2 `legacy: true` request option (additive)
`RequestOptions.legacy?: boolean`. When set:
- **Identity block** is added (names exactly as the Flutter app sends them and the backend reads them — ev:flutter_ref.md "Auth", `legacy_api.dart:32-43`): `token, sub_institute_id, syear, user_id, teacher_id, admin_id, student_id, user_profile_id, user_profile_name, type=API`. `user_id/teacher_id/admin_id/student_id` all default to the signed-in user's `id`.
- **Encoding:** `application/x-www-form-urlencoded` for POST (works for both `$request->input` and `$_REQUEST` — **[VERIFIED-LOCAL]** for `input`; `$_REQUEST` is standard PHP behaviour **[ASSUMPTION]** for urlencoded POST); GET sends the same fields as query. Multipart/file upload is **not** part of F1 — it belongs to F5 (needs library approval).
- **Header:** always `Authorization: Bearer <token>` (some controllers read header only).
- **Overrides (security rule D-09):**
  | Field | Caller may override? |
  |---|---|
  | `token`, `sub_institute_id`, `type`, `user_profile_id`, `user_profile_name` | **No** — pinned to the session (tenant and role cannot be changed by a screen) |
  | `syear` | Yes (future academic-year picker) |
  | `student_id` | Yes **only for staff roles** (e.g. teacher selects a student). For a student session it is always the student's own id — the override is ignored |
  | `user_id`, `teacher_id`, `admin_id` | Yes for staff (admin acting on behalf is a documented backend feature, `teacherapiController.php:112-125`); ignored for students |
- Calls without `legacy` behave exactly as today (JSON, `api/...` routes).

### 4.3 Response handling
- Read `await res.text()` and `JSON.parse` it, regardless of `Content-Type` (legacy answers `text/html`). Empty body with 401/403 → `{}` (unchanged). Any other non-JSON → `ApiError('server', 'The server returned an unexpected response.')` (unchanged message). **No attempt to strip PHP warnings from the body** (a hack that could hide real faults).
- `normalizeEnvelope` additions (all keep current behaviour for existing shapes):
  1. HTTP **419** → `ApiError('server', 'The server rejected the request. Check the app\'s server address.', 419)` (CSRF host rule, C2).
  2. A body with a `response` object and **no** `status`, `status_code`, `success` or `data` → `ApiError('validation', <first message>, status, fieldErrors)`. (Today it is silently accepted as success.)
  3. Unchanged on purpose: `status:'1'` + `response` (WRT report returns that on validation failure — a backend defect; recorded in ev:student_tiles_backend.md; S5 handles it per-endpoint).
- `ApiError.kind` set is unchanged (no new kinds).

### 4.4 Host allow-list and re-basing (D-13, security)
New `src/api/url.ts` `resolveUrl(pathOrUrl)`; `buildUrl` calls it.
| Input | Result |
|---|---|
| relative path | `env.apiBaseUrl` + path (as today) |
| absolute URL whose host equals the host of `env.apiBaseUrl` | unchanged |
| absolute URL whose host is in the ERP host list (`erp.triz.co.in`, `dev.triz.co.in`; configurable `EXPO_PUBLIC_ERP_HOSTS`, added to `.env.example`) | **path + query kept, origin replaced by `env.apiBaseUrl`** |
| any other absolute host | `ApiError('config', 'Blocked a request to an unknown server.')` — the token is never sent |
Reason: tile `api` values are DB text (`https://erp.triz.co.in/...` in the data I read — ev:menu_tiles.txt). Without this, a dev build calls production, and a wrong/malicious tile row could receive the bearer token. `web-handoff` URLs go to `Linking.openURL`, not `request()`, so they are unaffected.

### 4.5 Convenience wrapper
New `src/api/legacy.ts`: `legacy.post<T>(path, fields?)` and `legacy.get<T>(path, fields?)` = `api.post/get` with `legacy: true`. Typed per-module functions (e.g. `src/api/student.ts` in S2) use these. `callAuto` stays for generic tiles.

## 5. Exact files that will change
| File | Change |
|---|---|
| `src/api/client.ts` | `SessionContext` fields; `RequestOptions.legacy`; identity/override logic; urlencoded body; text-first parse; `buildUrl` → `resolveUrl` |
| `src/api/envelope.ts` | 419 branch; `response`-only → validation |
| `src/api/url.ts` (**new**) | `resolveUrl`, `isAllowedErpHost` |
| `src/api/legacy.ts` (**new**) | `legacy.get/post` |
| `src/auth/authStore.ts` | `getSession` returns the extra identity fields |
| `src/config/env.ts` | `erpHosts` list from `EXPO_PUBLIC_ERP_HOSTS` (default the two hosts) |
| `.env.example` | document `EXPO_PUBLIC_ERP_HOSTS`; note local dev `http://127.0.0.1:8000` rule |
| `__tests__/client.test.ts` | `respond()` helper gets `text()`; existing 5 tests kept passing |
| `__tests__/legacyTransport.test.ts`, `__tests__/url.test.ts` (**new**), `__tests__/envelope.test.ts` | new cases (§8) |
No native module, no `package.json` change, no new library → **OTA-deliverable** (README OTA notes), fingerprint unchanged.

## 6. Contracts
Request examples (legacy student session, id 123, school 7, year 2026):
```
POST {base}/studentAttendanceAPI
Authorization: Bearer <jwt>
Content-Type: application/x-www-form-urlencoded
token=<jwt>&sub_institute_id=7&syear=2026&user_id=123&teacher_id=123&admin_id=123&student_id=123&user_profile_id=<n>&user_profile_name=Student&type=API
```
Response handling table (what the app does with each observed server answer):
| Server answer | Evidence | App result |
|---|---|---|
| 200 `{"status":1,"message":"Success","data":{...}}` text/html | VERIFIED-LOCAL | `Envelope.data` |
| 200 `{"status":0,"message":"Parameter Missing"}` | VERIFIED-LOCAL | `ApiError('validation','Parameter Missing')` |
| 401 `{"status":"2","message":"JWT token is required."/"Token Auth Failed","data":[]}` | VERIFIED-LOCAL | `ApiError('unauthorized')` → `onUnauthorized` → sign-out (existing) |
| 419 (host not CSRF-exempt) | VERIFIED-LOCAL | friendly `server` error, **no sign-out** |
| 200 `{"response":{"field":["msg"]}}` | ev:teacher_tiles_backend.md c.6 | `validation` error with message (new) |
| 200 `{"status":"2",...}` (fees, WRT return 200) | ev:student_tiles_backend.md rows | `unauthorized` (existing) |
| 5xx / HTML | | `server` error (existing) |

## 7. Authentication and identity handling
- Token source: `useAuthStore` (SecureStore) — unchanged. Identity comes only from the session; no screen passes ids from route params, user input or deep links (D-09).
- A student token's `id` is `tblstudent.id` and equals the login `data.id`, so `student_id = user.id` (ev:student_tiles_backend.md global facts; `ApiLoginController.php:413-420,442`). `syear` is not in the token: use `user.syear` (= login `mobile_syear`); if it is null the screen must show "School year not configured" (S2 §6).
- Backend weakness to remember: the server does **not** compare body ids with the token (any valid token can read any student). The app mitigates by never letting a student session choose another id; real enforcement is a backend ask (03 §7).
- Tokens are never logged; error messages never include the token or URL query.

## 8. Tests (unit; Jest, existing setup `jest-expo`)
| Test | Asserts |
|---|---|
| legacy identity (student) | POST body contains all identity fields with the student id; header Bearer; `Content-Type` urlencoded |
| legacy GET | identity in the query string |
| override rules | student: `student_id` override ignored; staff: honoured; `sub_institute_id`/`type`/`user_profile_*` never overridable; `syear` overridable |
| text-first parse | body served as non-JSON content-type still parses; invalid → `server` error; empty 401 → `unauthorized` |
| 419 | friendly message, no `onUnauthorized` call |
| `response`-only | → `validation` with first message; `status:'1'`+`response` still success |
| url.resolveUrl | relative; same host; `erp.triz.co.in` rebased onto `dev.triz.co.in` base keeping path+query; unknown host → `config` error and **fetch not called**; look-alike hosts (`erp.triz.co.in.evil.com`, `evil.com/erp.triz.co.in`) rejected |
| non-legacy regression | existing 5 client tests + envelope tests unchanged and passing |
Integration: manual against the local Laravel server (§10) — covered in S2's verification, since F1 has no UI.

## 9. Acceptance criteria
1. `npm run typecheck` and `npm test` pass (existing 20 tests + new ones).
2. A legacy call sends exactly the identity block in §4.2; a student session cannot send another `student_id`.
3. A tile endpoint whose DB URL is `https://erp.triz.co.in/x` is requested at `{EXPO_PUBLIC_API_BASE_URL}/x`; an unknown host never receives a request.
4. 419 shows a clear message and does not sign the user out; `{response:{…}}`-only bodies surface as validation errors.
5. No change to non-legacy calls except text-first parsing, the 419 message, and URL resolution; no native/package changes.
6. Against the local server, `POST /studentAttendanceAPI` with the legacy block returns the success envelope (done as part of S2's acceptance).

## 10. Verification already done (read-only, local, 2026-10-07)
Local `php artisan serve --host=127.0.0.1 --port=8000` (APP_ENV=local), token signed locally with the app's own secret via a scratch script (no DB, no credentials; scratch files are outside the repo). Probed `POST /studentAttendanceAPI`:
| Probe | Result |
|---|---|
| no token | 401 `{"status":"2","message":"JWT token is required.","data":[]}` (application/json) |
| `Host: localhost:8000`, no token | **419** |
| invalid token | 401 `{"status":"2","message":"Token Auth Failed","data":[]}` |
| valid token, no ids | 200 text/html `{"status":0,"message":"Parameter Missing"}` |
| valid token + `student_id=0&sub_institute_id=0&syear=2026&type=API` form-encoded | 200 text/html `{"status":1,"message":"Success","data":{"attendance_data":[],"calendar_data":{"holiday":[],"event":[],"vacation":[]}}}` |
| same, JSON body | same success |
| token only in body field `token` (no header) | same success |
Server stopped afterwards (port 8000 free). The only data read was three `SELECT`s for a non-existent student id 0. **Not verified:** real login (needs a test account — open question Q12), real attendance rows, `$_REQUEST`-based controllers.

## 11. Dependencies and rollback
- Depends on: nothing. Blocks: S1-S10, T*, A*.
- **Rollback:** F1 is additive behind `legacy: true`; the only global changes are text-first parsing, the 419 message and URL resolution. `git revert` of the F1 commit restores the old client. Because it is JS-only, an EAS Update rollback (`eas update:rollback`, README) also works once OTA is configured.
- Risk: URL resolution changes `GenericDataScreen` behaviour for tiles (re-based host). Mitigation: unit tests + the allow-list default includes both known hosts.

## 12. Local development rules this implies (for step 4)
- Local base URL must be `http://127.0.0.1:8000` (exact string) — `localhost:8000` and LAN/emulator hosts (`10.0.2.2`, `192.168.x.x`) get 419 on most legacy endpoints. Android emulator/device: `adb reverse tcp:8000 tcp:8000`. iOS simulator: 127.0.0.1 works. Cleartext HTTP is acceptable in debug builds only **[ASSUMPTION — to confirm when the first dev build runs]**; release builds use HTTPS.
- Never point a dev build at `erp.triz.co.in` (production). With F1, tile URLs follow `EXPO_PUBLIC_API_BASE_URL`.
- The local server uses the `.env` database (`DB_HOST` is a remote host). Whether that database is production data is **unknown** — Q12.


## 13. What was actually done (2026-10-07)
### Files (all under `D:/lms_k12_mobile_rn`)
| File | Change as built |
|---|---|
| `src/api/client.ts` | `SessionContext` + `userId/userProfileId/userProfileName/isStudent`; `RequestOptions.legacy`; exported `legacyFields()` (identity block + override rules); form-urlencoded body for legacy POST, query for legacy GET, Bearer header always; text-first `readJson()`; `buildUrl` → `resolveUrl`; 419 tolerated as a non-JSON body. The non-legacy path is unchanged apart from those shared steps |
| `src/api/url.ts` (new) | `resolveUrl()`, `DEFAULT_ERP_HOSTS`; hand-parsed (no `URL`); rejects `user@host`, other ports, look-alike hosts; scheme downgrade impossible (always rebuilt on the base) |
| `src/api/legacy.ts` (new) | `legacy.get/post(path, fields?)` |
| `src/api/envelope.ts` | 419 branch; `response`-only body → `validation` |
| `src/auth/authStore.ts` | `getSession` returns the identity fields |
| `src/config/env.ts`, `.env.example` | `erpHosts` from `EXPO_PUBLIC_ERP_HOSTS`; local-dev note |
| `__tests__/client.test.ts`, `envelope.test.ts` | mocks give `text()` instead of `json()`; env mock gets `erpHosts`; 4 new envelope tests |
| `__tests__/legacyTransport.test.ts` (new), `__tests__/url.test.ts` (new) | see below |
No native module, no `package.json` change, no Laravel/Next.js change. OTA-deliverable.

### Deviations from the plan (all small; none changes a decision)
1. `readJson` also reports "not JSON" when `text()` resolves a non-string or rejects (found because jest-expo's stub `fetch` resolves `undefined`); covered by a test.
2. Legacy extra fields that are arrays/objects are now **rejected** with a `config` error (the plan only said callers must flatten). The future teacher attendance form (`student[<id>]=P`) will flatten the keys itself.
3. A 419 with an HTML body is handled in the client (treated like an empty JSON body) so the envelope's 419 branch is reached; the plan described only the envelope part.

### Tests (Jest)
- `legacyFields`: identity block; token/tenant/type/role cannot be overridden; **a student cannot change `student_id`/`user_id`/`teacher_id`/`admin_id`**; an unknown role fails closed; staff may choose the student/acting id and `syear`; missing fields are omitted.
- Requests: form-encoded POST with Bearer + identity, GET query, extra fields, object values rejected, non-legacy calls unchanged.
- **Token protection:** an unknown host means no fetch at all; look-alike hosts; production tile URL re-based; no token in error messages.
- **Response parsing:** JSON served as text/html; BOM/whitespace; HTML on a 200 → server error; unreadable body; 401 with legacy body and with empty body; HTTP-200 `status:'2'`; "Parameter Missing" without sign-out; `response`-only body.
- **419:** HTML page and empty body, no sign-out.
- `resolveUrl`: relative; re-base keeping path and query; case-insensitive; scheme downgrade; local base; 6 look-alike / URL-trick cases; custom host list; missing base.
- Whole suite after F1 + S2: **100 passed, 1 skipped (the opt-in local test), 0 failed**. `npm run typecheck` clean. (Baseline before this work: 20 tests.)

### Acceptance criteria (§9)
| # | Criterion | Result |
|---|---|---|
| 1 | typecheck + tests pass | ✅ |
| 2 | exact identity block; a student cannot send another `student_id` | ✅ unit tests |
| 3 | tile URL re-based; unknown host never receives a request | ✅ unit tests |
| 4 | 419 friendly message without sign-out; `response`-only → validation | ✅ unit tests **and** real HTTP against the local server (below) |
| 5 | non-legacy calls unchanged except text parsing, 419, URL resolution; no native/package change | ✅ (the 20 existing tests pass unchanged apart from the mock shape) |
| 6 | the local server returns the success envelope for a legacy call | ✅ (id 0, no rows; see S2 §13) |

### Verification against the local server (read-only, 2026-10-07)
`php artisan serve --host=127.0.0.1 --port=8000`; JWT signed locally with the app's own secret (no credentials). Real HTTP (a Node `http` shim, because jest-expo stubs `fetch`) through the **real client code**:
- success: `legacy.post('studentAttendanceAPI')` with student id 0 → parsed to empty lists (run 3 times; the first attempt hit jest's 5 s default timeout because the database is remote — the opt-in test now allows 30 s);
- bad token → `unauthorized`, 401 "Token Auth Failed" — verified;
- base `http://localhost:8000` → `server` 419 "The server rejected the request. Check the app's server address." — verified;
- the opt-in test refuses any base URL that is not loopback (checked with `https://erp.triz.co.in`).
Server stopped afterwards (port 8000 free). Only SELECTs for the non-existent student id 0 reached the remote database.

### Known limitations
- `$_REQUEST`-reading controllers with urlencoded bodies are standard PHP behaviour but were **not** exercised (no such endpoint in S2). Re-verify with the first module that uses one.
- Multipart/file upload is deferred to F5, as planned.
- `GenericDataScreen` still sends non-legacy JSON (no `student_id`) for absolute tile URLs; it only gains re-basing and host blocking. A legacy-aware generic screen is a later decision (F2).
- Jest's `fetch` is a stub, so unit tests mock `text()`; real-HTTP behaviour is covered only by the opt-in local test.
- The whole app was not run on a device or emulator in this step.

### Rollback
1. `git revert` the F1 change set (files above). S2 depends on F1, so revert S2 first (or just remove its registry line).
2. JS-only: once EAS Update is configured, `eas update:rollback --channel <channel>` also works.
3. No server or data change was made, so nothing needs undoing remotely.
