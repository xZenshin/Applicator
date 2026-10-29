import { join } from 'node:path'
import type { Settings } from '../../shared/types'

export function resolveDataDir(settings: Settings, documentsDir: string): string {
  return settings.dataDir || join(documentsDir, 'Applicator')
}
