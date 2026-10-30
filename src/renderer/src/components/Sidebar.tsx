import { ActionIcon, Tooltip, useComputedColorScheme, useMantineColorScheme } from '@mantine/core'
import { FilePlus2, History, Moon, PenLine, SlidersHorizontal, Sun, UserRound, type LucideIcon } from 'lucide-react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useClaudeStatus } from '../hooks/useClaudeStatus'

const NAV: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/new', label: 'New application', icon: FilePlus2 },
  { to: '/history', label: 'History', icon: History },
  { to: '/profile', label: 'My CV', icon: UserRound },
  { to: '/style', label: 'Writing style', icon: PenLine },
  { to: '/settings', label: 'Settings', icon: SlidersHorizontal }
]

/** "Claude connected", a problem, or "Claude is working…"; clicking it opens Settings. */
function ClaudeStatusLine(): React.JSX.Element {
  const navigate = useNavigate()
  const { status, busy } = useClaudeStatus()
  const state = busy ? 'working' : !status ? 'checking' : status.ok ? 'ok' : 'problem'
  const label = busy ? 'Claude is working…' : (status?.label ?? 'Checking Claude…')
  return (
    <Tooltip label={status?.detail ?? 'Checking that Claude Code is installed and logged in.'} multiline w={260} openDelay={400}>
      <button type="button" className="k-status" onClick={() => navigate('/settings')}>
        <span className="k-dot" data-state={state} />
        <span>{label}</span>
      </button>
    </Tooltip>
  )
}

function ThemeToggle(): React.JSX.Element {
  const { setColorScheme } = useMantineColorScheme()
  const scheme = useComputedColorScheme('dark')
  const next = scheme === 'dark' ? 'light' : 'dark'
  return (
    <Tooltip label={`Switch to ${next} mode`} openDelay={400}>
      <ActionIcon variant="subtle" color="gray" size="md" aria-label={`Switch to ${next} mode`} onClick={() => setColorScheme(next)}>
        {scheme === 'dark' ? <Sun size={15} strokeWidth={1.75} /> : <Moon size={15} strokeWidth={1.75} />}
      </ActionIcon>
    </Tooltip>
  )
}

export function Sidebar(): React.JSX.Element {
  return (
    <>
      <div className="k-brand">Applicator</div>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className="k-nav-item">
            <Icon size={16} strokeWidth={1.75} />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="k-sidebar-foot">
        <ClaudeStatusLine />
        <ThemeToggle />
      </div>
    </>
  )
}
