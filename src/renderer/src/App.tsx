import { AppShell, MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { HashRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'
import { Sidebar } from './components/Sidebar'
import { ClaudeStatusProvider } from './hooks/useClaudeStatus'
import NewApplicationPage from './pages/NewApplicationPage'
import ReviewPage from './pages/ReviewPage'
import HistoryPage from './pages/HistoryPage'
import HistoryDetailPage from './pages/HistoryDetailPage'
import ProfilePage from './pages/ProfilePage'
import StylePage from './pages/StylePage'
import SettingsPage from './pages/SettingsPage'
import { cssVariablesResolver, theme } from './theme'

// Keyed by id: switching from one application to another must never reuse the previous one's state.
function ReviewRoute(): React.JSX.Element {
  return <ReviewPage key={useParams().id} />
}

function HistoryDetailRoute(): React.JSX.Element {
  return <HistoryDetailPage key={useParams().id} />
}

function App(): React.JSX.Element {
  return (
    <MantineProvider theme={theme} cssVariablesResolver={cssVariablesResolver} defaultColorScheme="dark">
      <Notifications position="top-right" />
      <HashRouter>
        <ClaudeStatusProvider>
          <AppShell navbar={{ width: 216, breakpoint: 0 }} padding={0} withBorder={false}>
            <AppShell.Navbar className="k-sidebar">
              <Sidebar />
            </AppShell.Navbar>
            <AppShell.Main className="k-main">
              <div className="k-panel">
                <Routes>
              <Route path="/" element={<Navigate to="/new" replace />} />
              <Route path="/new" element={<NewApplicationPage />} />
              <Route path="/review/:id" element={<ReviewRoute />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/history/:id" element={<HistoryDetailRoute />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/style" element={<StylePage />} />
              <Route path="/settings" element={<SettingsPage />} />
                </Routes>
              </div>
            </AppShell.Main>
          </AppShell>
        </ClaudeStatusProvider>
      </HashRouter>
    </MantineProvider>
  )
}

export default App
