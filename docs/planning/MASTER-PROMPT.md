# MASTER PROMPT — one paste, full build

## Setup
Same folder layout as PROMPTS.md (CLAUDE.md, docs/SPEC.md, reference/ with the extracted artifact).
Open a terminal in `connected-demo\`, run `claude`, press Shift+Tab to "auto-accept edits" so it doesn't stop on every file write, then paste the block below.

## Paste this

```
You are building the project described in CLAUDE.md and docs/SPEC.md, end to end,
without waiting for me between milestones.

Process:
1. Read CLAUDE.md and docs/SPEC.md fully. Study reference/mock/*.json (read-only).
2. Create PROGRESS.md. It is your memory: the milestone checklist (SPEC section 12),
   decisions you made, data fixes applied, open issues. Update it after every
   milestone. If your context is ever compacted, re-read PROGRESS.md, CLAUDE.md
   and SPEC.md before continuing.
3. Execute M0 to M6 in order. For each milestone:
   a. Plan briefly (files you will touch).
   b. Implement.
   c. Run npm test and npm run build. Fix failures before moving on.
   d. Commit with the message "M<n>: <summary>".
   e. Tick it in PROGRESS.md.
4. Do not stop between milestones. Stop ONLY if:
   - SPEC and the real data conflict in a way SPEC section 10 does not cover, or
   - a decision would change what the client sees and SPEC does not decide it, or
   - you have failed to fix the same problem 3 times.
   When you stop, state the exact question and your recommended answer.
5. Calibration gate: test A0 (engine reproduces seed proposedQty) must pass
   before you build any reaction rule. If it can't, stop and report.
6. After M4, run S1 and S2 in headless Playwright, save a screenshot per step in
   docs/screens/, and look at them yourself. Fix anything that looks wrong or fake.
   Repeat for S3 after M5.
7. Final step: run the full test suite, build, then write a REVIEW section in
   PROGRESS.md: every SPEC section 8 assertion with pass/fail, anything not
   working, anything that looks inconsistent on screen. Then tell me the
   command to start the demo and how to run it.

Constraints are in CLAUDE.md (never touch reference/, no database, four roles
only, pure rules, all demo numbers in demoTuning.ts). Begin.
```

## If it stops or drifts
- It stopped with a question: answer in one line, then say `Continue from PROGRESS.md.`
- It lost track after a long run: `Re-read PROGRESS.md, CLAUDE.md and SPEC.md, then continue from the first unticked milestone.`
- It's done but something looks off: use the fix lines at the bottom of PROMPTS.md.
