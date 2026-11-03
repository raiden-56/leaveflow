import type { Request, Response } from 'express';
import type { Role } from '@leaveflow/shared';
import type { Container } from '../config/services.js';
import { authController } from '../controllers/authController.js';
import { balanceController, masterDataController, systemController } from '../controllers/adminController.js';
import { employeeController } from '../controllers/employeeController.js';
import { handoverController } from '../controllers/handoverController.js';
import { dashboardController, notificationController, reportController } from '../controllers/insightController.js';
import { leaveController } from '../controllers/leaveController.js';

export type Handler = (req: Request, res: Response) => unknown;

export interface RouteDef {
  method: 'get' | 'post' | 'put' | 'delete';
  path: string;
  handler: Handler;
  /** No authentication required. */
  public?: boolean;
  roles?: Role[];
  upload?: 'attachment' | 'spreadsheet';
  rateLimit?: 'login';
}

/**
 * The REST API as data. Express mounts it in routes/index.ts; the static
 * (GitHub Pages) build serves the very same table in the browser. Order
 * matters: specific paths come before parameterised ones.
 */
export function apiRoutes(c: Container): RouteDef[] {
  const auth = authController(c);
  const leaves = leaveController(c);
  const handovers = handoverController(c);
  const employees = employeeController(c);
  const master = masterDataController(c);
  const balances = balanceController(c);
  const system = systemController(c);
  const dashboards = dashboardController(c);
  const notifications = notificationController(c);
  const reports = reportController(c);
  const M: Role[] = ['MANAGER', 'ADMIN'];
  const A: Role[] = ['ADMIN'];
  const r = (method: RouteDef['method'], path: string, handler: Handler, extra: Partial<RouteDef> = {}): RouteDef => ({ method, path, handler, ...extra });

  return [
    // ---- public ----
    r('get', '/health', (_req, res) => res.json({ status: 'ok', provider: c.env.dataProvider, time: new Date().toISOString() }), { public: true }),
    r('post', '/auth/login', auth.login, { public: true, rateLimit: 'login' }),
    r('post', '/auth/logout', auth.logout, { public: true }),
    r('get', '/auth/demo-accounts', auth.demoAccounts, { public: true }),

    // ---- authenticated ----
    r('get', '/auth/me', auth.me),

    r('get', '/dashboard/employee', dashboards.employee),
    r('get', '/dashboard/manager', dashboards.manager, { roles: M }),
    r('get', '/dashboard/admin', dashboards.admin, { roles: A }),
    r('get', '/team/availability', dashboards.teamAvailability),

    r('get', '/employees', employees.list),
    r('get', '/employees/export', employees.export, { roles: A }),
    r('post', '/employees/import', employees.import, { roles: A, upload: 'spreadsheet' }),
    r('get', '/employees/:id', employees.get),
    r('post', '/employees', employees.create, { roles: A }),
    r('put', '/employees/:id', employees.update, { roles: A }),
    r('delete', '/employees/:id', employees.remove, { roles: A }),

    r('get', '/leaves', leaves.list),
    r('get', '/leaves/export', leaves.export),
    r('get', '/leaves/calendar', leaves.calendar),
    r('post', '/leaves/preview', leaves.preview),
    r('post', '/leaves/attachments', leaves.uploadAttachment, { upload: 'attachment' }),
    r('get', '/leaves/:id', leaves.get),
    r('post', '/leaves', leaves.create),
    r('put', '/leaves/:id', leaves.update),
    r('delete', '/leaves/:id', leaves.cancel),
    r('post', '/leaves/:id/cancel', leaves.cancel),
    r('post', '/leaves/:id/approve', leaves.approve, { roles: M }),
    r('post', '/leaves/:id/reject', leaves.reject, { roles: M }),
    r('post', '/leaves/:id/request-changes', leaves.requestChanges, { roles: M }),

    r('get', '/leave-balances', balances.listAll, { roles: A }),
    r('get', '/leave-balances/export', balances.export, { roles: A }),
    r('post', '/leave-balances/year-end', balances.yearEnd, { roles: A }),
    r('get', '/leave-balances/:employeeId', balances.get),
    r('put', '/leave-balances/:employeeId', balances.adjust, { roles: A }),
    r('post', '/leave-balances/:employeeId/comp-off', balances.compOff, { roles: A }),
    r('get', '/leave-balances/:employeeId/transactions', balances.transactions),

    r('get', '/handovers', handovers.list),
    r('get', '/handovers/candidates', handovers.candidates),
    r('get', '/handovers/tasks', handovers.listAllTasks),
    r('put', '/handovers/tasks/:taskId', handovers.updateTask),
    r('delete', '/handovers/tasks/:taskId', handovers.deleteTask),
    r('get', '/handovers/:id', handovers.get),
    r('post', '/handovers', handovers.create),
    r('put', '/handovers/:id', handovers.update),
    r('post', '/handovers/:id/accept', handovers.accept),
    r('post', '/handovers/:id/decline', handovers.decline),
    r('post', '/handovers/:id/complete', handovers.complete),
    r('get', '/handovers/:id/tasks', handovers.listTasks),
    r('post', '/handovers/:id/tasks', handovers.addTask),

    r('get', '/leave-types', master.listLeaveTypes),
    r('post', '/leave-types', master.createLeaveType, { roles: A }),
    r('put', '/leave-types/:code', master.updateLeaveType, { roles: A }),
    r('delete', '/leave-types/:code', master.deleteLeaveType, { roles: A }),
    r('get', '/holidays', master.listHolidays),
    r('post', '/holidays/import', master.importHolidays, { roles: A, upload: 'spreadsheet' }),
    r('post', '/holidays', master.createHoliday, { roles: A }),
    r('put', '/holidays/:id', master.updateHoliday, { roles: A }),
    r('delete', '/holidays/:id', master.deleteHoliday, { roles: A }),
    r('get', '/departments', master.listDepartments),
    r('post', '/departments', master.createDepartment, { roles: A }),
    r('put', '/departments/:id', master.updateDepartment, { roles: A }),
    r('delete', '/departments/:id', master.deleteDepartment, { roles: A }),

    r('get', '/notifications', notifications.list),
    r('put', '/notifications/read-all', notifications.markAllRead),
    r('put', '/notifications/:id/read', notifications.markRead),
    r('delete', '/notifications/:id', notifications.remove),

    r('get', '/reports/leave-summary', reports.leaveSummary, { roles: M }),
    r('get', '/reports/department-summary', reports.departmentSummary, { roles: M }),
    r('get', '/reports/handover-summary', reports.handoverSummary, { roles: M }),
    r('get', '/reports/export', reports.export, { roles: M }),

    r('get', '/settings', system.getSettings),
    r('put', '/settings', system.updateSettings, { roles: A }),
    r('get', '/system/workbook', system.workbookInfo, { roles: A }),
    r('post', '/system/workbook/backup', system.backup, { roles: A }),
    r('get', '/system/workbook/download', system.download, { roles: A }),
    r('get', '/system/workbook/backups/:fileName', system.downloadBackup, { roles: A }),
    r('get', '/system/audit-logs', system.auditLogs, { roles: A }),
    r('post', '/system/lifecycle/run', system.runLifecycle, { roles: A }),
  ];
}
