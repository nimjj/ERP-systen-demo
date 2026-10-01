/** Seed consistency: one stock number per SKU, and the M0 decisions applied. */
import { describe, expect, it } from 'vitest'
import { demoTuning } from '../src/config/demoTuning'
import { buildSeedState } from '../src/seed/loadSeed'

const s = buildSeedState()

describe('seed slice (Plano US-DFW-1101)', () => {
  it('has the four personas and the 11 proposals', () => {
    expect(s.personas.map((p) => p.name)).toEqual(['Jamal Carter', 'Aisha Khan', 'Emily Chen', 'Priya Raman'])
    expect(s.proposals).toHaveLength(11)
    expect(s.store.id).toBe('US-DFW-1101')
  })

  it('positions, proposals and inbound agree on stock', () => {
    for (const p of s.proposals) {
      const pos = s.positions[p.itemId]
      expect(pos.onHand, p.itemId).toBe(p.onHand)
      const inTransit = s.inbound.filter((i) => i.sku === p.itemId && i.status === 'IN_TRANSIT').reduce((a, i) => a + i.expectedQty, 0)
      expect(inTransit, p.itemId).toBe(p.inTransit)
    }
    for (const pos of Object.values(s.positions)) {
      expect(pos.shelf + pos.backRoom + pos.quarantine + pos.rtvHold, pos.sku).toBe(pos.onHand)
    }
  })

  it('hero yogurt matches SPEC §6', () => {
    const y = s.proposals.find((p) => p.id === 'PRP-00001')!
    expect([y.itemId, y.onHand, y.inTransit, y.dailyForecast, y.casePack, y.proposedQty, y.lastOrderQty, y.status]).toEqual(['SKU-100221', 17, 6, 9.3, 6, 6, 12, 'AUTO_RELEASED'])
    expect([s.positions['SKU-100221'].shelf, s.positions['SKU-100221'].backRoom]).toEqual([9, 8])
  })

  it('starts in the "before" state (decision M0 #2)', () => {
    expect(s.offers.find((o) => o.id === 'OF-3101')!.status).toBe('Draft')
    expect(s.till.rules.find((r) => r.id === 'R-BP-801')!.status).toBe('inactive')
    expect(s.promos.promotions.find((p) => p.id === 'PRM-2698')!.status).toBe('Live')
    expect(demoTuning.upliftBakedIntoForecast).toContain('PRM-2698')
    const recall = s.recalls.find((r) => r.id === 'RCL-2026-014')!
    expect(recall.status).toBe('NOT_ISSUED')
    expect(recall.posBlock.blocked).toBe(false)
    expect(recall.stores.find((r) => r.storeId === 'US-DFW-1101')).toBeTruthy()
    expect(s.positions['SKU-100228'].onHand).toBe(31)
  })

  it('proposal numbers win (decision M0 #4)', () => {
    expect(s.positions['SKU-100214'].onHand).toBe(19)
    expect(s.handheld.count.lines.find((l) => l.itemId === 'SKU-100214')!.systemQty).toBe(19)
    expect(s.proposals.find((p) => p.itemId === 'SKU-100214')!.exception?.code).toBe('PHANTOM_SUSPECTED')
    expect(s.inbound.find((i) => i.sku === 'SKU-100221')!.expectedQty).toBe(6)
  })

  it('pending lines at start are strawberries, cola and eggs', () => {
    const pending = s.proposals.filter((p) => p.status === 'PENDING_REVIEW').map((p) => [p.itemId, p.exception?.code])
    expect(pending).toEqual([
      ['SKU-100410', 'SHELF_CAPACITY'],
      ['SKU-100319', 'PROMO_UPLIFT'],
      ['SKU-100214', 'PHANTOM_SUSPECTED'],
    ])
  })
})
