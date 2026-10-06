# POC Improvement Spec: turning the "Shelf" prototype into a working replenishment POC

Prepared 2026-10-01 from the published demo (John Henry Supermarkets), its 24 mock data files, and its compiled app code. Everything marked **[verified]** was checked against those files. Everything marked **[proposed]** is my recommendation, not something the prototype already does.

---

## 0. What I found (read this first)

1. **It is not a shell.** The app has about 40 screens (`/replenishment`, `/forecast`, `/receiving`, `/store`, `/inventory`, `/purchase-orders`, `/overview` and more) and every screen works. What is missing is everything behind the screens: no database, no forecasting, no real AI, no real login. **[verified]**
2. **All data comes from static files.** The app loads every screen's data with `fetch("./mock/<name>.json")`. **[verified]**
3. **Nothing is saved.** Approvals, overrides and the signed-in persona live in browser *sessionStorage* under the keys `shelf.proto.decisions`, `shelf.proto.overrides` and `shelf.proto.user`. Close the tab and they are gone. **[verified]**
4. **The original source code almost certainly exists.** The app's own error message says `mock/<name>.json → 404. Run npm run mock.` That means the original project has a script that *generates* these files. We only have the compiled copy. Finding that repo is the single most valuable thing you can do (see section 1).
5. **The "AI" is canned.** `copilot.json` holds 4 pre-written questions with pre-written answers. **[verified]**
6. **The prototype's own design text already describes the target.** It says "Type a question; AI writes SQL against the governed semantic layer, shows the SQL and the result so you can check it before sharing" and "Store-level users only see their own stores (row-level security)". We are building what the prototype already promises.

### Mock numbers that do not agree with each other (we must pick one definition)

| Metric | Dashboard says | What the underlying data says |
|---|---|---|
| Pilot out-of-stock rate | 3.0% (control 5.4%) | **1.58%** over the 9 weekly rows from 3 Aug onward vs **5.31%** over the 30 weeks before (`series.json`) |
| Forecast error (WAPE) | 17.3% vs 27.2% legacy | 17.9% vs 27.1% in pilot weeks. Close, so this one roughly reconciles |
| Phantom-stock suspects | 47 (`inventory-health`) | 13 flagged positions (`inventory.json`), 9 in the phantom list, 7 on proposals |
| Control stores (6) | Used for the comparison | **Have no data at all.** No series, no stock positions. The comparison is hard-coded |
| Exceptions | 54 | Only partly rule-based. 28 *unflagged* lines have an order change of +75% or more vs the last order, while 13 lines are flagged for large change, so the mock flags are partly hand-picked |

Auto-release at 83.6% **does** reconcile exactly (276 of 330 lines). Once we compute things for real, numbers will change. That is expected and healthy.

---

## 1. Decision zero: where does the screen code come from?

| Option | What it means | Effort | Verdict |
|---|---|---|---|
| **A. Get the original source repo** | Ask whoever built it for the repo (it has `npm run mock`). Claude Code can then edit screens normally and wire them to a real backend. | Lowest | **Do this first. One message to the creator.** |
| **B. Keep the compiled app, replace the data underneath** | Build a backend that serves the same `/mock/<name>.json` URLs from a real database. Screens read live data without any code change. Writes (approve, count, receive) need a small script injected into `index.html` that mirrors the three sessionStorage keys to the backend. | Medium. **Untested.** Do a 1-hour spike first | Good fallback for the POC |
| **C. Rebuild the UI from scratch** | Use the compiled app only as a visual reference. | Highest | Only if A and B both fail |

Everything below works with A or B. With C you also have to rebuild the three role UIs.

---

## 2. The target: one closed loop

```
 Store sales + deliveries + counts
            |
            v
   Stock ledger (append-only)  ---->  Phantom-stock detector
            |                                |
            v                                v
   Nightly forecast (P50/P80/P95)     Count tasks to handhelds
            |                                |
            v                                |
   Order-up-to engine --> proposals ---------+
            |
   auto-release (about 84%)  /  exceptions (about 16%) --> Priya reviews by 06:00
            |
            v
   Purchase order -> DC picks -> store delivery (Aisha receives) -> back to the ledger
            |
            v
   Daniel's scoreboard (computed, not hard-coded) + the Ask-your-data copilot
```

The POC is "done" when you can click **Advance day** in a demo and watch this loop run by itself, with Priya, Aisha and Daniel each seeing their part.

Three roles, in priority order: **Priya (replenishment planner)** is the product, **Aisha (store associate)** feeds it real data, **Daniel (HQ executive)** is the scoreboard. The other 8 personas stay as read-only mock screens.

---

## 3. The workstreams

### WS1. Real database (replaces the JSON files)

**Stack [proposed]:** Postgres (Supabase or a local Docker container) and a Python API service (FastAPI). Nightly job triggered by cron or n8n.

**Tables to create** (column names follow the mock so the UI keeps working):

| Group | Tables | Notes |
|---|---|---|
| Organisation | `stores` (36, with `group` pilot/control), `dcs` (2), `users` (40), `roles`, `user_scopes` | Seed from `org.json` and `admin.json`. 11 personas map to roles `exec, category, planner, dc, storeManager, cashier, associate, marketing, finance, service, admin` |
| Catalogue | `items` (33), `suppliers` (6), `store_item_params` | `store_item_params` holds service level, review days, shelf capacity, delivery days per store-item. 451 store-item positions exist, 330 have proposals |
| Demand | `daily_sales`, `promotions` (5), `events` (9), `forecasts` | See the daily-data gap below |
| Stock | `stock_ledger` (append-only), `stock_lots`, view `stock_positions` | Ledger event types seen in the mock: `OPENING, SALE, DC_RECEIPT, DSD_RECEIPT, SUPPLIER_RECEIPT, DC_SHIPMENT, WASTE, ADJUSTMENT, RETURN, COUNT_VARIANCE, MOVE, TRANSFER_IN, TRANSFER_OUT` **[verified]**. On-hand is always *calculated from the ledger*, never typed in |
| Replenishment | `planning_runs`, `order_proposals`, `proposal_events` | One row per proposal, plus an audit trail (created, auto-released, edited, approved, rejected) |
| Supply | `purchase_orders`, `po_lines`, `asns` + `asn_lines` (DC to store), `receipts`, `claims` | See the ASN gap below |
| Counts | `count_tasks`, `count_lines`, `adjustments` | |
| KPIs | `kpi_daily` | Snapshot per store, category and day so the scoreboard is fast |

**Seed script:** `seed_from_mock.py` loads every file above. Must be re-runnable (drops and reloads).

**Data gaps to fix while seeding (found in the mock):**

1. **No daily sales history.** `series.json` is weekly (39 history weeks plus 13 forecast weeks, 330 store-item series). The ledger has only 14 days of daily `SALE` events. Ordering is daily (review 1 or 3 days, lead time 1 to 3 days). **[proposed]** Generate a synthetic `daily_sales` table that sums exactly to each weekly actual, using a day-of-week profile per category plus noise. Label it synthetic.
2. **Two different ASN worlds.** `supply.json` ASNs are supplier-to-DC (22 of them). The store receiving task uses `ASN-US-778134`, which exists only as an `asnId` on a delivery record (`pods`), with no line items in `supply.json`. The store-side line list lives only in `store-tasks.json`. **[verified]** Create proper DC-to-store ASNs with lines, generated from picked quantities.
3. **ID formats differ.** Ledger refs look like `ASN-546102`, shipping records like `ASN-US-778134`. Pick one format.
4. **Control stores have no data.** Either generate data for the 6 control stores or change how the pilot result is measured (see WS5).

**Done when:** the app can run with no `/mock` folder and every screen renders from the API.

---

### WS2. Real replenishment engine (the heart of the POC)

**2.1 The ordering rule (already implied by the mock, now confirmed)**

The mock follows an *order-up-to* policy. Think of filling a tank to a marked line: each day you top it up to the line, counting fuel already on the way.

```
order_up_to S   = forecast_per_day x (lead_time + review_days) + safety_stock
inventory_position = on_hand + in_transit + on_order
order_qty       = roundUp_to_case_pack( max(0, S - inventory_position) )
```

I checked this against `proposals.json`: it reproduces **276 of 276** auto-released lines exactly. **[verified]**

**Inputs and where they come from:**

| Input | Source | Mock values |
|---|---|---|
| Service level z | By ABC class [verified] | A = 0.98 (126 lines), B = 0.95 (133), C = 0.90 (71) |
| Lead time L (days) | Store-item delivery schedule | 1 day (202 lines), 2 (70), 3 (58) |
| Review days R | Delivery frequency | 1 (202 lines), 3 (128) |
| Safety stock | `z x sqrt( (L+R) x sigma_d^2 + d^2 x sigma_L^2 )` [proposed] | `sigma_L` from `suppliers.json` `leadTimeSd`. Clearwell is the worst: 5-day lead time, 1.6 days of variability, 88% fill rate |
| Perishable cap | Cap order-up-to cover at 70% of shelf life [proposed, from the mock's `overstockDays.perishableShareOfLife: 0.7`] | Bakery 5-day life, produce 7, dairy 14 |
| Shelf capacity | `store_item_params` | Proposal flagged if `order_qty + on_hand > shelf_capacity` |

Why the lead-time term matters: a published perishables study found that ignoring lead-time uncertainty gave an 80.74% fill rate against a 98% target, and modelling it cut waste by about 35% ([source](https://www.sciencedirect.com/science/article/pii/S2351978920303383)).

**2.2 Forecasting, in two stages**

*Stage 1, rule-based (days 1 to 3), so the loop runs end to end:*
daily forecast = trailing 8-week average of **unconstrained** demand x day-of-week factor x event factor x promotion uplift. Uplifts come from `promotions.json` (for example the Halloween cola member price is 1.9).

*Stage 2, a real model (after the loop works):*
- One **global LightGBM model** across all 330 store-item series (not one model each). Features: lags (1, 2, 3, 4, 8 weeks; you only have 39 history weeks, so skip 52), 4 and 8-week rolling means, promo flag and uplift, event flag, week of year, category, ABC/XYZ class, price, store format.
- **Uncertainty without training many models** [proposed]: use the model's forecast as the mean of a negative binomial distribution, estimate the spread from past errors, and read P50, P80 and P95 from it. This is the approach in a practitioner paper on retail gradient-boosted forecasting ([source](https://arxiv.org/html/2311.00993v1)). The mock already stores P50, P80 and P95 per future week, so the shape is ready.
- **Backtest honestly:** train on weeks -38 to -13, test on the last 13 weeks. Report WAPE, bias and a promo-weeks-only WAPE, always next to the `legacy` column (about 27% WAPE in the data). Acceptance target [proposed]: at least 15% lower WAPE than legacy and bias under +/-5%.
- **Warning:** this data is synthetic. If the weekly actuals were generated as "forecast + random noise", no model can beat that noise. First measure the noise floor so you know what is winnable. Do not promise the mock's 17.3%.

**2.3 Stockouts hide demand (important)**

When a shelf is empty, the till records zero sales, not the sales you lost. It is like counting customers by watching the till: an empty shelf reads "nobody wanted it". In the data, the 573 stockout weeks (`oos: true`) have actual sales at only **59%** of forecast on average. **[verified]** Training on those raw numbers teaches the model to under-order, which causes more stockouts. A fresh-retail study measured this bias at -6.69% and cut it to -0.13% by recovering the hidden demand first ([source](https://arxiv.org/html/2505.16319v3)).

**[proposed]** In the training table, flag `oos` weeks as censored. Start simple: replace their actuals with the model's prediction for non-stockout weeks (iterate twice). Later: an asymmetric loss.

**2.4 Exception rules (what makes a line need human review)**

The mock has 7 exception codes. Implement these as explicit rules so every flag is explainable:

| Code | In mock | Rule to implement |
|---|---|---|
| `PROMO_UPLIFT` | 13 (all DC items) | A promotion starts within the planning window. Add a pre-build of roughly the first N days of extra demand. In the mock, 77 units on a line forecast at 19.1/day with +90% uplift is about 4.5 days; start with N = 4 and make it a setting |
| `LARGE_DEVIATION` | 13 | Order changes by more than +/-75% vs the last order **and** the change is worth more than a set value. The mock is not consistent here, so use your own explicit rule |
| `SUPPLIER_CONSTRAINT` | 9 (all Clearwell) | Supplier 8-week fill rate below 90%. Only Clearwell (88%) is below 90% in the data. The mock flags 9 of Clearwell's 30 lines, so also require stock-out risk above a threshold |
| `SHELF_CAPACITY` | 8 | `order_qty + on_hand > shelf_capacity`. **Verified:** all 8 flagged lines meet this, and no unflagged line does |
| `PHANTOM_SUSPECTED` | 7 | See 2.5 |
| `LOW_CONFIDENCE` | 2 | Confidence is simply XYZ class in the mock (X = High 209, Y = Medium 80, Z = Low 41). **[proposed]** Replace with the real spread: `(P80 - P50) / P50` above a threshold |
| `NEAR_EXPIRY` | 2 | Units expiring within 2 days (items with 7 days of life or less) or 3 days (longer-life items) exceed what will sell. Thresholds are in `inventory.json` |

Severity (low, medium, high) comes from the rule. Auto-release = no exception. Target stays at 80% or more auto-released (the mock's target).

**2.5 Phantom-stock detector** (the system says there is stock, the shelf is empty; like a fridge the app thinks still has milk)

The mock's own explanation text reads "no sales for 2 days where 5 were expected (p < 0.01)". That is a simple probability test. **[verified, and consistent with all 9 examples: every one has 5 or more expected sales]**

```
expected_sales = daily_demand x hours_since_last_sale / 24
flag if  exp(-expected_sales) < 0.01      (about 4.6 expected sales)
     and system_on_hand >= expected_sales
     and no count in the last N days
```

Add two more signals: a **gap-scan finding** (shelf empty while the system shows stock; the handheld already has this flow) and **count overdue** from the count programme (A items monthly, B quarterly, C twice a year). Research supports this approach: phantom stock is much more likely with infrequent counts (about 18% with monthly counts vs 27% with twice-yearly audits), and counts should be targeted rather than blanket ([ECR](https://ecrloss.com/research-paper/predicting-inventory-record-inaccuracy/), [RELEX](https://www.relexsolutions.com/resources/phantom-inventory/)).

When flagged: create a blind count task, hold the order line, and carry an `ifEmptyQty` fallback (the mock field exists, populated on 3 lines). When the count lands: write a `COUNT_VARIANCE` ledger event, then re-run that one item's proposal.

**Done when:** a nightly job produces about 330 proposals; an independent test re-computes the order rule and matches 100% of auto-released lines; the backtest report exists; each exception rule has a unit test.

---

### WS3. Priya's screens (replenishment planner), what to add

The `/replenishment` screen exists. Make these behaviours real:

1. **Run status banner** fed from `planning_runs`: forecast ready, proposals published, sent to POS, deadline 06:00, model version. (Mock values: 03:12, 03:47, 05:02, 06:00, `fc-lgbm-us-tx-2026.39`.)
2. **Exception queue** sorted by severity x value, with filters: store, category, exception code, supplier, confidence.
3. **Proposal drawer** ("why this number"): show on-hand, in-transit, on-order, P50 and P80 forecast, L, R, safety stock, order-up-to, case-pack rounding, with the formula traced step by step. Add the 52-week chart: actual vs model forecast vs legacy, stockout weeks marked, promotions and events marked.
4. **Actions on a line:** Approve; **Edit quantity** (required reason code from a list: `PROMO_KNOWLEDGE, LOCAL_EVENT, SUPPLIER_ISSUE, STORE_REQUEST, OTHER`); Reject (order 0); **Order if empty** for phantom lines.
5. **Bulk approve** all low-severity, high-confidence lines in one click, with a count and total value shown before confirming.
6. **Forecast override** (the mock has an `override` field on future weeks): a quantity or percentage change with a reason and an expiry date.
7. **Approval limits** from `admin.json` apply (for example, adjustments under $250 are the store manager's, $250 to $2,500 the district manager's). A user cannot approve their own purchase order (one of the 6 segregation-of-duties rules).
8. **Cut-off behaviour at 06:00** [your decision, see section 5]. Default I suggest: untouched medium and low lines release as proposed; high-severity lines stay held and are listed in a "missed cut-off" panel.
9. **Audit trail** on every line (who, when, old and new quantity, reason).
10. **Value-add report** [proposed]: every edit is logged, and a weekly view shows whether planner edits made the result better or worse than the system's number (a standard measure called Forecast Value Added). This is what proves "humans only handle exceptions".

**Done when:** Priya can clear the queue, and her approvals, edits and reasons are still there after a browser refresh and visible in the audit log.

---

### WS4. Aisha's handheld flows (the data feed)

Every action writes events to the stock ledger. Nothing edits on-hand directly.

**Receive delivery** (task example: `ASN-US-778134`, 12 lines, some flagged short-ship):
- Scan or pick each line; enter cases received; variance against `expectedCases` shows immediately.
- Variance reasons: `SHORT, OVER, DAMAGED, WRONG_ITEM, EXPIRY_TOO_SHORT`. Short ships raise a supplier claim automatically (the app already generates `Short shipment` claims in code).
- Capture best-before date for perishables; reject if remaining life is under a minimum share of shelf life [proposed: 50%, configurable].
- Confirm writes `DC_RECEIPT` or `DSD_RECEIPT` events (units = cases x case pack), flips the delivery record from "Awaiting store receipt" to received, and sets `casesReceived`.

**Count** (task example: `CNT-44821`, 8 lines, "Phantom stock suspected"):
- **Blind count**: the system quantity is hidden until she enters hers (this already exists in the prototype).
- Freeze the system quantity at the moment the task is created, and add movements since then, so a sale during the count does not create a fake variance. Counting itself introduces errors, so the tool should make people count only what is flagged.
- Variance rules [proposed]: within tolerance auto-accepts; above a threshold forces a **recount**; the value decides the approver via the approval-limit tiers.
- Writes `COUNT_VARIANCE` events, closes the phantom flag, triggers re-planning of that item.

**Gap scan:** keep the behaviour the app already has (backroom stock available means "Refill min(backroom, 12) from back room"; otherwise "Awaiting delivery"), and add: **shelf empty while the system shows stock** creates a phantom count task automatically.

**Markdown labels** (task `t4`, 14 items expiring within 2 days): write a `MARKDOWN` event and feed it to the waste metric.

**Not for the POC:** offline mode on the handheld. Build it as a mobile web page.

**Done when:** a receipt or count done on the handheld changes the on-hand number Priya sees in her next proposal.

---

### WS5. Daniel's scoreboard (executive), computed KPIs

Replace every hard-coded number with a calculation. Definitions to agree before building:

| KPI | Formula | Mock value | Source data |
|---|---|---|---|
| Out-of-stock rate | store-item-days with zero stock during open hours / all store-item-days | 3.0% | `daily_sales` + ledger balance. The weekly data gives 1.58% in pilot weeks vs 5.31% pre-pilot |
| Forecast error (WAPE) | sum of absolute errors / sum of actuals | 17.3% vs 27.2% | `forecasts` vs `daily_sales` |
| Forecast bias | (sum forecast - sum actual) / sum actual | not shown | add it; it shows if the model under-orders |
| Days on hand | on-hand units / average daily demand | 11.8 vs 13.9 | ledger |
| Auto-release rate | auto-released lines / all lines | 83.6% | **reconciles exactly** (276 / 330) |
| Fresh waste rate | waste value / sales value | 2.4% vs 3.1% | `WASTE` ledger events (1,337 in the mock) |
| Lost sales avoided | `(baseline OOS rate - pilot OOS rate) x forecast units x price`, state clearly whether revenue or margin | $186,400 | needs the baseline decision below |
| Phantom suspects | one agreed definition (flag rule in 2.5) | 47 / 13 / 9 / 7 | detector |

**Pilot vs control, you must choose [your decision]:**
- (a) Generate data for the 6 control stores so a real comparison exists, or
- (b) Compare each pilot store against its own pre-pilot baseline (30 weeks of history), adjusted for seasonality.
Option (b) works with the data you already have.

**Screens:** KPI tiles, the 16-week pilot trend (already designed in `inventory-health.json`), a category table (5 categories), a store x category out-of-stock heatmap (30 stores), the phantom list, and a "planning run health" tile. Every tile needs a "how is this calculated" tooltip.

**Done when:** every number on `/overview` and `/home` traces to a query, and Daniel can click any tile to see the underlying rows.

---

### WS6. Real AI copilot ("Ask your data")

**Design principle:** the AI never touches the database directly and never changes anything. It calls fixed, safe tools; the code, not the AI, builds the citations. Security must be enforced in the database, not in the prompt: "Prompting tells the model what you want, not what it's allowed to do" ([Arcade](https://www.arcade.dev/blog/sql-tools-ai-agents-security/)).

**Tools the model may call** (all read-only, all filtered by the signed-in user's scope):

| Tool | Inputs | Returns |
|---|---|---|
| `get_kpi` | metric, store?, category?, date range, compare_to? | value, baseline, definition |
| `get_stockouts` | store, item, date range | out-of-stock days and hours, estimated lost units |
| `get_forecast_vs_actual` | store, item, weeks | series with P50, P80, actual, flags |
| `get_order_proposals` | status, exception code, store, category, severity | list with the formula trace |
| `get_supplier_scorecard` | supplier, weeks | fill rate, OTIF, lead-time variability, short ships |
| `get_inbound_shipments` | store or DC, date range | ASNs, deliveries, short picks |
| `get_stock_position` | store, item, days | position plus recent ledger events |
| `get_phantom_suspects` | store? | detector output |
| `get_promotions` | active or upcoming | promotions with uplift |
| `compare_pilot_baseline` | metric, period | pilot vs baseline |
| `run_readonly_sql` (optional) | one SELECT | rows. Only on an `analytics` schema of views, SELECT-only database role, column allowlist, 5-second timeout, 500-row limit. **Always show the SQL to the user** (the prototype's own design) |
| `draft_order_change` | proposal id, new qty, reason | a **draft** suggestion card (title, detail, impact), exactly like `copilot.json`'s `suggestion`. The user clicks Approve; the click calls the normal API **as that user**. The model cannot approve anything |

**Rules:**
- Every number in an answer must come from a tool result. If a tool returns nothing, say so; never guess.
- Citations follow the existing format (`label`, `ref`) and are built from the tools actually called.
- Treat all database text as untrusted data (an item name containing "ignore previous instructions" must do nothing).
- Database controls: dedicated role, only the needed tables and columns, row-level security by store scope (each user sees only their own rows), connection string never in the model's context.
- Use Claude through the API with tool calling and streaming.

**Seed the demo story so the canned answers become true:** the prototype's example "Why did milk go out of stock last week?" says Frisco Whole Milk was out for about 9 hours, demand was 34% above forecast, a Prairie Gold delivery was 2 cases short (91% fill), and safety stock covered about 1 of 2 days. Plant those facts in the database as a named scenario so the live copilot finds them by itself.

**Test set [proposed]:** 25 golden questions with known answers from direct SQL (the 4 canned ones plus 21 more: stockouts, forecasts, suppliers, phantom stock, promotions). Pass = the numbers match exactly. Add tests for: a question outside the user's scope, a write request, a prompt-injection attempt, and "I don't know" cases.

**Done when:** the 4 original questions are answered live from the database with correct numbers and citations, and the security tests pass.

---

### WS7. Real login and roles

- Real authentication (Supabase Auth or a simple JWT service). Roles and scopes from `admin.json` (for example, Priya: all Texas stores; Aisha and Angela: Plano Market only; Marcus: Temple DC only).
- Row-level security in Postgres so scope is enforced by the database. API checks are a second layer.
- Keep the persona picker as **demo mode**, switched on by one environment flag. Keep the "company SSO" button as a visible placeholder.
- Enforce the segregation-of-duties rules that matter here (own PO approval, adjustment approval limits). The other 4 rules (till, deposits and similar) stay mock.

---

### WS8. Simulator ("Advance day"), what makes the demo work

Without this, the loop only moves when someone clicks around. Add an admin panel with:

1. **Advance day**: generate sales per store-item (demand model plus noise), deliver orders arriving that day (using each supplier's real fill rate), post ledger events, run the nightly plan at 03:00, auto-release, refresh KPIs.
2. **Scenario buttons:** demand spike at a store; supplier short-ship (for example Clearwell at 70%); **inject phantom stock**.
3. For phantom injection the simulator keeps a hidden `true_on_hand` that only the simulator knows. The system believes the ledger; reality differs. That lets you demonstrate detect, count, correct on demand.
4. **Reset to baseline** button that reloads the seed.

---

## 4. Build order and milestones

| # | Milestone | Contains | Done when |
|---|---|---|---|
| M0 | Decide and prepare | Ask for source repo (A). Run the 1-hour spike for option B. Repo skeleton, Postgres running | Decision recorded |
| M1 | Real data | WS1 seed + API serving every screen | App runs with no `/mock` folder |
| M2 | Rule-based engine | WS2 stage 1, exceptions, phantom detector. Priya approves and it saves | Order rule matches 276 of 276 lines |
| M3 | Close the loop | WS4 handheld flows write the ledger, WS8 simulator | One simulated week runs with no manual steps |
| M4 | Real forecast | WS2 stage 2 + backtest report | Backtest report published, honest numbers |
| M5 | Scoreboard | WS5 computed KPIs | Every tile traces to a query |
| M6 | Copilot | WS6 tools, tests, seeded scenario | 25 golden questions pass |
| M7 | Hardening | WS7 auth and row-level security, demo script, README | Clean-room install works from the README |

**Deliberately not built:** POS, cash office, loyalty, finance close, pricing, workforce, warranty, offline handheld, real SSO, real integrations. Leave those as the existing mock screens.

---

## 5. Decisions I need from you

1. **Source repo:** can you ask the creator of the original demo for the repo? (Changes everything in section 1.)
2. **Cut-off at 06:00:** what happens to lines Priya has not touched? Options: auto-release all, hold all, or release medium and low and hold high (my default).
3. **Pilot vs control:** generate control-store data, or compare against each store's own pre-pilot baseline (my default)?
4. **Lost sales avoided:** measured as revenue or as margin?
5. **Where it runs:** local laptop only, or hosted for client demos (affects Supabase vs Docker and the LLM key handling)?
6. **Who is the POC for?** If it is a client demo, WS8 (simulator) moves up and WS7 (auth) can slip. If it is an internal proof that the logic works, WS2 and the backtest matter most.

---

## 6. First prompts for Claude Code (copy and paste, in order)

**Prompt 1 (read only):**
> The folder `john-henry-supermarkets/` is the compiled output of a retail replenishment demo. Do not edit it. Read `mock/*.json` and write `docs/DATA_MODEL.md` listing every file, its shape, and the relationships between files. Flag any inconsistencies (for example ASN ID formats, control stores with no data, KPI mismatches). Do not write app code yet.

**Prompt 2 (after you review):**
> Using `docs/DATA_MODEL.md` and `POC-improvement-spec.md`, propose the Postgres schema for WS1 as SQL migrations and a `seed_from_mock.py` script. Show me the schema first and wait for approval before running anything.

**Prompt 3:**
> Implement the order-up-to rule from section 2.1 in `engine/replenish.py` with unit tests. The test must recompute every auto-released line in `mock/proposals.json` and match 276 of 276.

---

## 7. Sources

- [Phantom inventory: causes, detection, and how to fix it (RELEX)](https://www.relexsolutions.com/resources/phantom-inventory/)
- [Predicting Inventory Record Inaccuracy (ECR Retail Loss)](https://ecrloss.com/research-paper/predicting-inventory-record-inaccuracy/)
- [FreshRetailNet-LT: censored demand in fresh retail (arXiv)](https://arxiv.org/html/2505.16319v3)
- [Supply planning of perishables under lead-time uncertainty (ScienceDirect)](https://www.sciencedirect.com/science/article/pii/S2351978920303383)
- [Scalable probabilistic forecasting in retail with gradient boosted trees (arXiv)](https://arxiv.org/html/2311.00993v1)
- [How to build SQL tools for AI agents (Arcade)](https://www.arcade.dev/blog/sql-tools-ai-agents-security/)
- [Guide to grocery replenishment (Cleverence)](https://www.cleverence.com/articles/for-business/grocery-replenishment-4827/)

**What I did not test:** option B (serving the app from a backend), any model accuracy, and anything about the app's behaviour while running (I read its code and data, I did not click through it). The 1-hour spike in M0 settles option B.
