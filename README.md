# John Henry Supermarkets — Connected Retail Demo

A front-end-only demo where four people work in one shared, live state. When one of them acts, the others' screens update on their own:

| Persona | Role | Screen |
|---|---|---|
| Jamal Carter | Cashier | Till: scans, Rewards, promotions, tender |
| Aisha Khan | Store associate, Plano Market | Handheld: receive, count, gap scan, recall pulls |
| Emily Chen | Loyalty & marketing | Offers, campaigns, promotions with a stock-check gate, recall notices |
| Priya Raman | Replenishment planner | Order proposals with exceptions, approvals, supplier claims |

No database, no login, no backend: data is JSON (`seed/`), state lives in the browser, and open windows stay in sync.

> **This is the `flow-demo` branch: the runnable flow demo only.** The test suite, the seed-extraction and rebrand scripts, and the platform demo (the original ~40-screen prototype in `reference/`) are on the default branch, `main-build`.

## Requirements

- Node.js 22.6 or newer (tested on Node 24)
- Any modern browser (Chrome, Edge, Firefox, Safari)

## Install and start

```bash
cd app
npm install
npm run dev
```

Open the URL Vite prints (normally http://localhost:5173). Split view shows all four roles at once.

- **Four windows instead of one:** open the same URL four times and add `?role=jamal`, `?role=aisha`, `?role=emily` or `?role=priya`. Every action in one window appears in the others within a second (BroadcastChannel, with a localStorage fallback).
- **Presenter panel:** the **Presenter** button (top right) opens the scenario controls.

## Start a scenario

Either pick it in the Presenter panel, or open the app with a URL parameter, which resets the demo and opens the Presenter on step 1:

| URL | Scenario | Length |
|---|---|---|
| `?scenario=S1` | From offer to shelf | ~4 min |
| `?scenario=S2` | Promo gate | ~2 min |
| `?scenario=S3` | Recall hits everyone | ~2 min |

For each step the Presenter shows who acts, what to click, and what the audience should watch. Do the step by clicking in the pane, or press **Next** to do it for you: both produce exactly the same events. **Back** undoes the last step in every open window. S1 and S3 end with the whole chain of events as one timeline.

Controls in the Presenter: **Simulate 10 sales** (ten yogurt sales at the till), **Issue recall RCL-2026-014**, and **Short-ship deliveries** (deliveries ordered during the demo arrive 4 units short; untick for full deliveries).

See `docs/DEMO-SCRIPT.md` for a 6-minute client script.

## Reset

- **Reset demo** (top bar), or **Reset** in the Presenter, returns every open window to the seed state.
- Opening a `?scenario=` URL also resets.
- The event log is kept in the browser's localStorage, so a refresh keeps your place. Clearing site data is a hard reset.

## Build and serve the static site

```bash
cd app
npm run build
```

`app/dist/` is a static site with relative paths: serve it from any static server, at any path. For example:

```bash
cd app/dist
python -m http.server 8080
# or: npx serve .
```

then open http://localhost:8080 (opening `index.html` from the file system will not work; browsers block module scripts from `file://`).

## Checks

The unit and acceptance tests (250, covering every assertion in `docs/SPEC.md` §8) are on `main-build`; this branch has none, so `npm test` finds nothing to run.

Headless browser checks (use the locally installed Chrome; start the app first; run from `app/`):

```bash
node scripts/scenarios.mjs http://localhost:5173/ <screenshot-folder>   # S1–S3, both ways, screenshot per step
node scripts/flow.mjs      http://localhost:5173/ <screenshot-folder>   # two-window S1 click-through
```

## Theme

The UI follows the client's SPAR theme: `docs/THEME.md` (brief, sampled colours, contrast results). All colours and the Jost font live in `app/src/ui/theme.css`; change them there.

## Seed data

`seed/` was generated from the original prototype's data (`reference/mock/`, by `scripts/extract-seed.ts`; both on `main-build`, so `npm run seed` does not work on this branch). Every place the seed differs from the source data, and why, is listed in `seed/CHANGES.md`. Every demo-only number lives in `app/src/config/demoTuning.ts`, labelled.

## Layout

```
CLAUDE.md            working rules for this repo
docs/SPEC.md         source of truth: connections, events, rules, scenarios, acceptance tests (§13: decisions)
docs/DEMO-SCRIPT.md  6-minute client script
docs/THEME.md        SPAR theme brief; docs/brand/ (logo, client site)
PROGRESS.md          milestones, decisions, and the final review
seed/                Plano slice of the data + CHANGES.md
app/                 Vite + React + TypeScript app
  scripts/           headless browser checks (scenarios, flow, shot)
  src/config/        demoTuning.ts
  src/domain/        AppState and event types
  src/rules/         one file per reaction rule; engine/ (order-up-to, exceptions, points, till pricing, …)
  src/store/         event store, reducers, cross-tab sync, persistence
  src/scenarios/     S1–S3
  src/actions.ts     one builder per user action (used by panes and the Presenter)
  src/ui/            shell, panes, event stream, presenter
```
