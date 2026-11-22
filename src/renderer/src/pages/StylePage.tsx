import { Alert, Button, Card, Group, Loader, Stack, Switch, Text, TextInput, Textarea, Title } from '@mantine/core'
import { useEffect, useState } from 'react'
import { countWords } from '../../../shared/text'
import type { Style, WritingSample } from '../../../shared/types'
import { api, errorMessage } from '../api'
import { AutosaveIndicator } from '../components/AutosaveIndicator'
import { ConfirmDelete } from '../components/ConfirmDelete'
import { useAutosave } from '../hooks/useAutosave'

export default function StylePage(): React.JSX.Element {
  const [style, setStyle] = useState<Style | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const autosave = useAutosave(style, (s) => api.style.save(s))

  useEffect(() => {
    api.style.get().then(setStyle, (e) => setLoadError(errorMessage(e)))
  }, [])

  if (loadError) return <Alert color="red" title="Could not load your writing samples">{loadError}</Alert>
  if (!style) return <Loader />

  const update = (fn: (s: Style) => Style): void => setStyle((s) => (s ? fn(s) : s))
  const updateSample = (id: string, patch: Partial<WritingSample>): void =>
    update((s) => ({ ...s, samples: s.samples.map((x) => (x.id === id ? { ...x, ...patch } : x)) }))

  return (
    <Stack maw={980} gap="lg" pb="xl">
      <Group justify="space-between">
        <Title order={2}>Writing style</Title>
        <AutosaveIndicator status={autosave.status} error={autosave.error} />
      </Group>

      <Textarea
        label="Default instructions"
        description="Applied to every application. You can add more per job on the New application page."
        placeholder="e.g. Keep it under one page. Warm but professional. Mention I can start immediately."
        autosize
        minRows={3}
        value={style.defaultInstructions}
        onChange={(e) => {
          const defaultInstructions = e.currentTarget.value
          update((s) => ({ ...s, defaultInstructions }))
        }}
      />

      <Stack gap="xs">
        <Title order={3}>Previous applications</Title>
        <Text size="sm" c="dimmed">
          Paste 2–3 applications you wrote yourself. Active samples are used to match your tone and length.
        </Text>
      </Stack>

      {style.samples.map((sample) => (
        <Card key={sample.id} withBorder padding="md">
          <Group justify="space-between" mb="sm" wrap="nowrap">
            <TextInput
              placeholder="Title (e.g. Application to Contoso, 2025)"
              value={sample.title}
              style={{ flex: 1 }}
              onChange={(e) => updateSample(sample.id, { title: e.currentTarget.value })}
            />
            <Group gap="md" wrap="nowrap">
              <Text size="sm" c="dimmed">
                ~{countWords(sample.text)} words
              </Text>
              <Switch
                label="Active"
                checked={sample.active}
                onChange={(e) => updateSample(sample.id, { active: e.currentTarget.checked })}
              />
              <ConfirmDelete
                question="Delete this writing sample?"
                onConfirm={() => update((s) => ({ ...s, samples: s.samples.filter((x) => x.id !== sample.id) }))}
              />
            </Group>
          </Group>
          <Textarea
            aria-label="Application text"
            placeholder="Paste the full text of the application here…"
            autosize
            minRows={8}
            value={sample.text}
            onChange={(e) => updateSample(sample.id, { text: e.currentTarget.value })}
          />
        </Card>
      ))}

      <Group>
        <Button
          variant="light"
          onClick={() =>
            update((s) => ({
              ...s,
              samples: [...s.samples, { id: crypto.randomUUID(), title: '', text: '', active: true }]
            }))
          }
        >
          Add previous application
        </Button>
      </Group>
    </Stack>
  )
}
