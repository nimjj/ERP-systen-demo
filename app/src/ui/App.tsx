/**
 * Shell (SPEC §11): top bar with logo, layout switch, Simulate sales, Reset demo;
 * split view (2×2) or one role full screen (?role=jamal|aisha|emily|priya);
 * event stream drawer at the bottom.
 */
import { useEffect, useState } from 'react'
import { demoTuning } from '../config/demoTuning'
import type { Role } from '../domain/types'
import { simulateSales } from '../actions'
import { EventStream } from './EventStream'
import { HandheldPane } from './panes/HandheldPane'
import { MarketingPane } from './panes/MarketingPane'
import { PlannerPane } from './panes/PlannerPane'
import { TillPane } from './panes/TillPane'
import { Presenter } from './Presenter'
import { usePresenter } from './PresenterContext'
import { scenarios } from '../scenarios'
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
  const presenter = usePresenter()
  // The pane of whoever acts in the current scenario step gets a highlight ring.
  const run = presenter.run
  const scenario = run && presenter.open ? scenarios[run.scenarioId] : undefined
  const cue = scenario && run ? scenario.steps[run.step]?.actor : undefined
  // Story caption: the current step while a scenario runs, otherwise the client's tagline.
  const caption =
    scenario && run ? (
      run.step < scenario.steps.length ? (
        <>
          <b>{scenario.title}</b> Step {run.step + 1} of {scenario.steps.length}: {scenario.steps[run.step].title}
        </>
      ) : (
        <>
          <b>{scenario.title}</b> Complete
        </>
      )
    ) : (
      'Your neighborhood store with a global spirit.'
    )

  useEffect(() => {
    const url = new URL(window.location.href)
    if (layout === 'split') url.searchParams.delete('role')
    else url.searchParams.set('role', layout)
    window.history.replaceState(null, '', url)
  }, [layout])

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
      <div className="announce" role="status">
        {caption}
      </div>
      <header className="topbar">
        <div className="brand">
          <img className="brand-logo" src={`${import.meta.env.BASE_URL}brand/logo.png`} alt="SPAR" />
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
          <button className="btn btn-amber" onClick={() => simulateSales(store.getState()).forEach((d) => store.append(d))} title="Ten single-yogurt sales at the till">
            Simulate {demoTuning.simulateSales.perClick} sales
          </button>
          <button className="btn btn-ghost" onClick={() => store.reset()}>
            Reset demo
          </button>
          <button className={`btn ${presenter.open ? 'btn-light' : 'btn-ghost'}`} onClick={() => presenter.setOpen(!presenter.open)} aria-pressed={presenter.open}>
            Presenter
          </button>
        </div>
      </header>

      <div className="workspace">
        <main className={layout === 'split' ? 'split' : 'single'}>
          {layout === 'split' ? (
            ROLES.map((r) => (
              <div key={r} className={cue === r ? 'cue' : undefined}>
                {pane(r, () => setLayout(r))}
              </div>
            ))
          ) : (
            <div className={`single-wrap ${cue === layout ? 'cue' : ''}`}>{pane(layout)}</div>
          )}
        </main>
        {presenter.open && <Presenter />}
      </div>

      <EventStream />
    </div>
  )
}
