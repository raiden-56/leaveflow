import { env } from './config/env.js';
import { createContainer } from './config/container.js';
import { createApp } from './app.js';
import { logger } from './utils/logger.js';

async function main() {
  const container = await createContainer(env);
  const app = createApp(container);
  container.lifecycle.start();

  const server = app.listen(env.port, () => {
    logger.info(`LeaveFlow API listening on http://localhost:${env.port}`);
    logger.info(`Data provider: ${env.dataProvider} → ${env.workbookPath}`);
    if (env.demoAuthEnabled) logger.info('Demo authentication is ENABLED (set DEMO_AUTH_ENABLED=false in production)');
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    logger.error(err.code === 'EADDRINUSE' ? `Port ${env.port} is already in use. Stop the other process or set PORT.` : 'Server error', err);
    process.exit(1);
  });

  const shutdown = (signal: string) => {
    logger.info(`${signal} received, shutting down`);
    container.lifecycle.stop();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error('Failed to start server', err);
  process.exit(1);
});
