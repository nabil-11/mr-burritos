# Team board

Updated: 2026-11-03

## Sprint 2: Manager app, first usable version
Ships: new read-only app `C:\Users\bdhna\Desktop\DEV\mr-burritos-manager` (Ionic Vue, md mode, Material 3 tokens) with Login, Alertes, Commandes, Recettes, Réglages, and local notifications while the app is open; server route `GET /api/manager/alerts` (admin|manager) and order transition timestamps. Not committed. Defaults chosen by the main session, owner may change: pending 10 min, late grace 10 min, cash tolerance 1.000 DT; server-URL field only in dev builds; `info` alerts not counted in the badge.
- [x] B1 Order timestamps `readyAt`/`deliveredAt`/`cancelledAt` + `autoSettled` flag in the settle sweep — owner: backend — evidence: `lib/models/Order.ts:124-135`, `app/api/orders/[id]/route.ts:42-48`, `app/api/orders/[id]/cancel/route.ts:39`, `lib/recetteCorrection.ts:295,305`, `lib/orderTimers.ts`; `readyDeadline` moved to `lib/prepDeadline.ts` (re-exported) — blocked by: nothing
- [x] B2 Pure alert rules `lib/managerAlerts.ts` + `scripts/check-alerts.ts` (`npm run check:alerts`) — owner: backend — evidence: `package.json:13`, all 8 kinds and boundaries pass — blocked by: nothing
- [x] B3 Route `app/api/manager/alerts/route.ts`, token + DB re-read + admin|manager, no writes — owner: backend — evidence: live run on 3099: 200/403/401/400 correct, DB snapshot unchanged; `recetteTotals({persist:false})` at `lib/recette.ts:419-461` — blocked by: B1, B2
- [x] D1 Scaffold app, git init without commits, md mode, brand tokens from `app/globals.css:56-114`, Capacitor + android platform, no APK — owner: designer — evidence: `mr-burritos-manager/src/theme/variables.css`, `capacitor.config.ts` — blocked by: nothing
- [x] D2 API client, token in Preferences, Login, tabs, router guard, Réglages — owner: designer — evidence: `src/stores/auth.ts`, `src/api/client.ts`, `src/stores/settings.ts:44` — blocked by: D1
- [x] D3 Alertes tab, badge, poll every 60 s + on resume, local notifications de-duplicated by id — owner: designer — evidence: `src/notify/alerts.ts`, `src/notify/notifier.ts`; money 2 decimals to match server `lib/format.ts:12` — blocked by: D2
- [x] D4 Commandes (filters, detail) and Recettes (live, closed list, detail) — owner: designer — evidence: `src/views/*Page.vue`; built on mocks, 16 shots at 390×844 light/dark — blocked by: D2
- [x] Q1 Rules and error codes on seeded local data, old-till compatibility, app on 3099 in light/dark at phone size — owner: qa — evidence: first pass found 1 high (`since` hid alerts older than 24 h), 1 medium (recette count without cancelled), 3 low; all fixed and re-checked on 27099/3099 — blocked by: B3, D3, D4
- [x] S1 Role guard, PII in alerts, token storage, server-URL setting, CORS — owner: security — evidence: route clean; app fixes `allowBackup=false` + `data_extraction_rules.xml`, private notification channel, tray cleared on logout, `vite.config.ts:7` build guard, fake mock phones — blocked by: B3, D2
- [x] D5 Polish: Tunis day bounds, "Serveur injoignable" on 502/504, platform-filter hint, "Espèces plateformes" line at `RecetteDetailPage.vue:127` — owner: designer — evidence: `npm run build` passes — blocked by: Q1
- [x] B4 Alert text: amounts via `formatDT`, no `auto_settled` on cancelled orders, durations as "1 j 5 h" — owner: backend — evidence: `lib/managerAlerts.ts:133,177,221,291`, `npm run check:alerts` — blocked by: Q1

## Sprint 4: Équipe in the manager app (1.1.0)
Ships: 5th tab Équipe — Planning (Aujourd'hui / Semaine / Mois, "heures prévues": no attendance data exists) and Comptes (month KPIs, per-employee salary, avances, primes, retenues, paiements, reste) — read-only, admin|manager only, no phone/CIN/address/notes; 1.0.1 hardening; APK 1.1.0. Defaults by the main session: managers see salaries; 1.0.0 APK kept in `public/downloads/`; no commits.
- [x] T1+T2 `lib/managerAuth.ts` guard (alerts route switched to it), `lib/managerTeam.ts` whitelist mapper, `GET /api/manager/team?month=`, `GET /api/manager/team/[id]?month=`, `npm run check:team` — owner: backend — evidence: `lib/managerAuth.ts:28-41`, `lib/managerTeam.ts:20,80,151`, `app/api/manager/team/route.ts:19`, `app/api/manager/team/[id]/route.ts:20`; live run: figures equal `overview`/`accountOf`, no PII, no writes — blocked by: nothing
- [x] T3 Équipe tab, Planning and Comptes segments, employee detail, mocks; 1.0.1 hardening (`ReglagesPage.vue:3`, `SCHEDULE_EXACT_ALARM` removed, `.env*` in `.gitignore`); version 1.1.0 / versionCode 2 — owner: designer — evidence: `src/views/EquipePage.vue`, `EquipeDetailPage.vue`, `src/components/PlanningTab.vue`, `ComptesTab.vue`, `src/lib/team.ts:121` (cross-midnight) — blocked by: nothing (contracts fixed)
- [x] T3b Owner add-on: "heures prévues" per person in Comptes rows and detail header; advance history pages `EquipeAvancesPage.vue` (team, period chips) and `EquipeAvancesEmployePage.vue` (per employee, by month) — owner: designer — evidence: `ComptesTab.vue:21-30,117,130,150`, `src/router/index.ts:21-22` — blocked by: nothing
- [x] T2b Owner add-on: `GET /api/manager/team/:id/advances`, `GET /api/manager/advances?from&to` — owner: backend — evidence: `lib/managerAdvances.ts:34,84,128`, `lib/employeeAccount.ts:~225` `linesOfAll`; also fixed `loadLines()` dropping recettes that held any non-employee movement (back-office Employés undercounted) — blocked by: nothing
- [x] T3c Mr Burritos launcher icon, adaptive icon, splash, favicon — owner: designer — evidence: `scripts/make-brand-assets.mjs`, `assets/`, `mipmap-*`, background `#1A1A1A`; source `public/logo.jpg` is low-res, a PNG/vector would be sharper — blocked by: nothing
- [x] T5 Real-server pass: roles, cross-midnight shift, cancelled advance, negative balance, empty month, states, both themes, 360/390 — owner: qa — evidence: figures equal back-office `/employees`, `loadLines` fix confirmed, 18:00–01:00 = 7 h; 4 cosmetic notes sent to designer — blocked by: T1+T2, T3
- [x] T6 PII in responses, guards, manifest — owner: security — evidence: no blockers; `managerAuth.ts:33` userId validation sent to backend — blocked by: T1+T2, T3
- [x] T5b QA cosmetics: hours as "97 h 59" from whole minutes (`src/lib/team.ts:90`), chips fit at 360 (`EquipeAvancesPage.vue:96`), "Pas de compte ce mois" (`ComptesTab.vue:67`), no month arrows on 403 (`ComptesTab.vue:85`); guard rejects a token without a valid userId (`lib/managerAuth.ts:34`) — owner: designer, backend — evidence: `npm run build`, `check:team`, `check:alerts`, tsc — blocked by: T5, T6
- [ ] T7 `npm run apk` → `mr-burritos-manager-1.1.0.apk`, verify, commit and push the server (owner asked), first local commit of the app repo (no remote) — owner: release — evidence: `scripts/build-apk.mjs` — blocked by: T5, T6

## Sprint 3: Manager app APK downloadable from the back-office
Ships: signed release APK `mr-burritos-manager-1.0.0.apk` (`tn.mrburritos.manager`) in `public/downloads/`, listed on `/login` next to the desktop app. Signing key outside both repos. Committed and pushed by the owner in 17c87cb with the sprint 2 server work. Legacy `public/downloads/mr-burritos-manager.apk` (`com.mr_burritos.manager`, older app) left untouched.
- [x] R1 Signed release APK 1.0.0, keystore outside the repos, `npm run apk` script, copy to server `public/downloads/` — owner: release — evidence: 3.37 MB, v2 signature, not debuggable; `android/app/build.gradle:5-45`, `scripts/build-apk.mjs`; key in `C:/Users/bdhna/.mr-burritos-keys/` — blocked by: nothing
- [x] D6 Manager APK entry in `staffApps()` on `/login` (version and size from the file) — owner: designer — evidence: `lib/downloads.ts:90-95,129,159-174`, `app/login/page.tsx:22,55,70` (`force-static`, valid without Cache Components) — blocked by: nothing
- [x] Q2 Download served with the right type and size, `/login` link at phone and desktop width, APK metadata, install on an emulator if one is available — owner: qa — evidence: `/login` static, 200 `application/vnd.android.package-archive`, length and sha256 match; no emulator image on this machine, install not tested — blocked by: R1, D6
- [x] S2 Keystore and passwords outside every repo and `public/`, APK not debuggable, no secrets inside — owner: security — evidence: no blockers; 4096-bit key, no cleartext, no secrets or mocks in assets — blocked by: R1

## Sprint 1: One-screen item composer for the till
Target repo: `C:\Users\bdhna\Desktop\DEV\mr-burritos-order-desktop` (the till, a separate project). T8 is in this repo.
Ships: the 5-step wizard replaced by a one-screen composer where the meat count sets the size, cart lines that can be edited, counted extras, and fixes to the same cashier flow. Not committed yet.
- [x] T1 Pure logic and check script — owner: designer — evidence: `src/lib/composer.ts`, `src/lib/cartLines.ts`, `scripts/check-logic.mjs` — blocked by: nothing
- [x] T2 Composer UI — owner: designer — evidence: `src/components/ProductBuilder.tsx` — blocked by: T1
- [x] T3 Modifier, Mettre a jour, Reprendre la derniere, orphaned CSS removal — owner: designer — evidence: `src/components/Cart.tsx`, `src/App.tsx` — blocked by: T2
- [x] T4 Cart stepper, cash chips, Plateforme keypad keys, releve wording — owner: designer — evidence: `src/components/Cart.tsx`, `src/components/Keypad.tsx` — blocked by: T3
- [x] T5 Light contrast, top bar, Versements rename, reduced motion — owner: designer — evidence: `src/index.css`, `src/App.css` — blocked by: T4
- [x] T6 QA pass at 1360x880, 1024x768, 1024x680, both themes, local data only — owner: qa — evidence: 4 bugs found and fixed, order matched the old build field by field — blocked by: T5
- [x] T7 Extras counted like meats, "2× Oeuf" in cart and order lists, "Sans fromage" note preset — owner: designer — evidence: `src/lib/composer.ts`, `src/lib/supplements.ts` — blocked by: T6
- [x] T8 Kitchen ticket groups repeated supplements as "+ 2x Oeuf (2.00)" — owner: backend — evidence: `lib/supplements.ts:58-101`, `app/api/orders/[id]/receipt/route.ts:254-257` — blocked by: T6
- [x] T9 QA re-check of T7, T8 and T6 fixes — owner: qa — evidence: 4 real orders, totals and receipts correct — blocked by: T7, T8

## Backlog
- [ ] Till auto-update release script: build, upload installer, write `public/downloads/latest.yml` with its full URL — owner: release — evidence: memory note `till-auto-update`, till `electron/updater.cjs` — blocked by: owner's choice of installer host (no public repo without explicit approval)
- [ ] Old debuggable APKs still public by direct link: `public/downloads/mr-burritos-manager.apk` (`com.mr_burritos.manager`) and `mr-burritos-livreur.apk` (`io.ionic.starter`), both debuggable with backup on — owner: release — evidence: security review S2 — blocked by: owner decision (are drivers still installing the livreur APK?)
- [ ] Manager app 1.0.1 hardening: import only `version` from package.json (`src/views/ReglagesPage.vue:3`), remove `SCHEDULE_EXACT_ALARM` with `tools:node="remove"`, `.env` and `.env.*` in `.gitignore` before the app repo's first commit — owner: designer — evidence: security review S2 — blocked by: nothing
- [ ] Manager app repo has no commits; signing key `C:/Users/bdhna/.mr-burritos-keys/` has no backup — owner: release — evidence: `git log` in `mr-burritos-manager` — blocked by: owner
- [ ] Manager app sprint 3: background FCM push for alerts, scheduled check (Vercel Cron or external), manager-only token registration from the verified JWT, Android channel `orders` — owner: backend — evidence: `app/api/notifications/register-token/route.ts` has no auth; no `vercel.json` — blocked by: owner's `google-services.json`, Firebase key rotation, Vercel plan cron limits
- [ ] Manager app: Android debug APK, `ANDROID_HOME` set, cleartext for LAN testing — owner: release — evidence: SDK at `%LOCALAPPDATA%/Android/Sdk`, no cmdline-tools — blocked by: D1
- [ ] Open GET routes expose orders (customer name, phone, address) and recettes without a token — owner: security — evidence: `app/api/orders/route.ts:20`, `app/api/orders/[id]/route.ts:11-17`, `app/api/recettes/route.ts:18-37` — blocked by: owner decision (kiosk tracker and tills read them)
- [ ] `register-token` lets any caller register as manager and receive manager pushes — owner: security — evidence: `app/api/notifications/register-token/route.ts` — blocked by: nothing
- [ ] New-order push goes to every token, customers and drivers included — owner: backend — evidence: `app/api/orders/route.ts:135-139` — blocked by: nothing
- [ ] Login cookie has no `secure` or explicit `sameSite` — owner: backend — evidence: `app/api/auth/login/route.ts:34` — blocked by: nothing
- [ ] Cancel route needs no sign-in; status PUT accepts any role and an unbounded `preparationDuration`, which can mute `order.late` — owner: backend — evidence: `app/api/orders/[id]/cancel/route.ts:25`, `app/api/orders/[id]/route.ts:21,51` — blocked by: owner decision (till and kiosk callers)
- [ ] Orders do not record who created or cancelled them, or why — owner: backend — evidence: `lib/models/Order.ts`, `app/api/orders/[id]/cancel/route.ts` — blocked by: owner decision
- [ ] Saving a Plateforme releve empties a pickup cart in progress — owner: designer — evidence: `clearOrder()` called on delivery save in `src/App.tsx` — blocked by: nothing
- [ ] Toasts on the tabs overlap modal header titles — owner: designer — evidence: QA run, "Point de caisse" screen — blocked by: nothing
- [ ] Kiosk customer ticket groups repeated supplements — owner: backend — evidence: `app/(kiosk)/commander/[id]/print/page.tsx:92` — blocked by: nothing
- [ ] Back-office order row shows one chip per portion — owner: designer — evidence: `app/(backoffice)/orders/OrderRow.tsx:397-401` — blocked by: nothing
- [ ] Frequent combos from order history, once repeat frequency is measured — owner: designer — evidence: frequency unmeasured — blocked by: a read of real order data
- [ ] Keyboard shortcuts for picking items — owner: designer — evidence: 24-25 Tab stops before the first size chip in the audit — blocked by: nothing
- [ ] New-order alert via SSE instead of 30s polling — owner: backend — evidence: `src/App.tsx:716`, server `/api/orders/stream` — blocked by: nothing
- [ ] New-order alert shows sizes, meats, sauces and notes — owner: designer — evidence: `src/components/NewOrderAlert.tsx:59-70` — blocked by: nothing
- [ ] Plateforme warning on a second day total for the same company — owner: designer — evidence: 5 same-day Glovo entries accepted in the audit — blocked by: nothing
- [ ] Caisse modal restructure, cash-out form out of the scroll — owner: designer — evidence: audit screenshot dark-47 — blocked by: nothing
- [ ] Modal focus management, role=dialog on all 7, focus trap — owner: designer — evidence: only 3 of 7 modals have role=dialog — blocked by: nothing
- [ ] Payouts screen native checkboxes in dark theme — owner: designer — evidence: audit screenshot dark-42 — blocked by: nothing
- [ ] Keypad two-decimal cap against the 3-decimal setting — owner: designer — evidence: `src/components/Keypad.tsx:30` — blocked by: nothing
- [ ] Touch sizes of order tool pills and top-bar buttons at 36px — owner: designer — evidence: QA layout notes — blocked by: nothing
- [ ] Accent policy for on-screen strings — owner: designer — evidence: `src/lib/reportDoc.ts:19`; server data has accents, UI strings do not — blocked by: owner decision
