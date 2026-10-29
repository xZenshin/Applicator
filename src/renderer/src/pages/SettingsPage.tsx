import { Alert, Badge, Button, Card, Group, Loader, Select, Stack, Text, TextInput, Title } from '@mantine/core'
import { useEffect, useState } from 'react'
import type { ConnectionResult, SettingsView } from '../../../shared/api'
import type { ClaudeSource, Settings } from '../../../shared/types'
import { api, errorMessage } from '../api'

const SOURCE_LABELS: Record<ClaudeSource, string> = {
  settings: 'Settings',
  path: 'PATH',
  'local-bin': '~/.local/bin',
  vscode: 'VS Code extension'
}

const MODEL_DATA = [
  { value: '', label: 'CLI default' },
  { value: 'fable', label: 'Fable' },
  { value: 'opus', label: 'Opus' },
  { value: 'sonnet', label: 'Sonnet' },
  { value: 'haiku', label: 'Haiku' }
]

export default function SettingsPage(): React.JSX.Element {
  const [view, setView] = useState<SettingsView | null>(null)
  const [pathDraft, setPathDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)
  const [test, setTest] = useState<ConnectionResult | null>(null)

  useEffect(() => {
    api.settings.get().then(
      (v) => {
        setView(v)
        setPathDraft(v.settings.claudePath)
      },
      (e) => setError(errorMessage(e))
    )
  }, [])

  if (error) return <Alert color="red" title="Could not load settings">{error}</Alert>
  if (!view) return <Loader />

  const save = async (patch: Partial<Settings>): Promise<void> => {
    try {
      const next = await api.settings.save({ ...view.settings, ...patch })
      setView(next)
      setPathDraft(next.settings.claudePath)
      setTest(null)
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  const runTest = async (): Promise<void> => {
    setTesting(true)
    setTest(null)
    try {
      setTest(await api.settings.testConnection())
    } catch (e) {
      setTest({ ok: false, message: errorMessage(e) })
    } finally {
      setTesting(false)
    }
  }

  const { claude, settings } = view
  const notFoundMessage = claude.shimOnly
    ? 'Only an npm shim of Claude Code was found. Run `claude install` in a terminal to get the native build, then restart Applicator.'
    : settings.claudePath
      ? 'The claude.exe set below does not exist.'
      : 'Claude Code CLI was not found. Install it (see README) or set its path below.'

  return (
    <Stack maw={760} gap="lg">
      <Title order={2}>Settings</Title>

      <Card withBorder padding="lg">
        <Stack gap="sm">
          <Title order={4}>Claude Code CLI</Title>
          {claude.path ? (
            <Group gap="xs" wrap="nowrap">
              <Text size="sm" ff="monospace" style={{ wordBreak: 'break-all' }}>
                {claude.path}
              </Text>
              {claude.source && <Badge variant="light">{SOURCE_LABELS[claude.source]}</Badge>}
            </Group>
          ) : (
            <Alert color="red">{notFoundMessage}</Alert>
          )}
          <Group align="flex-end" wrap="nowrap">
            <TextInput
              style={{ flex: 1 }}
              label="Use a specific claude.exe (optional)"
              placeholder="Leave empty to detect automatically"
              value={pathDraft}
              onChange={(e) => setPathDraft(e.currentTarget.value)}
              onBlur={() => pathDraft !== settings.claudePath && save({ claudePath: pathDraft.trim() })}
            />
            <Button
              variant="default"
              onClick={async () => {
                const file = await api.settings.pickFile()
                if (file) await save({ claudePath: file })
              }}
            >
              Browse…
            </Button>
            <Button variant="subtle" disabled={!settings.claudePath} onClick={() => save({ claudePath: '' })}>
              Clear
            </Button>
          </Group>
        </Stack>
      </Card>

      <Card withBorder padding="lg">
        <Select
          label="Model"
          description="Larger models write better but use more of your plan's usage."
          data={MODEL_DATA}
          value={settings.model}
          allowDeselect={false}
          onChange={(value) => save({ model: (value ?? '') as Settings['model'] })}
        />
      </Card>

      <Card withBorder padding="lg">
        <Stack gap="sm">
          <Title order={4}>Data folder</Title>
          <Text size="sm" ff="monospace" style={{ wordBreak: 'break-all' }}>
            {view.dataDir}
          </Text>
          <Text size="xs" c="dimmed">
            Your CV, writing samples and generated applications are stored here. Existing files are not moved.
          </Text>
          <Group>
            <Button
              variant="default"
              onClick={async () => {
                const folder = await api.settings.pickFolder()
                if (folder) await save({ dataDir: folder })
              }}
            >
              Change…
            </Button>
            <Button variant="subtle" disabled={!settings.dataDir} onClick={() => save({ dataDir: '' })}>
              Reset to default
            </Button>
          </Group>
        </Stack>
      </Card>

      <Group>
        <Button onClick={runTest} loading={testing} disabled={!claude.path}>
          Test connection
        </Button>
      </Group>
      {test && (
        <Alert color={test.ok ? 'green' : 'red'} title={test.ok ? 'Connected' : 'Connection failed'}>
          {test.message}
        </Alert>
      )}
    </Stack>
  )
}
