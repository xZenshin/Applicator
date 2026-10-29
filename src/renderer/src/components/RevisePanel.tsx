import { Alert, Button, Group, Loader, Text, TextInput } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useState } from 'react'
import { api, errorKind, errorMessage } from '../api'

/** "Tell Claude what to change" box with Revise, Undo and Cancel. */
export function RevisePanel(props: {
  onRevise: (instruction: string) => Promise<void>
  canUndo: boolean
  onUndo: () => void
}): React.JSX.Element {
  const [instruction, setInstruction] = useState('')
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const revise = async (): Promise<void> => {
    if (!instruction.trim()) return
    setRunning(true)
    setError(null)
    try {
      await props.onRevise(instruction.trim())
      setInstruction('')
    } catch (e) {
      if (errorKind(e) === 'cancelled') notifications.show({ message: 'Revision cancelled.' })
      else setError(errorMessage(e))
    } finally {
      setRunning(false)
    }
  }

  return (
    <>
      <Group align="flex-end" wrap="nowrap">
        <TextInput
          style={{ flex: 1 }}
          label="Ask Claude for changes"
          placeholder="Tell Claude what to change… (e.g. Make it shorter)"
          value={instruction}
          disabled={running}
          onChange={(e) => setInstruction(e.currentTarget.value)}
          onKeyDown={(e) => e.key === 'Enter' && void revise()}
        />
        {running ? (
          <>
            <Group gap={6}>
              <Loader size="xs" />
              <Text size="sm">Revising…</Text>
            </Group>
            <Button variant="default" onClick={() => api.llm.cancel()}>
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button onClick={revise} disabled={!instruction.trim()}>
              Revise
            </Button>
            <Button variant="default" onClick={props.onUndo} disabled={!props.canUndo}>
              Undo
            </Button>
          </>
        )}
      </Group>
      {error && (
        <Alert color="red" mt="xs" withCloseButton onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
    </>
  )
}
