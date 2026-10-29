/** Words = whitespace-separated tokens that contain a letter or digit (so "–" doesn't count). */
export function countWords(text: string): number {
  return text.split(/\s+/).filter((t) => /[\p{L}\p{N}]/u.test(t)).length
}
