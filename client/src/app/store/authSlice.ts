import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import type { AuthUser, OrgSettings } from '@leaveflow/shared';
import { authRepository } from '@/services/repositories';
import type { ApiError } from '@/services/api/httpClient';
import { api } from './api';

type Status = 'idle' | 'checking' | 'authenticated' | 'anonymous';

interface AuthState {
  user: AuthUser | null;
  settings: OrgSettings | null;
  status: Status;
  error: string | null;
}

const initialState: AuthState = { user: null, settings: null, status: 'idle', error: null };

/** Restores the session from the httpOnly cookie on page load. */
export const bootstrapSession = createAsyncThunk('auth/bootstrap', async () => authRepository.me());

export const login = createAsyncThunk<{ user: AuthUser; settings: OrgSettings }, { email: string; password: string }, { rejectValue: string }>(
  'auth/login',
  async ({ email, password }, { rejectWithValue, dispatch }) => {
    try {
      await authRepository.login(email, password);
      dispatch(api.util.resetApiState());
      return await authRepository.me();
    } catch (err) {
      return rejectWithValue((err as ApiError).message);
    }
  },
);

export const logout = createAsyncThunk('auth/logout', async (_: void, { dispatch }) => {
  try {
    await authRepository.logout();
  } finally {
    dispatch(api.util.resetApiState());
  }
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    sessionExpired(state) {
      state.user = null;
      state.status = 'anonymous';
      state.error = 'Your session has expired. Please sign in again.';
    },
    settingsUpdated(state, action: { payload: OrgSettings }) {
      state.settings = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(bootstrapSession.pending, (s) => {
        s.status = 'checking';
      })
      .addCase(bootstrapSession.fulfilled, (s, a) => {
        s.user = a.payload.user;
        s.settings = a.payload.settings;
        s.status = 'authenticated';
      })
      .addCase(bootstrapSession.rejected, (s) => {
        s.user = null;
        s.status = 'anonymous';
      })
      .addCase(login.pending, (s) => {
        s.error = null;
      })
      .addCase(login.fulfilled, (s, a) => {
        s.user = a.payload.user;
        s.settings = a.payload.settings;
        s.status = 'authenticated';
        s.error = null;
      })
      .addCase(login.rejected, (s, a) => {
        s.error = a.payload ?? 'Unable to sign in';
      })
      .addCase(logout.fulfilled, (s) => {
        s.user = null;
        s.status = 'anonymous';
      })
      .addCase(logout.rejected, (s) => {
        s.user = null;
        s.status = 'anonymous';
      });
  },
});

export const { sessionExpired, settingsUpdated } = authSlice.actions;
export default authSlice.reducer;
