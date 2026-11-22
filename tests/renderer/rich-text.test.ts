import { describe, expect, it } from 'vitest'
import { parseBlocks } from '../../src/renderer/src/lib/rich-text'

describe('parseBlocks', () => {
  it('splits headings, paragraphs and lists', () => {
    const text = '## Overall\nGood start.\nClear answers.\n\n## Strengths\n- One\n- Two\n  continued\n\n1. First\n2. Second'
    expect(parseBlocks(text)).toEqual([
      { kind: 'heading', text: 'Overall' },
      { kind: 'paragraph', lines: ['Good start.', 'Clear answers.'] },
      { kind: 'heading', text: 'Strengths' },
      { kind: 'list', ordered: false, items: ['One', 'Two continued'] },
      { kind: 'list', ordered: true, items: ['First', 'Second'] }
    ])
  })

  it('keeps plain text as paragraphs', () => {
    expect(parseBlocks('Hello.\r\n\r\n\r\nTell me about yourself.')).toEqual([
      { kind: 'paragraph', lines: ['Hello.'] },
      { kind: 'paragraph', lines: ['Tell me about yourself.'] }
    ])
  })

  it('drops bold markers from headings', () => {
    expect(parseBlocks('### **Prepare next**')).toEqual([{ kind: 'heading', text: 'Prepare next' }])
  })
})
