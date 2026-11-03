import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { AuthUser, Employee, Role } from '@leaveflow/shared';
import type { AuthProvider, DemoAccountsResult, TokenPayload } from './authProvider.js';
import type { Env } from '../config/env.js';
import { unauthorized } from '../utils/errors.js';
import type { ServiceDeps } from './context.js';
import type { AuditService } from './auditService.js';

/**
 * Verifies a user's password. The demo provider checks a shared password from
 * the environment; a production provider would check salted hashes in a
 * credential store (never in the Excel workbook) or delegate to SSO.
 */
export interface CredentialProvider {
  verify(employee: Employee, password: string): Promise<boolean>;
}

export class DemoCredentialProvider implements CredentialProvider {
  private readonly digest: Buffer;
  constructor(demoPassword: string) {
    this.digest = crypto.createHash('sha256').update(demoPassword).digest();
  }
  async verify(_employee: Employee, password: string): Promise<boolean> {
    const candidate = crypto.createHash('sha256').update(password).digest();
    return crypto.timingSafeEqual(candidate, this.digest);
  }
}

export type { TokenPayload };

export class AuthService implements AuthProvider {
  constructor(
    private readonly deps: ServiceDeps,
    private readonly env: Env,
    private readonly credentials: CredentialProvider,
    private readonly audit: AuditService,
  ) {}

  async login(email: string, password: string): Promise<{ token: string; user: AuthUser }> {
    const employee = await this.deps.repos.employees.findByEmail(email);
    // Same error for unknown user / bad password / inactive to avoid account enumeration.
    const ok = employee && employee.employmentStatus !== 'INACTIVE' && (await this.credentials.verify(employee, password));
    if (!ok || !employee) {
      await this.audit.log(null, 'LOGIN_FAILED', 'Auth', email.slice(0, 80));
      throw unauthorized('Invalid email or password');
    }
    const token = jwt.sign({ sub: employee.employeeId, role: employee.role } satisfies TokenPayload, this.env.jwtSecret, {
      expiresIn: this.env.jwtExpiresIn as jwt.SignOptions['expiresIn'],
    });
    await this.audit.log(employee, 'LOGIN', 'Auth', employee.employeeId);
    return { token, user: await this.toAuthUser(employee) };
  }

  verifyToken(token: string): TokenPayload {
    try {
      return jwt.verify(token, this.env.jwtSecret) as TokenPayload;
    } catch {
      throw unauthorized('Your session has expired. Please sign in again.');
    }
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

  /** Demo accounts shown on the login screen (one per role). */
  async demoAccounts(): Promise<DemoAccountsResult> {
    if (!this.env.demoAuthEnabled) return { enabled: false, accounts: [], passwordHint: '' };
    const employees = (await this.deps.repos.employees.findAll()).filter((e) => e.employmentStatus === 'ACTIVE');
    const leaves = await this.deps.repos.leaves.findAll();
    const activity = (id: string) => leaves.filter((l) => l.employeeId === id).length;
    // Prefer the most active account per role so the demo shows real data.
    const pick = (role: Role) => employees.filter((e) => e.role === role).sort((a, b) => activity(b.employeeId) - activity(a.employeeId))[0];
    const accounts = (['EMPLOYEE', 'MANAGER', 'ADMIN'] as Role[])
      .map(pick)
      .filter((e): e is Employee => Boolean(e))
      .map((e) => ({ role: e.role, email: e.email, name: e.employeeName, designation: e.designation }));
    return { enabled: true, accounts, passwordHint: this.env.demoShowPasswordHint ? this.env.demoPassword : '' };
  }
}
