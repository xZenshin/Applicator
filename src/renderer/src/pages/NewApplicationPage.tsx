import { Alert, Anchor, Button, Card, Group, Loader, SegmentedControl, Stack, Text, Textarea, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { GenerationStage } from '../../../shared/api'
import { isProfileUsable } from '../../../shared/profile-checks'
import { api, errorKind, errorMessage } from '../api'

const JOB_KEY = 'new.jobDescription'
const INSTRUCTIONS_KEY = 'new.instructions'
const OWN_TEXT_KEY = 'new.ownText'
// Not cleared after generating: it is a choice, not content.
const OUTPUT_KEY = 'new.output'

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
  const [ownText, setOwnText] = useSessionState(OWN_TEXT_KEY)
  const [output, setOutput] = useSessionState(OUTPUT_KEY)
  const cvOnly = output === 'cv'
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
      const meta = await api.llm.generate({ jobDescription, instructions, ownText, cvOnly })
      sessionStorage.removeItem(JOB_KEY)
      sessionStorage.removeItem(INSTRUCTIONS_KEY)
      sessionStorage.removeItem(OWN_TEXT_KEY)
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

      <Stack gap={6}>
        <SegmentedControl
          w="fit-content"
          value={cvOnly ? 'cv' : 'both'}
          disabled={running}
          onChange={setOutput}
          data={[
            { value: 'both', label: 'CV and application' },
            { value: 'cv', label: 'CV only' }
          ]}
        />
        {cvOnly && (
          <Text size="sm" c="dimmed">
            For jobs that only ask for a CV. The summary at the top becomes a longer introduction that also says why you
            want the job.
          </Text>
        )}
      </Stack>

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
        label="Your own text (optional)"
        description={
          cvOnly
            ? 'Something you have already written for this application, such as why you want the job. Claude builds the summary at the top of the CV on it and may polish the wording.'
            : 'A section or a draft you have already written for this application. Claude works it into the letter and may polish the wording.'
        }
        placeholder={cvOnly ? 'Paste text you want in the CV’s summary…' : 'Paste text you want in the letter…'}
        autosize
        minRows={4}
        maxRows={20}
        value={ownText}
        disabled={running}
        onChange={(e) => setOwnText(e.currentTarget.value)}
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
            {cvOnly ? 'Generate CV' : 'Generate CV and application'}
          </Button>
          <Text size="sm" c="dimmed">
            {cvOnly ? 'Usually takes under a minute.' : 'Usually takes 1–2 minutes.'}
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
