import { ActionIcon, Badge, Button, Card, Checkbox, Group, SimpleGrid, Stack, Text, TextInput, Textarea, Title } from '@mantine/core'
import type { SectionKey } from '../../../shared/types'
import type { ProfileItem } from '../lib/profile-edit'
import { SECTION_FIELDS, SECTION_ITEM_NAMES, SECTION_TITLES, itemLabel, type FieldDescriptor } from '../lib/profile-sections'
import { ConfirmDelete } from './ConfirmDelete'
import { LinesInput } from './LinesInput'

interface Props {
  section: SectionKey
  items: ProfileItem[]
  onAdd: () => void
  onChange: (id: string, patch: Record<string, unknown>) => void
  onRemove: (id: string) => void
  onMove: (id: string, delta: -1 | 1) => void
}

function Field(props: { field: FieldDescriptor; item: ProfileItem; onChange: Props['onChange'] }): React.JSX.Element {
  const { field, item, onChange } = props
  const value = (item as Record<string, unknown>)[field.key]
  const set = (v: unknown): void => onChange(item.id, { [field.key]: v })
  switch (field.kind) {
    case 'text':
      return <TextInput label={field.label} value={value as string} onChange={(e) => set(e.currentTarget.value)} />
    case 'textarea':
      return <Textarea label={field.label} autosize minRows={2} value={value as string} onChange={(e) => set(e.currentTarget.value)} />
    case 'month':
      return <TextInput type="month" label={field.label} value={value as string} onChange={(e) => set(e.currentTarget.value)} />
    case 'monthOrPresent': {
      const current = value === 'present'
      return (
        <Stack gap={4}>
          <TextInput
            type="month"
            label={field.label}
            disabled={current}
            value={current ? '' : (value as string)}
            onChange={(e) => set(e.currentTarget.value)}
          />
          <Checkbox size="xs" label="Current" checked={current} onChange={(e) => set(e.currentTarget.checked ? 'present' : '')} />
        </Stack>
      )
    }
    case 'lines':
      return <LinesInput label={field.label} value={value as string[]} resetKey={item.id} onChange={set} />
  }
}

export function SectionEditor(props: Props): React.JSX.Element {
  const { section, items } = props
  const fields = SECTION_FIELDS[section]
  const compact = fields.every((f) => f.kind === 'text') && fields.length <= 2
  const wide = fields.filter((f) => f.kind === 'lines' || f.kind === 'textarea')
  const narrow = fields.filter((f) => !wide.includes(f))

  return (
    <Stack gap="sm">
      <Title order={3}>{SECTION_TITLES[section]}</Title>
      {items.length === 0 && (
        <Text size="sm" c="dimmed">
          Nothing here yet.
        </Text>
      )}
      {items.map((item, index) => (
        <Card key={item.id} withBorder padding={compact ? 'xs' : 'md'}>
          <Group justify="space-between" mb={compact ? 4 : 'xs'} wrap="nowrap">
            <Group gap="xs" wrap="nowrap">
              {!compact && (
                <Text fw={600} size="sm">
                  {itemLabel(section, item)}
                </Text>
              )}
              <Badge size="xs" variant="outline" color="gray">
                {item.id}
              </Badge>
            </Group>
            <Group gap={4} wrap="nowrap">
              <ActionIcon variant="subtle" color="gray" aria-label="Move up" disabled={index === 0} onClick={() => props.onMove(item.id, -1)}>
                ↑
              </ActionIcon>
              <ActionIcon
                variant="subtle"
                color="gray"
                aria-label="Move down"
                disabled={index === items.length - 1}
                onClick={() => props.onMove(item.id, 1)}
              >
                ↓
              </ActionIcon>
              <ConfirmDelete question={`Delete "${itemLabel(section, item)}"?`} onConfirm={() => props.onRemove(item.id)} />
            </Group>
          </Group>
          <SimpleGrid cols={compact ? 2 : 3} spacing="sm">
            {narrow.map((f) => (
              <Field key={f.key} field={f} item={item} onChange={props.onChange} />
            ))}
          </SimpleGrid>
          {wide.map((f) => (
            <Stack key={f.key} mt="sm">
              <Field field={f} item={item} onChange={props.onChange} />
            </Stack>
          ))}
        </Card>
      ))}
      <Group>
        <Button variant="light" size="xs" onClick={props.onAdd}>
          Add {SECTION_ITEM_NAMES[section]}
        </Button>
      </Group>
    </Stack>
  )
}
