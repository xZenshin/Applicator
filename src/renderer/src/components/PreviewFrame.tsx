import { useEffect, useRef, useState } from 'react'
import type { Highlight } from '../../../shared/types'
import { makeHighlight } from '../lib/highlight'

const A4_WIDTH_PX = 794 // 210mm at 96 dpi
const A4_HEIGHT_PX = 1123

/** What is highlighted in the preview (null if nothing), and where the selection ends, in window coordinates. */
export interface PreviewHighlight {
  highlight: Highlight | null
  x: number
  y: number
}

/**
 * Shows a template's HTML scaled to the column width. No scripts run inside; same-origin access
 * is allowed so the frame can be sized to its content and its text selection read.
 */
export function PreviewFrame(props: {
  html: string
  title: string
  /** Called after each mouse or keyboard selection in the preview. */
  onHighlight?: (h: PreviewHighlight) => void
}): React.JSX.Element {
  const box = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLIFrameElement>(null)
  const [scale, setScale] = useState(0.6)
  const [height, setHeight] = useState(A4_HEIGHT_PX)
  const onHighlight = useRef(props.onHighlight)

  useEffect(() => {
    onHighlight.current = props.onHighlight
  })

  useEffect(() => {
    const el = box.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setScale(Math.min(1, entry.contentRect.width / A4_WIDTH_PX)))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // The body, not the document: the document is never shorter than the frame, so it could only grow.
  const measure = (doc: Document): void => setHeight(Math.max(A4_HEIGHT_PX, doc.body.offsetHeight))

  // Each srcDoc change loads a new document, so the listeners are added again on every load.
  const load = (): void => {
    const iframe = frame.current
    const doc = iframe?.contentDocument
    if (!iframe || !doc) return
    measure(doc)
    const report = (): void => onHighlight.current?.(readHighlight(iframe, doc))
    doc.addEventListener('mouseup', report)
    doc.addEventListener('keyup', report)
  }

  return (
    <div ref={box} style={{ width: '100%', height: height * scale, overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,.15)' }}>
      <iframe
        ref={frame}
        title={props.title}
        sandbox="allow-same-origin"
        srcDoc={props.html}
        onLoad={load}
        style={{
          width: A4_WIDTH_PX,
          height,
          border: 0,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          background: '#fff'
        }}
      />
    </div>
  )
}

/** The selected text, with the rest of its paragraph or bullet as context. */
function readHighlight(iframe: HTMLIFrameElement, doc: Document): PreviewHighlight {
  const selection = doc.getSelection()
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return { highlight: null, x: 0, y: 0 }
  const range = selection.getRangeAt(0)

  const common = range.commonAncestorContainer
  const element = common.nodeType === Node.ELEMENT_NODE ? (common as Element) : common.parentElement
  const block = element?.closest('p, li') ?? doc.body
  const before = doc.createRange()
  before.selectNodeContents(block)
  before.setEnd(range.startContainer, range.startOffset)
  const after = doc.createRange()
  after.selectNodeContents(block)
  after.setStart(range.endContainer, range.endOffset)

  // Inside the frame, coordinates are unscaled; the frame itself is scaled from its top-left corner.
  const frameBox = iframe.getBoundingClientRect()
  const scale = frameBox.width / A4_WIDTH_PX
  const rects = range.getClientRects()
  const end = rects.length > 0 ? rects[rects.length - 1] : range.getBoundingClientRect()
  return {
    highlight: makeHighlight(before.toString(), selection.toString(), after.toString()),
    x: frameBox.left + end.right * scale,
    y: frameBox.top + end.bottom * scale
  }
}
