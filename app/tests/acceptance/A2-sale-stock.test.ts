/** A2 — SALE_COMPLETED of qty n reduces yogurt shelf by n (then back room when shelf is 0), and onHand by n. */
import { describe, expect, it } from 'vitest'
import { ofType, sale, Sim, YOGURT } from '../helpers'

describe('A2 sale depletes stock', () => {
  it('takes from the shelf first', () => {
    const sim = new Sim()
    const events = sim.do(sale([{ sku: YOGURT, qty: 3 }]))
    expect(sim.position(YOGURT)).toMatchObject({ onHand: 14, shelf: 6, backRoom: 8 })
    const [changed] = ofType(events, 'STOCK_CHANGED')
    expect(changed.payload).toEqual({ sku: YOGURT, delta: -3, reason: 'SALE', onHand: 14, shelf: 6, backRoom: 8 })
  })

  it('then from the back room once the shelf is empty', () => {
    const sim = new Sim()
    sim.do(sale([{ sku: YOGURT, qty: 12 }]))
    expect(sim.position(YOGURT)).toMatchObject({ onHand: 5, shelf: 0, backRoom: 5 })
  })

  it('n single-unit sales reduce onHand by n', () => {
    const sim = new Sim()
    for (let i = 0; i < 4; i++) sim.do(sale([{ sku: YOGURT, qty: 1 }]))
    expect(sim.position(YOGURT)).toMatchObject({ onHand: 13, shelf: 5, backRoom: 8 })
  })

  it('the proposal sees the new onHand and days of cover (C3 → C4)', () => {
    const sim = new Sim()
    sim.do(sale([{ sku: YOGURT, qty: 3 }]))
    expect(sim.proposal(YOGURT)).toMatchObject({ onHand: 14, daysOfCover: 1.5 })
  })

  it('items without a Plano position (beer, bananas) do not create stock events', () => {
    const sim = new Sim()
    const events = sim.do(sale([{ sku: 'POS-BEER-01', qty: 1 }]))
    expect(ofType(events, 'STOCK_CHANGED')).toEqual([])
  })
})
