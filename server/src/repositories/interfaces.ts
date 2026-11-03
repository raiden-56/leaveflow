import type {
  Approval,
  AuditLog,
  Department,
  Employee,
  HandoverTask,
  Holiday,
  LeaveBalance,
  LeaveRequest,
  LeaveTransaction,
  LeaveType,
  Notification,
  SettingRow,
  WorkHandover,
} from '@leaveflow/shared';

/**
 * Persistence contracts. Services depend ONLY on these interfaces — never on
 * ExcelJS or a database client — so the Excel implementations in ./excel can be
 * swapped for PostgreSQL/Prisma implementations without touching business logic.
 */

export interface IRepository<T, K extends keyof T> {
  findAll(): Promise<T[]>;
  findById(id: T[K] & string): Promise<T | null>;
  findWhere(predicate: (item: T) => boolean): Promise<T[]>;
  /** Creates a record. When the id field is empty, an id is generated. */
  create(data: Omit<T, K> & Partial<Pick<T, K>>): Promise<T>;
  createMany(data: (Omit<T, K> & Partial<Pick<T, K>>)[]): Promise<T[]>;
  update(id: T[K] & string, patch: Partial<T>): Promise<T>;
  delete(id: T[K] & string): Promise<void>;
  count(predicate?: (item: T) => boolean): Promise<number>;
}

export interface IEmployeeRepository extends IRepository<Employee, 'employeeId'> {
  findByEmail(email: string): Promise<Employee | null>;
  findByManager(managerId: string): Promise<Employee[]>;
  findByDepartment(department: string): Promise<Employee[]>;
}

export interface ILeaveRepository extends IRepository<LeaveRequest, 'leaveId'> {
  findByEmployee(employeeId: string): Promise<LeaveRequest[]>;
  /** Leaves of the given employees (with the given statuses) overlapping a date range. */
  findOverlapping(employeeIds: string[] | null, startDate: string, endDate: string, statuses: readonly string[]): Promise<LeaveRequest[]>;
}

export interface ILeaveBalanceRepository extends IRepository<LeaveBalance, 'balanceId'> {
  findFor(employeeId: string, year: number): Promise<LeaveBalance[]>;
  findOne(employeeId: string, year: number, leaveType: string): Promise<LeaveBalance | null>;
}

export interface IHandoverRepository extends IRepository<WorkHandover, 'handoverId'> {
  findByLeave(leaveId: string): Promise<WorkHandover | null>;
  findByEmployee(employeeId: string): Promise<WorkHandover[]>;
  findByBackup(backupEmployeeId: string): Promise<WorkHandover[]>;
}

export interface ITaskRepository extends IRepository<HandoverTask, 'taskId'> {
  findByHandover(handoverId: string): Promise<HandoverTask[]>;
  findByHandovers(handoverIds: string[]): Promise<HandoverTask[]>;
  deleteByHandover(handoverId: string): Promise<void>;
}

export type ILeaveTypeRepository = IRepository<LeaveType, 'code'>;
export type IHolidayRepository = IRepository<Holiday, 'holidayId'>;
export type IDepartmentRepository = IRepository<Department, 'departmentId'>;
export type ILeaveTransactionRepository = IRepository<LeaveTransaction, 'transactionId'>;
export type IAuditRepository = IRepository<AuditLog, 'auditId'>;

export interface IApprovalRepository extends IRepository<Approval, 'approvalId'> {
  findForEntity(entityType: string, entityId: string): Promise<Approval[]>;
}

export interface INotificationRepository extends IRepository<Notification, 'notificationId'> {
  findForRecipient(recipientId: string): Promise<Notification[]>;
  markAllRead(recipientId: string, readAt: string): Promise<number>;
}

export interface ISettingsRepository extends IRepository<SettingRow, 'key'> {
  upsertMany(rows: SettingRow[]): Promise<void>;
}

/** Groups multiple repository writes into one atomic unit (Excel: one file write; SQL: one DB transaction). */
export interface IUnitOfWork {
  run<T>(work: () => Promise<T>): Promise<T>;
}

export interface Repositories {
  employees: IEmployeeRepository;
  leaves: ILeaveRepository;
  balances: ILeaveBalanceRepository;
  leaveTypes: ILeaveTypeRepository;
  holidays: IHolidayRepository;
  handovers: IHandoverRepository;
  tasks: ITaskRepository;
  approvals: IApprovalRepository;
  notifications: INotificationRepository;
  departments: IDepartmentRepository;
  settings: ISettingsRepository;
  transactions: ILeaveTransactionRepository;
  audit: IAuditRepository;
}
