/** Emily — loyalty & marketing: offers with live counters, stock-risk banner, campaigns, promotions with the stock-check gate. */
import { pauseOffer, publishOffer, publishPromo, submitPromo } from '../../actions'
import { demoTuning } from '../../config/demoTuning'
import type { Offer, Promo } from '../../domain/types'
import { canPublishPromo } from '../../rules/engine/promoStockCheck'
import { coverDays } from '../../rules/engine/stockRisk'
import { Chip, Flash, money, num, PaneFrame } from '../components'
import { MarketingRecallCard } from '../RecallViews'
import { useAppState, useEventStore } from '../StoreContext'

const STATUS_TONE: Record<string, 'green' | 'amber' | 'neutral' | 'blue' | 'red'> = {
  Live: 'green',
  Published: 'blue',
  Approved: 'blue',
  'In approval': 'amber',
  Draft: 'neutral',
  Paused: 'amber',
  Ended: 'neutral',
}
const GATE_TONE = { Pass: 'green', Warn: 'amber', Fail: 'red' } as const
/** Promotions that still need a decision first, finished ones last. */
const PROMO_ORDER: Record<string, number> = { 'In approval': 0, Approved: 0, Published: 1, Live: 2, Ended: 3 }

function OfferCard({ offer }: { offer: Offer }) {
  const store = useEventStore()
  const live = offer.status === 'Live'
  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="card-title">{offer.name}</div>
          <div className="muted small">
            {offer.id} · {offer.mechanic} · funded by {offer.fundedBy} ({offer.fundingPct}%) · {offer.audience}
          </div>
        </div>
        <Flash value={offer.status}>
          <Chip tone={STATUS_TONE[offer.status] ?? 'neutral'}>{offer.status}</Chip>
        </Flash>
      </div>
      <div className="metrics">
        <div>
          <span className="label">Redeemed</span>
          <Flash value={offer.redeemed} className="metric">
            {num(offer.redeemed)}
          </Flash>
        </div>
        <div>
          <span className="label">Incremental sales</span>
          <Flash value={offer.incrementalSalesUsd} className="metric">
            {money(offer.incrementalSalesUsd)}
          </Flash>
        </div>
        <div>
          <span className="label">Supplier funded</span>
          <Flash value={offer.vendorPaidUsd} className="metric">
            {money(offer.vendorPaidUsd)}
          </Flash>
        </div>
        <div>
          <span className="label">Targeted</span>
          <span className="metric">{num(offer.targeted)}</span>
        </div>
      </div>
      <div className="card-actions">
        {live ? (
          <button className="btn btn-quiet" onClick={() => store.append(pauseOffer(offer))}>
            Pause offer
          </button>
        ) : (
          <button className="btn" onClick={() => store.append(publishOffer(offer))}>
            Publish to {offer.storeIds.length === 1 ? 'Plano Market' : `${offer.storeIds.length} stores`}
          </button>
        )}
      </div>
    </div>
  )
}

function PromoRow({ promo }: { promo: Promo }) {
  const state = useAppState()
  const store = useEventStore()
  const gate = promo.gate
  const result = gate?.status ?? promo.stockCheck.result
  const canPublish = canPublishPromo(state, promo.id)
  const ended = promo.status === 'Ended'
  const published = promo.status === 'Live' || promo.status === 'Published'
  return (
    <tr>
      <td>
        <div className="cell-main">{promo.name}</div>
        <div className="muted small">
          {promo.id} · {promo.mechanic} · {promo.start} → {promo.end}
        </div>
        {promo.recallFlags?.map((f) => (
          <Chip key={f.recallId + f.sku} tone="red">
            Recall {f.recallId}: {f.itemName} removed
          </Chip>
        ))}
      </td>
      <td>
        <Flash value={promo.status}>
          <Chip tone={STATUS_TONE[promo.status] ?? 'neutral'}>{promo.status}</Chip>
        </Flash>
      </td>
      <td>
        <Flash value={result + (gate?.coveragePct ?? '')}>
          <Chip tone={GATE_TONE[result]} title={gate ? `Supply ${num(gate.supply)} vs demand ${num(gate.demand)} per week` : promo.stockCheck.detail}>
            {result}
            {gate ? ` · ${gate.coveragePct}%` : ''}
          </Chip>
        </Flash>
      </td>
      <td className="actions">
        {!ended && (
          <button className="btn btn-quiet btn-sm" onClick={() => store.append(submitPromo(promo.id))}>
            Stock check
          </button>
        )}
        {!ended && !published && (
          <button
            className="btn btn-sm"
            disabled={!canPublish}
            title={canPublish ? undefined : 'Blocked: the stock check failed'}
            onClick={() => store.append(publishPromo(promo.id))}
          >
            Publish
          </button>
        )}
      </td>
    </tr>
  )
}

export function MarketingPane({ onExpand }: { onExpand?: () => void }) {
  const state = useAppState()
  const store = useEventStore()
  return (
    <PaneFrame role="emily" onExpand={onExpand}>
      {state.stockRisks.map((r) => {
        const offer = state.offers.find((o) => o.id === r.offerId)!
        const cover = Math.floor(coverDays(state, r.sku) * 100) / 100
        return (
          <div key={r.offerId + r.sku} className="banner banner-amber">
            <span>
              <b>Stock risk on {r.offerId}:</b> {state.positions[r.sku]?.name} has <Flash value={cover}>{cover.toFixed(2)}</Flash> days of cover at {state.store.name} (alert below {demoTuning.riskCoverDays.toFixed(1)}).
            </span>
            <button className="btn btn-sm" onClick={() => store.append(pauseOffer(offer))}>
              Pause offer
            </button>
          </div>
        )
      })}

      <MarketingRecallCard />

      <h4 className="section">Offers</h4>
      {state.offers.map((o) => (
        <OfferCard key={o.id} offer={o} />
      ))}

      <h4 className="section">Promotions</h4>
      <table className="table">
        <thead>
          <tr>
            <th>Promotion</th>
            <th>Status</th>
            <th>Stock check</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {[...state.promos.promotions]
            .sort((a, b) => (PROMO_ORDER[a.status] ?? 1) - (PROMO_ORDER[b.status] ?? 1))
            .map((p) => (
              <PromoRow key={p.id} promo={p} />
            ))}
        </tbody>
      </table>
      <h4 className="section">Campaigns</h4>
      <table className="table">
        <thead>
          <tr>
            <th>Campaign</th>
            <th>Channel</th>
            <th>Audience</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {state.campaigns.map((c) => (
            <tr key={c.id}>
              <td>
                <div className="cell-main">{c.name}</div>
                <div className="muted small">
                  {c.id} · {c.segmentName}
                </div>
              </td>
              <td>{c.channel}</td>
              <td>{num(c.audience)}</td>
              <td>
                <Chip tone={STATUS_TONE[c.status] ?? 'neutral'}>{c.status}</Chip>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

    </PaneFrame>
  )
}
