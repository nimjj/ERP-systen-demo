# THEME — client rebrand (SPAR, Sri Lanka retail)

Source: client brief, saved verbatim. Sampled-colour notes are added at the end once the reference screenshot has been measured.

## Mood

Bright, clean, friendly neighbourhood grocer. White surfaces, strong red and green accents, big confident type. Not corporate-grey, not dark mode.

## Colours (estimates, confirm by sampling)

- Brand red: ~#EE3340 (announcement bar), deeper ~#E31E24 (banner bands)
- Brand green: ~#1B9A47 (large shapes, outlined buttons)
- Navy: ~#1B2A4A (badge and strong text)
- Background white #FFFFFF, soft surface #F5F6F4, borders #E3E6E1
- Text: near-black #1A1A1A, secondary #5B6360
- Warning amber: ~#F2A900
- Danger / recall: a darker red ~#9E1B20 with a clear icon and label, so it reads differently from the brand red used for decoration

## Layout cues from the site

- Top announcement strip in brand red, white text, letter-spaced, centred. Use it for the Story caption bar.
- White header with the logo at left and navigation beside it.
- Outlined pill buttons: white fill, green 1.5px border, green text, fully rounded. Primary actions (Publish, Approve, Complete sale) are solid green with white text.
- Bold red bands with heavy white type for emphasis (use for the Presenter step header and key results).
- Generous white space, rounded corners (8 to 12px on cards, pill on buttons), soft shadows.

## Typography

Friendly geometric sans. Use Jost (or Poppins as a fallback) for UI text and a heavy weight for headings and bands. Bundle the font locally with @fontsource so the demo works offline. No web font fetching at runtime.

## Role colours

Must stay distinguishable from each other: Jamal red, Aisha green, Emily navy, Priya amber. Use them only for the role chip, pane border and highlight ring.

## Rules

1. All colours and fonts live in one CSS variables file. No hard-coded colours elsewhere.
2. Logo in the top bar, replacing the current wordmark, and as the favicon.
3. Check text contrast (WCAG AA) everywhere, including white on red, the recall banner and the stock-risk warning.
4. Do not change behaviour, rules or tests.
5. Screenshot S1, S2 and S3 in split view at each step, look at them, and fix anything that looks off, cramped or low-contrast.

---

# Implementation notes (added when the theme was applied)

Applied to both applications: the connected demo (`app/`) and the original prototype (`reference/`).

## Sampled colours

Measured from `docs/brand/reference-site.png` (the client site) and `docs/brand/logo.png` (exact pixel modes, not eyeballed). Where they differ from the estimates above, the sampled value is used, as asked.

| Role | Estimate | Sampled | Used | Note |
|---|---|---|---|---|
| Announcement strip red | #EE3340 | **#EE343F** | `--red-aa` **#DF303B** for the strip and Jamal's chip | the sampled red darkened 6%: white small text on #EE343F is only 4.04:1, AA needs 4.5. #DF303B gives 4.54 |
| Banner band red | #E31E24 | **#EE1B24** | `--red-band` #EE1B24 | brighter than estimated. Used only for heavy large type (20px/800), where AA needs 3:1 (it gives 4.36) |
| Brand green | #1B9A47 | **#01883F** (outline button border #10A437; logo emblem #008534) | `--green` #01883F | darker and more saturated than estimated. White on it is 4.57 |
| Navy | #1B2A4A | #070E29 | `--navy` **#1B2A4A** (estimate kept) | the only navy in the screenshot is a shaded, embossed badge, not a flat colour, so the sample is unreliable |
| Text | #1A1A1A | **#000000** | `--text` #000000 | the site's text is pure black |
| Secondary text | #5B6360 | not measurable | `--text-2` #5B6360 | 6.18:1 on white |
| Amber | #F2A900 | not in the screenshot | `--amber` #F2A900 | always with dark text (white on it is 2.0:1) |
| Danger / recall | #9E1B20 | n/a | `--danger` #9E1B20 | white on it 7.98:1; always with a ⚠ icon and a label |
| Logo red | n/a | #F10F29 | (image) | |

Not in the brief but needed: `--green-dark` #016B31 (hover, and green text on soft tints, where #01883F is only 4.0–4.4), `--amber-ink` #7A5400 (amber-family text on light backgrounds), `--border-input` #8B928E (input borders, 3.2:1 as WCAG 1.4.11 requires).

## Where things live

- **Demo:** `app/src/ui/theme.css` is the only file with colours, fonts, radii and shadows. `styles.css` and every component use `var(--…)` only. `app/tests/theme.test.ts` fails the build if a colour literal or a font-host URL appears anywhere else.
- **Font:** Jost 400 to 800, bundled with `@fontsource/jost` (demo) and copied to `reference/brand/fonts` (original). No runtime font requests. Poppins is the CSS fallback name only.
- **Logo and favicon:** `app/public/brand/logo.png` (cropped from the client file in `UI/`, transparent) and `favicon.png` (the green emblem). The same two files are in `reference/brand/`.
- **Original prototype:** it is a compiled MUI app, so it is re-themed at its four source points inside the bundle (palette, theme, logo component, a few hard-coded chrome colours) by `scripts/rebrand-reference.py`. Re-run from the pristine files with `git checkout -- reference/assets reference/index.html` then `python scripts/rebrand-reference.py`. Its primary green is **#017C39** (the sampled green darkened 9%) because that app uses one green for both fills and text, and green text must pass AA on every tint. Its sidebar and header keep the sampled #01883F. Chart category colours (Dairy, Bakery, …) are unchanged, since categories need distinct hues.

## Layout, as applied

- Demo: red announcement strip (the story caption: current scenario step, or SPAR's own tagline when no scenario runs), white header with the logo and navigation, outlined green pill buttons (`Key item`, `Reset demo`), solid green primary actions, a red heavy-type band for the Presenter's current step and the timeline title, role-coloured pane borders and highlight rings (Jamal red, Aisha green, Emily navy, Priya amber).
- Original: green sidebar and header with the SPAR logo on a white chip, pill buttons, heavy headings. It has no announcement strip (no story caption to show).

## Contrast (rule 3)

`app/scripts/contrast-audit.mjs` plays S1, S2 and S3 in headless Chrome and, after every step and with the inbox, event stream and timeline open, checks every visible text against its real background (layers composited, opacity applied, gradients at their worst stop; disabled controls exempt). `app/scripts/reference-check.mjs` does the same for the original, signing in as each persona.

Result: demo 8,869 texts, original 667 texts, **0 below AA**. The audit found and led to fixing: white on the sampled strip red (4.04), faded rows in the event stream (opacity 0.4, about 2:1), green on soft tints (4.0 to 4.4), the selected sidebar item and header chips in the original (3.8 to 3.95), a faint chart legend (2.4), and avatar letters (4.22).

## Not changed (outside "UI theme and logo")

Data and wording are untouched: store and persona names, "John Henry" in some text (the customer notice says "any John Henry store", the till shows "John Henry Plano Market"), Plano, Texas, USD and 8.25% tax. A real SPAR Sri Lanka demo would also change those (Colombo store, LKR, local tax and product names); that is a content change, not a theme change.
