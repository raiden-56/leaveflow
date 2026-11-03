import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMediaQuery, useTheme } from '@mui/material';
import { todayIso, type Role } from '@leaveflow/shared';
import { useAppDispatch, useAppSelector } from '@/app/store';
import { pushToast } from '@/app/store/uiSlice';
import type { ApiError } from '@/services/api/httpClient';

export function useAuth() {
  const user = useAppSelector((s) => s.auth.user);
  const settings = useAppSelector((s) => s.auth.settings);
  const hasRole = useCallback((...roles: Role[]) => Boolean(user && roles.includes(user.role)), [user]);
  return {
    user,
    settings,
    hasRole,
    isManager: user?.role === 'MANAGER' || user?.role === 'ADMIN',
    isAdmin: user?.role === 'ADMIN',
  };
}

/** Today's date in the organisation timezone. */
export function useToday(): string {
  const tz = useAppSelector((s) => s.auth.settings?.timezone);
  return useMemo(() => todayIso(tz), [tz]);
}

export function useToast() {
  const dispatch = useAppDispatch();
  return useMemo(
    () => ({
      success: (message: string, title?: string) => dispatch(pushToast({ message, title, severity: 'success' })),
      info: (message: string, title?: string) => dispatch(pushToast({ message, title, severity: 'info' })),
      warning: (message: string, title?: string) => dispatch(pushToast({ message, title, severity: 'warning' })),
      error: (err: unknown, fallback = 'Something went wrong') => {
        const message = (err as ApiError)?.message ?? (typeof err === 'string' ? err : fallback);
        dispatch(pushToast({ message, severity: 'error' }));
      },
    }),
    [dispatch],
  );
}

export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function useResponsive() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'lg'));
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));
  return { isMobile, isTablet, isDesktop, isCompact: isMobile || isTablet };
}

/** Runs a mutation and shows a success toast or the API error. Returns true on success. */
export function useAction() {
  const toast = useToast();
  return useCallback(
    async <T,>(promise: Promise<T>, success?: string): Promise<T | undefined> => {
      try {
        const result = await promise;
        if (success) toast.success(success);
        return result;
      } catch (err) {
        toast.error(err);
        return undefined;
      }
    },
    [toast],
  );
}
