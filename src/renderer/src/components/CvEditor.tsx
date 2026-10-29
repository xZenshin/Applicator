import { ActionIcon, Badge, Card, Checkbox, Group, SimpleGrid, Stack, Text, TextInput, Textarea, Title, Tooltip } from '@mantine/core'
import { SECTION_KEYS, type CvContent, type Profile, type SectionKey } from '../../../shared/types'
import { moveCvItem, toggleCvItem, updateCvItem, type CvEntry } from '../lib/cv-edit'
import type { ProfileItem } from '../lib/profile-edit'
import { SECTION_TITLES, itemLabel } from '../lib/profile-sections'
import { LinesInput } from './LinesInput'

const CV_FIELDS: Record<SectionKey, { key: string; label: string; kind: 'text' | 'lines' }[]> = {
  experience: [
    { key: 'title', label: 'Job title', kind: 'text' },
    { key: 'bullets', label: 'Bullet points, one per line', kind: 'lines' }
  ],
  education: [
    { key: 'degree', label: 'Degree', kind: 'text' },
    { key: 'details', label: 'Details, one per line', kind: 'lines' }
  ],
  skills: [
    { key: 'name', label: 'Skill', kind: 'text' },
    { key: 'category', label: 'Category', kind: 'text' }
  ],
  languages: [
    { key: 'name', label: 'Language', kind: 'text' },
    { key: 'level', label: 'Level', kind: 'text' }
  ],
  projects: [
    { key: 'name', label: 'Name', kind: 'text' },
    { key: 'context', label: 'Context', kind: 'text' },
    { key: 'bullets', label: 'Bullet points, one per line', kind: 'lines' }
  ],
  certifications: [{ key: 'name', label: 'Name', kind: 'text' }]
}

interface Props {
  cv: CvContent
  profile: Profile
  untranslatedIds: string[]
  /** `toggled` reports an item the user ticked (added) or unticked. */
  onChange: (cv: CvContent, toggled?: { id: string; added: boolean }) => void
  resetKey: number
}

export function CvEditor(props: Props): React.JSX.Element {
  const { cv, profile, onChange } = props

  return (
    <Stack gap="lg">
      <TextInput label="Headline" value={cv.headline} onChange={(e) => onChange({ ...cv, headline: e.currentTarget.value })} />
      <Textarea label="Summary" autosize minRows={3} value={cv.summary} onChange={(e) => onChange({ ...cv, summary: e.currentTarget.value })} />

      {SECTION_KEYS.filter((s) => profile[s].length > 0).map((section) => {
        const selected = cv[section] as CvEntry[]
        const selectedIds = new Set(selected.map((e) => e.id))
        const profileItems = profile[section] as ProfileItem[]
        const byId = new Map(profileItems.map((p) => [p.id, p]))
        const unselected = profileItems.filter((p) => !selectedIds.has(p.id))
        const toggle = (id: string): void => {
          const result = toggleCvItem(cv, profile, section, id)
          onChange(result.cv, { id, added: result.added })
        }

        return (
          <Stack key={section} gap="xs">
            <Title order={4}>{SECTION_TITLES[section]}</Title>
            {selected.map((entry, index) => {
              const source = byId.get(entry.id)
              return (
                <Card key={entry.id} withBorder padding="sm">
                  <Group justify="space-between" wrap="nowrap" mb="xs">
                    <Group gap="xs" wrap="nowrap">
                      <Checkbox checked onChange={() => toggle(entry.id)} label={source ? itemLabel(section, source) : entry.id} />
                      {props.untranslatedIds.includes(entry.id) && (
                        <Tooltip label="Added by you: not tailored or translated. Use Revise to adapt it." multiline w={260}>
                          <Badge size="xs" color="yellow" variant="light">
                            original text
                          </Badge>
                        </Tooltip>
                      )}
                    </Group>
                    <Group gap={4} wrap="nowrap">
                      <ActionIcon variant="subtle" color="gray" aria-label="Move up" disabled={index === 0} onClick={() => onChange(moveCvItem(cv, section, entry.id, -1))}>
                        ↑
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        aria-label="Move down"
                        disabled={index === selected.length - 1}
                        onClick={() => onChange(moveCvItem(cv, section, entry.id, 1))}
                      >
                        ↓
                      </ActionIcon>
                    </Group>
                  </Group>
                  <SimpleGrid cols={2} spacing="xs">
                    {CV_FIELDS[section]
                      .filter((f) => f.kind === 'text')
                      .map((f) => (
                        <TextInput
                          key={f.key}
                          label={f.label}
                          size="xs"
                          value={(entry as Record<string, unknown>)[f.key] as string}
                          onChange={(e) => onChange(updateCvItem(cv, section, entry.id, { [f.key]: e.currentTarget.value }))}
                        />
                      ))}
                  </SimpleGrid>
                  {CV_FIELDS[section]
                    .filter((f) => f.kind === 'lines')
                    .map((f) => (
                      <Stack key={f.key} mt="xs">
                        <LinesInput
                          label={f.label}
                          value={(entry as Record<string, unknown>)[f.key] as string[]}
                          resetKey={`${entry.id}-${props.resetKey}`}
                          onChange={(lines) => onChange(updateCvItem(cv, section, entry.id, { [f.key]: lines }))}
                        />
                      </Stack>
                    ))}
                </Card>
              )
            })}
            {unselected.map((item) => (
              <Checkbox key={item.id} checked={false} onChange={() => toggle(item.id)} label={<Text c="dimmed" size="sm">{itemLabel(section, item)}</Text>} />
            ))}
          </Stack>
        )
      })}
    </Stack>
  )
}
