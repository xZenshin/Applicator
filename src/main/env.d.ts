// Vite inlines `?inline` imports as data URLs (used for the CV fonts in shared/templates/fonts.ts).
declare module '*?inline' {
  const src: string
  export default src
}

// Vite inlines `?raw` imports as strings (used for the vendored Humanizer guide in llm/humanize.ts).
declare module '*?raw' {
  const text: string
  export default text
}
