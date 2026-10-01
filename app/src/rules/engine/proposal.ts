/**
 * Live proposal for one SKU from current state, and the PROPOSAL_RECOMPUTED
 * drafts for the SKUs whose proposal changed (C4).
 */
import type { AppState, EventDraft, Proposal, ProposalException, ProposalStatus } from '../../domain/types'
import { computeExceptions, computeStatus } from './exceptions'
import { orderQty, orderUpToLevel, type OrderUpToInput } from './orderUpTo'
import { upliftSources } from './uplift'

export interface ComputedProposal {
  qty: number
  qtyNoUplift: number
  orderUpTo: number
  onHand: number
  inTransit: number
  uplift: number
  effectiveDaily: number
  daysOfCover: number
  exceptions: ProposalException[]
  status: ProposalStatus
}

const round1 = (n: number) => Math.round(n * 10) / 10

export function inTransitFor(state: AppState, sku: string): number {
  return state.inbound.filter((i) => i.sku === sku && i.status === 'IN_TRANSIT').reduce((sum, i) => sum + i.expectedQty, 0)
}

export function computeProposal(state: AppState, p: Proposal): ComputedProposal {
  const position = state.positions[p.itemId]
  const onHand = position?.onHand ?? p.onHand
  const inTransit = inTransitFor(state, p.itemId)
  const sources = upliftSources(state, p.itemId)
  const uplift = sources.reduce((max, s) => Math.max(max, s.uplift), 0)
  const input: OrderUpToInput = {
    demandOverExposure: p.demandOverExposure,
    safetyStock: p.safetyStock,
    onHand,
    inTransit,
    onOrder: p.onOrder,
    prebuild: p.prebuild,
    casePack: p.casePack,
    uplift,
    seedAdjustment: p.seedAdjustment,
  }
  const qty = orderQty(input)
  const qtyNoUplift = orderQty({ ...input, uplift: 0 })
  const daily = p.dailyForecast * (1 + uplift)
  const exceptions = computeExceptions({ state, proposal: p, position, onHand, qty, qtyNoUplift, uplift, sources })
  return {
    qty,
    qtyNoUplift,
    orderUpTo: orderUpToLevel(input),
    onHand,
    inTransit,
    uplift,
    effectiveDaily: round1(daily),
    daysOfCover: daily > 0 ? round1(onHand / daily) : 0,
    exceptions,
    status: computeStatus(p.status, exceptions, qty, p.lastOrderQty),
  }
}

const codes = (list: ProposalException[]) => list.map((e) => `${e.code}:${e.explanation}`).join('|')

/** PROPOSAL_RECOMPUTED for each listed SKU whose live proposal differs from the stored one. */
export function recomputeDrafts(state: AppState, skus: readonly string[]): EventDraft[] {
  const drafts: EventDraft[] = []
  for (const p of state.proposals) {
    if (!skus.includes(p.itemId)) continue
    const c = computeProposal(state, p)
    const changed =
      c.qty !== p.proposedQty ||
      c.status !== p.status ||
      codes(c.exceptions) !== codes(p.exceptions) ||
      c.onHand !== p.onHand ||
      c.inTransit !== p.inTransit ||
      c.orderUpTo !== p.orderUpTo ||
      c.uplift !== p.uplift
    if (!changed) continue
    drafts.push({
      type: 'PROPOSAL_RECOMPUTED',
      actor: 'system',
      payload: {
        proposalId: p.id,
        sku: p.itemId,
        oldQty: p.proposedQty,
        newQty: c.qty,
        exceptions: c.exceptions,
        status: c.status,
        onHand: c.onHand,
        inTransit: c.inTransit,
        orderUpTo: c.orderUpTo,
        uplift: c.uplift,
        effectiveDaily: c.effectiveDaily,
        daysOfCover: c.daysOfCover,
      },
    })
  }
  return drafts
}
