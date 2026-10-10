# Mock API (Device / Native Pass) — dev tool only

A tiny Node script (built-in modules only, no package) that serves **fabricated** responses for the endpoints the app uses, so the app can be exercised on a device or emulator **without the real backend, a database or any real account** (migration decision Q16/Q47).

- **Not part of the app.** Nothing in `src/` imports it; Metro bundles only what the entry file imports, so it never ends up in an app build.
- **Fabricated data only**, loopback only (`127.0.0.1`). It has no code path that forwards a request anywhere.
- **Audit built in.** It records every request. `GET /__mock/audit` lists any request outside the app's allow-list (write / staff / admin / front_desk / HR / Learn / classwork …), any JWT in a URL, and any non-GET/POST method.

```
node tools/mock-api/server.js            # MOCK_PORT=8787  MOCK_LOG=<file> (optional)
adb reverse tcp:8787 tcp:8787            # the emulator reaches it as http://127.0.0.1:8787
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:8787   # debug builds only (release blocks cleartext HTTP)
```
Accounts (password `demo123`): `student@demo.test`, `teacher@demo.test`, `mismatch@demo.test` (its own-profile answer is deliberately a different person, to exercise the identity cross-check).
Control from the host: `POST /__mock/mode {"match":"<path substring or *>","mode":"ok|empty|500|401|422|404"}`, `POST /__mock/reset`, `POST /__mock/clear-log`, `GET /__mock/log`, `GET /__mock/audit`.
Response shapes are modelled on the backend code (the same source as the unit-test fixtures), so this validates native behaviour and UI — not integration with the real server.
