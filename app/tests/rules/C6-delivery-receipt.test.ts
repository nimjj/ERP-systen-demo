import { describe, expect, it } from 'vitest'
import { c6DeliveryReceipt as rule } from '../../src/rules/c6DeliveryReceipt'
import { afterReducer, receive, YOGURT } from '../helpers'

const ASN_YOGURT = 'ASN-US-778134:SKU-100221'

describe('C6 delivery receipt', () => {
  it('short: stock up by received into the back room, one claim, notification to Priya', () => {
    const { state, event } = afterReducer(receive(ASN_YOGURT, 6, 4))
    const out = rule.run(state, event)
    expect(out.newEvents.map((e) => e.type)).toEqual(['STOCK_CHANGED', 'CLAIM_RAISED', 'NOTIFICATION_ADDED'])
    expect(out.newEvents[0].payload).toEqual({ sku: YOGURT, delta: 4, reason: 'DC_RECEIPT', onHand: 21, shelf: 9, backRoom: 12 })
    expect(out.newEvents[1].payload).toEqual({ claimId: 'CLM-5223', supplierId: 'SUP-PRAIRIE', sku: YOGURT, shortQty: 2, value: 8.34, inboundId: ASN_YOGURT })
  })

  it('full: stock only, no claim', () => {
    const { state, event } = afterReducer(receive(ASN_YOGURT, 6, 6))
    expect(rule.run(state, event).newEvents.map((e) => e.type)).toEqual(['STOCK_CHANGED'])
  })

  it('nothing arrived: claim for the whole quantity, no stock event', () => {
    const { state, event } = afterReducer(receive(ASN_YOGURT, 6, 0))
    expect(rule.run(state, event).newEvents.map((e) => e.type)).toEqual(['CLAIM_RAISED', 'NOTIFICATION_ADDED'])
  })

  it('closes the open RECEIVE task for that inbound', () => {
    const start = afterReducer({ type: 'TASK_CREATED', actor: 'system', payload: { taskId: 'task-x', kind: 'RECEIVE', title: 'Receive', detail: '', ref: ASN_YOGURT } }).state
    const { state, event } = afterReducer(receive(ASN_YOGURT, 6, 6), start)
    expect(rule.run(state, event).newEvents.at(-1)).toEqual({ type: 'TASK_COMPLETED', actor: 'system', payload: { taskId: 'task-x', kind: 'RECEIVE' } })
  })
})
