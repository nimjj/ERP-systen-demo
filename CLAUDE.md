# CLAUDE.md — Connected Retail Demo (John Henry Supermarkets)

## What we're building
A front-end-only demo where 4 roles work in one shared, live state. When one person acts, the others' screens update on their own. Data is JSON files. No database, no auth, no real backend.

Roles (only these four):
- **Jamal Carter** — Cashier (till)
- **Aisha Khan** — Store associate (handheld), store US-DFW-1101 Plano
- **Emily Chen** — Loyalty & marketing
- **Priya Raman** — Replenishment planner

Purpose: show a client that the platform connects stores, marketing and replenishment. It must look like production and be reliable on stage. Believable beats complete.

## Read first (in order)
1. `docs/SPEC.md` — the full connection map, events, rules, scenarios, acceptance tests. This is the source of truth.
2. `reference/` — the original compiled prototype (read-only). Its `mock/*.json` files are our seed data. Its JS bundle is minified: do NOT try to edit or reverse it. Use it only to look at how screens look.

## Hard rules
- Never modify anything in `reference/`. Copy data out of it into `seed/`.
- Build a NEW app in `app/` (Vite + React + TypeScript, plain CSS or MUI — pick one and stay consistent). Reproduce the look of the reference (same persona names, store, product names, colours) but keep screens simple.
- One shared state, one event log. Every change is an **event**. Screens never edit each other's data; they emit events, and **reaction rules** (pure functions) produce follow-on events and state changes.
- Reaction rules are pure: `(state, event) => { state, newEvents }`. No timers, no randomness inside rules. Unit-test every rule.
- Every event carries `id`, `ts`, `actor`, `type`, `payload`, and `causedBy` (id of the event that triggered it, or null). The event stream UI shows these chains.
- Cross-tab sync: use `BroadcastChannel` (with localStorage fallback) so the 4 roles can be open in 4 browser windows and update live. Also provide a single-window "split view" showing all 4 panes.
- Persistence is `localStorage` plus a "Reset demo" button that reloads seed. A `?scenario=` URL param auto-loads a scripted starting state.
- Optional: a tiny Node SSE server adapter behind the same `EventStore` interface. Build it only after everything else works. Do not make the demo depend on it.
- All demo-only numbers live in `app/src/config/demoTuning.ts`, labelled. Do not hide tuning in rule code.
- Plain language in the UI. Money in USD. Texas store, tax 8.25%.

## Do not
- Do not add a database, ORM, login, or real API.
- Do not add roles beyond the four.
- Do not invent product names, IDs or numbers: take them from `seed/` (originating from `reference/mock/*.json`). If you need a number not in the data, put it in `demoTuning.ts` and say so.
- Do not build "nice to have" screens before the P0 connections in SPEC §3 pass their tests.

## Working style
- Plan before coding on any new milestone; list files you'll touch.
- After each milestone: run `npm test` and `npm run build`, report what passes, then stop and wait.
- Keep commits small, one milestone per commit.
- If SPEC and the data disagree, say so and ask. Don't silently pick.

## Definition of done (whole project)
All acceptance assertions in SPEC §8 pass (`npm test`), the three scripted scenarios in SPEC §7 run end-to-end from the Presenter panel, and `npm run build` produces a static site that works when served by any static server.
