import express, { Router, type RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import type { Container } from '../config/services.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { attachmentUpload, spreadsheetUpload } from '../middleware/upload.js';
import { apiRoutes } from './definitions.js';

/** Mounts the declarative route table (routes/definitions.ts) on an Express router. */
export function createApiRouter(c: Container): Router {
  const api = Router();
  const requireAuth = authenticate(c);
  const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: c.env.isTest ? 1000 : 20, standardHeaders: 'draft-7', legacyHeaders: false });
  const uploads = {
    attachment: attachmentUpload(c.env.uploadDir).single('file'),
    spreadsheet: spreadsheetUpload.single('file'),
  };

  for (const route of apiRoutes(c)) {
    const chain: RequestHandler[] = [];
    if (route.rateLimit === 'login') chain.push(loginLimiter);
    if (!route.public) chain.push(requireAuth);
    if (route.roles) chain.push(authorize(...route.roles));
    if (route.upload) chain.push(uploads[route.upload]);
    api[route.method](route.path, ...chain, route.handler as RequestHandler);
  }

  // Leave attachments (authenticated).
  api.use('/uploads', requireAuth, express.static(c.env.uploadDir, { fallthrough: false, dotfiles: 'deny' }));
  return api;
}
