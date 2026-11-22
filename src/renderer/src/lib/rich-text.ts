/** One block of the little markdown Claude is asked to use. */
export type Block =
  | { kind: 'heading'; text: string }
  | { kind: 'paragraph'; lines: string[] }
  | { kind: 'list'; ordered: boolean; items: string[] }

const HEADING = /^#{1,4}\s+(.*)$/
const BULLET = /^\s*[-*•]\s+(.*)$/
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/

export function parseBlocks(text: string): Block[] {
  const blocks: Block[] = []
  const last = (): Block | undefined => blocks.at(-1)
  for (const raw of text.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trimEnd()
    let m: RegExpExecArray | null
    if (!line.trim()) {
      blocks.push({ kind: 'paragraph', lines: [] }) // a break; empty paragraphs are dropped below
    } else if ((m = HEADING.exec(line))) {
      blocks.push({ kind: 'heading', text: m[1].replace(/\*\*/g, '') })
    } else if ((m = BULLET.exec(line)) || (m = NUMBERED.exec(line))) {
      const ordered = !BULLET.test(line)
      const prev = last()
      if (prev?.kind === 'list' && prev.ordered === ordered) prev.items.push(m[1])
      else blocks.push({ kind: 'list', ordered, items: [m[1]] })
    } else {
      const prev = last()
      if (prev?.kind === 'paragraph' && prev.lines.length > 0) prev.lines.push(line)
      else if (prev?.kind === 'list' && /^\s+/.test(raw)) prev.items[prev.items.length - 1] += ` ${line.trim()}`
      else blocks.push({ kind: 'paragraph', lines: [line] })
    }
  }
  return blocks.filter((b) => b.kind !== 'paragraph' || b.lines.length > 0)
}
