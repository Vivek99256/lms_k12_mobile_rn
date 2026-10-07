# Evidence notes

Raw survey output from step 1 (2026-10-07), compiled by read-only sub-agents. Every claim in them carries a file:line into `D:/next_lms_erp` or `D:/lms_k12`.

**Trust level:** compiled by agents, NOT re-read in full by the lead. Treat as a pointer, and re-verify the exact lines before a sub-module's document depends on them.

Spot-verified by the lead against code on 2026-10-07 (all matched):
- `routes/api.php:95` api-login, `:100` mobile/bootstrap, `:106` web-handoff
- `routes/student.php:179-243` legacy `*API` student/teacher routes; `routes/fees.php:327` studentFeesDetailAPI
- `apiController.php:336-343` OTP token payload has `student_id`, no `id`, no `exp`
- `ApiLoginController.php:426-432` token expiry only if `JWT_TTL_MINUTES>0`
- `MobileBootstrapApiController.php:61-63` host is prefixed onto every non-empty `web_url`
- `lms_k12/app/hooks/useMenuRights.ts:131` `/api/menu-rights`; `contexts/AuthContext.tsx:221` login

| File | Content | Known gaps (stated by its author) |
|---|---|---|
| backend_auth.md | login, token, middleware, envelopes, roles/rights tables, mobile endpoints | `screen_name` values live in DB rows, not code; `/api/attendance/*` auth unverified |
| backend_routes_A.md | 964 routes of api/teacherapi/adminapi/resultapi/easycomapi/etc; §3 = 51 hand-verified endpoints | "Purpose" column in §8 derived from method names; per-method auth is a script grep (hint only) |
| backend_routes_B.md | module route files (student, fees, lms, hrms, result, g2g_lms, pal, task/talent mgmt …) | `routes/api.php` LMS/fees/HRMS JSON beyond cited lines not surveyed |
| web_core.md | web auth, menu-rights, UI blocks, data-fetch patterns, services | school-ERP endpoints in ~36 `legacyRequest` files not enumerated |
| web_modules.md | 1045 pages by folder, what each does, endpoints (sampled), hard-on-mobile list, dead/duplicate groups | endpoint lists are sampled, not exhaustive |

## Added in step 2 (2026-10-07)
| File | Content | Trust |
|---|---|---|
| menu_tiles.txt | Distinct active mobile menu tiles per role with number of tenants (output of a read-only SELECT on `mobile_homescreen`, `teacher_mobile_homescreen`; `status='Yes'`) | primary data |
| menu_tiles_query.php.txt | the exact read-only script (SELECT only) | primary |
| student_tiles_backend.md | each student tile endpoint → route, auth, params, tables, response (agent-compiled, line-cited) | spot-checked: web.php:476, student.php:224, fees.php:258, lms.php:365, adminapi.php:93 |
| teacher_tiles_backend.md | each teacher/admin tile → Flutter call → backend route/auth/params/tables + defects | spot-checked: web.php:638 `/lms_data`, `VerifyCsrfToken.php:20-26` |
| flutter_ref.md | Flutter app screens → endpoints (reference; its docs state endpoints were not run against a live server) | reference only |
