# Team board

Updated: 2026-11-01

Target repo for this board: `C:\Users\bdhna\Desktop\DEV\mr-burritos-order-desktop` (the till, a separate project). T8 is in this repo.

## Sprint 1: One-screen item composer for the till
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
