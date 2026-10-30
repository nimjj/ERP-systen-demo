# Run the demo: a plain guide

Everything you need to set up, start and present the SPAR connected-retail demo. Read top to bottom once; after that the [checklist](#before-the-client-joins-checklist) is enough.

> **Branch note:** this is the trimmed `flow-demo` branch. The test suite, the platform demo (`reference/`) and the seed tooling are not here; they are on `main-build`. Sections below that mention them (`npm test`, the platform demo, `contrast-audit`) only work on `main-build`.

## What you are showing

Four people at one store (Plano Market, Texas) work in **one shared, live set of facts**. When one of them does something, the other three screens react on their own, with no refresh and no overnight sync.

| Person | Role | Screen | What they do |
|---|---|---|---|
| **Jamal Carter** | Cashier | Till | Scans, identifies the Rewards member, applies coupons, takes payment (card and points) |
| **Aisha Khan** | Store associate | Handheld | Receives deliveries, counts stock, refills shelves, pulls recalled items |
| **Emily Chen** | Loyalty & marketing | Offers, promotions, members | Publishes offers, sends coupons, checks promotions against stock, sends recall notices |
| **Priya Raman** | Replenishment planner | Order proposals | Approves orders, sees supplier claims, watches stock cover |

Two stories, matching the two things you are demoing:

| Demo | Scenario | Time | What it proves |
|---|---|---|---|
| **Loyalty management** | **S4 · Loyalty loop** | ~3 min | Offers, coupons, bonus points, paying with points and 1:1 offers all run through one system, with live programme numbers and who funds what |
| **Supply chain management** | **S1 · From offer to shelf** | ~4 min | A promotion changes demand and the order *before* the shelf runs empty; a short delivery raises a supplier claim by itself |
| | **S2 · Promo gate** | ~2 min | A promotion is checked against real supply before customers are promised it |
| | **S3 · Recall hits everyone** | ~2 min | One recall notice reaches the till, the shelf, the supplier order and the customer |

S1 starts with a loyalty offer and ends in supply chain, so it is the bridge between the two. For a loyalty-only pitch, see [Loyalty-only pitch](#loyalty-only-pitch-5-minutes).

How the screens affect each other:

```
 Emily (loyalty)         Jamal (till)           Aisha (store)          Priya (planner)
 publishes offer ──► bonus points on scan
 sends coupon ─────► coupon in wallet ──► coupon applied at checkout
                     sale + points paid ─► points & coupons counted ──► Emily's scorecard
                     sale ───────────────► shelf stock falls ─────────► order grows
 stock-risk warning ◄───────────────────────────────────────────────── cover too low
                                         approved order ──► "receive delivery" task
                                         short delivery ──────────────► supplier claim
```

Every click becomes an **event**; the event stream (bottom bar) shows each one and what caused it.

## One-time setup (about 5 minutes)

You need **Node.js 22.6 or newer** (it has been tested on Node 24) and a modern browser (Chrome or Edge is best).

1. Check Node: open PowerShell and run `node -v`. If it is older than v22.6 or missing, install the LTS version from https://nodejs.org.
2. Get the code (if you do not already have it):
   ```powershell
   git clone https://github.com/nimjj/ERP-systen-demo.git
   cd ERP-systen-demo
   ```
3. Install the app's packages (needs internet, once):
   ```powershell
   cd app
   npm install
   ```

That is all. The demo has no database, no login and no server to configure. Its data is JSON in `seed/`, and its state lives in the browser.

## Start the demo

From the `app` folder:

```powershell
npm run dev
```

Open **http://localhost:5173**. (If that port is busy, Vite prints the one it chose; use that.) Leave the PowerShell window open while presenting; **Ctrl+C** stops it.

You land in **Split view**: all four screens in one window. This is the best view for presenting.

### Ways to open it

| Want | Do this |
|---|---|
| All four screens in one window | http://localhost:5173 (Split view tab) |
| One person full screen | Click their name in the top bar, or the expand icon on their pane |
| Four separate windows (best on two monitors) | Open the same address four times with `?role=jamal`, `?role=aisha`, `?role=emily`, `?role=priya` added, e.g. `http://localhost:5173/?role=emily`. Actions in one window appear in the others within a second |
| A scenario ready to go | Add `?scenario=S1`, `S2`, `S3` or `S4`. This resets the demo and opens the Presenter on step 1 |

Windows must be in the **same browser profile** to stay in sync (not one in Chrome and one in Edge, and not one incognito).

## The Presenter panel

Click **Presenter** (top right). It is your teleprompter:

- Pick a scenario at the top. For each step it shows **who acts**, **what to click**, and **what the audience should watch**.
- **Next ›** does the step for you; clicking in the pane does exactly the same thing and produces identical events. Clicking is more convincing; Next is safer when time is short.
- **‹ Back** undoes the last step in every open window.
- **Reset** returns every window to the starting state.
- **Simulate 10 sales** sells ten yogurts at the till. **Issue recall** fires the cheddar recall. **Short-ship deliveries** (ticked by default) makes deliveries ordered during the demo arrive 4 units short.

Picking a scenario from the list does **not** reset. Press **Reset** first, or open the `?scenario=` link, which resets for you.

## Before the client joins (checklist)

1. `npm run dev` is running and http://localhost:5173 loads (SPAR logo, four panes).
2. Browser window is wide (full screen on a 1080p or larger display; zoom 100%).
3. Press **Reset demo** (top bar). The event stream should say 0 events.
4. Open the **Presenter** and pick the scenario you will start with.
5. Run it once with **Next** to see it work, then **Reset** again.
6. For a loyalty demo, glance at Emily's **Members** tab and the till's member box once so you know where things are.
7. Close other tabs and notifications. Do a final **Reset**.

## Loyalty demo: S4 · Loyalty loop (~3 min)

Open **http://localhost:5173/?scenario=S4**, then follow the Presenter.

| # | Who | Click | What the audience sees |
|---|---|---|---|
| 1 | Emily | **Publish to Plano Market** on the yogurt offer | The till now shows "+200 pts Greek yogurt". Prairie Gold Dairy pays for it, not the retailer |
| 2 | Emily | **Members** tab → Maria Delgado → pick "$0.75 off Plain Greek Yogurt 32 oz" → **Send to wallet** | At the till, Maria's wallet goes from 2 to 3 coupons |
| 3 | Jamal | Rewards member **Maria Delgado** → **Key item** Plain Greek Yogurt twice, then Strawberries 1 lb → **Pay with points: +** once → **Complete sale** | Coupons come off the price, the yogurt bonus adds 400 points, $5.00 is paid with 1,000 points, card pays $7.13. Emily's scorecard moves; Maria's points history shows the earn and the burn |
| 4 | Jamal | Rewards member **Daniel Okafor** → Sparkling Water 8 pk → **Complete sale** | Daniel's personal offer adds 250 points; Emily's "Personalised offers" row shows 1× |

Numbers you should see at the end: Maria **7,838 points** (8,420 + 418 earned − 1,000 spent), **2 coupons used ($2.50)**, **supplier funded $3.50**, **retailer funded $2.37**, 15 events.

What to say: *"Offers, coupons, points and payment are one connected system. Emily sees what each promotion costs and who pays for it as it happens, instead of in next month's report."*

### Loyalty-only pitch (5 minutes)

For a client who only cares about loyalty (for example the second client):

1. **Intro (30 s):** show the till and Emily's screen only: "the till and marketing share one member record."
2. **S1, steps 1 and 2** (offer published, Maria buys yogurt and earns bonus points). Press **Next** twice, or click through.
3. **S4** from step 2 onward (coupon, points as payment, personal offer).
4. **Emily → Members tab → Maria:** wallet, tier benefits, live points history.
5. **Emily's scorecard:** point to *Supplier funded* vs *Retailer funded*: "the supplier pays for what they promote."
6. **Close (30 s):** "tiers, points value, coupon rules and offers are all data. Your programme is configuration, not new software."

## Supply chain demo

Use **S1** (steps 3 to 6 carry the supply story), **S2** and **S3**. The full six-minute script with exact wording is in [`docs/DEMO-SCRIPT.md`](docs/DEMO-SCRIPT.md).

## If something goes wrong

| Problem | Fix |
|---|---|
| A step does not advance | Press **Next**; it does what the click would have done |
| You clicked the wrong thing | Press **Back** (undoes the last step everywhere) |
| Anything looks odd | **Reset** in the Presenter, pick the scenario again |
| Windows are out of sync | Make sure they are in the same browser profile; press **Reset demo** in one of them |
| Screen still shows an old session | Clearing site data for `localhost:5173` is a hard reset |
| `npm run dev` fails: "port in use" | Close the other dev server, or use the address Vite prints |
| `npm install` fails | Check the internet connection and `node -v` (needs 22.6+); delete `app/node_modules` and retry |
| Blank page after `npm run build` and double-clicking `index.html` | Browsers block this from a file. Serve it: see below |
| The handheld says "Good morning" at 2:35 PM | Known: the demo's clock is fixed at Mon 28 Sep 2026, 2:35 PM |

## Other things you can run

**Show it with no dev tooling (static build).** Useful for a laptop that will present offline:

```powershell
cd app
npm run build
cd dist
python -m http.server 8080      # or: npx serve .
```

Open http://localhost:8080. The `dist` folder is a plain static site and works from any web server.

**The platform demo** (the ~40-screen static prototype with replenishment, forecast, inventory, purchase orders and more). It is read-only and separate from the live demo:

```powershell
cd reference
python -m http.server 8081
```

Open http://localhost:8081. It can run next to the live demo (different port).

**Tests** (about 5 seconds, 280 tests):

```powershell
cd app
npm test
```

**Headless browser run of all four scenarios** (start `npm run dev` first; uses your installed Chrome):

```powershell
cd app
node scripts/scenarios.mjs http://localhost:5173/ C:\path\to\screenshots
```

## What the loyalty part includes

| Feature | Where to see it |
|---|---|
| Rewards member with tier (Member 1×, Silver 1.25×, Gold 1.5×), Rewards Plus badge, points balance and dollar value | Till → Rewards member box; Emily → Members |
| Supplier-funded bonus points (OF-3101) switched on by Emily | Emily → Offers; Till shows the bonus line |
| **Wallet coupons applied at the till** in the right order (store, then manufacturer; Texas tax rule) | Till basket shows "Digital coupon" lines |
| **Emily sends a coupon to a member's wallet** | Emily → Members → Send to wallet |
| **Pay with points** (1,000 points = $5, whole blocks, within balance and total) | Till → Pay with points |
| **Personal 1:1 offers** (e.g. 500 pts when Maria spends $50) visible to marketing | Till chips; Emily → Members → Personalised offers |
| **Live Rewards scorecard**: member share of sales, points issued and redeemed, coupons used, supplier vs retailer funding | Top of Emily's screen |
| **Member points history** with running balance | Emily → Members → Points activity |
| Last member sale summary | Till, under the member box |

All numbers come from the project's data (`seed/`), which comes from the original prototype's loyalty data. Nothing in the loyalty views is typed in by hand: they are calculated from the event log.

### Ideas to propose next (not built)

All of these already exist as data in the platform prototype (`reference/mock/loyalty.json`), so they are realistic next steps for the second client:

- **Tier progress and upgrade nudges** ("spend $X more to reach Gold"), tier review monthly.
- **Points expiry and reminders** (points expire after 12 months without activity; reminders at 60, 30 and 7 days).
- **Household cards** sharing one balance (up to 6 cards).
- **Next-best-offer** per member from churn risk and customer value (the prototype has it per member).
- **Returns and voids reversing points** in proportion to the refund.
- **Fraud monitoring** (velocity, staff-card abuse, abnormal earn/burn, maker-checker for manual adjustments); the prototype has sample alerts.
- **Rewards Plus** (paid tier: 2% back, free delivery) as a modelled benefit rather than only a badge.
- Markdown and waste coupons (C18, C16) are the other unbuilt connections.

## Where things are

```
RUN-THE-DEMO.md      this guide
README.md            overview and reference
app/                 the live demo (Vite + React + TypeScript)
  src/rules/         one file per reaction rule (C1 to C19), engine/ for pricing, points, loyalty views
  src/scenarios/     S1 to S4
  src/ui/            panes, presenter, event stream
seed/                the data (JSON) and CHANGES.md
reference/           the static platform demo (read-only)
docs/                SPEC, DEMO-SCRIPT, THEME, planning
```

Branches on GitHub: **`main-build`** has everything (both demos, tests, tooling). **`flow-demo`** is a trimmed copy with only the runnable live demo.
