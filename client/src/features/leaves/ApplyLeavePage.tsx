import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FormProvider, useForm, useWatch } from 'react-hook-form';
import { Alert, Box, Button, Card, CircularProgress, Grid, LinearProgress, Paper, Stack, Step, StepLabel, Stepper, Typography, alpha } from '@mui/material';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, CalendarPlus, Send } from 'lucide-react';
import { addDays, type LeavePreview } from '@leaveflow/shared';
import { useApplyLeaveMutation, useBackupCandidatesQuery, useLeaveQuery, useLeaveTypesQuery, useMyBalancesQuery, useUpdateLeaveMutation } from '@/app/store/api';
import { ErrorState, LoadingButton, PageHeader, PageSkeleton } from '@/components/common';
import { useAuth, useDebounce, useResponsive, useToast, useToday } from '@/hooks';
import { leaveRepository } from '@/services/repositories';
import type { ApiError } from '@/services/api/httpClient';
import { fmtDays } from '@/utils/format';
import { applyResolver, defaultValues, emptyTask, STEP_FIELDS, toPayload, type ApplyFormValues } from './apply/formTypes';
import { RangePreview } from './apply/RangePreview';
import { HandoverStep, LeaveDetailsStep, ReviewStep, TasksStep } from './apply/Steps';

const STEPS = ['Leave details', 'Work handover', 'Handover tasks', 'Review & submit'];

export default function ApplyLeavePage() {
  const navigate = useNavigate();
  const toast = useToast();
  const today = useToday();
  const { user, settings } = useAuth();
  const { isCompact } = useResponsive();
  const [params] = useSearchParams();
  const editId = params.get('edit');
  const requireHandover = settings?.requireHandover ?? true;

  const { data: leaveTypes, isLoading: typesLoading, error: typesError } = useLeaveTypesQuery();
  const { data: balances } = useMyBalancesQuery({ employeeId: user?.employeeId ?? '' }, { skip: !user });
  const { data: existing, isLoading: existingLoading, error: existingError } = useLeaveQuery(editId ?? '', { skip: !editId });
  const [applyLeave, applyState] = useApplyLeaveMutation();
  const [updateLeave, updateState] = useUpdateLeaveMutation();

  const [step, setStep] = useState(0);
  const [includeHandover, setIncludeHandover] = useState(true);
  const includeRef = useRef(includeHandover);
  includeRef.current = includeHandover || requireHandover;
  const datesTouched = useRef(false);
  const [preview, setPreview] = useState<LeavePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string[] | null>(null);

  const resolver = useMemo(() => applyResolver(() => includeRef.current), []);
  const methods = useForm<ApplyFormValues>({ resolver, defaultValues, mode: 'onTouched' });
  const { control, setValue, trigger, handleSubmit, reset } = methods;
  const [leaveType, startDate, endDate, halfDay] = useWatch({ control, name: ['leaveType', 'startDate', 'endDate', 'halfDay'] });

  // Load an existing request for "edit & resubmit".
  useEffect(() => {
    if (!existing) return;
    if (existing.employeeId !== user?.employeeId || !['PENDING', 'CHANGES_REQUESTED'].includes(existing.status)) return;
    const h = existing.handover;
    datesTouched.current = true;
    reset({
      leaveType: existing.leaveType,
      startDate: existing.startDate,
      endDate: existing.endDate,
      halfDay: existing.halfDay,
      reason: existing.reason,
      emergencyContact: existing.emergencyContact,
      contactDuringLeave: existing.contactDuringLeave,
      attachmentName: existing.attachmentName,
      attachmentUrl: existing.attachmentUrl,
      handover: h
        ? {
            backupEmployeeId: h.handoverStatus === 'DECLINED' ? '' : h.backupEmployeeId,
            handoverTitle: h.handoverTitle,
            handoverDescription: h.handoverDescription,
            startDate: h.startDate,
            endDate: h.endDate,
            priority: h.priority,
            instructions: h.instructions,
            tasks: h.tasks.map((t) => ({
              taskId: t.taskId,
              taskTitle: t.taskTitle,
              taskDescription: t.taskDescription,
              priority: t.priority,
              dueDate: t.dueDate,
              assignedEmployeeId: t.assignedEmployeeId,
              referenceLinks: t.referenceLinks,
              expectedOutcome: t.expectedOutcome,
              notes: t.notes,
            })),
          }
        : { ...defaultValues.handover, startDate: existing.startDate, endDate: existing.endDate },
    });
    setIncludeHandover(Boolean(h) || requireHandover);
  }, [existing, user, reset, requireHandover]);

  // Keep handover dates aligned with the leave dates until the user edits them.
  useEffect(() => {
    if (datesTouched.current) return;
    if (startDate) setValue('handover.startDate', startDate);
    if (endDate) setValue('handover.endDate', endDate);
  }, [startDate, endDate, setValue]);

  useEffect(() => {
    if (leaveType && startDate && startDate !== endDate && halfDay !== 'NONE') setValue('halfDay', 'NONE');
  }, [leaveType, startDate, endDate, halfDay, setValue]);

  // Authoritative live preview from the API (working days, holidays, balance, overlaps).
  const previewKey = useDebounce(leaveType && startDate && endDate ? `${leaveType}|${startDate}|${endDate}|${halfDay}` : '', 350);
  useEffect(() => {
    if (!previewKey) {
      setPreview(null);
      return;
    }
    const [lt, s, e, h] = previewKey.split('|');
    let cancelled = false;
    setPreviewLoading(true);
    leaveRepository
      .preview({ leaveType: lt, startDate: s, endDate: e, halfDay: h as ApplyFormValues['halfDay'], excludeLeaveId: editId ?? '' })
      .then((p) => !cancelled && setPreview(p))
      .catch((err: ApiError) => !cancelled && setPreview({ totalDays: 0, days: [], errors: [err.message], warnings: [] }))
      .finally(() => !cancelled && setPreviewLoading(false));
    return () => {
      cancelled = true;
    };
  }, [previewKey, editId]);

  const { data: candidates, isFetching: candidatesLoading } = useBackupCandidatesQuery(
    { startDate, endDate, excludeLeaveId: editId ?? undefined },
    { skip: !startDate || !endDate || endDate < startDate },
  );

  const type = leaveTypes?.find((t) => t.code === leaveType);
  const balance = balances?.find((b) => b.leaveType === leaveType) ?? preview?.balance;
  const minDate = addDays(today, -(type?.backdatedDays ?? 0));
  const handoverOn = includeHandover || requireHandover;
  const steps = handoverOn ? STEPS : [STEPS[0], STEPS[3]];
  const stepIndex = handoverOn ? step : step === 0 ? 0 : 3;

  const next = async () => {
    const fields = STEP_FIELDS[stepIndex] as never[];
    const valid = fields.length ? await trigger(fields, { shouldFocus: true }) : true;
    if (!valid) return;
    if (stepIndex === 0 && preview?.errors.length) {
      toast.error(preview.errors[0]);
      return;
    }
    if (stepIndex === 1 && methods.getValues('handover.tasks').length === 0) {
      setValue('handover.tasks', [emptyTask(methods.getValues('handover.backupEmployeeId'), startDate)]);
    }
    setStep((s) => Math.min(s + 1, steps.length - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const back = () => setStep((s) => Math.max(0, s - 1));

  const onSubmit = handleSubmit(
    async (values) => {
      setSubmitError(null);
      // Empty task rows (added but never filled) are dropped instead of failing validation.
      const cleaned = { ...values, handover: { ...values.handover, tasks: values.handover.tasks.filter((t) => t.taskTitle.trim()) } };
      const payload = toPayload(cleaned, handoverOn) as never;
      try {
        const result = editId ? await updateLeave({ id: editId, input: payload }).unwrap() : await applyLeave(payload).unwrap();
        toast.success(`${result.leaveTypeName} request ${result.leaveId} ${editId ? 'resubmitted' : 'submitted'} for approval`, 'Leave submitted');
        navigate(`/my-leaves?leave=${result.leaveId}`);
      } catch (err) {
        const e = err as ApiError;
        const list = (e.details as { errors?: string[] } | undefined)?.errors;
        setSubmitError(list?.length ? list : [e.message]);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
    (errs) => {
      const firstStep = errs.handover ? (errs.handover.tasks ? 2 : 1) : 0;
      setStep(handoverOn ? firstStep : 0);
      toast.error('Please fix the highlighted fields');
    },
  );

  if (typesLoading || (editId && existingLoading)) return <PageSkeleton />;
  if (typesError || existingError) return <ErrorState error={typesError ?? existingError} />;
  if (editId && existing && (existing.employeeId !== user?.employeeId || !['PENDING', 'CHANGES_REQUESTED'].includes(existing.status))) {
    return <Alert severity="warning">Leave {editId} can no longer be edited (status: {existing.status.toLowerCase().replace('_', ' ')}).</Alert>;
  }

  const submitting = applyState.isLoading || updateState.isLoading;
  const isLast = step === steps.length - 1;

  const summary = (
    <Stack spacing={2} sx={{ position: { lg: 'sticky' }, top: { lg: 88 } }}>
      <Card sx={{ p: 2.5, background: (t) => `linear-gradient(135deg, ${alpha(t.palette.primary.main, 0.08)}, ${alpha(t.palette.secondary.main, 0.06)})` }}>
        <Typography variant="overline" color="text.secondary">Leave duration</Typography>
        <Stack direction="row" alignItems="baseline" spacing={1}>
          <Typography variant="h3" color="primary.main">{preview ? preview.totalDays : '–'}</Typography>
          <Typography color="text.secondary">{preview ? (preview.totalDays === 1 ? 'working day' : 'working days') : 'select dates'}</Typography>
          {previewLoading && <CircularProgress size={16} />}
        </Stack>
        {balance && type?.trackBalance && (
          <Box sx={{ mt: 2 }}>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2" fontWeight={600}>{type.name} balance</Typography>
              <Typography variant="body2">
                <b>{Math.max(0, balance.available - (preview?.totalDays ?? 0) + (editId && existing?.leaveType === leaveType ? existing.totalDays : 0))}</b> / {balance.total} after this
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={balance.total ? Math.min(100, ((balance.used + balance.pending + (preview?.totalDays ?? 0)) / balance.total) * 100) : 0}
              color={(preview?.totalDays ?? 0) > balance.available + (editId && existing?.leaveType === leaveType ? existing.totalDays : 0) ? 'error' : 'primary'}
              sx={{ mt: 1 }}
            />
            <Typography variant="caption" color="text.secondary">
              Available now {balance.available} · used {balance.used} · pending {balance.pending}
            </Typography>
          </Box>
        )}
        {type && !type.trackBalance && <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{type.isPaid ? 'No balance limit for this leave type.' : 'Unpaid leave — no balance is deducted.'}</Typography>}
      </Card>
      {preview && preview.days.length > 0 && (
        <Card sx={{ p: 2.5 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Calendar preview</Typography>
          <RangePreview days={preview.days} color={type?.color} />
        </Card>
      )}
      {preview?.errors.map((e) => <Alert key={e} severity="error">{e}</Alert>)}
      {preview?.warnings.map((w) => <Alert key={w} severity="warning">{w}</Alert>)}
    </Stack>
  );

  return (
    <FormProvider {...methods}>
      <PageHeader
        icon={<CalendarPlus size={22} />}
        title={editId ? `Edit leave ${editId}` : 'Apply for leave'}
        subtitle={editId && existing?.managerComment ? `Manager feedback: “${existing.managerComment}”` : 'Plan your time off and hand over your work in one go.'}
      />
      {submitError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setSubmitError(null)}>
          {submitError.map((e) => <div key={e}>{e}</div>)}
        </Alert>
      )}
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Card>
            <Box sx={{ px: { xs: 2, sm: 3 }, pt: 3, pb: 1 }}>
              <Stepper activeStep={step} alternativeLabel={!isCompact} orientation="horizontal" sx={{ '& .MuiStepLabel-label': { display: { xs: 'none', sm: 'block' } } }}>
                {steps.map((s) => (
                  <Step key={s}>
                    <StepLabel>{s}</StepLabel>
                  </Step>
                ))}
              </Stepper>
              <Typography variant="h6" sx={{ mt: 2, display: { sm: 'none' } }}>
                Step {step + 1} of {steps.length}: {steps[step]}
              </Typography>
            </Box>
            {isCompact && step === 0 && preview && (
              <Box sx={{ px: 2, pt: 2 }}>
                <Alert severity={preview.errors.length ? 'error' : 'info'} icon={false}>
                  <b>{fmtDays(preview.totalDays)}</b> {balance && type?.trackBalance ? `· ${balance.available} available` : ''}
                  {preview.errors.map((e) => <div key={e}>{e}</div>)}
                </Alert>
              </Box>
            )}
            <Box component="form" onSubmit={(e) => { e.preventDefault(); if (isLast) void onSubmit(); else void next(); }} noValidate sx={{ p: { xs: 2, sm: 3 } }}>
              {/* Enter-only step transition so a step is never blocked behind an exit animation. */}
              <motion.div key={stepIndex} initial={{ opacity: 0.3, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.18 }}>
                  {stepIndex === 0 && <LeaveDetailsStep leaveTypes={leaveTypes ?? []} balances={balances ?? []} minDate={minDate} />}
                  {stepIndex === 1 && (
                    <HandoverStep
                      candidates={candidates}
                      loadingCandidates={candidatesLoading}
                      required={requireHandover}
                      include={handoverOn}
                      onIncludeChange={setIncludeHandover}
                      onDatesTouched={() => (datesTouched.current = true)}
                    />
                  )}
                  {stepIndex === 2 && <TasksStep candidates={candidates} />}
                  {stepIndex === 3 && <ReviewStep leaveType={type} preview={preview} candidates={candidates} includeHandover={handoverOn} />}
              </motion.div>

              <Paper
                elevation={0}
                sx={{
                  mt: 3,
                  pt: 2,
                  borderTop: 1,
                  borderColor: 'divider',
                  borderRadius: 0,
                  bgcolor: 'transparent',
                  position: { xs: 'sticky', md: 'static' },
                  bottom: { xs: 64, md: 'auto' },
                  zIndex: 2,
                  backdropFilter: { xs: 'blur(8px)', md: 'none' },
                }}
              >
                <Stack direction="row" justifyContent="space-between" spacing={1}>
                  <Button color="inherit" startIcon={<ArrowLeft size={16} />} onClick={step === 0 ? () => navigate(-1) : back} disabled={submitting}>
                    {step === 0 ? 'Cancel' : 'Back'}
                  </Button>
                  {isLast ? (
                    <LoadingButton type="submit" variant="contained" loading={submitting} startIcon={<Send size={16} />} disabled={Boolean(preview?.errors.length)}>
                      {editId ? 'Resubmit request' : 'Submit request'}
                    </LoadingButton>
                  ) : (
                    <Button type="submit" variant="contained" endIcon={<ArrowRight size={16} />}>
                      Continue
                    </Button>
                  )}
                </Stack>
              </Paper>
            </Box>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }} sx={{ display: { xs: step === 0 ? 'block' : 'none', lg: 'block' } }}>
          {summary}
        </Grid>
      </Grid>
    </FormProvider>
  );
}
