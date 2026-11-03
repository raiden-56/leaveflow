import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Card, Divider, IconButton, Stack, Tab, Tabs, Tooltip, Typography } from '@mui/material';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, CheckCheck, Trash2 } from 'lucide-react';
import { dayjs, type Notification, type NotificationType } from '@leaveflow/shared';
import { useDeleteNotificationMutation, useMarkAllNotificationsReadMutation, useMarkNotificationReadMutation, useNotificationsQuery } from '@/app/store/api';
import { EmptyState, ErrorState, FilterSelect, PageHeader, TableSkeleton } from '@/components/common';
import { NotificationRow } from '@/components/layout/NotificationMenu';
import { useAction, useAuth, useToday } from '@/hooks';

type Category = 'leave' | 'handover' | 'tasks' | 'balance';

const CATEGORY: Record<NotificationType, Category | 'other'> = {
  LEAVE_SUBMITTED: 'leave',
  LEAVE_APPROVED: 'leave',
  LEAVE_REJECTED: 'leave',
  LEAVE_CHANGES_REQUESTED: 'leave',
  LEAVE_CANCELLED: 'leave',
  LEAVE_STARTS_TOMORROW: 'leave',
  EMPLOYEE_RETURNED: 'handover',
  HANDOVER_ASSIGNED: 'handover',
  HANDOVER_ACCEPTED: 'handover',
  HANDOVER_DECLINED: 'handover',
  HANDOVER_COMPLETED: 'handover',
  TASK_OVERDUE: 'tasks',
  BALANCE_ADJUSTED: 'balance',
  GENERAL: 'other',
};

const CATEGORY_OPTIONS = [
  { value: 'leave', label: 'Leave requests' },
  { value: 'handover', label: 'Work handovers' },
  { value: 'tasks', label: 'Tasks' },
  { value: 'balance', label: 'Leave balance' },
];

function dayLabel(iso: string, today: string): string {
  const d = dayjs(iso).format('YYYY-MM-DD');
  if (d === today) return 'Today';
  if (d === dayjs(today).subtract(1, 'day').format('YYYY-MM-DD')) return 'Yesterday';
  return dayjs(iso).format('dddd, DD MMM YYYY');
}

/** Notification centre: full history grouped by day, with read/unread and category filters. */
export default function NotificationsPage() {
  const navigate = useNavigate();
  const run = useAction();
  const today = useToday();
  const { settings } = useAuth();
  const [tab, setTab] = useState<'all' | 'unread'>('all');
  const [category, setCategory] = useState('');
  const { data, isLoading, error, refetch } = useNotificationsQuery(undefined, { pollingInterval: (settings?.notificationPollSeconds ?? 30) * 1000 });
  const [markRead] = useMarkNotificationReadMutation();
  const [markAll, { isLoading: markingAll }] = useMarkAllNotificationsReadMutation();
  const [remove] = useDeleteNotificationMutation();

  const groups = useMemo(() => {
    const items = (data?.items ?? [])
      .filter((n) => tab === 'all' || !n.isRead)
      .filter((n) => !category || CATEGORY[n.type] === category);
    const map = new Map<string, Notification[]>();
    for (const n of items) {
      const key = dayLabel(n.createdAt, today);
      map.set(key, [...(map.get(key) ?? []), n]);
    }
    return [...map.entries()];
  }, [data, tab, category, today]);

  const open = (n: Notification) => {
    if (!n.isRead) void markRead(n.notificationId);
    if (n.link) navigate(n.link);
  };

  return (
    <Box>
      <PageHeader
        title="Notifications"
        subtitle={data ? `${data.unread} unread of ${data.total}` : 'Leave, handover and task updates'}
        icon={<Bell size={22} />}
        actions={
          <Button variant="outlined" startIcon={<CheckCheck size={16} />} disabled={!data?.unread || markingAll} onClick={() => run(markAll().unwrap(), 'All notifications marked as read')}>
            Mark all as read
          </Button>
        }
      />
      <Card>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} spacing={1.5} sx={{ px: 2, pt: 1, pb: { xs: 1.5, sm: 0 }, borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)}>
            <Tab value="all" label="All" />
            <Tab value="unread" label={`Unread${data?.unread ? ` (${data.unread})` : ''}`} />
          </Tabs>
          <Box sx={{ pb: { sm: 1 } }}>
            <FilterSelect label="Category" value={category} onChange={setCategory} allLabel="All categories" minWidth={190} options={CATEGORY_OPTIONS} />
          </Box>
        </Stack>
        {error ? (
          <Box sx={{ p: 2 }}><ErrorState error={error} onRetry={refetch} /></Box>
        ) : isLoading ? (
          <TableSkeleton rows={6} />
        ) : groups.length === 0 ? (
          <EmptyState title={tab === 'unread' ? "You're all caught up" : 'No notifications'} description="Updates about leave requests, approvals and handovers appear here." icon={<Bell size={24} />} />
        ) : (
          groups.map(([label, items]) => (
            <Box key={label}>
              <Typography variant="overline" color="text.secondary" sx={{ display: 'block', px: 2, pt: 2, pb: 0.5 }}>{label}</Typography>
              <AnimatePresence initial={false}>
                {items.map((n) => (
                  <motion.div key={n.notificationId} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }}>
                    <Stack direction="row" alignItems="center" sx={{ '&:hover .lf-del': { opacity: 1 } }}>
                      <Box sx={{ flex: 1, minWidth: 0 }}><NotificationRow n={n} onOpen={open} /></Box>
                      <Tooltip title="Delete">
                        <IconButton
                          className="lf-del"
                          size="small"
                          aria-label="Delete notification"
                          sx={{ mr: 1.5, opacity: { xs: 1, md: 0.4 }, transition: 'opacity 150ms' }}
                          onClick={() => run(remove(n.notificationId).unwrap(), 'Notification deleted')}
                        >
                          <Trash2 size={16} />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                    <Divider />
                  </motion.div>
                ))}
              </AnimatePresence>
            </Box>
          ))
        )}
      </Card>
    </Box>
  );
}
