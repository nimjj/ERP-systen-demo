# SPEC — Connected Retail Demo

Source of truth for what to build. If this conflicts with the data in `seed/`, stop and ask.

---

## 1. Idea in one picture

One shared "store" of facts. Four people look at it through different windows. When anyone changes a fact, the others' windows change.

Analogy: a shared Google Sheet with 4 tabs. Jamal types in tab 1, and Priya's tab 4 recalculates. Our job is to make that visible.

```
 Emily (marketing)         Jamal (till)          Aisha (store)         Priya (planner)
  publishes offer  ───►  applies offer  ───►  stock drops  ───►  order grows
        ▲                  awards points         shelf gap ◄──  approves order ─► receive task
        └────── stock-risk warning ◄────────────── short delivery ──► supplier claim
```

---

## 2. State model (single JSON object, `AppState`)

| Slice | Source (`seed/` ← `reference/mock/`) | Used by |
|---|---|---|
| `store` | `org.json` → Plano US-DFW-1101 | all |
| `items` | `items.json` (only the Plano slice, see §6) | all |
| `positions[sku]` = `{onHand, shelf, backRoom, shelfCapacity, dailyDemand}` | `inventory.json` (14 Plano positions) | Aisha, Priya, till |
| `inbound[]` = `{id, sku, qty, source, status: ORDERED/IN_TRANSIT/RECEIVED, expectedQty, receivedQty}` | `proposals.json` inTransit + `supply.json` pods (ASN-US-778134) | Aisha, Priya |
| `proposals[]` | `proposals.json` (11 Plano lines) | Priya |
| `series[sku]` | `series.json` (history + forecast weeks) | Priya (chart) |
| `tasks[]` (handheld) | `store-tasks.json` | Aisha |
| `till` = `{shift, basket, member, lines}` | `pos.json` (scanScript, rules, coupons, members M-1001..M-1006) | Jamal |
| `offers[]`, `campaigns[]`, `segments[]` | `loyalty.json`, `engage.json` | Emily |
| `promos[]` | `promotions-module.json` (PRM-2698, 2702, 2720, 2641) | Emily, Priya |
| `claims[]` | `supply.json` (CLM-…) | Priya |
| `recalls[]` | `ops.json` (RCL-2026-014, 015) | all |
| `notifications[]` | derived | each role |
| `events[]` | append-only log | stream UI, tests |

---

## 3. The connection map

Tiers: **P0** = the story; must work and be tested. **P1** = strengthens the story; build after P0. **P2** = only if time.

| ID | Tier | From → To | Trigger | Reaction | What the receiver sees |
|---|---|---|---|---|---|
| C1 | P0 | Emily → Jamal | `OFFER_PUBLISHED` (OF-3101) | Till rule R-BP-801 becomes active for Plano | Next yogurt scan shows "Fall dairy bonus +200 pts" line |
| C2 | P0 | Emily → Priya | `OFFER_PUBLISHED` | Item gets demand uplift (`demoTuning.offerUplift`, default 0.40) → forecast and order-up-to level rise → proposals recomputed | Yogurt proposal qty rises (6 → ~12), tagged PROMO_UPLIFT, lands in review queue if over threshold |
| C3 | P0 | Jamal → Aisha, Priya | `SALE_COMPLETED` | Shelf stock falls first, then back room; `onHand` falls | Aisha: gap scan / shelf count changes. Priya: onHand and days-of-cover change |
| C4 | P0 | stock → Priya | any stock or forecast change | Recompute proposal with the order-up-to policy (§5.1); apply exception rules (§5.2) | Proposal qty changes live; exception chip appears/disappears |
| C5 | P0 | Priya → Aisha | `ORDER_APPROVED` | Inbound created (IN_TRANSIT); handheld task "Receive delivery" created | Aisha gets a new task with expected cases |
| C6 | P0 | Aisha → Priya | `DELIVERY_RECEIVED` with receivedQty < expectedQty | `onHand += receivedQty`; transit-loss recorded; **supplier claim** created; proposal recomputed (gap re-opens) | Priya: new claim card + proposal bumps up again |
| C7 | P0 | Jamal → Emily | `SALE_COMPLETED` with member + active offer | Points awarded; offer counters `redeemed++`, `incrementalSales += price`, supplier funding accrues | Emily: OF-3101 numbers tick up live; member balance changes |
| C8 | P0 | Emily ⇄ Priya | `PROMO_SUBMITTED` | **Stock check gate** (§5.3) gives Pass/Warn/Fail | Emily: result badge; Fail blocks "Publish". Priya: sees what supply is needed |
| C9 | P0 | Priya → Emily | stock falls below cover threshold while an offer is live | `STOCK_RISK_RAISED` | Emily: warning banner on the live offer, with button "Pause offer" |
| C10 | P1 | Emily → Jamal, Priya | `OFFER_PAUSED` | Till rule off; uplift removed; proposals recomputed | Till stops applying bonus; Priya's qty falls |
| C11 | P1 | Priya → Emily | `SUPPLY_ADDED` (approving the pending Cola line) | Re-run stock check for PRM-2702 → Warn → Pass | Emily: badge flips, Publish unlocks |
| C12 | P1 | Aisha → Priya | `COUNT_SUBMITTED` with variance (eggs system 30, found 0) | Adjustment event; stock corrected; item marked phantom-corrected; proposal recomputed | Priya: eggs line changes, exception clears |
| C13 | P1 | Aisha | `SHELF_REFILLED` (back room → shelf) | `MOVE` event; shelf up, back room down | Gap task closes; till unaffected |
| C14 | P1 | ops → everyone | `RECALL_ISSUED` (RCL-2026-014 cheddar) | **Till blocks SKU** · **Aisha gets "Pull from shelf" task** with lots · **Priya: open orders for SKU held, proposals blocked** · **Emily: PRM-2698 flagged, cheddar removed; customer notice drafted** | All four panes change at once |
| C15 | P1 | Aisha → ops | `RECALL_PULLED` (confirmed qty) | Stock for SKU = 0, recall store row gets `confirmedBy` | Recall progress bar moves; Priya sees write-off |
| C16 | P2 | Aisha → Priya | `WASTE_LOGGED` | Stock falls; waste counts in demand signal note | Priya: waste chip |
| C17 | P2 | Emily → Jamal | `COUPON_ISSUED` (CP-M-02 $0.75 off yogurt) | Member's wallet gets coupon; till can apply | Till shows coupon line |
| C18 | P2 | Priya → Aisha | `MARKDOWN_RECOMMENDED` (NEAR_EXPIRY line) | Markdown task created | Aisha: markdown labels task |

Fixed rule: no pane ever writes another pane's data. A pane emits an event; rules do the rest.

---

## 4. Event catalogue

Every event: `{id, ts, actor, type, payload, causedBy}`. `actor` ∈ `jamal | aisha | emily | priya | system`.

| Type | Payload (keys) | Emitted by |
|---|---|---|
| `OFFER_PUBLISHED` / `OFFER_PAUSED` | offerId, items[], storeIds | Emily |
| `PROMO_SUBMITTED` / `PROMO_STOCK_CHECKED` / `PROMO_PUBLISHED` | promoId, result{status, demand, supply, coveragePct} | Emily / system |
| `SALE_COMPLETED` | txnId, memberId?, lines[{sku, qty, price, promoApplied[]}], total, tax, tender | Jamal |
| `POINTS_AWARDED` | memberId, points, reasons[] | system |
| `STOCK_CHANGED` | sku, delta, reason (SALE, DC_RECEIPT, MOVE, COUNT_VARIANCE, ADJUSTMENT, WASTE, RECALL_PULL), onHand, shelf, backRoom | system |
| `PROPOSAL_RECOMPUTED` | sku, oldQty, newQty, exceptions[], status | system |
| `ORDER_APPROVED` / `ORDER_HELD` | proposalId, qty, editedFrom? | Priya / system |
| `INBOUND_CREATED` | inboundId, sku, qty, eta | system |
| `TASK_CREATED` / `TASK_COMPLETED` | taskId, kind (RECEIVE, COUNT, GAP, MARKDOWN, RECALL_PULL), … | system / Aisha |
| `DELIVERY_RECEIVED` | inboundId, expectedQty, receivedQty | Aisha |
| `CLAIM_RAISED` | claimId, supplierId, sku, shortQty, value | system |
| `STOCK_RISK_RAISED` / `STOCK_RISK_CLEARED` | offerId, sku, coverDays | system |
| `SHELF_REFILLED` | sku, qty | Aisha |
| `COUNT_SUBMITTED` | countId, lines[{sku, systemQty, actualQty}] | Aisha |
| `RECALL_ISSUED` / `RECALL_PULLED` | recallId, sku, lots[], qty | system / Aisha |
| `NOTIFICATION_ADDED` | role, text, link, severity | system |

---

## 5. Reaction rules

All are pure functions in `app/src/rules/`. One file per rule, one test per file.

### 5.1 Order-up-to engine (calibrate, don't guess)
```
effectiveDaily = dailyForecast * (1 + activeUplift(sku))
orderUpTo S    = effectiveDaily * (leadTime + reviewDays) + safetyStock
position       = onHand + inTransit + onOrder
qty            = roundUpToCasePack( max(0, S - position) )
```
- Service level by ABC class: A 0.98, B 0.95, C 0.90 (drives safetyStock).
- **Calibration test (A0):** engine must reproduce `proposedQty` for the AUTO_RELEASED lines in `proposals.json` (276 of 276 lines reproduced in analysis). If it does not, fix the engine before anything else. Field names: inspect the JSON.
- `activeUplift(sku)` = max uplift of live offers/promos covering the SKU, using `demoTuning.upliftByMechanic` (see §9).

### 5.2 Exceptions (seven codes; keep all in the data, compute these four live)
- `SHELF_CAPACITY`: `proposedQty + onHand > shelfCapacity`
- `PROMO_UPLIFT`: an active uplift > 0 and `proposedQty` differs from last order by > `demoTuning.largeDeviationPct`
- `PHANTOM_SUSPECTED`: expected sales over window high, actual ≈ 0; simplified: `exp(-expectedSales) < 0.01`
- `SUPPLIER_CONSTRAINT`: open claim for supplier in last N days (demo: any open claim) → flag
- A proposal with no exception and qty ≤ last-order × (1 + `autoReleaseTolerance`) stays AUTO_RELEASED. Otherwise `PENDING_REVIEW`.

### 5.3 Promo stock check (gate)
```
demand  = promoWeeklyDemand(item) * (1 + upliftForMechanic) * promoWeeks
supply  = onHand + inTransit + onOrder + approvedPrebuild
coverage = supply / demand
Pass: >= 1.00   Warn: 0.80–0.99   Fail: < 0.80
```
Seed outcomes must match the data: PRM-2698 Pass, PRM-2702 Warn, PRM-2720 Fail. If the formula can't reproduce them from available fields, derive `demand` and `supply` numbers per promo in `demoTuning.ts` so the three badges come out right.

### 5.4 Stock risk (C9)
When an offer is live and `coverDays = onHand / effectiveDaily < demoTuning.riskCoverDays` (default 1.0) → raise `STOCK_RISK_RAISED`. Clear when cover ≥ threshold (e.g. after receipt).

### 5.5 Points (C7)
`points = floor(eligibleSpend * 1 * tierMultiplier) + bonusRulePoints`. Tiers: Silver 1.25×, Gold 1.5×. 1,000 pts = $5. Maria Delgado (M-1001) is Gold, 8,420 pts.
Offer counters: `redeemed += 1` per qualifying scan; `incrementalSales += line price`; `supplierFunded += bonusPoints * 0.005` (Prairie Gold funds 100%).

### 5.6 Recall (C14–C15)
Issuing a recall: block SKU at till (scan shows "RECALLED — do not sell"), create RECALL_PULL tasks with the lot numbers from `ops.json`, set open inbound for SKU to HELD, set proposals for SKU to BLOCKED, remove SKU from live promos and flag them, draft a customer notice using counts from the recall record (buyers, push, email, SMS, refunds).

---

## 6. Seed slice (Plano, US-DFW-1101)

Use only these. Everything else is out of scope.

- **SKUs (11 proposals):** SKU-100207, 100214, 100221, 100249, 100298, 100312, 100319, 100354, 100368, 100396, 100410.
- **Hero item:** Greek Yogurt 32 oz — proposal `PRP-00001`; onHand 17, inTransit 6, dailyForecast 9.3, casePack 6, proposed 6, last 12, AUTO_RELEASED, supplier SUP-PRAIRIE (Prairie Gold Dairy), source Temple TX Perishables DC.
  - Shelf/back room split: use **shelf 9 / back room 8** (from the gap scan; sums to 17, so it agrees with `inventory.json`).
- **Hero inbound:** ASN-US-778134, Temple DC, ETA 6:30 AM, Trailer 5302 Door 2, 12 lines; yogurt expected 4 cases, flagged short-ship; bananas also short.
- **Pending Plano lines at start:** Strawberries (SHELF_CAPACITY, low confidence) and Cola (PROMO_UPLIFT, high, prebuild 77, proposed 160 vs last 76).
- **Till:** the 18-item `scanScript`; member M-1001 Maria Delgado; rules R-BP-801 (+200 pts yogurt), R-MP-101 (eggs $3.97 member price), R-MB-201 (milk 2 for $6), R-BG-301 (bread BOGO); coupon CP-M-02 ($0.75 off yogurt). Texas tax 8.25%, SNAP exempt, stacking order from `pos.json` (member price → multi-buy/BOGO/mix-and-match → % off → basket threshold → store coupons → manufacturer coupons → employee discount). Implement only the steps present in seed rules.
- **Marketing:** OF-3101, CMP-505 "Fall dairy 3x points" (push), PRM-2698 / 2702 / 2720.
- **Handheld tasks:** t1 receive ASN-US-778134, t2 count CNT-44821 (eggs system 30 / found 0), t3 gap scan, t4 markdown labels (14 items).
- **Recall:** RCL-2026-014 Shredded Mild Cheddar 8 oz (SKU-100228, lots PGD-26261A/B, PGD-26263A, FDA Class II; also in PRM-2698). RCL-2026-015 Strawberries (SKU-100410, Plano lot RV-STR-0924-17, onHand 11). **Check** whether Plano holds SKU-100228; if not, add one position and note it in `demoTuning.ts`.

---

## 7. Scripted scenarios (Presenter panel)

Each scenario = ordered steps. A step is either an *actor action* (the presenter clicks in the pane) or a *Next* button that fires the same event on the actor's behalf. Both paths must emit the identical event.

### S1 — "From offer to shelf" (headline, ~4 min)
1. **Emily** publishes OF-3101 → *Jamal's till* now has the bonus rule; *Priya's* yogurt proposal rises and shows PROMO_UPLIFT.
2. **Jamal** scans yogurt for Maria (Gold) → points awarded; *Emily* sees redeemed +1, incremental $ up; *Priya/Aisha* see onHand −1.
3. Presenter clicks **Simulate 10 sales** → shelf runs low; *Aisha* gets a refill gap (back room 8 → refill); *Priya's* proposal qty rises; *Emily* sees STOCK_RISK warning.
4. **Aisha** refills shelf from back room (C13).
5. **Priya** approves the larger order → *Aisha* gets "Receive delivery".
6. **Aisha** receives short (expected 12, got 8) → *Priya* gets a claim; the gap reopens in her proposal; *Emily's* warning stays until stock recovers.
7. End card: shows the event chain from step 1 to 6 as one connected timeline.

### S2 — "Promo gate" (~2 min)
1. **Emily** submits PRM-2720 Thanksgiving Baking → stock check **Fail** (DC short ~2,325 units/week); Publish disabled.
2. **Priya** sees the shortfall, adds supply (or approves the Plano Cola prebuild line for PRM-2702 to show Warn → Pass).
3. **Emily** sees the badge flip and publishes.

### S3 — "Recall hits everyone" (~2 min)
1. Presenter clicks **Issue recall RCL-2026-014**.
2. All four panes change at once (C14). Show the till block with a scan of cheddar.
3. **Aisha** pulls lots → confirm → recall progress moves (C15).
4. Emily's PRM-2698 shows the flag; customer notice draft opens with real counts.

---

## 8. Acceptance assertions (turn into tests)

- A0 Engine reproduces `proposedQty` for all AUTO_RELEASED lines in seed.
- A1 Publishing OF-3101 activates the till bonus rule and raises yogurt `proposedQty` (new > old).
- A2 `SALE_COMPLETED` of qty n reduces yogurt shelf by n (then back room when shelf is 0), and `onHand` by n.
- A3 A member sale on yogurt with OF-3101 live: `POINTS_AWARDED` includes the bonus; offer `redeemed` +1; funding +$1.00 (200 pts × $0.005).
- A4 After 10 yogurt sales, proposal qty ≥ before, and a `STOCK_RISK_RAISED` exists for OF-3101 when cover < threshold.
- A5 `ORDER_APPROVED` creates one inbound and one `RECEIVE` task for Aisha, with expectedQty = approved qty.
- A6 `DELIVERY_RECEIVED` with received < expected creates exactly one claim, value = shortQty × unit cost, and increases `onHand` by received only.
- A7 Pausing the offer removes the till rule, removes uplift, and lowers the proposal.
- A8 PRM-2698 → Pass, PRM-2702 → Warn, PRM-2720 → Fail on seed; Fail blocks publish.
- A9 Approving the Cola prebuild changes PRM-2702 from Warn to Pass.
- A10 `COUNT_SUBMITTED` eggs 30 → 0 creates a COUNT_VARIANCE of −30 and clears PHANTOM_SUSPECTED.
- A11 `RECALL_ISSUED` blocks the SKU at the till, creates pull tasks per lot, holds inbound, blocks proposals, flags PRM-2698.
- A12 Every event except root events has a non-null `causedBy`; following `causedBy` from any reaction reaches a human-actor event.
- A13 Reset restores seed exactly (deep-equal).
- A14 Two browser windows: an event in window 1 appears in window 2 within 1 second.
- A15 Rules are pure: running the same event on the same state twice gives identical output.

---

## 9. Demo tuning (`demoTuning.ts`, all labelled, all editable)

| Key | Default | Why |
|---|---|---|
| `offerUplift` (bonus points) | 0.40 | Source value is 0.10, which barely moves anything on screen |
| `upliftByMechanic` | Bonus pts 0.40, Member price 0.20, % off 0.20, Multi-buy 0.25, BOGO 0.35 | Others from `promotions-module.json` |
| `riskCoverDays` | 1.0 | Triggers C9 within the S1 flow |
| `largeDeviationPct` | 75 | Matches LARGE_DEVIATION in data |
| `autoReleaseTolerance` | 0.25 | Keeps most lines auto-released |
| `simulateSales.perClick` | 10 | Presenter button |
| `shortShip.defaultReceived` | 8 of 12 | S1 step 6 |
| `animationMs` | 600 | Highlight flash on changed values |

Rough check of S1 numbers on the hero item (calibrate to real engine): seed order 6 → with offer ~12 → after sales ~18–24 → after approval of 24, order 0 → after a short receipt, gap reopens by 1 case. Use these as sanity bounds, not exact asserts.

---

## 10. Known data inconsistencies (resolve in `seed/`, log each in `seed/CHANGES.md`)

1. Yogurt shelf/back room: positions say 17/0, gap-scan says 9/8. Use 9/8 (sum 17).
2. Eggs: count task says system 30, other screens say 0. Use 30 (the count shows the phantom).
3. OF-3101 is named "3x points" but the till rule R-BP-801 is "+200 bonus points". Relabel the offer to match the till rule so the story is consistent.
4. CMP-505 audience is "All active members" while OF-3101 audience is "Yogurt buyers, lapsed 30+ days". Set CMP-505 to the offer's audience.
5. Phantom examples in `inventory-health.json` are at other stores; Plano's phantom is the eggs count.
6. Some KPIs do not reconcile. Do not show KPIs in this demo unless derived live from state.

---

## 11. UI

- **Shell:** top bar with logo, role switcher, "Reset demo", "Presenter" toggle. Two layouts: single role full-screen, and **split view** (2×2 grid of the four panes). Default to split view for presenting.
- **Every pane** has: persona header, the main widget, a **bell/inbox** of notifications addressed to that role, and flash highlights on values that just changed (with the event id as tooltip).
- **Jamal (till):** scan list, basket, promo lines in stacking order, total with tax, member lookup, tender, "Complete sale".
- **Aisha (handheld, phone-width card):** task list (Receive, Count, Gap scan, Markdown, Recall pull), each task opens a simple form (received qty per line, counted qty, refill qty).
- **Emily:** offers list with live counters, campaign list, promo list with stock-check badge, "Publish / Pause", stock-risk banner, recall notice draft.
- **Priya:** proposal table (qty, last, onHand, inTransit, cover days, exception chips, status), approve/edit/hold, claims list, a small series chart for the selected SKU.
- **Event stream** (bottom drawer, always available): newest first; each row shows actor avatar, type, one-line description, and a **causality chip** ("because of #12"). Clicking a chip highlights the chain.
- **Presenter panel:** scenario picker, step list with Next/Back, Simulate sales, Short-ship toggle, Issue recall, speed, Reset.

---

## 12. Milestones (stop and review after each)

- **M0 Study:** read-only. Summarise data, field names, and anything in this SPEC that doesn't match. Propose the folder layout. No code.
- **M1 Foundation:** `seed/` extracted, `AppState` types, `EventStore` (append, subscribe, replay), BroadcastChannel sync, reset. Tests A13, A14, A15.
- **M2 Engine + P0 rules:** order-up-to engine and rules C1–C9 with tests A0–A8.
- **M3 Role panes:** four panes + inbox + event stream, split view.
- **M4 Presenter + S1 + S2:** scripted scenarios end to end.
- **M5 P1:** C10–C15 + S3, tests A9–A11.
- **M6 Polish:** highlights, empty states, copy, README with run instructions and a demo script. Optional SSE adapter.

---

## 13. Decisions after M0 (override the sections above where they differ)

Agreed with the client owner on 2026-10-01. Every resulting data change is logged in `seed/CHANGES.md`; every demo number is in `app/src/config/demoTuning.ts`.

1. **Layout.** The compiled prototype lives in `reference/`; docs in `docs/`.
2. **Seed is the "before" state.** OF-3101 Draft, R-BP-801 inactive, CMP-505 Draft. PRM-2698 stays Live, but its uplift counts as already inside the forecast (`upliftBakedIntoForecast`). RCL-2026-014 is not yet issued; Plano gets a cheddar SKU-100228 position (shelf 31). RCL-2026-015 is closed history.
3. **Exceptions calibrated to the seed** (replaces parts of §5.2 and §9): `autoReleaseTolerance` = 1.0 (not 0.25); SUPPLIER_CONSTRAINT only for claims raised during the demo; PROMO_UPLIFT fires when an active uplift raises qty above the no-uplift qty, and sends the line to PENDING_REVIEW.
4. **Proposal numbers win** (replaces §10.2): eggs onHand 19; count CNT-44821 shows system 19, found 0, so A10 asserts a variance of −19; eggs start PHANTOM_SUSPECTED via `phantomSignals`. ASN-US-778134 lines carry the planner's in-transit qty (yogurt 1 case = 6 units, not 4 cases).
5. **Engine (§5.1).** `orderUpTo` = `demandOverExposure` + `safetyStock` as stored; uplift scales `demandOverExposure`; `safetyStock` is a seeded input (not derivable from service level). Position uses `proposals.onOrder`, never `positions.onOrder` (which equals the proposed qty).
6. **Promo gate (§5.3).** Pass/Warn/Fail come from per-promo demand/supply in `demoTuning.promoStockCheck`; C11 flips PRM-2702 via `promoSupplyOnApproval`.

### M2 engine choices (made during M2, flagged for confirmation)

7. **seedAdjustment.** Strawberries' seed qty (80) is not the formula's (32); like every SHELF_CAPACITY line in proposals.json it is hand-set. The +48 difference is kept on top of the live formula so the seed and its exception reproduce exactly and still move with stock. All other lines: 0.
8. **PROMO_UPLIFT also covers pre-build.** A line with `prebuild > 0` keeps PROMO_UPLIFT (Cola, for the upcoming PRM-2702), in addition to the §13.3 trigger (active uplift raises qty).
9. **Stock risk** compares exact cover with the threshold and displays it rounded down (0.998 days shows as 0.99, never as "1.00 < 1.0").
