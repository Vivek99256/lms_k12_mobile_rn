# Backend ask — `GET api/own-profile`: role detection and the academic-year dependency (S13)

Written 2026-10-07 for the Laravel/backend owners. This is a request, not a change: **no Laravel file was modified by the mobile migration.** The mobile app protects itself with a mandatory, fail-closed identity cross-check (below) and does not rely on any of these being fixed. All evidence is **[VERIFIED-NO-DB]** — read from code; no probe was made for the research, and whether any real school is affected cannot be known without real data (Q16).

## The endpoint
`GET api/own-profile` — `routes/api.php:98` (group `api.session`), `App\Http\Controllers\api\OwnProfileApiController::show`, `app/Http/Controllers/api/OwnProfileApiController.php:13-46`. It returns the caller's own name, email, mobile, birthdate, join/admission year, address, image file name, profile name and school name. The mobile Profile tab uses it for an on-demand "My details" card.

## 1. Student vs staff is decided by the exact text "Student" in a display name
`$isStudent = $request->session()->get('user_profile_name') === 'Student';` (`:17`).
That session value is **the name of the profile-master row** for the token's `user_profile_id` (`app/Http/Middleware/Concerns/HydratesLegacyApiSession.php:102-107`, stored at `:131`), i.e. a free-text label an administrator can rename. The token itself already carries an authoritative flag — `is_student` (`HydratesLegacyApiSession.php:71`, stored as session `is_student` at `:135`) — which this controller does not use.

## 2. Potential wrong-person lookup
If a school's student profile is not named exactly `Student` (for example `STUDENT`, `Students`, `Student ` with a trailing space, or a translated name), a student's token takes the **staff branch** (`:21`): `tbluser` is queried with `id = <the student's numeric id>` and the school id. `tblstudent.id` and `tbluser.id` are separate number sequences, so that number can belong to **a different person — a staff member of the same school**. The response then carries that person's full name, email, mobile, birthdate, join year and address under the student's session.
The reverse also exists: a staff token whose profile is named exactly `Student` would be looked up in `tblstudent`.
Nothing in the request or response says which table answered, so a client cannot tell the difference except by comparing the returned identity with the signed-in user — which is what the mobile app now does.

## 3. Authorization should follow the authenticated user's real role/type, not display text
Please decide student vs staff from the token (`is_student`, or the token's `user_profile_id` mapped to a **type** column rather than a name), and apply the same rule everywhere the legacy code compares `user_profile_name` to a literal. A profile rename must never change which person's data a token can read. Consider returning the table/type that answered (`"account_type": "student"|"staff"`) so clients can assert it.

## 4. The academic-year dependency
`own-profile` sits behind `api.session`, which answers **422 `Academic Term Date Expired`** when the school has no academic-year row covering today (`HydratesLegacyApiSession.php`, the `$currentTerm` check). A person's profile does not depend on the academic year, but a school without a current year cannot show it. Please let this route skip the term lookup (or fall back to the last known year).

## 5. Smaller items
- The response includes the internal `id` and an `image` that is a bare file name (no URL or folder), neither of which a client can use safely; consider removing `id` and returning an absolute `image_url`.
- `status = 1` is required (`:20-21`); an inactive account gets 404 "Profile not found.", which is correct but indistinguishable from "wrong table".

## What is wanted
1. Use the token's `is_student` (or a profile **type**) instead of the literal name `Student` (`OwnProfileApiController.php:17`).
2. Assert, after the lookup, that the row belongs to the token's account (for example, email equals the token's email) and return an error otherwise.
3. Exempt `own-profile` from the 422 academic-year check.
4. Optionally add `account_type` to the response and drop the internal `id`.

## Acceptance checks for the backend change (suggested)
- A student whose profile-master name is `STUDENT`, `Students` or `Student ` still gets their **own** student record (never a staff row).
- A staff token never gets a `tblstudent` row.
- Renaming a profile in the master table does not change which person a token reads.
- A school with no current academic year still returns the caller's profile.

## What the mobile app does meanwhile
The Profile tab fetches the record only when the user taps **Show my details**, checks that it is the same person (the server email equals the login email, case-insensitively; if the server email is empty, the full name equals the login name), and otherwise shows only "Your details can't be shown right now." — nothing from a rejected response is displayed or kept. A 422 shows the server's message with Try again. No legacy fallback exists, and no id is ever sent.
