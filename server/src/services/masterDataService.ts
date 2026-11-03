import type {
  Department,
  DepartmentInput,
  Holiday,
  HolidayInput,
  LeaveType,
  LeaveTypeInput,
} from '@leaveflow/shared';
import { conflict, notFound, validationError } from '../utils/errors.js';
import type { Actor, ServiceDeps } from './context.js';
import type { AuditService } from './auditService.js';

export class LeaveTypeService {
  constructor(
    private readonly deps: ServiceDeps,
    private readonly audit: AuditService,
  ) {}

  async list(includeInactive = true): Promise<LeaveType[]> {
    const all = await this.deps.repos.leaveTypes.findAll();
    return all.filter((t) => includeInactive || t.isActive).sort((a, b) => a.name.localeCompare(b.name));
  }

  async create(input: LeaveTypeInput, actor: Actor): Promise<LeaveType> {
    return this.deps.uow.run(async () => {
      if (await this.deps.repos.leaveTypes.findById(input.code)) throw conflict(`Leave type ${input.code} already exists`);
      const created = await this.deps.repos.leaveTypes.create(input);
      await this.audit.log(actor, 'LEAVE_TYPE_CREATED', 'LeaveType', created.code, input);
      return created;
    });
  }

  async update(code: string, input: Partial<LeaveTypeInput>, actor: Actor): Promise<LeaveType> {
    return this.deps.uow.run(async () => {
      const { code: _ignored, ...rest } = input;
      const updated = await this.deps.repos.leaveTypes.update(code, rest);
      await this.audit.log(actor, 'LEAVE_TYPE_UPDATED', 'LeaveType', code, rest);
      return updated;
    });
  }

  /** Leave types referenced by requests are deactivated instead of deleted to keep history intact. */
  async remove(code: string, actor: Actor): Promise<{ deactivated: boolean }> {
    return this.deps.uow.run(async () => {
      const inUse = await this.deps.repos.leaves.count((l) => l.leaveType === code);
      if (inUse > 0) {
        await this.deps.repos.leaveTypes.update(code, { isActive: false });
        await this.audit.log(actor, 'LEAVE_TYPE_DEACTIVATED', 'LeaveType', code);
        return { deactivated: true };
      }
      await this.deps.repos.leaveTypes.delete(code);
      await this.deps.repos.balances.findWhere((b) => b.leaveType === code).then(async (rows) => {
        for (const r of rows) await this.deps.repos.balances.delete(r.balanceId);
      });
      await this.audit.log(actor, 'LEAVE_TYPE_DELETED', 'LeaveType', code);
      return { deactivated: false };
    });
  }
}

export class HolidayService {
  constructor(
    private readonly deps: ServiceDeps,
    private readonly audit: AuditService,
  ) {}

  async list(year?: number): Promise<Holiday[]> {
    const all = await this.deps.repos.holidays.findAll();
    return all
      .filter((h) => !year || h.holidayDate.startsWith(String(year)))
      .sort((a, b) => a.holidayDate.localeCompare(b.holidayDate));
  }

  /** Holidays that are non-working days (optional holidays are excluded). */
  async nonWorking(): Promise<Holiday[]> {
    return (await this.list()).filter((h) => h.holidayType !== 'OPTIONAL');
  }

  private async assertUniqueDate(date: string, name: string, excludeId?: string) {
    const clash = await this.deps.repos.holidays.findWhere(
      (h) => h.holidayDate === date && h.holidayName.toLowerCase() === name.toLowerCase() && h.holidayId !== excludeId,
    );
    if (clash.length) throw conflict(`${name} on ${date} already exists`);
  }

  async create(input: HolidayInput, actor: Actor): Promise<Holiday> {
    return this.deps.uow.run(async () => {
      await this.assertUniqueDate(input.holidayDate, input.holidayName);
      const created = await this.deps.repos.holidays.create(input);
      await this.audit.log(actor, 'HOLIDAY_CREATED', 'Holiday', created.holidayId, input);
      return created;
    });
  }

  async update(id: string, input: Partial<HolidayInput>, actor: Actor): Promise<Holiday> {
    return this.deps.uow.run(async () => {
      const current = await this.deps.repos.holidays.findById(id);
      if (!current) throw notFound('Holiday', id);
      await this.assertUniqueDate(input.holidayDate ?? current.holidayDate, input.holidayName ?? current.holidayName, id);
      const updated = await this.deps.repos.holidays.update(id, input);
      await this.audit.log(actor, 'HOLIDAY_UPDATED', 'Holiday', id, input);
      return updated;
    });
  }

  async remove(id: string, actor: Actor): Promise<void> {
    await this.deps.uow.run(async () => {
      await this.deps.repos.holidays.delete(id);
      await this.audit.log(actor, 'HOLIDAY_DELETED', 'Holiday', id);
    });
  }

  async importMany(rows: HolidayInput[], actor: Actor): Promise<{ created: number; skipped: number }> {
    return this.deps.uow.run(async () => {
      let created = 0;
      let skipped = 0;
      const existing = await this.deps.repos.holidays.findAll();
      for (const row of rows) {
        const dup = existing.some((h) => h.holidayDate === row.holidayDate && h.holidayName.toLowerCase() === row.holidayName.toLowerCase());
        if (dup) {
          skipped++;
          continue;
        }
        existing.push(await this.deps.repos.holidays.create(row));
        created++;
      }
      await this.audit.log(actor, 'HOLIDAYS_IMPORTED', 'Holiday', '*', { created, skipped });
      return { created, skipped };
    });
  }
}

export class DepartmentService {
  constructor(
    private readonly deps: ServiceDeps,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<(Department & { employeeCount: number; headName: string })[]> {
    const [departments, employees] = await Promise.all([
      this.deps.repos.departments.findAll(),
      this.deps.repos.employees.findAll(),
    ]);
    return departments
      .map((d) => ({
        ...d,
        employeeCount: employees.filter((e) => e.department === d.departmentName && e.employmentStatus !== 'INACTIVE').length,
        headName: employees.find((e) => e.employeeId === d.headId)?.employeeName ?? '',
      }))
      .sort((a, b) => a.departmentName.localeCompare(b.departmentName));
  }

  async create(input: DepartmentInput, actor: Actor): Promise<Department> {
    return this.deps.uow.run(async () => {
      const dup = await this.deps.repos.departments.count((d) => d.departmentName.toLowerCase() === input.departmentName.toLowerCase());
      if (dup) throw conflict(`Department ${input.departmentName} already exists`);
      const created = await this.deps.repos.departments.create(input);
      await this.audit.log(actor, 'DEPARTMENT_CREATED', 'Department', created.departmentId, input);
      return created;
    });
  }

  /** Renaming a department cascades to employees (Employees.department stores the name for Excel readability). */
  async update(id: string, input: Partial<DepartmentInput>, actor: Actor): Promise<Department> {
    return this.deps.uow.run(async () => {
      const current = await this.deps.repos.departments.findById(id);
      if (!current) throw notFound('Department', id);
      const updated = await this.deps.repos.departments.update(id, input);
      if (input.departmentName && input.departmentName !== current.departmentName) {
        const members = await this.deps.repos.employees.findByDepartment(current.departmentName);
        for (const m of members) await this.deps.repos.employees.update(m.employeeId, { department: input.departmentName });
      }
      await this.audit.log(actor, 'DEPARTMENT_UPDATED', 'Department', id, input);
      return updated;
    });
  }

  async remove(id: string, actor: Actor): Promise<void> {
    await this.deps.uow.run(async () => {
      const current = await this.deps.repos.departments.findById(id);
      if (!current) throw notFound('Department', id);
      const members = await this.deps.repos.employees.count(
        (e) => e.department === current.departmentName && e.employmentStatus !== 'INACTIVE',
      );
      if (members > 0) throw validationError(`Move the ${members} active employee(s) out of ${current.departmentName} first`);
      await this.deps.repos.departments.delete(id);
      await this.audit.log(actor, 'DEPARTMENT_DELETED', 'Department', id);
    });
  }
}
