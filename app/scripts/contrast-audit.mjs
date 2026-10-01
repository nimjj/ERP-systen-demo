/**
 * WCAG AA contrast audit in headless Chrome. Plays S1, S2 and S3 with the
 * Presenter's Next button and, after every step (and with the inbox, the event
 * stream and the timeline open), checks every visible piece of text against the
 * background it really sits on:
 *   - normal text needs 4.5:1; large text (>= 24px, or >= 18.66px bold) needs 3:1
 *   - opacity is taken into account; disabled controls are exempt (WCAG 1.4.3)
 *
 *   node scripts/contrast-audit.mjs <baseUrl>
 * Exit code 1 if anything fails.
 */
import { chromium } from 'playwright-core'
import { auditInPage } from './lib/contrast.mjs'

const base = process.argv[2] ?? 'http://127.0.0.1:5173/'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await (await browser.newContext({ viewport: { width: 1680, height: 1000 } })).newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))


let total = 0
const failures = new Map()
async function audit(label) {
  const rows = await page.evaluate(auditInPage)
  total += rows.length
  for (const r of rows.filter((x) => !x.pass)) {
    const key = `${r.cls} | ${r.fg} on ${r.bg} | ${r.size}px | ${r.ratio} < ${r.need}`
    if (!failures.has(key)) failures.set(key, { label, text: r.text })
  }
  const bad = rows.filter((x) => !x.pass).length
  console.log(`${label.padEnd(44)} ${String(rows.length).padStart(4)} texts, ${bad} below AA`)
}

async function runScenario(id, steps, extras = {}) {
  await page.goto(`${base}?scenario=${id}`, { waitUntil: 'networkidle' })
  await audit(`${id} start`)
  for (let i = 1; i <= steps; i++) {
    await page.getByRole('button', { name: 'Next ›' }).click()
    await page.waitForTimeout(300)
    if (await page.locator('.overlay').count()) {
      await audit(`${id} step ${i} (timeline open)`)
      await page.getByRole('button', { name: 'Close' }).click()
      await page.waitForTimeout(200)
    }
    await audit(`${id} step ${i}`)
    if (extras[i]) await extras[i]()
  }
}

const openInbox = async (role) => {
  await page.locator(`.pane-${role}`).getByRole('button', { name: /Notifications/ }).click()
  await page.waitForTimeout(200)
  await audit(`inbox ${role}`)
  await page.locator(`.pane-${role}`).getByRole('button', { name: 'Close' }).click()
}
const openStream = async () => {
  await page.getByRole('button', { name: /Event stream/ }).click()
  await page.waitForTimeout(250)
  await page.locator('.chip-cause').first().click().catch(() => {})
  await audit('event stream open + chain highlighted')
  await page.getByRole('button', { name: /Event stream/ }).click()
}

await runScenario('S1', 6, { 3: openStream, 4: () => openInbox('emily'), 5: () => openInbox('aisha') })
await runScenario('S2', 4, { 1: () => openInbox('priya') })
await runScenario('S3', 4, { 1: () => openInbox('jamal') })

// other layouts: each pane full screen after S3 (handheld pull form, marketing notice)
for (const role of ['jamal', 'aisha', 'emily', 'priya']) {
  await page.getByRole('button', { name: new RegExp(role === 'jamal' ? 'Jamal' : role === 'aisha' ? 'Aisha' : role === 'emily' ? 'Emily' : 'Priya') }).first().click()
  await page.waitForTimeout(200)
  await audit(`full screen ${role}`)
}

console.log(`\n${total} text elements checked`)
if (failures.size) {
  console.log(`\n${failures.size} distinct failures:`)
  for (const [k, v] of failures) console.log(` - ${k}   e.g. "${v.text}" (${v.label})`)
}
if (errors.length) console.log('PAGE ERRORS:\n' + errors.join('\n'))
await browser.close()
process.exit(failures.size ? 1 : 0)
