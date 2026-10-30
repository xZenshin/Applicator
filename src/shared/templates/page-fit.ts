/**
 * One A4 page at 96 dpi. On screen the CV's body is at least this tall, with the page margins as padding
 * (base-css.ts), so it is taller only when its content runs past the printed page.
 */
export const A4_HEIGHT_PX = 1123

/** One line of CV body text: 10pt at line-height 1.3 (base-css.ts). */
const CV_LINE_PX = ((10 * 96) / 72) * 1.3

/** How many lines of CV text run past one A4 page, from the rendered body height (0 when it fits). */
export function overflowLines(heightPx: number): number {
  return heightPx <= A4_HEIGHT_PX ? 0 : Math.ceil((heightPx - A4_HEIGHT_PX) / CV_LINE_PX)
}
