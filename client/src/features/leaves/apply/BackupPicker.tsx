import { Autocomplete, Box, Chip, Stack, TextField, Typography, alpha } from '@mui/material';
import { AlertTriangle, Briefcase, ListChecks } from 'lucide-react';
import type { BackupCandidate } from '@leaveflow/shared';
import { EmployeeAvatar } from '@/components/common';
import { palette } from '@/theme/tokens';

const AVAILABILITY = {
  AVAILABLE: { label: 'Available', color: palette.approved },
  PARTIALLY_AVAILABLE: { label: 'Partially available', color: palette.pending },
  ON_LEAVE: { label: 'On leave', color: palette.rejected },
} as const;

interface Props {
  candidates: BackupCandidate[] | undefined;
  loading: boolean;
  value: string;
  onChange: (id: string) => void;
  error?: string;
  disabled?: boolean;
}

/** Searchable backup-employee picker showing availability and current workload. */
export function BackupPicker({ candidates, loading, value, onChange, error, disabled }: Props) {
  const selected = candidates?.find((c) => c.employeeId === value) ?? null;
  return (
    <Box>
      <Autocomplete
        options={candidates ?? []}
        loading={loading}
        disabled={disabled}
        value={selected}
        onChange={(_, v) => onChange(v?.employeeId ?? '')}
        getOptionLabel={(o) => o.employeeName}
        isOptionEqualToValue={(a, b) => a.employeeId === b.employeeId}
        groupBy={(o) => o.department}
        getOptionDisabled={(o) => o.availability === 'ON_LEAVE'}
        filterOptions={(opts, state) => {
          const q = state.inputValue.toLowerCase();
          return opts.filter((o) => [o.employeeName, o.designation, o.department].some((s) => s.toLowerCase().includes(q)));
        }}
        renderOption={(props, o) => {
          const { key, ...rest } = props as typeof props & { key: string };
          const a = AVAILABILITY[o.availability];
          return (
            <Box component="li" key={key} {...rest} sx={{ display: 'flex', gap: 1.5, alignItems: 'center', py: 1 }}>
              <EmployeeAvatar name={o.employeeName} image={o.profileImage} size={36} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" fontWeight={600} noWrap>{o.employeeName}</Typography>
                <Typography variant="caption" color="text.secondary" noWrap component="div">{o.designation}</Typography>
                <Stack direction="row" spacing={1.5} sx={{ mt: 0.25 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}><Briefcase size={12} /> {o.openHandovers} handover(s)</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}><ListChecks size={12} /> {o.openTasks} open task(s)</Typography>
                </Stack>
              </Box>
              <Stack alignItems="flex-end" spacing={0.5}>
                <Chip size="small" label={a.label} sx={{ bgcolor: alpha(a.color, 0.12), color: a.color, height: 22, fontSize: 11 }} />
                {o.isOverloaded && <Chip size="small" icon={<AlertTriangle size={12} />} label="Busy" color="warning" variant="outlined" sx={{ height: 20, fontSize: 10 }} />}
              </Stack>
            </Box>
          );
        }}
        renderInput={(params) => (
          <TextField {...params} label="Backup employee *" placeholder="Search by name, role or department" error={Boolean(error)} helperText={error ?? 'Who will manage your work while you are away?'} />
        )}
        noOptionsText="No matching colleagues"
      />
      {selected && (
        <Box sx={{ mt: 1.5, p: 1.5, borderRadius: 1, border: 1, borderColor: selected.availability === 'AVAILABLE' && !selected.isOverloaded ? 'divider' : 'warning.light', bgcolor: selected.availability === 'AVAILABLE' && !selected.isOverloaded ? 'transparent' : alpha(palette.pending, 0.06) }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <EmployeeAvatar name={selected.employeeName} size={40} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle2">{selected.employeeName}</Typography>
              <Typography variant="caption" color="text.secondary">{selected.designation} · {selected.department}</Typography>
            </Box>
            <Chip size="small" label={AVAILABILITY[selected.availability].label} sx={{ bgcolor: alpha(AVAILABILITY[selected.availability].color, 0.12), color: AVAILABILITY[selected.availability].color }} />
          </Stack>
          <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 1 }}>
            {selected.availabilityNote}. Currently covering {selected.openHandovers} handover(s) with {selected.openTasks} open task(s)
            {selected.overlappingHandovers > 0 && `; ${selected.overlappingHandovers} overlap your leave`}.
          </Typography>
          {selected.isOverloaded && (
            <Typography variant="caption" color="warning.main" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
              <AlertTriangle size={13} /> This colleague may be overloaded during your leave.
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
}
