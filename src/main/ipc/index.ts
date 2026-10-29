import { registerProfileIpc } from './profile'
import { registerSettingsIpc } from './settings'

export function registerIpc(): void {
  registerSettingsIpc()
  registerProfileIpc()
}
