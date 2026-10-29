import { Alert, Anchor, Button, Card, Group, Loader, Stack, Text, Textarea, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { GenerationStage } from '../../../shared/api'
import { isProfileUsable } from '../../../shared/profile-checks'
import { api, errorKind, errorMessage } from '../api'

const JOB_KEY = 'new.jobDescription'
const INSTRUCTIONS_KEY = 'new.instructions'

const STAGE_TEXT: Record<GenerationStage, string> = {
  tailoring: 'Analyzing the job and tailoring your CV…',
  writing: 'Writing your application…'
}

/** State mirrored into sessionStorage so navigating away doesn't lose a pasted posting. */
function useSessionState(key: string): [string, (v: string) => void] {
  const [value, setValue] = useState(() => sessionStorage.getItem(key) ?? '')
  return [
    value,
    (v) => {
      setValue(v)
      sessionStorage.setItem(key, v)
    }
  ]
}

export default function NewApplicationPage(): React.JSX.Element {
  const navigate = useNavigate()
  const [jobDescription, setJobDescription] = useSessionState(JOB_KEY)
  const [instructions, setInstructions] = useSessionState(INSTRUCTIONS_KEY)
  const [profileUsable, setProfileUsable] = useState<boolean | null>(null)
  const [running, setRunning] = useState(false)
  const [stage, setStage] = useState<GenerationStage | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    api.profile.get().then(
      (p) => setProfileUsable(isProfileUsable(p)),
      (e) => setError(errorMessage(e))
    )
  }, [])

  useEffect(() => {
    if (!running) return
    const started = Date.now()
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000)
    const unsubscribe = api.llm.onProgress(setStage)
    return () => {
      clearInterval(timer)
      unsubscribe()
    }
  }, [running])

  const generate = async (): Promise<void> => {
    setError(null)
    setStage(null)
    setElapsed(0)
    setRunning(true)
    try {
      const meta = await api.llm.generate({ jobDescription, instructions })
      sessionStorage.removeItem(JOB_KEY)
      sessionStorage.removeItem(INSTRUCTIONS_KEY)
      const path = `/review/${encodeURIComponent(meta.id)}`
      if (mounted.current) {
        navigate(path)
      } else {
        // The user moved on (maybe into another application's editor): don't pull them away.
        notifications.show({
          color: 'green',
          autoClose: false,
          title: 'Application ready',
          message: (
            <Group gap="xs" mt={4}>
              <Text size="sm">{[meta.company, meta.role].filter(Boolean).join(' — ')}</Text>
              <Button size="compact-xs" variant="light" onClick={() => (window.location.hash = `#${path}`)}>
                Open
              </Button>
            </Group>
          )
        })
      }
    } catch (e) {
      if (errorKind(e) === 'cancelled') notifications.show({ message: 'Generation cancelled.' })
      else if (mounted.current) setError(errorMessage(e))
      else notifications.show({ color: 'red', title: 'Could not generate', message: errorMessage(e), autoClose: false })
    } finally {
      if (mounted.current) setRunning(false)
    }
  }

  return (
    <Stack maw={980} gap="lg">
      <Title order={2}>New application</Title>

      {profileUsable === false && (
        <Alert color="yellow" title="Your CV data is not ready">
          Add your name and at least one experience, education or skill on{' '}
          <Anchor component={Link} to="/profile">
            My CV
          </Anchor>{' '}
          first.
        </Alert>
      )}

      <Textarea
        label="Job description"
        placeholder="Paste the full job posting here…"
        autosize
        minRows={14}
        maxRows={30}
        value={jobDescription}
        disabled={running}
        onChange={(e) => setJobDescription(e.currentTarget.value)}
      />
      <Textarea
        label="Extra instructions for this application (optional)"
        placeholder="e.g. Emphasise my leadership experience. Mention that I'm relocating to Aarhus."
        autosize
        minRows={2}
        value={instructions}
        disabled={running}
        onChange={(e) => setInstructions(e.currentTarget.value)}
      />

      {running ? (
        <Card withBorder padding="md">
          <Group justify="space-between">
            <Group gap="sm">
              <Loader size="sm" />
              <Text>{stage ? STAGE_TEXT[stage] : 'Starting Claude…'}</Text>
              <Text c="dimmed" size="sm">
                {elapsed} s
              </Text>
            </Group>
            <Button variant="default" onClick={() => api.llm.cancel()}>
              Cancel
            </Button>
          </Group>
        </Card>
      ) : (
        <Group>
          <Button size="md" onClick={generate} disabled={!profileUsable || !jobDescription.trim()}>
            Generate CV and application
          </Button>
          <Text size="sm" c="dimmed">
            Usually takes 1–2 minutes.
          </Text>
        </Group>
      )}

      {error && (
        <Alert color="red" title="Could not generate">
          {error}
        </Alert>
      )}
    </Stack>
  )
}
