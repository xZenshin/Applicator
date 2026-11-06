import { contextBridge, ipcRenderer } from 'electron'
import { ALL_CHANNELS, BUSY_CHANNEL, PROGRESS_CHANNEL, type Bridge, type GenerationStage } from '../shared/api'

const allowed = new Set(ALL_CHANNELS)

// Only results cross the bridge: Errors lose custom fields like `kind` there,
// so renderer/src/api.ts unwraps the IpcResult and throws on its side.
const bridge: Bridge = {
  invoke: (channel, ...args) => {
    if (!allowed.has(channel)) return Promise.reject(new Error(`Unknown channel ${channel}`))
    return ipcRenderer.invoke(channel, ...args)
  },
  onProgress: (cb) => {
    const listener = (_event: unknown, stage: GenerationStage): void => cb(stage)
    ipcRenderer.on(PROGRESS_CHANNEL, listener)
    return () => {
      ipcRenderer.removeListener(PROGRESS_CHANNEL, listener)
    }
  },
  onBusy: (cb) => {
    const listener = (_event: unknown, busy: boolean): void => cb(busy)
    ipcRenderer.on(BUSY_CHANNEL, listener)
    return () => {
      ipcRenderer.removeListener(BUSY_CHANNEL, listener)
    }
  }
}

contextBridge.exposeInMainWorld('bridge', bridge)
