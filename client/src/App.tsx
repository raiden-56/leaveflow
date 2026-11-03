import { useEffect, useMemo } from 'react';
import { RouterProvider } from 'react-router-dom';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { MotionConfig } from 'framer-motion';
import 'dayjs/locale/en-in';
import { useAppDispatch, useAppSelector } from '@/app/store';
import { bootstrapSession, sessionExpired } from '@/app/store/authSlice';
import { router } from '@/app/routes';
import { Toaster } from '@/components/common';
import { setUnauthorizedHandler } from '@/services/api/httpClient';
import { createAppTheme } from '@/theme';

export default function App() {
  const dispatch = useAppDispatch();
  const mode = useAppSelector((s) => s.ui.themeMode);
  const theme = useMemo(() => createAppTheme(mode), [mode]);

  useEffect(() => {
    setUnauthorizedHandler(() => dispatch(sessionExpired()));
    void dispatch(bootstrapSession());
  }, [dispatch]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="en-in">
        {/* reducedMotion="user" disables transform animations when the OS asks for reduced motion */}
        <MotionConfig reducedMotion="user">
          <RouterProvider router={router} />
          <Toaster />
        </MotionConfig>
      </LocalizationProvider>
    </ThemeProvider>
  );
}
