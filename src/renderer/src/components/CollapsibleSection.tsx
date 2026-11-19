import { Badge, Collapse, Group, Stack, Text, Title, UnstyledButton } from '@mantine/core'
import { useLocalStorage } from '@mantine/hooks'

interface Props {
  title: string
  /** Shown next to the title, e.g. the number of items. */
  count: string | number
  /** Where the hidden/shown state is remembered between visits. */
  storageKey: string
  order?: 3 | 4
  gap?: 'xs' | 'sm'
  children: React.ReactNode
}

/** A section whose heading hides or shows its content, so long sections stay out of the way. */
export function CollapsibleSection(props: Props): React.JSX.Element {
  const [collapsed, setCollapsed] = useLocalStorage({ key: props.storageKey, defaultValue: false })
  const gap = props.gap ?? 'sm'

  return (
    <Stack gap={gap}>
      <UnstyledButton onClick={() => setCollapsed((c) => !c)} aria-expanded={!collapsed}>
        <Group gap="xs" wrap="nowrap">
          <Text c="dimmed" w={16} ta="center" aria-hidden>
            {collapsed ? '▸' : '▾'}
          </Text>
          <Title order={props.order ?? 3}>{props.title}</Title>
          <Badge size="sm" variant="light" color="gray">
            {props.count}
          </Badge>
          {collapsed && (
            <Text size="xs" c="dimmed">
              Hidden: click to show
            </Text>
          )}
        </Group>
      </UnstyledButton>
      <Collapse expanded={!collapsed}>
        <Stack gap={gap}>{props.children}</Stack>
      </Collapse>
    </Stack>
  )
}
