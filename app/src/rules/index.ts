/**
 * Reaction rule registry. One file per rule in this folder (SPEC §5); each is a
 * pure `(state, event) => { state, newEvents }`. Order matters only for the
 * order of sibling events in the log.
 * Every rule registered here is automatically covered by the purity test (A15).
 */
import type { Rule } from '../domain/types'
import { c1TillRuleFromOffer } from './c1TillRuleFromOffer'
import { c2OfferUplift } from './c2OfferUplift'
import { c3SaleDepletesStock } from './c3SaleDepletesStock'
import { c4RecomputeProposal } from './c4RecomputeProposal'
import { c5ApprovalCreatesReceipt } from './c5ApprovalCreatesReceipt'
import { c6DeliveryReceipt } from './c6DeliveryReceipt'
import { c7MemberPoints } from './c7MemberPoints'
import { c8PromoStockGate } from './c8PromoStockGate'
import { c9StockRisk } from './c9StockRisk'

export const rules: readonly Rule[] = [
  c1TillRuleFromOffer,
  c2OfferUplift,
  c3SaleDepletesStock,
  c7MemberPoints,
  c4RecomputeProposal,
  c5ApprovalCreatesReceipt,
  c6DeliveryReceipt,
  c8PromoStockGate,
  c9StockRisk,
]
