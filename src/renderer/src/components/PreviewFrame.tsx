import { useEffect, useRef, useState } from 'react'

const A4_WIDTH_PX = 794 // 210mm at 96 dpi
const A4_HEIGHT_PX = 1123

/**
 * Shows a template's HTML scaled to the column width. No scripts run inside; same-origin access
 * is allowed only so the frame can be sized to its content.
 */
export function PreviewFrame(props: { html: string; title: string }): React.JSX.Element {
  const box = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLIFrameElement>(null)
  const [scale, setScale] = useState(0.6)
  const [height, setHeight] = useState(A4_HEIGHT_PX)

  useEffect(() => {
    const el = box.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setScale(Math.min(1, entry.contentRect.width / A4_WIDTH_PX)))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // The body, not the document: the document is never shorter than the frame, so it could only grow.
  const measure = (): void => {
    const doc = frame.current?.contentDocument
    if (doc) setHeight(Math.max(A4_HEIGHT_PX, doc.body.offsetHeight))
  }

  return (
    <div ref={box} style={{ width: '100%', height: height * scale, overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,.15)' }}>
      <iframe
        ref={frame}
        title={props.title}
        sandbox="allow-same-origin"
        srcDoc={props.html}
        onLoad={measure}
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
