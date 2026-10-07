# Mobile migration — documentation index

Goal: bring every module of the web app (`D:/lms_k12`, read-only) into this React Native app, using the existing Laravel APIs (`D:/next_lms_erp`, read-only), with a mobile-first UX. This is the only repo that is written to.

## Read order at the start of every session
1. [STATUS.md](STATUS.md) — the tracker: current step, what is waiting on approval.
2. [02-decisions.md](02-decisions.md) — decision log (each: proposal, reason, evidence, approval state).
3. [01-understanding.md](01-understanding.md) — what the three codebases are.
4. [03-modules-and-order.md](03-modules-and-order.md) — modules, classification, dependencies, build order (step 2).
5. `modules/<id>-<name>.md` — one implementation document per sub-module (step 3): [F1](modules/F1-legacy-transport.md), [S2](modules/S2-student-attendance.md), [S1](modules/S1-student-home.md), [S3](modules/S3-timetable-exam-schedule.md), [S4a](modules/S4a-homework-view.md), [S6](modules/S6-fees.md), [S5](modules/S5-results.md), [S7](modules/S7-leave-communication.md), [S9](modules/S9-my-records.md), [S10](modules/S10-school-info-galleries.md) (awaiting approval).

## Folder layout
```
docs/migration/
  README.md               this file
  STATUS.md               tracker (single source of status)
  01-understanding.md     step 1 findings
  02-decisions.md         decision log D-xx
  03-modules-and-order.md step 2 plan
  modules/                one document per sub-module
  evidence/               raw survey notes with file:line citations (see evidence/README.md)
```

## Rules in force (from the brief)
Cite file:line for every endpoint/field/rule; "not found, searched in …" instead of guessing; reuse the repo's patterns; no new libraries without approval; never touch Laravel/Next.js; never drop a feature silently; one sub-module at a time; stop for approval at each gate.
