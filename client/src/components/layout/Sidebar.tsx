import { NavLink, useLocation } from 'react-router-dom';
import { Badge, Box, Divider, IconButton, List, ListItemButton, ListItemIcon, ListItemText, Stack, Tooltip, Typography, alpha } from '@mui/material';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronsLeft, ChevronsRight, Waves } from 'lucide-react';
import { ROLE_LABELS } from '@leaveflow/shared';
import { useAuth } from '@/hooks';
import { palette } from '@/theme/tokens';
import { NAVIGATION, type NavItem } from './navConfig';
import { useNavBadges } from './useNavBadges';

export const SIDEBAR_WIDTH = 264;
export const SIDEBAR_COLLAPSED = 76;

export function Logo({ collapsed }: { collapsed?: boolean }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1.25} sx={{ minWidth: 0 }}>
      <Box sx={{ width: 36, height: 36, borderRadius: 1, display: 'grid', placeItems: 'center', background: `linear-gradient(135deg, ${palette.indigo}, ${palette.teal})`, color: '#fff', flexShrink: 0 }}>
        <Waves size={20} />
      </Box>
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -6 }} transition={{ duration: 0.15 }}>
            <Typography variant="h6" sx={{ color: '#fff', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1 }}>
              LeaveFlow
            </Typography>
            <Typography variant="caption" sx={{ color: alpha('#fff', 0.6) }}>
              Leave & Handover
            </Typography>
          </motion.div>
        )}
      </AnimatePresence>
    </Stack>
  );
}

function NavEntry({ item, collapsed, count, onNavigate }: { item: NavItem; collapsed: boolean; count: number; onNavigate?: () => void }) {
  const location = useLocation();
  const active = location.pathname === item.path || (item.path !== '/dashboard' && location.pathname.startsWith(item.path + '/'));
  const Icon = item.icon;
  const button = (
    <ListItemButton
      component={NavLink}
      to={item.path}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      sx={{
        borderRadius: 1,
        mb: 0.5,
        px: collapsed ? 1.5 : 1.75,
        py: 1,
        minHeight: 44,
        justifyContent: collapsed ? 'center' : 'flex-start',
        color: active ? '#fff' : alpha('#fff', 0.72),
        bgcolor: active ? alpha(palette.indigo, 0.9) : 'transparent',
        boxShadow: active ? `0 6px 16px ${alpha(palette.indigo, 0.35)}` : 'none',
        '&:hover': { bgcolor: active ? palette.indigo : alpha('#fff', 0.08), color: '#fff' },
        transition: 'all 160ms ease',
      }}
    >
      <ListItemIcon sx={{ minWidth: collapsed ? 0 : 36, color: 'inherit' }}>
        <Badge color="error" badgeContent={count} max={99} invisible={!count || !collapsed} variant="dot">
          <Icon size={19} />
        </Badge>
      </ListItemIcon>
      {!collapsed && (
        <>
          <ListItemText primary={item.label} slotProps={{ primary: { fontSize: 14, fontWeight: active ? 600 : 500, noWrap: true } }} />
          {count > 0 && (
            <Box sx={{ ml: 1, px: 0.9, minWidth: 22, height: 20, borderRadius: 1, bgcolor: active ? alpha('#fff', 0.25) : palette.pending, color: '#fff', fontSize: 11, fontWeight: 700, display: 'grid', placeItems: 'center' }}>
              {count > 99 ? '99+' : count}
            </Box>
          )}
        </>
      )}
    </ListItemButton>
  );
  return collapsed ? (
    <Tooltip title={item.label} placement="right" arrow>
      {button}
    </Tooltip>
  ) : (
    button
  );
}

export function SidebarContent({ collapsed = false, onToggle, onNavigate }: { collapsed?: boolean; onToggle?: () => void; onNavigate?: () => void }) {
  const { user } = useAuth();
  const badges = useNavBadges();
  if (!user) return null;
  const sections = NAVIGATION[user.role];
  return (
    <Stack sx={{ height: '100%', bgcolor: palette.navy, color: '#fff' }}>
      <Stack direction="row" alignItems="center" justifyContent={collapsed ? 'center' : 'space-between'} sx={{ px: collapsed ? 1 : 2.25, py: 2.25, minHeight: 72 }}>
        <Logo collapsed={collapsed} />
        {onToggle && !collapsed && (
          <IconButton onClick={onToggle} size="small" aria-label="Collapse sidebar" sx={{ color: alpha('#fff', 0.7) }}>
            <ChevronsLeft size={18} />
          </IconButton>
        )}
      </Stack>
      <Box component="nav" aria-label="Main navigation" sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', px: collapsed ? 1.25 : 1.75 }}>
        {sections.map((section, i) => (
          <Box key={i} sx={{ mb: 1 }}>
            {section.title &&
              (collapsed ? (
                <Divider sx={{ borderColor: alpha('#fff', 0.12), my: 1.5 }} />
              ) : (
                <Typography variant="overline" sx={{ display: 'block', px: 1.5, pt: 1.5, pb: 0.5, color: alpha('#fff', 0.45), fontSize: 11 }}>
                  {section.title}
                </Typography>
              ))}
            <List disablePadding>
              {section.items.map((item) => (
                <NavEntry key={item.path} item={item} collapsed={collapsed} count={item.badge ? badges[item.badge] : 0} onNavigate={onNavigate} />
              ))}
            </List>
          </Box>
        ))}
      </Box>
      <Box sx={{ p: collapsed ? 1.25 : 2 }}>
        {collapsed ? (
          onToggle && (
            <Tooltip title="Expand sidebar" placement="right">
              <IconButton onClick={onToggle} aria-label="Expand sidebar" sx={{ color: alpha('#fff', 0.7), width: '100%' }}>
                <ChevronsRight size={18} />
              </IconButton>
            </Tooltip>
          )
        ) : (
          <Box sx={{ p: 1.75, borderRadius: 1, bgcolor: alpha('#fff', 0.06), border: `1px solid ${alpha('#fff', 0.08)}` }}>
            <Typography variant="caption" sx={{ color: alpha('#fff', 0.55) }}>
              Signed in as
            </Typography>
            <Typography variant="body2" fontWeight={600} noWrap>
              {ROLE_LABELS[user.role]} · {user.department}
            </Typography>
          </Box>
        )}
      </Box>
    </Stack>
  );
}
