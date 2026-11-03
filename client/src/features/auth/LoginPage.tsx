import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Box, Card, Chip, Divider, IconButton, InputAdornment, Stack, TextField, Typography, alpha } from '@mui/material';
import { motion } from 'framer-motion';
import { CalendarCheck2, Eye, EyeOff, Handshake, LogIn, ShieldCheck, UsersRound } from 'lucide-react';
import { ROLE_LABELS, loginSchema, type LoginInput } from '@leaveflow/shared';
import { useAppDispatch, useAppSelector } from '@/app/store';
import { login } from '@/app/store/authSlice';
import { LoadingButton } from '@/components/common';
import { Logo } from '@/components/layout/Sidebar';
import { authRepository, type DemoAccounts } from '@/services/repositories';
import { isBrowserDemo } from '@/services/api/httpClient';
import { palette } from '@/theme/tokens';
import { EmployeeAvatar } from '@/components/common';

const FEATURES = [
  { icon: CalendarCheck2, title: 'Smart leave requests', text: 'Weekends, holidays and balances calculated for you.' },
  { icon: Handshake, title: 'Mandatory work handovers', text: 'Every absence has a named backup and a task list.' },
  { icon: UsersRound, title: 'Team availability', text: 'See who is in, who is away and who is covering.' },
];

export default function LoginPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { status, error } = useAppSelector((s) => s.auth);
  const [showPassword, setShowPassword] = useState(false);
  const [demo, setDemo] = useState<DemoAccounts | null>(null);
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  useEffect(() => {
    authRepository.demoAccounts().then(setDemo).catch(() => setDemo(null));
  }, []);

  if (status === 'authenticated') {
    const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/dashboard';
    return <Navigate to={from} replace />;
  }

  const onSubmit = handleSubmit(async (values) => {
    const result = await dispatch(login(values));
    if (login.fulfilled.match(result)) navigate((location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/dashboard', { replace: true });
  });

  const fillDemo = (email: string) => {
    setValue('email', email, { shouldValidate: true });
    if (demo?.passwordHint) setValue('password', demo.passwordHint, { shouldValidate: true });
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.1fr 1fr' }, bgcolor: 'background.default' }}>
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          justifyContent: 'space-between',
          p: 6,
          color: '#fff',
          background: `radial-gradient(circle at 20% 20%, ${alpha(palette.indigo, 0.55)}, transparent 45%), radial-gradient(circle at 80% 80%, ${alpha(palette.teal, 0.45)}, transparent 40%), ${palette.navy}`,
        }}
      >
        <Logo />
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Typography variant="h3" sx={{ fontWeight: 800, maxWidth: 480, lineHeight: 1.15 }}>
            Time off, without dropping the ball.
          </Typography>
          <Typography sx={{ mt: 2, maxWidth: 460, color: alpha('#fff', 0.75) }}>
            LeaveFlow connects leave approvals with work handovers so your team always knows who is covering what.
          </Typography>
          <Stack spacing={2.5} sx={{ mt: 5 }}>
            {FEATURES.map((f, i) => (
              <motion.div key={f.title} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.1 }}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Box sx={{ width: 44, height: 44, borderRadius: 1, display: 'grid', placeItems: 'center', bgcolor: alpha('#fff', 0.1), border: `1px solid ${alpha('#fff', 0.15)}` }}>
                    <f.icon size={20} />
                  </Box>
                  <Box>
                    <Typography fontWeight={700}>{f.title}</Typography>
                    <Typography variant="body2" sx={{ color: alpha('#fff', 0.7) }}>{f.text}</Typography>
                  </Box>
                </Stack>
              </motion.div>
            ))}
          </Stack>
        </motion.div>
        <Typography variant="caption" sx={{ color: alpha('#fff', 0.5) }}>
          © {new Date().getFullYear()} LeaveFlow · Excel-backed demo edition
        </Typography>
      </Box>

      <Stack alignItems="center" justifyContent="center" sx={{ p: { xs: 2, sm: 4 } }}>
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }} style={{ width: '100%', maxWidth: 440 }}>
          <Box sx={{ display: { xs: 'flex', md: 'none' }, justifyContent: 'center', mb: 3, p: 2, borderRadius: 1, bgcolor: palette.navy }}>
            <Logo />
          </Box>
          <Card sx={{ p: { xs: 3, sm: 4 }, boxShadow: '0 24px 60px rgba(15,23,42,0.08)' }}>
            <Typography variant="h4">Welcome back</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, mb: 3 }}>
              Sign in to manage your leave and handovers.
            </Typography>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <Box component="form" onSubmit={onSubmit} noValidate>
              <Stack spacing={2}>
                <TextField label="Work email" type="email" autoComplete="username" autoFocus fullWidth size="medium" {...register('email')} error={!!errors.email} helperText={errors.email?.message} />
                <TextField
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  fullWidth
                  size="medium"
                  {...register('password')}
                  error={!!errors.password}
                  helperText={errors.password?.message}
                  slotProps={{
                    input: {
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton onClick={() => setShowPassword((v) => !v)} edge="end" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    },
                  }}
                />
                <LoadingButton type="submit" variant="contained" size="large" fullWidth loading={isSubmitting} startIcon={<LogIn size={18} />}>
                  Sign in
                </LoadingButton>
              </Stack>
            </Box>

            {demo?.enabled && demo.accounts.length > 0 && (
              <>
                <Divider sx={{ my: 3 }}>
                  <Chip size="small" icon={<ShieldCheck size={14} />} label="Demo accounts" />
                </Divider>
                <Stack spacing={1}>
                  {demo.accounts.map((a) => (
                    <Box
                      key={a.email}
                      component="button"
                      type="button"
                      onClick={() => fillDemo(a.email)}
                      sx={{ all: 'unset', boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 1.5, p: 1.25, borderRadius: 1, border: 1, borderColor: 'divider', cursor: 'pointer', transition: 'all 150ms', '&:hover': { borderColor: 'primary.main', bgcolor: 'primary.light' }, '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main' } }}
                    >
                      <EmployeeAvatar name={a.name} size={34} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={600} noWrap>{a.name}</Typography>
                        <Typography variant="caption" color="text.secondary" noWrap component="div">{a.email}</Typography>
                      </Box>
                      <Chip size="small" label={ROLE_LABELS[a.role]} color={a.role === 'ADMIN' ? 'secondary' : a.role === 'MANAGER' ? 'primary' : 'default'} />
                    </Box>
                  ))}
                </Stack>
                <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1.5 }}>
                  {isBrowserDemo
                    ? <>Demo password: <b>{demo.passwordHint}</b>. Any active employee in this browser’s demo workbook can sign in.</>
                    : demo.passwordHint
                      ? <>Demo password: <b>{demo.passwordHint}</b> (configured in server/.env). Any active employee in the workbook can sign in.</>
                      : 'The demo password is configured in server/.env (DEMO_PASSWORD).'}
                </Typography>
              </>
            )}
          </Card>
          {isBrowserDemo && <BrowserDemoNote />}
        </motion.div>
      </Stack>
    </Box>
  );
}

/** Shown on the static GitHub Pages build, where the API runs inside the browser. */
function BrowserDemoNote() {
  const [resetting, setResetting] = useState(false);
  const reset = async () => {
    setResetting(true);
    const { resetDemoData } = await import('@/services/local/localServer');
    await resetDemoData();
    window.location.reload();
  };
  return (
    <Alert severity="info" sx={{ mt: 2 }} action={<LoadingButton size="small" color="inherit" loading={resetting} onClick={reset}>Reset data</LoadingButton>}>
      Live demo: the API and the Excel workbook run in your browser, and changes are saved on this device. HR can download the workbook as .xlsx from Settings.
    </Alert>
  );
}
