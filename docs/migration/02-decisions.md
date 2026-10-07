# 02 — Decision log

Every decision: **proposal → reason → evidence → state**. State is `PROPOSED` until the owners approve; nothing may depend on a `PROPOSED` decision. Facts vs assumptions are marked.

## D-01 Documentation lives in `docs/migration/` of this repo — PROPOSED
- Layout in [README.md](README.md); tracker is the single file [STATUS.md](STATUS.md); one doc per sub-module under `docs/migration/modules/` from step 3.
- Reason: the brief requires docs in this repo and a single tracker; `docs/` does not exist yet (`ls` of repo root).

## D-02 Keep React Navigation; do not adopt Expo Router — PROPOSED, **needs your answer (Q3)**
- Evidence: code uses `@react-navigation/*` (`package.json`, `src/navigation/RootNavigator.tsx:1-4`) with a single `Tile` route gated by RBAC (`TileScreen.tsx`); `AGENTS.md` says "Use Expo Router … `src/app/`" but no such folder exists.
- Reason: brief says follow the existing codebase and don't reorganise; the menu-tile gate depends on the current navigator. Switching would be a rewrite with no user benefit.
- Consequence: `AGENTS.md` is out of date; propose editing that one line only after approval.

## D-03 Folder convention for new work: follow the existing layout — PROPOSED
- Screens: `src/screens/<module>/<ScreenName>.tsx`, registered in `src/screens/registry.ts` by backend `screen_name` (the registry is empty and was designed for this: `registry.ts:10-14`).
- API calls: `src/api/<module>.ts` using `api`/`callAuto` from `src/api/client.ts`, one typed function per endpoint, types beside them. Server state via TanStack Query hooks `src/hooks/use<Thing>.ts` (pattern: `hooks/useBootstrap.ts`).
- Shared UI: extend `src/components/ui.tsx` / add files in `src/components/`; theme tokens only from `src/config/theme.ts`.
- Tests: `__tests__/<module>.test.ts` (Jest, pattern of existing tests); pure logic is unit-tested, as today.
- Reason/evidence: structure listed in 01-understanding §A. No reorganisation.

## D-04 Auth: log in with `/api/api-login` only; keep the current client — PROPOSED, **parent flow is Q2**
- Evidence: only `api-login` tokens carry `id`, which `api.session` requires (`HydratesLegacyApiSession.php:73-75`); OTP tokens carry `student_id`/`teacher_id` and are rejected by `api.session`, and by all teacherapi methods (`apiController.php:336-343`, `teacherapiController.php:75-80`; evidence/backend_routes_A.md §2.1). Web uses the same login (`AuthContext.tsx:221`).
- Consequence: students/teachers/admins can log in by email+password (already built). **Parents cannot** use this path (they have no email account; OTP-by-mobile only). Parent support is a separate decision.
- Note: tokens never expire server-side unless `JWT_TTL_MINUTES>0` (`ApiLoginController.php:426-432`); the app already treats 401/`status:'2'` as sign-out.

## D-05 Menu drives the app; build dedicated screens against `screen_name`, fall back to `GenericDataScreen`, then web handoff — PROPOSED, **needs data (Q4)**
- Evidence: `TileScreen.tsx:27-40`; bootstrap contract `api.php:100`; web sidebar is also server-driven (`useMenuRights.ts:131`), so mobile and web share one rights model.
- Gap: the real `screen_name`/`api` values are per-tenant DB rows (not in code). To plan module-by-module we need them. Request: permission to run read-only SELECTs on `mobile_homescreen` and `teacher_mobile_homescreen` (via the local Laravel DB) — or you export them.
- Until then module plan (step 2) is based on web modules + API availability, and is marked as such.

## D-06 Mobile scope by role: Student, Teacher, Admin/Staff; Parent pending — PROPOSED
- Evidence: backend only allows Admin/Teacher/Student profiles in mobile rights (backend_auth.md §5); web dashboard has teacher/student/admin buckets only (`resolveDashboardRole.ts`); the legacy student app routes serve the "student/parent" case through the student's data.
- Admin/back-office setup (masters, builders, bulk reports) stays web-only by default (see 03 in step 2, with reasons per item).

## D-07 Blade-only / gateway / print modules use the existing web-handoff, not a rebuilt screen — PROPOSED
- Evidence: `WebHandoffScreen.tsx` (system browser, single-use ticket `api.php:106`, 60 s TTL); payment gateway callbacks are HTML (fees.php:116-133 note in evidence/backend_routes_B.md); inventory/admission/hrms.php are Blade.
- Reason: avoids a native WebView module (which would change the native fingerprint and need a store build) — repo's own stated rationale in `WebHandoffScreen.tsx` header comment.
- Caveat: feature not "dropped" — recorded in the tracker as `web-handoff`.

## D-08 Libraries: none added now; candidates are requested per sub-module — PROPOSED
Already installed and reusable: Query, Zustand, React Navigation, SecureStore, expo-updates, LinearGradient, vector-icons.
Likely needed later (each will be a separate request, with the sub-module that needs it, using `npx expo install`, and it changes the native fingerprint → store build):
| Need | Candidate (Expo module) | First needed by |
|---|---|---|
| Homework/assignment file & photo upload (multipart: pdf/jpg/png ≤10 MB, `files[]` — `HomeworkSubmissionApiController.php:274-281`) | expo-document-picker, expo-image-picker | Student: Homework |
| Push notifications (`gcm_insert` body: `mobile_no,sub_institute_id,gcm_regid`; `api.php:87`) | expo-notifications (+ FCM setup) | Communication |
| Date/time inputs | start with `Field` text + a picker module only if needed | Attendance/Leave |
| Charts (admin dashboards, results) | none first: use bars drawn with `View`; decide at that module | Results/Dashboards |
Nothing here is approved or installed.

## D-09 Treat the backend as read-only and not fully trusted — PROPOSED
- Do not rely on UI hiding for authorization; do not send another user's ids; always source `user_id`/`sub_institute_id`/`syear` from the signed-in session (as `client.ts` does).
- Where a legacy endpoint takes identity from the body, the app sends the signed-in user's id; backend weaknesses listed in 01-understanding §B are reported to the backend owners, not patched here.
- Each module doc has a "backend caveats" section.

## D-10 Baseline hygiene — PROPOSED, **needs your answer (Q5)**
- The mobile repo has a single commit and all of `src/` untracked. Propose committing the current baseline on a branch before step 4 so each module is a reviewable diff. I will not commit without your yes.

---
## Open questions (waiting on you)
- **Q1** Which repo is "this repo"? I assumed `D:/lms_k12_mobile_rn` (React Native). `D:/new_mobile_lms_k12` is the Flutter app. May I **read** the Flutter app (read-only) as extra evidence of which endpoints a working mobile client already calls?
- **Q2** Parents: web has no parent UI; backend parents log in by mobile OTP and get a token the modern API rejects. Support parents in v1? If yes, the path would be the legacy `*API` endpoints with the OTP token — a different auth path and a backend-owner conversation.
- **Q3** Confirm D-02 (keep React Navigation) and that `AGENTS.md`'s Expo Router line may be corrected later.
- **Q4** Permission for read-only SELECTs on `mobile_homescreen` / `teacher_mobile_homescreen` (or export them).
- **Q5** Confirm D-10 (commit baseline on a branch).
- **Q6** Is a dev server reachable for read-only GET/POST probes (to settle the teacherapi/adminapi URL and the legacy response shapes), or must all verification be by code reading until a module is built?
- **Q7** Priority order preference by role (default proposal for step 2: Student → Teacher → Admin).
