import { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  AppBar,
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Divider,
  Drawer,
  Fab,
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
  Badge,
} from '@mui/material';
import { motion } from 'framer-motion';
import { CalendarPlus, LogOut, Menu as MenuIcon, Moon, Settings, Sun, UserRound } from 'lucide-react';
import { ROLE_LABELS } from '@leaveflow/shared';
import { useAppDispatch, useAppSelector } from '@/app/store';
import { logout } from '@/app/store/authSlice';
import { setMobileNav, toggleSidebar, toggleTheme } from '@/app/store/uiSlice';
import { useAuth, useResponsive } from '@/hooks';
import { EmployeeAvatar } from '../common/EmployeeAvatar';
import { MOBILE_NAV } from './navConfig';
import { NotificationMenu } from './NotificationMenu';
import { SIDEBAR_COLLAPSED, SIDEBAR_WIDTH, SidebarContent } from './Sidebar';
import { useNavBadges } from './useNavBadges';
import { fmtDate } from '@/utils/format';
import { useToday } from '@/hooks';

function UserMenu() {
  const { user } = useAuth();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  if (!user) return null;
  return (
    <>
      <Box component="button" onClick={(e: React.MouseEvent<HTMLElement>) => setAnchor(e.currentTarget)} aria-label="Account menu" sx={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1.25, pl: 1, pr: { xs: 0, md: 1 }, py: 0.5, borderRadius: 1, '&:hover': { bgcolor: 'action.hover' }, '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main' } }}>
        <EmployeeAvatar name={user.employeeName} image={user.profileImage} size={36} />
        <Box sx={{ display: { xs: 'none', md: 'block' }, textAlign: 'left' }}>
          <Typography variant="body2" fontWeight={600} lineHeight={1.2}>{user.employeeName}</Typography>
          <Typography variant="caption" color="text.secondary">{ROLE_LABELS[user.role]}</Typography>
        </Box>
      </Box>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }} slotProps={{ paper: { sx: { mt: 1, minWidth: 220, borderRadius: 1 } } }}>
        <Box sx={{ px: 2, py: 1.25 }}>
          <Typography variant="subtitle2">{user.employeeName}</Typography>
          <Typography variant="caption" color="text.secondary">{user.email}</Typography>
        </Box>
        <Divider />
        <MenuItem onClick={() => { setAnchor(null); navigate('/settings'); }}>
          <ListItemIcon><UserRound size={17} /></ListItemIcon>My profile
        </MenuItem>
        {user.role === 'ADMIN' && (
          <MenuItem onClick={() => { setAnchor(null); navigate('/admin/settings'); }}>
            <ListItemIcon><Settings size={17} /></ListItemIcon>Organisation settings
          </MenuItem>
        )}
        <Divider />
        <MenuItem onClick={() => { setAnchor(null); void dispatch(logout()).then(() => navigate('/login')); }} sx={{ color: 'error.main' }}>
          <ListItemIcon sx={{ color: 'inherit' }}><LogOut size={17} /></ListItemIcon>Sign out
        </MenuItem>
      </Menu>
    </>
  );
}

/** Authenticated shell: collapsible sidebar (desktop), drawer + bottom nav (mobile), top bar. */
export function AppLayout() {
  const dispatch = useAppDispatch();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const today = useToday();
  const { isMobile, isDesktop } = useResponsive();
  const collapsed = useAppSelector((s) => s.ui.sidebarCollapsed);
  const mobileOpen = useAppSelector((s) => s.ui.mobileNavOpen);
  const themeMode = useAppSelector((s) => s.ui.themeMode);
  const badges = useNavBadges();
  const width = isDesktop ? (collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_WIDTH) : 0;
  if (!user) return null;
  const mobileItems = MOBILE_NAV[user.role];
  const mobileValue = mobileItems.findIndex((i) => location.pathname.startsWith(i.path));
  const showFab = isMobile && !location.pathname.startsWith('/apply-leave');

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      {isDesktop ? (
        // Layout widths use CSS transitions (not JS springs) so the layout is always correct,
        // even when animation frames are throttled; reduced-motion is handled in CssBaseline.
        <Box
          component="aside"
          sx={{ position: 'fixed', top: 0, bottom: 0, left: 0, zIndex: 1200, overflow: 'hidden', width, transition: 'width 220ms cubic-bezier(0.4, 0, 0.2, 1)' }}
        >
          <SidebarContent collapsed={collapsed} onToggle={() => dispatch(toggleSidebar())} />
        </Box>
      ) : (
        <Drawer open={mobileOpen} onClose={() => dispatch(setMobileNav(false))} slotProps={{ paper: { sx: { width: SIDEBAR_WIDTH, border: 0 } } }}>
          <SidebarContent onNavigate={() => dispatch(setMobileNav(false))} />
        </Drawer>
      )}

      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', ml: `${width}px`, transition: 'margin-left 220ms cubic-bezier(0.4, 0, 0.2, 1)' }}>
        <AppBar position="sticky" color="inherit" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: (t) => (t.palette.mode === 'dark' ? 'rgba(17,24,39,0.85)' : 'rgba(255,255,255,0.85)'), backdropFilter: 'blur(10px)' }}>
          <Toolbar sx={{ gap: 1, minHeight: { xs: 60, md: 68 }, px: { xs: 1.5, md: 3 } }}>
            {!isDesktop && (
              <IconButton onClick={() => dispatch(setMobileNav(true))} aria-label="Open navigation" edge="start">
                <MenuIcon size={22} />
              </IconButton>
            )}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" color="text.secondary" noWrap sx={{ display: { xs: 'none', sm: 'block' } }}>
                {fmtDate(today, 'dddd, DD MMMM YYYY')}
              </Typography>
              <Typography variant="subtitle1" noWrap sx={{ display: { xs: 'block', sm: 'none' }, fontWeight: 800 }}>
                LeaveFlow
              </Typography>
            </Box>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Tooltip title={themeMode === 'light' ? 'Dark mode' : 'Light mode'}>
                <IconButton onClick={() => dispatch(toggleTheme())} aria-label="Toggle colour theme">
                  {themeMode === 'light' ? <Moon size={19} /> : <Sun size={19} />}
                </IconButton>
              </Tooltip>
              <NotificationMenu />
              <UserMenu />
            </Stack>
          </Toolbar>
        </AppBar>

        <Box component="main" sx={{ flex: 1, p: { xs: 2, sm: 3, lg: 4 }, pb: { xs: 12, md: 4 }, maxWidth: 1600, width: '100%', mx: 'auto' }}>
          {/* Enter-only transition: navigation never waits on an exit animation. */}
          <motion.div key={location.pathname} initial={{ opacity: 0.4, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: 'easeOut' }}>
            <Outlet />
          </motion.div>
        </Box>
      </Box>

      {showFab && (
        <Fab color="primary" aria-label="Apply leave" onClick={() => navigate('/apply-leave')} sx={{ position: 'fixed', right: 16, bottom: 80, zIndex: 1100 }}>
          <CalendarPlus size={22} />
        </Fab>
      )}
      {isMobile && (
        <Paper elevation={0} sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1100, borderTop: 1, borderColor: 'divider', pb: 'env(safe-area-inset-bottom)' }}>
          <BottomNavigation showLabels value={mobileValue} sx={{ height: 64 }}>
            {mobileItems.map((item) => {
              const Icon = item.icon;
              const count = item.badge ? badges[item.badge] : 0;
              return (
                <BottomNavigationAction
                  key={item.path}
                  label={item.label.replace('Leave ', '').replace('Work ', '')}
                  icon={<Badge color="error" badgeContent={count} max={9}><Icon size={20} /></Badge>}
                  onClick={() => navigate(item.path)}
                  sx={{ minWidth: 0, '& .MuiBottomNavigationAction-label': { fontSize: 11 } }}
                />
              );
            })}
          </BottomNavigation>
        </Paper>
      )}
    </Box>
  );
}
