/**
 * Scripted scenarios (SPEC §7): every step reaches its `done` via Next, the end
 * numbers match the story, and doing the steps the way the panes do produces the
 * identical event log (type, actor, payload) as pressing Next.
 */
import { describe, expect, it } from 'vitest'
import { approveOrder, completeSale, defaultReceived, gapList, issueRecall, publishOffer, publishPromo, pullLot, pullTaskLot, receiveDelivery, refillShelf, scanBlocked, sendRecallNotice, simulateSales, submitPromo } from '../src/actions'
import type { DemoEvent, EventDraft } from '../src/domain/types'
import { s1, s2, s3, type Scenario } from '../src/scenarios'
import { ofType, Sim, YOGURT } from './helpers'

const ctx = { shortShip: true }
const shape = (log: readonly DemoEvent[]) => log.map((e) => ({ type: e.type, actor: e.actor, payload: e.payload, causedBy: e.causedBy }))

/** Play a scenario with Next only; check each step is not done before and done after. */
function playNext(scenario: Scenario): Sim {
  const sim = new Sim()
  for (const step of scenario.steps) {
    const mark = sim.log.length
    expect(step.done(sim.state, sim.log.slice(mark)), `${step.title} done too early`).toBe(false)
    const drafts = step.next(sim.state, ctx)
    expect(drafts.length, `${step.title} has nothing to do`).toBeGreaterThan(0)
    for (const d of drafts) sim.do(d)
    expect(step.done(sim.state, sim.log.slice(mark)), `${step.title} not done after Next`).toBe(true)
  }
  return sim
}

/** Play the same steps the way the panes do: the inputs a presenter would pick by hand. */
function playLikePanes(steps: ((sim: Sim) => EventDraft[])[]): Sim {
  const sim = new Sim()
  for (const s of steps) for (const d of s(sim)) sim.do(d)
  return sim
}

describe('S1 — From offer to shelf', () => {
  it('every step completes with Next and the story numbers come out', () => {
    const sim = playNext(s1)
    const y = sim.proposal(YOGURT)
    expect(sim.offer('OF-3101')).toMatchObject({ status: 'Live', redeemed: 1, vendorPaidUsd: 1 })
    expect(sim.position(YOGURT)).toMatchObject({ onHand: 26, shelf: 6, backRoom: 20 })
    expect(y).toMatchObject({ proposedQty: 6, lastOrderQty: 24 }) // gap re-opened by one case
    expect(y.exceptions.map((e) => e.code)).toContain('SUPPLIER_CONSTRAINT')
    expect(sim.state.claims.at(-1)).toMatchObject({ id: 'CLM-5223', shortQty: 4, value: 16.68 })
    expect(ofType(sim.log, 'STOCK_RISK_RAISED')).toHaveLength(1)
    expect(sim.state.stockRisks).toEqual([]) // cleared once the delivery restored cover
  })

  it('doing it in the panes gives the identical event log as Next', () => {
    const byNext = playNext(s1)
    const byPanes = playLikePanes([
      (sim) => [publishOffer(sim.offer('OF-3101'))], // Emily: Publish to Plano Market
      (sim) => [completeSale(sim.state, [{ sku: YOGURT, qty: 1 }], 'M-1001')], // Till: Maria + Key item + Complete sale
      (sim) => simulateSales(sim.state), // Presenter: Simulate 10 sales
      (sim) => [refillShelf(gapList(sim.state).find((p) => p.sku === YOGURT)!)], // Handheld: Gap scan → Refill
      (sim) => [approveOrder(sim.proposal(YOGURT))], // Planner: Approve
      (sim) => {
        // Handheld: Receive delivery form, pre-filled with short-ship on, Confirm receipt
        const task = sim.state.handheld.tasks.find((t) => t.title === 'Receive delivery: Plain Greek Yogurt 32 oz')!
        const line = sim.state.inbound.find((i) => i.id === task.ref)!
        return receiveDelivery(sim.state, task, { [line.id]: defaultReceived(line, true) })
      },
    ])
    expect(shape(byPanes.log)).toEqual(shape(byNext.log))
    expect(byPanes.state.proposals).toEqual(byNext.state.proposals)
  })

  it('with short-ship off, the delivery arrives in full and no claim is raised', () => {
    const sim = new Sim()
    for (const step of s1.steps) for (const d of step.next(sim.state, { shortShip: false })) sim.do(d)
    expect(ofType(sim.log, 'CLAIM_RAISED')).toEqual([])
    expect(sim.proposal(YOGURT).proposedQty).toBe(0)
  })
})

describe('S2 — Promo gate', () => {
  it('Fail blocks PRM-2720; the Cola pre-build flips PRM-2702 Warn → Pass; Emily publishes', () => {
    const sim = playNext(s2)
    expect(sim.promo('PRM-2720').gate?.status).toBe('Fail')
    expect(sim.promo('PRM-2720').status).toBe('In approval')
    const checks = ofType(sim.log, 'PROMO_STOCK_CHECKED').filter((e) => e.payload.promoId === 'PRM-2702').map((e) => e.payload.result.status)
    expect(checks).toEqual(['Warn', 'Pass'])
    expect(sim.promo('PRM-2702').status).toBe('Published')
  })

  it('doing it in the panes gives the identical event log as Next', () => {
    const byNext = playNext(s2)
    const byPanes = playLikePanes([
      () => [submitPromo('PRM-2720')],
      () => [submitPromo('PRM-2702')],
      (sim) => [approveOrder(sim.state.proposals.find((p) => p.id === 'PRP-00003')!)],
      () => [publishPromo('PRM-2702')],
    ])
    expect(shape(byPanes.log)).toEqual(shape(byNext.log))
  })
})

describe('S3 — Recall hits everyone', () => {
  it('every step completes with Next; all four panes changed and Plano is confirmed', () => {
    const sim = playNext(s3)
    const recall = sim.state.recalls.find((r) => r.id === 'RCL-2026-014')!
    expect(sim.state.till.blockedSkus).toEqual(['SKU-100228'])
    expect(recall.posBlock.blockedScans).toBe(1)
    expect(sim.state.handheld.tasks.filter((t) => t.kind === 'RECALL_PULL').every((t) => t.status === 'DONE')).toBe(true)
    expect(sim.position('SKU-100228').onHand).toBe(0)
    expect(sim.state.inbound.find((i) => i.sku === 'SKU-100228')!.status).toBe('HELD')
    expect(sim.promo('PRM-2698').recallFlags).toHaveLength(1)
    expect(recall.notice!.status).toBe('SENT')
    expect(recall.stores.find((r) => r.storeId === 'US-DFW-1101')!.confirmedBy).toBe('Aisha Khan')
  })

  it('doing it in the panes gives the identical event log as Next', () => {
    const byNext = playNext(s3)
    const byPanes = playLikePanes([
      (sim) => [issueRecall(sim.state.recalls[0])], // Presenter: Issue recall
      (sim) => [scanBlocked(sim.state, 'SKU-100228')!], // Till: key cheddar → refused
      (sim) => {
        // Handheld: open each pull task (in list order) and confirm the pre-filled quantity
        const drafts: EventDraft[] = []
        for (const t of sim.state.handheld.tasks.filter((x) => x.kind === 'RECALL_PULL')) {
          const lot = pullTaskLot(sim.state, t)!
          drafts.push(...pullLot(sim.state, t, lot.onHand - lot.pulled))
        }
        return drafts
      },
      (sim) => [sendRecallNotice(sim.state.recalls[0])!], // Emily: Send notice
    ])
    expect(shape(byPanes.log)).toEqual(shape(byNext.log))
  })
})
