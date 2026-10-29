import type { IpcResult } from '../../shared/api'
import { AppError } from '../../shared/errors'

/** Turns a handler's result or error into an IpcResult the renderer can unwrap. */
export async function wrap<T>(fn: () => Promise<T>): Promise<IpcResult<T>> {
  try {
    return { ok: true, value: await fn() }
  } catch (e) {
    if (e instanceof AppError) return { ok: false, error: { kind: e.kind, message: e.message } }
    return { ok: false, error: { kind: 'unknown', message: e instanceof Error ? e.message : String(e) } }
  }
}
