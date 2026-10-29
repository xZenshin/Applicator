import { Textarea } from '@mantine/core'
import { useEffect, useState } from 'react'
import { linesToText, textToLines } from '../lib/text-lines'

/**
 * Edits a string[] as one line per entry. Keeps its own text so blank lines survive while typing;
 * re-syncs from `value` only when `resetKey` changes.
 */
export function LinesInput(props: {
  label: string
  value: string[]
  onChange: (lines: string[]) => void
  resetKey: string
  minRows?: number
  disabled?: boolean
}): React.JSX.Element {
  const [text, setText] = useState(linesToText(props.value))

  useEffect(() => {
    setText(linesToText(props.value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.resetKey])

  return (
    <Textarea
      label={props.label}
      disabled={props.disabled}
      autosize
      minRows={props.minRows ?? 2}
      value={text}
      onChange={(e) => {
        setText(e.currentTarget.value)
        props.onChange(textToLines(e.currentTarget.value))
      }}
    />
  )
}
