# Teach Connect (React Native)

Expo (dev build) + TypeScript app on the existing Laravel ERP. Runs in parallel with the Flutter app in `d:/new_mobile_lms_k12`.

## How it works
- **Auth**: `POST /api/api-login` -> JWT in `expo-secure-store`. No refresh/logout endpoints exist (stateless JWT); sign-out is local. Any 401 / `status:'2'` signs the user out.
- **Menu + RBAC**: Laravel is the source of truth. `GET /api/mobile/bootstrap` (token-derived) returns the role's menu. `src/rbac/permissions.ts` (`canAccessScreen`, `hasPermission`, `hasAnyPermission`, `hasRole`) is the only permission logic; every tile opens through `TileScreen`, which re-checks access, so a route the backend did not list renders "No access". Falls back to legacy `/api/homescreen` / `/teacher_homescreen` if the backend predates bootstrap.
- **State**: TanStack Query for server state (menu, dashboards, lists); Zustand only for the auth session. Permissions are derived from the menu query, not stored separately.
- **Screens**: dedicated screens register in `src/screens/registry.ts` by backend `screen_name`; anything else with an API falls back to `GenericDataScreen`. `render_type=webview` rows open the ERP page signed-in via `/api/mobile/web-handoff` in the system browser.

## Setup
```
cp .env.example .env      # set EXPO_PUBLIC_API_BASE_URL
npm install
npx expo start            # dev; build a dev client with `eas build --profile development`
npm test && npm run typecheck
```

## OTA updates (EAS Update)
Microsoft App Center CodePush was retired in 2025; this app uses `expo-updates` + EAS Update.

One-time: `npm i -g eas-cli && eas login && eas init`, put the project id in `.env` as `EAS_PROJECT_ID`, then build binaries per channel:
`eas build --profile staging|production --platform all`.

Publish a JS-only update:
```
eas update --channel staging --message "msg" --environment preview   # test first
eas update --channel production --message "msg" --environment production --rollout-percentage 10   # staged
eas update:rollback --channel production        # roll back
```
- `runtimeVersion` uses the **fingerprint** policy: an update is only served to binaries with identical native code, so an incompatible update is never delivered.
- The app checks on launch and on foreground (max once per 10 min), downloads in the background and applies on the next launch. Failures are ignored; a bundle that crashes on start is rolled back by expo-updates to the previous/embedded one.

**Deliverable OTA**: JS/TS, screens, navigation, styling, API calls, bundled images, copy.
**Needs a new store build**: adding/upgrading a native module, Expo SDK / React Native upgrade, permissions (Info.plist / AndroidManifest), icon/splash/bundle id, app.config plugins, changes to `expo-updates` config. A changed fingerprint is the signal.

Not set up here (needs your accounts): Expo login, EAS project, Play/App Store signing.
