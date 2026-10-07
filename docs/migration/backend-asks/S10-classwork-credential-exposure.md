# Backend security ask — classwork endpoint exposes embedded staff and student records (S10b)

Written 2026-10-07 for the Laravel/backend owners. **Severity: high.** This is a request and a warning, not a change: **no Laravel file was modified by the mobile migration.** The mobile app **must not call this endpoint** until the response is safely scoped and sanitised, and it does not: the Classwork Gallery tile shows "This isn't available in the app yet." / "Please ask your school." and makes no request (S10-D6).
Evidence cites `D:/next_lms_erp` (read-only). **[VERIFIED-NO-DB]** = established by reading code, not by observing real rows (the migration is forbidden from reading real data while Q16 is open). **[VERIFIED-LOCAL]** = observed on 2026-10-07 on a local `php artisan serve` with a locally signed token for a non-existent student (`999999999`, tenant `1`); that call returned an empty `sentData`, so it shows the response *shape* only.

## The endpoint
- `GET front_desk/send_attachment/create`, a resource route in the group `['api.session', 'session', 'menu', 'logRoute']` (`routes/student.php:205-215`), handled by `classworkAttachmentController::create` (`app/Http/Controllers/front_desk/classworkAttachmentController.php:77-130`).
- It is the endpoint the Flutter student app uses for "Classwork Gallery" (ev:flutter_ref.md: `info.dart:116`) and the endpoint behind the staff web report. The production student menu row for `classwork_gallery` (7 tenants) has no `api` of its own.

## What is wrong
### 1. The response embeds whole user and student records — including credentials
`create` returns `classWorkModel::with(['student', 'createdBy', 'updatedBy'])->…->toArray()` (`classworkAttachmentController.php:113`), so **every row** of `sentData` contains:
- `created_by` / `updated_by` → the **complete `tbluser` row** of the staff member who created / updated the classwork (`app/Models/front_desk/classWorkModel.php:20-27`, relation to `tbluserModel`);
- `student` → the **complete `tblstudent` row** of the student the classwork is for.

Neither `app/Models/user/tbluserModel.php` nor `app/Models/student/tblstudentModel.php` defines `$hidden` or `$visible` (searched: none), so nothing is removed on serialisation. `tbluserModel` lists, among its attributes, **`password`, `plain_password` and `otp`** (`tbluserModel.php:13-40`), as well as mobile, email, address and birth date. The ERP also *logs in* against `plain_password` (`app/Http/Controllers/api/ApiLoginController.php:327`).
**Consequence:** any client that can call this endpoint receives, for every classwork row, the staff member's plain-text password (if populated), OTP and personal data, and the student's full record. A student's phone would receive the **teacher's login credentials**. The staff web report receives the same data in the browser.
**[VERIFIED-NO-DB]** by code. **[VERIFIED-LOCAL]** shape only: `{"from_date":…,"to_date":…,"sentData":[]}` for a synthetic student.

### 2. Omitting `student_id` returns classwork across students
`student_id` is an **optional filter**: `->when($request->has('student_id'), …)` (`:119`). Without it the query returns every classwork row of the tenant and year (`:113-123`), for all students, each with the embedded records above. With it, the value is taken from the request with no check that it belongs to the caller's token.

### 3. Tenant and year come from the request
With `type=API` (or `JSON`) the school and year are read from the request (`:106-107`) after a JWT *signature* check (`:85-98`), so a token for one school can ask for another school's classwork.

## What is wanted
1. **Never serialise credentials.** Add `$hidden = ['password', 'plain_password', 'otp', …]` (and any other secret column) to `tbluserModel`, and review `tblstudentModel` for sensitive columns. This protects every endpoint that serialises these models, not only this one.
2. **Return only what each client needs.** For this endpoint select explicit columns (`id, title, file_path, created_at`, and display names if needed) instead of `with(['student','createdBy','updatedBy'])->toArray()`.
3. **Scope by identity.** For a student token take `student_id` from the token and ignore the request value; for staff, require a class/student scope; never return all students when `student_id` is missing.
4. **Take the school and year from the token** (or validate them against it), not from the request.
5. **Consider rotating** any credential that may have been exposed through this response, and removing the `plain_password` column from API-visible models entirely.
6. Serve the attachment files (`file_path`) through an authenticated route rather than a public path.

## Acceptance checks for the backend change (suggested)
- A classwork response contains no `password`, `plain_password`, `otp`, `mobile`, `address` or other user/student column that the screen does not display (a JSON key scan of a real response).
- A student token returns only that student's rows; a request naming another `student_id`, or omitting it, never returns other students' rows.
- A token for school A cannot read school B's classwork.
- The same checks for any other endpoint that serialises `tbluserModel` or `tblstudentModel` through relations (a quick grep for `->with(` on those relations is worth doing).

## What the mobile app does meanwhile
Nothing: the tile is an honest "not available" message and the app never calls the endpoint, never sanitises or partially consumes its response as a workaround, and never requests it even with a `student_id`. Once the backend change is made and verified, a new sub-module (with its own document and approval) could list the classwork as a text/link list; nothing here authorises it.
