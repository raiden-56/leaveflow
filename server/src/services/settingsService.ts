import { DEFAULT_SETTINGS, SETTING_DESCRIPTIONS, type OrgSettings, type SettingRow, type SettingsInput } from '@leaveflow/shared';
import type { ServiceDeps, Actor } from './context.js';
import type { AuditService } from './auditService.js';

type Key = keyof OrgSettings;

function parseValue<K extends Key>(key: K, raw: string): OrgSettings[K] {
  const fallback = DEFAULT_SETTINGS[key];
  if (Array.isArray(fallback)) {
    const nums = raw
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
    return (nums.length ? nums : fallback) as OrgSettings[K];
  }
  if (typeof fallback === 'boolean') return (['true', '1', 'yes'].includes(raw.trim().toLowerCase())) as OrgSettings[K];
  if (typeof fallback === 'number') {
    const n = Number(raw);
    return (Number.isFinite(n) ? n : fallback) as OrgSettings[K];
  }
  return (raw || fallback) as OrgSettings[K];
}

export function settingsToRows(settings: OrgSettings): SettingRow[] {
  return (Object.keys(settings) as Key[]).map((key) => ({
    key,
    value: Array.isArray(settings[key]) ? (settings[key] as number[]).join(',') : String(settings[key]),
    description: SETTING_DESCRIPTIONS[key],
  }));
}

export class SettingsService {
  private readonly listeners: ((s: OrgSettings) => void)[] = [];

  constructor(
    private readonly deps: ServiceDeps,
    private readonly audit: AuditService,
  ) {}

  onChange(listener: (s: OrgSettings) => void): void {
    this.listeners.push(listener);
  }

  async get(): Promise<OrgSettings> {
    const rows = await this.deps.repos.settings.findAll();
    const map = new Map(rows.map((r) => [r.key, r.value]));
    const out = { ...DEFAULT_SETTINGS } as Record<Key, unknown>;
    for (const key of Object.keys(DEFAULT_SETTINGS) as Key[]) {
      const raw = map.get(key);
      if (raw !== undefined && raw !== '') out[key] = parseValue(key, raw);
    }
    return out as unknown as OrgSettings;
  }

  async update(input: SettingsInput, actor: Actor): Promise<OrgSettings> {
    const next = await this.deps.uow.run(async () => {
      const current = await this.get();
      const merged = { ...current, ...input } as OrgSettings;
      const before = new Map(settingsToRows(current).map((r) => [r.key, r.value]));
      const changed = settingsToRows(merged).filter((row) => row.value !== before.get(row.key));
      await this.deps.repos.settings.upsertMany(settingsToRows(merged));
      await this.audit.log(actor, 'SETTINGS_UPDATED', 'Settings', 'org', { changed: changed.map((c) => c.key) });
      return merged;
    });
    this.listeners.forEach((l) => l(next));
    return next;
  }
}
