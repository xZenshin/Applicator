import '@fontsource-variable/inter'
import '@fontsource-variable/jetbrains-mono'
import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import './styles/kensaku.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
