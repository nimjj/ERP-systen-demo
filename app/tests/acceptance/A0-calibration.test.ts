/** A0 — Engine reproduces proposedQty for all AUTO_RELEASED lines (calibration gate). */
import { describe, expect, it } from 'vitest'
import type { Proposal } from '../../src/domain/types'
import { computeProposal, recomputeDrafts } from '../../src/rules/engine/proposal'
import { orderQty } from '../../src/rules/engine/orderUpTo'
import { buildSeedState } from '../../src/seed/loadSeed'
import referenceProposals from '../../../reference/mock/proposals.json'

const network = referenceProposals as unknown as Proposal[]
const auto = network.filter((p) => p.status === 'AUTO_RELEASED')

describe('A0 calibration', () => {
  it('reference data has 276 AUTO_RELEASED lines', () => {
    expect(auto).toHaveLength(276)
  })

  it('engine reproduces proposedQty for 276/276 AUTO_RELEASED lines across the network', () => {
    const misses = auto
      .map((p) => ({ id: p.id, want: p.proposedQty, got: orderQty({ ...p, uplift: 0 }) }))
      .filter((r) => r.got !== r.want)
    expect(misses).toEqual([])
  })

  it('with zero uplift the engine order-up-to level equals the stored orderUpTo (330/330)', () => {
    for (const p of network) expect(p.demandOverExposure + p.safetyStock, p.id).toBe(p.orderUpTo)
  })

  it('engine reproduces every seed proposal from live state: qty, exceptions and status', () => {
    const seed = buildSeedState()
    for (const p of seed.proposals) {
      const c = computeProposal(seed, p)
      expect([p.id, c.qty, c.exceptions.map((e) => e.code), c.status]).toEqual([p.id, p.proposedQty, p.exceptions.map((e) => e.code), p.status])
      expect(c.onHand, p.id).toBe(p.onHand)
      expect(c.inTransit, p.id).toBe(p.inTransit)
    }
  })

  it('recomputing the seed changes nothing (no spurious events at start)', () => {
    const seed = buildSeedState()
    const drafts = recomputeDrafts(
      seed,
      seed.proposals.map((p) => p.itemId),
    )
    expect(drafts.filter((d) => d.type === 'PROPOSAL_RECOMPUTED' && (d.payload.newQty !== d.payload.oldQty || d.payload.status !== seed.proposals.find((p) => p.id === d.payload.proposalId)!.status))).toEqual([])
  })
})
