import { lazy, Suspense, useState } from 'react';
import { Box, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { Building2, User, Users } from 'lucide-react';
import { PageSkeleton } from '@/components/common';
import { useAuth } from '@/hooks';
import EmployeeDashboard from './EmployeeDashboard';

const ManagerDashboard = lazy(() => import('./ManagerDashboard'));
const AdminDashboard = lazy(() => import('./AdminDashboard'));

/** Role-aware dashboard. Managers and HR can switch to their personal view. */
export default function DashboardPage() {
  const { user } = useAuth();
  const [view, setView] = useState<'org' | 'me'>('org');
  if (!user) return null;
  if (user.role === 'EMPLOYEE') return <EmployeeDashboard />;

  const switcher = (
    <ToggleButtonGroup size="small" exclusive value={view} onChange={(_, v) => v && setView(v)} aria-label="Dashboard view">
      <ToggleButton value="org" sx={{ px: 1.75, gap: 0.75 }}>
        {user.role === 'ADMIN' ? <Building2 size={15} /> : <Users size={15} />}
        {user.role === 'ADMIN' ? 'Organisation' : 'My team'}
      </ToggleButton>
      <ToggleButton value="me" sx={{ px: 1.75, gap: 0.75 }}>
        <User size={15} /> Personal
      </ToggleButton>
    </ToggleButtonGroup>
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>{switcher}</Box>
      <Suspense fallback={<PageSkeleton />}>
        {view === 'me' ? <EmployeeDashboard /> : user.role === 'ADMIN' ? <AdminDashboard /> : <ManagerDashboard />}
      </Suspense>
    </Box>
  );
}
