# Demo script — 6 minutes

**Setup before the client joins.** Run the app, open it in one wide browser window in **Split view** and open the **Presenter** panel. Short-ship is ticked. Open the event stream (bottom bar) once to check it is empty, then close it. Load each scenario from the Presenter's scenario picker when you reach it; picking a scenario does not reset, so press **Reset** in the Presenter before S1.

Timing: intro 0:30 · S1 2:30 · S2 1:15 · S3 1:15 · close 0:30.

Every step can be done by clicking in the pane (more convincing) or with **Next** (safer if you are short on time). Both produce the same events.

---

## Intro (0:30)

**Say:**
"This is one store, Plano Market in Texas, seen by four people at once. Top left is Jamal on the till. Top right, Aisha on the store handheld. Bottom left, Emily, who runs loyalty and marketing. Bottom right, Priya, who plans the orders. They are not looking at four systems that sync overnight. They are looking at one set of facts. When one of them acts, watch the others."

**Point at:** each pane as you name the person. Then the bell icons: "Each of them has an inbox; messages land there when something affects their work."

---

## S1 — From offer to shelf (2:30)

Presenter → **S1 · From offer to shelf** → Reset.

**1. Emily publishes the offer.**
- **Say:** "Emily launches a supplier-funded offer: 200 bonus points on Greek yogurt, paid for by Prairie Gold Dairy."
- **Click:** Emily pane → **Publish to Plano Market**.
- **Notice:** Jamal's till immediately shows "+200 pts Greek yogurt". Priya's yogurt order jumps from 6 to 12 and turns to "Review" with a Promo tag: the planner knows demand is about to rise before a single unit sells.

**2. Jamal sells a yogurt to a Gold member.**
- **Say:** "Maria, a Gold member, buys a yogurt."
- **Click:** Till → Rewards member **Maria Delgado** → **Key item** (Plain Greek Yogurt) → **Complete sale**.
- **Notice:** the till showed the bonus line before payment. Emily's offer card ticks up live: redeemed 1, $5.98 incremental sales, $1.00 supplier-funded. Priya and Aisha see one fewer on hand.

**3. Ten more sales.**
- **Click:** Presenter → **Simulate 10 sales**.
- **Notice:** the order rises to 24. Emily gets a stock-risk warning: "0.46 days of cover, consider pausing the offer". Aisha's gap scan picks up the empty shelf. Nobody phoned anybody.

**4. Aisha refills the shelf.**
- **Click:** Handheld → **Morning gap scan** → **Refill 6** on Plain Greek Yogurt.
- **Notice:** shelf up, back room down. On hand, the till and the order don't move: moving stock is not selling it.

**5. Priya approves the bigger order.**
- **Click:** Planner → yogurt row → **Approve 24**.
- **Notice:** Aisha instantly gets "Receive delivery: 4 cases (24 units)". The next yogurt order drops to 0 because the stock is now on its way.

**6. The delivery arrives short.**
- **Click:** Handheld → **Receive delivery: Plain Greek Yogurt** → (pre-filled 20 of 24) → **Confirm receipt**.
- **Notice:** Priya gets claim CLM-5223 for $16.68 with the supplier, without filling in a form. The yogurt order re-opens by one case and is flagged "Supplier". Emily's stock warning clears because cover is back.

**End card:** the timeline opens by itself. **Say:** "Six actions by four people, 55 events, and every one of them points back to the action that caused it."

**What it proves:** marketing, the till, the store and replenishment run on one live model, so a promotion's effect on demand, loyalty cost and supplier funding is visible the moment it happens, not in tomorrow's report.

---

## S2 — Promo gate (1:15)

Presenter → **S2 · Promo gate**.

**1. Emily checks the Thanksgiving promotion.**
- **Say:** "Emily wants to run a Thanksgiving butter-and-eggs promotion. Before it can go live, the platform checks whether supply can cover it."
- **Click:** Emily pane → Promotions → PRM-2720 → **Stock check**.
- **Notice:** **Fail, 68%**. Publish is disabled. Priya is told why: the supplier capped the seasonal allocation.

**2. And the Halloween cola.**
- **Click:** PRM-2702 → **Stock check**.
- **Notice:** **Warn, 84%**: three stores lack day-one stock.

**3. Priya adds supply.**
- **Click:** Planner → Cola 12 pk row → **Approve 160** (the order that pre-builds stock for the promotion).
- **Notice:** Emily's badge flips **Warn → Pass** on its own. Aisha gets the delivery to receive. The cola order doesn't double up next time.

**4. Emily publishes.**
- **Click:** PRM-2702 → **Publish**.
- **Notice:** Published. The Thanksgiving promotion is still blocked: you cannot launch a promotion the supply chain can't deliver.

**What it proves:** marketing and replenishment share one gate, so promises to customers are checked against real supply before they are made.

---

## S3 — Recall hits everyone (1:15)

Presenter → **S3 · Recall hits everyone**.

**1. A recall notice arrives.**
- **Say:** "Prairie Gold Dairy and the FDA recall a shredded cheddar: plastic fragments, three lots."
- **Click:** Presenter → **Issue recall RCL-2026-014**.
- **Notice:** all four screens change at once. The till blocks cheddar. Aisha gets one pull task per lot. Priya's 84-unit cheddar delivery is held. Emily sees the cheddar removed from her live promotion and a customer notice already drafted, with the real numbers: 1,284 buyers, reachable by push, email and SMS.

**2. Jamal tries to sell one anyway.**
- **Click:** Till → item **Shredded Mild Cheddar 8 oz** → **Key item**.
- **Notice:** "RECALLED — do not sell". The refused scan is counted on the recall.

**3. Aisha pulls the stock.**
- **Click:** Handheld → each **Pull … lot** task → **Confirm pulled** (three times).
- **Notice:** cheddar on hand goes 31 → 0. Priya's recall card fills up: 31 of 31 pulled, $65.41 written off against the supplier credit, Plano confirmed.

**4. Emily sends the notice.**
- **Click:** Emily pane → **Send notice to 1,284 buyers**.
- **Notice:** status Sent. The timeline opens: one external notice, 23 events, every role involved.

**What it proves:** a food-safety event reaches the till, the shelf, the supply chain and the customer in one step, with an audit trail, instead of four teams working from four emails.

---

## Close (0:30)

**Say:**
"Three stories, one idea. A promotion changed demand and the order before the shelf ran out. A promotion that supply couldn't cover was stopped before customers saw it. A recall reached the till, the shelf, the supplier and every affected customer in one move. Four people, one live set of facts, and every change explains itself: open the event stream and you can trace any number on any screen back to the person, or the notice, that caused it."

**Then:** Reset demo, and offer to let the client drive.

---

### If something goes wrong

- **A step doesn't advance:** press **Next**; it does the same thing the click would.
- **Clicked the wrong thing:** press **Back**; it undoes the last step everywhere.
- **Anything else:** **Reset** in the Presenter and pick the scenario again.
