# Handoff

Goal: upgrade the till's UX, in `C:\Users\bdhna\Desktop\DEV\mr-burritos-order-desktop`. Sprint 1 is finished, QA ready, nothing committed.
Done: one-screen composer, meat count sets size, editable cart lines, Reprendre la derniere, counted extras, Sans fromage, kitchen ticket grouping, light contrast, top bar, Versements rename. See `.bdh-stack/tasks.md`.
Next step: ask the owner about the three pending decisions below. Then take the board's first open task, the Plateforme save emptying a pickup cart (`clearOrder()` in `src/App.tsx`).
Pending owner decisions:
- Commit both repos on `main`? The till's 8-file `platformCash` work is in the same working tree.
- Deploy the server first, then build the till installer with `npm run dist`. Version is still 1.8.1.
- Accent policy for on-screen strings: fix, or keep ASCII.
Pending owner action: rotate the Firebase service account key. It was printed into a session on 2026-11-01 by mistake. It was never committed.
Decisions: no combos until repeat frequency is measured on real orders. Sauces stay toggles. No maximum per extra. Kiosk keeps its wizard.
Read first: `src/lib/composer.ts`, `src/components/ProductBuilder.tsx` in the till; `lib/supplements.ts:58-101` in the server repo.
Do not redo: size-chip Enter is fine; an earlier "adds nothing" came from an invalid composition.
Test rules: local Mongo and `next build` + `next start -p 3099` only. Never use port 3000, it is on production. Set the till's `apiBaseUrl` to 3099 before first load. `next build` left a test build in `.next/`.
