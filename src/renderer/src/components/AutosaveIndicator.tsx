import { Text } from '@mantine/core'
import type { AutosaveStatus } from '../hooks/useAutosave'

export function AutosaveIndicator(props: { status: AutosaveStatus; error: string | null }): React.JSX.Element | null {
  if (props.status === 'error') {
    return (
      <Text size="sm" c="red">
        Not saved: {props.error}
      </Text>
    )
  }
  if (props.status === 'idle') return null
  return (
    <Text size="sm" c="dimmed">
      {props.status === 'saving' ? 'Saving…' : 'Saved'}
    </Text>
  )
}
