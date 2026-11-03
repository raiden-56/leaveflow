import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  List,
  ListItem,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FileDown, FileSpreadsheet, FileUp, Pencil, UserMinus, UserPlus, Users } from 'lucide-react';
import {
  EMPLOYMENT_STATUSES,
  ROLES,
  ROLE_LABELS,
  WORK_MODES,
  employeeInputSchema,
  type EmployeeInput,
  type EmploymentStatus,
} from '@leaveflow/shared';
import {
  useCreateEmployeeMutation,
  useDeactivateEmployeeMutation,
  useDepartmentsQuery,
  useEmployeesQuery,
  useImportEmployeesMutation,
  useUpdateEmployeeMutation,
} from '@/app/store/api';
import {
  ConfirmDialog,
  DataTable,
  EmployeeCell,
  FilterSelect,
  LoadingButton,
  PageHeader,
  ToneChip,
  optionsFrom,
  type Column,
} from '@/components/common';
import { useAction, useAuth, useToday } from '@/hooks';
import { employeeRepository, type EmployeeView, type ImportResult } from '@/services/repositories';
import { exportCsv, fmtDate } from '@/utils/format';
import type { StatusTone } from '@/theme/tokens';

const STATUS_LABELS: Record<EmploymentStatus, string> = { ACTIVE: 'Active', ON_NOTICE: 'On notice', INACTIVE: 'Inactive' };
const STATUS_TONE: Record<EmploymentStatus, StatusTone> = { ACTIVE: 'success', ON_NOTICE: 'warning', INACTIVE: 'neutral' };
const WORK_MODE_LABELS: Record<string, string> = { OFFICE: 'Office', REMOTE: 'Remote', HYBRID: 'Hybrid' };

function EmployeeFormDialog({ open, employee, onClose }: { open: boolean; employee: EmployeeView | null; onClose: () => void }) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const run = useAction();
  const today = useToday();
  const { data: departments } = useDepartmentsQuery();
  const { data: employees } = useEmployeesQuery({ includeInactive: false });
  const [create, createState] = useCreateEmployeeMutation();
  const [update, updateState] = useUpdateEmployeeMutation();
  const managers = (employees ?? []).filter((e) => (e.role === 'MANAGER' || e.role === 'ADMIN') && e.employeeId !== employee?.employeeId);

  const empty: EmployeeInput = {
    employeeName: '',
    email: '',
    phone: '',
    department: '',
    designation: '',
    managerId: '',
    joiningDate: today,
    employmentStatus: 'ACTIVE',
    role: 'EMPLOYEE',
    profileImage: '',
    workMode: 'OFFICE',
    location: '',
  };
  const { control, register, handleSubmit, reset, formState: { errors } } = useForm<EmployeeInput>({
    resolver: zodResolver(employeeInputSchema) as never,
    defaultValues: empty,
  });

  useEffect(() => {
    if (!open) return;
    if (employee) {
      const { employeeId: _id, managerName: _m, ...rest } = employee;
      reset(rest);
    } else reset(empty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, employee]);

  const submit = handleSubmit(async (values) => {
    const ok = employee
      ? await run(update({ id: employee.employeeId, input: values }).unwrap(), 'Employee updated')
      : await run(create(values).unwrap(), 'Employee added');
    if (ok) onClose();
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" fullScreen={fullScreen}>
      <Box component="form" onSubmit={submit} noValidate>
        <DialogTitle>{employee ? `Edit ${employee.employeeName}` : 'Add employee'}</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth label="Full name" {...register('employeeName')} error={!!errors.employeeName} helperText={errors.employeeName?.message} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth label="Email" type="email" {...register('email')} error={!!errors.email} helperText={errors.email?.message} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth label="Phone" {...register('phone')} error={!!errors.phone} helperText={errors.phone?.message} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth label="Designation" {...register('designation')} error={!!errors.designation} helperText={errors.designation?.message} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller name="department" control={control} render={({ field }) => (
                <TextField select fullWidth label="Department" {...field} error={!!errors.department} helperText={errors.department?.message}>
                  {(departments ?? []).map((d) => <MenuItem key={d.departmentId} value={d.departmentName}>{d.departmentName}</MenuItem>)}
                </TextField>
              )} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller name="managerId" control={control} render={({ field }) => (
                <TextField select fullWidth label="Reporting manager" {...field} value={field.value ?? ''} error={!!errors.managerId} helperText={errors.managerId?.message ?? 'Only Manager / HR Admin roles can be selected'}>
                  <MenuItem value="">No manager</MenuItem>
                  {managers.map((m) => <MenuItem key={m.employeeId} value={m.employeeId}>{m.employeeName} · {m.designation}</MenuItem>)}
                </TextField>
              )} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Controller name="role" control={control} render={({ field }) => (
                <TextField select fullWidth label="Role" {...field}>
                  {ROLES.map((r) => <MenuItem key={r} value={r}>{ROLE_LABELS[r]}</MenuItem>)}
                </TextField>
              )} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Controller name="employmentStatus" control={control} render={({ field }) => (
                <TextField select fullWidth label="Status" {...field}>
                  {EMPLOYMENT_STATUSES.map((s) => <MenuItem key={s} value={s}>{STATUS_LABELS[s]}</MenuItem>)}
                </TextField>
              )} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Controller name="workMode" control={control} render={({ field }) => (
                <TextField select fullWidth label="Work mode" {...field}>
                  {WORK_MODES.map((w) => <MenuItem key={w} value={w}>{WORK_MODE_LABELS[w]}</MenuItem>)}
                </TextField>
              )} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth type="date" label="Joining date" {...register('joiningDate')} error={!!errors.joiningDate} helperText={errors.joiningDate?.message} slotProps={{ inputLabel: { shrink: true } }} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth label="Location" {...register('location')} />
            </Grid>
            <Grid size={12}>
              <TextField fullWidth label="Profile image URL (optional)" {...register('profileImage')} error={!!errors.profileImage} helperText={errors.profileImage?.message} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={onClose} color="inherit">Cancel</Button>
          <LoadingButton type="submit" variant="contained" loading={createState.isLoading || updateState.isLoading}>
            {employee ? 'Save changes' : 'Add employee'}
          </LoadingButton>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

function ImportResultDialog({ result, onClose }: { result: ImportResult | null; onClose: () => void }) {
  return (
    <Dialog open={Boolean(result)} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Import complete</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5}>
          <Alert severity={result?.errors.length ? 'warning' : 'success'}>
            {result?.created ?? 0} created · {result?.updated ?? 0} updated · {result?.errors.length ?? 0} row(s) with errors
          </Alert>
          {Boolean(result?.errors.length) && (
            <List dense sx={{ maxHeight: 280, overflowY: 'auto', border: 1, borderColor: 'divider', borderRadius: 1 }}>
              {result!.errors.map((e, i) => (
                <ListItem key={i}><Typography variant="body2" color="error.main">{e}</Typography></ListItem>
              ))}
            </List>
          )}
          <Typography variant="caption" color="text.secondary">
            Rows are matched by email. Use the same columns as the Excel export (employeeName, email, department, designation, managerId, joiningDate, role, …).
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions><Button onClick={onClose} variant="contained">Done</Button></DialogActions>
    </Dialog>
  );
}

export default function EmployeesPage() {
  const run = useAction();
  const { user } = useAuth();
  const [department, setDepartment] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const { data, isLoading, error, refetch } = useEmployeesQuery({ department, role, status, includeInactive: true });
  const { data: departments } = useDepartmentsQuery();
  const [deactivate, deactivateState] = useDeactivateEmployeeMutation();
  const [importEmployees, importState] = useImportEmployeesMutation();
  const [editing, setEditing] = useState<EmployeeView | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [toDeactivate, setToDeactivate] = useState<EmployeeView | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [exporting, setExporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const rows = data;
  const activeCount = useMemo(() => (data ?? []).filter((e) => e.employmentStatus !== 'INACTIVE').length, [data]);

  const openForm = (e: EmployeeView | null) => {
    setEditing(e);
    setFormOpen(true);
  };

  const onImport = async (file?: File) => {
    if (!file) return;
    const result = await run(importEmployees(file).unwrap());
    if (result) setImportResult(result);
    if (fileRef.current) fileRef.current.value = '';
  };

  const columns: Column<EmployeeView>[] = [
    {
      id: 'name',
      label: 'Employee',
      minWidth: 220,
      sortValue: (r) => r.employeeName,
      searchValue: (r) => `${r.employeeId} ${r.employeeName} ${r.email} ${r.designation}`,
      render: (r) => <EmployeeCell employee={r} secondary={`${r.employeeId} · ${r.designation}`} />,
    },
    { id: 'email', label: 'Email', sortValue: (r) => r.email, hideBelow: 'lg', render: (r) => <Typography variant="body2">{r.email}</Typography> },
    { id: 'department', label: 'Department', sortValue: (r) => r.department, render: (r) => r.department },
    { id: 'manager', label: 'Manager', sortValue: (r) => r.managerName, hideBelow: 'lg', render: (r) => r.managerName || '—' },
    { id: 'role', label: 'Role', sortValue: (r) => r.role, render: (r) => <ToneChip tone={r.role === 'ADMIN' ? 'primary' : r.role === 'MANAGER' ? 'info' : 'neutral'} dot={false} label={ROLE_LABELS[r.role]} /> },
    { id: 'workMode', label: 'Work mode', sortValue: (r) => r.workMode, hideBelow: 'xl', render: (r) => WORK_MODE_LABELS[r.workMode] ?? r.workMode },
    { id: 'joined', label: 'Joined', sortValue: (r) => r.joiningDate, hideBelow: 'xl', render: (r) => fmtDate(r.joiningDate) },
    { id: 'status', label: 'Status', sortValue: (r) => r.employmentStatus, render: (r) => <ToneChip tone={STATUS_TONE[r.employmentStatus]} label={STATUS_LABELS[r.employmentStatus]} /> },
    {
      id: 'actions',
      label: '',
      align: 'right',
      render: (r) => (
        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
          <Tooltip title="Edit">
            <IconButton size="small" onClick={() => openForm(r)} aria-label={`Edit ${r.employeeName}`}><Pencil size={16} /></IconButton>
          </Tooltip>
          {r.employmentStatus !== 'INACTIVE' && r.employeeId !== user?.employeeId && (
            <Tooltip title="Deactivate">
              <IconButton size="small" color="error" onClick={() => setToDeactivate(r)} aria-label={`Deactivate ${r.employeeName}`}><UserMinus size={16} /></IconButton>
            </Tooltip>
          )}
        </Stack>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Employees"
        icon={<Users size={22} />}
        subtitle={`${activeCount} active employees across ${departments?.length ?? 0} departments`}
        actions={
          <>
            <input ref={fileRef} type="file" accept=".xlsx" hidden onChange={(e) => onImport(e.target.files?.[0])} />
            <LoadingButton variant="outlined" startIcon={<FileUp size={16} />} loading={importState.isLoading} onClick={() => fileRef.current?.click()}>
              Import Excel
            </LoadingButton>
            <LoadingButton
              variant="outlined"
              startIcon={<FileSpreadsheet size={16} />}
              loading={exporting}
              onClick={async () => {
                setExporting(true);
                await run(employeeRepository.exportExcel(), 'Employee export downloaded');
                setExporting(false);
              }}
            >
              Export Excel
            </LoadingButton>
            <Button
              variant="outlined"
              startIcon={<FileDown size={16} />}
              disabled={!rows?.length}
              onClick={() =>
                exportCsv('employees', rows ?? [], [
                  { header: 'Employee ID', value: (r) => r.employeeId },
                  { header: 'Name', value: (r) => r.employeeName },
                  { header: 'Email', value: (r) => r.email },
                  { header: 'Phone', value: (r) => r.phone },
                  { header: 'Department', value: (r) => r.department },
                  { header: 'Designation', value: (r) => r.designation },
                  { header: 'Manager', value: (r) => r.managerName },
                  { header: 'Role', value: (r) => ROLE_LABELS[r.role] },
                  { header: 'Status', value: (r) => STATUS_LABELS[r.employmentStatus] },
                  { header: 'Joining date', value: (r) => r.joiningDate },
                  { header: 'Work mode', value: (r) => r.workMode },
                  { header: 'Location', value: (r) => r.location },
                ])
              }
            >
              CSV
            </Button>
            <Button variant="contained" startIcon={<UserPlus size={16} />} onClick={() => openForm(null)}>
              Add employee
            </Button>
          </>
        }
      />

      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.employeeId}
        loading={isLoading}
        error={error}
        onRetry={refetch}
        onRowClick={(r) => openForm(r)}
        searchPlaceholder="Search name, email, ID…"
        initialSort={{ id: 'name', direction: 'asc' }}
        emptyTitle="No employees found"
        emptyDescription="Adjust the filters or add a new employee."
        toolbar={
          <>
            <FilterSelect label="Department" value={department} onChange={setDepartment} options={(departments ?? []).map((d) => ({ value: d.departmentName, label: d.departmentName }))} />
            <FilterSelect label="Role" value={role} onChange={setRole} options={optionsFrom(ROLE_LABELS)} minWidth={130} />
            <FilterSelect label="Status" value={status} onChange={setStatus} options={optionsFrom(STATUS_LABELS)} minWidth={130} />
          </>
        }
        mobileCard={(r) => (
          <Stack spacing={1.25}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
              <EmployeeCell employee={r} secondary={`${r.employeeId} · ${r.designation}`} />
              <ToneChip tone={STATUS_TONE[r.employmentStatus]} label={STATUS_LABELS[r.employmentStatus]} />
            </Stack>
            <Typography variant="caption" color="text.secondary">
              {r.department} · {ROLE_LABELS[r.role]} · Manager: {r.managerName || '—'}
            </Typography>
            <Typography variant="caption" color="text.secondary">{r.email}</Typography>
          </Stack>
        )}
      />

      <EmployeeFormDialog open={formOpen} employee={editing} onClose={() => setFormOpen(false)} />
      <ImportResultDialog result={importResult} onClose={() => setImportResult(null)} />
      <ConfirmDialog
        open={Boolean(toDeactivate)}
        title={`Deactivate ${toDeactivate?.employeeName}?`}
        description="The employee can no longer sign in. Their leave history is kept. Direct reports must be reassigned first."
        confirmLabel="Deactivate"
        confirmColor="error"
        loading={deactivateState.isLoading}
        onClose={() => setToDeactivate(null)}
        onConfirm={async () => {
          await run(deactivate(toDeactivate!.employeeId).unwrap(), 'Employee deactivated');
          setToDeactivate(null);
        }}
      />
    </>
  );
}
