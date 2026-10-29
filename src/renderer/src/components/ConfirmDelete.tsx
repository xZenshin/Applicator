import { Button, Group, Popover, Text } from '@mantine/core'
import { useState } from 'react'

/** A small "Delete" button that asks for confirmation in a popover. */
export function ConfirmDelete(props: { question: string; onConfirm: () => void; label?: string }): React.JSX.Element {
  const [opened, setOpened] = useState(false)
  return (
    <Popover opened={opened} onChange={setOpened} position="bottom-end" withArrow shadow="md">
      <Popover.Target>
        <Button size="compact-xs" variant="subtle" color="red" onClick={() => setOpened((o) => !o)}>
          {props.label ?? 'Delete'}
        </Button>
      </Popover.Target>
      <Popover.Dropdown>
        <Text size="sm" mb="xs">
          {props.question}
        </Text>
        <Group gap="xs" justify="flex-end">
          <Button size="compact-sm" variant="default" onClick={() => setOpened(false)}>
            Cancel
          </Button>
          <Button
            size="compact-sm"
            color="red"
            onClick={() => {
              setOpened(false)
              props.onConfirm()
            }}
          >
            Delete
          </Button>
        </Group>
      </Popover.Dropdown>
    </Popover>
  )
}
