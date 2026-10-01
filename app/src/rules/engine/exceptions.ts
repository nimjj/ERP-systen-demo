/**
 * Proposal exceptions (SPEC §5.2 as overridden by §13.3). Four codes are
 * computed live; the other three (LARGE_DEVIATION, LOW_CONFIDENCE, NEAR_EXPIRY)
 * are kept from the data unchanged.
 */
import { demoTuning } from '../../config/demoTuning'
import type { AppState, ExceptionCode, Position, Proposal, ProposalException, ProposalStatus } from '../../domain/types'
import type { UpliftSource } from './uplift'

export const LIVE_CODES: readonly ExceptionCode[] = ['PHANTOM_SUSPECTED', 'PROMO_UPLIFT', 'SUPPLIER_CONSTRAINT', 'SHELF_CAPACITY']
const OPEN_CLAIM_STATUSES = ['Draft', 'Submitted', 'Acknowledged', 'Disputed']

export interface ExceptionContext {
  state: AppState
  proposal: Proposal
  position: Position | undefined
  onHand: number
  qty: number
  qtyNoUplift: number
  uplift: number
  sources: UpliftSource[]
}

const existing = (p: Proposal, code: ExceptionCode) => p.exceptions.find((e) => e.code === code)

/** PHANTOM_SUSPECTED signal: P(no sales | expected) = exp(−expected) below the threshold. */
export function phantomSignal(proposal: Proposal, position: Position | undefined): { expected: number; p: number } | null {
  const signal = demoTuning.phantomSignals[proposal.itemId]
  if (!signal || position?.flags.includes('PHANTOM_CORRECTED')) return null
  const expected = (proposal.dailyForecast * signal.hoursWithoutSale) / 24
  const p = Math.exp(-expected)
  return p < demoTuning.phantomPThreshold ? { expected, p } : null
}

export function openDemoClaims(state: AppState, supplierId: string) {
  return state.claims.filter(
    (c) => c.supplierId === supplierId && OPEN_CLAIM_STATUSES.includes(c.status) && (c.raisedInDemo || demoTuning.supplierConstraintFromSeedClaims),
  )
}

export function computeExceptions(ctx: ExceptionContext): ProposalException[] {
  const { state, proposal: p, position, onHand, qty, qtyNoUplift, uplift, sources } = ctx
  const out: ProposalException[] = []

  const phantom = phantomSignal(p, position)
  if (phantom) {
    out.push(
      existing(p, 'PHANTOM_SUSPECTED') ?? {
        code: 'PHANTOM_SUSPECTED',
        label: 'Possible phantom stock',
        severity: 'high',
        explanation: `System shows ${onHand} on hand, but there have been no sales for ${demoTuning.phantomSignals[p.itemId].hoursWithoutSale} hours where ${Math.round(phantom.expected)} were expected (p < 0.01). The shelf may be empty. A count task has been sent to the store.`,
      },
    )
  }

  if (uplift > 0 && qty > qtyNoUplift) {
    const top = [...sources].sort((a, b) => b.uplift - a.uplift)[0]
    out.push({
      code: 'PROMO_UPLIFT',
      label: 'Promotion build-up',
      severity: 'high',
      explanation: `${top.id} (${top.name}) is live. Forecast uplift is about ${Math.round(uplift * 100)}%, so the order rises from ${qtyNoUplift} to ${qty} units.`,
    })
  } else if (p.prebuild > 0) {
    out.push(
      existing(p, 'PROMO_UPLIFT') ?? {
        code: 'PROMO_UPLIFT',
        label: 'Promotion build-up',
        severity: 'high',
        explanation: `Pre-build of ${p.prebuild} units is added for an upcoming promotion.`,
      },
    )
  }

  const claims = openDemoClaims(state, p.supplierId)
  if (claims.length > 0) {
    const c = claims[claims.length - 1]
    out.push({
      code: 'SUPPLIER_CONSTRAINT',
      label: 'Supplier short-shipping',
      severity: 'medium',
      explanation: `${p.supplierName} short-shipped ${c.itemName} (claim ${c.id}, ${c.shortQty ?? c.qtyCases} units). Check the next delivery before relying on it.`,
    })
  }

  if (qty + onHand > p.shelfCapacity) {
    out.push({
      code: 'SHELF_CAPACITY',
      label: 'Exceeds shelf capacity',
      severity: 'low',
      explanation: `Proposed quantity plus stock on hand (${qty + onHand}) exceeds shelf capacity (${p.shelfCapacity}). Excess would sit in the back room.`,
    })
  }

  for (const e of p.exceptions) if (!LIVE_CODES.includes(e.code)) out.push(e)
  return out
}

/** §5.2 + §13.3: no exception and qty within tolerance of the last order → auto-released. Recall/hold statuses stick. */
export function computeStatus(current: ProposalStatus, exceptions: ProposalException[], qty: number, lastOrderQty: number): ProposalStatus {
  if (current === 'BLOCKED' || current === 'HELD') return current
  if (exceptions.length > 0) return 'PENDING_REVIEW'
  return qty <= lastOrderQty * (1 + demoTuning.autoReleaseTolerance) ? 'AUTO_RELEASED' : 'PENDING_REVIEW'
}
