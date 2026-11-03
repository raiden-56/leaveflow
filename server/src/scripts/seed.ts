/**
 * Generates the LeaveFlow workbook from demo data.
 *   npm run seed                      -> (re)creates server/data/LeaveFlow.xlsx (backs up the old one)
 *   npm run sample:excel              -> writes sample-data/LeaveFlow_Sample.xlsx
 */
import fs from 'node:fs';
import path from 'node:path';
import { env } from '../config/env.js';
import { buildWorkbook } from '../excel/workbookStore.js';
import { buildSeed } from '../seed/seedData.js';

const args = process.argv.slice(2);
const outIndex = args.indexOf('--out');
const target = outIndex >= 0 ? path.resolve(process.cwd(), args[outIndex + 1]) : env.workbookPath;
const force = args.includes('--force');

async function run() {
  if (fs.existsSync(target)) {
    if (!force) {
      console.error(`${target} already exists. Re-run with --force to overwrite.`);
      process.exit(1);
    }
    if (target === env.workbookPath) {
      fs.mkdirSync(env.backupDir, { recursive: true });
      const backup = path.join(env.backupDir, `LeaveFlow-before-reseed-${Date.now()}.xlsx`);
      fs.copyFileSync(target, backup);
      console.log(`Existing workbook backed up to ${backup}`);
    }
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const tables = buildSeed(new Date());
  await buildWorkbook(tables).xlsx.writeFile(target);
  const counts = Object.entries(tables).map(([k, v]) => `${k}: ${v.length}`).join(', ');
  console.log(`Workbook written to ${target}\n${counts}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
