import { Alert, Badge, Box, Button, Grid, Group, Loader, Select, Stack, Tabs, Text, TextInput, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { overflowLines } from '../../../shared/templates/page-fit'
import type { ApplicationLetter, ApplicationMeta, ApplicationRecord, CvContent, Draft, Highlight } from '../../../shared/types'
import { api, errorMessage } from '../api'
import { AutosaveIndicator } from '../components/AutosaveIndicator'
import { CvEditor } from '../components/CvEditor'
import { HighlightPopover, type HighlightTarget } from '../components/HighlightPopover'
import { LetterEditor } from '../components/LetterEditor'
import { PreviewFrame } from '../components/PreviewFrame'
import { RevisePanel } from '../components/RevisePanel'
import { useAutosave } from '../hooks/useAutosave'
import { highlightInField } from '../lib/highlight'
import { cvHtml, letterHtml } from '../lib/render'

const LANGUAGES = [
  { value: 'da', label: 'Danish' },
  { value: 'en', label: 'English' },
  { value: 'sv', label: 'Swedish' },
  { value: 'nb', label: 'Norwegian' },
  { value: 'de', label: 'German' }
]

type Part = HighlightTarget['part']

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
  const [revising, setRevising] = useState<Part | null>(null)
  const [cvOverflow, setCvOverflow] = useState(0)
  // Keyed, so each new highlight gets a fresh popover.
  const [target, setTarget] = useState<(HighlightTarget & { key: number }) | null>(null)
  const closeHighlight = useCallback(() => setTarget(null), [])
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

  const letterPreview = useMemo(() => (record && draft ? letterHtml(record.profile, draft) : null), [record, draft])
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
            {m.letterPdf && (
              <Button size="compact-xs" variant="light" onClick={() => openFile(m.letterPdf)}>
                Open application
              </Button>
            )}
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
    (part: Part, run: (instruction: string, highlight?: Highlight) => Promise<void>) =>
    async (instruction: string, highlight?: Highlight): Promise<void> => {
      setRevising(part)
      try {
        await run(instruction, highlight)
      } finally {
        setRevising(null)
      }
    }

  const reviseLetter = whileRevising('letter', async (instruction, highlight) => {
    const previous = draft.letter
    if (!previous) return
    const letter = await api.llm.reviseLetter({ id, cv: draft.cv, letter: previous, instruction, highlight })
    setUndo((u) => ({ ...u, letter: previous }))
    update((d) => ({ ...d, letter }))
    replaced()
  })

  const reviseCv = whileRevising('cv', async (instruction, highlight) => {
    const previous = { cv: draft.cv, untranslatedIds: draft.untranslatedIds }
    const result = await api.llm.reviseCv({ id, cv: draft.cv, instruction, highlight })
    setUndo((u) => ({ ...u, cv: previous }))
    update((d) => ({ ...d, cv: result.cv, untranslatedIds: [], warnings: [...d.warnings, ...result.warnings] }))
    replaced()
  })

  const undoLetter = (): void => {
    const previous = undo.letter
    if (!previous) return
    update((d) => ({ ...d, letter: previous }))
    setUndo((u) => ({ ...u, letter: undefined }))
    replaced()
  }

  const undoCv = (): void => {
    const previous = undo.cv
    if (!previous) return
    update((d) => ({ ...d, ...previous }))
    setUndo((u) => ({ ...u, cv: undefined }))
    replaced()
  }

  // New highlights are ignored while Claude works: that part is read-only until it answers.
  const highlightAt = (part: Part, highlight: Highlight | null, clientX: number, clientY: number): void => {
    if (revising) return
    if (!highlight) return setTarget(null)
    setTarget((t) => ({ key: (t?.key ?? 0) + 1, part, highlight, x: clientX + window.scrollX, y: clientY + window.scrollY }))
  }

  /** A selection in one of the editor's text fields, made with the mouse or the keyboard. */
  const fieldHighlight =
    (part: Part) =>
    (e: React.MouseEvent<HTMLDivElement> | React.KeyboardEvent<HTMLDivElement>): void => {
      const field = document.activeElement
      if (!(field instanceof HTMLTextAreaElement || field instanceof HTMLInputElement) || !e.currentTarget.contains(field)) return
      const highlight = highlightInField(field.value, field.selectionStart, field.selectionEnd)
      if ('clientX' in e) return highlightAt(part, highlight, e.clientX, e.clientY)
      // A keyboard selection has no pointer position: show the popover below the field, or low in the window if the field is taller.
      const box = field.getBoundingClientRect()
      highlightAt(part, highlight, box.left, Math.min(box.bottom, window.innerHeight - 160))
    }

  const setJob = (patch: Partial<Draft['job']>): void => update((d) => ({ ...d, job: { ...d.job, ...patch } }))
  const languageOptions = LANGUAGES.some((l) => l.value === draft.job.language)
    ? LANGUAGES
    : [...LANGUAGES, { value: draft.job.language, label: draft.job.language.toUpperCase() }]

  // Claude fits the CV on one page when it generates it; this catches edits that make it longer again.
  const preview = (html: string, title: string, part: Part): React.JSX.Element => (
    <Box style={{ position: 'sticky', top: 16 }}>
      {part === 'cv' && cvOverflow > 0 && (
        <Text size="sm" mb={8} style={{ color: 'var(--k-warning)' }}>
          About {cvOverflow} line{cvOverflow === 1 ? '' : 's'} over one page. Untick some items, or ask Claude to make it
          fit one page.
        </Text>
      )}
      <PreviewFrame
        html={html}
        title={title}
        onHighlight={(h) => highlightAt(part, h.highlight, h.x, h.y)}
        onMeasure={part === 'cv' ? (h) => setCvOverflow(overflowLines(h)) : undefined}
      />
    </Box>
  )

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-start">
        <Stack gap={4}>
          <Group gap="xs">
            <Title order={2}>{[draft.job.company, draft.job.role].filter(Boolean).join(' — ') || meta.id}</Title>
            <Badge variant="light">{draft.job.language.toUpperCase()}</Badge>
            {!draft.letter && (
              <Badge variant="light" color="gray">
                CV only
              </Badge>
            )}
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

      {target && (
        <HighlightPopover
          key={target.key}
          target={target}
          onRevise={(instruction) => (target.part === 'letter' ? reviseLetter : reviseCv)(instruction, target.highlight)}
          canUndo={!!undo[target.part]}
          onUndo={target.part === 'letter' ? undoLetter : undoCv}
          onClose={closeHighlight}
        />
      )}

      <Tabs
        defaultValue={draft.letter ? 'letter' : 'cv'}
        keepMounted={false}
        onChange={() => {
          if (!revising) closeHighlight()
        }}
      >
        <Tabs.List>
          {draft.letter && <Tabs.Tab value="letter">Application</Tabs.Tab>}
          <Tabs.Tab value="cv">CV</Tabs.Tab>
        </Tabs.List>

        {draft.letter && letterPreview !== null && (
          <Tabs.Panel value="letter" pt="md">
            <Grid gap="lg">
              <Grid.Col span={5}>
                <Stack>
                  <RevisePanel onRevise={reviseLetter} canUndo={!!undo.letter} onUndo={undoLetter} busy={revising !== null} />
                  <Box onMouseUp={fieldHighlight('letter')} onKeyUp={fieldHighlight('letter')}>
                    <LetterEditor letter={draft.letter} resetKey={resetKey} disabled={revising === 'letter'} onChange={(letter) => update((d) => ({ ...d, letter }))} />
                  </Box>
                </Stack>
              </Grid.Col>
              <Grid.Col span={7}>{preview(letterPreview, 'Application preview', 'letter')}</Grid.Col>
            </Grid>
          </Tabs.Panel>
        )}

        <Tabs.Panel value="cv" pt="md">
          <Grid gap="lg">
            <Grid.Col span={5}>
              <Stack>
                <RevisePanel onRevise={reviseCv} canUndo={!!undo.cv} onUndo={undoCv} busy={revising !== null} />
                <Box onMouseUp={fieldHighlight('cv')} onKeyUp={fieldHighlight('cv')}>
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
                </Box>
              </Stack>
            </Grid.Col>
            <Grid.Col span={7}>{preview(cvPreview, 'CV preview', 'cv')}</Grid.Col>
          </Grid>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  )
}
