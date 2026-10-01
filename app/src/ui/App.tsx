/**
 * Shell (SPEC §11): top bar with logo, layout switch, Simulate sales, Reset demo;
 * split view (2×2) or one role full screen (?role=jamal|aisha|emily|priya);
 * event stream drawer at the bottom.
 */
import { useEffect, useState } from 'react'
import { demoTuning } from '../config/demoTuning'
import type { Role } from '../domain/types'
import { priceBasket } from '../rules/engine/tillPricing'
import { EventStream } from './EventStream'
import { HandheldPane } from './panes/HandheldPane'
import { MarketingPane } from './panes/MarketingPane'
import { PlannerPane } from './panes/PlannerPane'
import { TillPane } from './panes/TillPane'
import { useAppState, useEventStore } from './StoreContext'

type Layout = 'split' | Role
const ROLES: Role[] = ['jamal', 'aisha', 'emily', 'priya']
const LABEL: Record<Layout, string> = { split: 'Split view', jamal: 'Jamal · Till', aisha: 'Aisha · Handheld', emily: 'Emily · Marketing', priya: 'Priya · Planner' }

function readLayout(): Layout {
  const role = new URLSearchParams(window.location.search).get('role')
  return (ROLES as string[]).includes(role ?? '') ? (role as Role) : 'split'
}

export function App() {
  const state = useAppState()
  const store = useEventStore()
  const [layout, setLayout] = useState<Layout>(readLayout)

  useEffect(() => {
    const url = new URL(window.location.href)
    if (layout === 'split') url.searchParams.delete('role')
    else url.searchParams.set('role', layout)
    window.history.replaceState(null, '', url)
  }, [layout])

  function simulateSales() {
    const sku = 'SKU-100221'
    for (let i = 0; i < demoTuning.simulateSales.perClick; i++) {
      const priced = priceBasket(store.getState(), [{ sku, qty: 1 }], null)
      store.append({
        type: 'SALE_COMPLETED',
        actor: 'jamal',
        payload: { txnId: `SIM-${Date.now().toString().slice(-5)}-${i + 1}`, memberId: null, lines: priced.saleLines, total: priced.total, tax: priced.tax, tender: 'Card' },
      })
    }
  }

  const pane = (role: Role, expand?: () => void) => {
    switch (role) {
      case 'jamal':
        return <TillPane onExpand={expand} />
      case 'aisha':
        return <HandheldPane onExpand={expand} />
      case 'emily':
        return <MarketingPane onExpand={expand} />
      case 'priya':
        return <PlannerPane onExpand={expand} />
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden="true">
            JH<span className="logo-dot" />
          </span>
          <div className="brand-text">
            <div className="brand-name">John Henry</div>
            <div className="brand-sub">SUPERMARKETS</div>
          </div>
          <div className="store-chip">
            <span className="store-label">STORE</span>
            <span>
              {state.store.name} #{state.store.number}
            </span>
          </div>
        </div>
        <nav className="layout-tabs" aria-label="Layout">
          {(['split', ...ROLES] as Layout[]).map((l) => (
            <button key={l} className={`tab ${layout === l ? 'tab-on' : ''}`} onClick={() => setLayout(l)}>
              {LABEL[l]}
            </button>
          ))}
        </nav>
        <div className="topbar-actions">
          <button className="btn btn-amber" onClick={simulateSales} title="Ten single-yogurt sales at the till">
            Simulate {demoTuning.simulateSales.perClick} sales
          </button>
          <button className="btn btn-ghost" onClick={() => store.reset()}>
            Reset demo
          </button>
        </div>
      </header>

      <main className={layout === 'split' ? 'split' : 'single'}>
        {layout === 'split' ? ROLES.map((r) => <div key={r}>{pane(r, () => setLayout(r))}</div>) : pane(layout)}
      </main>

      <EventStream />
    </div>
  )
}
