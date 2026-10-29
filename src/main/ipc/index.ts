import { registerLlmIpc } from './llm'
import { registerProfileIpc } from './profile'
import { registerSettingsIpc } from './settings'
import { registerStyleIpc } from './style'

export function registerIpc(): void {
  registerSettingsIpc()
  registerProfileIpc()
  registerStyleIpc()
  registerLlmIpc()
}
