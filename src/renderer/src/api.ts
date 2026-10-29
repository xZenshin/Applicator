import { CHANNELS, type Api, type IpcResult } from '../../shared/api'

/** An error from the main process; `kind` identifies the case (e.g. "usage_limit", "cancelled"). */
export class ApiError extends Error {
  constructor(
    readonly kind: string,
    message: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

function unwrap<T>(result: IpcResult<T>): T {
  if (result.ok) return result.value
  throw new ApiError(result.error.kind, result.error.message)
}

function buildApi(): Api {
  const groups: Record<string, Record<string, unknown>> = {}
  for (const [group, methods] of Object.entries(CHANNELS)) {
    groups[group] = Object.fromEntries(
      methods.map((method) => [
        method,
        async (...args: unknown[]) => unwrap(await window.bridge.invoke(`${group}:${method}`, ...args))
      ])
    )
  }
  groups.llm.onProgress = window.bridge.onProgress
  return groups as unknown as Api
}

export const api = buildApi()

export const errorMessage = (e: unknown): string => (e instanceof Error ? e.message : String(e))
export const errorKind = (e: unknown): string | null => (e instanceof ApiError ? e.kind : null)
