import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ClaudeStatus } from '../../../shared/api'
import { api, errorMessage } from '../api'

interface StatusContext {
  /** null until the first check has answered. */
  status: ClaudeStatus | null
  /** True while Claude is generating or revising. */
  busy: boolean
  refresh: () => void
}

const Context = createContext<StatusContext>({ status: null, busy: false, refresh: () => {} })

/** Checks Claude when the app starts, after each generation or revision, and when Settings asks (a new claude.exe). */
export function ClaudeStatusProvider(props: { children: React.ReactNode }): React.JSX.Element {
  const [status, setStatus] = useState<ClaudeStatus | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(() => {
    api.settings.claudeStatus().then(setStatus, (e) => setStatus({ ok: false, label: 'Claude unavailable', detail: errorMessage(e) }))
  }, [])

  useEffect(() => {
    refresh()
    return api.llm.onBusy((b) => {
      setBusy(b)
      if (!b) refresh()
    })
  }, [refresh])

  return <Context.Provider value={{ status, busy, refresh }}>{props.children}</Context.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useClaudeStatus = (): StatusContext => useContext(Context)
