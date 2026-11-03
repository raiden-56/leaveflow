import type { Employee, EmployeeInput, Role } from '@leaveflow/shared';
import { conflict, forbidden, notFound, validationError } from '../utils/errors.js';
import { access, loadDirectory, type Actor, type ServiceDeps } from './context.js';
import type { AuditService } from './auditService.js';

export interface EmployeeFilters {
  search?: string;
  department?: string;
  role?: Role;
  status?: string;
  managerId?: string;
  includeInactive?: boolean;
}

export type EmployeeView = Employee & { managerName: string };

export class EmployeeService {
  constructor(
    private readonly deps: ServiceDeps,
    private readonly audit: AuditService,
  ) {}

  async list(actor: Actor, filters: EmployeeFilters = {}): Promise<EmployeeView[]> {
    const dir = await loadDirectory(this.deps);
    const visible = access.teamIds(actor, dir);
    const managed = access.managedIds(actor, dir);
    const q = filters.search?.trim().toLowerCase();
    return dir.employees
      .filter((e) => !visible || visible.has(e.employeeId) || managed?.has(e.employeeId))
      .filter((e) => filters.includeInactive || filters.status === 'INACTIVE' || e.employmentStatus !== 'INACTIVE')
      .filter((e) => !filters.department || e.department === filters.department)
      .filter((e) => !filters.role || e.role === filters.role)
      .filter((e) => !filters.status || e.employmentStatus === filters.status)
      .filter((e) => !filters.managerId || e.managerId === filters.managerId)
      .filter(
        (e) =>
          !q ||
          [e.employeeId, e.employeeName, e.email, e.designation, e.department].some((v) => v.toLowerCase().includes(q)),
      )
      .map((e) => ({ ...e, managerName: dir.get(e.managerId)?.employeeName ?? '' }))
      .sort((a, b) => a.employeeName.localeCompare(b.employeeName));
  }

  async get(actor: Actor, id: string): Promise<EmployeeView> {
    const dir = await loadDirectory(this.deps);
    const employee = dir.get(id);
    if (!employee) throw notFound('Employee', id);
    const visible = access.teamIds(actor, dir);
    if (visible && !visible.has(id) && employee.managerId !== actor.employeeId) throw forbidden();
    return { ...employee, managerName: dir.get(employee.managerId)?.employeeName ?? '' };
  }

  private async validate(input: EmployeeInput, excludeId?: string) {
    const byEmail = await this.deps.repos.employees.findByEmail(input.email);
    if (byEmail && byEmail.employeeId !== excludeId) throw conflict(`Email ${input.email} is already used by ${byEmail.employeeId}`);
    const dept = await this.deps.repos.departments.count((d) => d.departmentName === input.department);
    if (!dept) throw validationError(`Department "${input.department}" does not exist`);
    if (input.managerId) {
      if (input.managerId === excludeId) throw validationError('An employee cannot report to themselves');
      const manager = await this.deps.repos.employees.findById(input.managerId);
      if (!manager || manager.employmentStatus === 'INACTIVE') throw validationError(`Manager ${input.managerId} not found or inactive`);
      if (manager.role === 'EMPLOYEE') throw validationError(`${manager.employeeName} does not have a Manager or Admin role`);
      // Prevent reporting cycles (A -> B -> A)
      if (excludeId) {
        const all = await this.deps.repos.employees.findAll();
        const map = new Map(all.map((e) => [e.employeeId, e.managerId]));
        let cursor: string | undefined = input.managerId;
        for (let i = 0; cursor && i < 50; i++) {
          if (cursor === excludeId) throw validationError('This manager assignment would create a reporting cycle');
          cursor = map.get(cursor);
        }
      }
    }
  }

  async create(input: EmployeeInput, actor: Actor): Promise<Employee> {
    return this.deps.uow.run(async () => {
      await this.validate(input);
      const created = await this.deps.repos.employees.create(input);
      await this.audit.log(actor, 'EMPLOYEE_CREATED', 'Employee', created.employeeId, { email: input.email, role: input.role });
      return created;
    });
  }

  async update(id: string, input: EmployeeInput, actor: Actor): Promise<Employee> {
    return this.deps.uow.run(async () => {
      const current = await this.deps.repos.employees.findById(id);
      if (!current) throw notFound('Employee', id);
      await this.validate(input, id);
      if (current.employeeId === actor.employeeId && input.role !== 'ADMIN') {
        throw validationError('You cannot remove your own admin role');
      }
      const updated = await this.deps.repos.employees.update(id, input);
      await this.audit.log(actor, 'EMPLOYEE_UPDATED', 'Employee', id, input);
      return updated;
    });
  }

  /** Soft delete: employees with history are deactivated so their leave records stay valid. */
  async deactivate(id: string, actor: Actor): Promise<Employee> {
    return this.deps.uow.run(async () => {
      if (id === actor.employeeId) throw validationError('You cannot deactivate your own account');
      const current = await this.deps.repos.employees.findById(id);
      if (!current) throw notFound('Employee', id);
      const reports = await this.deps.repos.employees.count((e) => e.managerId === id && e.employmentStatus !== 'INACTIVE');
      if (reports > 0) throw validationError(`Reassign the ${reports} direct report(s) of ${current.employeeName} first`);
      const updated = await this.deps.repos.employees.update(id, { employmentStatus: 'INACTIVE' });
      await this.audit.log(actor, 'EMPLOYEE_DEACTIVATED', 'Employee', id);
      return updated;
    });
  }

  async importMany(rows: EmployeeInput[], actor: Actor): Promise<{ created: number; updated: number; errors: string[] }> {
    return this.deps.uow.run(async () => {
      let created = 0;
      let updated = 0;
      const errors: string[] = [];
      for (const [i, row] of rows.entries()) {
        try {
          const existing = await this.deps.repos.employees.findByEmail(row.email);
          if (existing) {
            await this.validate(row, existing.employeeId);
            await this.deps.repos.employees.update(existing.employeeId, row);
            updated++;
          } else {
            await this.validate(row);
            await this.deps.repos.employees.create(row);
            created++;
          }
        } catch (err) {
          errors.push(`Row ${i + 2}: ${(err as Error).message}`);
        }
      }
      await this.audit.log(actor, 'EMPLOYEES_IMPORTED', 'Employee', '*', { created, updated, errors: errors.length });
      return { created, updated, errors };
    });
  }
}
