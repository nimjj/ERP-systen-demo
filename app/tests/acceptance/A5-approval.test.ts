/** A5 — ORDER_APPROVED creates one inbound and one RECEIVE task for Aisha, with expectedQty = approved qty. */
import { describe, expect, it } from 'vitest'
import { approve, ofType, publishOffer, sale, Sim, YOGURT } from '../helpers'

describe('A5 approval creates a receipt', () => {
  it('one inbound and one RECEIVE task with the approved quantity', () => {
    const sim = new Sim()
    const inboundBefore = sim.state.inbound.length
    const tasksBefore = sim.state.handheld.tasks.length
    const events = sim.do(approve('PRP-00001', 24))

    const created = ofType(events, 'INBOUND_CREATED')
    const tasks = ofType(events, 'TASK_CREATED')
    expect(created).toHaveLength(1)
    expect(tasks).toHaveLength(1)
    expect(created[0].payload).toMatchObject({ sku: YOGURT, qty: 24 })

    expect(sim.state.inbound).toHaveLength(inboundBefore + 1)
    const inbound = sim.state.inbound.find((i) => i.id === created[0].payload.inboundId)!
    expect(inbound).toMatchObject({ expectedQty: 24, status: 'IN_TRANSIT', sku: YOGURT })

    expect(sim.state.handheld.tasks).toHaveLength(tasksBefore + 1)
    const task = sim.state.handheld.tasks.find((t) => t.id === tasks[0].payload.taskId)!
    expect(task).toMatchObject({ kind: 'RECEIVE', status: 'OPEN', ref: inbound.id })
    expect(task.detail).toContain('4 cases (24 units)')
    expect(sim.state.notifications.some((n) => n.role === 'aisha')).toBe(true)
  })

  it('an edited quantity is what gets ordered', () => {
    const sim = new Sim()
    const events = sim.do({ type: 'ORDER_APPROVED', actor: 'priya', payload: { proposalId: 'PRP-00001', qty: 18, editedFrom: 6 } })
    expect(ofType(events, 'INBOUND_CREATED')[0].payload.qty).toBe(18)
  })

  it('S1: after selling down with the offer live, approving 24 brings the next order to 0', () => {
    const sim = new Sim()
    sim.do(publishOffer())
    for (let i = 0; i < 11; i++) sim.do(sale([{ sku: YOGURT, qty: 1 }]))
    expect(sim.proposal(YOGURT).proposedQty).toBe(24)
    sim.do(approve('PRP-00001', 24))
    expect(sim.proposal(YOGURT)).toMatchObject({ proposedQty: 0, inTransit: 30, lastOrderQty: 24, status: 'AUTO_RELEASED' })
  })
})
