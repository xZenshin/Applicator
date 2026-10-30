import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    // The one-page check renders the CV in the main process, so Cabin must be bundled there as data, not required at runtime.
    build: { externalizeDeps: { exclude: ['@fontsource/cabin'] } }
  },
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react()]
  }
})
