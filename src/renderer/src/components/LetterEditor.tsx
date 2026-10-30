import { Stack, TextInput, Textarea } from '@mantine/core'
import { useEffect, useState } from 'react'
import type { ApplicationLetter } from '../../../shared/types'
import { paragraphsToText, textToParagraphs } from '../lib/cv-edit'

export function LetterEditor(props: {
  letter: ApplicationLetter
  onChange: (letter: ApplicationLetter) => void
  resetKey: number
  disabled?: boolean
}): React.JSX.Element {
  const { letter, onChange } = props
  const [body, setBody] = useState(paragraphsToText(letter.paragraphs))

  useEffect(() => {
    setBody(paragraphsToText(letter.paragraphs))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.resetKey])

  return (
    <Stack gap="sm">
      <TextInput disabled={props.disabled} label="Greeting" value={letter.greeting} onChange={(e) => onChange({ ...letter, greeting: e.currentTarget.value })} />
      <Textarea
        label="Body"
        disabled={props.disabled}
        description="Separate paragraphs with a blank line."
        autosize
        minRows={12}
        value={body}
        onChange={(e) => {
          setBody(e.currentTarget.value)
          onChange({ ...letter, paragraphs: textToParagraphs(e.currentTarget.value) })
        }}
      />
      <TextInput
        label="Sign-off"
        disabled={props.disabled}
        description="Your name is added below it."
        value={letter.signOff}
        onChange={(e) => onChange({ ...letter, signOff: e.currentTarget.value })}
      />
    </Stack>
  )
}
