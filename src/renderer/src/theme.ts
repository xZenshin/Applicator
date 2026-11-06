import {
  createTheme,
  defaultVariantColorsResolver,
  type CSSVariablesResolver,
  type MantineColorsTuple,
  type VariantColorsResolver
} from '@mantine/core'

// Apple neutrals, as in Kensaku. Mantine reads dark-0 as text, dark-2 as dimmed and dark-7 as the body in dark mode.
const gray: MantineColorsTuple = ['#f5f5f7', '#ececee', '#e3e3e6', '#d2d2d7', '#b9b9be', '#a1a1a6', '#86868b', '#6e6e73', '#48484a', '#1d1d1f']
const dark: MantineColorsTuple = ['#f5f5f7', '#c7c7cc', '#98989d', '#636366', '#48484a', '#3a3a3c', '#2c2c2e', '#1c1c1e', '#161618', '#0b0b0c']

/** The primary colour is graphite: near-black in light mode, near-white in dark (set per scheme below). */
const ink: MantineColorsTuple = gray

/** A filled graphite control flips with the scheme, so its text must flip too. */
const variantColorResolver: VariantColorsResolver = (input) => {
  const colors = defaultVariantColorsResolver(input)
  const isInk = (input.color ?? input.theme.primaryColor) === 'ink'
  return isInk && input.variant === 'filled' ? { ...colors, color: 'var(--mantine-primary-color-contrast)' } : colors
}

export const theme = createTheme({
  primaryColor: 'ink',
  colors: { ink, gray, dark },
  white: '#ffffff',
  black: '#1d1d1f',
  fontFamily: '"Inter Variable", "Segoe UI", system-ui, sans-serif',
  fontFamilyMonospace: '"JetBrains Mono Variable", ui-monospace, Consolas, monospace',
  headings: {
    fontFamily: '"Inter Variable", "Segoe UI", system-ui, sans-serif',
    fontWeight: '600',
    sizes: {
      h1: { fontSize: '28px', lineHeight: '34px' },
      h2: { fontSize: '24px', lineHeight: '30px' },
      h3: { fontSize: '17px', lineHeight: '24px' },
      h4: { fontSize: '15px', lineHeight: '22px' }
    }
  },
  // Kensaku's type scale: 11 meta, 13 body, 15 lead, 20 title.
  fontSizes: { xs: '11px', sm: '13px', md: '13px', lg: '15px', xl: '20px' },
  // 4 small, 6 controls, 8 fields, 10 panels, 12 sheets.
  radius: { xs: '4px', sm: '6px', md: '8px', lg: '10px', xl: '12px' },
  defaultRadius: 'sm',
  cursorType: 'pointer',
  variantColorResolver,
  components: {
    Card: { defaultProps: { radius: 'lg' } },
    Paper: { defaultProps: { radius: 'lg' } },
    Alert: { defaultProps: { radius: 'lg' } },
    Notification: { defaultProps: { radius: 'lg' } },
    Popover: { defaultProps: { radius: 'lg' } },
    Tabs: { defaultProps: { variant: 'pills' } }
  }
})

const inkVariables = (scheme: { fg: string; hover: string; soft: string; softHover: string; contrast: string }): Record<string, string> => ({
  '--mantine-primary-color-contrast': scheme.contrast,
  '--mantine-color-ink-filled': scheme.fg,
  '--mantine-color-ink-filled-hover': scheme.hover,
  '--mantine-color-ink-light': scheme.soft,
  '--mantine-color-ink-light-hover': scheme.softHover,
  '--mantine-color-ink-light-color': scheme.fg,
  '--mantine-color-ink-outline': scheme.fg,
  '--mantine-color-ink-outline-hover': scheme.soft,
  '--mantine-color-ink-text': scheme.fg
})

// The tokens change with the scheme, so these mappings are the same in both.
const neutrals: Record<string, string> = {
  '--mantine-color-body': 'var(--k-panel)',
  '--mantine-color-text': 'var(--k-fg)',
  '--mantine-color-bright': 'var(--k-fg)',
  '--mantine-color-dimmed': 'var(--k-muted)',
  '--mantine-color-placeholder': 'var(--k-subtle)',
  '--mantine-color-anchor': 'var(--k-fg)',
  '--mantine-color-default': 'var(--k-soft)',
  '--mantine-color-default-hover': 'var(--k-soft-hover)',
  '--mantine-color-default-color': 'var(--k-fg)',
  '--mantine-color-default-border': 'var(--k-line)',
  '--mantine-color-disabled': 'var(--k-soft)',
  '--mantine-color-disabled-color': 'var(--k-subtle)',
  '--mantine-color-disabled-border': 'var(--k-line)',
  // Grey tags and buttons get a soft fill, not a near-black block in dark mode.
  '--mantine-color-gray-light': 'var(--k-soft)',
  '--mantine-color-gray-light-hover': 'var(--k-soft-hover)',
  '--mantine-color-gray-light-color': 'var(--k-muted)'
}

/** Mantine's own colour variables, pointed at Kensaku's tokens (styles/kensaku.css). */
export const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {},
  light: {
    ...neutrals,
    ...inkVariables({ fg: '#1d1d1f', hover: '#3a3a3c', soft: 'rgba(0, 0, 0, 0.045)', softHover: 'rgba(0, 0, 0, 0.075)', contrast: '#ffffff' })
  },
  dark: {
    ...neutrals,
    ...inkVariables({ fg: '#f5f5f7', hover: '#d2d2d7', soft: 'rgba(255, 255, 255, 0.06)', softHover: 'rgba(255, 255, 255, 0.1)', contrast: '#0b0b0c' })
  }
})
