import { Alert, Badge, Button, Card, Group, Loader, Stack, Tabs, Text, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { ApplicationRecord } from '../../../shared/types'
import { api, errorMessage } from '../api'
import { ConfirmDelete } from '../components/ConfirmDelete'
import { PreviewFrame } from '../components/PreviewFrame'
import { cvHtml, letterHtml } from '../lib/render'

export default function HistoryDetailPage(): React.JSX.Element {
  const id = useParams().id ?? ''
  const navigate = useNavigate()
  const [record, setRecord] = useState<ApplicationRecord | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.applications.get(id).then(setRecord, (e) => setError(errorMessage(e)))
  }, [id])

  if (error) return <Alert color="red" title="Could not open this application">{error}</Alert>
  if (!record) return <Loader />

  const { meta, draft, profile } = record
  const fail = (e: unknown): void => {
    notifications.show({ color: 'red', message: errorMessage(e) })
  }
  const openFile = (fileName: string): void => {
    api.applications.openFile(id, fileName).catch(fail)
  }
  const letter = letterHtml(profile, draft, new Date(meta.exportedAt ?? meta.updatedAt))

  return (
    <Stack maw={1100} gap="md">
      <Group justify="space-between" align="flex-start">
        <Stack gap={4}>
          <Group gap="xs">
            <Title order={2}>{[meta.company, meta.role].filter(Boolean).join(' — ') || meta.id}</Title>
            <Badge variant="light">{meta.language.toUpperCase()}</Badge>
            {letter === null && (
              <Badge variant="light" color="gray">
                CV only
              </Badge>
            )}
            {meta.exportedAt ? (
              <Badge color="green" variant="light">
                Exported
              </Badge>
            ) : (
              <Badge color="gray" variant="light">
                Draft
              </Badge>
            )}
          </Group>
          <Text size="sm" c="dimmed">
            Created {new Date(meta.createdAt).toLocaleString()}
            {meta.exportedAt && ` · exported ${new Date(meta.exportedAt).toLocaleString()}`}
          </Text>
        </Stack>
        <Group gap="xs">
          <Button onClick={() => navigate(`/review/${encodeURIComponent(id)}`)}>Open in editor</Button>
          {meta.cvPdf && (
            <Button variant="default" onClick={() => openFile(meta.cvPdf!)}>
              Open CV PDF
            </Button>
          )}
          {meta.letterPdf && (
            <Button variant="default" onClick={() => openFile(meta.letterPdf!)}>
              Open application PDF
            </Button>
          )}
          <Button variant="default" onClick={() => api.applications.showFolder(id).catch(fail)}>
            Show folder
          </Button>
          <ConfirmDelete
            question="Move this application to the Recycle Bin?"
            onConfirm={() =>
              api.applications.trash(id).then(() => {
                notifications.show({ message: 'Moved to the Recycle Bin.' })
                navigate('/history')
              }, fail)
            }
          />
        </Group>
      </Group>

      <Tabs defaultValue="job" keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="job">Job description</Tabs.Tab>
          {letter !== null && <Tabs.Tab value="letter">Application</Tabs.Tab>}
          <Tabs.Tab value="cv">CV</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="job" pt="md">
          <Card withBorder padding="lg">
            <Text style={{ whiteSpace: 'pre-wrap' }}>{record.jobDescription}</Text>
          </Card>
        </Tabs.Panel>
        {letter !== null && (
          <Tabs.Panel value="letter" pt="md" maw={820}>
            <PreviewFrame html={letter} title="Application" />
          </Tabs.Panel>
        )}
        <Tabs.Panel value="cv" pt="md" maw={820}>
          <PreviewFrame html={cvHtml(profile, draft)} title="CV" />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  )
}
