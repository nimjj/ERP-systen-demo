/**
 * Clicks through the S1 connections in the real UI with two windows and saves a
 * screenshot per step. Prints what each pane shows so the result can be checked.
 *
 *   node scripts/flow.mjs <baseUrl> <outDir>
 */
import { chromium } from 'playwright-core'

const [base = 'http://127.0.0.1:5180/', out = '.'] = process.argv.slice(2)
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
const errors = []
const page = await context.newPage()
page.on('pageerror', (e) => errors.push(String(e)))
await page.goto(base, { waitUntil: 'networkidle' })
await page.getByRole('button', { name: 'Reset demo' }).click()

// Second window, Emily only — it must follow window 1 live (BroadcastChannel).
const other = await context.newPage()
other.on('pageerror', (e) => errors.push(String(e)))
await other.goto(base + '?role=emily', { waitUntil: 'networkidle' })

const pane = (role) => page.locator(`.pane-${role}`)
const shot = async (name, p = page) => {
  await p.waitForTimeout(250)
  await p.screenshot({ path: `${out}/${name}.png` })
  console.log(`saved ${name}.png`)
}
const text = async (loc) => (await loc.innerText()).replace(/\s+/g, ' ').trim()
const yogurtRow = () => pane('priya').locator('tr', { hasText: 'Plain Greek Yogurt 32 oz' }).first()

// 1 Emily publishes OF-3101
await pane('emily').getByRole('button', { name: /Publish to Plano Market/ }).click()
await page.waitForTimeout(300)
console.log('1 till chip:', await pane('jamal').getByText('+200 pts Greek yogurt').count(), '| yogurt row:', await text(yogurtRow()))
console.log('1 window 2 offer status:', await text(other.locator('.card-head .chip').first()))
await shot('s1-1-published')
await shot('s1-1-window2', other)

// 2 Jamal sells one yogurt to Maria
await pane('jamal').locator('select[aria-label="Rewards member"]').selectOption('M-1001')
await pane('jamal').getByRole('button', { name: 'Key item' }).click()
console.log('2 basket:', await text(pane('jamal').locator('.till-lines')))
await shot('s1-2-basket')
await pane('jamal').getByRole('button', { name: /Complete sale/ }).click()
await page.waitForTimeout(300)
console.log('2 offer metrics:', await text(pane('emily').locator('.metrics')))

// 3 Simulate 10 sales
await page.getByRole('button', { name: /Simulate 10 sales/ }).click()
await page.waitForTimeout(400)
console.log('3 risk banner:', await pane('emily').locator('.banner-amber').count(), '| yogurt row:', await text(yogurtRow()))
console.log('3 aisha:', await text(pane('aisha').locator('.tasks')))
await shot('s1-3-after-sales')

// 4 Priya approves the yogurt order
await yogurtRow().click()
await pane('priya').getByRole('button', { name: /^Approve/ }).click()
await page.waitForTimeout(300)
console.log('4 yogurt row:', await text(yogurtRow()))
console.log('4 aisha tasks:', await text(pane('aisha').locator('.tasks')))
await shot('s1-4-approved')

// 5 Aisha receives short (4 fewer than expected)
await pane('aisha').getByText('Receive delivery: Plain Greek Yogurt 32 oz').click()
const input = pane('aisha').locator('.form-lines input').first()
const expected = Number(await input.inputValue())
await input.fill(String(expected - 4))
await shot('s1-5-receive-form')
await pane('aisha').getByRole('button', { name: 'Confirm receipt' }).click()
await page.waitForTimeout(300)
console.log('5 yogurt row:', await text(yogurtRow()))
console.log('5 claims first row:', await text(pane('priya').locator('table').last().locator('tbody tr').first()))

// Event stream with a highlighted chain
await page.getByRole('button', { name: /Event stream/ }).click()
await page.locator('.chip-cause').nth(3).click()
await shot('s1-6-stream')
console.log('stream focus:', await text(page.locator('.stream-focus')))
console.log('window 2 events:', await text(other.locator('.stream-bar .chip')), '| window 1:', await text(page.locator('.stream-bar .chip')))

// Inbox (stream closed)
await page.getByRole('button', { name: /Event stream/ }).click()
await pane('priya').getByRole('button', { name: /Notifications/ }).click()
await shot('s1-7-inbox')

if (errors.length) console.log('PAGE ERRORS:\n' + errors.join('\n'))
await browser.close()
