import { Alert, Badge, Button, Card, Group, Loader, Stack, Text, Textarea, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { Send } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { InterviewMessage, InterviewSession } from '../../../shared/types'
import { api, errorKind, errorMessage } from '../api'
import { useClaudeStatus } from '../hooks/useClaudeStatus'
import { ConfirmDelete } from './ConfirmDelete'
import { RichText } from './RichText'

type Pending = 'reply' | 'report' | null

/** In "feedback after each answer" sessions, the interviewer's message starts with a "Feedback:" paragraph. */
function splitFeedback(text: string): { feedback: string | null; rest: string } {
  const m = /^\s*\**feedback:?\**:?\s*([\s\S]*?)\n\s*\n([\s\S]*)$/i.exec(text)
  return m ? { feedback: m[1].trim(), rest: m[2].trim() } : { feedback: null, rest: text }
}

function Message(props: { message: InterviewMessage; name: string; withFeedback: boolean }): React.JSX.Element {
  const { message } = props
  if (message.role === 'user') {
    return (
      <div className="k-msg" data-role="user">
        <div className="k-msg-body" style={{ whiteSpace: 'pre-wrap' }}>
          {message.text}
        </div>
      </div>
    )
  }
  const { feedback, rest } = props.withFeedback ? splitFeedback(message.text) : { feedback: null, rest: message.text }
  return (
    <div className="k-msg" data-role="assistant">
      <span className="k-meta">{props.name}</span>
      {feedback && (
        <div className="k-msg-feedback">
          <span className="k-meta">Feedback</span>
          <RichText text={feedback} />
        </div>
      )}
      <div className="k-msg-body">
        <RichText text={rest} />
      </div>
    </div>
  )
}

/** One saved practice session: the conversation, the composer and the feedback report. */
export function InterviewChat(props: {
  appId: string
  sessionId: string
  /** Ask the interviewer for the opening message as soon as the session is loaded. */
  autoStart: boolean
  /** Must be stable: the opening message is requested from the first render. */
  onChanged: (s: InterviewSession) => void
  onDeleted: () => void
}): React.JSX.Element {
  const { appId, sessionId } = props
  const { busy } = useClaudeStatus()
  const [session, setSession] = useState<InterviewSession | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [pending, setPending] = useState<Pending>(null)
  const [sending, setSending] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const mounted = useRef(true)
  const started = useRef(false)
  const endRef = useRef<HTMLDivElement>(null)

  const update = (s: InterviewSession): void => {
    if (!mounted.current) return
    setSession(s)
    props.onChanged(s)
  }

  const send = async (text: string): Promise<void> => {
    setPending('reply')
    setError(null)
    setSending(text || null)
    setDraft('')
    try {
      update(await api.interview.send(appId, sessionId, text))
    } catch (e) {
      // The message is saved before Claude is asked, unless the call failed before that (e.g. Claude was busy).
      // An earlier failed reply can leave a user message last, so compare the text, not just the role.
      const fresh = await api.interview.getSession(appId, sessionId).catch(() => null)
      if (fresh) update(fresh)
      const last = fresh?.messages.at(-1)
      const saved = last?.role === 'user' && last.text === text
      if (text && !saved && mounted.current) setDraft(text)
      if (mounted.current) setError(errorKind(e) === 'cancelled' ? 'Cancelled.' : errorMessage(e))
    } finally {
      if (mounted.current) {
        setPending(null)
        setSending(null)
      }
    }
  }

  const report = async (): Promise<void> => {
    setPending('report')
    setError(null)
    try {
      update(await api.interview.report(appId, sessionId))
    } catch (e) {
      if (errorKind(e) === 'cancelled') notifications.show({ message: 'Feedback cancelled.' })
      else if (mounted.current) setError(errorMessage(e))
    } finally {
      if (mounted.current) setPending(null)
    }
  }

  useEffect(() => {
    mounted.current = true
    api.interview.getSession(appId, sessionId).then(
      (s) => {
        if (!mounted.current) return
        setSession(s)
        if (props.autoStart && s.mode === 'interviewer' && s.messages.length === 0 && !started.current) {
          started.current = true
          void send('')
        }
      },
      (e) => setLoadError(errorMessage(e))
    )
    return () => {
      mounted.current = false
    }
    // Runs once per session; the component is keyed by session id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const messageCount = session?.messages.length ?? 0
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messageCount, pending, session?.report?.at])

  if (loadError) return <Alert color="red" title="Could not open this session">{loadError}</Alert>
  if (!session) return <Loader />

  const interviewer = session.mode === 'interviewer'
  const name = interviewer ? 'Interviewer' : 'Claude'
  const last = session.messages.at(-1)
  const answers = session.messages.filter((m) => m.role === 'user').length
  // The interviewer hasn't opened yet, or the last reply failed or was cancelled.
  const needsReply = !pending && (last?.role === 'user' || (interviewer && !last))
  const canWrite = !pending && !(interviewer && !last)
  const submit = (): void => {
    if (draft.trim() && canWrite && !busy) void send(draft.trim())
  }

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Stack gap={4}>
          <Group gap="xs">
            <Title order={3}>{interviewer ? 'Practice interview' : 'Free-form session'}</Title>
            {interviewer && (
              <Badge variant="light" color="gray">
                {session.feedback === 'each' ? 'Feedback after each answer' : 'Feedback at the end'}
              </Badge>
            )}
          </Group>
          <Text size="sm" c="dimmed">
            Started {new Date(session.createdAt).toLocaleString()}
            {session.focus && ` · Focus: ${session.focus}`}
          </Text>
        </Stack>
        {/* Hidden while Claude answers: the reply would be saved into a session the user just deleted. */}
        {!pending && (
        <ConfirmDelete
          question="Move this practice session to the Recycle Bin?"
          onConfirm={() =>
            api.interview.deleteSession(appId, sessionId).then(props.onDeleted, (e) =>
              notifications.show({ color: 'red', message: errorMessage(e) })
            )
          }
        />
        )}
      </Group>

      <div className="k-chat">
        {session.messages.length === 0 && !pending && !interviewer && (
          <Text c="dimmed" size="sm">
            Write what you want to practise below. Claude knows the job posting, the CV and application you sent, and your prep
            material.
          </Text>
        )}
        {session.messages.map((m, i) => (
          <Message key={i} message={m} name={name} withFeedback={interviewer && session.feedback === 'each'} />
        ))}
        {sending && <Message message={{ role: 'user', text: sending, at: '' }} name="" withFeedback={false} />}
        {pending && (
          <Group gap="xs">
            <Loader size="xs" />
            <Text size="sm" c="dimmed">
              {pending === 'report'
                ? 'Writing your feedback…'
                : interviewer && !last
                  ? 'The interviewer is getting ready…'
                  : `${name} is thinking…`}
            </Text>
            <Button size="compact-xs" variant="default" onClick={() => api.llm.cancel()}>
              Cancel
            </Button>
          </Group>
        )}
        {needsReply && (
          <Group gap="xs">
            <Button size="xs" variant="default" onClick={() => send('')} disabled={busy}>
              {interviewer && !last ? 'Start the interview' : `Get ${name.toLowerCase()}'s reply`}
            </Button>
          </Group>
        )}
        {session.report && (
          <Card withBorder padding="lg" className="k-report">
            <Group justify="space-between" mb="xs">
              <Title order={3}>Feedback</Title>
              <span className="k-meta">{new Date(session.report.at).toLocaleString()}</span>
            </Group>
            <RichText text={session.report.text} />
          </Card>
        )}
        <div ref={endRef} />
      </div>

      <div className="k-composer">
        {error && (
          <Alert color={error === 'Cancelled.' ? 'gray' : 'red'} mb="xs" withCloseButton onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        <Group align="flex-end" wrap="nowrap" gap="xs">
          <Textarea
            style={{ flex: 1 }}
            autosize
            minRows={2}
            maxRows={10}
            placeholder={
              interviewer
                ? 'Your answer… (Enter to send, Shift+Enter for a new line)'
                : 'Your message… (Enter to send, Shift+Enter for a new line)'
            }
            value={draft}
            disabled={!canWrite}
            onChange={(e) => setDraft(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                submit()
              }
            }}
          />
          <Stack gap={6}>
            <Button onClick={submit} disabled={!draft.trim() || !canWrite || busy} leftSection={<Send size={14} strokeWidth={1.75} />}>
              Send
            </Button>
            <Button variant="default" onClick={report} disabled={answers === 0 || !!pending || busy}>
              {session.report ? 'Update feedback' : interviewer ? 'End & get feedback' : 'Get feedback'}
            </Button>
          </Stack>
        </Group>
      </div>
    </Stack>
  )
}
