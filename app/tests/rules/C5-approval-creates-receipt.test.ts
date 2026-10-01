import { describe, expect, it } from 'vitest'
import { c5ApprovalCreatesReceipt as rule } from '../../src/rules/c5ApprovalCreatesReceipt'
import { afterReducer, approve } from '../helpers'

describe('C5 approval creates receipt', () => {
  it('INBOUND_CREATED + TASK_CREATED (RECEIVE) + notification to Aisha, with deterministic ids', () => {
    const { state, event } = afterReducer(approve('PRP-00001', 12))
    const out = rule.run(state, event)
    expect(out.newEvents.map((e) => e.type)).toEqual(['INBOUND_CREATED', 'TASK_CREATED', 'NOTIFICATION_ADDED'])
    expect(out.newEvents[0].payload).toEqual({ inboundId: 'IN-PRP-00001-1', sku: 'SKU-100221', qty: 12, eta: '2026-09-29' })
    expect(out.newEvents[1].payload).toMatchObject({ taskId: 'task-IN-PRP-00001-1', kind: 'RECEIVE', ref: 'IN-PRP-00001-1', detail: '2 cases (12 units) from Temple TX Perishables DC' })
  })

  it('approving zero creates nothing', () => {
    const { state, event } = afterReducer(approve('PRP-00010', 0))
    expect(rule.run(state, event).newEvents).toEqual([])
  })
})
