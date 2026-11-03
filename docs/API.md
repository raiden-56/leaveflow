# LeaveFlow REST API

Base URL: `http://localhost:4000/api` (proxied as `/api` by the Vite dev server).

- **Auth:** `POST /auth/login` sets an httpOnly cookie `lf_token`. Browser requests send it automatically (`withCredentials`). API clients may send `Authorization: Bearer <jwt>` instead.
- **Content type:** JSON, except file uploads (`multipart/form-data`, field `file`) and Excel downloads (`.xlsx`).
- **Dates** are `YYYY-MM-DD`; timestamps are ISO-8601.
- **Errors** always look like this:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Overlaps with your pending leave LV0032 (2026-11-17 → 2026-11-23)", "details": { "errors": ["…"] } } }
```

| Status | Code | Meaning |
|---|---|---|
| 400 | BAD_REQUEST / UPLOAD_ERROR / BAD_JSON | malformed request |
| 401 | UNAUTHORIZED | not signed in / session expired / bad credentials |
| 403 | FORBIDDEN | role or ownership check failed |
| 404 | NOT_FOUND | unknown entity or route |
| 409 | CONFLICT | duplicate (email, leave type code, holiday) |
| 422 | VALIDATION_ERROR | schema or business-rule violation (`details.errors` / `details.issues`) |
| 423 | RESOURCE_LOCKED | the workbook is open/locked in another program |
| 429 | – | too many login attempts |

Roles: **E** = any signed-in employee, **M** = MANAGER or ADMIN, **A** = ADMIN. Resource-level rules (owner, reporting manager, backup) are enforced in addition.

---

## Authentication

| Method | Path | Role | Body / Query | Returns |
|---|---|---|---|---|
| POST | `/auth/login` | public | `{ email, password }` | `{ user }` and sets the cookie |
| POST | `/auth/logout` | public | – | `{ success }` and clears the cookie |
| GET | `/auth/me` | E | – | `{ user, settings }` |
| GET | `/auth/demo-accounts` | public | – | `{ enabled, accounts[], passwordHint }` |
| GET | `/health` | public | – | `{ status, provider, time }` |

## Dashboards

| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/dashboard/employee` | E | balances, totals, upcoming & recent leave, handover stats, next holiday |
| GET | `/dashboard/manager` | M | cards, pending approvals, upcoming leave, team workload, 6-month trend |
| GET | `/dashboard/admin` | A | KPIs, department/type distribution, monthly trend, on leave today |
| GET | `/team/availability?date=&department=` | E | available / on leave / remote / upcoming (30 days) for the visible team |

## Employees

| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/employees?search=&department=&role=&status=&managerId=&includeInactive=` | E | employees see their department; managers see their reports |
| GET | `/employees/:id` | E | |
| POST | `/employees` | A | `EmployeeInput` |
| PUT | `/employees/:id` | A | `EmployeeInput`; validates manager role and reporting cycles |
| DELETE | `/employees/:id` | A | **soft delete** (status `INACTIVE`); blocked while the employee has direct reports |
| GET | `/employees/export` | A | `.xlsx` |
| POST | `/employees/import` | A | multipart `file` (.xlsx with the export's columns); upsert by email → `{ created, updated, errors[] }` |

`EmployeeInput`: `employeeName, email, phone?, department, designation, managerId?, joiningDate, employmentStatus, role, profileImage?, workMode, location?`

## Leaves

| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/leaves?scope=mine\|team\|approvals\|all&status=&leaveType=&department=&employeeId=&from=&to=&search=&page=&pageSize=` | E (team/approvals: M, all: A) | enriched `LeaveRequestView[]` (or a paginated object when `page` + `pageSize` are given) |
| GET | `/leaves/:id` | owner, approver, backup, A | `LeaveDetails` = view + `history[]` + `insights` (warnings, overlapping team leave, balance) |
| POST | `/leaves/preview` | E | `{ leaveType, startDate, endDate, halfDay, excludeLeaveId? }` → `{ totalDays, days[], balance, errors[], warnings[] }` |
| POST | `/leaves` | E | `LeaveApplicationInput` → 201 `LeaveDetails`. Creates the leave, handover, tasks, balance reservation, approval record and notifications |
| PUT | `/leaves/:id` | owner | edit & resubmit (status `PENDING` or `CHANGES_REQUESTED`) |
| DELETE | `/leaves/:id` · POST `/leaves/:id/cancel` | owner / A | cancel; body `{ reason? }` |
| POST | `/leaves/:id/approve` | M (approver) | `{ comment? }` |
| POST | `/leaves/:id/reject` | M (approver) | `{ comment }` (min 5 chars) |
| POST | `/leaves/:id/request-changes` | M (approver) | `{ comment }` |
| GET | `/leaves/calendar?from=&to=&department=&leaveType=&employeeId=&includePending=` | E | `{ events: CalendarLeaveEvent[], holidays[] }` (no reasons) |
| POST | `/leaves/attachments` | E | multipart `file` (pdf/png/jpg/doc/docx ≤ 5 MB) → `{ attachmentName, attachmentUrl }` |
| GET | `/leaves/export?…same filters…` | E | `.xlsx` leave history |
| GET | `/uploads/:file` | E | download an attachment |

`LeaveApplicationInput`:

```json
{
  "leaveType": "CL",
  "startDate": "2026-12-01",
  "endDate": "2026-12-02",
  "halfDay": "NONE",
  "reason": "Family function",
  "emergencyContact": "Raj Sharma +91 98…",
  "contactDuringLeave": "",
  "attachmentName": "",
  "attachmentUrl": "",
  "handover": {
    "backupEmployeeId": "EMP010",
    "handoverTitle": "Payments API ownership",
    "handoverDescription": "Review PRs and watch reconciliation alerts",
    "startDate": "2026-12-01",
    "endDate": "2026-12-02",
    "priority": "HIGH",
    "instructions": "Runbooks are in Confluence",
    "tasks": [
      { "taskTitle": "Merge PR #418", "taskDescription": "", "priority": "HIGH", "dueDate": "2026-12-01",
        "assignedEmployeeId": "", "referenceLinks": "https://…", "expectedOutcome": "", "notes": "" }
    ]
  }
}
```

`assignedEmployeeId` defaults to the backup. When editing, include `taskId` for tasks you keep; omitted tasks are deleted.

## Leave balances

| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/leave-balances?year=` | A | all active employees × leave types |
| GET | `/leave-balances/:employeeId?year=` | self, manager, A | `LeaveBalanceView[]` (`total`, `available` computed) |
| PUT | `/leave-balances/:employeeId` | A | adjustment `{ leaveType, days (±, half-day steps), reason, year? }` |
| POST | `/leave-balances/:employeeId/comp-off` | A | `{ days, workedOn, reason }` |
| GET | `/leave-balances/:employeeId/transactions?year=` | self, manager, A | ledger |
| POST | `/leave-balances/year-end` | A | `{ year }` creates next-year rows with policy-capped carry-forward |
| GET | `/leave-balances/export?year=` | A | `.xlsx` |

## Work handovers & tasks

| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/handovers?scope=created\|assigned\|team\|all&status=&priority=&employeeId=&from=&to=&search=` | E | `WorkHandoverView[]` with tasks |
| GET | `/handovers/candidates?startDate=&endDate=&excludeLeaveId=` | E | backup candidates with availability, open handovers/tasks and overload flag |
| GET | `/handovers/:id` | owner, backup, manager, A | |
| POST | `/handovers` | owner | `{ leaveId, ...HandoverInput }` adds a handover to an existing leave |
| PUT | `/handovers/:id` | owner | `HandoverInput`; changing the backup restarts acceptance |
| POST | `/handovers/:id/accept` | backup | `{ comment? }`; becomes `ACTIVE` immediately if the leave is approved |
| POST | `/handovers/:id/decline` | backup | `{ comment }` |
| POST | `/handovers/:id/complete` | owner, backup, manager, A | `ACTIVE → COMPLETED` |
| GET | `/handovers/:id/tasks` | as handover | |
| POST | `/handovers/:id/tasks` | owner, backup, manager | `HandoverTaskInput` |
| GET | `/handovers/tasks?scope=mine\|team\|all&status=&priority=&assigneeId=&overdue=` | E | task board |
| PUT | `/handovers/tasks/:taskId` | assignee/backup (status & comments only), owner/manager (all fields) | `TaskUpdateInput` |
| DELETE | `/handovers/tasks/:taskId` | owner, manager | |

## Master data

| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/leave-types` | E | all types (incl. inactive) |
| POST / PUT / DELETE | `/leave-types[/:code]` | A | delete deactivates types that are referenced by requests → `{ deactivated }` |
| GET | `/holidays?year=` | E | |
| POST / PUT / DELETE | `/holidays[/:id]` | A | |
| POST | `/holidays/import` | A | multipart `.xlsx` with `holidayName, holidayDate, holidayType, description` |
| GET | `/departments` | E | with `employeeCount`, `headName` |
| POST / PUT / DELETE | `/departments[/:id]` | A | rename cascades to employees; delete blocked while it has active employees |

## Notifications

| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/notifications?unreadOnly=&limit=` | E | `{ items, unread, total }` |
| PUT | `/notifications/:id/read` | recipient | |
| PUT | `/notifications/read-all` | E | `{ updated }` |
| DELETE | `/notifications/:id` | recipient | |

## Reports

All accept `from, to, department, employeeId, leaveType`. They default to the current calendar year. Managers see their team; admins see everyone.

| Method | Path | Role |
|---|---|---|
| GET | `/reports/leave-summary` | M |
| GET | `/reports/department-summary` | M |
| GET | `/reports/handover-summary` | M |
| GET | `/reports/export` | M (multi-sheet `.xlsx`: monthly, employee, department, type, pending, handovers, completion) |

## Settings & system

| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/settings` | E | `OrgSettings` |
| PUT | `/settings` | A | partial `OrgSettings` |
| GET | `/system/workbook` | A | path, size, sheet row counts, backups |
| POST | `/system/workbook/backup` | A | manual backup |
| GET | `/system/workbook/download` | A | current workbook |
| GET | `/system/workbook/backups/:fileName` | A | download a backup |
| GET | `/system/audit-logs?entityType=&actorId=&limit=` | A | |
| POST | `/system/lifecycle/run` | A | run reminders / auto-complete / overdue checks now |

## Example session (curl)

```bash
curl -c jar -H "Content-Type: application/json" \
  -d '{"email":"priya.sharma@leaveflow.demo","password":"LeaveFlow@2026"}' \
  http://localhost:4000/api/auth/login

curl -b jar -H "Content-Type: application/json" \
  -d '{"leaveType":"CL","startDate":"2026-12-01","endDate":"2026-12-02"}' \
  http://localhost:4000/api/leaves/preview
```
