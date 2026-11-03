# LeaveFlow architecture

## Layers

```
┌──────────────────────────── client (React) ────────────────────────────┐
│ features/* pages  →  RTK Query hooks (app/store/api.ts)                 │
│                   →  services/repositories/* (the only code that knows  │
│                      URLs)  →  services/api/httpClient.ts (Axios)       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ REST /api (JSON, httpOnly JWT cookie)
┌───────────────────────────────────▼──────────── server (Express) ──────┐
│ routes → middleware (auth, RBAC, validation, errors) → controllers     │
│        → services (business rules, workflow, notifications, audit)     │
│        → repositories (interfaces)  ← ExcelXxxRepository (today)       │
│                                     ← PostgresXxxRepository (future)   │
│        → WorkbookStore (ExcelJS, mutex, backups, atomic writes)        │
└────────────────────────────────────────────────────────────────────────┘
          shared/ – types, Zod schemas, date & policy rules (both sides)
```

- **UI components never call Axios**. Pages use RTK Query hooks. Each hook calls a repository function in `client/src/services/repositories`. Swapping the backend, or adding offline caching, only touches that folder.
- **Validation is defined once** in `shared/src/schemas.ts`. React Hook Form uses the schemas via `zodResolver`, and the API uses them to parse request bodies, so the rules can't drift apart.
- **Business rules are pure and shared** in `shared/src/dates.ts` and `shared/src/policy.ts`: working-day calculation, balance maths, status state machines and handover activation. Both sides use them, and they are unit-tested.

## Repository pattern & PostgreSQL readiness

`server/src/repositories/interfaces.ts` defines the persistence contracts:

| Interface | Excel implementation (today) | Future |
|---|---|---|
| `IEmployeeRepository` | `ExcelEmployeeRepository` | `PostgresEmployeeRepository` |
| `ILeaveRepository` | `ExcelLeaveRepository` | `PostgresLeaveRepository` |
| `ILeaveBalanceRepository` | `ExcelLeaveBalanceRepository` | `PostgresLeaveBalanceRepository` |
| `IHandoverRepository` | `ExcelHandoverRepository` | `PostgresHandoverRepository` |
| `ITaskRepository` | `ExcelTaskRepository` | `PostgresTaskRepository` |
| `IApprovalRepository`, `INotificationRepository`, `ISettingsRepository`, `ILeaveTypeRepository`, `IHolidayRepository`, `IDepartmentRepository`, `ILeaveTransactionRepository`, `IAuditRepository` | generic `ExcelRepository<T>` subclasses | Prisma equivalents |
| `IUnitOfWork` | `ExcelUnitOfWork` (one atomic workbook write) | `prisma.$transaction` |

Services receive `{ repos, uow, clock }` (`ServiceDeps`) and **never import ExcelJS**. `server/src/config/container.ts` is the composition root and the only place that picks the provider.

**Migration steps:**
1. Write a Prisma schema that mirrors the sheet definitions in `server/src/excel/schema.ts`. Column names already map 1:1 to fields.
2. Implement `createPostgresRepositories(prisma)` and a `PrismaUnitOfWork`. Run the unit of work inside `prisma.$transaction` and use `AsyncLocalStorage` to hand the transaction client to repositories, the same way the Excel store does.
3. Select them in `createContainer` when `DATA_PROVIDER=postgres`.
4. Import existing data by reading the workbook with `WorkbookStore` and inserting rows (IDs are stable strings).

No controller, service, route or frontend change is needed.

## Excel workbook

### Storage engine: `WorkbookStore` (`server/src/excel/workbookStore.ts`)

- **Schema-driven.** Every sheet and column is declared once in `excel/schema.ts`, with type, width and enum values. Columns are matched by header name, so re-ordering columns in Excel is safe. Values are coerced on read: Excel dates and `DD/MM/YYYY` become ISO dates, and `TRUE`/`yes` become booleans.
- **In-memory snapshot + transactions.** Reads come from the last committed snapshot. Writes run in `transaction()`, which:
  1. acquires a FIFO **mutex**, so concurrent HTTP requests never interleave writes;
  2. works on a private copy of the tables, passed through `AsyncLocalStorage`; nested calls join the same transaction;
  3. if anything changed, **backs up** the current file to `data/backups/` (rotated, `backupRetentionCount`);
  4. writes to a temp file and **atomically renames** it over the workbook, retrying briefly on transient Windows locks;
  5. commits the in-memory snapshot only after the file is on disk.

  If anything throws, nothing is persisted and the snapshot is untouched. A half-written workbook is impossible.
- **External edits.** Reads check the file's mtime at most every 2 s and reload when someone saved the file in Excel.
- **Locked file.** If Excel holds a lock, the API answers `423 RESOURCE_LOCKED` with a clear message.
- **IDs.** Sequential prefixed IDs are generated inside the write lock (`EMP001`, `LV0001`, `HO0001`, `TSK0001`, `NTF00001`…), so they are always unique.
- **Excel-side validation.** List validation for enums and booleans, and numeric validation, so manual edits stay consistent.

### Sheets

| Sheet | Key | Columns |
|---|---|---|
| Employees | employeeId | employeeName, email, phone, department, designation, managerId, joiningDate, employmentStatus, role, profileImage, workMode, location |
| LeaveRequests | leaveId | employeeId, leaveType, startDate, endDate, totalDays, halfDay (`NONE`/`FIRST_HALF`/`SECOND_HALF`), reason, appliedDate, status, approverId, approvalDate, rejectionReason, managerComment, emergencyContact, contactDuringLeave, attachmentName, attachmentUrl, updatedAt |
| LeaveBalances | balanceId | employeeId, year, leaveType, allocated, carriedForward, adjusted, used, pending |
| LeaveTypes | code | name, description, annualAllocation, isPaid, trackBalance, allowHalfDay, allowCarryForward, maxCarryForward, maxConsecutiveDays, minNoticeDays, backdatedDays, requiresApproval, requiresAttachmentAfterDays, excludeWeekendsAndHolidays, color, isActive, includeInTotals |
| Holidays | holidayId | holidayName, holidayDate, holidayType (`PUBLIC`/`OPTIONAL`/`COMPANY`), description |
| WorkHandovers | handoverId | leaveId, employeeId, backupEmployeeId, handoverTitle, handoverDescription, startDate, endDate, priority, instructions, handoverStatus, acceptedDate, declineReason, completionStatus (% of tasks done), createdAt, completedDate |
| HandoverTasks | taskId | handoverId, taskTitle, taskDescription, priority, dueDate, assignedEmployeeId, taskStatus, comments, referenceLinks, expectedOutcome, notes, createdAt, updatedAt |
| Approvals | approvalId | entityType (`LEAVE`/`HANDOVER`), entityId, action, actorId, comment, createdAt. This is the workflow history |
| Notifications | notificationId | recipientId, type, title, message, entityType, entityId, link, isRead, createdAt, readAt |
| Departments | departmentId | departmentName, headId, description, color |
| Settings | key | value, description (typed by `SettingsService`) |
| LeaveTransactions | transactionId | employeeId, leaveType, year, transactionType, days, leaveId, reason, performedBy, createdAt. This is the balance ledger |
| AuditLog | auditId | timestamp, actorId, action, entityType, entityId, details (JSON) |

> **Design note: leave balances.** The brief suggested one wide row per employee (`annualLeave`, `sickLeave`, …). Because HR can **create new leave types**, balances are stored in a normalised form instead: one row per employee × year × leave type, with allocated, carried forward, adjusted, used and pending. The fixed-column layout would need a schema change for every new type. The UI and exports still present per-type balances. *Available = allocated + carriedForward + adjusted − used − pending.*

Dates are stored as ISO text (`YYYY-MM-DD`) and timestamps as ISO-8601. This avoids Excel timezone shifts and keeps the file readable. "Today" is computed in the organisation timezone (`Settings.timezone`, default `Asia/Kolkata`).

## Business rules

**Leave validation** (`LeaveService.evaluate`, also exposed as the live preview `POST /api/leaves/preview`):
- the leave type exists and is active; half days are allowed and only for single-day leave;
- chargeable days exclude weekends (configurable working days) and public/company holidays. Optional holidays still count. Maternity leave counts calendar days;
- no past dates beyond `backdatedDays`; the minimum notice and maximum consecutive days are enforced;
- **no overlap** with the employee's own pending, approved or changes-requested leave;
- balance sufficiency, with a reserved-days credit when editing; an attachment is required above N days.

**Handover validation** (`HandoverService.checkAssignment`):
- the backup can't be yourself, must be active, and **must not be on approved leave** during the period (pending leave produces a warning);
- the handover period must cover the leave period;
- task assignees must be active and can't be the applicant;
- overload warning once the backup holds more than `backupOverloadThreshold` overlapping handovers.

**Workflow state machines** (`shared/src/policy.ts`):

```
Leave:     PENDING → APPROVED | REJECTED | CHANGES_REQUESTED | CANCELLED
           CHANGES_REQUESTED → PENDING (edit & resubmit) | CANCELLED
           APPROVED → CANCELLED (future leave, or HR any time)
Handover:  PENDING_ACCEPTANCE → ACCEPTED | DECLINED
           ACCEPTED + leave APPROVED → ACTIVE → COMPLETED (manual or auto after return)
           DECLINED → PENDING_ACCEPTANCE (employee picks a new backup)
           leave REJECTED/CANCELLED → CANCELLED
```

**Balance movements** (`BalanceService`, every movement logged in `LeaveTransactions`):

| Event | Movement |
|---|---|
| apply | pending += days |
| approve | pending −= days; used += days |
| reject / cancel while pending | pending −= days |
| cancel approved leave | used −= days |
| HR adjustment / comp-off | adjusted ± days |
| year-end rollover | next year allocation + capped carry-forward |

**Approver resolution:** the reporting manager, or else an HR admin. Admins can decide on anyone's leave; self-approval is blocked unless `allowSelfApprovalForAdmins` is on. If `requireHandoverAcceptanceBeforeApproval` is on, approval is blocked until the backup accepts.

## Notifications

`NotificationService` sends to pluggable `NotificationChannel`s. `InAppChannel` writes to the Notifications sheet. `ConsoleEmailChannel` is a placeholder used when `notifyEmail` is on; replace it with SMTP or SES. The UI polls every `notificationPollSeconds` (RTK Query `pollingInterval`). To move to real-time, add a WebSocket/SSE channel and invalidate the `Notification` tag on push.

## Authentication

- `POST /api/auth/login` checks credentials through a `CredentialProvider`. The demo provider compares against `DEMO_PASSWORD` using a constant-time SHA-256 comparison, and returns the same error for an unknown user or a wrong password.
- It issues a JWT (`sub`, `role`, 8 h) in an **httpOnly, SameSite=Strict** cookie (`Secure` in production). There is no token in localStorage. `Authorization: Bearer` is also accepted for API clients.
- Every request re-loads the employee, so deactivation and role changes take effect immediately.
- RBAC is applied twice: route guards (`authorize('ADMIN')`) and resource checks inside services (owner, manager-of, backup).
- Login is rate-limited (20 per 15 min per IP). Helmet sets security headers, and JSON bodies are capped at 1 MB. Uploads are type- and size-restricted (5 MB), stored under random names, and served only to authenticated users.

For production, implement `CredentialProvider` against a real store with salted password hashes (e.g. a `credentials` table with argon2), or replace login with SSO/OIDC. Keep credentials out of the workbook.

## Error handling

Every error leaves the API as `{ "error": { "code", "message", "details?" } }` with the right status: 401, 403, 404, 409, 422 validation (Zod issues or business-rule errors in `details.errors`), 423 locked workbook, 500. The client's `httpClient` normalises these into `ApiError`. A 401 triggers "session expired" and a redirect to login, and toasts show the server message.

## Testing

- `shared/src/__tests__`: working days, weekends, holidays, half days, timezones, balance maths, state machines, schemas.
- `server/tests/leaveWorkflow.test.ts`: real temporary workbook with a fixed clock. Covers overlap, self-backup, a backup on leave, insufficient balance, past dates, mandatory handover, the full apply → accept → approve → active → auto-complete flow, RBAC, reject / request changes / cancel balance effects, persistence round-trip, concurrent writes, rollback and backups.
- `server/tests/api.test.ts`: auth, httpOnly cookie, validation error shape, RBAC per route, dashboards, Excel export.
