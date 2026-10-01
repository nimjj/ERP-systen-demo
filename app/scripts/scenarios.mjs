/**
 * Runs S1 and S2 in headless Chrome:
 *  1. with the Presenter's Next button, screenshot per step (+ the S1 timeline);
 *  2. S1 again by clicking in the panes, checking the step list follows;
 *  3. compares the two S1 event logs (type, actor, payload, causedBy by position).
 *
 *   node scripts/scenarios.mjs <baseUrl> <outDir>
 */
import { chromium } from 'playwright-core'

const [base = 'http://127.0.0.1:5180/', out = '.'] = process.argv.slice(2)
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const errors = []

async function open(path) {
  const context = await browser.newContext({ viewport: { width: 1680, height: 1000 } })
  const page = await context.newPage()
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(base + path, { waitUntil: 'networkidle' })
  return { context, page }
}
const shot = async (page, name) => {
  await page.waitForTimeout(350)
  await page.screenshot({ path: `${out}/${name}.png` })
}
const currentStep = async (page) => ((await page.locator('.step-current .step-title').first().innerText().catch(() => '?')) || '?').trim()
const log = async (page) => {
  const raw = await page.evaluate(() => localStorage.getItem('jh-connected-demo:log'))
  const events = JSON.parse(raw).events
  const pos = new Map(events.map((e, i) => [e.id, i]))
  return events.map((e) => ({ type: e.type, actor: e.actor, payload: e.payload, causedBy: e.causedBy === null ? null : pos.get(e.causedBy) }))
}

async function runWithNext(id, steps) {
  const { context, page } = await open(`?scenario=${id}`)
  await shot(page, `${id}-0-start`)
  console.log(`${id} start: current step = ${await currentStep(page)}`)
  for (let i = 1; i <= steps; i++) {
    await page.getByRole('button', { name: 'Next ›' }).click()
    await page.waitForTimeout(400)
    if (await page.locator('.overlay').count()) {
      await shot(page, `${id}-${i}-timeline`)
      console.log(`${id} after Next ${i}: timeline open`)
      await page.getByRole('button', { name: 'Close' }).click()
    }
    await shot(page, `${id}-${i}`)
    console.log(`${id} after Next ${i}: current step = ${await currentStep(page)}`)
  }
  const l = await log(page)
  await context.close()
  return l
}

// ---- 1. Next path
const s1Next = await runWithNext('S1', 6)
const s2Next = await runWithNext('S2', 4)

// ---- 2. S1 by clicking in the panes
{
  const { context, page } = await open('?scenario=S1')
  const pane = (r) => page.locator(`.pane-${r}`)
  const step = async (label) => console.log(`S1 by hand — ${label}: current step = ${await currentStep(page)}`)

  await pane('emily').getByRole('button', { name: /Publish to Plano Market/ }).click()
  await page.waitForTimeout(300)
  await step('after Emily publishes')

  await pane('jamal').locator('select[aria-label="Rewards member"]').selectOption('M-1001')
  await pane('jamal').getByRole('button', { name: 'Key item' }).click()
  await pane('jamal').getByRole('button', { name: /Complete sale/ }).click()
  await page.waitForTimeout(300)
  await step('after the sale to Maria')

  await page.locator('.presenter').getByRole('button', { name: /Simulate 10 sales/ }).click()
  await page.waitForTimeout(400)
  await step('after Simulate 10 sales')

  await pane('aisha').getByText('Morning gap scan').click()
  await pane('aisha').locator('.form-lines li', { hasText: 'Plain Greek Yogurt 32 oz' }).getByRole('button', { name: /Refill/ }).click()
  await page.waitForTimeout(300)
  await shot(page, 'S1-hand-4-refill')
  await pane('aisha').getByRole('button', { name: '‹ All tasks' }).click()
  await step('after Aisha refills')

  await pane('priya').locator('tr', { hasText: 'Plain Greek Yogurt 32 oz' }).first().click()
  await pane('priya').getByRole('button', { name: /^Approve/ }).click()
  await page.waitForTimeout(300)
  await step('after Priya approves')

  await pane('aisha').getByText('Receive delivery: Plain Greek Yogurt 32 oz').click()
  await shot(page, 'S1-hand-6-receive-form')
  console.log('S1 by hand — receive form pre-filled:', await pane('aisha').locator('.form-lines input').first().inputValue())
  await pane('aisha').getByRole('button', { name: 'Confirm receipt' }).click()
  await page.waitForTimeout(400)
  console.log('S1 by hand — timeline open at the end:', (await page.locator('.overlay').count()) === 1)
  await shot(page, 'S1-hand-end')

  const s1Hand = await log(page)
  const same = JSON.stringify(s1Hand) === JSON.stringify(s1Next)
  console.log(`S1 event logs: Next ${s1Next.length} events, by hand ${s1Hand.length} events, identical: ${same}`)
  if (!same) {
    const i = s1Hand.findIndex((e, k) => JSON.stringify(e) !== JSON.stringify(s1Next[k]))
    console.log('first difference at', i, JSON.stringify(s1Next[i]), JSON.stringify(s1Hand[i]))
  }
  await context.close()
}
console.log(`S2 via Next: ${s2Next.length} events`)

if (errors.length) console.log('PAGE ERRORS:\n' + errors.join('\n'))
await browser.close()
