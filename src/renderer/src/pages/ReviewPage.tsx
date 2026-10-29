import { Alert, Badge, Box, Button, Grid, Group, Loader, Select, Stack, Tabs, Text, TextInput, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import type { ApplicationLetter, ApplicationMeta, ApplicationRecord, CvContent, Draft } from '../../../shared/types'
import { api, errorMessage } from '../api'
import { AutosaveIndicator } from '../components/AutosaveIndicator'
import { CvEditor } from '../components/CvEditor'
import { LetterEditor } from '../components/LetterEditor'
import { PreviewFrame } from '../components/PreviewFrame'
import { RevisePanel } from '../components/RevisePanel'
import { useAutosave } from '../hooks/useAutosave'
import { cvHtml, letterHtml } from '../lib/render'

const LANGUAGES = [
  { value: 'da', label: 'Danish' },
  { value: 'en', label: 'English' },
  { value: 'sv', label: 'Swedish' },
  { value: 'nb', label: 'Norwegian' },
  { value: 'de', label: 'German' }
]

interface UndoState {
  letter?: ApplicationLetter
  cv?: { cv: CvContent; untranslatedIds: string[] }
}

export default function ReviewPage(): React.JSX.Element {
  const id = useParams().id ?? ''
  const [record, setRecord] = useState<ApplicationRecord | null>(null)
  const [meta, setMeta] = useState<ApplicationMeta | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [undo, setUndo] = useState<UndoState>({})
  const [resetKey, setResetKey] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [revising, setRevising] = useState<'letter' | 'cv' | null>(null)
  const autosave = useAutosave(draft, async (d) => setMeta(await api.applications.saveDraft(id, d)))

  useEffect(() => {
    api.applications.get(id).then(
      (r) => {
        setRecord(r)
        setMeta(r.meta)
        setDraft(r.draft)
      },
      (e) => setLoadError(errorMessage(e))
    )
  }, [id])

  const letterPreview = useMemo(() => (record && draft ? letterHtml(record.profile, draft) : ''), [record, draft])
  const cvPreview = useMemo(() => (record && draft ? cvHtml(record.profile, draft) : ''), [record, draft])

  if (loadError) return <Alert color="red" title="Could not open this application">{loadError}</Alert>
  if (!record || !draft || !meta) return <Loader />

  const update = (fn: (d: Draft) => Draft): void => setDraft((d) => (d ? fn(d) : d))
  const replaced = (): void => setResetKey((k) => k + 1)

  const openFile = (fileName: string | null): void => {
    if (fileName) api.applications.openFile(id, fileName).catch((e) => notifications.show({ color: 'red', message: errorMessage(e) }))
  }

  const exportPdfs = async (): Promise<void> => {
    setExporting(true)
    try {
      await autosave.flush()
      const m = await api.applications.exportPdfs(id, { cv: cvPreview, letter: letterPreview })
      setMeta(m)
      notifications.show({
        color: 'green',
        title: 'PDFs saved',
        message: (
          <Group gap="xs" mt={4}>
            <Button size="compact-xs" variant="light" onClick={() => openFile(m.cvPdf)}>
              Open CV
            </Button>
            <Button size="compact-xs" variant="light" onClick={() => openFile(m.letterPdf)}>
              Open application
            </Button>
          </Group>
        )
      })
    } catch (e) {
      notifications.show({ color: 'red', title: 'Export failed', message: errorMessage(e) })
    } finally {
      setExporting(false)
    }
  }

  // The part being revised is read-only until Claude answers, so no edit is silently replaced.
  const whileRevising =
    (part: 'letter' | 'cv', run: (instruction: string) => Promise<void>) =>
    async (instruction: string): Promise<void> => {
      setRevising(part)
      try {
        await run(instruction)
      } finally {
        setRevising(null)
      }
    }

  const reviseLetter = whileRevising('letter', async (instruction) => {
    const previous = draft.letter
    const letter = await api.llm.reviseLetter({ id, cv: draft.cv, letter: draft.letter, instruction })
    setUndo((u) => ({ ...u, letter: previous }))
    update((d) => ({ ...d, letter }))
    replaced()
  })

  const reviseCv = whileRevising('cv', async (instruction) => {
    const previous = { cv: draft.cv, untranslatedIds: draft.untranslatedIds }
    const result = await api.llm.reviseCv({ id, cv: draft.cv, instruction })
    setUndo((u) => ({ ...u, cv: previous }))
    update((d) => ({ ...d, cv: result.cv, untranslatedIds: [], warnings: [...d.warnings, ...result.warnings] }))
    replaced()
  })

  const setJob = (patch: Partial<Draft['job']>): void => update((d) => ({ ...d, job: { ...d.job, ...patch } }))
  const languageOptions = LANGUAGES.some((l) => l.value === draft.job.language)
    ? LANGUAGES
    : [...LANGUAGES, { value: draft.job.language, label: draft.job.language.toUpperCase() }]

  const preview = (html: string, title: string): React.JSX.Element => (
    <Box style={{ position: 'sticky', top: 16 }}>
      <PreviewFrame html={html} title={title} />
    </Box>
  )

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-start">
        <Stack gap={4}>
          <Group gap="xs">
            <Title order={2}>{[draft.job.company, draft.job.role].filter(Boolean).join(' — ') || meta.id}</Title>
            <Badge variant="light">{draft.job.language.toUpperCase()}</Badge>
          </Group>
          <AutosaveIndicator status={autosave.status} error={autosave.error} />
          <Group gap="sm" align="flex-end" mt="xs">
            <TextInput size="xs" w={220} label="Company" value={draft.job.company} onChange={(e) => setJob({ company: e.currentTarget.value })} />
            <TextInput size="xs" w={220} label="Role" value={draft.job.role} onChange={(e) => setJob({ role: e.currentTarget.value })} />
            <Select
              size="xs"
              w={150}
              label="Language"
              title="Sets date formatting. Use Revise to translate the text."
              data={languageOptions}
              value={draft.job.language}
              allowDeselect={false}
              onChange={(value) => value && setJob({ language: value })}
            />
          </Group>
        </Stack>
        <Group gap="xs">
          {meta.cvPdf && (
            <Button variant="default" onClick={() => openFile(meta.cvPdf)}>
              Open CV
            </Button>
          )}
          {meta.letterPdf && (
            <Button variant="default" onClick={() => openFile(meta.letterPdf)}>
              Open application
            </Button>
          )}
          <Button variant="default" onClick={() => api.applications.showFolder(id)}>
            Show folder
          </Button>
          <Button onClick={exportPdfs} loading={exporting}>
            Export PDFs
          </Button>
        </Group>
      </Group>

      {draft.warnings.length > 0 && (
        <Alert color="yellow" title="Please check" withCloseButton onClose={() => update((d) => ({ ...d, warnings: [] }))}>
          {draft.warnings.map((w, i) => (
            <Text key={i} size="sm">
              {w}
            </Text>
          ))}
        </Alert>
      )}

      <Tabs defaultValue="letter" keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="letter">Application</Tabs.Tab>
          <Tabs.Tab value="cv">CV</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="letter" pt="md">
          <Grid gap="lg">
            <Grid.Col span={5}>
              <Stack>
                <RevisePanel
                  onRevise={reviseLetter}
                  canUndo={!!undo.letter}
                  onUndo={() => {
                    const previous = undo.letter
                    if (!previous) return
                    update((d) => ({ ...d, letter: previous }))
                    setUndo((u) => ({ ...u, letter: undefined }))
                    replaced()
                  }}
                />
                <LetterEditor letter={draft.letter} resetKey={resetKey} disabled={revising === 'letter'} onChange={(letter) => update((d) => ({ ...d, letter }))} />
              </Stack>
            </Grid.Col>
            <Grid.Col span={7}>{preview(letterPreview, 'Application preview')}</Grid.Col>
          </Grid>
        </Tabs.Panel>

        <Tabs.Panel value="cv" pt="md">
          <Grid gap="lg">
            <Grid.Col span={5}>
              <Stack>
                <RevisePanel
                  onRevise={reviseCv}
                  canUndo={!!undo.cv}
                  onUndo={() => {
                    const previous = undo.cv
                    if (!previous) return
                    update((d) => ({ ...d, ...previous }))
                    setUndo((u) => ({ ...u, cv: undefined }))
                    replaced()
                  }}
                />
                <CvEditor
                  cv={draft.cv}
                  profile={record.profile}
                  untranslatedIds={draft.untranslatedIds}
                  resetKey={resetKey}
                  disabled={revising === 'cv'}
                  onChange={(cv, toggled) =>
                    update((d) => ({
                      ...d,
                      cv,
                      untranslatedIds: !toggled
                        ? d.untranslatedIds
                        : toggled.added
                          ? [...d.untranslatedIds, toggled.id]
                          : d.untranslatedIds.filter((x) => x !== toggled.id)
                    }))
                  }
                />
              </Stack>
            </Grid.Col>
            <Grid.Col span={7}>{preview(cvPreview, 'CV preview')}</Grid.Col>
          </Grid>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  )
}
