import { contextBridge } from 'electron'

// The typed window.api bridge is filled in as IPC handlers are added.
const api = {}

contextBridge.exposeInMainWorld('api', api)
