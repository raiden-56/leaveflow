import { Alert, Box, Card, Chip, Divider, FormControlLabel, Grid, LinearProgress, Stack, Switch, Typography, alpha } from '@mui/material';
import { motion } from 'framer-motion';
import { BellRing, Briefcase, Building2, CalendarDays, KeyRound, Mail, MapPin, Moon, PanelLeftClose, Phone, UserRound, Wifi } from 'lucide-react';
import { ROLE_LABELS, WORK_MODES } from '@leaveflow/shared';
import { useAppDispatch, useAppSelector } from '@/app/store';
import { toggleSidebar, toggleTheme } from '@/app/store/uiSlice';
import { useMyBalancesQuery } from '@/app/store/api';
import { CardsSkeleton, EmployeeAvatar, ErrorState, PageHeader, SectionCard } from '@/components/common';
import { useAuth } from '@/hooks';
import { fmtDate } from '@/utils/format';

const WORK_MODE_LABEL: Record<(typeof WORK_MODES)[number], string> = { OFFICE: 'In office', REMOTE: 'Remote', HYBRID: 'Hybrid' };

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value?: React.ReactNode }) {
  return (
    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ py: 1 }}>
      <Box sx={{ width: 34, height: 34, borderRadius: 1, display: 'grid', placeItems: 'center', bgcolor: 'primary.light', color: 'primary.main', flexShrink: 0 }}>{icon}</Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
        <Typography variant="body2" fontWeight={600} noWrap>{value || '—'}</Typography>
      </Box>
    </Stack>
  );
}

/** Personal profile, leave balances and appearance preferences. */
export default function ProfileSettingsPage() {
  const dispatch = useAppDispatch();
  const { user, settings } = useAuth();
  const themeMode = useAppSelector((s) => s.ui.themeMode);
  const collapsed = useAppSelector((s) => s.ui.sidebarCollapsed);
  const { data: balances, isLoading, error, refetch } = useMyBalancesQuery({ employeeId: user?.employeeId ?? '' }, { skip: !user });
  if (!user) return null;

  const tracked = (balances ?? []).filter((b) => b.trackBalance);
  const notificationPrefs = settings
    ? [
        { label: 'In-app notifications', on: settings.notifyInApp },
        { label: 'Email notifications', on: settings.notifyEmail },
        { label: 'Leave start reminders', on: settings.notifyLeaveStartReminder },
        { label: 'Overdue task alerts', on: settings.notifyTaskOverdue },
      ]
    : [];

  return (
    <Box>
      <PageHeader title="Settings" subtitle="Your profile, leave balances and preferences" icon={<UserRound size={22} />} />
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, lg: 4 }}>
          <Card sx={{ overflow: 'hidden' }}>
            <Box sx={{ height: 84, background: (t) => `linear-gradient(120deg, ${t.palette.primary.main}, ${t.palette.secondary.main})` }} />
            <Stack alignItems="center" sx={{ mt: -5, px: 2.5, pb: 2.5 }}>
              <EmployeeAvatar name={user.employeeName} image={user.profileImage} size={84} sx={{ border: 4, borderColor: 'background.paper' }} />
              <Typography variant="h5" sx={{ mt: 1.5 }}>{user.employeeName}</Typography>
              <Typography variant="body2" color="text.secondary">{user.designation}</Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                <Chip size="small" label={ROLE_LABELS[user.role]} color="primary" variant="outlined" />
                <Chip size="small" label={user.employeeId} variant="outlined" />
              </Stack>
            </Stack>
            <Divider />
            <Box sx={{ px: 2.5, py: 1.5 }}>
              <InfoRow icon={<Mail size={16} />} label="Email" value={user.email} />
              <InfoRow icon={<Phone size={16} />} label="Phone" value={user.phone} />
              <InfoRow icon={<Building2 size={16} />} label="Department" value={user.department} />
              <InfoRow icon={<Briefcase size={16} />} label="Reporting manager" value={user.managerName || 'None'} />
              <InfoRow icon={<CalendarDays size={16} />} label="Joined" value={fmtDate(user.joiningDate)} />
              <InfoRow icon={<Wifi size={16} />} label="Work mode" value={WORK_MODE_LABEL[user.workMode]} />
              <InfoRow icon={<MapPin size={16} />} label="Location" value={user.location} />
            </Box>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 8 }}>
          <Stack spacing={2.5}>
            <SectionCard title="My leave balances" subtitle={balances?.[0] ? `Leave year ${balances[0].year}` : undefined}>
              {error ? (
                <ErrorState error={error} onRetry={refetch} />
              ) : isLoading ? (
                <CardsSkeleton count={4} height={92} />
              ) : (
                <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', xl: 'repeat(3, 1fr)' } }}>
                  {tracked.map((b, i) => {
                    const pct = b.total ? Math.min(100, ((b.used + b.pending) / b.total) * 100) : 0;
                    return (
                      <motion.div key={b.balanceId} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} whileHover={{ y: -2 }}>
                        <Box sx={{ p: 1.75, border: 1, borderColor: 'divider', borderRadius: 1, borderTop: `3px solid ${b.color}` }}>
                          <Stack direction="row" justifyContent="space-between" alignItems="baseline">
                            <Typography variant="body2" fontWeight={600} noWrap>{b.leaveTypeName}</Typography>
                            <Typography variant="h6">{b.available}</Typography>
                          </Stack>
                          <LinearProgress variant="determinate" value={pct} sx={{ my: 1, height: 6, bgcolor: alpha(b.color, 0.12), '& .MuiLinearProgress-bar': { bgcolor: b.color } }} />
                          <Typography variant="caption" color="text.secondary">
                            {b.used} used · {b.pending} pending · {b.total} total{b.carriedForward ? ` (incl. ${b.carriedForward} carried)` : ''}
                          </Typography>
                        </Box>
                      </motion.div>
                    );
                  })}
                </Box>
              )}
            </SectionCard>

            <Grid container spacing={2.5}>
              <Grid size={{ xs: 12, md: 6 }}>
                <SectionCard title="Appearance">
                  <Stack spacing={1}>
                    <FormControlLabel
                      control={<Switch checked={themeMode === 'dark'} onChange={() => dispatch(toggleTheme())} />}
                      label={<Stack direction="row" spacing={1} alignItems="center"><Moon size={16} /><span>Dark mode</span></Stack>}
                    />
                    <FormControlLabel
                      control={<Switch checked={collapsed} onChange={() => dispatch(toggleSidebar())} />}
                      label={<Stack direction="row" spacing={1} alignItems="center"><PanelLeftClose size={16} /><span>Collapsed sidebar (desktop)</span></Stack>}
                    />
                    <Typography variant="caption" color="text.secondary">
                      Preferences are saved in this browser. Animations follow your operating system's reduced-motion setting.
                    </Typography>
                  </Stack>
                </SectionCard>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <SectionCard title="Notifications" subtitle="Configured by HR for the organisation">
                  <Stack spacing={1}>
                    {notificationPrefs.map((p) => (
                      <Stack key={p.label} direction="row" justifyContent="space-between" alignItems="center">
                        <Stack direction="row" spacing={1} alignItems="center"><BellRing size={15} /><Typography variant="body2">{p.label}</Typography></Stack>
                        <Chip size="small" label={p.on ? 'On' : 'Off'} color={p.on ? 'success' : 'default'} variant="outlined" sx={{ height: 22 }} />
                      </Stack>
                    ))}
                    {settings && (
                      <Typography variant="caption" color="text.secondary">Notifications refresh every {settings.notificationPollSeconds} seconds.</Typography>
                    )}
                  </Stack>
                </SectionCard>
              </Grid>
            </Grid>

            <Alert severity="info" icon={<KeyRound size={18} />}>
              This demo uses configurable demo authentication: every active employee signs in with the shared demo password set in
              <code> server/.env </code>(DEMO_PASSWORD). Profile details are managed by HR in the Employees module.
            </Alert>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
}
