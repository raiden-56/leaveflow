import { createSlice, nanoid, type PayloadAction } from '@reduxjs/toolkit';
import type { ThemeMode } from '@/theme';

export type ToastSeverity = 'success' | 'error' | 'info' | 'warning';
export interface Toast {
  id: string;
  message: string;
  severity: ToastSeverity;
  title?: string;
}

interface UiState {
  sidebarCollapsed: boolean;
  mobileNavOpen: boolean;
  themeMode: ThemeMode;
  toasts: Toast[];
}

const STORAGE_KEY = 'leaveflow.ui';

function loadPrefs(): Pick<UiState, 'sidebarCollapsed' | 'themeMode'> {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    return { sidebarCollapsed: Boolean(raw.sidebarCollapsed), themeMode: raw.themeMode === 'dark' ? 'dark' : 'light' };
  } catch {
    return { sidebarCollapsed: false, themeMode: 'light' };
  }
}

export function persistPrefs(state: UiState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ sidebarCollapsed: state.sidebarCollapsed, themeMode: state.themeMode }));
  } catch {
    /* storage unavailable — preferences are a convenience only */
  }
}

const initialState: UiState = { ...loadPrefs(), mobileNavOpen: false, toasts: [] };

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleSidebar(s) {
      s.sidebarCollapsed = !s.sidebarCollapsed;
    },
    setMobileNav(s, a: PayloadAction<boolean>) {
      s.mobileNavOpen = a.payload;
    },
    toggleTheme(s) {
      s.themeMode = s.themeMode === 'light' ? 'dark' : 'light';
    },
    pushToast: {
      reducer(s, a: PayloadAction<Toast>) {
        s.toasts = [...s.toasts.slice(-3), a.payload];
      },
      prepare(t: Omit<Toast, 'id'>) {
        return { payload: { ...t, id: nanoid() } };
      },
    },
    dismissToast(s, a: PayloadAction<string>) {
      s.toasts = s.toasts.filter((t) => t.id !== a.payload);
    },
  },
});

export const { toggleSidebar, setMobileNav, toggleTheme, pushToast, dismissToast } = uiSlice.actions;
export default uiSlice.reducer;
