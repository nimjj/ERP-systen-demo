/**
 * C5 (P0) Priya → Aisha. Approving an order creates an in-transit inbound for the
 * approved quantity and a "Receive delivery" task on Aisha's handheld.
 */
import type { DemoEvent, Rule } from '../domain/types'
import { nextInboundId } from './engine/ids'
import { notify } from './notify'

export const c5ApprovalCreatesReceipt: Rule = {
  id: 'C5-approval-creates-receipt',
  on: ['ORDER_APPROVED'],
  run(state, event) {
    const { proposalId, qty } = (event as DemoEvent<'ORDER_APPROVED'>).payload
    const p = state.proposals.find((x) => x.id === proposalId)
    if (!p || qty <= 0) return { state, newEvents: [] }
    const inboundId = nextInboundId(state, p.id)
    const cases = qty / p.casePack
    const amount = Number.isInteger(cases) ? `${cases} ${cases === 1 ? 'case' : 'cases'} (${qty} units)` : `${qty} units`
    return {
      state,
      newEvents: [
        { type: 'INBOUND_CREATED', actor: 'system', payload: { inboundId, sku: p.itemId, qty, eta: p.deliveryDate } },
        {
          type: 'TASK_CREATED',
          actor: 'system',
          payload: { taskId: `task-${inboundId}`, kind: 'RECEIVE', title: `Receive delivery: ${p.itemName}`, detail: `${amount} from ${p.source}`, ref: inboundId },
        },
        notify('aisha', `New delivery to receive: ${amount} of ${p.itemName}.`, 'info', `task:task-${inboundId}`),
      ],
    }
  },
}
