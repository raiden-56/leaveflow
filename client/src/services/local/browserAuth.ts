import type { AuthUser, Employee, Role } from '@leaveflow/shared';
import type { AuthProvider, DemoAccountsResult, TokenPayload } from '@server/services/authProvider';
import type { AuditService } from '@server/services/auditService';
import type { ServiceDeps } from '@server/services/context';
import { unauthorized } from '@server/utils/errors';

export const DEMO_PASSWORD = import.meta.env.VITE_DEMO_PASSWORD ?? 'LeaveFlow@2026';

/**
 * Demo authentication for the static build. Everything runs in the visitor's
 * own browser, so this only selects which demo persona is active; it is not a
 * security boundary (the Node API uses signed JWTs in httpOnly cookies).
 */
export class BrowserAuthService implements AuthProvider {
  constructor(
    private readonly deps: ServiceDeps,
    private readonly audit: AuditService,
  ) {}

  async login(email: string, password: string): Promise<{ token: string; user: AuthUser }> {
    const employee = await this.deps.repos.employees.findByEmail(email);
    if (!employee || employee.employmentStatus === 'INACTIVE' || password !== DEMO_PASSWORD) {
      throw unauthorized('Invalid email or password');
    }
    await this.audit.log(employee, 'LOGIN', 'Auth', employee.employeeId);
    return { token: employee.employeeId, user: await this.toAuthUser(employee) };
  }

  verifyToken(token: string): TokenPayload {
    if (!token) throw unauthorized();
    return { sub: token, role: 'EMPLOYEE' };
  }

  async resolveUser(employeeId: string): Promise<Employee> {
    const employee = await this.deps.repos.employees.findById(employeeId);
    if (!employee || employee.employmentStatus === 'INACTIVE') throw unauthorized('Account is not active');
    return employee;
  }

  async toAuthUser(employee: Employee): Promise<AuthUser> {
    const manager = employee.managerId ? await this.deps.repos.employees.findById(employee.managerId) : null;
    return { ...employee, managerName: manager?.employeeName ?? '' };
  }

  async demoAccounts(): Promise<DemoAccountsResult> {
    const employees = (await this.deps.repos.employees.findAll()).filter((e) => e.employmentStatus === 'ACTIVE');
    const leaves = await this.deps.repos.leaves.findAll();
    const activity = (id: string) => leaves.filter((l) => l.employeeId === id).length;
    const pick = (role: Role) => employees.filter((e) => e.role === role).sort((a, b) => activity(b.employeeId) - activity(a.employeeId))[0];
    const accounts = (['EMPLOYEE', 'MANAGER', 'ADMIN'] as Role[])
      .map(pick)
      .filter((e): e is Employee => Boolean(e))
      .map((e) => ({ role: e.role, email: e.email, name: e.employeeName, designation: e.designation }));
    return { enabled: true, accounts, passwordHint: DEMO_PASSWORD };
  }
}
