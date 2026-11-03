import { alpha, createTheme, type Theme } from '@mui/material/styles';
import { darkPalette, palette } from './tokens';

export type ThemeMode = 'light' | 'dark';

export function createAppTheme(mode: ThemeMode): Theme {
  const dark = mode === 'dark';
  const bg = dark ? darkPalette.background : palette.background;
  const surface = dark ? darkPalette.surface : palette.surface;
  const border = dark ? darkPalette.border : palette.border;
  const text = dark ? darkPalette.text : palette.text;
  const textSecondary = dark ? darkPalette.textSecondary : palette.textSecondary;

  return createTheme({
    palette: {
      mode,
      primary: { main: palette.indigo, dark: palette.indigoDark, light: dark ? '#818CF8' : palette.primaryLight, contrastText: '#fff' },
      secondary: { main: palette.teal, contrastText: '#fff' },
      success: { main: palette.approved },
      warning: { main: palette.pending },
      error: { main: palette.rejected },
      info: { main: palette.inProgress },
      background: { default: bg, paper: surface },
      text: { primary: text, secondary: textSecondary },
      divider: border,
    },
    shape: { borderRadius: 8 },
    typography: {
      fontFamily: '"Inter", "Segoe UI", system-ui, -apple-system, sans-serif',
      h1: { fontWeight: 700 },
      h2: { fontWeight: 700 },
      h3: { fontWeight: 700, fontSize: '1.75rem' },
      h4: { fontWeight: 700, fontSize: '1.5rem', letterSpacing: '-0.01em' },
      h5: { fontWeight: 700, fontSize: '1.25rem' },
      h6: { fontWeight: 600, fontSize: '1.05rem' },
      subtitle1: { fontWeight: 600 },
      subtitle2: { fontWeight: 600, fontSize: '0.875rem' },
      body2: { fontSize: '0.875rem' },
      button: { textTransform: 'none', fontWeight: 600 },
      overline: { fontWeight: 700, letterSpacing: '0.08em' },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: { backgroundColor: bg },
          '*::-webkit-scrollbar': { width: 8, height: 8 },
          '*::-webkit-scrollbar-thumb': { backgroundColor: alpha(textSecondary, 0.3), borderRadius: 8 },
          '@media (prefers-reduced-motion: reduce)': {
            '*, *::before, *::after': { animationDuration: '0.01ms !important', transitionDuration: '0.01ms !important' },
          },
        },
      },
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: { root: { backgroundImage: 'none' }, outlined: { borderColor: border } },
      },
      MuiCard: {
        defaultProps: { variant: 'outlined' },
        styleOverrides: { root: { borderColor: border, borderRadius: 8 } },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: { borderRadius: 8, paddingInline: 16, transition: 'transform 120ms ease, background-color 150ms ease, box-shadow 150ms ease' },
          containedPrimary: { boxShadow: `0 4px 14px ${alpha(palette.indigo, 0.25)}`, '&:hover': { boxShadow: `0 6px 18px ${alpha(palette.indigo, 0.35)}` } },
        },
      },
      MuiIconButton: { styleOverrides: { root: { borderRadius: 8 } } },
      MuiChip: { styleOverrides: { root: { fontWeight: 600, borderRadius: 8 } } },
      MuiTextField: { defaultProps: { size: 'small' } },
      MuiSelect: { defaultProps: { size: 'small' } },
      MuiOutlinedInput: {
        styleOverrides: {
          root: { borderRadius: 8, backgroundColor: surface },
          notchedOutline: { borderColor: border },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: { borderColor: border, paddingTop: 12, paddingBottom: 12 },
          head: { fontWeight: 600, color: textSecondary, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', backgroundColor: dark ? '#0F172A' : '#F8FAFC' },
        },
      },
      MuiTableRow: {
        styleOverrides: { root: { transition: 'background-color 150ms ease', '&.MuiTableRow-hover:hover': { backgroundColor: alpha(palette.indigo, dark ? 0.12 : 0.04) } } },
      },
      MuiTooltip: { styleOverrides: { tooltip: { backgroundColor: palette.navy, fontSize: 12, borderRadius: 8 } } },
      MuiDialog: { styleOverrides: { paper: { borderRadius: 8 } } },
      MuiDrawer: { styleOverrides: { paper: { borderColor: border } } },
      MuiTabs: { styleOverrides: { indicator: { height: 3, borderRadius: 3 } } },
      MuiTab: { styleOverrides: { root: { textTransform: 'none', fontWeight: 600, minHeight: 44 } } },
      MuiLinearProgress: { styleOverrides: { root: { borderRadius: 8, height: 8 }, bar: { borderRadius: 8 } } },
      MuiAlert: { styleOverrides: { root: { borderRadius: 8 } } },
      // Design rule: no corner radius above 8px (perfect circles such as avatars and status dots excepted).
      MuiBadge: { styleOverrides: { standard: { borderRadius: 8 } } },
      MuiToggleButtonGroup: { styleOverrides: { root: { borderRadius: 8 } } },
      MuiPopover: { styleOverrides: { paper: { borderRadius: 8 } } },
      MuiMenu: { styleOverrides: { paper: { borderRadius: 8 } } },
      MuiSkeleton: { styleOverrides: { rounded: { borderRadius: 8 } } },
    },
  });
}
