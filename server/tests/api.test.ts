import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { env } from '../src/config/env.js';
import { createContainer } from '../src/config/container.js';
import { createApp } from '../src/app.js';

let dir: string;
let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'leaveflow-api-'));
  const container = await createContainer({ ...env, isTest: true, workbookPath: path.join(dir, 'wb.xlsx'), backupDir: path.join(dir, 'b') }, { clock: () => new Date('2026-11-03T06:00:00Z') });
  app = createApp(container);
});
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

async function login(email: string) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ email, password: env.demoPassword });
  expect(res.status).toBe(200);
  expect(res.headers['set-cookie']?.[0]).toMatch(/HttpOnly/i);
  return agent;
}

describe('REST API', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await request(app).get('/api/leaves');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects bad credentials without revealing which part was wrong', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'priya.sharma@leaveflow.demo', password: 'nope' });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Invalid email or password');
  });

  it('validates request bodies with a consistent error shape', async () => {
    const agent = await login('priya.sharma@leaveflow.demo');
    const res = await agent.post('/api/leaves').send({ leaveType: 'CL', startDate: 'tomorrow' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('enforces role-based access', async () => {
    const employee = await login('priya.sharma@leaveflow.demo');
    expect((await employee.get('/api/dashboard/admin')).status).toBe(403);
    expect((await employee.get('/api/leaves?scope=all')).status).toBe(403);
    const manager = await login('rohan.mehta@leaveflow.demo');
    expect((await manager.get('/api/dashboard/manager')).status).toBe(200);
    expect((await manager.post('/api/employees').send({})).status).toBe(403);
    const admin = await login('ananya.iyer@leaveflow.demo');
    const dash = await admin.get('/api/dashboard/admin');
    expect(dash.status).toBe(200);
    expect(dash.body.cards.totalEmployees).toBe(20);
  });

  it('returns dashboard values computed from the workbook', async () => {
    const agent = await login('priya.sharma@leaveflow.demo');
    const res = await agent.get('/api/dashboard/employee');
    expect(res.status).toBe(200);
    expect(res.body.balances.length).toBeGreaterThan(5);
    expect(res.body.totals.pendingRequests).toBeGreaterThanOrEqual(1);
  });

  it('exports Excel files', async () => {
    const admin = await login('ananya.iyer@leaveflow.demo');
    const res = await admin.get('/api/reports/export').buffer(true);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');
  });
});
