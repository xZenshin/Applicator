import { Alert, Button, CloseButton, Group, Loader, Paper, Portal, Stack, Text, TextInput } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useEffect, useRef, useState } from 'react'
import type { Highlight } from '../../../shared/types'
import { api, errorKind, errorMessage } from '../api'

const PANEL_WIDTH = 380
const BUTTON_WIDTH = 110
const DONE_WIDTH = 170

/** Highlighted text in the letter or the CV, and where to show the popover, in page coordinates. */
export interface HighlightTarget {
  part: 'letter' | 'cv'
  highlight: Highlight
  x: number
  y: number
}

/**
 * Floats next to highlighted text: first an "Ask Claude" button, then a box for the instruction.
 * Closes on Escape or a click elsewhere, except while Claude is working.
 */
export function HighlightPopover(props: {
  target: HighlightTarget
  onRevise: (instruction: string) => Promise<void>
  canUndo: boolean
  onUndo: () => void
  onClose: () => void
}): React.JSX.Element {
  const { target, onClose } = props
  const [asking, setAsking] = useState(false)
  const [instruction, setInstruction] = useState('')
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (running) return
    const onMouseDown = (e: MouseEvent): void => {
      if (!box.current?.contains(e.target as Node)) onClose()
    }
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [running, onClose])

  const revise = async (): Promise<void> => {
    if (!instruction.trim()) return
    setRunning(true)
    setError(null)
    try {
      await props.onRevise(instruction.trim())
      setDone(true)
    } catch (e) {
      if (errorKind(e) === 'cancelled') notifications.show({ message: 'Revision cancelled.' })
      else setError(errorMessage(e))
    } finally {
      setRunning(false)
    }
  }

  const expanded = asking && !done
  const right = window.scrollX + document.documentElement.clientWidth - 16
  const left = Math.max(8, Math.min(target.x, right - (expanded ? PANEL_WIDTH : done ? DONE_WIDTH : BUTTON_WIDTH)))

  return (
    <Portal>
      <Paper
        ref={box}
        shadow="md"
        withBorder
        radius="md"
        p={expanded ? 'sm' : 4}
        w={expanded ? PANEL_WIDTH : undefined}
        style={{ position: 'absolute', left, top: target.y + 10, zIndex: 300 }}
      >
        {done ? (
          // Kept small: the revised text is right next to it.
          <Group gap={4} wrap="nowrap" pl="xs">
            <Text size="sm" c="teal">
              Revised
            </Text>
            <Button
              size="compact-sm"
              variant="subtle"
              disabled={!props.canUndo}
              onClick={() => {
                props.onUndo()
                onClose()
              }}
            >
              Undo
            </Button>
            <CloseButton size="sm" aria-label="Close" onClick={onClose} />
          </Group>
        ) : !asking ? (
          <Button size="compact-sm" variant="subtle" onClick={() => setAsking(true)}>
            Ask Claude
          </Button>
        ) : (
          <Stack gap="xs">
            <Text size="xs" c="dimmed" fs="italic" lineClamp={3}>
              “{target.highlight.text}”
            </Text>
            <TextInput
              size="sm"
              autoFocus
              aria-label="What should Claude do with the highlighted text?"
              placeholder="What should Claude do with this text?"
              value={instruction}
              disabled={running}
              onChange={(e) => setInstruction(e.currentTarget.value)}
              onKeyDown={(e) => e.key === 'Enter' && void revise()}
            />
            {error && (
              <Alert color="red" p="xs">
                <Text size="xs">{error}</Text>
              </Alert>
            )}
            <Group justify="flex-end" gap="xs">
              {running ? (
                <>
                  <Loader size="xs" />
                  <Text size="sm">Revising…</Text>
                  <Button size="xs" variant="default" onClick={() => api.llm.cancel()}>
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <Button size="xs" variant="subtle" onClick={onClose}>
                    Close
                  </Button>
                  <Button size="xs" onClick={revise} disabled={!instruction.trim()}>
                    Revise
                  </Button>
                </>
              )}
            </Group>
          </Stack>
        )}
      </Paper>
    </Portal>
  )
}
