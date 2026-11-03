import type { Request, Response } from 'express';
import { HANDOVER_STATUS_LABELS, LEAVE_STATUS_LABELS } from '@leaveflow/shared';
import { z } from 'zod';
import type { Container } from '../config/services.js';
import { sendWorkbook, sheet } from '../utils/spreadsheet.js';
import { reportQuery } from '../validators/index.js';

export function dashboardController(c: Container) {
  return {
    async employee(req: Request, res: Response) {
      res.json(await c.dashboards.employee(req.user!));
    },
    async manager(req: Request, res: Response) {
      res.json(await c.dashboards.manager(req.user!));
    },
    async admin(req: Request, res: Response) {
      res.json(await c.dashboards.admin(req.user!));
    },
    async teamAvailability(req: Request, res: Response) {
      const q = z.object({ date: z.string().optional(), department: z.string().optional() }).parse(req.query);
      res.json(await c.dashboards.teamAvailability(req.user!, q.date || undefined, q.department || undefined));
    },
  };
}

export function notificationController(c: Container) {
  return {
    async list(req: Request, res: Response) {
      const q = z.object({ unreadOnly: z.string().optional(), limit: z.coerce.number().int().min(1).max(500).optional() }).parse(req.query);
      res.json(await c.notifications.list(req.user!, { unreadOnly: q.unreadOnly === 'true', limit: q.limit }));
    },
    async markRead(req: Request, res: Response) {
      res.json(await c.notifications.markRead(req.user!, String(req.params.id)));
    },
    async markAllRead(req: Request, res: Response) {
      res.json({ updated: await c.notifications.markAllRead(req.user!) });
    },
    async remove(req: Request, res: Response) {
      await c.notifications.remove(req.user!, String(req.params.id));
      res.status(204).end();
    },
  };
}

export function reportController(c: Container) {
  return {
    async leaveSummary(req: Request, res: Response) {
      res.json(await c.reports.leaveSummary(req.user!, reportQuery.parse(req.query)));
    },
    async departmentSummary(req: Request, res: Response) {
      res.json(await c.reports.departmentSummary(req.user!, reportQuery.parse(req.query)));
    },
    async handoverSummary(req: Request, res: Response) {
      res.json(await c.reports.handoverSummary(req.user!, reportQuery.parse(req.query)));
    },
    /** One workbook with every report for the selected period. */
    async export(req: Request, res: Response) {
      const filters = reportQuery.parse(req.query);
      const [summary, departments, handovers, handoverList] = await Promise.all([
        c.reports.leaveSummary(req.user!, filters),
        c.reports.departmentSummary(req.user!, filters),
        c.reports.handoverSummary(req.user!, filters),
        c.handovers.list(req.user!, { scope: req.user!.role === 'ADMIN' ? 'all' : 'team', from: filters.from, to: filters.to }),
      ]);
      await sendWorkbook(res, 'leaveflow-report', [
        sheet({
          name: 'Monthly Summary',
          rows: summary.byMonth,
          columns: [
            { header: 'Month', value: (r) => r.month },
            { header: 'Approved requests', value: (r) => r.approved },
            { header: 'Pending requests', value: (r) => r.pending },
            { header: 'Rejected requests', value: (r) => r.rejected },
            { header: 'Approved days', value: (r) => r.days },
          ],
        }),
        sheet({
          name: 'By Employee',
          rows: summary.byEmployee,
          columns: [
            { header: 'Employee ID', value: (r) => r.employeeId },
            { header: 'Employee', value: (r) => r.employeeName, width: 24 },
            { header: 'Department', value: (r) => r.department, width: 20 },
            { header: 'Requests', value: (r) => r.requests },
            { header: 'Approved days', value: (r) => r.days },
          ],
        }),
        sheet({
          name: 'By Department',
          rows: departments.departments,
          columns: [
            { header: 'Department', value: (r) => r.department, width: 22 },
            { header: 'Employees', value: (r) => r.employees },
            { header: 'Requests', value: (r) => r.requests },
            { header: 'Approved days', value: (r) => r.days },
            { header: 'Avg days / employee', value: (r) => r.averageDaysPerEmployee },
            { header: 'On leave today', value: (r) => r.onLeaveToday },
          ],
        }),
        sheet({
          name: 'By Leave Type',
          rows: summary.byType,
          columns: [
            { header: 'Code', value: (r) => r.leaveType },
            { header: 'Leave type', value: (r) => r.name, width: 22 },
            { header: 'Requests', value: (r) => r.requests },
            { header: 'Approved days', value: (r) => r.days },
          ],
        }),
        sheet({
          name: 'Pending Approvals',
          rows: summary.pending,
          columns: [
            { header: 'Leave ID', value: (r) => r.leaveId },
            { header: 'Employee', value: (r) => r.employee?.employeeName, width: 24 },
            { header: 'Type', value: (r) => r.leaveTypeName, width: 18 },
            { header: 'Start', value: (r) => r.startDate },
            { header: 'End', value: (r) => r.endDate },
            { header: 'Days', value: (r) => r.totalDays },
            { header: 'Status', value: (r) => LEAVE_STATUS_LABELS[r.status as keyof typeof LEAVE_STATUS_LABELS] },
            { header: 'Approver', value: (r) => r.approver?.employeeName, width: 22 },
          ],
        }),
        sheet({
          name: 'Work Handovers',
          rows: handoverList,
          columns: [
            { header: 'Handover ID', value: (r) => r.handoverId },
            { header: 'Leave ID', value: (r) => r.leaveId },
            { header: 'Employee', value: (r) => r.employee?.employeeName, width: 22 },
            { header: 'Backup', value: (r) => r.backupEmployee?.employeeName, width: 22 },
            { header: 'Title', value: (r) => r.handoverTitle, width: 32 },
            { header: 'Start', value: (r) => r.startDate },
            { header: 'End', value: (r) => r.endDate },
            { header: 'Priority', value: (r) => r.priority },
            { header: 'Status', value: (r) => HANDOVER_STATUS_LABELS[r.handoverStatus as keyof typeof HANDOVER_STATUS_LABELS] },
            { header: 'Tasks', value: (r) => r.tasks.length },
            { header: 'Completion %', value: (r) => r.completionStatus },
          ],
        }),
        sheet({
          name: 'Handover Completion',
          rows: handovers.byBackup,
          columns: [
            { header: 'Backup employee', value: (r) => r.employeeName, width: 24 },
            { header: 'Handovers', value: (r) => r.handovers },
            { header: 'Tasks', value: (r) => r.tasks },
            { header: 'Completed tasks', value: (r) => r.completedTasks },
          ],
        }),
      ]);
    },
  };
}
