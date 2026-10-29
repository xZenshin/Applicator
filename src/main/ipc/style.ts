import type { Style } from '../../shared/types'
import { getDataDir } from '../context'
import { loadStyle, saveStyle } from '../storage/style'
import { handle } from './handle'

export function registerStyleIpc(): void {
  handle('style:get', async () => loadStyle(await getDataDir()))
  handle('style:save', async (style: Style) => saveStyle(await getDataDir(), style))
}
