import type { NextFunction, Request, Response } from 'express';
import type { Role } from '@leaveflow/shared';
import type { Container } from '../config/services.js';
import { forbidden, unauthorized } from '../utils/errors.js';

/** Authenticates via the httpOnly session cookie (browser) or a Bearer token (API clients). */
export function authenticate(container: Container) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    const token = req.cookies?.[container.env.authCookieName] ?? (header?.startsWith('Bearer ') ? header.slice(7) : undefined);
    if (!token) throw unauthorized();
    const payload = container.auth.verifyToken(token);
    // Re-read the employee on every request so role changes / deactivation apply immediately.
    req.user = await container.auth.resolveUser(payload.sub);
    next();
  };
}

export function authorize(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw unauthorized();
    if (!roles.includes(req.user.role)) throw forbidden();
    next();
  };
}
