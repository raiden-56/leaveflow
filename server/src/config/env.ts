import 'dotenv/config';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function resolveFromServer(p: string): string {
  return path.isAbsolute(p) ? p : path.resolve(serverRoot, p);
}

const nodeEnv = process.env.NODE_ENV ?? 'development';
const isProduction = nodeEnv === 'production';

let jwtSecret = process.env.JWT_SECRET ?? '';
if (!jwtSecret || jwtSecret === 'change-me-to-a-long-random-string') {
  if (isProduction) throw new Error('JWT_SECRET must be configured in production');
  // Ephemeral secret for local development: sessions reset on restart.
  jwtSecret = crypto.randomBytes(48).toString('hex');
}

const demoAuthEnabled = bool(process.env.DEMO_AUTH_ENABLED, !isProduction);
const demoPassword = process.env.DEMO_PASSWORD ?? (isProduction ? '' : 'LeaveFlow@2026');
if (demoAuthEnabled && !demoPassword) throw new Error('DEMO_PASSWORD must be set when DEMO_AUTH_ENABLED=true');

export const env = {
  nodeEnv,
  isProduction,
  isTest: nodeEnv === 'test',
  port: Number(process.env.PORT ?? 4000),
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5180')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '8h',
  authCookieName: 'lf_token',
  demoAuthEnabled,
  demoPassword,
  demoShowPasswordHint: bool(process.env.DEMO_SHOW_PASSWORD_HINT, true),
  dataProvider: (process.env.DATA_PROVIDER ?? 'excel') as 'excel',
  workbookPath: resolveFromServer(process.env.WORKBOOK_PATH ?? './data/LeaveFlow.xlsx'),
  backupDir: resolveFromServer(process.env.BACKUP_DIR ?? './data/backups'),
  uploadDir: resolveFromServer(process.env.UPLOAD_DIR ?? './uploads'),
  clientDistDir: path.resolve(serverRoot, '../client/dist'),
  serverRoot,
};

export type Env = typeof env;
