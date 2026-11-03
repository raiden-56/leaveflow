import type { Request, Response } from 'express';
import { ROLE_LABELS, employeeInputSchema, type EmployeeInput } from '@leaveflow/shared';
import type { Container } from '../config/services.js';
import { badRequest } from '../utils/errors.js';
import { readUploadedSheet, sendWorkbook, sheet } from '../utils/spreadsheet.js';
import { employeeListQuery } from '../validators/index.js';

export function employeeController(c: Container) {
  return {
    async list(req: Request, res: Response) {
      res.json(await c.employees.list(req.user!, employeeListQuery.parse(req.query)));
    },
    async get(req: Request, res: Response) {
      res.json(await c.employees.get(req.user!, String(req.params.id)));
    },
    async create(req: Request, res: Response) {
      res.status(201).json(await c.employees.create(employeeInputSchema.parse(req.body), req.user!));
    },
    async update(req: Request, res: Response) {
      res.json(await c.employees.update(String(req.params.id), employeeInputSchema.parse(req.body), req.user!));
    },
    async remove(req: Request, res: Response) {
      res.json(await c.employees.deactivate(String(req.params.id), req.user!));
    },
    async export(req: Request, res: Response) {
      const rows = await c.employees.list(req.user!, { ...employeeListQuery.parse(req.query), includeInactive: true });
      await sendWorkbook(res, 'employees', [
        sheet({
          name: 'Employees',
          rows,
          columns: [
            { header: 'employeeId', value: (r) => r.employeeId },
            { header: 'employeeName', value: (r) => r.employeeName, width: 24 },
            { header: 'email', value: (r) => r.email, width: 32 },
            { header: 'phone', value: (r) => r.phone, width: 16 },
            { header: 'department', value: (r) => r.department, width: 20 },
            { header: 'designation', value: (r) => r.designation, width: 28 },
            { header: 'managerId', value: (r) => r.managerId },
            { header: 'managerName', value: (r) => r.managerName, width: 22 },
            { header: 'joiningDate', value: (r) => r.joiningDate },
            { header: 'employmentStatus', value: (r) => r.employmentStatus },
            { header: 'role', value: (r) => r.role },
            { header: 'roleLabel', value: (r) => ROLE_LABELS[r.role as keyof typeof ROLE_LABELS] },
            { header: 'workMode', value: (r) => r.workMode },
            { header: 'location', value: (r) => r.location },
          ],
        }),
      ]);
    },
    /** Upserts employees by email from the first sheet of an .xlsx file (same columns as the export). */
    async import(req: Request, res: Response) {
      if (!req.file) throw badRequest('No file uploaded');
      const raw = await readUploadedSheet(req.file.buffer);
      if (raw.length === 0) throw badRequest('The uploaded sheet has no data rows');
      const valid: EmployeeInput[] = [];
      const errors: string[] = [];
      raw.forEach((row, i) => {
        const parsed = employeeInputSchema.safeParse(
          Object.fromEntries(Object.entries(row).map(([k, v]) => [k, typeof v === 'string' ? v : v === null || v === undefined ? '' : String(v)])),
        );
        if (parsed.success) valid.push(parsed.data);
        else errors.push(`Row ${i + 2}: ${parsed.error.issues.map((x) => `${x.path.join('.')}: ${x.message}`).join('; ')}`);
      });
      const result = await c.employees.importMany(valid, req.user!);
      res.json({ ...result, errors: [...errors, ...result.errors] });
    },
  };
}
