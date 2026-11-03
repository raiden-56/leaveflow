import type { ReactNode } from 'react';
import { Alert, Box, Button, Card, Skeleton, Stack, Typography } from '@mui/material';
import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react';
import type { ApiError } from '@/services/api/httpClient';

export function EmptyState({ title, description, icon, action, compact }: { title: string; description?: ReactNode; icon?: ReactNode; action?: ReactNode; compact?: boolean }) {
  return (
    <Stack alignItems="center" justifyContent="center" spacing={1.25} sx={{ py: compact ? 3 : 6, px: 2, textAlign: 'center' }}>
      <Box sx={{ width: 52, height: 52, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: 'primary.light', color: 'primary.main' }}>
        {icon ?? <Inbox size={24} />}
      </Box>
      <Typography variant="subtitle1">{title}</Typography>
      {description && (
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 380 }}>
          {description}
        </Typography>
      )}
      {action}
    </Stack>
  );
}

export function ErrorState({ error, onRetry, title = 'Could not load data' }: { error?: unknown; onRetry?: () => void; title?: string }) {
  const message = (error as ApiError | undefined)?.message ?? 'An unexpected error occurred.';
  return (
    <Alert
      severity="error"
      icon={<AlertTriangle size={20} />}
      action={
        onRetry && (
          <Button color="inherit" size="small" startIcon={<RefreshCw size={14} />} onClick={onRetry}>
            Retry
          </Button>
        )
      }
      sx={{ my: 1 }}
    >
      <Typography variant="subtitle2">{title}</Typography>
      <Typography variant="body2">{message}</Typography>
    </Alert>
  );
}

/** Skeleton placeholders shaped like the content they replace. */
export function CardsSkeleton({ count = 4, height = 120 }: { count?: number; height?: number }) {
  return (
    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: `repeat(${Math.min(count, 4)}, 1fr)` } }}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} variant="rounded" height={height} sx={{ borderRadius: 1 }} animation="wave" />
      ))}
    </Box>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <Stack spacing={1} sx={{ p: 2 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} variant="rounded" height={44} animation="wave" />
      ))}
    </Stack>
  );
}

export function PageSkeleton() {
  return (
    <Stack spacing={3}>
      <Skeleton variant="rounded" height={56} width="40%" animation="wave" />
      <CardsSkeleton />
      <Card>
        <TableSkeleton />
      </Card>
    </Stack>
  );
}
