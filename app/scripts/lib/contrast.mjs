/**
 * Shared WCAG contrast checker. `auditInPage` runs inside the browser page
 * (pass it to page.evaluate): for every visible piece of text it computes the
 * contrast against the real background (layers composited, opacity applied),
 * and flags text below AA (4.5:1; 3:1 for large text: >= 24px, or >= 18.66px bold).
 * Disabled controls are exempt (WCAG 1.4.3 "inactive components").
 */

/** Runs inside the page: returns every text element's contrast result. */
export function auditInPage() {
  const parse = (c) => {
    let m = c.match(/rgba?\(([^)]+)\)/)
    if (m) {
      const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number)
      return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] }
    }
    m = c.match(/color\(srgb ([^)]+)\)/)
    if (m) {
      const p = m[1].split(/[ \/]+/).filter(Boolean).map(Number)
      return { r: p[0] * 255, g: p[1] * 255, b: p[2] * 255, a: p[3] === undefined ? 1 : p[3] }
    }
    return { r: 255, g: 255, b: 255, a: 0 }
  }
  const over = (top, bottom) => {
    const a = top.a + bottom.a * (1 - top.a)
    if (a === 0) return { r: 255, g: 255, b: 255, a: 0 }
    const mix = (t, b) => (t * top.a + b * bottom.a * (1 - top.a)) / a
    return { r: mix(top.r, bottom.r), g: mix(top.g, bottom.g), b: mix(top.b, bottom.b), a }
  }
  const lum = ({ r, g, b }) => {
    const f = (v) => {
      v /= 255
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
  }
  const hex = ({ r, g, b }) => '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')

  const out = []
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  const seen = new Set()
  while (walker.nextNode()) {
    const node = walker.currentNode
    if (!node.textContent.trim()) continue
    const el = node.parentElement
    if (!el || seen.has(el) || el.closest('script,style,option')) continue
    seen.add(el)
    const rect = el.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) continue
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.fontSize) === 0) continue
    if (el.closest(':disabled')) continue
    let op = 1
    for (let e = el; e; e = e.parentElement) op *= parseFloat(getComputedStyle(e).opacity)
    if (op < 0.05) continue // fully transparent (e.g. the invisible notch label inside an outlined input)

    // effective background and cumulative opacity
    let bg = { r: 255, g: 255, b: 255, a: 0 }
    let opacity = 1
    for (let e = el; e; e = e.parentElement) {
      const s = getComputedStyle(e)
      opacity *= parseFloat(s.opacity)
      bg = over(bg, { ...parse(s.backgroundColor), a: parse(s.backgroundColor).a })
      // composite from the element outward: bg currently holds layers above; keep going until opaque
      if (bg.a >= 0.999) break
    }
    // the loop above composites child over parent in the right order only if we accumulate top-down; redo explicitly
    const layers = []
    for (let e = el; e; e = e.parentElement) layers.push(parse(getComputedStyle(e).backgroundColor))
    let eff = { r: 255, g: 255, b: 255, a: 1 }
    for (let i = layers.length - 1; i >= 0; i--) eff = over(layers[i], eff)

    let fg = parse(cs.color)
    fg = over({ ...fg, a: fg.a * opacity }, eff)
    // A gradient behind the text: use every colour stop and keep the worst case.
    let backgrounds = [eff]
    for (let e = el; e; e = e.parentElement) {
      const img = getComputedStyle(e).backgroundImage
      if (img && img.includes('gradient')) {
        const stops = [...img.matchAll(/rgba?\([^)]+\)/g)].map((m) => parse(m[0]))
        if (stops.length) backgrounds = stops.map((s) => over(s, { r: 255, g: 255, b: 255, a: 1 }))
        break
      }
    }
    const ratioOn = (b) => (Math.max(lum(fg), lum(b)) + 0.05) / (Math.min(lum(fg), lum(b)) + 0.05)
    const worst = backgrounds.reduce((w, b) => (ratioOn(b) < ratioOn(w) ? b : w), backgrounds[0])
    const ratio = ratioOn(worst)
    const size = parseFloat(cs.fontSize)
    const bold = parseInt(cs.fontWeight, 10) >= 700
    const large = size >= 24 || (size >= 18.66 && bold)
    const need = large ? 3 : 4.5
    out.push({
      text: node.textContent.trim().slice(0, 48),
      cls: (el.className && el.className.toString().slice(0, 40)) || el.tagName.toLowerCase(),
      ratio: Math.round(ratio * 100) / 100,
      need,
      size: Math.round(size * 10) / 10,
      fg: hex(fg),
      bg: hex(worst),
      pass: ratio >= need - 0.005,
    })
  }
  return out
}
