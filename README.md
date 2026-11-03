# LeaveFlow – Employee Leave & Work Handover Management Portal

LeaveFlow is a full-stack leave management portal with one rule at its centre: **every leave request names a backup colleague and hands over the work**. Employees apply for leave and hand over their work in a single flow. Managers approve with full visibility of coverage. HR configures policies, balances and holidays.

The initial version stores **all data in an Excel workbook**. The workbook sits behind a repository layer, so it can later be swapped for PostgreSQL + Prisma without touching the UI or business rules.

| | |
|---|---|
| **Frontend** | React 19 · Vite 7 · TypeScript · MUI 7 · MUI X Date Pickers · Redux Toolkit (RTK Query) · React Router 7 · React Hook Form + Zod · Framer Motion · Recharts · FullCalendar · Day.js · Axios · Lucide |
| **Backend** | Node.js · Express 5 · TypeScript · ExcelJS · JWT (httpOnly cookie) · Zod · Helmet · rate limiting · Multer |
| **Shared** | `@leaveflow/shared`: domain types, Zod schemas and business rules used by **both** client and server |
| **Tests** | Vitest (unit + integration against a real temporary workbook) · Supertest (REST API) |

## Live demo (GitHub Pages)

**https://raiden-56.github.io/leaveflow/**

GitHub Pages only serves static files, so the Pages build (`npm run build:pages -w client`, deployed by `.github/workflows/deploy-pages.yml` on every push to `main`) runs **the same API inside the browser**. It uses the same route table, controllers, services, validation and Excel repositories as the Node server, with two swaps:
- **Storage:** a `BrowserStore`. The workbook is kept in the visitor's localStorage, and HR can download it as a real `.xlsx` from **Settings → Excel workbook**.
- **Auth:** demo-persona login only (`client/src/services/local`).

Each visitor gets their own copy of the demo data; use **Reset data** on the login page to start over. Run the full Node + Excel-file version locally as described below.

---

## Quick start

Requirements: **Node.js 20+** (tested on Node 24) and npm 10+.

```bash
npm install
```

```bash
npm run dev
```

- Web app: http://localhost:5180
- API: http://localhost:4000/api. Vite proxies `/api`, so the auth cookie works same-origin.

When the API starts for the first time it creates `server/data/LeaveFlow.xlsx` with realistic demo data. If you skip it, `server/.env` falls back to safe development defaults. Copy `server/.env.example` to `server/.env` to change ports, secrets or paths.

### Demo accounts

Every **active** employee in the workbook can sign in with the demo password set in `server/.env` (`DEMO_PASSWORD`, default `LeaveFlow@2026`). The login screen offers one-click demo accounts:

| Role | Name | Email |
|---|---|---|
| Employee | Priya Sharma (Senior Software Engineer) | `priya.sharma@leaveflow.demo` |
| Manager | Rohan Mehta (Engineering Manager) | `rohan.mehta@leaveflow.demo` |
| HR Admin | Ananya Iyer (HR Director) | `ananya.iyer@leaveflow.demo` |

Other useful accounts: Meera Pillai (`meera.pillai@…`) is Priya's typical backup, Neha Gupta (`neha.gupta@…`) manages Product Design, and Amit Patel (`amit.patel@…`) manages Sales & Marketing.

> Demo authentication is for evaluation only. Set `DEMO_AUTH_ENABLED=false` and plug in a real `CredentialProvider` (see [Architecture](docs/ARCHITECTURE.md#authentication)) before production use. Passwords are never stored in the Excel workbook.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | API (tsx watch) + web app (Vite) together |
| `npm test` | Shared unit tests + server integration/API tests |
| `npm run typecheck` | Strict TypeScript check of all three packages |
| `npm run build` | Production build of the web app (`client/dist`) |
| `npm run build:pages -w client` | Static GitHub Pages build (API runs in the browser) |
| `npm start` | Start the API. It also serves `client/dist` when that folder exists (single-port production mode) |
| `npm run seed` | Re-create `server/data/LeaveFlow.xlsx` from demo data. The previous file is backed up first |
| `npm run sample:excel` | Regenerate `sample-data/LeaveFlow_Sample.xlsx` |

---

## Sample Excel workbook

[`sample-data/LeaveFlow_Sample.xlsx`](sample-data/LeaveFlow_Sample.xlsx) is a ready-made copy of the data store. It has 20 employees, 4 departments, 3 managers, 1 HR admin, 11 leave types, 2026–2027 Indian holidays, 40 leave requests, 40 handovers with 89 tasks, balances, approvals, notifications and settings.

Every sheet has a styled, frozen header row with auto-filter, and drop-down validation on status/enum/boolean columns. Leave dates are generated **relative to the day the workbook is created**, so a fresh install always has people on leave today, upcoming leave and pending approvals.

You can open `server/data/LeaveFlow.xlsx` in Excel, edit it, and save. The API notices the change on disk and reloads it. Close Excel before using the app to modify data: Windows locks open files, and the API will report `423 Workbook is locked` instead of corrupting it.

Full sheet/column reference: [docs/ARCHITECTURE.md → Excel workbook](docs/ARCHITECTURE.md#excel-workbook).

---

## What's inside

### Employee
- **Dashboard**: personalised welcome, balance cards (total/annual/sick/casual/taken/pending) with progress, upcoming leave, recent requests, work-handover overview, team availability and a two-week team timeline.
- **Apply leave**: a four-step wizard.
  1. Leave details with live server-side preview: working days excluding weekends and holidays, half days, balance after the request, overlap, notice, backdating, maximum consecutive days and attachment rules, plus a calendar preview.
  2. **Mandatory work handover**: backup picker showing availability, current workload and overload warnings.
  3. **Handover tasks**: add, edit, duplicate and remove; each with priority, due date, assignee, reference links, expected outcome and notes.
  4. Review & submit.
- **My leaves**: history with status tabs, filters, CSV/Excel export, and a detail drawer with the approval timeline. You can edit & resubmit after "changes requested" or cancel.
- **Work handovers**: handovers created by me or assigned to me. Accept/decline, update task status, add progress comments, mark completed.
- **Leave calendar** (month/week/day/list), **team availability**, **notification centre**, **profile & preferences** (incl. dark mode).

### Manager
- **Dashboard**: team KPIs, pending approvals, upcoming leave, team workload (overloaded backups), leave trend, team timeline.
- **Leave approvals**: approve, reject, request changes or view details. Risk flags for overlapping team leave, a backup who is unavailable or hasn't accepted, a declined handover, and critical tasks without an owner. Server-side insights appear in the drawer before deciding.
- **Team calendar** with department/employee/leave-type filters, **handover tasks** board, **reports**.

### HR / Admin
- **Analytics dashboard**: headcount, leave taken, approvals, department distribution, monthly trend, leave-type mix, handover completion rate.
- **Employees**: CRUD, deactivate, assign manager and role, **import/export Excel**.
- **Leave management**: all requests plus **leave balances**. Adjust balances, credit comp-offs, view the transaction ledger, export, and run the year-end carry-forward rollover.
- **Leave policies**: create and edit leave types: allocation, carry forward, max consecutive days, notice, backdating, half-day, paid/unpaid, attachment rules, weekend/holiday exclusion, enable/disable. Departments are managed here too.
- **Holidays**: list and annual calendar views, CRUD, Excel import.
- **Settings**: organisation, working days, timezone, approval rules, notification preferences. Workbook tools cover file info, backups, download, the lifecycle job and the audit log.

### Workflow automation (lifecycle job)
This job runs at start-up and every 30 minutes, and HR can also trigger it from Settings. It:
- reminds the employee and the backup the day before leave starts;
- auto-completes handovers once the employee is back, sending "employee returned" notifications;
- notifies assignees about overdue handover tasks.

All notifications are de-duplicated.

---

## Responsive & accessible
- Desktop: collapsible sidebar, multi-column dashboards, full tables. Tablet: drawer navigation, two-column cards. Mobile: bottom navigation with badges, a floating "Apply leave" button, tables rendered as cards, and full-screen dialogs instead of drawers.
- Checked in the browser at 1440 px and 375 px. Breakpoints cover 1920 → 375 px.
- Respects `prefers-reduced-motion`: Framer Motion uses `reducedMotion="user"`, and CSS transitions are disabled globally.
- Keyboard focus styles, aria labels on icon buttons, a polite live region for toasts.

## Documentation
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): layers, repository pattern, Excel store, security, migration to PostgreSQL.
- [docs/API.md](docs/API.md): REST API reference.

## Project layout
```
leave-management/
├─ shared/            @leaveflow/shared – types, Zod schemas, date & policy rules (+ unit tests)
├─ server/            Express API
│  ├─ src/{config,controllers,services,repositories,routes,middleware,validators,excel,seed,utils,types}
│  ├─ tests/          integration + API tests
│  └─ data/           LeaveFlow.xlsx (generated) + backups/
├─ client/            React app
│  └─ src/{app/{store,routes},components/{common,layout,tables,charts,calendar},features/*,hooks,services/{api,repositories},theme,utils}
├─ sample-data/       LeaveFlow_Sample.xlsx
└─ docs/
```
