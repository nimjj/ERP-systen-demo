/**
 * Headless screenshot helper (uses the locally installed Chrome via playwright-core).
 *
 *   node scripts/shot.mjs <url> <out.png> [width] [height] [--click "Text"]... [--text]
 *
 * --click  clicks the first button with that name (else the first element with that text) before the shot (repeatable)
 * --text   also prints the page's visible text (for finding navigation)
 */
import { chromium } from 'playwright-core'

const args = process.argv.slice(2)
const [url, out, w = '1440', h = '900'] = args.filter((a, i) => !a.startsWith('--') && !(args[i - 1] === '--click'))
const clicks = args.flatMap((a, i) => (a === '--click' ? [args[i + 1]] : []))
const wantText = args.includes('--text')

const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) } })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await page.goto(url, { waitUntil: 'networkidle' })
  for (const text of clicks) {
    const button = page.getByRole('button', { name: text }).first()
    await ((await button.count()) ? button : page.getByText(text, { exact: false }).first()).click()
    await page.waitForTimeout(400)
  }
  await page.waitForTimeout(300)
  await page.screenshot({ path: out, fullPage: false })
  if (wantText) console.log((await page.innerText('body')).slice(0, 4000))
  if (errors.length) console.log('PAGE ERRORS:\n' + errors.join('\n'))
  console.log(`saved ${out}`)
} finally {
  await browser.close()
}
