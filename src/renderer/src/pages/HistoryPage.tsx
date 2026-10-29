import { Alert, Anchor, Badge, Loader, Stack, Table, Text, TextInput, Title } from '@mantine/core'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { ApplicationMeta } from '../../../shared/types'
import { api, errorMessage } from '../api'
import { filterApplications } from '../lib/history-filter'

export default function HistoryPage(): React.JSX.Element {
  const navigate = useNavigate()
  const [list, setList] = useState<ApplicationMeta[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    api.applications.list().then(setList, (e) => setError(errorMessage(e)))
  }, [])

  const shown = useMemo(() => filterApplications(list ?? [], query), [list, query])

  if (error) return <Alert color="red" title="Could not load your applications">{error}</Alert>
  if (!list) return <Loader />

  return (
    <Stack maw={1100} gap="md">
      <Title order={2}>History</Title>
      {list.length === 0 ? (
        <Text c="dimmed">
          No applications yet. Start with{' '}
          <Anchor component={Link} to="/new">
            New application
          </Anchor>
          .
        </Text>
      ) : (
        <>
          <TextInput placeholder="Search company or role…" value={query} onChange={(e) => setQuery(e.currentTarget.value)} />
          <Table highlightOnHover verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Date</Table.Th>
                <Table.Th>Company</Table.Th>
                <Table.Th>Role</Table.Th>
                <Table.Th>Language</Table.Th>
                <Table.Th>Status</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {shown.map((m) => (
                <Table.Tr
                  key={m.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/history/${encodeURIComponent(m.id)}`)}
                >
                  <Table.Td>{new Date(m.createdAt).toLocaleDateString()}</Table.Td>
                  <Table.Td>{m.company || '—'}</Table.Td>
                  <Table.Td>{m.role || '—'}</Table.Td>
                  <Table.Td>
                    <Badge variant="outline" size="sm">
                      {m.language.toUpperCase()}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    {m.exportedAt ? (
                      <Badge color="green" variant="light">
                        Exported
                      </Badge>
                    ) : (
                      <Badge color="gray" variant="light">
                        Draft
                      </Badge>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
          {shown.length === 0 && <Text c="dimmed">No applications match “{query}”.</Text>}
        </>
      )}
    </Stack>
  )
}
