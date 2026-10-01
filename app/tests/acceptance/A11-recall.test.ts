/**
 * A11 — RECALL_ISSUED blocks the SKU at the till, creates pull tasks per lot,
 * holds inbound, blocks proposals, flags PRM-2698. Plus the customer notice with
 * the recall record's real counts, and C15 (pulling stock).
 */
import { describe, expect, it } from 'vitest'
import { gapList, issueRecall, pullLot, scanBlocked, sendRecallNotice } from '../../src/actions'
import { c14RecallIssued } from '../../src/rules/c14RecallIssued'
import { priceBasket } from '../../src/rules/engine/tillPricing'
import { buildSeedState } from '../../src/seed/loadSeed'
import { applyEvent } from '../../src/store/dispatch'
import { asEvent, ofType, Sim } from '../helpers'

const CHEDDAR = 'SKU-100228'
const issued = () => {
  const sim = new Sim()
  const events = sim.do(issueRecall(sim.state.recalls.find((r) => r.id === 'RCL-2026-014')!))
  return { sim, events }
}

describe('A11 recall issued', () => {
  it('records the recall as issued with the POS block on', () => {
    const { sim } = issued()
    expect(sim.state.recalls[0]).toMatchObject({ status: 'ISSUED', posBlock: { blocked: true, blockedScans: 0 } })
    expect(sim.state.recalls[0].issued).toBeTruthy()
  })

  it('Jamal: cheddar is blocked at the till; a refused scan is counted', () => {
    const { sim } = issued()
    expect(sim.state.till.blockedSkus).toEqual([CHEDDAR])
    sim.do(scanBlocked(sim.state, CHEDDAR)!)
    expect(sim.state.recalls[0].posBlock.blockedScans).toBe(1)
    expect(scanBlocked(buildSeedState(), CHEDDAR)).toBeNull() // nothing to refuse before the recall
  })

  it('Aisha: one pull task per Plano lot, with lot numbers and quantities', () => {
    const { sim } = issued()
    const pulls = sim.state.handheld.tasks.filter((t) => t.kind === 'RECALL_PULL')
    expect(pulls.map((t) => [t.ref, t.status])).toEqual([
      ['RCL-2026-014:PGD-26261A', 'OPEN'],
      ['RCL-2026-014:PGD-26261B', 'OPEN'],
      ['RCL-2026-014:PGD-26263A', 'OPEN'],
    ])
    expect(pulls.map((t) => t.detail.split(' · ')[0])).toEqual(['12 units', '12 units', '7 units'])
  })

  it('Priya: the open cheddar order (84 units on ASN-US-778134) is held and leaves in-transit', () => {
    const { sim, events } = issued()
    expect(ofType(events, 'INBOUND_HELD').map((e) => e.payload)).toEqual([{ inboundId: 'ASN-US-778134:SKU-100228', sku: CHEDDAR, qty: 84, reason: 'Recall RCL-2026-014' }])
    expect(sim.state.inbound.find((i) => i.sku === CHEDDAR)!.status).toBe('HELD')
  })

  it('Priya: proposals for the recalled SKU are blocked (Plano has none for cheddar, so checked with one added)', () => {
    const start = buildSeedState()
    start.proposals.push({ ...start.proposals[0], id: 'PRP-TEST', itemId: CHEDDAR, status: 'AUTO_RELEASED' })
    const event = asEvent(issueRecall(start.recalls[0]))
    const out = c14RecallIssued.run(applyEvent(start, event), event)
    expect(out.state.proposals.find((p) => p.id === 'PRP-TEST')!.status).toBe('BLOCKED')
    expect(out.state.proposals.filter((p) => p.id !== 'PRP-TEST').every((p) => p.status !== 'BLOCKED')).toBe(true)
  })

  it('Emily: PRM-2698 loses cheddar and is flagged; yogurt stays in it', () => {
    const { sim } = issued()
    const promo = sim.promo('PRM-2698')
    expect(promo.itemIds).toEqual(['SKU-100221'])
    expect(promo.recallFlags).toEqual([{ recallId: 'RCL-2026-014', sku: CHEDDAR, itemName: 'Shredded Mild Cheddar 8 oz' }])
    expect(promo.status).toBe('Live')
  })

  it('Emily: a customer notice is drafted with the real counts from the recall record, and can be sent', () => {
    const { sim } = issued()
    const notice = sim.state.recalls[0].notice!
    expect(notice).toMatchObject({ status: 'DRAFT', buyers: 1284, push: 1102, email: 1219, sms: 388, refunds: 173, nonMemberSales: 265, signage: true })
    expect(notice.body).toContain('PGD-26261A')
    sim.do(sendRecallNotice(sim.state.recalls[0])!)
    expect(sim.state.recalls[0].notice!.status).toBe('SENT')
    expect(sendRecallNotice(sim.state.recalls[0])).toBeNull()
  })

  it('every pane is told: one notification each for Jamal, Aisha, Priya and Emily', () => {
    const { sim } = issued()
    expect(sim.state.notifications.map((n) => n.role).sort()).toEqual(['aisha', 'emily', 'jamal', 'priya'])
  })

  it('the till still prices other items; cheddar cannot be sold', () => {
    const { sim } = issued()
    expect(priceBasket(sim.state, [{ sku: 'SKU-100221', qty: 1 }], null).total).toBe(5.98)
  })
})

describe('C15 recall pulled', () => {
  it('each lot pulled takes stock out and closes its task; after the last lot stock is 0 and Plano is confirmed', () => {
    const { sim } = issued()
    const pulls = () => sim.state.handheld.tasks.filter((t) => t.kind === 'RECALL_PULL')
    const first = sim.do(pullLot(sim.state, pulls()[0], 12)[0])
    expect(ofType(first, 'STOCK_CHANGED')[0].payload).toMatchObject({ sku: CHEDDAR, delta: -12, reason: 'RECALL_PULL', onHand: 19 })
    expect(pulls()[0].status).toBe('DONE')
    expect(sim.state.recalls[0].stores[0].confirmedBy).toBeNull()
    expect(sim.state.notifications.at(-1)!.text).toContain('Write-off $25.32') // 12 × $2.11

    sim.do(pullLot(sim.state, pulls()[1], 12)[0])
    sim.do(pullLot(sim.state, pulls()[2], 7)[0])
    expect(sim.position(CHEDDAR)).toMatchObject({ onHand: 0, shelf: 0, backRoom: 0 })
    expect(pulls().every((t) => t.status === 'DONE')).toBe(true)
    expect(sim.state.recalls[0].stores[0]).toMatchObject({ storeId: 'US-DFW-1101', confirmedBy: 'Aisha Khan' })
    expect(sim.state.recalls[0].stores[0].lots.map((l) => l.pulled)).toEqual([12, 12, 7])
    expect(gapList(sim.state).map((p) => p.sku)).not.toContain(CHEDDAR) // an empty recalled shelf is not a gap to refill
  })
})
