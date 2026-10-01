/**
 * Theme rules (docs/THEME.md): every colour and font lives in src/ui/theme.css;
 * nothing else hard-codes a colour; the font is bundled, never fetched.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = join(__dirname, '..', 'src')
const THEME = join(SRC, 'ui', 'theme.css')

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
}
const files = walk(SRC).filter((f) => /\.(css|tsx?|html)$/.test(f))
const COLOUR = /#[0-9a-fA-F]{3,8}\b|\brgba?\s*\(|\bhsla?\s*\(/

describe('theme: one variables file', () => {
  it('no colour literal outside theme.css (strings and comments included)', () => {
    const offenders = files
      .filter((f) => f !== THEME)
      .flatMap((f) =>
        readFileSync(f, 'utf8')
          .split('\n')
          .map((line, i) => ({ f: relative(SRC, f), n: i + 1, line }))
          .filter(({ line }) => COLOUR.test(line)),
      )
      .map(({ f, n, line }) => `${f}:${n}  ${line.trim().slice(0, 90)}`)
    expect(offenders).toEqual([])
  })

  it('no font-family outside theme.css except through var(--font)', () => {
    const offenders = files
      .filter((f) => f !== THEME && f.endsWith('.css'))
      .flatMap((f) => readFileSync(f, 'utf8').split('\n').map((line, i) => ({ f: relative(SRC, f), n: i + 1, line })))
      .filter(({ line }) => /font-family\s*:/.test(line) && !/var\(--font\)/.test(line))
      .map(({ f, n, line }) => `${f}:${n}  ${line.trim()}`)
    expect(offenders).toEqual([])
  })

  it('Jost is bundled locally and nothing is fetched from a font host', () => {
    const theme = readFileSync(THEME, 'utf8')
    expect(theme).toMatch(/@import '@fontsource\/jost\/latin-800\.css'/)
    expect(theme).toMatch(/--font:\s*'Jost'/)
    for (const f of files) expect(readFileSync(f, 'utf8'), relative(SRC, f)).not.toMatch(/fonts\.(googleapis|gstatic)\.com|https?:\/\/[^'")\s]*\.(woff2?|ttf)/)
    expect(readFileSync(join(SRC, '..', 'index.html'), 'utf8')).not.toMatch(/fonts\.(googleapis|gstatic)\.com/)
  })

  it('the four role colours are defined and distinct', () => {
    const theme = readFileSync(THEME, 'utf8')
    for (const role of ['jamal', 'aisha', 'emily', 'priya']) expect(theme).toMatch(new RegExp(`--role-${role}:`))
    expect(theme).toMatch(/--role-jamal:\s*var\(--red-aa\)/)
    expect(theme).toMatch(/--role-aisha:\s*var\(--green\)/)
    expect(theme).toMatch(/--role-emily:\s*var\(--navy\)/)
    expect(theme).toMatch(/--role-priya:\s*var\(--amber\)/)
  })

  it('logo and favicon ship with the app', () => {
    const pub = join(SRC, '..', 'public', 'brand')
    for (const f of ['logo.png', 'favicon.png']) expect(statSync(join(pub, f)).size).toBeGreaterThan(1000)
    expect(readFileSync(join(SRC, '..', 'index.html'), 'utf8')).toContain('brand/favicon.png')
  })
})
