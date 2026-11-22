import { Alert, Button, Card, SegmentedControl, Stack, Text, Textarea, Title } from '@mantine/core'
import { useState } from 'react'
import type { InterviewFeedback, InterviewMode, InterviewSession } from '../../../shared/types'
import { api, errorMessage } from '../api'

const MODE_TEXT: Record<InterviewMode, string> = {
  interviewer:
    'Claude plays an interviewer from the company. It opens the interview, asks one question at a time and follows up on your answers, based on the job posting, the CV and application you sent, and your prep material.',
  free: "You lead. Write the first message: for example “Ask me five hard questions about my thesis”, “Help me answer ‘Why do you want this job?’” or “Explain what the case in the material is about”."
}

const FEEDBACK_TEXT: Record<InterviewFeedback, string> = {
  end: 'The interviewer stays in character. Click “End & get feedback” for a written evaluation.',
  each: 'After each answer you get a short comment on what worked and what to improve, then the next question.'
}

/** Picks how the session runs; the caller opens the new session. */
export function NewInterviewSessionForm(props: {
  appId: string
  onCreated: (s: InterviewSession) => void
  /** Claude is working on something else. */
  busy: boolean
}): React.JSX.Element {
  const [mode, setMode] = useState<InterviewMode>('interviewer')
  const [feedback, setFeedback] = useState<InterviewFeedback>('end')
  const [focus, setFocus] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const create = async (): Promise<void> => {
    setCreating(true)
    setError(null)
    try {
      props.onCreated(await api.interview.createSession(props.appId, { mode, feedback, focus: mode === 'interviewer' ? focus : '' }))
    } catch (e) {
      setError(errorMessage(e))
      setCreating(false)
    }
  }

  return (
    <Card withBorder padding="lg">
      <Stack gap="md">
        <Title order={3}>New practice session</Title>
        <Stack gap={6}>
          <SegmentedControl
            value={mode}
            onChange={(v) => setMode(v as InterviewMode)}
            data={[
              { value: 'interviewer', label: 'Interviewer asks questions' },
              { value: 'free', label: 'Free-form' }
            ]}
          />
          <Text size="sm" c="dimmed">
            {MODE_TEXT[mode]}
          </Text>
        </Stack>
        {mode === 'interviewer' && (
          <>
            <Stack gap={6}>
              <Text size="sm" fw={500}>
                Feedback
              </Text>
              <SegmentedControl
                value={feedback}
                onChange={(v) => setFeedback(v as InterviewFeedback)}
                data={[
                  { value: 'end', label: 'At the end' },
                  { value: 'each', label: 'After each answer' }
                ]}
              />
              <Text size="sm" c="dimmed">
                {FEEDBACK_TEXT[feedback]}
              </Text>
            </Stack>
            <Textarea
              label="Focus"
              description="Optional. What kind of interview to practise, or what to concentrate on."
              placeholder="e.g. Second interview with the team lead: technical questions about SQL and data modelling."
              autosize
              minRows={2}
              value={focus}
              onChange={(e) => setFocus(e.currentTarget.value)}
            />
          </>
        )}
        <Text size="xs" c="dimmed">
          The session is held in English and saved automatically.
        </Text>
        {error && <Alert color="red">{error}</Alert>}
        <div>
          <Button onClick={create} loading={creating} disabled={mode === 'interviewer' && props.busy}>
            {mode === 'interviewer' ? 'Start interview' : 'Start session'}
          </Button>
        </div>
      </Stack>
    </Card>
  )
}
