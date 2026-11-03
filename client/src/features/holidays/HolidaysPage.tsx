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
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import dayjs from 'dayjs';
import { CalendarDays, FileUp, List as ListIcon, PartyPopper, Pencil, Plus, Trash2 } from 'lucide-react';
import { HOLIDAY_TYPES, HOLIDAY_TYPE_LABELS, holidayInputSchema, type Holiday, type HolidayInput, type HolidayType } from '@leaveflow/shared';
import { useCreateHolidayMutation, useDeleteHolidayMutation, useHolidaysQuery, useImportHolidaysMutation, useUpdateHolidayMutation } from '@/app/store/api';
import { CardsSkeleton, ConfirmDialog, DataTable, ErrorState, LoadingButton, PageHeader, StatCard, ToneChip, type Column } from '@/components/common';
import { useAction, useAuth, useToday } from '@/hooks';
import type { ImportResult } from '@/services/repositories';
import { palette, type StatusTone } from '@/theme/tokens';
import { fmtDate } from '@/utils/format';
import { MonthGrid, type MarkedDay } from './MonthGrid';

const TYPE_COLOR: Record<HolidayType, string> = { PUBLIC: palette.indigo, OPTIONAL: palette.pending, COMPANY: palette.teal };
const TYPE_TONE: Record<HolidayType, StatusTone> = { PUBLIC: 'primary', OPTIONAL: 'warning', COMPANY: 'success' };

function HolidayDialog({ open, holiday, year, onClose }: { open: boolean; holiday: Holiday | null; year: number; onClose: () => void }) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const run = useAction();
  const [create, createState] = useCreateHolidayMutation();
  const [update, updateState] = useUpdateHolidayMutation();
  const empty: HolidayInput = { holidayName: '', holidayDate: `${year}-01-01`, holidayType: 'PUBLIC', description: '' };
  const { control, register, handleSubmit, reset, formState: { errors } } = useForm<HolidayInput>({
    resolver: zodResolver(holidayInputSchema) as never,
    defaultValues: empty,
  });
  useEffect(() => {
    if (open) reset(holiday ? { holidayName: holiday.holidayName, holidayDate: holiday.holidayDate, holidayType: holiday.holidayType, description: holiday.description } : empty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, holiday]);

  const submit = handleSubmit(async (values) => {
    const ok = holiday
      ? await run(update({ id: holiday.holidayId, input: values }).unwrap(), 'Holiday updated')
      : await run(create(values).unwrap(), 'Holiday added');
    if (ok) onClose();
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" fullScreen={fullScreen}>
      <Box component="form" onSubmit={submit} noValidate>
        <DialogTitle>{holiday ? 'Edit holiday' : 'Add holiday'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField fullWidth label="Holiday name" {...register('holidayName')} error={!!errors.holidayName} helperText={errors.holidayName?.message} />
            <TextField fullWidth type="date" label="Date" {...register('holidayDate')} error={!!errors.holidayDate} helperText={errors.holidayDate?.message} slotProps={{ inputLabel: { shrink: true } }} />
            <Controller name="holidayType" control={control} render={({ field }) => (
              <TextField select fullWidth label="Type" {...field} helperText="Optional holidays are not excluded from leave day counts">
                {HOLIDAY_TYPES.map((t) => <MenuItem key={t} value={t}>{HOLIDAY_TYPE_LABELS[t]}</MenuItem>)}
              </TextField>
            )} />
            <TextField fullWidth multiline minRows={2} label="Description" {...register('description')} />
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

export default function HolidaysPage() {
  const run = useAction();
  const today = useToday();
  const { settings } = useAuth();
  const currentYear = Number(today.slice(0, 4));
  const [year, setYear] = useState(currentYear);
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const { data, isLoading, isFetching, error, refetch } = useHolidaysQuery(year);
  const [remove, removeState] = useDeleteHolidayMutation();
  const [importHolidays, importState] = useImportHolidaysMutation();
  const [editing, setEditing] = useState<Holiday | null>(null);
  const [open, setOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Holiday | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const holidays = data ?? [];
  const upcoming = holidays.filter((h) => h.holidayDate >= today && h.holidayType !== 'OPTIONAL');
  const workdayHolidays = holidays.filter((h) => h.holidayType !== 'OPTIONAL' && (settings?.workingDays ?? [1, 2, 3, 4, 5]).includes(dayjs(h.holidayDate).day()));
  const marks: MarkedDay[] = useMemo(
    () => holidays.map((h) => ({ date: h.holidayDate, color: TYPE_COLOR[h.holidayType], label: `${h.holidayName} (${HOLIDAY_TYPE_LABELS[h.holidayType]})` })),
    [holidays],
  );

  const onImport = async (file?: File) => {
    if (!file) return;
    const result = await run(importHolidays(file).unwrap());
    if (result) setImportResult(result);
    if (fileRef.current) fileRef.current.value = '';
  };

  const columns: Column<Holiday>[] = [
    {
      id: 'date',
      label: 'Date',
      sortValue: (h) => h.holidayDate,
      render: (h) => (
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box sx={{ width: 44, textAlign: 'center', borderRadius: 1, border: 1, borderColor: 'divider', py: 0.25, opacity: h.holidayDate < today ? 0.55 : 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2 }}>{dayjs(h.holidayDate).format('MMM')}</Typography>
            <Typography variant="subtitle2" sx={{ lineHeight: 1.2 }}>{dayjs(h.holidayDate).format('DD')}</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">{dayjs(h.holidayDate).format('dddd')}</Typography>
        </Stack>
      ),
    },
    { id: 'name', label: 'Holiday', sortValue: (h) => h.holidayName, render: (h) => <Typography variant="body2" fontWeight={600}>{h.holidayName}</Typography> },
    { id: 'type', label: 'Type', sortValue: (h) => h.holidayType, searchValue: (h) => HOLIDAY_TYPE_LABELS[h.holidayType], render: (h) => <ToneChip tone={TYPE_TONE[h.holidayType]} label={HOLIDAY_TYPE_LABELS[h.holidayType]} /> },
    { id: 'desc', label: 'Description', hideBelow: 'lg', searchValue: (h) => h.description, render: (h) => <Typography variant="body2" color="text.secondary">{h.description || '—'}</Typography> },
    {
      id: 'actions',
      label: '',
      align: 'right',
      render: (h) => (
        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
          <Tooltip title="Edit"><IconButton size="small" onClick={() => { setEditing(h); setOpen(true); }} aria-label={`Edit ${h.holidayName}`}><Pencil size={16} /></IconButton></Tooltip>
          <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => setToDelete(h)} aria-label={`Delete ${h.holidayName}`}><Trash2 size={16} /></IconButton></Tooltip>
        </Stack>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Holidays"
        icon={<PartyPopper size={22} />}
        subtitle="Public, optional and company holidays. Non-optional holidays are excluded from leave day counts."
        actions={
          <>
            <input ref={fileRef} type="file" accept=".xlsx" hidden onChange={(e) => onImport(e.target.files?.[0])} />
            <LoadingButton variant="outlined" startIcon={<FileUp size={16} />} loading={importState.isLoading} onClick={() => fileRef.current?.click()}>Import Excel</LoadingButton>
            <Button variant="contained" startIcon={<Plus size={16} />} onClick={() => { setEditing(null); setOpen(true); }}>Add holiday</Button>
          </>
        }
      />

      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        <Grid size={{ xs: 12, sm: 4 }}><StatCard index={0} label={`Holidays in ${year}`} value={holidays.length} icon={<PartyPopper size={20} />} color={palette.indigo} caption={`${holidays.filter((h) => h.holidayType === 'OPTIONAL').length} optional`} /></Grid>
        <Grid size={{ xs: 12, sm: 4 }}><StatCard index={1} label="On working days" value={workdayHolidays.length} icon={<CalendarDays size={20} />} color={palette.teal} caption="Excluded from leave counts" /></Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <StatCard index={2} label="Next holiday" value={upcoming[0] ? fmtDate(upcoming[0].holidayDate, 'DD MMM') : '—'} icon={<PartyPopper size={20} />} color={palette.pending} caption={upcoming[0]?.holidayName ?? 'No upcoming holidays this year'} />
        </Grid>
      </Grid>

      <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between" sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
        <TextField select label="Year" value={year} onChange={(e) => setYear(Number(e.target.value))} sx={{ minWidth: 110 }}>
          {[currentYear - 1, currentYear, currentYear + 1].map((y) => <MenuItem key={y} value={y}>{y}</MenuItem>)}
        </TextField>
        <Stack direction="row" spacing={1.5} alignItems="center">
          {view === 'calendar' && (
            <Stack direction="row" spacing={1.5} sx={{ display: { xs: 'none', sm: 'flex' } }}>
              {HOLIDAY_TYPES.map((t) => (
                <Stack key={t} direction="row" spacing={0.75} alignItems="center">
                  <Box sx={{ width: 10, height: 10, borderRadius: 1, bgcolor: TYPE_COLOR[t] }} />
                  <Typography variant="caption">{HOLIDAY_TYPE_LABELS[t]}</Typography>
                </Stack>
              ))}
            </Stack>
          )}
          <ToggleButtonGroup size="small" exclusive value={view} onChange={(_, v) => v && setView(v)} aria-label="View">
            <ToggleButton value="list" aria-label="List view"><ListIcon size={16} /></ToggleButton>
            <ToggleButton value="calendar" aria-label="Calendar view"><CalendarDays size={16} /></ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      </Stack>

      {view === 'list' ? (
        <DataTable
          rows={holidays}
          columns={columns}
          rowKey={(h) => h.holidayId}
          loading={isLoading || isFetching}
          error={error}
          onRetry={refetch}
          initialSort={{ id: 'date', direction: 'asc' }}
          pageSize={25}
          searchPlaceholder="Search holidays…"
          emptyTitle={`No holidays configured for ${year}`}
          emptyDescription="Add holidays one by one or import them from an Excel sheet."
          onRowClick={(h) => { setEditing(h); setOpen(true); }}
        />
      ) : error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isLoading ? (
        <CardsSkeleton count={8} height={230} />
      ) : (
        <Grid container spacing={2}>
          {Array.from({ length: 12 }, (_, m) => `${year}-${String(m + 1).padStart(2, '0')}`).map((month) => (
            <Grid key={month} size={{ xs: 12, sm: 6, md: 4, xl: 3 }}>
              <MonthGrid
                month={month}
                marks={marks}
                today={today}
                workingDays={settings?.workingDays}
                onDayClick={(date) => {
                  const h = holidays.find((x) => x.holidayDate === date);
                  if (h) { setEditing(h); setOpen(true); }
                }}
              />
            </Grid>
          ))}
        </Grid>
      )}

      <HolidayDialog open={open} holiday={editing} year={year} onClose={() => setOpen(false)} />
      <ConfirmDialog
        open={Boolean(toDelete)}
        title={`Delete ${toDelete?.holidayName}?`}
        description={`${fmtDate(toDelete?.holidayDate)} will become a regular working day for leave calculations.`}
        confirmLabel="Delete"
        confirmColor="error"
        loading={removeState.isLoading}
        onClose={() => setToDelete(null)}
        onConfirm={async () => {
          await run(remove(toDelete!.holidayId).unwrap(), 'Holiday deleted');
          setToDelete(null);
        }}
      />
      <Dialog open={Boolean(importResult)} onClose={() => setImportResult(null)} fullWidth maxWidth="sm">
        <DialogTitle>Holiday import</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5}>
            <Alert severity={importResult?.errors.length ? 'warning' : 'success'}>
              {importResult?.created ?? 0} added · {importResult?.skipped ?? 0} skipped as duplicates · {importResult?.errors.length ?? 0} invalid row(s)
            </Alert>
            {Boolean(importResult?.errors.length) && (
              <List dense sx={{ maxHeight: 240, overflowY: 'auto', border: 1, borderColor: 'divider', borderRadius: 1 }}>
                {importResult!.errors.map((e, i) => <ListItem key={i}><Typography variant="body2" color="error.main">{e}</Typography></ListItem>)}
              </List>
            )}
            <Typography variant="caption" color="text.secondary">Expected columns: holidayName, holidayDate (YYYY-MM-DD), holidayType (PUBLIC / OPTIONAL / COMPANY), description.</Typography>
          </Stack>
        </DialogContent>
        <DialogActions><Button variant="contained" onClick={() => setImportResult(null)}>Done</Button></DialogActions>
      </Dialog>
    </>
  );
}
