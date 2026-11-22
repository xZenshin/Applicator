import { Fragment } from 'react'
import { parseBlocks } from '../lib/rich-text'

/** **bold** spans; everything else is plain text. */
function inline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((p, i) =>
    p.startsWith('**') && p.endsWith('**') && p.length > 4 ? <strong key={i}>{p.slice(2, -2)}</strong> : <Fragment key={i}>{p}</Fragment>
  )
}

/** Renders the little markdown Claude is asked to use: headings, bullet and numbered lists, and bold. */
export function RichText(props: { text: string }): React.JSX.Element {
  return (
    <div className="k-rich">
      {parseBlocks(props.text).map((b, i) => {
        if (b.kind === 'heading') return <h4 key={i}>{inline(b.text)}</h4>
        if (b.kind === 'list') {
          const items = b.items.map((item, j) => <li key={j}>{inline(item)}</li>)
          return b.ordered ? <ol key={i}>{items}</ol> : <ul key={i}>{items}</ul>
        }
        return (
          <p key={i}>
            {b.lines.map((l, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {inline(l)}
              </Fragment>
            ))}
          </p>
        )
      })}
    </div>
  )
}
