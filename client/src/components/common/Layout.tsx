import type { ReactNode } from 'react';
import { Box, Card, CardContent, Stack, Typography, type SxProps, type Theme } from '@mui/material';
import { motion, type HTMLMotionProps } from 'framer-motion';

/** Page transition wrapper (respects prefers-reduced-motion via MotionConfig in App). */
export function MotionPage({ children, ...rest }: HTMLMotionProps<'div'>) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export function PageHeader({ title, subtitle, actions, icon }: { title: string; subtitle?: ReactNode; actions?: ReactNode; icon?: ReactNode }) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      justifyContent="space-between"
      alignItems={{ xs: 'flex-start', sm: 'center' }}
      spacing={2}
      sx={{ mb: 3 }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
        {icon && (
          <Box sx={{ width: 42, height: 42, borderRadius: 1, display: 'grid', placeItems: 'center', bgcolor: 'primary.light', color: 'primary.main', flexShrink: 0 }}>
            {icon}
          </Box>
        )}
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h4" component="h1">
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
      </Stack>
      {actions && (
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ width: { xs: '100%', sm: 'auto' } }}>
          {actions}
        </Stack>
      )}
    </Stack>
  );
}

interface SectionCardProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  sx?: SxProps<Theme>;
  contentSx?: SxProps<Theme>;
  noPadding?: boolean;
}

export function SectionCard({ title, subtitle, action, children, sx, contentSx, noPadding }: SectionCardProps) {
  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', ...sx }}>
      {(title || action) && (
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ px: 2.5, pt: 2.25, pb: noPadding ? 1.5 : 0 }}>
          <Box sx={{ minWidth: 0 }}>
            {typeof title === 'string' ? <Typography variant="h6">{title}</Typography> : title}
            {subtitle && (
              <Typography variant="caption" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>
          {action}
        </Stack>
      )}
      <CardContent sx={{ flex: 1, p: noPadding ? 0 : 2.5, '&:last-child': { pb: noPadding ? 0 : 2.5 }, ...contentSx }}>{children}</CardContent>
    </Card>
  );
}
