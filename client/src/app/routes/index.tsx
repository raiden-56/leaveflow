import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, createHashRouter, Navigate, Outlet, useLocation } from 'react-router-dom';
import { isBrowserDemo } from '@/services/api/httpClient';
import { Box, CircularProgress } from '@mui/material';
import type { Role } from '@leaveflow/shared';
import { useAppSelector } from '@/app/store';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageSkeleton } from '@/components/common';
import { ForbiddenPage, NotFoundPage } from './ErrorPages';

const LoginPage = lazy(() => import('@/features/auth/LoginPage'));
const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage'));
const ApplyLeavePage = lazy(() => import('@/features/leaves/ApplyLeavePage'));
const MyLeavesPage = lazy(() => import('@/features/leaves/MyLeavesPage'));
const LeaveManagementPage = lazy(() => import('@/features/leaves/LeaveManagementPage'));
const ApprovalsPage = lazy(() => import('@/features/approvals/ApprovalsPage'));
const HandoversPage = lazy(() => import('@/features/handovers/HandoversPage'));
const TasksPage = lazy(() => import('@/features/handover-tasks/TasksPage'));
const CalendarPage = lazy(() => import('@/features/calendar/CalendarPage'));
const TeamAvailabilityPage = lazy(() => import('@/features/team/TeamAvailabilityPage'));
const NotificationsPage = lazy(() => import('@/features/notifications/NotificationsPage'));
const ReportsPage = lazy(() => import('@/features/reports/ReportsPage'));
const EmployeesPage = lazy(() => import('@/features/employees/EmployeesPage'));
const LeavePoliciesPage = lazy(() => import('@/features/settings/LeavePoliciesPage'));
const HolidaysPage = lazy(() => import('@/features/holidays/HolidaysPage'));
const OrgSettingsPage = lazy(() => import('@/features/settings/OrgSettingsPage'));
const ProfileSettingsPage = lazy(() => import('@/features/settings/ProfileSettingsPage'));

function FullScreenLoader() {
  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
      <CircularProgress />
    </Box>
  );
}

/** Redirects anonymous users to /login, remembering where they wanted to go. */
function RequireAuth({ children }: { children: ReactNode }) {
  const status = useAppSelector((s) => s.auth.status);
  const location = useLocation();
  if (status === 'idle' || status === 'checking') return <FullScreenLoader />;
  if (status !== 'authenticated') return <Navigate to="/login" replace state={{ from: location }} />;
  return <>{children}</>;
}

/** Role-based route guard (the API enforces the same rules server-side). */
function RequireRole({ roles }: { roles: Role[] }) {
  const role = useAppSelector((s) => s.auth.user?.role);
  if (!role || !roles.includes(role)) return <ForbiddenPage />;
  return <Outlet />;
}

const page = (el: ReactNode) => <Suspense fallback={<PageSkeleton />}>{el}</Suspense>;

// Hash routing for the static GitHub Pages build (no server-side SPA fallback there).
const createRouter = isBrowserDemo ? createHashRouter : createBrowserRouter;

export const router = createRouter([
  { path: '/login', element: <Suspense fallback={<FullScreenLoader />}><LoginPage /></Suspense> },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: page(<DashboardPage />) },
      { path: 'apply-leave', element: page(<ApplyLeavePage />) },
      { path: 'my-leaves', element: page(<MyLeavesPage />) },
      { path: 'handovers', element: page(<HandoversPage />) },
      { path: 'tasks', element: page(<TasksPage />) },
      { path: 'calendar', element: page(<CalendarPage />) },
      { path: 'team', element: page(<TeamAvailabilityPage />) },
      { path: 'notifications', element: page(<NotificationsPage />) },
      { path: 'settings', element: page(<ProfileSettingsPage />) },
      {
        element: <RequireRole roles={['MANAGER', 'ADMIN']} />,
        children: [
          { path: 'approvals', element: page(<ApprovalsPage />) },
          { path: 'reports', element: page(<ReportsPage />) },
        ],
      },
      {
        path: 'admin',
        element: <RequireRole roles={['ADMIN']} />,
        children: [
          { index: true, element: <Navigate to="/admin/employees" replace /> },
          { path: 'employees', element: page(<EmployeesPage />) },
          { path: 'leaves', element: page(<LeaveManagementPage />) },
          { path: 'policies', element: page(<LeavePoliciesPage />) },
          { path: 'holidays', element: page(<HolidaysPage />) },
          { path: 'settings', element: page(<OrgSettingsPage />) },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
