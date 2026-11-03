import { Button, CircularProgress, type ButtonProps } from '@mui/material';
import { motion } from 'framer-motion';

/** Button with a spinner while an async action is running and a subtle press animation. */
export function LoadingButton({ loading, disabled, children, startIcon, ...rest }: ButtonProps & { loading?: boolean }) {
  return (
    <motion.span whileTap={{ scale: disabled || loading ? 1 : 0.97 }} style={{ display: 'inline-flex' }}>
      <Button
        disabled={disabled || loading}
        startIcon={loading ? <CircularProgress size={16} color="inherit" /> : startIcon}
        {...rest}
      >
        {children}
      </Button>
    </motion.span>
  );
}
