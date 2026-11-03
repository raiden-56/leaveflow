import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Box, Button, Divider, IconButton, Popover, Stack, Tooltip, Typography, alpha } from '@mui/material';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, CheckCheck } from 'lucide-react';
import type { Notification } from '@leaveflow/shared';
import { useMarkAllNotificationsReadMutation, useMarkNotificationReadMutation, useNotificationsQuery } from '@/app/store/api';
import { useAuth } from '@/hooks';
import { fromNow } from '@/utils/format';
import { EmptyState } from '../common/States';
import { notificationVisual } from './notificationVisual';

export function NotificationRow({ n, onOpen }: { n: Notification; onOpen: (n: Notification) => void }) {
  const { icon: Icon, color } = notificationVisual(n.type);
  return (
    <Box
      component="button"
      onClick={() => onOpen(n)}
      sx={{
        all: 'unset',
        boxSizing: 'border-box',
        width: '100%',
        display: 'flex',
        gap: 1.5,
        px: 2,
        py: 1.5,
        cursor: 'pointer',
        bgcolor: n.isRead ? 'transparent' : alpha(color, 0.05),
        '&:hover': { bgcolor: 'action.hover' },
        '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2 },
      }}
    >
      <Box sx={{ width: 34, height: 34, borderRadius: 1, display: 'grid', placeItems: 'center', bgcolor: alpha(color, 0.12), color, flexShrink: 0 }}>
        <Icon size={17} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" justifyContent="space-between" spacing={1}>
          <Typography variant="body2" fontWeight={n.isRead ? 500 : 700} noWrap>
            {n.title}
          </Typography>
          {!n.isRead && <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'primary.main', mt: 0.75, flexShrink: 0 }} />}
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {n.message}
        </Typography>
        <Typography variant="caption" color="text.disabled" component="div" sx={{ mt: 0.25 }}>
          {fromNow(n.createdAt)}
        </Typography>
      </Box>
    </Box>
  );
}

/** Top-bar bell with unread badge and a quick notification popover (polled). */
export function NotificationMenu() {
  const navigate = useNavigate();
  const { settings } = useAuth();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const { data } = useNotificationsQuery(undefined, { pollingInterval: (settings?.notificationPollSeconds ?? 30) * 1000 });
  const [markRead] = useMarkNotificationReadMutation();
  const [markAll, { isLoading: markingAll }] = useMarkAllNotificationsReadMutation();
  const items = data?.items.slice(0, 8) ?? [];

  const open = (n: Notification) => {
    if (!n.isRead) void markRead(n.notificationId);
    setAnchor(null);
    if (n.link) navigate(n.link);
  };

  return (
    <>
      <Tooltip title="Notifications">
        <IconButton onClick={(e) => setAnchor(e.currentTarget)} aria-label={`Notifications, ${data?.unread ?? 0} unread`}>
          <Badge badgeContent={data?.unread ?? 0} color="error" max={99}>
            <Bell size={20} />
          </Badge>
        </IconButton>
      </Tooltip>
      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { width: { xs: 'calc(100vw - 24px)', sm: 400 }, mt: 1, borderRadius: 1, border: 1, borderColor: 'divider', boxShadow: '0 20px 50px rgba(15,23,42,0.15)' } } }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2, py: 1.5 }}>
          <Typography variant="subtitle1">Notifications</Typography>
          <Button size="small" startIcon={<CheckCheck size={15} />} disabled={!data?.unread || markingAll} onClick={() => markAll()}>
            Mark all read
          </Button>
        </Stack>
        <Divider />
        <Box sx={{ maxHeight: 420, overflowY: 'auto' }}>
          {items.length === 0 ? (
            <EmptyState compact title="You're all caught up" description="New leave and handover updates will appear here." icon={<Bell size={22} />} />
          ) : (
            <AnimatePresence initial={false}>
              {items.map((n) => (
                <motion.div key={n.notificationId} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <NotificationRow n={n} onOpen={open} />
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </Box>
        <Divider />
        <Button fullWidth sx={{ py: 1.25, borderRadius: 0 }} onClick={() => { setAnchor(null); navigate('/notifications'); }}>
          View all notifications
        </Button>
      </Popover>
    </>
  );
}
