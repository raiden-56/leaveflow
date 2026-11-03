import {
  BarChart3,
  Bell,
  BookOpenCheck,
  CalendarDays,
  CalendarPlus,
  ClipboardCheck,
  ClipboardList,
  FileClock,
  LayoutDashboard,
  ListTodo,
  PartyPopper,
  Settings,
  ShieldCheck,
  Users,
  UsersRound,
  Repeat2,
  type LucideIcon,
} from 'lucide-react';
import type { Role } from '@leaveflow/shared';

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  /** Shows a live count badge. */
  badge?: 'approvals' | 'handovers' | 'notifications';
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

const dashboard: NavItem = { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard };
const applyLeave: NavItem = { label: 'Apply Leave', path: '/apply-leave', icon: CalendarPlus };
const myLeaves: NavItem = { label: 'My Leaves', path: '/my-leaves', icon: FileClock };
const handovers: NavItem = { label: 'Work Handovers', path: '/handovers', icon: Repeat2, badge: 'handovers' };
const calendar: NavItem = { label: 'Leave Calendar', path: '/calendar', icon: CalendarDays };
const team: NavItem = { label: 'Team Availability', path: '/team', icon: UsersRound };
const notifications: NavItem = { label: 'Notifications', path: '/notifications', icon: Bell, badge: 'notifications' };
const reports: NavItem = { label: 'Reports', path: '/reports', icon: BarChart3 };
const settings: NavItem = { label: 'Settings', path: '/settings', icon: Settings };
const approvals: NavItem = { label: 'Leave Approvals', path: '/approvals', icon: ClipboardCheck, badge: 'approvals' };
const tasks: NavItem = { label: 'Handover Tasks', path: '/tasks', icon: ListTodo };

/** Sidebar menus per role (as specified for Employee / Manager / Admin). */
export const NAVIGATION: Record<Role, NavSection[]> = {
  EMPLOYEE: [{ items: [dashboard, applyLeave, myLeaves, handovers, calendar, team, notifications, settings] }],
  MANAGER: [
    { items: [dashboard, approvals, { ...calendar, label: 'Team Calendar' }, team, handovers, tasks, reports] },
    { title: 'My space', items: [applyLeave, myLeaves, notifications, settings] },
  ],
  ADMIN: [
    {
      items: [
        dashboard,
        { label: 'Employees', path: '/admin/employees', icon: Users },
        { label: 'Leave Management', path: '/admin/leaves', icon: ClipboardList },
        { label: 'Leave Policies', path: '/admin/policies', icon: BookOpenCheck },
        { ...approvals, label: 'Approvals' },
        handovers,
        { label: 'Holidays', path: '/admin/holidays', icon: PartyPopper },
        reports,
        { label: 'Settings', path: '/admin/settings', icon: ShieldCheck },
      ],
    },
    { title: 'Workspace', items: [calendar, team, tasks, applyLeave, myLeaves, notifications] },
  ],
};

/** Up to 4 primary destinations + "More" for the mobile bottom navigation. */
export const MOBILE_NAV: Record<Role, NavItem[]> = {
  EMPLOYEE: [dashboard, myLeaves, handovers, notifications],
  MANAGER: [dashboard, approvals, handovers, notifications],
  ADMIN: [dashboard, { ...approvals, label: 'Approvals' }, { label: 'Employees', path: '/admin/employees', icon: Users }, notifications],
};
