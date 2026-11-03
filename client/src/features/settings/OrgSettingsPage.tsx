import { useEffect, type ReactNode } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  FormControlLabel,
  Grid,
  IconButton,
  MenuItem,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { Controller, useForm, type Control } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import dayjs from 'dayjs';
import { Bell, Building2, CalendarCog, Database, Download, FileSpreadsheet, HardDriveDownload, PlayCircle, Save, ScrollText, ShieldCheck, Undo2 } from 'lucide-react';
import { settingsInputSchema, type OrgSettings } from '@leaveflow/shared';
import { useAuditLogsQuery, useCreateBackupMutation, useRunLifecycleMutation, useSettingsQuery, useUpdateSettingsMutation, useWorkbookInfoQuery } from '@/app/store/api';
import { useAppDispatch } from '@/app/store';
import { settingsUpdated } from '@/app/store/authSlice';
import { DataTable, ErrorState, LoadingButton, PageHeader, PageSkeleton, SectionCard, TableSkeleton, type Column } from '@/components/common';
import { useAction, useToast } from '@/hooks';
import { systemRepository } from '@/services/repositories';
import type { AuditLog } from '@leaveflow/shared';
import { fmtDateTime, fromNow } from '@/utils/format';

const DAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
];
const MONTHS = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: dayjs().month(i).format('MMMM') }));
const TIMEZONES = ['Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Europe/London', 'Europe/Berlin', 'America/New_York', 'America/Los_Angeles', 'UTC'];

function bytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function Toggle({ control, name, label, help }: { control: Control<OrgSettings>; name: keyof OrgSettings; label: string; help: string }) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <FormControlLabel
          sx={{ alignItems: 'flex-start', m: 0, width: '100%', justifyContent: 'space-between', gap: 2 }}
          labelPlacement="start"
          control={<Switch checked={Boolean(field.value)} onChange={(e) => field.onChange(e.target.checked)} />}
          label={
            <Box>
              <Typography variant="body2" fontWeight={600}>{label}</Typography>
              <Typography variant="caption" color="text.secondary">{help}</Typography>
            </Box>
          }
        />
      )}
    />
  );
}

function Section({ icon, title, subtitle, children }: { icon: ReactNode; title: string; subtitle: string; children: ReactNode }) {
  return (
    <SectionCard
      title={
        <Stack direction="row" spacing={1.25} alignItems="center">
          <Box sx={{ width: 34, height: 34, borderRadius: 1, display: 'grid', placeItems: 'center', bgcolor: 'primary.light', color: 'primary.main' }}>{icon}</Box>
          <Box>
            <Typography variant="h6">{title}</Typography>
            <Typography variant="caption" color="text.secondary">{subtitle}</Typography>
          </Box>
        </Stack>
      }
    >
      {children}
    </SectionCard>
  );
}

function WorkbookSection({ control }: { control: Control<OrgSettings> }) {
  const run = useAction();
  const toast = useToast();
  const { data, isLoading, error, refetch } = useWorkbookInfoQuery();
  const [backup, backupState] = useCreateBackupMutation();
  const [lifecycle, lifecycleState] = useRunLifecycleMutation();

  return (
    <Section icon={<Database size={18} />} title="Excel workbook" subtitle="Primary data store. Every write is backed up and saved atomically.">
      {isLoading && <TableSkeleton rows={4} />}
      {error && <ErrorState error={error} onRetry={refetch} />}
      {data && (
        <Stack spacing={2}>
          <Grid container spacing={2}>
            <Grid size={12}>
              <Typography variant="caption" color="text.secondary">File</Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{data.filePath}</Typography>
            </Grid>
            <Grid size={{ xs: 4 }}>
              <Typography variant="caption" color="text.secondary">Provider</Typography>
              <Typography variant="body2" fontWeight={600} sx={{ textTransform: 'capitalize' }}>{data.provider}</Typography>
            </Grid>
            <Grid size={{ xs: 4 }}>
              <Typography variant="caption" color="text.secondary">Size</Typography>
              <Typography variant="body2" fontWeight={600}>{bytes(data.sizeBytes)}</Typography>
            </Grid>
            <Grid size={{ xs: 4 }}>
              <Typography variant="caption" color="text.secondary">Last saved</Typography>
              <Tooltip title={fmtDateTime(data.lastModified)}><Typography variant="body2" fontWeight={600}>{fromNow(data.lastModified)}</Typography></Tooltip>
            </Grid>
          </Grid>
          <Stack direction="row" flexWrap="wrap" useFlexGap spacing={0.75}>
            {data.sheets.map((s) => <Chip key={s.name} size="small" variant="outlined" label={`${s.name} · ${s.rows}`} />)}
          </Stack>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <LoadingButton variant="outlined" size="small" startIcon={<HardDriveDownload size={15} />} loading={backupState.isLoading} onClick={() => run(backup().unwrap(), 'Backup created')}>
              Create backup now
            </LoadingButton>
            <Button variant="outlined" size="small" startIcon={<FileSpreadsheet size={15} />} onClick={() => run(systemRepository.downloadWorkbook(), 'Workbook downloaded')}>
              Download workbook
            </Button>
            <LoadingButton
              variant="outlined"
              size="small"
              startIcon={<PlayCircle size={15} />}
              loading={lifecycleState.isLoading}
              onClick={async () => {
                const r = await run(lifecycle().unwrap());
                if (r) toast.success(`${r.reminders} reminder(s), ${r.completed} handover(s) completed, ${r.overdue} overdue alert(s)`, 'Lifecycle jobs finished');
              }}
            >
              Run lifecycle jobs now
            </LoadingButton>
          </Stack>
          <Controller
            name="backupRetentionCount"
            control={control}
            render={({ field, fieldState }) => (
              <TextField {...field} type="number" label="Backups to keep" sx={{ maxWidth: 220 }} error={!!fieldState.error} helperText={fieldState.error?.message ?? 'Oldest backups are pruned automatically'} slotProps={{ htmlInput: { min: 1, max: 200 } }} />
            )}
          />
          <Divider />
          <Typography variant="subtitle2">Recent backups ({data.backups.length})</Typography>
          {data.backups.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No backups yet — one is created automatically before every change.</Typography>
          ) : (
            <Box sx={{ maxHeight: 260, overflowY: 'auto', border: 1, borderColor: 'divider', borderRadius: 1 }}>
              <Table size="small">
                <TableBody>
                  {data.backups.slice(0, 50).map((b) => (
                    <TableRow key={b.fileName} hover>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all' }}>{b.fileName}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap', display: { xs: 'none', sm: 'table-cell' } }}>{fmtDateTime(b.createdAt)}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap', display: { xs: 'none', sm: 'table-cell' } }}>{bytes(b.sizeBytes)}</TableCell>
                      <TableCell align="right">
                        <Tooltip title="Download backup">
                          <IconButton size="small" onClick={() => run(systemRepository.downloadBackup(b.fileName))} aria-label={`Download ${b.fileName}`}><Download size={15} /></IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
        </Stack>
      )}
    </Section>
  );
}

function AuditSection() {
  const { data, isLoading, error, refetch } = useAuditLogsQuery({ limit: 300 });
  const columns: Column<AuditLog & { actorName: string }>[] = [
    { id: 'time', label: 'When', sortValue: (r) => r.timestamp, render: (r) => <Tooltip title={fmtDateTime(r.timestamp)}><span>{fromNow(r.timestamp)}</span></Tooltip> },
    { id: 'actor', label: 'Actor', sortValue: (r) => r.actorName, render: (r) => r.actorName },
    { id: 'action', label: 'Action', sortValue: (r) => r.action, render: (r) => <Chip size="small" label={r.action.replace(/_/g, ' ').toLowerCase()} sx={{ textTransform: 'capitalize', height: 22, fontSize: 11 }} /> },
    { id: 'entity', label: 'Entity', sortValue: (r) => `${r.entityType} ${r.entityId}`, render: (r) => `${r.entityType} ${r.entityId}` },
    { id: 'details', label: 'Details', hideBelow: 'lg', searchValue: (r) => r.details, render: (r) => <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', maxWidth: 360 }}>{r.details}</Typography> },
  ];
  return (
    <DataTable
      title={<Stack direction="row" spacing={1} alignItems="center"><ScrollText size={18} /><Typography variant="h6">Audit log</Typography></Stack>}
      rows={data}
      columns={columns}
      rowKey={(r) => r.auditId}
      loading={isLoading}
      error={error}
      onRetry={refetch}
      initialSort={{ id: 'time', direction: 'desc' }}
      searchPlaceholder="Search actions, actors…"
      emptyTitle="No audit entries yet"
    />
  );
}

export default function OrgSettingsPage() {
  const run = useAction();
  const dispatch = useAppDispatch();
  const { data, isLoading, error, refetch } = useSettingsQuery();
  const [save, saveState] = useUpdateSettingsMutation();
  const { control, register, handleSubmit, reset, formState: { errors, isDirty } } = useForm<OrgSettings>({
    resolver: zodResolver(settingsInputSchema) as never,
  });
  useEffect(() => {
    if (data) reset(data);
  }, [data, reset]);

  if (isLoading) return <PageSkeleton />;
  if (error || !data) return <ErrorState error={error} onRetry={refetch} />;

  const submit = handleSubmit(async (values) => {
    const result = await run(save(values).unwrap(), 'Settings saved');
    if (result) {
      dispatch(settingsUpdated(result));
      reset(result);
    }
  });

  return (
    <Box component="form" onSubmit={submit} noValidate>
      <PageHeader
        title="Settings"
        icon={<ShieldCheck size={22} />}
        subtitle="Organisation, working days, approval rules, notifications and the Excel data store."
        actions={
          <>
            <Button color="inherit" startIcon={<Undo2 size={16} />} disabled={!isDirty} onClick={() => reset(data)}>Discard</Button>
            <LoadingButton type="submit" variant="contained" startIcon={<Save size={16} />} loading={saveState.isLoading} disabled={!isDirty}>Save changes</LoadingButton>
          </>
        }
      />
      {isDirty && <Alert severity="info" sx={{ mb: 2 }}>You have unsaved changes.</Alert>}

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <Section icon={<Building2 size={18} />} title="Organisation" subtitle="Shown in exports and notifications">
            <Stack spacing={2}>
              <TextField fullWidth label="Organisation name" {...register('organizationName')} error={!!errors.organizationName} helperText={errors.organizationName?.message} />
              <TextField fullWidth label="HR contact email" {...register('organizationEmail')} error={!!errors.organizationEmail} helperText={errors.organizationEmail?.message} />
              <TextField fullWidth multiline minRows={2} label="Address" {...register('organizationAddress')} error={!!errors.organizationAddress} helperText={errors.organizationAddress?.message} />
            </Stack>
          </Section>
        </Grid>

        <Grid size={{ xs: 12, lg: 6 }}>
          <Section icon={<CalendarCog size={18} />} title="Working days & calendar" subtitle="Used to calculate chargeable leave days">
            <Stack spacing={2}>
              <Controller
                name="workingDays"
                control={control}
                render={({ field, fieldState }) => (
                  <Box>
                    <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>Working days</Typography>
                    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap role="group" aria-label="Working days">
                      {DAYS.map((d) => {
                        const on = (field.value ?? []).includes(d.value);
                        return (
                          <Chip
                            key={d.value}
                            label={d.label}
                            color={on ? 'primary' : 'default'}
                            variant={on ? 'filled' : 'outlined'}
                            aria-pressed={on}
                            onClick={() => field.onChange(on ? field.value.filter((x) => x !== d.value) : [...(field.value ?? []), d.value].sort())}
                            sx={{ minWidth: 56 }}
                          />
                        );
                      })}
                    </Stack>
                    {fieldState.error && <Typography variant="caption" color="error.main">{fieldState.error.message}</Typography>}
                  </Box>
                )}
              />
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Controller name="timezone" control={control} render={({ field }) => (
                    <TextField select fullWidth label="Timezone" {...field} value={field.value ?? ''}>
                      {[...new Set([field.value, ...TIMEZONES].filter(Boolean))].map((tz) => <MenuItem key={tz} value={tz}>{tz}</MenuItem>)}
                    </TextField>
                  )} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Controller name="fiscalYearStartMonth" control={control} render={({ field }) => (
                    <TextField select fullWidth label="Leave year starts in" {...field} value={field.value ?? 1}>
                      {MONTHS.map((m) => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
                    </TextField>
                  )} />
                </Grid>
              </Grid>
              <Typography variant="caption" color="text.secondary">Holidays are managed on the Holidays page.</Typography>
            </Stack>
          </Section>
        </Grid>

        <Grid size={{ xs: 12, lg: 6 }}>
          <Section icon={<ShieldCheck size={18} />} title="Approval configuration" subtitle="Rules applied by the leave & handover workflow">
            <Stack spacing={2} divider={<Divider flexItem />}>
              <Toggle control={control} name="requireHandover" label="Work handover is mandatory" help="Every leave request must name a backup employee" />
              <Toggle control={control} name="requireHandoverAcceptanceBeforeApproval" label="Require handover acceptance before approval" help="Managers can only approve once the backup has accepted" />
              <Toggle control={control} name="allowSelfApprovalForAdmins" label="Allow HR admins to approve their own leave" help="Otherwise another admin or manager must approve" />
              <Toggle control={control} name="autoCompleteHandovers" label="Auto-complete handovers" help="Mark handovers completed when the employee returns" />
              <Toggle control={control} name="remoteWorkEnabled" label="Show remote-working status" help="Display remote/hybrid staff in team availability" />
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField fullWidth type="number" label="Team overlap warning (%)" {...register('teamOverlapWarningPercent')} error={!!errors.teamOverlapWarningPercent} helperText={errors.teamOverlapWarningPercent?.message ?? 'Warn approvers above this share of the team away'} slotProps={{ htmlInput: { min: 0, max: 100 } }} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField fullWidth type="number" label="Backup overload threshold" {...register('backupOverloadThreshold')} error={!!errors.backupOverloadThreshold} helperText={errors.backupOverloadThreshold?.message ?? 'Open handovers before a backup is flagged'} slotProps={{ htmlInput: { min: 1, max: 20 } }} />
                </Grid>
              </Grid>
            </Stack>
          </Section>
        </Grid>

        <Grid size={{ xs: 12, lg: 6 }}>
          <Section icon={<Bell size={18} />} title="Notification preferences" subtitle="In-app now; email when a provider is configured">
            <Stack spacing={2} divider={<Divider flexItem />}>
              <Toggle control={control} name="notifyInApp" label="In-app notifications" help="Notification centre and unread badges" />
              <Toggle control={control} name="notifyEmail" label="Email notifications" help="Uses the email channel (logs to the server console in this version)" />
              <Toggle control={control} name="notifyLeaveStartReminder" label="Leave starts tomorrow reminder" help="Notify the employee and the backup a day before" />
              <Toggle control={control} name="notifyTaskOverdue" label="Overdue task alerts" help="Notify assignees when handover tasks pass their due date" />
              <TextField type="number" label="Refresh interval (seconds)" {...register('notificationPollSeconds')} error={!!errors.notificationPollSeconds} helperText={errors.notificationPollSeconds?.message ?? 'How often the app polls for new notifications'} sx={{ maxWidth: 260 }} slotProps={{ htmlInput: { min: 10, max: 600 } }} />
            </Stack>
          </Section>
        </Grid>

        <Grid size={12}>
          <WorkbookSection control={control} />
        </Grid>

        <Grid size={12}>
          <AuditSection />
        </Grid>
      </Grid>
    </Box>
  );
}
