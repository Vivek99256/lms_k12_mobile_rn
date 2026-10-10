# Device / Native Pass — scope (S1–S13)

Status: **SCOPE — awaiting your explicit approval** (2026-10-07). **Nothing native has been started:** no `android/` project exists, no build has run, no emulator has been launched, no package has been installed. The only things done for this document were reading `app.config.ts`, `eas.json`, `package.json`, `.gitignore` and `.env.example`, and listing (not running) the local Android SDK folders.
Scope of this pass: every student module built so far (F1, S1–S10, S13, S9c), as one coordinated check on a real Android runtime. **Not in scope** unless you say so: S4b / file-picker work, backend-fix follow-ups, new features, iOS, store submission, EAS cloud builds, OTA updates.

## 0. What the earlier documents deferred to this pass
Every module document listed device-only items it could not verify with Jest (layout at 360 dp, touch targets, the hand-off of files and links to the phone's browser/PDF viewer, pull-to-refresh feel, keyboard, back behaviour). They are collected into the matrix in §4. Jest already proves the logic; this pass proves the **native runtime**: that the app builds, installs, starts, renders, navigates and hands links to Android correctly, and that the release build is sound.

## 1. The constraint that shapes the whole pass — login needs data (Q16)
A student cannot sign in without a **real account in the database**, and the only database the local Laravel server can reach is the remote one that may be production. Q16 forbids retrieving real rows. So **no part of this pass may use the real backend or a real account**. Three options (Q47):
| Option | What | Verdict |
|---|---|---|
| **A. Synthetic mock API (recommended)** | a small dev-only Node script (`tools/mock-api/`, built-in `http` module only, **no package**, never bundled into the app) that serves **fabricated** responses for exactly the endpoints the app uses, plus switches to force empty / error / 401 / 422 states. The emulator reaches it through `adb reverse`. It records every request it receives, which doubles as the **"no unsafe endpoint was contacted" audit** for the whole pass. | the only way to exercise login and all screens on a device **with zero real data** while Q16 is open |
| B. Wait until you resolve Q16 | then use a dedicated test account against a confirmed non-production environment | real-server integration, but blocked until you decide |
| C. Build and launch only | native build, install, launch, login screen, offline errors, manifest/security review, release build — no signed-in screens | smallest; leaves most of the matrix unverified |
**Fidelity caveat:** the mock's response shapes are written from my reading of the backend code (the same source as the unit-test fixtures), so the pass validates **native behaviour and UI**, not live-server integration. Integration with the real backend remains pending Q16, as in every module document.

## 2. Environment and build plan
| Item | Finding (read-only) |
|---|---|
| App | Expo SDK 57, React Native 0.86.3, React 19.2.3, TypeScript; `app.config.ts`: name "Teach Connect", package/bundle `in.triz.lmsk12`, scheme `lmsk12`, plugins `expo-secure-store` and `expo-updates`, `predictiveBackGestureEnabled: false`, portrait only. `expo-updates` is **disabled** unless `EAS_PROJECT_ID` is set (it is not). No `android/` or `ios/` folder (managed workflow). `.gitignore` does **not** ignore `android/` / `ios/`. |
| Android SDK | present at `%LOCALAPPDATA%\Android\Sdk`: platforms 33–37, build-tools 35.0.0 and 36.0.0, `emulator`, `platform-tools`, `cmdline-tools`, `ndk`, `cmake`, system images (android-36, 37.1, 37.2); an AVD `Pixel_10_Pro`. `ANDROID_HOME` / `ANDROID_SDK_ROOT` are **not set**; `adb` is not on PATH. |
| JDK | none on PATH, `JAVA_HOME` unset; Android Studio's bundled JDK exists at `C:\Program Files\Android\Android Studio\jbr`. |
| Node / npm | v24.18.0 / 11.16.0 |
| Known risk | `expo-asset` is **not installed** (the app bundles under Metro because a nested copy under `expo/node_modules` resolves, Q20). The first device run must show whether `@expo/vector-icons` / fonts load at runtime. If they do not, installing `expo-asset` would be needed — a package change I will **not** make without your approval (Q52). |
**Plan (no repo pollution):**
1. *Session-only environment:* set `JAVA_HOME` to Android Studio's JDK and `ANDROID_HOME` to the SDK **for the shell session only**; no system or registry change. Gradle will download its own distribution and Maven dependencies from the internet.
2. *Generate the native project outside the repo* (Q48, recommended): `git worktree` / a scratch copy of the committed tree, then `npx expo prebuild --platform android`, so `android/` never appears in `D:\lms_k12_mobile_rn` and nothing can be committed by accident. (Alternative: prebuild in the repo and add `/android` and `/ios` to `.gitignore` — a repo change.)
3. *Debug build:* `expo run:android` (or Gradle `assembleDebug`) with `EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:<port>` and `adb reverse tcp:<port> tcp:<port>`; Metro serves the JS. Debug builds permit cleartext HTTP; release builds do not.
4. *Release build:* Gradle `assembleRelease` with the **debug keystore** purely for local verification — **not distributable, not uploaded, no keystore created or committed** (`*.jks` is ignored anyway).
5. Cleanup at the end: stop the emulator and Metro/mock processes, remove the scratch project and APKs, confirm `git status` of the repo and Laravel are unchanged.

## 3. How the pass is run
- **Driver (Q49):** I run it with `adb` (install, launch, `input` taps/swipes, `uiautomator dump` for the accessibility tree and bounds, `screencap`, `logcat`), recording results per matrix row. Screenshots and dumps go to a scratch folder **outside the repo**, contain only fabricated data, are not committed, and are deleted afterwards. (Alternative: you drive manually and I only build and collect logs.)
- **Mock states:** each screen is visited in *normal*, *empty*, *error (500)*, *session expired (401)*, and where relevant *no academic year (422)* and *stale (refresh fails)* modes.
- **Network audit:** the mock server logs method + path of every request; at the end the log is checked against the allow-list of endpoints each module is permitted to call (the lists in the module documents) — no write, staff, admin, HR, classwork, Learn-content or unsafe endpoint may appear, and **no JWT may appear in any URL**.
- **Abort conditions:** any request leaving loopback, any non-fabricated data appearing, a crash loop, or the pass touching the real backend → stop and report.

## 4. The matrix (what is checked, per area)
Pass = behaves as the module document says, no crash, no clipped/overlapping text at 360 dp-class widths, touch targets ≥ 44 dp, text readable with the system font scale at default and 1.3×.
| # | Area | Device checks | Source of the checks |
|---|---|---|---|
| 1 | **Native build / bundle** | `prebuild` succeeds; debug APK builds and installs; JS bundle loads; fonts and icons render (the `expo-asset` risk); app starts without red screen; release APK builds with the JS bundle embedded; APK size recorded | this document §2 |
| 2 | **Login / logout** | fields, keyboard (type, next/done, hide on tap-away, no field hidden behind it), wrong password message, success → tabs, token in SecureStore not in logs, sign-out returns to login and clears data, 401 mid-session signs out cleanly | F1/S2 docs |
| 3 | **Student Home** | dashboard cards, pull-to-refresh, tiles open the right screens, menu sections, tab bar | S1 §14 |
| 4 | **Calendar / attendance** | month grid at 360 dp, legend wrapping, month navigation, holiday list, empty/error states | S1/S2 §14 |
| 5 | **Notifications / circulars** | long text wrapping, tappable `http(s)` links open the browser (and `javascript:`/`tel:` stay inert), "Show more", attachment open | S1 §14 |
| 6 | **Timetable / exams** | Mon–Sat strip, "Other" chip, 12-hour times, upcoming/earlier groups, exam file link | S3 §14 |
| 7 | **Homework** | filters, expand/collapse, overdue wording, attachment hand-off, 30-row batches | S4a §14 |
| 8 | **Fees** | whole-year summary, ₹ Indian grouping with long amounts, bar and words, the 500 message, no pay/receipt controls | S6 §14 |
| 9 | **Results** | term list, **Open PDF** hands the file to the phone's browser/PDF viewer and returns to the app; behaviour with **no PDF viewer** (inline notice) | S5 §14 |
| 10 | **Leave / messages / teachers** | status pills, reply blocks, attachment hand-off, "Show more", unavailable wording for apply/send, teachers list (no phone numbers) | S7 §14 |
| 11 | **My Records** (HW, vaccination, health, infirmary, consent, transport, certificates, discipline) | per-list layout with long remarks, certificate "View text", health document and tracking-link hand-off, **memory-only behaviour (leave a screen and return: data is fetched again)**, hostel / achievement "not available" | S9 §14 |
| 12 | **School information / galleries** | long school text, tappable links, album expand/collapse, **Open photo / Open video** hand-off to the browser, no in-app image, classwork "not available" | S10 §14 |
| 13 | **Social Collaborative** | own discussions list, conversation, back to list, attachment hand-off, unavailable note; Learn and Live Lecture "not available" | S8 §14 |
| 14 | **Student Discipline** | notes with flag word, long messages, empty state | S9 §19 |
| 15 | **Profile / My Details** | no request on opening the tab, **Show → details → Hide → data gone** (re-Show fetches again), the mismatch message with **no profile field visible**, 422 message, app version row, sign-out | S13 §11 |
| 16 | **Pull-to-refresh** | on every list screen: spinner, refetch, stale banner when refresh fails, no duplicate requests | all |
| 17 | **Navigation / back behaviour** | Android system back from tile screens → Home/Menu; back from the Social conversation; back at the root (app leaves, does not sign out); tab switching keeps state sensibly; predictive back is disabled in config; app resume after background | all |
| 18 | **External browser / PDF / link handling** | each hand-off kind opens Chrome/viewer (result PDF, attachments, photos, videos, text links, tracking link); a refused/unsafe link shows its message and **does not open**; failure notice with no handler; returning to the app keeps the screen | S5/S7/S9/S10 |
| 19 | **Touch targets and keyboard** | `uiautomator` bounds of every button/chip/row ≥ 44 dp; login keyboard behaviour (layout shifts, scroll, dismissal); no other text inputs exist | all |
| 20 | **Android permission / security review** | merged `AndroidManifest.xml` (declared permissions — expect only network ones; no storage/camera/location/contacts), `usesCleartextTraffic` (debug only), `allowBackup` and data-extraction rules (token is in Keystore-backed SecureStore), `debuggable` false in release, exported components and intent filters (only the `lmsk12` scheme), deep-link handling does not expose screens, `logcat` scan for tokens / names / amounts / health text, network log shows JWT only in headers, FLAG_SECURE is **not** set (screenshots are possible — noted, not changed) | this document |
| 21 | **Release build verification** | release APK installs and starts with the embedded bundle (no Metro), minify/R8 did not break screens, `expo-updates` disabled state is harmless, app info/version correct, cleartext HTTP is blocked as expected, offline error handling on the login screen; **full signed-in flows in release are not possible without an HTTPS test backend (Q16)** and are reported as pending | this document |

## 5. Deliverables
A written report in `docs/migration/device-pass-report.md` (results per matrix row: pass / fail / not testable, with the defects found and proposed fixes — **fixes are not made without approval**), the network-audit result, the manifest/permission review, the release-build verification, the list of anything that needs the real backend (pending Q16), and the cleanup confirmation. No generated artifacts are committed; the only repo changes are that report, the tracker/decision updates, and — only if you approve Q47 option A — the `tools/mock-api/` script and its README.

## 6. Risks
- **Toolchain:** first Gradle run downloads a lot; JDK/Gradle/AGP version mismatches with RN 0.86 / SDK 57 may need session-only workarounds (never repo changes without approval).
- **`expo-asset`** (§2) may force a package install.
- **Mock fidelity** (§1) — it cannot find real-backend integration defects.
- **Emulator** performance and the Pixel_10_Pro image (Android 36/37) may differ from the phones your schools use; an older image (API 33–34) could be added if you want one.
- **Cleartext** is allowed only in the debug build; the pass will not enable it in release.
- **Time:** a full pass is a long session (build, mock, ~21 matrix rows, release build).

## 7. Decisions and questions for you
- **Q46 — approve the pass?** *Option A (recommended):* the full pass as described. *Option B:* build + launch + login screen + manifest/security + release build only (§1 option C). *Option C:* do not start; wait.
- **Q47 — data source:** A synthetic mock API (adds `tools/mock-api/`, no package) — recommended; B wait for a Q16 resolution and a test account; C none.
- **Q48 — native project location:** a scratch copy / worktree outside the repo (recommended) or `prebuild` in the repo with `/android` and `/ios` added to `.gitignore`.
- **Q49 — who drives:** I drive with `adb` and record results (recommended), or you drive manually and I build and read logs.
- **Q50 — release verification level:** a local release APK signed with the **debug key**, never distributed, no keystore created or committed (recommended).
- **Q51 — toolchain setup:** session-only `JAVA_HOME` (Android Studio's JDK) and `ANDROID_HOME`, with Gradle/Maven downloads from the internet — OK?
- **Q52 — packages:** if the device run proves `expo-asset` is needed at runtime, may I install it (and report it)? Otherwise no package will be added.
- **Q16 stays open and strict:** the pass uses fabricated data only and never contacts the real backend.
