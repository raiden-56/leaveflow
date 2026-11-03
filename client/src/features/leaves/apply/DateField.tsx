import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs, { type Dayjs } from 'dayjs';

interface DateFieldProps {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  onBlur?: () => void;
  error?: string;
  helperText?: string;
  minDate?: string;
  maxDate?: string;
  disabled?: boolean;
  shouldDisableDate?: (d: Dayjs) => boolean;
}

/** MUI X DatePicker bound to an ISO (YYYY-MM-DD) string. Uses a touch-friendly dialog on mobile automatically. */
export function DateField({ label, value, onChange, onBlur, error, helperText, minDate, maxDate, disabled, shouldDisableDate }: DateFieldProps) {
  return (
    <DatePicker
      label={label}
      value={value ? dayjs(value) : null}
      onChange={(v) => onChange(v && v.isValid() ? v.format('YYYY-MM-DD') : '')}
      onClose={onBlur}
      minDate={minDate ? dayjs(minDate) : undefined}
      maxDate={maxDate ? dayjs(maxDate) : undefined}
      disabled={disabled}
      shouldDisableDate={shouldDisableDate}
      format="DD MMM YYYY"
      slotProps={{ textField: { fullWidth: true, size: 'small', error: Boolean(error), helperText: error ?? helperText, onBlur } }}
    />
  );
}
