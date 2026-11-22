import { Button, Group, Stack, Text, Textarea, Title, UnstyledButton } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { FileText, Paperclip } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { InterviewMaterials } from '../../../shared/types'
import { api, errorMessage } from '../api'
import { useAutosave } from '../hooks/useAutosave'
import { AutosaveIndicator } from './AutosaveIndicator'
import { ConfirmDelete } from './ConfirmDelete'

const size = (bytes: number): string =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`

const fail = (e: unknown): void => {
  notifications.show({ color: 'red', message: errorMessage(e) })
}

/** Text and PDFs the company sent before the interview; every practice session for the application uses them. */
export function InterviewMaterialsPanel(props: { appId: string }): React.JSX.Element {
  const { appId } = props
  const [materials, setMaterials] = useState<InterviewMaterials | null>(null)
  const [text, setText] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const autosave = useAutosave(text, (t) => api.interview.saveMaterialsText(appId, t))

  useEffect(() => {
    api.interview.getMaterials(appId).then((m) => {
      setMaterials(m)
      setText(m.text)
    }, fail)
  }, [appId])

  const addPdfs = async (): Promise<void> => {
    setAdding(true)
    try {
      setMaterials(await api.interview.addPdfs(appId))
    } catch (e) {
      fail(e)
    } finally {
      setAdding(false)
    }
  }

  return (
    <Stack gap="sm">
      <Group justify="space-between" align="baseline">
        <Title order={4}>Prep material</Title>
        <AutosaveIndicator status={autosave.status} error={autosave.error} />
      </Group>
      <Textarea
        placeholder="Paste anything the company sent you: the interview format, a case, a presentation topic, who you'll meet…"
        autosize
        minRows={4}
        maxRows={14}
        value={text ?? ''}
        disabled={text === null}
        onChange={(e) => setText(e.currentTarget.value)}
      />
      {materials?.files.map((f) => (
        <Group key={f.id} gap="xs" wrap="nowrap" justify="space-between">
          <UnstyledButton
            onClick={() => api.interview.openPdf(appId, f.id).catch(fail)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}
            title="Open"
          >
            <FileText size={14} strokeWidth={1.75} style={{ flexShrink: 0 }} />
            <Text size="sm" truncate>
              {f.name}
            </Text>
            <span className="k-meta">{size(f.size)}</span>
          </UnstyledButton>
          <ConfirmDelete
            label="Remove"
            question={`Remove "${f.name}" from the prep material?`}
            onConfirm={() => api.interview.removePdf(appId, f.id).then(setMaterials, fail)}
          />
        </Group>
      ))}
      <Group>
        <Button
          variant="default"
          size="xs"
          leftSection={<Paperclip size={14} strokeWidth={1.75} />}
          loading={adding}
          disabled={!materials}
          onClick={addPdfs}
        >
          Add PDF
        </Button>
      </Group>
      <Text size="xs" c="dimmed">
        Claude reads the PDFs, scanned pages included. They’re sent with every message, so large files make replies slower and
        use more of your Claude usage.
      </Text>
    </Stack>
  )
}
