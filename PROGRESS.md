# PROGRESS

## Milestones (SPEC §12)

| | Milestone | Commit |
|---|---|---|
| ✅ | M0 Study — field names, SPEC-vs-data conflicts, calibration (276/276), layout, four decisions | (no code) |
| ✅ | M1 Foundation — reference/ + docs/, seed extraction + CHANGES.md, AppState/events, event store, cross-tab sync, reset | `f34761b` |
| ✅ | M2 Engine + P0 rules — order-up-to engine (A0), C1–C9 | `f9826de` |
| ✅ | M3 Role panes — four panes, inboxes, event stream, split view, till pricing | `e8205b8` |
| ✅ | M4 Presenter + S1 + S2 — C11/C12/C13, shared action builders, Presenter, scenarios | `d9a6450` |
| ✅ | M5 Recall + S3 — C14/C15, S3 | `7ad4ddf` |
| ✅ | M6 Polish — external recall actor, A12, docs, static-build check | this commit |

## Decisions

All recorded in `docs/SPEC.md` §13 (items 1–17); data changes in `seed/CHANGES.md`; demo numbers in `app/src/config/demoTuning.ts`.

- Seed is the "before" state (offer draft, recall not issued); proposal numbers win where the data disagrees (eggs 19, yogurt ASN 1 case).
- Exceptions calibrated to the seed (auto-release tolerance 1.0; supplier constraint only for demo claims, and only on the short item).
- Strawberries keep a +48 seed adjustment on top of the formula; pre-builds keep PROMO_UPLIFT and are used up by the approval that carries them.
- C11–C13 built in M4 (needed by S1 step 4 and S2).
- Recall root actor is "Supplier / FDA notice" (`external`), a valid root for A12.
- Presenter Back truncates the shared event log in every window.

---

## REVIEW

Checked on 2026-10-01: `npm test` (245 tests, 31 files) all pass; `npm run build` passes; the built `app/dist/` served by a plain static server (Python `http.server`) runs S1, S2 and S3 end to end in headless Chrome, with Next and with pane clicks giving identical event logs (S1 55 events, S3 23 events, S2 17 events), and a second window staying in sync (53/53 events).

### SPEC §8 acceptance assertions

| # | Assertion | Result | Test |
|---|---|---|---|
| A0 | Engine reproduces `proposedQty` for all AUTO_RELEASED lines | ✅ Pass — 276/276 network lines, and every seed proposal (qty, exceptions, status) from live state | `A0-calibration` |
| A1 | Publishing OF-3101 activates the till bonus rule and raises yogurt `proposedQty` | ✅ Pass — R-BP-801 live, 6 → 12, PROMO_UPLIFT, review | `A1-offer-published` |
| A2 | Sale of n reduces yogurt shelf by n (then back room), `onHand` by n | ✅ Pass | `A2-sale-stock` |
| A3 | Member yogurt sale with OF-3101 live: bonus in POINTS_AWARDED, redeemed +1, funding +$1.00 | ✅ Pass — 208 points (8 + 200) | `A3-points` |
| A4 | After 10 sales, qty ≥ before and STOCK_RISK_RAISED for OF-3101 | ✅ Pass — qty 24, one risk, raised on the 4th sale | `A4-stock-risk` |
| A5 | ORDER_APPROVED creates one inbound and one RECEIVE task, expected = approved | ✅ Pass | `A5-approval` |
| A6 | Short delivery: exactly one claim, value = short × unit cost, onHand + received only | ✅ Pass — CLM-5223, $16.68; only the short item flagged (§13.10) | `A6-short-delivery` |
| A7 | Pausing the offer removes the till rule, the uplift, and lowers the proposal | ✅ Pass — 12 → 6, back to seed values | `A7-offer-paused` |
| A8 | PRM-2698 Pass, PRM-2702 Warn, PRM-2720 Fail; Fail blocks publish | ✅ Pass — 150% / 84% / 68% | `A8-promo-gate` |
| A9 | Approving the Cola prebuild changes PRM-2702 Warn → Pass | ✅ Pass — 84% → 100% | `A9-supply-added` |
| A10 | Eggs count creates COUNT_VARIANCE and clears PHANTOM_SUSPECTED | ✅ Pass — variance **−19**, not −30 (§13.4) | `A10-count-variance` |
| A11 | RECALL_ISSUED blocks the SKU, pull tasks per lot, holds inbound, blocks proposals, flags PRM-2698 | ✅ Pass — plus notice counts and C15 pulls | `A11-recall` |
| A12 | Every non-root event has causedBy; chains reach a human (or external notice) root | ✅ Pass — over a 100+ event log covering S1–S3, count, hold, pause | `A12-causality` |
| A13 | Reset restores seed exactly | ✅ Pass — incl. after S1+S2+S3, and from storage | `A13-reset` |
| A14 | Event in window 1 appears in window 2 within 1 s | ✅ Pass — BroadcastChannel and localStorage fallback; also reset, scenario setup, Back; confirmed in a real browser | `A14-sync` |
| A15 | Rules are pure | ✅ Pass — every event type and every registered rule (C1–C9, C11–C15) on two states, clock/random forbidden, no vacuous rule | `A15-purity` |

### Not working / not built

- **C16 waste, C17 coupon issue, C18 markdown (P2)** are not built. Their event types exist; the till does not apply coupons; Aisha's markdown task shows "Soon", as in the reference app.
- **C10 offer pause** works (A7) but is not part of a scripted scenario.
- **Optional SSE server adapter** not built (not needed; CLAUDE.md says build it only if time allows).
- **Short-ship toggle** pre-fills the receive form only in the window where it is ticked; in four-window mode, Aisha types the received quantity.
- **Presenter run state** (current step) lives in the presenter's window; a second presenter window would not follow it.
- **Till basket and inbox read/unread** are per window by design (the basket is the cashier's draft; nothing is shared until Complete sale).

### Looks fake or inconsistent on screen

- **Fixed clock.** The data world is Mon 28 Sep 2026, 2:35 PM; the handheld still says "Good morning" (as in the reference app). Event times use the real clock but are not shown.
- **Network vs store numbers.** The recall notice counts (1,284 buyers, 1,102 / 1,219 / 388 contacts, 173 refunds) are network-wide from the recall record while the rest of the screen is Plano; "1 of 22 stores confirmed" can only move for Plano because the other stores are not simulated.
- **No cheddar order proposal.** Plano has no cheddar line in the data, so "Priya's cheddar order" is the 84-unit delivery on ASN-US-778134 (held). Blocked proposals are tested but never visible.
- **OF-3101 counters start at 0.** The offer starts as a draft, so redemptions count only the demo's sales, while "Targeted 18,999" comes from the data.
- **Cover rounding differs by pane.** Priya's table shows one decimal (0.5); Emily's banner shows two, rounded down (0.46).
- **Strawberries order 80** is hand-set in the data (formula gives 32); kept as-is with its "Exceeds shelf capacity" flag.
- **Eggs phantom signal** ("no sales for 8 hours") is a demo value; the data shows eggs selling normally.
- **Light Lager** scans with no age check.
- **The Plano yogurt delivery** on the morning ASN is 1 case (6 units), resized from 4 cases to match the planner's in-transit number (§13.4).
- **Business reference numbers stay visible** (OF-3101, PRM-2702, CLM-5223, RCL-2026-014, ASN-US-778134, CNT-44821) because the story and the demo script use them. Internal ids (proposal ids, event ids, member ids, event codes) are no longer shown in the panes, the stream or the timeline; event codes remain only as tooltips.
