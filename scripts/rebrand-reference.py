"""
Apply the SPAR theme (docs/THEME.md) to the original prototype in reference/.

The prototype is a compiled MUI app, so it is re-themed at its four source
points inside the bundle instead of editing hundreds of colours:
  1. the palette object `E`          -> SPAR colours (primary green is a text-safe #017C39: the sampled
                                         #01883F darkened 9% so green text passes AA on every tint; the sidebar keeps #01883F)
  2. the MUI theme                   -> Jost font, heavy headings, pill buttons
  3. the logo component `Ox`         -> the SPAR logo image (reference/brand/logo.png)
  4. a handful of hard-coded chrome colours (sidebar text, hero gradient, warning ink)
plus index.html (title, favicon, font stylesheet, page colours).

Chart category colours (Dairy / Bakery / ...) are left alone: categories need distinct hues.

Not idempotent by design: it asserts that every pattern is found exactly as in
the pristine prototype. To re-run:  git checkout -- reference/assets reference/index.html
then:  python scripts/rebrand-reference.py

Colours match app/src/ui/theme.css (the demo's single theme file).
"""
import os
import re
import shutil
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
REF = os.path.join(ROOT, "reference")
JS = os.path.join(REF, "assets", "index-CCz693TU.js")
HTML = os.path.join(REF, "index.html")
FONTS_SRC = os.path.join(ROOT, "app", "node_modules", "@fontsource", "jost", "files")
FONTS_DST = os.path.join(REF, "brand", "fonts")
WEIGHTS = (400, 500, 600, 700, 800)

js = open(JS, encoding="utf-8").read()
html = open(HTML, encoding="utf-8").read()


def sub(text, old, new, count=1, label=""):
    n = text.count(old)
    if n == 0:
        sys.exit(f"pattern not found ({label or old[:60]}). Is reference/ already rebranded? git checkout -- reference/assets reference/index.html")
    if count and n != count:
        sys.exit(f"expected {count} x {label or old[:60]!r}, found {n}")
    print(f"  {n:3d} x {label or old[:70]}")
    return text.replace(old, new)


print("bundle")
# 1. palette ---------------------------------------------------------------
old_palette = (
    'E={primary:"#1F56D6",primaryDark:"#163FA3",primarySoft:"#E9EFFC",green:"#12805C",greenDark:"#0B6246",'
    'greenSoft:"#E4F4EC",amber:"#F2A541",amberSoft:"#FDF3E3",red:"#D64545",redSoft:"#FBEAEA",blue:"#2F6FDE",'
    'blueSoft:"#E8F0FC",ink:"#131A26",muted:"#5B6678",line:"#E2E7EF",canvas:"#F5F7FA",sidebar:"#0E1E3B",sidebarText:"#C5D0E2"}'
)
new_palette = (
    'E={primary:"#017C39",primaryDark:"#016230",primarySoft:"#E6F4EB",green:"#017C39",greenDark:"#016230",'
    'greenSoft:"#E6F4EB",amber:"#F2A900",amberSoft:"#FFF4D6",red:"#9E1B20",redSoft:"#FBEAEA",blue:"#1B2A4A",'
    'blueSoft:"#E8EBF2",ink:"#000000",muted:"#5B6360",line:"#E3E6E1",canvas:"#F5F6F4",sidebar:"#01883F",sidebarText:"#FFFFFF"}'
)
js = sub(js, old_palette, new_palette, label="palette E (primary/green #017C39 text-safe, sidebar #01883F, amber #F2A900, danger #9E1B20, navy, canvas)")

# 2. theme -----------------------------------------------------------------
js = sub(js, "typography:{fontFamily:'\"Inter\", system-ui, -apple-system, \"Segoe UI\", sans-serif',h4:{fontWeight:700,fontSize:\"1.6rem\"",
         "typography:{fontFamily:'\"Jost\", \"Poppins\", system-ui, -apple-system, \"Segoe UI\", sans-serif',h4:{fontWeight:800,fontSize:\"1.6rem\"",
         label="theme font Inter -> Jost, h4 heavy")
js = sub(js, 'h5:{fontWeight:700,fontSize:"1.25rem"}', 'h5:{fontWeight:800,fontSize:"1.25rem"}', label="h5 heavy")
js = sub(js, "shape:{borderRadius:10}", "shape:{borderRadius:12}", label="shape radius 12")
js = sub(
    js,
    "MuiButton:{defaultProps:{disableElevation:!0}}",
    'MuiButton:{defaultProps:{disableElevation:!0},styleOverrides:{root:{borderRadius:999,paddingLeft:18,paddingRight:18},'
    'outlinedPrimary:{borderWidth:"1.5px",borderColor:E.primary,backgroundColor:"#fff","&:hover":{borderWidth:"1.5px",borderColor:E.primaryDark,backgroundColor:E.primarySoft}}}}',
    label="buttons: pill, solid green primary, outlined green",
)

# 3. logo component: SPAR logo image (white chip when it sits on the green sidebar / hero) -------
m = re.search(r"function Ox\(\{light:e=!1,size:n=30,powered:r=!1\}\)\{.*?\}const Gw=248;", js, re.S)
if not m:
    sys.exit("logo component Ox not found")
new_logo = (
    'function Ox({light:e=!1,size:n=30,powered:r=!1}){return t.jsx("img",{src:"./brand/logo.png",alt:"SPAR",'
    'style:{display:"block",height:n,width:"auto",maxWidth:"none",alignSelf:"flex-start",flexShrink:0,'
    '...(e?{background:"#fff",padding:"6px 10px",borderRadius:10,boxSizing:"content-box"}:{})}})}const Gw=248;'
)
js = js[: m.start()] + new_logo + js[m.end():]
print("    1 x logo component Ox -> <img brand/logo.png> (white chip on green)")

# 4. hard-coded chrome colours --------------------------------------------
js = sub(js, '"#8595B3"', '"#FFFFFF"', count=3, label="sidebar muted text -> white (AA on green)")
js = sub(js, '"#8FA0C2"', '"#FFFFFF"', count=2, label="sidebar icons / hero caption -> white")
js = sub(js, '"#C5D0E2"', '"#FFFFFF"', count=1, label="hero paragraph -> white")
js = sub(js, "#16307A", "#015F2C", count=1, label="login hero gradient mid -> dark green")
js = sub(js, '"rgba(255,255,255,0.09)"', '"rgba(0,0,0,0.2)"', count=1, label="selected sidebar item -> darker green (white text AA)")
js = sub(js, 'bgcolor:"rgba(255,255,255,0.12)",color:"#fff",height:22', 'bgcolor:"rgba(0,0,0,0.22)",color:"#fff",height:22', count=1, label="till header chip -> darker green")
js = sub(js, 'bgcolor:r?E.amber:"rgba(255,255,255,0.1)"', 'bgcolor:r?E.amber:"rgba(0,0,0,0.22)"', count=1, label="till online pill -> darker green")
js = sub(js, '"#9AA7B8"', '"#5B6360"', count=1, label="chart legend grey -> secondary text colour (AA)")
js = sub(js, '"#E4952C"', '"#D99700"', count=2, label="amber button hover -> theme amber-dark")
js = sub(js, "#1B4AA0", "#0F1A33", count=1, label="e-gift gradient end -> deep navy")
js = sub(js, '"#D3E1F8"', '"#D5DAE6"', count=0, label="info-card border -> navy tint")
js = sub(js, '"#B26B00"', '"#7A5400"', count=0, label="warning ink #B26B00 -> #7A5400 (AA)")
js = sub(js, '"#8A5A00"', '"#7A5400"', count=0, label="warning ink #8A5A00 -> #7A5400 (AA)")
open(JS, "w", encoding="utf-8", newline="").write(js)

print("index.html")
html = sub(html, "<title>John Henry Supermarkets (Copy)</title>", "<title>SPAR · Retail platform overview</title>", label="title")
html = sub(html, '<link rel="icon" type="image/svg+xml" href="./favicon.svg" />', '<link rel="icon" type="image/png" href="./brand/favicon.png" />', label="favicon")
html = sub(
    html,
    '<link rel="stylesheet" crossorigin href="./assets/index-HpVaE0Jh.css">',
    '<link rel="stylesheet" href="./brand/fonts.css">\n<link rel="stylesheet" crossorigin href="./assets/index-HpVaE0Jh.css">',
    label="Jost font stylesheet (local)",
)
html = sub(html, "font:14px -apple-system,BlinkMacSystemFont,sans-serif;background:#faf9f5;color:#141413",
           'font:14px "Jost","Poppins",-apple-system,BlinkMacSystemFont,sans-serif;background:#F5F6F4;color:#000', label="page font and colours")
open(HTML, "w", encoding="utf-8", newline="").write(html)

print("fonts")
os.makedirs(FONTS_DST, exist_ok=True)
css = ["/* Jost, bundled locally (no runtime font requests). Same files the demo uses (@fontsource/jost). */"]
for w in WEIGHTS:
    name = f"jost-latin-{w}-normal.woff2"
    shutil.copyfile(os.path.join(FONTS_SRC, name), os.path.join(FONTS_DST, name))
    css.append(f"@font-face{{font-family:'Jost';font-style:normal;font-display:swap;font-weight:{w};src:url('./fonts/{name}') format('woff2')}}")
open(os.path.join(REF, "brand", "fonts.css"), "w", encoding="utf-8", newline="\n").write("\n".join(css) + "\n")
print(f"  {len(WEIGHTS)} weights copied to reference/brand/fonts")
print("done")
