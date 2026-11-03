import type { Employee, EmployeeSummary, OrgSettings } from '@leaveflow/shared';
import { todayIso } from '@leaveflow/shared';
import type { IUnitOfWork, Repositories } from '../repositories/interfaces.js';

/** Dependencies shared by all services (wired in config/container.ts). */
export interface ServiceDeps {
  repos: Repositories;
  uow: IUnitOfWork;
  /** Injected clock so business rules are testable. */
  clock: () => Date;
}

export type Actor = Employee;

export function toSummary(e: Employee | undefined | null): EmployeeSummary | undefined {
  if (!e) return undefined;
  return {
    employeeId: e.employeeId,
    employeeName: e.employeeName,
    email: e.email,
    department: e.department,
    designation: e.designation,
    profileImage: e.profileImage,
    role: e.role,
  };
}

export function today(deps: ServiceDeps, settings: Pick<OrgSettings, 'timezone'>): string {
  return todayIso(settings.timezone, deps.clock());
}

export function nowIso(deps: ServiceDeps): string {
  return deps.clock().toISOString();
}

/** Leave year a date belongs to, honouring the fiscal year start month. */
export function leaveYear(date: string, fiscalYearStartMonth: number): number {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  return month >= fiscalYearStartMonth ? year : year - 1;
}

export class Directory {
  private readonly byId: Map<string, Employee>;
  constructor(public readonly employees: Employee[]) {
    this.byId = new Map(employees.map((e) => [e.employeeId, e]));
  }
  get(id: string): Employee | undefined {
    return this.byId.get(id);
  }
  summary(id: string) {
    return toSummary(this.byId.get(id));
  }
  name(id: string): string {
    return this.byId.get(id)?.employeeName ?? id;
  }
  reportsOf(managerId: string): Employee[] {
    return this.employees.filter((e) => e.managerId === managerId && e.employmentStatus !== 'INACTIVE');
  }
  active(): Employee[] {
    return this.employees.filter((e) => e.employmentStatus !== 'INACTIVE');
  }
  admins(): Employee[] {
    return this.active().filter((e) => e.role === 'ADMIN');
  }
}

export async function loadDirectory(deps: ServiceDeps): Promise<Directory> {
  return new Directory(await deps.repos.employees.findAll());
}

/** Visibility rules shared by every service. */
export const access = {
  isAdmin: (actor: Actor) => actor.role === 'ADMIN',
  isManagerOf: (actor: Actor, employee: Pick<Employee, 'managerId'> | undefined) =>
    Boolean(employee) && employee!.managerId === actor.employeeId,
  /** Employee ids whose leave the actor manages (admin: everyone; manager: direct reports). */
  managedIds(actor: Actor, dir: Directory): Set<string> | null {
    if (actor.role === 'ADMIN') return null; // null = unrestricted
    return new Set(dir.reportsOf(actor.employeeId).map((e) => e.employeeId));
  },
  /** Colleagues whose availability the actor may see (calendar/team views). */
  teamIds(actor: Actor, dir: Directory): Set<string> | null {
    if (actor.role === 'ADMIN') return null;
    const ids = new Set<string>([actor.employeeId]);
    for (const e of dir.active()) {
      if (e.department === actor.department || e.managerId === actor.employeeId) ids.add(e.employeeId);
    }
    return ids;
  },
};
