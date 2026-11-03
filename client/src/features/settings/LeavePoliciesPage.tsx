import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Grid,
  IconButton,
  MenuItem,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  alpha,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { Controller, useForm, type Control } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { BookOpenCheck, Building2, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  departmentInputSchema,
  leaveTypeInputSchema,
  type DepartmentInput,
  type LeaveType,
  type LeaveTypeInput,
} from '@leaveflow/shared';
import {
  useCreateDepartmentMutation,
  useCreateLeaveTypeMutation,
  useDeleteDepartmentMutation,
  useDeleteLeaveTypeMutation,
  useDepartmentsQuery,
  useEmployeesQuery,
  useLeaveTypesQuery,
  useUpdateDepartmentMutation,
  useUpdateLeaveTypeMutation,
} from '@/app/store/api';
import {
  CardsSkeleton,
  ConfirmDialog,
  DataTable,
  EmptyState,
  ErrorState,
  LoadingButton,
  PageHeader,
  ToneChip,
  type Column,
} from '@/components/common';
import { useAction, useToast } from '@/hooks';
import type { DepartmentView } from '@/services/repositories';

function useFullScreen() {
  const theme = useTheme();
  return useMediaQuery(theme.breakpoints.down('sm'));
}

const EMPTY_TYPE: LeaveTypeInput = {
  code: '',
  name: '',
  description: '',
  annualAllocation: 0,
  isPaid: true,
  trackBalance: true,
  allowHalfDay: true,
  allowCarryForward: false,
  maxCarryForward: 0,
  maxConsecutiveDays: 0,
  minNoticeDays: 0,
  backdatedDays: 0,
  requiresApproval: true,
  requiresAttachmentAfterDays: 0,
  excludeWeekendsAndHolidays: true,
  color: '#4F46E5',
  isActive: true,
  includeInTotals: true,
};

const SWITCHES: { name: keyof LeaveTypeInput; label: string; help: string }[] = [
  { name: 'isPaid', label: 'Paid leave', help: 'Unpaid leave is flagged for payroll (LOP)' },
  { name: 'trackBalance', label: 'Track balance', help: 'Deduct from a yearly balance' },
  { name: 'includeInTotals', label: 'Include in dashboard totals', help: 'Off for event-based leave such as maternity' },
  { name: 'allowHalfDay', label: 'Allow half day', help: 'Employees can apply for first/second half' },
  { name: 'allowCarryForward', label: 'Carry forward', help: 'Unused days roll into next year' },
  { name: 'requiresApproval', label: 'Requires approval', help: 'Off = auto-approved on submit' },
  { name: 'excludeWeekendsAndHolidays', label: 'Exclude weekends & holidays', help: 'Off = count calendar days' },
  { name: 'isActive', label: 'Active', help: 'Inactive types cannot be applied for' },
];

const NUMBERS: { name: keyof LeaveTypeInput; label: string; help: string }[] = [
  { name: 'annualAllocation', label: 'Yearly allocation (days)', help: 'Credited every leave year' },
  { name: 'maxCarryForward', label: 'Max carry forward', help: '0 = no cap when carry forward is on' },
  { name: 'maxConsecutiveDays', label: 'Max consecutive days', help: '0 = no limit' },
  { name: 'minNoticeDays', label: 'Minimum notice (days)', help: 'Days before start date' },
  { name: 'backdatedDays', label: 'Backdating allowed (days)', help: '0 = no past dates' },
  { name: 'requiresAttachmentAfterDays', label: 'Attachment required after (days)', help: '0 = never required' },
];

function SwitchField({ control, name, label, help }: { control: Control<LeaveTypeInput>; name: keyof LeaveTypeInput; label: string; help: string }) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <FormControlLabel
          control={<Switch checked={Boolean(field.value)} onChange={(e) => field.onChange(e.target.checked)} />}
          label={
            <Box>
              <Typography variant="body2" fontWeight={600}>{label}</Typography>
              <Typography variant="caption" color="text.secondary">{help}</Typography>
            </Box>
          }
          sx={{ alignItems: 'flex-start', m: 0, '& .MuiSwitch-root': { mt: -0.5 } }}
        />
      )}
    />
  );
}

function LeaveTypeDialog({ open, leaveType, onClose }: { open: boolean; leaveType: LeaveType | null; onClose: () => void }) {
  const fullScreen = useFullScreen();
  const run = useAction();
  const [create, createState] = useCreateLeaveTypeMutation();
  const [update, updateState] = useUpdateLeaveTypeMutation();
  const { control, register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<LeaveTypeInput>({
    resolver: zodResolver(leaveTypeInputSchema) as never,
    defaultValues: EMPTY_TYPE,
  });
  useEffect(() => {
    if (open) reset(leaveType ? { ...EMPTY_TYPE, ...leaveType } : EMPTY_TYPE);
  }, [open, leaveType, reset]);
  const color = watch('color');

  const submit = handleSubmit(async (values) => {
    const ok = leaveType
      ? await run(update({ code: leaveType.code, input: values }).unwrap(), `${values.name} updated`)
      : await run(create(values).unwrap(), `${values.name} created`);
    if (ok) onClose();
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" fullScreen={fullScreen}>
      <Box component="form" onSubmit={submit} noValidate>
        <DialogTitle>{leaveType ? `Edit ${leaveType.name}` : 'New leave type'}</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 3 }}>
              <TextField fullWidth label="Code" {...register('code')} disabled={Boolean(leaveType)} error={!!errors.code} helperText={errors.code?.message ?? 'e.g. CL, WFH'} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth label="Name" {...register('name')} error={!!errors.name} helperText={errors.name?.message} />
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <TextField fullWidth label="Colour" {...register('color')} error={!!errors.color} helperText={errors.color?.message} />
                <Box component="input" type="color" value={/^#[0-9a-f]{6}$/i.test(color) ? color : '#4F46E5'} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setValue('color', e.target.value.toUpperCase(), { shouldValidate: true, shouldDirty: true })} aria-label="Pick colour" sx={{ width: 40, height: 40, border: 0, p: 0, bgcolor: 'transparent', cursor: 'pointer', flexShrink: 0 }} />
              </Stack>
            </Grid>
            <Grid size={12}>
              <TextField fullWidth multiline minRows={2} label="Description / policy note" {...register('description')} />
            </Grid>
            {NUMBERS.map((n) => (
              <Grid key={n.name} size={{ xs: 12, sm: 6, md: 4 }}>
                <TextField
                  fullWidth
                  type="number"
                  label={n.label}
                  {...register(n.name)}
                  error={!!errors[n.name]}
                  helperText={(errors[n.name]?.message as string | undefined) ?? n.help}
                  slotProps={{ htmlInput: { min: 0, step: n.name === 'annualAllocation' ? 0.5 : 1 } }}
                />
              </Grid>
            ))}
            <Grid size={12}><Divider /></Grid>
            {SWITCHES.map((s) => (
              <Grid key={s.name} size={{ xs: 12, sm: 6 }}>
                <SwitchField control={control} {...s} />
              </Grid>
            ))}
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={onClose} color="inherit">Cancel</Button>
          <LoadingButton type="submit" variant="contained" loading={createState.isLoading || updateState.isLoading}>
            {leaveType ? 'Save policy' : 'Create leave type'}
          </LoadingButton>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

function PolicyRule({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Stack direction="row" justifyContent="space-between" spacing={1}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="caption" fontWeight={600}>{value}</Typography>
    </Stack>
  );
}

function LeaveTypeCard({ t, index, onEdit, onDelete }: { t: LeaveType; index: number; onEdit: () => void; onDelete: () => void }) {
  const run = useAction();
  const [update, { isLoading }] = useUpdateLeaveTypeMutation();
  const flags = [
    t.isPaid ? 'Paid' : 'Unpaid',
    t.trackBalance ? 'Balance tracked' : 'No balance',
    t.allowHalfDay && 'Half day',
    t.requiresApproval ? 'Needs approval' : 'Auto-approved',
    !t.excludeWeekendsAndHolidays && 'Calendar days',
  ].filter(Boolean) as string[];
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }} style={{ height: '100%' }}>
      <Card sx={{ p: 2.25, height: '100%', display: 'flex', flexDirection: 'column', opacity: t.isActive ? 1 : 0.65, borderTop: `4px solid ${t.color}`, transition: 'box-shadow 200ms', '&:hover': { boxShadow: `0 10px 28px ${alpha(t.color, 0.15)}` } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="subtitle1" noWrap>{t.name}</Typography>
              <Chip size="small" label={t.code} sx={{ height: 20, fontSize: 11, bgcolor: alpha(t.color, 0.12), color: t.color }} />
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {t.description || 'No description'}
            </Typography>
          </Box>
          <Tooltip title={t.isActive ? 'Disable' : 'Enable'}>
            <Switch
              size="small"
              checked={t.isActive}
              disabled={isLoading}
              onChange={(e) => run(update({ code: t.code, input: { isActive: e.target.checked } }).unwrap(), `${t.name} ${e.target.checked ? 'enabled' : 'disabled'}`)}
              slotProps={{ input: { 'aria-label': `${t.isActive ? 'Disable' : 'Enable'} ${t.name}` } }}
            />
          </Tooltip>
        </Stack>
        <Typography variant="h4" sx={{ mt: 1.5 }}>
          {t.trackBalance ? t.annualAllocation : '∞'}
          <Typography component="span" variant="body2" color="text.secondary"> days / year</Typography>
        </Typography>
        <Stack spacing={0.5} sx={{ mt: 1.5, flex: 1 }}>
          <PolicyRule label="Carry forward" value={t.allowCarryForward ? `Up to ${t.maxCarryForward || 'all'} days` : 'No'} />
          <PolicyRule label="Max consecutive" value={t.maxConsecutiveDays ? `${t.maxConsecutiveDays} days` : 'No limit'} />
          <PolicyRule label="Notice" value={t.minNoticeDays ? `${t.minNoticeDays} days` : 'None'} />
          <PolicyRule label="Backdating" value={t.backdatedDays ? `${t.backdatedDays} days` : 'Not allowed'} />
          <PolicyRule label="Attachment" value={t.requiresAttachmentAfterDays ? `> ${t.requiresAttachmentAfterDays} days` : 'Optional'} />
        </Stack>
        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}>
          {flags.map((f) => <Chip key={f} size="small" label={f} variant="outlined" sx={{ height: 22, fontSize: 11 }} />)}
          {!t.isActive && <ToneChip tone="neutral" label="Inactive" />}
        </Stack>
        <Stack direction="row" justifyContent="flex-end" spacing={0.5} sx={{ mt: 1.5 }}>
          <Button size="small" startIcon={<Pencil size={14} />} onClick={onEdit}>Edit</Button>
          <Button size="small" color="error" startIcon={<Trash2 size={14} />} onClick={onDelete}>Delete</Button>
        </Stack>
      </Card>
    </motion.div>
  );
}

function LeaveTypesTab() {
  const run = useAction();
  const toast = useToast();
  const { data, isLoading, error, refetch } = useLeaveTypesQuery();
  const [remove, removeState] = useDeleteLeaveTypeMutation();
  const [editing, setEditing] = useState<LeaveType | null>(null);
  const [open, setOpen] = useState(false);
  const [toDelete, setToDelete] = useState<LeaveType | null>(null);

  return (
    <>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          {data ? `${data.filter((t) => t.isActive).length} active of ${data.length} leave types` : ' '}
        </Typography>
        <Button variant="contained" startIcon={<Plus size={16} />} onClick={() => { setEditing(null); setOpen(true); }}>New leave type</Button>
      </Stack>
      {isLoading && <CardsSkeleton count={6} height={300} />}
      {error && <ErrorState error={error} onRetry={refetch} />}
      {data && data.length === 0 && <EmptyState title="No leave types" description="Create your first leave type to start accepting leave requests." />}
      {data && data.length > 0 && (
        <Grid container spacing={2}>
          {data.map((t, i) => (
            <Grid key={t.code} size={{ xs: 12, sm: 6, lg: 4, xl: 3 }}>
              <LeaveTypeCard t={t} index={i} onEdit={() => { setEditing(t); setOpen(true); }} onDelete={() => setToDelete(t)} />
            </Grid>
          ))}
        </Grid>
      )}
      <LeaveTypeDialog open={open} leaveType={editing} onClose={() => setOpen(false)} />
      <ConfirmDialog
        open={Boolean(toDelete)}
        title={`Delete ${toDelete?.name}?`}
        description="If any leave request already uses this type it will be deactivated instead, so history stays intact."
        confirmLabel="Delete"
        confirmColor="error"
        loading={removeState.isLoading}
        onClose={() => setToDelete(null)}
        onConfirm={async () => {
          const result = await run(remove(toDelete!.code).unwrap());
          if (result) {
            if (result.deactivated) toast.info(`${toDelete!.name} is in use, so it was deactivated instead of deleted.`);
            else toast.success(`${toDelete!.name} deleted`);
          }
          setToDelete(null);
        }}
      />
    </>
  );
}

function DepartmentDialog({ open, department, onClose }: { open: boolean; department: DepartmentView | null; onClose: () => void }) {
  const fullScreen = useFullScreen();
  const run = useAction();
  const { data: employees } = useEmployeesQuery();
  const [create, createState] = useCreateDepartmentMutation();
  const [update, updateState] = useUpdateDepartmentMutation();
  const empty: DepartmentInput = { departmentName: '', headId: '', description: '', color: '#4F46E5' };
  const { control, register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<DepartmentInput>({
    resolver: zodResolver(departmentInputSchema) as never,
    defaultValues: empty,
  });
  useEffect(() => {
    if (open) reset(department ? { departmentName: department.departmentName, headId: department.headId, description: department.description, color: department.color || '#4F46E5' } : empty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, department]);
  const color = watch('color');
  const heads = (employees ?? []).filter((e) => e.role !== 'EMPLOYEE');

  const submit = handleSubmit(async (values) => {
    const ok = department
      ? await run(update({ id: department.departmentId, input: values }).unwrap(), 'Department updated')
      : await run(create(values).unwrap(), 'Department created');
    if (ok) onClose();
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" fullScreen={fullScreen}>
      <Box component="form" onSubmit={submit} noValidate>
        <DialogTitle>{department ? `Edit ${department.departmentName}` : 'New department'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField fullWidth label="Department name" {...register('departmentName')} error={!!errors.departmentName} helperText={errors.departmentName?.message ?? (department ? 'Renaming updates every employee in this department' : undefined)} />
            <Controller name="headId" control={control} render={({ field }) => (
              <TextField select fullWidth label="Department head" {...field} value={field.value ?? ''}>
                <MenuItem value="">Not assigned</MenuItem>
                {heads.map((e) => <MenuItem key={e.employeeId} value={e.employeeId}>{e.employeeName} · {e.designation}</MenuItem>)}
              </TextField>
            )} />
            <TextField fullWidth multiline minRows={2} label="Description" {...register('description')} />
            <Stack direction="row" spacing={1} alignItems="center">
              <TextField fullWidth label="Colour" {...register('color')} error={!!errors.color} helperText={errors.color ? 'Use a hex colour like #4F46E5' : undefined} />
              <Box component="input" type="color" value={/^#[0-9a-f]{6}$/i.test(color) ? color : '#4F46E5'} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setValue('color', e.target.value.toUpperCase(), { shouldValidate: true, shouldDirty: true })} aria-label="Pick colour" sx={{ width: 40, height: 40, border: 0, p: 0, bgcolor: 'transparent', cursor: 'pointer' }} />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} color="inherit">Cancel</Button>
          <LoadingButton type="submit" variant="contained" loading={createState.isLoading || updateState.isLoading}>Save</LoadingButton>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

function DepartmentsTab() {
  const run = useAction();
  const { data, isLoading, error, refetch } = useDepartmentsQuery();
  const [remove, removeState] = useDeleteDepartmentMutation();
  const [editing, setEditing] = useState<DepartmentView | null>(null);
  const [open, setOpen] = useState(false);
  const [toDelete, setToDelete] = useState<DepartmentView | null>(null);

  const columns: Column<DepartmentView>[] = [
    {
      id: 'name',
      label: 'Department',
      sortValue: (r) => r.departmentName,
      searchValue: (r) => `${r.departmentName} ${r.headName} ${r.description}`,
      render: (r) => (
        <Stack direction="row" spacing={1.25} alignItems="center">
          <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: r.color, flexShrink: 0 }} />
          <Box>
            <Typography variant="body2" fontWeight={600}>{r.departmentName}</Typography>
            <Typography variant="caption" color="text.secondary">{r.departmentId}</Typography>
          </Box>
        </Stack>
      ),
    },
    { id: 'head', label: 'Head', sortValue: (r) => r.headName, render: (r) => r.headName || '—' },
    { id: 'count', label: 'Employees', align: 'right', sortValue: (r) => r.employeeCount, render: (r) => r.employeeCount },
    { id: 'desc', label: 'Description', hideBelow: 'lg', render: (r) => <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 360 }}>{r.description || '—'}</Typography> },
    {
      id: 'actions',
      label: '',
      align: 'right',
      render: (r) => (
        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
          <Tooltip title="Edit"><IconButton size="small" onClick={() => { setEditing(r); setOpen(true); }} aria-label={`Edit ${r.departmentName}`}><Pencil size={16} /></IconButton></Tooltip>
          <Tooltip title={r.employeeCount ? 'Move employees out before deleting' : 'Delete'}>
            <span>
              <IconButton size="small" color="error" disabled={r.employeeCount > 0} onClick={() => setToDelete(r)} aria-label={`Delete ${r.departmentName}`}><Trash2 size={16} /></IconButton>
            </span>
          </Tooltip>
        </Stack>
      ),
    },
  ];

  return (
    <>
      <DataTable
        rows={data}
        columns={columns}
        rowKey={(r) => r.departmentId}
        loading={isLoading}
        error={error}
        onRetry={refetch}
        searchPlaceholder="Search departments…"
        emptyTitle="No departments"
        actions={<Button variant="contained" startIcon={<Plus size={16} />} onClick={() => { setEditing(null); setOpen(true); }}>New department</Button>}
      />
      <DepartmentDialog open={open} department={editing} onClose={() => setOpen(false)} />
      <ConfirmDialog
        open={Boolean(toDelete)}
        title={`Delete ${toDelete?.departmentName}?`}
        description="This department has no active employees and will be removed."
        confirmLabel="Delete"
        confirmColor="error"
        loading={removeState.isLoading}
        onClose={() => setToDelete(null)}
        onConfirm={async () => {
          await run(remove(toDelete!.departmentId).unwrap(), 'Department deleted');
          setToDelete(null);
        }}
      />
    </>
  );
}

export default function LeavePoliciesPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'departments' ? 'departments' : 'types';
  return (
    <>
      <PageHeader title="Leave Policies" icon={<BookOpenCheck size={22} />} subtitle="Configure leave types, yearly allocations, carry-forward rules and departments." />
      <Card sx={{ mb: 2.5, px: 1 }}>
        <Tabs value={tab} onChange={(_, v) => setParams(v === 'departments' ? { tab: 'departments' } : {}, { replace: true })} variant="scrollable" allowScrollButtonsMobile>
          <Tab value="types" icon={<BookOpenCheck size={16} />} iconPosition="start" label="Leave types" />
          <Tab value="departments" icon={<Building2 size={16} />} iconPosition="start" label="Departments" />
        </Tabs>
      </Card>
      {tab === 'types' ? <LeaveTypesTab /> : <DepartmentsTab />}
    </>
  );
}
