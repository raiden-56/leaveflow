import { useRef, useState } from 'react';
import { Controller, useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  FormControlLabel,
  Grid,
  IconButton,
  MenuItem,
  Radio,
  RadioGroup,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
  alpha,
} from '@mui/material';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ChevronUp, Copy, Paperclip, Plus, Trash2, Upload, X } from 'lucide-react';
import dayjs from 'dayjs';
import {
  HALF_DAY_LABELS,
  PRIORITIES,
  PRIORITY_LABELS,
  type BackupCandidate,
  type LeaveBalanceView,
  type LeavePreview,
  type LeaveType,
} from '@leaveflow/shared';
import { EmployeeCell, LeaveTypeChip, PriorityChip } from '@/components/common';
import { useAction } from '@/hooks';
import { leaveRepository } from '@/services/repositories';
import { fmtDate, fmtDays, fmtRange } from '@/utils/format';
import { BackupPicker } from './BackupPicker';
import { DateField } from './DateField';
import { emptyTask, type ApplyFormValues } from './formTypes';

// ---------------------------------------------------------------------------
// Step 1 — leave details
// ---------------------------------------------------------------------------

export function LeaveDetailsStep({ leaveTypes, balances, minDate }: { leaveTypes: LeaveType[]; balances: LeaveBalanceView[]; minDate: string }) {
  const run = useAction();
  const { control, register, setValue, formState: { errors } } = useFormContext<ApplyFormValues>();
  const [leaveType, startDate, endDate, attachmentName] = useWatch({ control, name: ['leaveType', 'startDate', 'endDate', 'attachmentName'] });
  const type = leaveTypes.find((t) => t.code === leaveType);
  const singleDay = Boolean(startDate) && startDate === endDate;
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const balanceFor = (code: string) => balances.find((b) => b.leaveType === code);

  const upload = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    const res = await run(leaveRepository.uploadAttachment(file), 'Attachment uploaded');
    setUploading(false);
    if (res) {
      setValue('attachmentName', res.attachmentName);
      setValue('attachmentUrl', res.attachmentUrl);
    }
  };

  return (
    <Grid container spacing={2.5}>
      <Grid size={12}>
        <Controller
          name="leaveType"
          control={control}
          render={({ field }) => (
            <TextField select fullWidth label="Leave type *" {...field} error={!!errors.leaveType} helperText={errors.leaveType?.message ?? type?.description}>
              {leaveTypes.filter((t) => t.isActive).map((t) => {
                const b = balanceFor(t.code);
                return (
                  <MenuItem key={t.code} value={t.code}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ width: '100%' }} spacing={2}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: t.color }} />
                        <span>{t.name}</span>
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        {t.trackBalance ? `${b?.available ?? t.annualAllocation} days left` : t.isPaid ? 'No limit' : 'Unpaid'}
                      </Typography>
                    </Stack>
                  </MenuItem>
                );
              })}
            </TextField>
          )}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        <Controller
          name="startDate"
          control={control}
          render={({ field }) => (
            <DateField
              label="Start date *"
              value={field.value}
              onChange={(v) => {
                field.onChange(v);
                if (v && (!endDate || endDate < v)) setValue('endDate', v, { shouldValidate: true });
              }}
              onBlur={field.onBlur}
              minDate={minDate}
              error={errors.startDate?.message}
            />
          )}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        <Controller
          name="endDate"
          control={control}
          render={({ field }) => (
            <DateField label="End date *" value={field.value} onChange={field.onChange} onBlur={field.onBlur} minDate={startDate || minDate} error={errors.endDate?.message} />
          )}
        />
      </Grid>
      <Grid size={12}>
        <Collapse in={singleDay && type?.allowHalfDay !== false}>
          <Typography variant="caption" color="text.secondary">Day type</Typography>
          <Controller
            name="halfDay"
            control={control}
            render={({ field }) => (
              <RadioGroup row {...field}>
                {(['NONE', 'FIRST_HALF', 'SECOND_HALF'] as const).map((h) => (
                  <FormControlLabel key={h} value={h} control={<Radio size="small" />} label={HALF_DAY_LABELS[h]} />
                ))}
              </RadioGroup>
            )}
          />
          {errors.halfDay && <Typography variant="caption" color="error">{errors.halfDay.message}</Typography>}
        </Collapse>
      </Grid>
      <Grid size={12}>
        <TextField fullWidth multiline minRows={3} label="Reason for leave *" {...register('reason')} error={!!errors.reason} helperText={errors.reason?.message} slotProps={{ htmlInput: { maxLength: 1000 } }} />
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        <TextField fullWidth label="Emergency contact" placeholder="Name & phone" {...register('emergencyContact')} error={!!errors.emergencyContact} helperText={errors.emergencyContact?.message} />
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        <TextField fullWidth label="Contact during leave (optional)" placeholder="e.g. Reachable on phone after 6 PM" {...register('contactDuringLeave')} />
      </Grid>
      <Grid size={12}>
        <input ref={fileRef} type="file" hidden accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" onChange={(e) => void upload(e.target.files?.[0])} />
        {attachmentName ? (
          <Chip icon={<Paperclip size={14} />} label={attachmentName} onDelete={() => { setValue('attachmentName', ''); setValue('attachmentUrl', ''); }} deleteIcon={<X size={14} />} />
        ) : (
          <Button variant="outlined" color="inherit" startIcon={uploading ? <CircularProgress size={14} /> : <Upload size={16} />} disabled={uploading} onClick={() => fileRef.current?.click()}>
            Attach document {type && type.requiresAttachmentAfterDays > 0 ? `(required above ${type.requiresAttachmentAfterDays} day(s))` : '(optional)'}
          </Button>
        )}
        <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.5 }}>PDF, image or Word, up to 5 MB.</Typography>
      </Grid>
    </Grid>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — handover
// ---------------------------------------------------------------------------

interface HandoverStepProps {
  candidates: BackupCandidate[] | undefined;
  loadingCandidates: boolean;
  required: boolean;
  include: boolean;
  onIncludeChange: (v: boolean) => void;
  onDatesTouched: () => void;
}

export function HandoverStep({ candidates, loadingCandidates, required, include, onIncludeChange, onDatesTouched }: HandoverStepProps) {
  const { control, register, formState: { errors } } = useFormContext<ApplyFormValues>();
  const [startDate, endDate] = useWatch({ control, name: ['startDate', 'endDate'] });
  const he = errors.handover;

  return (
    <Stack spacing={2.5}>
      {required ? (
        <Alert severity="info" icon={false}>
          <b>A work handover is mandatory.</b> Pick a colleague who will manage your responsibilities from {fmtRange(startDate, endDate)}. They will be asked to accept it.
        </Alert>
      ) : (
        <FormControlLabel control={<Switch checked={include} onChange={(e) => onIncludeChange(e.target.checked)} />} label="Add a work handover for this leave" />
      )}
      <Collapse in={include} unmountOnExit>
        <Grid container spacing={2.5}>
          <Grid size={12}>
            <Controller
              name="handover.backupEmployeeId"
              control={control}
              render={({ field }) => (
                <BackupPicker candidates={candidates} loading={loadingCandidates} value={field.value} onChange={field.onChange} error={he?.backupEmployeeId?.message} disabled={!startDate || !endDate} />
              )}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 8 }}>
            <TextField fullWidth label="Handover title *" placeholder="e.g. Payments API ownership" {...register('handover.handoverTitle')} error={!!he?.handoverTitle} helperText={he?.handoverTitle?.message} />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Controller name="handover.priority" control={control} render={({ field }) => (
              <TextField select fullWidth label="Priority" {...field}>
                {PRIORITIES.map((p) => <MenuItem key={p} value={p}>{PRIORITY_LABELS[p]}</MenuItem>)}
              </TextField>
            )} />
          </Grid>
          <Grid size={12}>
            <TextField fullWidth multiline minRows={3} label="Work description *" placeholder="Which responsibilities, projects and stakeholders does your backup need to handle?" {...register('handover.handoverDescription')} error={!!he?.handoverDescription} helperText={he?.handoverDescription?.message} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Controller name="handover.startDate" control={control} render={({ field }) => (
              <DateField label="Handover start *" value={field.value} onChange={(v) => { onDatesTouched(); field.onChange(v); }} maxDate={startDate} error={he?.startDate?.message} helperText="On or before your first day of leave" />
            )} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Controller name="handover.endDate" control={control} render={({ field }) => (
              <DateField label="Handover end *" value={field.value} onChange={(v) => { onDatesTouched(); field.onChange(v); }} minDate={endDate} error={he?.endDate?.message} helperText="On or after your last day of leave" />
            )} />
          </Grid>
          <Grid size={12}>
            <TextField fullWidth multiline minRows={2} label="Important instructions" placeholder="Access, escalation contacts, where documents live…" {...register('handover.instructions')} />
          </Grid>
        </Grid>
      </Collapse>
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — tasks
// ---------------------------------------------------------------------------

export function TasksStep({ candidates }: { candidates: BackupCandidate[] | undefined }) {
  const { control, register, getValues, formState: { errors } } = useFormContext<ApplyFormValues>();
  const { fields, append, remove, insert } = useFieldArray({ control, name: 'handover.tasks' });
  const [backupId, startDate] = useWatch({ control, name: ['handover.backupEmployeeId', 'startDate'] });
  // Watched (not getValues) so each task header updates as its title and priority are edited.
  const tasks = useWatch({ control, name: 'handover.tasks' });
  const [expanded, setExpanded] = useState<string | null>(fields[0]?.id ?? null);
  const taskErrors = errors.handover?.tasks;

  const add = () => {
    append(emptyTask(backupId, startDate));
    setTimeout(() => setExpanded(null), 0);
  };

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        List the pending work your backup should pick up. Each task can have its own assignee, due date and references.
      </Typography>
      <AnimatePresence initial={false}>
        {fields.map((f, i) => {
          const values = tasks?.[i];
          const open = expanded === f.id || expanded === null && i === fields.length - 1;
          const err = Array.isArray(taskErrors) ? taskErrors[i] : undefined;
          return (
            <motion.div key={f.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}>
              <Card variant="outlined" sx={{ borderColor: err ? 'error.main' : 'divider' }}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2, py: 1.25, cursor: 'pointer' }} onClick={() => setExpanded(open ? '' : f.id)}>
                  <Box sx={{ width: 26, height: 26, borderRadius: '50%', bgcolor: 'primary.light', color: 'primary.main', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{i + 1}</Box>
                  <Typography variant="subtitle2" sx={{ flex: 1, minWidth: 0 }} noWrap>{values?.taskTitle || 'Untitled task'}</Typography>
                  {values?.priority && <PriorityChip priority={values.priority} />}
                  <Tooltip title="Duplicate"><IconButton size="small" onClick={(e) => { e.stopPropagation(); insert(i + 1, { ...getValues(`handover.tasks.${i}`), taskId: undefined }); }} aria-label="Duplicate task"><Copy size={15} /></IconButton></Tooltip>
                  <Tooltip title="Remove"><IconButton size="small" onClick={(e) => { e.stopPropagation(); remove(i); }} aria-label="Remove task"><Trash2 size={15} /></IconButton></Tooltip>
                  {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </Stack>
                <Collapse in={open}>
                  <Divider />
                  <Grid container spacing={2} sx={{ p: 2 }}>
                    <Grid size={12}>
                      <TextField fullWidth label="Task name *" {...register(`handover.tasks.${i}.taskTitle`)} error={!!err?.taskTitle} helperText={err?.taskTitle?.message} />
                    </Grid>
                    <Grid size={12}>
                      <TextField fullWidth multiline minRows={2} label="Description" {...register(`handover.tasks.${i}.taskDescription`)} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <Controller name={`handover.tasks.${i}.priority`} control={control} render={({ field }) => (
                        <TextField select fullWidth label="Priority" {...field}>
                          {PRIORITIES.map((p) => <MenuItem key={p} value={p}>{PRIORITY_LABELS[p]}</MenuItem>)}
                        </TextField>
                      )} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <Controller name={`handover.tasks.${i}.dueDate`} control={control} render={({ field }) => (
                        <DateField label="Due date" value={field.value} onChange={field.onChange} error={err?.dueDate?.message} />
                      )} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <Controller name={`handover.tasks.${i}.assignedEmployeeId`} control={control} render={({ field }) => (
                        <TextField select fullWidth label="Assigned to" {...field} value={field.value || backupId} helperText="Defaults to your backup">
                          {(candidates ?? []).filter((c) => c.availability !== 'ON_LEAVE').map((c) => <MenuItem key={c.employeeId} value={c.employeeId}>{c.employeeName}</MenuItem>)}
                        </TextField>
                      )} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField fullWidth label="Reference links" placeholder="https://…" {...register(`handover.tasks.${i}.referenceLinks`)} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField fullWidth label="Expected outcome" {...register(`handover.tasks.${i}.expectedOutcome`)} />
                    </Grid>
                    <Grid size={12}>
                      <TextField fullWidth label="Additional notes" {...register(`handover.tasks.${i}.notes`)} />
                    </Grid>
                  </Grid>
                </Collapse>
              </Card>
            </motion.div>
          );
        })}
      </AnimatePresence>
      {fields.length === 0 && (
        <Box sx={{ p: 3, textAlign: 'center', border: 2, borderStyle: 'dashed', borderColor: 'divider', borderRadius: 1 }}>
          <Typography variant="body2" color="text.secondary">No tasks yet. Tasks are optional but help your backup a lot.</Typography>
        </Box>
      )}
      <Button variant="outlined" startIcon={<Plus size={16} />} onClick={add} sx={{ alignSelf: 'flex-start' }} disabled={fields.length >= 50}>
        Add task
      </Button>
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Step 4 — review
// ---------------------------------------------------------------------------

export function ReviewStep({ leaveType, preview, candidates, includeHandover }: { leaveType?: LeaveType; preview: LeavePreview | null; candidates: BackupCandidate[] | undefined; includeHandover: boolean }) {
  const { getValues } = useFormContext<ApplyFormValues>();
  const v = getValues();
  const backup = candidates?.find((c) => c.employeeId === v.handover.backupEmployeeId);
  const row = (label: string, value: React.ReactNode) => (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 0.25, sm: 2 }} sx={{ py: 1 }}>
      <Typography variant="body2" color="text.secondary" sx={{ width: { sm: 180 }, flexShrink: 0 }}>{label}</Typography>
      <Typography variant="body2" component="div" sx={{ wordBreak: 'break-word' }}>{value || '—'}</Typography>
    </Stack>
  );
  return (
    <Stack spacing={2}>
      {preview?.errors.map((e) => <Alert key={e} severity="error">{e}</Alert>)}
      {preview?.warnings.map((w) => <Alert key={w} severity="warning">{w}</Alert>)}
      <Card variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>Leave</Typography>
        <Divider />
        {row('Leave type', leaveType && <LeaveTypeChip name={leaveType.name} color={leaveType.color} />)}
        {row('Dates', `${fmtDate(v.startDate)} → ${fmtDate(v.endDate)}`)}
        {row('Duration', preview ? fmtDays(preview.totalDays, v.halfDay) : '…')}
        {row('Reason', v.reason)}
        {row('Emergency contact', v.emergencyContact)}
        {row('Contact during leave', v.contactDuringLeave)}
        {row('Attachment', v.attachmentName)}
      </Card>
      {includeHandover ? (
        <Card variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>Work handover</Typography>
          <Divider />
          {row('Backup', backup ? <EmployeeCell employee={backup} /> : v.handover.backupEmployeeId)}
          {row('Title', v.handover.handoverTitle)}
          {row('Period', fmtRange(v.handover.startDate, v.handover.endDate))}
          {row('Priority', <PriorityChip priority={v.handover.priority} />)}
          {row('Description', v.handover.handoverDescription)}
          {row('Instructions', v.handover.instructions)}
          {row(
            'Tasks',
            v.handover.tasks.length ? (
              <Stack spacing={0.5}>
                {v.handover.tasks.map((t, i) => (
                  <Typography key={i} variant="body2">
                    {i + 1}. {t.taskTitle} <Typography component="span" variant="caption" color="text.secondary">({PRIORITY_LABELS[t.priority]}{t.dueDate ? `, due ${dayjs(t.dueDate).format('DD MMM')}` : ''})</Typography>
                  </Typography>
                ))}
              </Stack>
            ) : 'No tasks',
          )}
        </Card>
      ) : (
        <Alert severity="warning">No work handover will be created.</Alert>
      )}
      <Box sx={{ p: 2, borderRadius: 1, bgcolor: (t) => alpha(t.palette.primary.main, 0.06) }}>
        <Typography variant="body2">
          After you submit, your manager is notified to review the request{includeHandover && backup ? ` and ${backup.employeeName} is asked to accept the handover` : ''}.
        </Typography>
      </Box>
    </Stack>
  );
}
