import { Alert, Anchor, Badge, Button, Divider, Group, Loader, Stack, Text, Title, UnstyledButton } from '@mantine/core'
import { Plus } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import type { ApplicationMeta, InterviewSession, InterviewSessionSummary } from '../../../shared/types'
import { api, errorMessage } from '../api'
import { InterviewChat } from '../components/InterviewChat'
import { InterviewMaterialsPanel } from '../components/InterviewMaterialsPanel'
import { NewInterviewSessionForm } from '../components/NewInterviewSessionForm'
import { useClaudeStatus } from '../hooks/useClaudeStatus'

function SessionItem(props: { s: InterviewSessionSummary; active: boolean; onClick: () => void }): React.JSX.Element {
  const { s } = props
  const kind = s.mode === 'interviewer' ? 'Interviewer' : 'Free-form'
  return (
    <UnstyledButton className="k-session" data-active={props.active || undefined} onClick={props.onClick}>
      <Group gap={6} wrap="nowrap" justify="space-between">
        <Text size="sm" fw={500} truncate>
          {s.title || kind}
        </Text>
        {s.hasReport && (
          <Badge size="xs" variant="light" color="green">
            Feedback
          </Badge>
        )}
      </Group>
      <span className="k-meta">
        {s.title ? `${kind} · ` : ''}
        {new Date(s.createdAt).toLocaleDateString()} · {s.answers} {s.answers === 1 ? 'answer' : 'answers'}
      </span>
    </UnstyledButton>
  )
}

/** Interview practice for one application: prep material and sessions on the left, the open session on the right. */
export default function InterviewWorkspacePage(): React.JSX.Element {
  const params = useParams()
  const appId = params.id ?? ''
  const sessionId = params.sessionId ?? null
  const navigate = useNavigate()
  const location = useLocation()
  const autoStart = (location.state as { autoStart?: boolean } | null)?.autoStart === true
  const { busy } = useClaudeStatus()
  const [meta, setMeta] = useState<ApplicationMeta | null>(null)
  const [sessions, setSessions] = useState<InterviewSessionSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const base = `/interview/${encodeURIComponent(appId)}`
  const refreshSessions = useCallback(() => {
    api.interview.listSessions(appId).then(setSessions, (e) => setError(errorMessage(e)))
  }, [appId])

  useEffect(() => {
    api.applications.get(appId).then((r) => setMeta(r.meta), (e) => setError(errorMessage(e)))
    refreshSessions()
  }, [appId, refreshSessions])

  const openSession = (s: InterviewSession): void => {
    refreshSessions()
    navigate(`${base}/${encodeURIComponent(s.id)}`, { state: { autoStart: s.mode === 'interviewer' } })
  }

  if (error) return <Alert color="red" title="Could not open interview practice">{error}</Alert>
  if (!meta || !sessions) return <Loader />

  return (
    <Stack gap="lg">
      <Stack gap={4}>
        <Anchor component={Link} to="/interview" size="sm" c="dimmed">
          ← Interview practice
        </Anchor>
        <Group gap="xs" align="baseline">
          <Title order={2}>{[meta.company, meta.role].filter(Boolean).join(' — ') || meta.id}</Title>
          <Anchor component={Link} to={`/history/${encodeURIComponent(appId)}`} size="sm">
            View application
          </Anchor>
        </Group>
      </Stack>

      <div className="k-interview">
        <Stack gap="lg" className="k-interview-side">
          <InterviewMaterialsPanel appId={appId} />
          <Divider />
          <Stack gap="xs">
            <Group justify="space-between">
              <Title order={4}>Sessions</Title>
              <Button
                size="compact-sm"
                variant={sessionId ? 'default' : 'filled'}
                leftSection={<Plus size={14} strokeWidth={1.75} />}
                onClick={() => navigate(base)}
              >
                New
              </Button>
            </Group>
            {sessions.length === 0 && (
              <Text size="sm" c="dimmed">
                No sessions yet.
              </Text>
            )}
            {sessions.map((s) => (
              <SessionItem
                key={s.id}
                s={s}
                active={s.id === sessionId}
                onClick={() => navigate(`${base}/${encodeURIComponent(s.id)}`)}
              />
            ))}
          </Stack>
        </Stack>

        <div className="k-interview-main">
          {sessionId ? (
            <InterviewChat
              key={sessionId}
              appId={appId}
              sessionId={sessionId}
              autoStart={autoStart}
              onChanged={refreshSessions}
              onDeleted={() => {
                refreshSessions()
                navigate(base, { replace: true })
              }}
            />
          ) : (
            <NewInterviewSessionForm appId={appId} busy={busy} onCreated={openSession} />
          )}
        </div>
      </div>
    </Stack>
  )
}
