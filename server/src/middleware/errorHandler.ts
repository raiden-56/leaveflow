import type { NextFunction, Request, Response } from 'express';
import { toErrorResponse } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` } });
}

/** Centralised error handler: every error leaves the API in the same JSON shape. */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const mapped = toErrorResponse(err);
  if (mapped) {
    if (mapped.status >= 500) logger.error(mapped.body.error.message, err);
    return res.status(mapped.status).json(mapped.body);
  }
  logger.error(`Unhandled error on ${req.method} ${req.originalUrl}`, err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' } });
}
