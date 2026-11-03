import type { Request, Response } from 'express';
import {
  balanceAdjustmentSchema,
  compOffSchema,
  departmentInputSchema,
  holidayInputSchema,
  leaveTypeInputSchema,
  settingsInputSchema,
  type HolidayInput,
} from '@leaveflow/shared';
import { z } from 'zod';
import type { Container } from '../config/services.js';
import { badRequest, forbidden, notFound } from '../utils/errors.js';
import { readUploadedSheet, sendWorkbook, sendXlsx, sheet } from '../utils/spreadsheet.js';

const yearQuery = z.object({ year: z.preprocess((v) => (v === '' ? undefined : v), z.coerce.number().int().min(2000).max(2100).optional()) });

export function masterDataController(c: Container) {
  return {
    // ---- leave types ----
    async listLeaveTypes(req: Request, res: Response) {
      res.json(await c.leaveTypes.list(req.query.active !== 'true'));
    },
    async createLeaveType(req: Request, res: Response) {
      res.status(201).json(await c.leaveTypes.create(leaveTypeInputSchema.parse(req.body), req.user!));
    },
    async updateLeaveType(req: Request, res: Response) {
      res.json(await c.leaveTypes.update(String(req.params.code), leaveTypeInputSchema.partial().parse(req.body), req.user!));
    },
    async deleteLeaveType(req: Request, res: Response) {
      res.json(await c.leaveTypes.remove(String(req.params.code), req.user!));
    },
    // ---- holidays ----
    async listHolidays(req: Request, res: Response) {
      res.json(await c.holidays.list(yearQuery.parse(req.query).year));
    },
    async createHoliday(req: Request, res: Response) {
      res.status(201).json(await c.holidays.create(holidayInputSchema.parse(req.body), req.user!));
    },
    async updateHoliday(req: Request, res: Response) {
      res.json(await c.holidays.update(String(req.params.id), holidayInputSchema.partial().parse(req.body), req.user!));
    },
    async deleteHoliday(req: Request, res: Response) {
      await c.holidays.remove(String(req.params.id), req.user!);
      res.status(204).end();
    },
    async importHolidays(req: Request, res: Response) {
      if (!req.file) throw badRequest('No file uploaded');
      const raw = await readUploadedSheet(req.file.buffer);
      const valid: HolidayInput[] = [];
      const errors: string[] = [];
      raw.forEach((row, i) => {
        const parsed = holidayInputSchema.safeParse({
          holidayName: String(row.holidayName ?? row['Holiday Name'] ?? ''),
          holidayDate: String(row.holidayDate ?? row['Date'] ?? ''),
          holidayType: String(row.holidayType ?? row['Type'] ?? 'PUBLIC').toUpperCase(),
          description: String(row.description ?? row['Description'] ?? ''),
        });
        if (parsed.success) valid.push(parsed.data);
        else errors.push(`Row ${i + 2}: ${parsed.error.issues[0].path.join('.')} ${parsed.error.issues[0].message}`);
      });
      const result = await c.holidays.importMany(valid, req.user!);
      res.json({ ...result, errors });
    },
    // ---- departments ----
    async listDepartments(_req: Request, res: Response) {
      res.json(await c.departments.list());
    },
    async createDepartment(req: Request, res: Response) {
      res.status(201).json(await c.departments.create(departmentInputSchema.parse(req.body), req.user!));
    },
    async updateDepartment(req: Request, res: Response) {
      res.json(await c.departments.update(String(req.params.id), departmentInputSchema.partial().parse(req.body), req.user!));
    },
    async deleteDepartment(req: Request, res: Response) {
      await c.departments.remove(String(req.params.id), req.user!);
      res.status(204).end();
    },
  };
}

export function balanceController(c: Container) {
  const canView = async (req: Request, employeeId: string) => {
    const actor = req.user!;
    if (actor.role === 'ADMIN' || actor.employeeId === employeeId) return;
    const employee = await c.repos.employees.findById(employeeId);
    if (!employee) throw notFound('Employee', employeeId);
    if (employee.managerId !== actor.employeeId) throw forbidden();
  };
  return {
    async listAll(req: Request, res: Response) {
      res.json(await c.balances.listAll(yearQuery.parse(req.query).year));
    },
    async get(req: Request, res: Response) {
      const employeeId = String(req.params.employeeId);
      await canView(req, employeeId);
      res.json(await c.balances.getBalances(employeeId, yearQuery.parse(req.query).year));
    },
    async adjust(req: Request, res: Response) {
      res.json(await c.balances.adjust(String(req.params.employeeId), balanceAdjustmentSchema.parse(req.body), req.user!));
    },
    async compOff(req: Request, res: Response) {
      res.json(await c.balances.addCompOff(String(req.params.employeeId), compOffSchema.parse(req.body), req.user!));
    },
    async transactions(req: Request, res: Response) {
      const employeeId = String(req.params.employeeId);
      await canView(req, employeeId);
      res.json(await c.balances.transactions(employeeId, yearQuery.parse(req.query).year));
    },
    async yearEnd(req: Request, res: Response) {
      const { year } = z.object({ year: z.coerce.number().int().min(2000).max(2100) }).parse(req.body);
      res.json(await c.balances.yearEndRollover(year, req.user!));
    },
    async export(req: Request, res: Response) {
      const rows = await c.balances.listAll(yearQuery.parse(req.query).year);
      await sendWorkbook(res, 'leave-balances', [
        sheet({
          name: 'Leave Balances',
          rows: rows.filter((r) => r.trackBalance),
          columns: [
            { header: 'Employee ID', value: (r) => r.employeeId },
            { header: 'Employee', value: (r) => r.employeeName, width: 24 },
            { header: 'Department', value: (r) => r.department, width: 20 },
            { header: 'Year', value: (r) => r.year },
            { header: 'Leave Type', value: (r) => r.leaveTypeName, width: 20 },
            { header: 'Allocated', value: (r) => r.allocated },
            { header: 'Carried Forward', value: (r) => r.carriedForward },
            { header: 'Adjusted', value: (r) => r.adjusted },
            { header: 'Total', value: (r) => r.total },
            { header: 'Used', value: (r) => r.used },
            { header: 'Pending', value: (r) => r.pending },
            { header: 'Available', value: (r) => r.available },
          ],
        }),
      ]);
    },
  };
}

export function systemController(c: Container) {
  return {
    async getSettings(_req: Request, res: Response) {
      res.json(await c.settings.get());
    },
    async updateSettings(req: Request, res: Response) {
      res.json(await c.settings.update(settingsInputSchema.parse(req.body), req.user!));
    },
    async workbookInfo(_req: Request, res: Response) {
      res.json({ ...(await c.store.info()), provider: c.env.dataProvider });
    },
    async backup(req: Request, res: Response) {
      const fileName = await c.store.createBackup('manual');
      await c.audit.log(req.user!, 'WORKBOOK_BACKUP', 'Workbook', fileName ?? '');
      res.status(201).json({ fileName });
    },
    async download(_req: Request, res: Response) {
      sendXlsx(res, `LeaveFlow-${new Date().toISOString().slice(0, 10)}.xlsx`, await c.store.exportWorkbook());
    },
    async downloadBackup(req: Request, res: Response) {
      const name = String(req.params.fileName).split(/[\\/]/).pop() ?? '';
      const bytes = await c.store.readBackup(name);
      if (!bytes) throw notFound('Backup', name);
      sendXlsx(res, name, bytes);
    },
    async auditLogs(req: Request, res: Response) {
      const q = z.object({ entityType: z.string().optional(), actorId: z.string().optional(), limit: z.coerce.number().int().min(1).max(1000).optional() }).parse(req.query);
      const [logs, employees] = await Promise.all([c.audit.list(q), c.repos.employees.findAll()]);
      const names = new Map(employees.map((e) => [e.employeeId, e.employeeName]));
      res.json(logs.map((l) => ({ ...l, actorName: names.get(l.actorId) ?? l.actorId })));
    },
    async runLifecycle(_req: Request, res: Response) {
      res.json(await c.lifecycle.run());
    },
  };
}
