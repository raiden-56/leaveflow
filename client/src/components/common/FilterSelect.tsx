import { MenuItem, TextField } from '@mui/material';

interface Option {
  value: string;
  label: string;
}

/** Compact select for table/filter bars. Empty string means "all". */
export function FilterSelect({ label, value, onChange, options, allLabel = 'All', minWidth = 150 }: { label: string; value: string; onChange: (v: string) => void; options: Option[]; allLabel?: string; minWidth?: number }) {
  return (
    <TextField select label={label} value={value} onChange={(e) => onChange(e.target.value)} sx={{ minWidth }}>
      <MenuItem value="">{allLabel}</MenuItem>
      {options.map((o) => (
        <MenuItem key={o.value} value={o.value}>
          {o.label}
        </MenuItem>
      ))}
    </TextField>
  );
}

/** Builds select options from a label map, e.g. LEAVE_STATUS_LABELS. */
export const optionsFrom = (labels: Record<string, string>): Option[] => Object.entries(labels).map(([value, label]) => ({ value, label }));
