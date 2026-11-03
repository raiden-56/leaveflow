import { useEffect } from 'react';
import { Alert, AlertTitle, Box } from '@mui/material';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppDispatch, useAppSelector } from '@/app/store';
import { dismissToast, type Toast } from '@/app/store/uiSlice';

function ToastItem({ toast }: { toast: Toast }) {
  const dispatch = useAppDispatch();
  useEffect(() => {
    const t = setTimeout(() => dispatch(dismissToast(toast.id)), toast.severity === 'error' ? 6500 : 4000);
    return () => clearTimeout(t);
  }, [dispatch, toast]);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 40, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 40, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
    >
      <Alert
        severity={toast.severity}
        variant="filled"
        onClose={() => dispatch(dismissToast(toast.id))}
        sx={{ boxShadow: '0 12px 32px rgba(15,23,42,0.18)', minWidth: 280, maxWidth: 420 }}
      >
        {toast.title && <AlertTitle>{toast.title}</AlertTitle>}
        {toast.message}
      </Alert>
    </motion.div>
  );
}

/** Animated toast stack (top-right on desktop, top on mobile). */
export function Toaster() {
  const toasts = useAppSelector((s) => s.ui.toasts);
  return (
    <Box
      role="status"
      aria-live="polite"
      sx={{ position: 'fixed', top: { xs: 12, sm: 20 }, right: { xs: 12, sm: 20 }, left: { xs: 12, sm: 'auto' }, zIndex: 2000, display: 'flex', flexDirection: 'column', gap: 1, pointerEvents: 'none', '& > *': { pointerEvents: 'auto' } }}
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} />
        ))}
      </AnimatePresence>
    </Box>
  );
}
