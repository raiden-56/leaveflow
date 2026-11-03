import type { Request, Response } from 'express';
import { loginSchema } from '@leaveflow/shared';
import type { Container } from '../config/services.js';

export function authController(c: Container) {
  const cookieOptions = {
    httpOnly: true,
    sameSite: 'strict' as const,
    secure: c.env.isProduction,
    path: '/',
  };
  return {
    async login(req: Request, res: Response) {
      const { email, password } = loginSchema.parse(req.body);
      const { token, user } = await c.auth.login(email, password);
      res.cookie(c.env.authCookieName, token, { ...cookieOptions, maxAge: 8 * 60 * 60 * 1000 });
      res.json({ user });
    },
    async logout(req: Request, res: Response) {
      res.clearCookie(c.env.authCookieName, cookieOptions);
      res.json({ success: true });
    },
    async me(req: Request, res: Response) {
      res.json({ user: await c.auth.toAuthUser(req.user!), settings: await c.settings.get() });
    },
    async demoAccounts(_req: Request, res: Response) {
      res.json(await c.auth.demoAccounts());
    },
  };
}
