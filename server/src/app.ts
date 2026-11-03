import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import type { NodeContainer } from './config/container.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { createApiRouter } from './routes/index.js';
import { logger } from './utils/logger.js';

export function createApp(container: NodeContainer) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-origin' } }));
  app.use(cors({ origin: container.env.corsOrigins, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  if (!container.env.isTest) {
    app.use((req, res, next) => {
      const start = Date.now();
      res.on('finish', () => {
        if (req.path.startsWith('/api')) logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`);
      });
      next();
    });
  }

  app.use('/api', createApiRouter(container));
  app.use('/api', notFoundHandler);

  // Serve the built SPA in production (npm run build && npm start).
  const dist = container.env.clientDistDir;
  if (fs.existsSync(path.join(dist, 'index.html'))) {
    app.use(express.static(dist, { index: false, maxAge: '1h' }));
    app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}
