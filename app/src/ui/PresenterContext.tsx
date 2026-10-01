/**
 * Presenter settings for this window: panel open, Short-ship toggle, and the
 * scenario run (current step and where each step started in the log).
 * View state only, never shared data; kept in localStorage so a refresh keeps it.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export interface ScenarioRun {
  scenarioId: string
  step: number
  /** marks[i] = event-log length when step i started. */
  marks: number[]
}

interface PresenterSettings {
  open: boolean
  setOpen: (v: boolean) => void
  shortShip: boolean
  setShortShip: (v: boolean) => void
  run: ScenarioRun | null
  setRun: (r: ScenarioRun | null) => void
}

const KEY = 'jh-connected-demo:presenter'
const Ctx = createContext<PresenterSettings | null>(null)

function load(): Partial<Pick<PresenterSettings, 'open' | 'shortShip' | 'run'>> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}')
  } catch {
    return {}
  }
}

export function PresenterProvider({ children, initialRun }: { children: ReactNode; initialRun?: ScenarioRun | null }) {
  const saved = load()
  const [open, setOpen] = useState<boolean>(initialRun ? true : (saved.open ?? false))
  const [shortShip, setShortShip] = useState<boolean>(saved.shortShip ?? true)
  const [run, setRun] = useState<ScenarioRun | null>(initialRun ?? saved.run ?? null)
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ open, shortShip, run }))
    } catch {
      // storage blocked: settings just won't survive a refresh
    }
  }, [open, shortShip, run])
  return <Ctx.Provider value={{ open, setOpen, shortShip, setShortShip, run, setRun }}>{children}</Ctx.Provider>
}

export function usePresenter(): PresenterSettings {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('usePresenter must be used inside <PresenterProvider>')
  return ctx
}
