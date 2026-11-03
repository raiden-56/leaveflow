import { randomUUID } from 'node:crypto';
import { WorkbookStore } from '../excel/workbookStore.js';
import { AuthService, DemoCredentialProvider } from '../services/authService.js';
import { buildSeed } from '../seed/seedData.js';
import { createServices, type Container } from './services.js';
import type { Env } from './env.js';

export type { Container } from './services.js';
/** The Node container also carries the full environment (CORS, static dir…). */
export type NodeContainer = Container & { env: Env };

/**
 * Node composition root. This is the ONLY place that knows the data provider.
 * To migrate to PostgreSQL, add createPostgresRepositories() + PrismaUnitOfWork
 * and select them here based on env.dataProvider — no service or route changes.
 */
export async function createContainer(env: Env, options: { clock?: () => Date; seed?: boolean } = {}): Promise<NodeContainer> {
  const runtime = { backupRetention: 30 };
  const store = new WorkbookStore({
    filePath: env.workbookPath,
    backupDir: env.backupDir,
    backupRetention: () => runtime.backupRetention,
  });
  await store.init(options.seed === false ? undefined : () => buildSeed(options.clock?.() ?? new Date()));

  const container = createServices({
    store,
    config: env,
    clock: options.clock,
    createAuth: (deps, audit) => new AuthService(deps, env, new DemoCredentialProvider(env.demoPassword || randomUUID()), audit),
    onSettingsChange: (s) => (runtime.backupRetention = s.backupRetentionCount),
  });
  runtime.backupRetention = (await container.settings.get()).backupRetentionCount;
  return container as NodeContainer;
}

