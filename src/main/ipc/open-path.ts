import { shell } from 'electron'
import { AppError } from '../../shared/errors'

/** Opens a file or folder with its default app. */
export async function openPath(path: string): Promise<void> {
  const error = await shell.openPath(path)
  if (error) throw new AppError('open_failed', `Could not open ${path}: ${error}`)
}
