import type { DataStore } from '../excel/tableStore.js';
import { ExcelUnitOfWork } from '../repositories/excel/ExcelRepository.js';
import { createExcelRepositories } from '../repositories/excel/index.js';
import type { IUnitOfWork, Repositories } from '../repositories/interfaces.js';
import { AuditService } from '../services/auditService.js';
import type { AppConfig, AuthProvider } from '../services/authProvider.js';
import { BalanceService } from '../services/balanceService.js';
import type { ServiceDeps } from '../services/context.js';
import { DashboardService } from '../services/dashboardService.js';
import { EmployeeService } from '../services/employeeService.js';
import { HandoverService } from '../services/handoverService.js';
import { LeaveService } from '../services/leaveService.js';
import { LifecycleService } from '../services/lifecycleService.js';
import { DepartmentService, HolidayService, LeaveTypeService } from '../services/masterDataService.js';
import { ConsoleEmailChannel, InAppChannel } from '../services/notifications/channels.js';
import { NotificationService } from '../services/notifications/notificationService.js';
import { ReportService } from '../services/reportService.js';
import { SettingsService } from '../services/settingsService.js';

export interface Container {
  env: AppConfig;
  store: DataStore;
  repos: Repositories;
  uow: IUnitOfWork;
  settings: SettingsService;
  audit: AuditService;
  notifications: NotificationService;
  balances: BalanceService;
  employees: EmployeeService;
  leaveTypes: LeaveTypeService;
  holidays: HolidayService;
  departments: DepartmentService;
  handovers: HandoverService;
  leaves: LeaveService;
  dashboards: DashboardService;
  reports: ReportService;
  lifecycle: LifecycleService;
  auth: AuthProvider;
}

export interface ServicesOptions {
  store: DataStore;
  config: AppConfig;
  clock?: () => Date;
  createAuth: (deps: ServiceDeps, audit: AuditService) => AuthProvider;
  onSettingsChange?: (s: Awaited<ReturnType<SettingsService['get']>>) => void;
}

/**
 * Wires repositories and services on top of any DataStore. Pure (no Node APIs),
 * so the same composition runs in Node and in the browser (static build).
 */
export function createServices({ store, config, clock, createAuth, onSettingsChange }: ServicesOptions): Container {
  const repos = createExcelRepositories(store);
  const uow = new ExcelUnitOfWork(store);
  const deps: ServiceDeps = { repos, uow, clock: clock ?? (() => new Date()) };

  const audit = new AuditService(deps);
  const settings = new SettingsService(deps, audit);
  if (onSettingsChange) settings.onChange(onSettingsChange);
  const notifications = new NotificationService(deps, settings, new InAppChannel(repos.notifications), [new ConsoleEmailChannel()]);
  const balances = new BalanceService(deps, settings, audit, notifications);
  const holidays = new HolidayService(deps, audit);
  const handovers = new HandoverService(deps, settings, audit, notifications);
  const leaves = new LeaveService(deps, settings, holidays, balances, handovers, notifications, audit);

  return {
    env: config,
    store,
    repos,
    uow,
    settings,
    audit,
    notifications,
    balances,
    employees: new EmployeeService(deps, audit),
    leaveTypes: new LeaveTypeService(deps, audit),
    holidays,
    departments: new DepartmentService(deps, audit),
    handovers,
    leaves,
    dashboards: new DashboardService(deps, settings, leaves, balances, handovers, holidays),
    reports: new ReportService(deps, settings, leaves),
    lifecycle: new LifecycleService(deps, settings, handovers, notifications),
    auth: createAuth(deps, audit),
  };
}
