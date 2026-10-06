# PROMPTS — paste these into Claude Code, one at a time

## Setup (once)

Folder layout on your PC (inside `D:\Projects (Tests)\ERP system\`):

```
connected-demo\
  CLAUDE.md
  docs\SPEC.md
  docs\PROMPTS.md
  reference\          <- copy of john-henry-supermarkets (the extracted artifact)
```

1. Copy the `john-henry-supermarkets` folder into `connected-demo\reference\`.
2. Open a terminal in `connected-demo\` and run `claude`.
3. Tip: press Shift+Tab until it says plan mode for Prompt 1. Switch back to normal for the rest.

Rule: after each prompt, read what it says, run `npm test`, look at the app, then paste the next prompt. If a step goes wrong, don't stack the next one on top. Tell Claude what's wrong first.

---

## Prompt 1 — Study (no code)

```
Read CLAUDE.md and docs/SPEC.md fully. Then study reference/mock/*.json
(read-only). Do NOT write any code yet.

Report back, briefly:
1. The exact field names you will use for: proposals, positions, tasks,
   pos rules/members/scanScript, offers, promos, claims, recalls.
2. Anything in SPEC.md that does not match the real data (missing fields,
   different names, Plano lacking SKU-100228, etc.).
3. Whether the order-up-to formula in SPEC 5.1 can reproduce proposedQty for
   AUTO_RELEASED lines. Check it with a quick script and tell me the match rate.
4. The folder layout you propose for app/ and seed/.
5. Questions for me. Max 5, only if blocking.
```

## Prompt 2 — Foundation (M1)

```
Go ahead with M1 from docs/SPEC.md section 12, using your proposed layout.
Extract the Plano slice into seed/ and apply the fixes in SPEC section 10,
logging each in seed/CHANGES.md. Build the AppState types, the EventStore
(append, subscribe, replay, reset), and BroadcastChannel sync.
Write tests A13, A14, A15. Run npm test and npm run build. Stop and report.
```

## Prompt 3 — Engine and P0 rules (M2)

```
Do M2. First build the order-up-to engine and make test A0 pass against seed.
Then implement reaction rules C1 to C9 as pure functions, one file each, with
tests A0 to A8 from SPEC section 8. Put every demo number in
app/src/config/demoTuning.ts. Show me a table of test names and pass/fail.
Do not build UI yet.
```

## Prompt 4 — The four panes (M3)

```
Do M3. Build the four role panes (Jamal till, Aisha handheld, Emily marketing,
Priya planner), the notification inbox, the event stream drawer with causality
chips, and the split view, as described in SPEC section 11. Reproduce the look
of the reference app (open reference/index.html via a static server to see it).
Keep each screen simple. Every action must emit an event, never edit another
role's data. Start the dev server and tell me the URL.
```

## Prompt 5 — Presenter and S1/S2 (M4)

```
Do M4. Add the Presenter panel and scripted scenarios S1 and S2 from SPEC
section 7. Each step must work both by me clicking in the pane and by the Next
button, with identical events. Add the Simulate sales and Short-ship controls.
Then run S1 and S2 in a headless browser (Playwright) and give me screenshots
of each step.
```

## Prompt 6 — P1 and recall (M5)

```
Do M5: connections C10 to C15 and scenario S3 (recall). Add tests A9 to A11.
Make sure all four panes visibly change when the recall is issued.
Re-run the complete test suite and report.
```

## Prompt 7 — Polish (M6)

```
Do M6. Add change-highlights, empty states, and clean copy. Write README.md
with run instructions and a 5-minute demo script that follows S1, S2, S3
(what to click, what the audience should notice). Then do a final review:
list anything in the SPEC that is not working and anything that looks fake
or inconsistent on screen.
```

---

## When things go wrong (copy-paste fixes)

- It started coding in Prompt 1: `Stop. Revert any code. This step is read-only.`
- It edited `reference/`: `Revert changes to reference/. It is read-only; copy data into seed/.`
- Numbers look off: `Show me the demoTuning values and the engine inputs for <item>. Don't change anything yet.`
- A screen isn't updating: `Show me the event log for that action and which rule should have fired. Add a failing test first, then fix.`
- It added things you didn't ask for: `Remove X. Keep to SPEC section 3 P0 until all its tests pass.`
- Context getting long: `Summarise what's done and what's left against SPEC section 12 in 10 lines, then continue.`

## Before showing the client

- Run `npm run build`, serve `dist/` with any static server, open 2 windows side by side, run S1.
- Do one full dry run with Reset in between.
- Keep the recall (S3) as the closer.
