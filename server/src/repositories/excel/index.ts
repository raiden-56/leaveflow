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
import { rangesOverlap } from '@leaveflow/shared';
import type { TableStore } from '../../excel/tableStore.js';
import type {
  IApprovalRepository,
  IEmployeeRepository,
  IHandoverRepository,
  ILeaveBalanceRepository,
  ILeaveRepository,
  INotificationRepository,
  ISettingsRepository,
  ITaskRepository,
  Repositories,
} from '../interfaces.js';
import { ExcelRepository } from './ExcelRepository.js';

export class ExcelEmployeeRepository extends ExcelRepository<Employee, 'employeeId'> implements IEmployeeRepository {
  constructor(store: TableStore) {
    super(store, 'Employees');
  }
  async findByEmail(email: string) {
    const target = email.trim().toLowerCase();
    return (await this.findWhere((e) => e.email.toLowerCase() === target))[0] ?? null;
  }
  findByManager(managerId: string) {
    return this.findWhere((e) => e.managerId === managerId);
  }
  findByDepartment(department: string) {
    return this.findWhere((e) => e.department === department);
  }
}

export class ExcelLeaveRepository extends ExcelRepository<LeaveRequest, 'leaveId'> implements ILeaveRepository {
  constructor(store: TableStore) {
    super(store, 'LeaveRequests');
  }
  findByEmployee(employeeId: string) {
    return this.findWhere((l) => l.employeeId === employeeId);
  }
  findOverlapping(employeeIds: string[] | null, startDate: string, endDate: string, statuses: readonly string[]) {
    const ids = employeeIds ? new Set(employeeIds) : null;
    return this.findWhere(
      (l) =>
        (!ids || ids.has(l.employeeId)) &&
        statuses.includes(l.status) &&
        rangesOverlap(l.startDate, l.endDate, startDate, endDate),
    );
  }
}

export class ExcelLeaveBalanceRepository
  extends ExcelRepository<LeaveBalance, 'balanceId'>
  implements ILeaveBalanceRepository
{
  constructor(store: TableStore) {
    super(store, 'LeaveBalances');
  }
  findFor(employeeId: string, year: number) {
    return this.findWhere((b) => b.employeeId === employeeId && b.year === year);
  }
  async findOne(employeeId: string, year: number, leaveType: string) {
    return (await this.findWhere((b) => b.employeeId === employeeId && b.year === year && b.leaveType === leaveType))[0] ?? null;
  }
}

export class ExcelHandoverRepository extends ExcelRepository<WorkHandover, 'handoverId'> implements IHandoverRepository {
  constructor(store: TableStore) {
    super(store, 'WorkHandovers');
  }
  async findByLeave(leaveId: string) {
    return (await this.findWhere((h) => h.leaveId === leaveId))[0] ?? null;
  }
  findByEmployee(employeeId: string) {
    return this.findWhere((h) => h.employeeId === employeeId);
  }
  findByBackup(backupEmployeeId: string) {
    return this.findWhere((h) => h.backupEmployeeId === backupEmployeeId);
  }
}

export class ExcelTaskRepository extends ExcelRepository<HandoverTask, 'taskId'> implements ITaskRepository {
  constructor(store: TableStore) {
    super(store, 'HandoverTasks');
  }
  findByHandover(handoverId: string) {
    return this.findWhere((t) => t.handoverId === handoverId);
  }
  findByHandovers(handoverIds: string[]) {
    const ids = new Set(handoverIds);
    return this.findWhere((t) => ids.has(t.handoverId));
  }
  async deleteByHandover(handoverId: string) {
    await this.store.transaction(async () => {
      const rows = this.rows();
      for (let i = rows.length - 1; i >= 0; i--) if (rows[i].handoverId === handoverId) rows.splice(i, 1);
    });
  }
}

export class ExcelApprovalRepository extends ExcelRepository<Approval, 'approvalId'> implements IApprovalRepository {
  constructor(store: TableStore) {
    super(store, 'Approvals');
  }
  findForEntity(entityType: string, entityId: string) {
    return this.findWhere((a) => a.entityType === entityType && a.entityId === entityId);
  }
}

export class ExcelNotificationRepository
  extends ExcelRepository<Notification, 'notificationId'>
  implements INotificationRepository
{
  constructor(store: TableStore) {
    super(store, 'Notifications');
  }
  findForRecipient(recipientId: string) {
    return this.findWhere((n) => n.recipientId === recipientId);
  }
  async markAllRead(recipientId: string, readAt: string) {
    return this.store.transaction(async () => {
      let count = 0;
      for (const n of this.rows()) {
        if (n.recipientId === recipientId && !n.isRead) {
          n.isRead = true;
          n.readAt = readAt;
          count++;
        }
      }
      return count;
    });
  }
}

export class ExcelSettingsRepository extends ExcelRepository<SettingRow, 'key'> implements ISettingsRepository {
  constructor(store: TableStore) {
    super(store, 'Settings');
  }
  async upsertMany(rows: SettingRow[]) {
    await this.store.transaction(async () => {
      const current = this.rows();
      for (const row of rows) {
        const existing = current.find((r) => r.key === row.key);
        if (existing) {
          existing.value = row.value;
          existing.description = row.description || existing.description;
        } else current.push({ ...row });
      }
    });
  }
}

export function createExcelRepositories(store: TableStore): Repositories {
  return {
    employees: new ExcelEmployeeRepository(store),
    leaves: new ExcelLeaveRepository(store),
    balances: new ExcelLeaveBalanceRepository(store),
    leaveTypes: new ExcelRepository<LeaveType, 'code'>(store, 'LeaveTypes'),
    holidays: new ExcelRepository<Holiday, 'holidayId'>(store, 'Holidays'),
    handovers: new ExcelHandoverRepository(store),
    tasks: new ExcelTaskRepository(store),
    approvals: new ExcelApprovalRepository(store),
    notifications: new ExcelNotificationRepository(store),
    departments: new ExcelRepository<Department, 'departmentId'>(store, 'Departments'),
    settings: new ExcelSettingsRepository(store),
    transactions: new ExcelRepository<LeaveTransaction, 'transactionId'>(store, 'LeaveTransactions'),
    audit: new ExcelRepository<AuditLog, 'auditId'>(store, 'AuditLog'),
  };
}
