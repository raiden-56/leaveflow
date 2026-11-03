import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  LinearProgress,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
  alpha,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarSync, FileSpreadsheet, Gift, History, SlidersHorizontal, Wallet } from 'lucide-react';
import {
  balanceAdjustmentSchema,
  compOffSchema,
  type BalanceAdjustmentInput,
  type CompOffInput,
  type TransactionType,
} from '@leaveflow/shared';
import {
  useAddCompOffMutation,
  useAdjustBalanceMutation,
  useAllBalancesQuery,
  useBalanceTransactionsQuery,
  useDepartmentsQuery,
  useLeaveTypesQuery,
  useYearEndRolloverMutation,
} from '@/app/store/api';
import {
  ConfirmDialog,
  DataTable,
  DetailPanel,
  EmployeeCell,
  ErrorState,
  FilterSelect,
  LeaveTypeChip,
  LoadingButton,
  StatCard,
  TableSkeleton,
  ToneChip,
  type Column,
} from '@/components/common';
import { useAction, useToast, useToday } from '@/hooks';
import { balanceRepository, type BalanceRow } from '@/services/repositories';
import { palette, type StatusTone } from '@/theme/tokens';
import { fmtDateTime } from '@/utils/format';

const TX_LABEL: Record<TransactionType, { label: string; tone: StatusTone }> = {
  ALLOCATION: { label: 'Allocation', tone: 'primary' },
  CARRY_FORWARD: { label: 'Carry forward', tone: 'primary' },
  APPLIED: { label: 'Applied (pending)', tone: 'warning' },
  APPROVED: { label: 'Approved (used)', tone: 'success' },
  RELEASED: { label: 'Released', tone: 'neutral' },
  REVERSED: { label: 'Reversed', tone: 'neutral' },
  ADJUSTMENT: { label: 'HR adjustment', tone: 'info' },
  COMP_OFF: { label: 'Comp-off credit', tone: 'info' },
};

interface Target {
  employeeId: string;
  employeeName: string;
  leaveType?: string;
}

function useFullScreen() {
  const theme = useTheme();
  return useMediaQuery(theme.breakpoints.down('sm'));
}

function AdjustDialog({ target, year, onClose }: { target: Target | null; year: number; onClose: () => void }) {
  const fullScreen = useFullScreen();
  const run = useAction();
  const { data: types } = useLeaveTypesQuery();
  const [adjust, { isLoading }] = useAdjustBalanceMutation();
  const { control, register, handleSubmit, reset, formState: { errors } } = useForm<BalanceAdjustmentInput>({
    resolver: zodResolver(balanceAdjustmentSchema) as never,
    defaultValues: { leaveType: '', days: 1, reason: '', year },
  });
  useEffect(() => {
    if (target) reset({ leaveType: target.leaveType ?? '', days: 1, reason: '', year });
  }, [target, year, reset]);

  const submit = handleSubmit(async (values) => {
    const ok = await run(adjust({ employeeId: target!.employeeId, input: { ...values, year } }).unwrap(), 'Balance adjusted');
    if (ok) onClose();
  });

  return (
    <Dialog open={Boolean(target)} onClose={onClose} fullWidth maxWidth="xs" fullScreen={fullScreen}>
      <Box component="form" onSubmit={submit} noValidate>
        <DialogTitle>Adjust balance · {target?.employeeName}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Controller name="leaveType" control={control} render={({ field }) => (
              <TextField select fullWidth label="Leave type" {...field} error={!!errors.leaveType} helperText={errors.leaveType?.message}>
                {(types ?? []).filter((t) => t.trackBalance && t.isActive).map((t) => <MenuItem key={t.code} value={t.code}>{t.name}</MenuItem>)}
              </TextField>
            )} />
            <TextField
              fullWidth
              type="number"
              label="Days (+ credit / − debit)"
              {...register('days')}
              error={!!errors.days}
              helperText={errors.days?.message ?? 'Use negative values to debit. Half days allowed (e.g. 1.5).'}
              slotProps={{ htmlInput: { step: 0.5 } }}
            />
            <TextField fullWidth multiline minRows={2} label="Reason" {...register('reason')} error={!!errors.reason} helperText={errors.reason?.message} />
            <Typography variant="caption" color="text.secondary">Applies to the {year} leave year and is recorded in the transaction ledger.</Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} color="inherit">Cancel</Button>
          <LoadingButton type="submit" variant="contained" loading={isLoading}>Apply adjustment</LoadingButton>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

function CompOffDialog({ target, onClose }: { target: Target | null; onClose: () => void }) {
  const fullScreen = useFullScreen();
  const run = useAction();
  const today = useToday();
  const [addCompOff, { isLoading }] = useAddCompOffMutation();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<CompOffInput>({
    resolver: zodResolver(compOffSchema) as never,
    defaultValues: { days: 1, workedOn: today, reason: '' },
  });
  useEffect(() => {
    if (target) reset({ days: 1, workedOn: today, reason: '' });
  }, [target, today, reset]);

  const submit = handleSubmit(async (values) => {
    const ok = await run(addCompOff({ employeeId: target!.employeeId, input: values }).unwrap(), 'Compensatory off credited');
    if (ok) onClose();
  });

  return (
    <Dialog open={Boolean(target)} onClose={onClose} fullWidth maxWidth="xs" fullScreen={fullScreen}>
      <Box component="form" onSubmit={submit} noValidate>
        <DialogTitle>Add comp-off · {target?.employeeName}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField fullWidth type="date" label="Worked on" {...register('workedOn')} error={!!errors.workedOn} helperText={errors.workedOn?.message ?? 'Holiday or weekend the employee worked'} slotProps={{ inputLabel: { shrink: true } }} />
            <TextField fullWidth type="number" label="Days" {...register('days')} error={!!errors.days} helperText={errors.days?.message} slotProps={{ htmlInput: { step: 0.5, min: 0.5, max: 10 } }} />
            <TextField fullWidth multiline minRows={2} label="Reason" {...register('reason')} error={!!errors.reason} helperText={errors.reason?.message} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} color="inherit">Cancel</Button>
          <LoadingButton type="submit" variant="contained" loading={isLoading}>Credit comp-off</LoadingButton>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

function TransactionsPanel({ target, year, onClose }: { target: Target | null; year: number; onClose: () => void }) {
  const { data: types } = useLeaveTypesQuery();
  const typeName = useMemo(() => new Map((types ?? []).map((t) => [t.code, t])), [types]);
  const { data, isLoading, error, refetch } = useBalanceTransactionsQuery({ employeeId: target?.employeeId ?? '', year }, { skip: !target });
  const rows = (data ?? []).filter((t) => !target?.leaveType || t.leaveType === target.leaveType);
  return (
    <DetailPanel
      open={Boolean(target)}
      onClose={onClose}
      title={`Leave transactions · ${target?.employeeName ?? ''}`}
      subtitle={`${year}${target?.leaveType ? ` · ${typeName.get(target.leaveType)?.name ?? target.leaveType}` : ' · all leave types'}`}
    >
      {isLoading && <TableSkeleton rows={6} />}
      {error && <ErrorState error={error} onRetry={refetch} />}
      {data && rows.length === 0 && <Typography variant="body2" color="text.secondary">No transactions for this period.</Typography>}
      <Stack spacing={1}>
        {rows.map((t) => {
          const meta = TX_LABEL[t.transactionType];
          const type = typeName.get(t.leaveType);
          return (
            <Box key={t.transactionId} sx={{ p: 1.5, border: 1, borderColor: 'divider', borderRadius: 1 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                  <ToneChip tone={meta.tone} label={meta.label} />
                  {type && <LeaveTypeChip name={type.name} color={type.color} />}
                </Stack>
                <Typography variant="subtitle2" sx={{ color: t.days >= 0 ? 'success.main' : 'error.main', flexShrink: 0 }}>
                  {t.days > 0 ? '+' : ''}{t.days}
                </Typography>
              </Stack>
              <Typography variant="body2" sx={{ mt: 0.75 }}>{t.reason}{t.leaveId ? ` · ${t.leaveId}` : ''}</Typography>
              <Typography variant="caption" color="text.secondary">{fmtDateTime(t.createdAt)} · by {t.performedBy}</Typography>
            </Box>
          );
        })}
      </Stack>
    </DetailPanel>
  );
}

/** HR leave balance management: view, adjust, comp-off, ledger, export and year-end rollover. */
export function BalancesPanel() {
  const run = useAction();
  const toast = useToast();
  const today = useToday();
  const currentYear = Number(today.slice(0, 4));
  const [year, setYear] = useState(currentYear);
  const [department, setDepartment] = useState('');
  const [leaveType, setLeaveType] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const { data, isLoading, isFetching, error, refetch } = useAllBalancesQuery(year);
  const { data: departments } = useDepartmentsQuery();
  const { data: types } = useLeaveTypesQuery();
  const [rollover, rolloverState] = useYearEndRolloverMutation();
  const [adjustTarget, setAdjustTarget] = useState<Target | null>(null);
  const [compOffTarget, setCompOffTarget] = useState<Target | null>(null);
  const [txTarget, setTxTarget] = useState<Target | null>(null);
  const [confirmRollover, setConfirmRollover] = useState(false);
  const [exporting, setExporting] = useState(false);

  const tracked = useMemo(() => (data ?? []).filter((b) => b.trackBalance), [data]);
  const employees = useMemo(() => {
    const map = new Map<string, string>();
    tracked.forEach((b) => map.set(b.employeeId, b.employeeName));
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([value, label]) => ({ value, label }));
  }, [tracked]);
  const rows = tracked.filter(
    (b) => (!department || b.department === department) && (!leaveType || b.leaveType === leaveType) && (!employeeId || b.employeeId === employeeId),
  );
  // Event-based leave (maternity, paternity, bereavement…) is allocated to everyone but only used by a few,
  // so it stays out of the headline totals unless HR filters to that leave type.
  const totals = useMemo(
    () =>
      rows
        .filter((b) => leaveType || b.includeInTotals)
        .reduce((s, b) => ({ total: s.total + b.total, used: s.used + b.used, pending: s.pending + b.pending, available: s.available + b.available }), { total: 0, used: 0, pending: 0, available: 0 }),
    [rows, leaveType],
  );
  const round = (n: number) => Math.round(n * 10) / 10;

  const columns: Column<BalanceRow>[] = [
    {
      id: 'employee',
      label: 'Employee',
      minWidth: 200,
      sortValue: (r) => r.employeeName,
      searchValue: (r) => `${r.employeeName} ${r.employeeId} ${r.department} ${r.leaveTypeName}`,
      render: (r) => <EmployeeCell employee={{ employeeName: r.employeeName }} secondary={`${r.employeeId} · ${r.department}`} />,
    },
    { id: 'type', label: 'Leave type', sortValue: (r) => r.leaveTypeName, render: (r) => <LeaveTypeChip name={r.leaveTypeName} color={r.color} /> },
    { id: 'allocated', label: 'Allocated', align: 'right', sortValue: (r) => r.allocated, hideBelow: 'lg', render: (r) => r.allocated },
    { id: 'cf', label: 'Carried fwd', align: 'right', sortValue: (r) => r.carriedForward, hideBelow: 'xl', render: (r) => r.carriedForward },
    { id: 'adjusted', label: 'Adjusted', align: 'right', sortValue: (r) => r.adjusted, hideBelow: 'xl', render: (r) => (r.adjusted > 0 ? `+${r.adjusted}` : r.adjusted) },
    { id: 'used', label: 'Used', align: 'right', sortValue: (r) => r.used, render: (r) => r.used },
    { id: 'pending', label: 'Pending', align: 'right', sortValue: (r) => r.pending, render: (r) => (r.pending ? <Typography variant="body2" color="warning.main" fontWeight={600}>{r.pending}</Typography> : 0) },
    {
      id: 'available',
      label: 'Available',
      minWidth: 150,
      sortValue: (r) => r.available,
      render: (r) => {
        const pct = r.total > 0 ? ((r.used + r.pending) / r.total) * 100 : 0;
        return (
          <Box sx={{ minWidth: 120 }}>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2" fontWeight={700}>{r.available}</Typography>
              <Typography variant="caption" color="text.secondary">of {r.total}</Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={Math.min(100, pct)}
              sx={{ height: 5, mt: 0.5, bgcolor: alpha(r.color, 0.15), '& .MuiLinearProgress-bar': { bgcolor: r.color } }}
              aria-label={`${r.leaveTypeName} utilisation`}
            />
          </Box>
        );
      },
    },
    {
      id: 'actions',
      label: '',
      align: 'right',
      render: (r) => {
        const target = { employeeId: r.employeeId, employeeName: r.employeeName, leaveType: r.leaveType };
        return (
          <Stack direction="row" spacing={0.25} justifyContent="flex-end">
            <Tooltip title="Adjust balance"><IconButton size="small" onClick={() => setAdjustTarget(target)} aria-label="Adjust balance"><SlidersHorizontal size={16} /></IconButton></Tooltip>
            <Tooltip title="Add comp-off"><IconButton size="small" onClick={() => setCompOffTarget(target)} aria-label="Add comp-off"><Gift size={16} /></IconButton></Tooltip>
            <Tooltip title="Transactions"><IconButton size="small" onClick={() => setTxTarget(target)} aria-label="View transactions"><History size={16} /></IconButton></Tooltip>
          </Stack>
        );
      },
    },
  ];

  return (
    <Stack spacing={2.5}>
      <Grid container spacing={2}>
        <Grid size={{ xs: 6, md: 3 }}><StatCard index={0} label="Total entitlement" value={round(totals.total)} icon={<Wallet size={20} />} color={palette.indigo} caption={leaveType ? `${year} · filtered rows` : `${year} · excludes event-based leave`} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><StatCard index={1} label="Used" value={round(totals.used)} icon={<History size={20} />} color={palette.approved} progress={totals.total ? (totals.used / totals.total) * 100 : 0} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><StatCard index={2} label="Pending" value={round(totals.pending)} icon={<CalendarSync size={20} />} color={palette.pending} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><StatCard index={3} label="Available" value={round(totals.available)} icon={<Gift size={20} />} color={palette.teal} progress={totals.total ? (totals.available / totals.total) * 100 : 0} /></Grid>
      </Grid>

      <DataTable
        rows={error ? undefined : rows}
        columns={columns}
        rowKey={(r) => r.balanceId}
        loading={isLoading || isFetching}
        error={error}
        onRetry={refetch}
        initialSort={{ id: 'employee', direction: 'asc' }}
        searchPlaceholder="Search employee or leave type…"
        emptyTitle="No balances found"
        toolbar={
          <>
            <TextField select label="Year" value={year} onChange={(e) => setYear(Number(e.target.value))} sx={{ minWidth: 100 }}>
              {[currentYear - 1, currentYear, currentYear + 1].map((y) => <MenuItem key={y} value={y}>{y}</MenuItem>)}
            </TextField>
            <FilterSelect label="Employee" value={employeeId} onChange={setEmployeeId} options={employees} minWidth={170} />
            <FilterSelect label="Department" value={department} onChange={setDepartment} options={(departments ?? []).map((d) => ({ value: d.departmentName, label: d.departmentName }))} />
            <FilterSelect label="Leave type" value={leaveType} onChange={setLeaveType} options={(types ?? []).filter((t) => t.trackBalance).map((t) => ({ value: t.code, label: t.name }))} />
          </>
        }
        actions={
          <>
            <LoadingButton
              size="small"
              variant="outlined"
              startIcon={<FileSpreadsheet size={15} />}
              loading={exporting}
              onClick={async () => {
                setExporting(true);
                await run(balanceRepository.exportExcel(year), 'Balance report downloaded');
                setExporting(false);
              }}
            >
              Export
            </LoadingButton>
            <Button size="small" variant="contained" startIcon={<CalendarSync size={15} />} onClick={() => setConfirmRollover(true)}>
              Year-end rollover
            </Button>
          </>
        }
        mobileCard={(r) => (
          <Stack spacing={1}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
              <EmployeeCell employee={{ employeeName: r.employeeName }} secondary={r.department} size={30} />
              <LeaveTypeChip name={r.leaveTypeName} color={r.color} />
            </Stack>
            <Typography variant="body2">
              <b>{r.available}</b> available of {r.total} · {r.used} used · {r.pending} pending
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button size="small" onClick={(e) => { e.stopPropagation(); setAdjustTarget({ employeeId: r.employeeId, employeeName: r.employeeName, leaveType: r.leaveType }); }}>Adjust</Button>
              <Button size="small" onClick={(e) => { e.stopPropagation(); setCompOffTarget({ employeeId: r.employeeId, employeeName: r.employeeName }); }}>Comp-off</Button>
              <Button size="small" onClick={(e) => { e.stopPropagation(); setTxTarget({ employeeId: r.employeeId, employeeName: r.employeeName, leaveType: r.leaveType }); }}>History</Button>
            </Stack>
          </Stack>
        )}
      />

      <AdjustDialog target={adjustTarget} year={year} onClose={() => setAdjustTarget(null)} />
      <CompOffDialog target={compOffTarget} onClose={() => setCompOffTarget(null)} />
      <TransactionsPanel target={txTarget} year={year} onClose={() => setTxTarget(null)} />
      <ConfirmDialog
        open={confirmRollover}
        title={`Run year-end rollover for ${year}?`}
        description={`Creates ${year + 1} allocations for every active employee and carries forward unused days according to each leave type's carry-forward rules. Safe to run once per year — already carried balances are skipped.`}
        confirmLabel="Run rollover"
        loading={rolloverState.isLoading}
        onClose={() => setConfirmRollover(false)}
        onConfirm={async () => {
          const result = await run(rollover(year).unwrap());
          if (result) {
            toast.success(`Rollover done: ${result.employees} employees, ${result.carriedForward} day(s) carried forward to ${year + 1}`);
          }
          setConfirmRollover(false);
        }}
      />
    </Stack>
  );
}
