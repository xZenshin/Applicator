import { Alert, Box, Button, Card, CloseButton, Divider, Grid, Group, Loader, SimpleGrid, Stack, Text, TextInput, Textarea, Title } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { useEffect, useMemo, useState } from 'react'
import { SECTION_KEYS, type Personal, type Profile, type SectionKey } from '../../../shared/types'
import { api, errorMessage } from '../api'
import { AutosaveIndicator } from '../components/AutosaveIndicator'
import { PreviewFrame } from '../components/PreviewFrame'
import { SectionEditor } from '../components/SectionEditor'
import { useAutosave } from '../hooks/useAutosave'
import { addItem, moveItem, removeItem, updateItem, type ProfileItem } from '../lib/profile-edit'
import { profileCvHtml } from '../lib/render'

const PERSONAL_FIELDS: { key: Exclude<keyof Personal, 'links'>; label: string }[] = [
  { key: 'fullName', label: 'Full name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'location', label: 'Location (city, country)' }
]

export default function ProfilePage(): React.JSX.Element {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const autosave = useAutosave(profile, (p) => api.profile.save(p))
  // Debounced so the preview frame isn't reloaded on every keystroke.
  const [previewProfile] = useDebouncedValue(profile, 250)
  const preview = useMemo(() => (previewProfile ? profileCvHtml(previewProfile) : ''), [previewProfile])

  useEffect(() => {
    api.profile.get().then(setProfile, (e) => setLoadError(errorMessage(e)))
  }, [])

  // A broken profile.json must never be overwritten, so the editor is not shown at all.
  if (loadError) return <Alert color="red" title="Could not load your CV data">{loadError}</Alert>
  if (!profile) return <Loader />

  const update = (fn: (p: Profile) => Profile): void => setProfile((p) => (p ? fn(p) : p))
  const setPersonal = (patch: Partial<Personal>): void =>
    update((p) => ({ ...p, personal: { ...p.personal, ...patch } }))
  const links = profile.personal.links

  const downloadPdf = async (): Promise<void> => {
    setExporting(true)
    try {
      // Saved first: the suggested file name comes from the stored profile.
      await autosave.flush()
      const saved = await api.profile.exportPdf(profileCvHtml(profile))
      if (!saved) return
      const failed = (e: unknown): void => {
        notifications.show({ color: 'red', message: errorMessage(e) })
      }
      notifications.show({
        color: 'green',
        title: 'CV saved',
        message: (
          <>
            <Text size="xs" style={{ wordBreak: 'break-all' }}>
              {saved}
            </Text>
            <Group gap="xs" mt={4}>
              <Button size="compact-xs" variant="light" onClick={() => api.profile.openPdf().catch(failed)}>
                Open
              </Button>
              <Button size="compact-xs" variant="light" onClick={() => api.profile.showPdf().catch(failed)}>
                Show in folder
              </Button>
            </Group>
          </>
        )
      })
    } catch (e) {
      notifications.show({ color: 'red', title: 'Could not save the PDF', message: errorMessage(e) })
    } finally {
      setExporting(false)
    }
  }

  return (
    <Stack gap="md" pb="xl">
      <Group justify="space-between">
        <Title order={2}>My CV</Title>
        <Group gap="md">
          <AutosaveIndicator status={autosave.status} error={autosave.error} />
          <Button onClick={downloadPdf} loading={exporting}>
            Download PDF
          </Button>
        </Group>
      </Group>
      <Text size="sm" c="dimmed">
        Enter everything you might want on a CV. For each job, Claude picks the most relevant items and tailors
        the wording; it never adds facts that aren&apos;t here. The preview shows everything you&apos;ve entered.
      </Text>

      <Grid gap="lg">
        <Grid.Col span={7}>
          <Stack gap="xl">
          <Card withBorder padding="lg">
            <Title order={3} mb="sm">
              Personal details
            </Title>
            <SimpleGrid cols={2} spacing="sm">
              {PERSONAL_FIELDS.map((f) => (
                <TextInput
                  key={f.key}
                  label={f.label}
                  value={profile.personal[f.key]}
                  onChange={(e) => setPersonal({ [f.key]: e.currentTarget.value })}
                />
              ))}
            </SimpleGrid>
            <Text size="sm" fw={500} mt="md" mb={4}>
              Links
            </Text>
            <Stack gap="xs">
              {links.map((link, i) => (
                <Group key={i} wrap="nowrap" gap="xs">
                  <TextInput
                    placeholder="Label (e.g. LinkedIn)"
                    value={link.label}
                    w={200}
                    onChange={(e) =>
                      setPersonal({ links: links.map((l, j) => (j === i ? { ...l, label: e.currentTarget.value } : l)) })
                    }
                  />
                  <TextInput
                    placeholder="https://…"
                    value={link.url}
                    style={{ flex: 1 }}
                    onChange={(e) =>
                      setPersonal({ links: links.map((l, j) => (j === i ? { ...l, url: e.currentTarget.value } : l)) })
                    }
                  />
                  <CloseButton aria-label="Remove link" onClick={() => setPersonal({ links: links.filter((_, j) => j !== i) })} />
                </Group>
              ))}
              <Group>
                <Button variant="light" size="xs" onClick={() => setPersonal({ links: [...links, { label: '', url: '' }] })}>
                  Add link
                </Button>
              </Group>
            </Stack>
          </Card>

          <Textarea
            label="Profile summary"
            description="Your base summary; Claude tailors it per job."
            autosize
            minRows={3}
            value={profile.summary}
            onChange={(e) => {
              const summary = e.currentTarget.value
              update((p) => ({ ...p, summary }))
            }}
          />

          {SECTION_KEYS.map((section: SectionKey) => (
            <Stack key={section} gap="xl">
              <Divider />
              <SectionEditor
                section={section}
                items={profile[section] as ProfileItem[]}
                onAdd={() => update((p) => addItem(p, section).profile)}
                onChange={(id, patch) => update((p) => updateItem(p, section, id, patch))}
                onRemove={(id) => update((p) => removeItem(p, section, id))}
                onMove={(id, delta) =>
                  update((p) => ({ ...p, [section]: moveItem(p[section] as ProfileItem[], id, delta) }))
                }
              />
            </Stack>
          ))}
          </Stack>
        </Grid.Col>
        <Grid.Col span={5}>
          {/* Padded so the scroll box doesn't clip the page's shadow. */}
          <Box p={6} style={{ position: 'sticky', top: 16, maxHeight: 'calc(100vh - 32px)', overflowY: 'auto' }}>
            <PreviewFrame html={preview} title="CV preview" />
          </Box>
        </Grid.Col>
      </Grid>
    </Stack>
  )
}
