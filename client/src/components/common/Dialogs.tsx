import { useEffect, useState, type ReactNode } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  IconButton,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { LoadingButton } from './LoadingButton';
import { X } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  confirmColor?: 'primary' | 'error' | 'success' | 'warning';
  /** Show a comment box. When `commentRequired`, at least 5 characters are needed. */
  commentLabel?: string;
  commentRequired?: boolean;
  loading?: boolean;
  onClose: () => void;
  onConfirm: (comment: string) => void | Promise<void>;
  children?: ReactNode;
}

/** Confirmation dialog for irreversible/important actions (approve, reject, cancel, delete…). */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  confirmColor = 'primary',
  commentLabel,
  commentRequired,
  loading,
  onClose,
  onConfirm,
  children,
}: ConfirmDialogProps) {
  const [comment, setComment] = useState('');
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (open) {
      setComment('');
      setTouched(false);
    }
  }, [open]);
  const invalid = Boolean(commentRequired) && comment.trim().length < 5;

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} fullWidth maxWidth="xs" aria-labelledby="confirm-title">
      <DialogTitle id="confirm-title" sx={{ pb: 1 }}>{title}</DialogTitle>
      <DialogContent>
        {description && <Typography variant="body2" color="text.secondary">{description}</Typography>}
        {children}
        {commentLabel && (
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={3}
            label={commentLabel}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onBlur={() => setTouched(true)}
            error={touched && invalid}
            helperText={touched && invalid ? 'Please enter at least 5 characters' : commentRequired ? 'Required' : 'Optional'}
            sx={{ mt: 2 }}
            slotProps={{ htmlInput: { maxLength: 1000 } }}
          />
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={loading} color="inherit">Cancel</Button>
        <LoadingButton
          variant="contained"
          color={confirmColor}
          loading={loading}
          onClick={() => {
            setTouched(true);
            if (!invalid) void onConfirm(comment.trim());
          }}
        >
          {confirmLabel}
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}

interface DetailPanelProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  width?: number;
}

/** Right-side drawer on desktop, full-screen dialog on mobile. */
export function DetailPanel({ open, onClose, title, subtitle, actions, children, width = 560 }: DetailPanelProps) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const header = (
    <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2} sx={{ px: 3, py: 2.25, borderBottom: 1, borderColor: 'divider' }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="h6" component="div">{title}</Typography>
        {subtitle && <Typography variant="body2" color="text.secondary" component="div">{subtitle}</Typography>}
      </Box>
      <IconButton onClick={onClose} aria-label="Close" size="small"><X size={18} /></IconButton>
    </Stack>
  );
  const footer = actions && (
    <Stack direction="row" spacing={1} justifyContent="flex-end" flexWrap="wrap" useFlexGap sx={{ px: 3, py: 2, borderTop: 1, borderColor: 'divider', bgcolor: 'background.default' }}>
      {actions}
    </Stack>
  );

  if (fullScreen) {
    return (
      <Dialog open={open} onClose={onClose} fullScreen>
        {header}
        <Box sx={{ flex: 1, overflowY: 'auto', p: 2.5 }}>{children}</Box>
        {footer}
      </Dialog>
    );
  }
  return (
    <Drawer anchor="right" open={open} onClose={onClose} slotProps={{ paper: { sx: { width: { xs: '100%', sm: width }, maxWidth: '100vw' } } }}>
      <Stack sx={{ height: '100%' }}>
        {header}
        <Box sx={{ flex: 1, overflowY: 'auto', p: 3 }}>{children}</Box>
        {footer}
      </Stack>
    </Drawer>
  );
}
