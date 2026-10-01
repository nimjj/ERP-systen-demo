/**
 * Presenter panel (SPEC §11): scenario picker, step list with the current step
 * highlighted, Next / Back / Reset, Simulate sales and the Short-ship toggle.
 *
 * Next runs the step's action builders (the same ones the panes use); a step
 * done by clicking in a pane is detected the same way, so the panel follows
 * either path. Back undoes the current step's events in every window.
 */
import { useEffect, useMemo, useState } from 'react'
import { issueRecall, simulateSales } from '../actions'
import { demoTuning } from '../config/demoTuning'
import type { DemoEvent } from '../domain/types'
import { scenarios, type Scenario } from '../scenarios'
import { Avatar, initials } from './components'
import { ACTOR_NAME, describeEvent } from './describe'
import { usePresenter, type ScenarioRun } from './PresenterContext'
import { useAppState, useEventStore } from './StoreContext'

const ACTOR_LABEL = { jamal: 'Jamal', aisha: 'Aisha', emily: 'Emily', priya: 'Priya', presenter: 'Presenter' } as const

export function startRun(scenarioId: string, eventCount: number): ScenarioRun {
  return { scenarioId, step: 0, marks: [eventCount] }
}

export function Presenter() {
  const state = useAppState()
  const store = useEventStore()
  const { run, setRun, shortShip, setShortShip } = usePresenter()
  const [timelineOpen, setTimelineOpen] = useState(false)
  const scenario: Scenario | undefined = run ? scenarios[run.scenarioId] : undefined
  const events = state.events

  // Follow the scenario: advance when the current step is done, whichever way it was done.
  useEffect(() => {
    if (!run || !scenario || run.step >= scenario.steps.length) return
    const since = events.slice(run.marks[run.step] ?? events.length)
    if (scenario.steps[run.step].done(state, since)) {
      const step = run.step + 1
      setRun({ ...run, step, marks: [...run.marks.slice(0, step), events.length] })
      if (step === scenario.steps.length && scenario.timeline) setTimelineOpen(true)
    }
    // A reset elsewhere emptied the log: start the run again.
    if (events.length < (run.marks[run.step] ?? 0)) setRun(startRun(run.scenarioId, events.length))
  }, [events, run, scenario, setRun, state])

  function choose(id: string) {
    setTimelineOpen(false)
    setRun(id ? startRun(id, events.length) : null)
  }

  function next() {
    if (!run || !scenario || run.step >= scenario.steps.length) return
    const drafts = scenario.steps[run.step].next(store.getState(), { shortShip })
    for (const d of drafts) store.append(d)
  }

  function back() {
    if (!run || run.step === 0) return
    const step = run.step - 1
    store.truncate(run.marks[step])
    setTimelineOpen(false)
    setRun({ ...run, step, marks: run.marks.slice(0, step + 1) })
  }

  function reset() {
    setTimelineOpen(false)
    store.reset(run?.scenarioId)
    if (run) setRun(startRun(run.scenarioId, store.getState().events.length))
  }

  const finished = !!scenario && !!run && run.step >= scenario.steps.length
  const current = scenario && run && !finished ? scenario.steps[run.step] : undefined

  return (
    <aside className="presenter" aria-label="Presenter">
      <div className="presenter-head">
        <div className="presenter-title">Presenter</div>
        <select value={run?.scenarioId ?? ''} onChange={(e) => choose(e.target.value)} aria-label="Scenario">
          <option value="">Free play</option>
          {Object.entries(scenarios).map(([id, s]) => (
            <option key={id} value={id}>
              {s.title} (~{s.minutes} min)
            </option>
          ))}
        </select>
      </div>

      {scenario && run && (
        <>
          <ol className="steps">
            {scenario.steps.map((s, i) => (
              <li key={i} className={i < run.step ? 'step step-done' : i === run.step ? 'step step-current' : 'step'}>
                <span className="step-n">{i < run.step ? '✓' : i + 1}</span>
                <span className="step-text">
                  <span className="step-title">{s.title}</span>
                  {i === run.step && (
                    <>
                      <span className="step-how">
                        <b>Click:</b> {s.how}
                      </span>
                      <span className="step-watch">
                        <b>Watch:</b> {s.watch}
                      </span>
                    </>
                  )}
                </span>
                <span className={`step-actor actor-${s.actor}`}>{ACTOR_LABEL[s.actor]}</span>
              </li>
            ))}
            <li className={finished ? 'step step-current' : 'step'}>
              <span className="step-n">{finished ? '★' : scenario.steps.length + 1}</span>
              <span className="step-text">
                <span className="step-title">{scenario.timeline ? 'End card: the whole chain as one timeline' : 'Done'}</span>
              </span>
            </li>
          </ol>

          <div className="presenter-nav">
            <button className="btn btn-quiet" onClick={back} disabled={run.step === 0}>
              ‹ Back
            </button>
            {finished ? (
              scenario.timeline && (
                <button className="btn" onClick={() => setTimelineOpen(true)}>
                  Show timeline
                </button>
              )
            ) : (
              <button className="btn" onClick={next} title={current ? `Does: ${current.title}` : undefined}>
                Next ›
              </button>
            )}
            <button className="btn btn-quiet" onClick={reset}>
              Reset
            </button>
          </div>
          <p className="muted small">Next does the step for you. Clicking in the pane does exactly the same; the list follows either way. Back undoes the last step in every window.</p>
        </>
      )}

      {!scenario && (
        <div className="presenter-nav">
          <button className="btn btn-quiet" onClick={() => store.reset()}>
            Reset demo
          </button>
        </div>
      )}

      <div className="presenter-controls">
        <div className="presenter-sub">Controls</div>
        <button className="btn btn-amber btn-block" onClick={() => simulateSales(store.getState()).forEach((d) => store.append(d))}>
          Simulate {demoTuning.simulateSales.perClick} sales
        </button>
        {state.recalls
          .filter((r) => r.status === 'NOT_ISSUED')
          .map((r) => (
            <button key={r.id} className="btn btn-danger btn-block" onClick={() => store.append(issueRecall(r))}>
              Issue recall {r.id}
            </button>
          ))}
        <label className="toggle">
          <input type="checkbox" checked={shortShip} onChange={(e) => setShortShip(e.target.checked)} />
          <span>
            Short-ship deliveries <span className="muted small">(receive {demoTuning.shortShip.defaultExpected - demoTuning.shortShip.defaultReceived} fewer than ordered)</span>
          </span>
        </label>
      </div>

      {timelineOpen && scenario && run && <Timeline scenario={scenario} run={run} onClose={() => setTimelineOpen(false)} />}
    </aside>
  )
}

/** Depth of each event below its root, for indentation. */
function depthOf(byId: Map<string, DemoEvent>, e: DemoEvent): number {
  let d = 0
  let cur = e
  while (cur.causedBy && byId.has(cur.causedBy)) {
    cur = byId.get(cur.causedBy)!
    d++
  }
  return d
}

function Timeline({ scenario, run, onClose }: { scenario: Scenario; run: ScenarioRun; onClose: () => void }) {
  const state = useAppState()
  const events = state.events
  const byId = useMemo(() => new Map(events.map((e) => [e.id, e])), [events])
  const index = useMemo(() => new Map(events.map((e, i) => [e.id, i + 1])), [events])
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})
  const segments = scenario.steps.map((step, i) => ({ step, events: events.slice(run.marks[i], run.marks[i + 1] ?? events.length) }))
  const total = segments.reduce((n, s) => n + s.events.length, 0)

  return (
    <div className="overlay" role="dialog" aria-label="Scenario timeline">
      <div className="timeline">
        <div className="timeline-head">
          <div>
            <div className="timeline-title">{scenario.title}: one connected timeline</div>
            <div className="muted small">
              {scenario.steps.length} human actions → {total} events across four roles. Every reaction points back to the action that caused it.
            </div>
          </div>
          <button className="btn btn-quiet" onClick={onClose}>
            Close
          </button>
        </div>
        <ol className="timeline-steps">
          {segments.map(({ step, events: evs }, i) => {
            const roots = evs.filter((e) => !e.causedBy)
            const collapsible = roots.length > 2 && !expanded[i]
            const firstRootEnd = collapsible ? evs.findIndex((e, k) => k > 0 && !e.causedBy) : evs.length
            const shown = collapsible ? evs.slice(0, firstRootEnd) : evs
            return (
              <li key={i} className="tl-step">
                <div className="tl-step-head">
                  <span className="tl-n">{i + 1}</span>
                  {step.actor !== 'presenter' ? <Avatar actor={step.actor} label={initials(state.personas.find((p) => p.role === step.actor)!.name)} size="sm" /> : <span className="avatar avatar-sm avatar-system">P</span>}
                  <b>{step.title}</b>
                  <span className="muted small">
                    {evs.length} {evs.length === 1 ? 'event' : 'events'}
                  </span>
                </div>
                <ul className="tl-events">
                  {shown.map((e) => (
                    <li key={e.id} style={{ paddingLeft: depthOf(byId, e) * 18 }} className={e.causedBy ? 'tl-reaction' : 'tl-root'}>
                      <span className="stream-n">#{index.get(e.id)}</span>
                      <span className="tl-who">{e.causedBy ? '↳' : ACTOR_NAME[e.actor]}</span>
                      <span className="stream-type">{e.type}</span>
                      <span className="tl-desc">{describeEvent(state, e)}</span>
                    </li>
                  ))}
                  {collapsible && (
                    <li>
                      <button className="link" onClick={() => setExpanded({ ...expanded, [i]: true })}>
                        + {roots.length - 1} more actions ({evs.length - shown.length} events) — show all
                      </button>
                    </li>
                  )}
                </ul>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}
