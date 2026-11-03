import type { AuthUser, Employee, Role } from '@leaveflow/shared';

export interface TokenPayload {
  sub: string;
  role: Role;
}

export interface DemoAccountsResult {
  enabled: boolean;
  passwordHint: string;
  accounts: { role: Role; email: string; name: string; designation: string }[];
}

/**
 * Authentication contract used by controllers and middleware.
 * Node: JWT-based `AuthService`. Static (GitHub Pages) build: `BrowserAuthService`.
 */
export interface AuthProvider {
  login(email: string, password: string): Promise<{ token: string; user: AuthUser }>;
  verifyToken(token: string): TokenPayload;
  resolveUser(employeeId: string): Promise<Employee>;
  toAuthUser(employee: Employee): Promise<AuthUser>;
  demoAccounts(): Promise<DemoAccountsResult>;
}

/** Runtime configuration the HTTP layer needs (a subset of the Node env). */
export interface AppConfig {
  authCookieName: string;
  isProduction: boolean;
  isTest: boolean;
  dataProvider: string;
  uploadDir: string;
}
