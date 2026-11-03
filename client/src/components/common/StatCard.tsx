import type { ReactNode } from 'react';
import { Box, Card, LinearProgress, Stack, Typography, alpha } from '@mui/material';
import { motion } from 'framer-motion';

interface StatCardProps {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  color?: string;
  caption?: ReactNode;
  /** 0-100; renders an animated progress bar */
  progress?: number;
  footer?: ReactNode;
  onClick?: () => void;
  index?: number;
}

/** Dashboard KPI card with icon, value, optional progress and hover lift. */
export function StatCard({ label, value, icon, color = '#4F46E5', caption, progress, footer, onClick, index = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      whileHover={{ y: -3 }}
      style={{ height: '100%' }}
    >
      <Card
        onClick={onClick}
        sx={{
          p: 2.25,
          height: '100%',
          cursor: onClick ? 'pointer' : 'default',
          transition: 'box-shadow 200ms ease, border-color 200ms ease',
          '&:hover': { boxShadow: `0 10px 30px ${alpha(color, 0.12)}`, borderColor: alpha(color, 0.35) },
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" color="text.secondary" fontWeight={500} noWrap>
              {label}
            </Typography>
            <Typography variant="h4" sx={{ mt: 0.75, lineHeight: 1.1 }}>
              {value}
            </Typography>
            {caption && (
              <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.5 }}>
                {caption}
              </Typography>
            )}
          </Box>
          <Box sx={{ width: 42, height: 42, borderRadius: 1, display: 'grid', placeItems: 'center', bgcolor: alpha(color, 0.12), color, flexShrink: 0 }}>{icon}</Box>
        </Stack>
        {progress !== undefined && (
          <LinearProgress
            variant="determinate"
            value={Math.max(0, Math.min(100, progress))}
            sx={{ mt: 1.75, height: 6, bgcolor: alpha(color, 0.12), '& .MuiLinearProgress-bar': { bgcolor: color, transition: 'transform 900ms ease' } }}
          />
        )}
        {footer && <Box sx={{ mt: 1.25 }}>{footer}</Box>}
      </Card>
    </motion.div>
  );
}
