/**
 * Looks at the original prototype (reference/) in headless Chrome without a
 * server: requests to a fake origin are answered straight from the folder.
 * Signs in as each persona, screenshots the screen and audits text contrast.
 *
 *   node scripts/reference-check.mjs <screenshot-folder>
 */
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { auditInPage } from './lib/contrast.mjs'

const out = process.argv[2] ?? '.'
const REF = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', 'reference')
const ORIGIN = 'http://reference.test'
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff' }

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const errors = []
const failed = []

async function open() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await context.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url())
    const rel = normalize(decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)).replace(/^[\\/]+/, '')
    try {
      const body = await readFile(join(REF, rel))
      await route.fulfill({ status: 200, body, contentType: TYPES[extname(rel)] ?? 'application/octet-stream' })
    } catch {
      failed.push(rel)
      await route.fulfill({ status: 404, body: 'not found' })
    }
  })
  const page = await context.newPage()
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(`${ORIGIN}/`, { waitUntil: 'networkidle' })
  return { context, page }
}

const failures = new Map()
let total = 0
async function check(page, name) {
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${out}/ref-${name}.png` })
  const rows = await page.evaluate(auditInPage)
  total += rows.length
  const bad = rows.filter((r) => !r.pass)
  for (const r of bad) {
    const key = `${r.fg} on ${r.bg} | ${r.size}px | ${r.ratio} < ${r.need} | "${r.text}"`
    if (!failures.has(key)) failures.set(key, name)
  }
  console.log(`${name.padEnd(20)} ${String(rows.length).padStart(4)} texts, ${bad.length} below AA`)
}

// sign-in screen (logo on the green hero, persona cards)
{
  const { context, page } = await open()
  await check(page, '1-sign-in')
  const logo = await page.evaluate(() => [...document.images].map((i) => ({ src: i.getAttribute('src'), w: i.naturalWidth, ok: i.complete && i.naturalWidth > 0 })))
  console.log('images on sign-in:', JSON.stringify(logo))
  const font = await page.evaluate(() => getComputedStyle(document.querySelector('h1,h2,h3,h4,h5,h6,p')).fontFamily)
  console.log('heading font:', font)
  console.log('Jost loaded:', await page.evaluate(() => document.fonts.check('800 20px Jost')))
  await context.close()
}

const personas = [
  ['Priya Raman', '2-priya-planner'],
  ['Emily Chen', '3-emily-marketing'],
  ['Aisha Khan', '4-aisha-handheld'],
  ['Daniel Okafor', '5-daniel-executive'],
  ['Angela Brooks', '6-angela-store-manager'],
]
for (const [who, name] of personas) {
  const { context, page } = await open()
  await page.getByText(who, { exact: false }).first().click()
  await check(page, name)
  await context.close()
}
// the till: sign on, then scan a few items
{
  const { context, page } = await open()
  await page.getByText('Jamal Carter', { exact: false }).first().click()
  await check(page, '7-jamal-sign-on')
  await page.getByText('Sign on & open till', { exact: false }).click()
  await page.waitForTimeout(400)
  for (let i = 0; i < 4; i++) await page.getByText('Scan next item', { exact: false }).first().click().catch(() => {})
  await check(page, '8-jamal-till')
  await context.close()
}

console.log(`\n${total} text elements checked`)
if (failures.size) {
  console.log(`\n${failures.size} distinct failures:`)
  for (const [k, v] of failures) console.log(` - ${k}  (${v})`)
}
if (failed.length) console.log('\nmissing files:', [...new Set(failed)].join(', '))
if (errors.length) console.log('PAGE ERRORS:\n' + [...new Set(errors)].join('\n'))
await browser.close()
