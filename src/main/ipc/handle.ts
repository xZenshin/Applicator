import { ipcMain } from 'electron'
import { wrap } from './wrap'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function handle(channel: string, fn: (...args: any[]) => Promise<unknown>): void {
  ipcMain.handle(channel, async (_event, ...args) => {
    const result = await wrap(() => fn(...args))
    if (!result.ok && result.error.kind === 'unknown') console.error(`[ipc ${channel}]`, result.error.message)
    return result
  })
}
