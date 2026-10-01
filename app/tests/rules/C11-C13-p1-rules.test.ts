import { describe, expect, it } from 'vitest'
import { c11SupplyForPromo } from '../../src/rules/c11SupplyForPromo'
import { c12CountVariance } from '../../src/rules/c12CountVariance'
import { c13ShelfRefill } from '../../src/rules/c13ShelfRefill'
import { afterReducer, approve } from '../helpers'

describe('C11 supply for promo', () => {
  it('ORDER_APPROVED on the tuned line → SUPPLY_ADDED; SUPPLY_ADDED → re-check + notification', () => {
    const a = afterReducer(approve('PRP-00003', 160))
    expect(c11SupplyForPromo.run(a.state, a.event).newEvents.map((e) => e.type)).toEqual(['SUPPLY_ADDED'])
    const b = afterReducer({ type: 'SUPPLY_ADDED', actor: 'system', payload: { promoId: 'PRM-2702', proposalId: 'PRP-00003', units: 2200 } })
    expect(c11SupplyForPromo.run(b.state, b.event).newEvents.map((e) => e.type)).toEqual(['PROMO_STOCK_CHECKED', 'NOTIFICATION_ADDED'])
  })
})

describe('C12 count variance', () => {
  it('sets PHANTOM_CORRECTED on its returned state and emits the variance + a note to Priya', () => {
    const { state, event } = afterReducer({ type: 'COUNT_SUBMITTED', actor: 'aisha', payload: { countId: 'CNT-44821', lines: [{ sku: 'SKU-100214', systemQty: 19, actualQty: 0 }] } })
    const out = c12CountVariance.run(state, event)
    expect(out.state.positions['SKU-100214'].flags).toContain('PHANTOM_CORRECTED')
    expect(state.positions['SKU-100214'].flags).not.toContain('PHANTOM_CORRECTED')
    expect(out.newEvents.map((e) => e.type)).toEqual(['STOCK_CHANGED', 'NOTIFICATION_ADDED'])
  })

  it('lines for SKUs without a Plano position are ignored', () => {
    const { state, event } = afterReducer({ type: 'COUNT_SUBMITTED', actor: 'aisha', payload: { countId: 'C', lines: [{ sku: 'SKU-100242', systemQty: 20, actualQty: 3 }] } })
    expect(c12CountVariance.run(state, event)).toEqual({ state, newEvents: [] })
  })
})

describe('C13 shelf refill', () => {
  it('nothing in the back room → no event', () => {
    const { state, event } = afterReducer({ type: 'SHELF_REFILLED', actor: 'aisha', payload: { sku: 'SKU-100214', qty: 5 } })
    expect(c13ShelfRefill.run(state, event).newEvents).toEqual([])
  })
})
