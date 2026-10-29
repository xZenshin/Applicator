import { useCallback, useEffect, useRef, useState } from 'react'
import { errorMessage } from '../api'

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error'

/**
 * Debounced save of `value`. The first non-null value is treated as freshly loaded and not saved.
 * Saves run one after another; `flush()` saves a pending change right away.
 */
export function useAutosave<T>(
  value: T | null,
  save: (v: T) => Promise<unknown>,
  delayMs = 800
): { status: AutosaveStatus; error: string | null; flush(): Promise<void> } {
  const [status, setStatus] = useState<AutosaveStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const baseline = useRef<T | null>(null)
  const pending = useRef<T | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const chain = useRef<Promise<void>>(Promise.resolve())
  const saveRef = useRef(save)
  saveRef.current = save

  const flush = useCallback((): Promise<void> => {
    clearTimeout(timer.current)
    const v = pending.current
    if (v !== null) {
      pending.current = null
      setStatus('saving')
      chain.current = chain.current.then(async () => {
        try {
          await saveRef.current(v)
          setStatus('saved')
          setError(null)
        } catch (e) {
          setStatus('error')
          setError(errorMessage(e))
        }
      })
    }
    return chain.current
  }, [])

  useEffect(() => {
    if (value === null) return
    if (baseline.current === null) {
      baseline.current = value
      return
    }
    if (value === baseline.current) return
    pending.current = value
    clearTimeout(timer.current)
    timer.current = setTimeout(() => void flush(), delayMs)
  }, [value, delayMs, flush])

  useEffect(() => () => void flush(), [flush])

  return { status, error, flush }
}
