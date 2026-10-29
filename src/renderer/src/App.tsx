import { AppShell, MantineProvider, NavLink, Title } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { HashRouter, Navigate, NavLink as RouterNavLink, Route, Routes, useParams } from 'react-router-dom'
import NewApplicationPage from './pages/NewApplicationPage'
import ReviewPage from './pages/ReviewPage'
import HistoryPage from './pages/HistoryPage'
import HistoryDetailPage from './pages/HistoryDetailPage'
import ProfilePage from './pages/ProfilePage'
import StylePage from './pages/StylePage'
import SettingsPage from './pages/SettingsPage'

// Keyed by id: switching from one application to another must never reuse the previous one's state.
function ReviewRoute(): React.JSX.Element {
  return <ReviewPage key={useParams().id} />
}

function HistoryDetailRoute(): React.JSX.Element {
  return <HistoryDetailPage key={useParams().id} />
}

const NAV = [
  { to: '/new', label: 'New application' },
  { to: '/history', label: 'History' },
  { to: '/profile', label: 'My CV' },
  { to: '/style', label: 'Writing style' },
  { to: '/settings', label: 'Settings' }
]

function App(): React.JSX.Element {
  return (
    <MantineProvider>
      <Notifications position="top-right" />
      <HashRouter>
        <AppShell navbar={{ width: 220, breakpoint: 0 }} padding="lg">
          <AppShell.Navbar p="sm">
            <Title order={4} px="sm" py="md">
              Applicator
            </Title>
            {NAV.map((item) => (
              <RouterNavLink key={item.to} to={item.to} style={{ textDecoration: 'none' }}>
                {({ isActive }) => <NavLink component="span" label={item.label} active={isActive} />}
              </RouterNavLink>
            ))}
          </AppShell.Navbar>
          <AppShell.Main>
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
          </AppShell.Main>
        </AppShell>
      </HashRouter>
    </MantineProvider>
  )
}

export default App
