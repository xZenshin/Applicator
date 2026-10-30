// Vite inlines `?inline` imports as data URLs (used for the CV fonts in shared/templates/fonts.ts).
declare module '*?inline' {
  const src: string
  export default src
}
