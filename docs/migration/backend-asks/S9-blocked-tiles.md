# Backend ask — Hostel and Achievement Certificate (S9b)

Written 2026-10-07 for the Laravel/backend owners. **This is a request, not a change: no Laravel file was modified by the mobile migration, and the mobile app will not work around either defect (D-17, S9-D10).** Until the backend changes, the two tiles show "This isn't available in the app yet." and make no request.
Evidence cites `D:/next_lms_erp` (read-only). **[VERIFIED-LOCAL]** = observed on 2026-10-07 on a local `php artisan serve` using a non-existent student (`999999999`, tenant `1`) and a locally signed token; no real student data was read.

## Summary
| | Hostel | Achievement Certificate |
|---|---|---|
| Student tile (`screen_name`) | `student_hostel` (11 of 34 student tenants) | `achievement_certificate` (7 of 34) |
| Endpoint | `POST studentHostelAllocationAPI` | `GET document_details` |
| Route | `routes/student.php:187` | `routes/student.php:250` (named `document_details`) |
| Controller | `hostel_management/tblhostelRoomAllocationController::studentHostelAllocationAPI` `:392-` | `student/studentTransferController::DocumentTypeDetails` `:538-575` |
| Why it fails for a mobile token | the school is read from `session()->get('sub_institute_id')` (`:406`); a token-only call has no web session, so it is always empty | `sub_institute_id` is read from `session()` (`:541`), not from the request; the route has **no JWT check**; it is **GET-only** (the app's generic client POSTs first and gets 405) |
| Observed [VERIFIED-LOCAL] | `{"status_code":0,"message":"Parameter Missing"}` for a valid token | `{"status_code":0,"message":"Sub Institute Id is Required"}` |
| Result for the student | the tile can never show data | same |

## What is wanted
### 1. `studentHostelAllocationAPI`
- Take the school from the **JWT payload** (as `studentHealthAPI`, `studentHWAPI`, … already take `sub_institute_id` from the request after validating the token) instead of `session()`.
- For a **student** token, take `student_id` from the token (`id`), not from the request body, so a student cannot read another student's allocation. (Today every legacy student endpoint trusts the body.)
- Keep the response shape the mobile contract already expects: `{status_code:1, message, data:[{hostel_id, room_id, bed_no, locker_no, table_no, bedsheet_no, hostel_name, description, warden, warden_contact, room_name}]}`; `status_code:0` + `Parameter Missing` only when a parameter is really missing.
- Optional: state which of `warden`/`warden_contact` may be shown to students (they are staff contact data).

### 2. `document_details` (achievement certificates)
- Validate the JWT (today none).
- Read `sub_institute_id` from the token, not `session()`.
- Accept **POST** (every other mobile list is POST) or document that clients must use GET with the token header.
- Restrict a student token to its **own** documents (`student_id` from the token); today `student_id` is an optional filter, so the call can list every student's documents of a type in the tenant.
- Return an enveloped list (`{status_code:1, message, data:[{document_title, file_name, …}]}`) instead of a raw array; `file_name` should be a URL served through an authenticated route (today `env DO_PATH.'public/student_document/'..`, a public path).
- `document_type` is a magic number in the Flutter app (`59`); please document its meaning or expose a named type for "achievement".

## Security notes (apply to both)
- Neither endpoint should ever depend on `session()` for tenant or identity when called with a token.
- Documents (certificates, achievement files) are personal data; a public, unauthenticated file URL means anyone with the link can read it. An authenticated download route is preferred.
- After the change, please keep the old behaviour for the web (session) callers if any exist.

## Acceptance checks for the backend change (suggested)
1. A valid student token → `status_code:1` and only that student's rows; a request body naming another `student_id` returns that student's rows **never**.
2. No token → HTTP 401 `{"status":"2",…}`.
3. A tenant or student with no rows → `status_code:1` with an empty `data` list (not an error).
4. `document_details` answers POST with the same envelope.

## What the mobile app will do once the backend is fixed
Remove the `student_hostel` / `achievement_certificate` registry entries that map to `RecordUnavailableScreen`, add two thin lists to the existing S9 record-list screen (hostel: hostel name, room, bed, locker, table, bedsheet, warden; achievement certificate: document title and an "Open" button through the F1 link check), add tests, and verify with synthetic ids first. That is a new sub-module (S9b) with its own approval; nothing in this request authorises it.
