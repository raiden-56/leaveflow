import {
  DEFAULT_SETTINGS,
  addDays,
  calculateLeaveDays,
  completionPercent,
  dayjs,
  todayIso,
  type Approval,
  type Department,
  type Employee,
  type HalfDay,
  type HandoverStatus,
  type HandoverTask,
  type Holiday,
  type LeaveBalance,
  type LeaveRequest,
  type LeaveStatus,
  type LeaveTransaction,
  type LeaveType,
  type Notification,
  type Priority,
  type TaskStatus,
  type WorkHandover,
} from '@leaveflow/shared';
import { emptyTables, type Row, type Tables } from '../excel/schema.js';
import { settingsToRows } from '../services/settingsService.js';

/**
 * Realistic demo data. All leave dates are generated RELATIVE to the day the
 * workbook is created, so a fresh install always has people on leave today,
 * upcoming leave, pending approvals and active handovers.
 */

const DOMAIN = 'leaveflow.demo';

type EmpSeed = [id: string, name: string, dept: string, designation: string, managerId: string, role: Employee['role'], joined: string, workMode: Employee['workMode'], location: string, phone: string];

const EMPLOYEES: EmpSeed[] = [
  ['EMP001', 'Ananya Iyer', 'Human Resources', 'HR Director', '', 'ADMIN', '2017-04-03', 'HYBRID', 'Bengaluru', '+91 98450 11201'],
  ['EMP002', 'Kavya Nair', 'Human Resources', 'HR Executive', 'EMP001', 'EMPLOYEE', '2021-06-14', 'OFFICE', 'Bengaluru', '+91 98450 11202'],
  ['EMP003', 'Siddharth Rao', 'Human Resources', 'Talent Acquisition Specialist', 'EMP001', 'EMPLOYEE', '2022-02-01', 'HYBRID', 'Bengaluru', '+91 98450 11203'],
  ['EMP004', 'Rohan Mehta', 'Engineering', 'Engineering Manager', 'EMP001', 'MANAGER', '2018-08-20', 'HYBRID', 'Bengaluru', '+91 98450 11204'],
  ['EMP005', 'Priya Sharma', 'Engineering', 'Senior Software Engineer', 'EMP004', 'EMPLOYEE', '2019-11-04', 'HYBRID', 'Bengaluru', '+91 98450 11205'],
  ['EMP006', 'Arjun Reddy', 'Engineering', 'Software Engineer', 'EMP004', 'EMPLOYEE', '2022-07-11', 'OFFICE', 'Hyderabad', '+91 98450 11206'],
  ['EMP007', 'Sneha Kulkarni', 'Engineering', 'QA Lead', 'EMP004', 'EMPLOYEE', '2020-01-15', 'OFFICE', 'Pune', '+91 98450 11207'],
  ['EMP008', 'Vikram Singh', 'Engineering', 'DevOps Engineer', 'EMP004', 'EMPLOYEE', '2021-03-22', 'REMOTE', 'Jaipur', '+91 98450 11208'],
  ['EMP009', 'Aditya Joshi', 'Engineering', 'Frontend Engineer', 'EMP004', 'EMPLOYEE', '2023-01-09', 'HYBRID', 'Pune', '+91 98450 11209'],
  ['EMP010', 'Meera Pillai', 'Engineering', 'Backend Engineer', 'EMP004', 'EMPLOYEE', '2022-10-03', 'REMOTE', 'Kochi', '+91 98450 11210'],
  ['EMP011', 'Neha Gupta', 'Product Design', 'Design Manager', 'EMP001', 'MANAGER', '2019-05-06', 'HYBRID', 'Bengaluru', '+91 98450 11211'],
  ['EMP012', 'Rahul Verma', 'Product Design', 'Senior Product Designer', 'EMP011', 'EMPLOYEE', '2020-09-14', 'OFFICE', 'Bengaluru', '+91 98450 11212'],
  ['EMP013', 'Isha Banerjee', 'Product Design', 'UX Researcher', 'EMP011', 'EMPLOYEE', '2021-12-01', 'HYBRID', 'Kolkata', '+91 98450 11213'],
  ['EMP014', 'Karthik Subramanian', 'Product Design', 'UI Designer', 'EMP011', 'EMPLOYEE', '2023-04-17', 'OFFICE', 'Chennai', '+91 98450 11214'],
  ['EMP015', 'Pooja Desai', 'Product Design', 'Product Analyst', 'EMP011', 'EMPLOYEE', '2022-05-23', 'REMOTE', 'Ahmedabad', '+91 98450 11215'],
  ['EMP016', 'Amit Patel', 'Sales & Marketing', 'Sales & Marketing Manager', 'EMP001', 'MANAGER', '2018-02-12', 'OFFICE', 'Mumbai', '+91 98450 11216'],
  ['EMP017', 'Divya Menon', 'Sales & Marketing', 'Marketing Specialist', 'EMP016', 'EMPLOYEE', '2021-08-02', 'HYBRID', 'Mumbai', '+91 98450 11217'],
  ['EMP018', 'Sanjay Chauhan', 'Sales & Marketing', 'Account Executive', 'EMP016', 'EMPLOYEE', '2020-06-29', 'OFFICE', 'Delhi', '+91 98450 11218'],
  ['EMP019', 'Ritu Agarwal', 'Sales & Marketing', 'Content Strategist', 'EMP016', 'EMPLOYEE', '2022-11-21', 'REMOTE', 'Lucknow', '+91 98450 11219'],
  ['EMP020', 'Manish Tiwari', 'Sales & Marketing', 'Business Development Executive', 'EMP016', 'EMPLOYEE', '2023-07-10', 'OFFICE', 'Mumbai', '+91 98450 11220'],
];

const DEPARTMENTS: Department[] = [
  { departmentId: 'DEP01', departmentName: 'Engineering', headId: 'EMP004', description: 'Platform, product engineering, QA and DevOps', color: '#4F46E5' },
  { departmentId: 'DEP02', departmentName: 'Product Design', headId: 'EMP011', description: 'Product design, UX research and analytics', color: '#0D9488' },
  { departmentId: 'DEP03', departmentName: 'Sales & Marketing', headId: 'EMP016', description: 'Sales, marketing, content and business development', color: '#D97706' },
  { departmentId: 'DEP04', departmentName: 'Human Resources', headId: 'EMP001', description: 'People operations, talent acquisition and payroll', color: '#DB2777' },
];

const lt = (code: string, name: string, description: string, annualAllocation: number, o: Partial<LeaveType>): LeaveType => ({
  code,
  name,
  description,
  annualAllocation,
  isPaid: true,
  trackBalance: true,
  allowHalfDay: true,
  allowCarryForward: false,
  maxCarryForward: 0,
  maxConsecutiveDays: 0,
  minNoticeDays: 0,
  backdatedDays: 0,
  requiresApproval: true,
  requiresAttachmentAfterDays: 0,
  excludeWeekendsAndHolidays: true,
  color: '#4F46E5',
  isActive: true,
  includeInTotals: true,
  ...o,
});

export const LEAVE_TYPES: LeaveType[] = [
  lt('CL', 'Casual Leave', 'Short personal errands or unplanned needs', 8, { maxConsecutiveDays: 3, color: '#2563EB', minNoticeDays: 1 }),
  lt('SL', 'Sick Leave', 'Illness or medical appointments; certificate needed beyond 2 days', 10, { backdatedDays: 7, requiresAttachmentAfterDays: 2, color: '#DC2626' }),
  lt('EL', 'Earned Leave', 'Accrued leave for planned vacations; carries forward up to 30 days', 15, { allowCarryForward: true, maxCarryForward: 30, minNoticeDays: 7, maxConsecutiveDays: 21, color: '#16A34A' }),
  lt('AL', 'Annual Leave', 'Yearly vacation entitlement', 12, { allowCarryForward: true, maxCarryForward: 5, minNoticeDays: 7, maxConsecutiveDays: 15, color: '#0D9488' }),
  lt('PL', 'Privilege Leave', 'Long-service privilege entitlement', 6, { allowCarryForward: true, maxCarryForward: 12, minNoticeDays: 14, color: '#7C3AED' }),
  lt('ML', 'Maternity Leave', 'As per the Maternity Benefit Act (26 weeks, calendar days)', 182, { includeInTotals: false, allowHalfDay: false, excludeWeekendsAndHolidays: false, requiresAttachmentAfterDays: 1, maxConsecutiveDays: 182, color: '#DB2777' }),
  lt('PTL', 'Paternity Leave', 'Leave for new fathers within 6 months of childbirth', 15, { includeInTotals: false, allowHalfDay: false, maxConsecutiveDays: 15, color: '#0891B2' }),
  lt('BL', 'Bereavement Leave', 'Loss of an immediate family member', 5, { includeInTotals: false, allowHalfDay: false, backdatedDays: 3, maxConsecutiveDays: 5, color: '#475569' }),
  lt('CO', 'Compensatory Off', 'Credited by HR for working on holidays/weekends', 0, { color: '#EA580C' }),
  lt('LWP', 'Unpaid Leave', 'Leave without pay when paid balances are exhausted', 0, { isPaid: false, trackBalance: false, color: '#64748B' }),
  lt('OH', 'Optional Holiday', 'Pick from the optional/restricted holiday list', 2, { allowHalfDay: false, maxConsecutiveDays: 1, color: '#CA8A04' }),
];

function holidaysFor(year: number): Omit<Holiday, 'holidayId'>[] {
  // Approximate Indian holiday calendar (festival dates vary by year; HR can edit them).
  const known: Record<number, [string, string, Holiday['holidayType'], string][]> = {
    2026: [
      ['01-01', "New Year's Day", 'OPTIONAL', 'Optional holiday'],
      ['01-14', 'Makar Sankranti / Pongal', 'OPTIONAL', 'Harvest festival'],
      ['01-26', 'Republic Day', 'PUBLIC', 'National holiday'],
      ['03-04', 'Holi', 'PUBLIC', 'Festival of colours'],
      ['03-19', 'Ugadi / Gudi Padwa', 'PUBLIC', 'New year (Karnataka, Maharashtra)'],
      ['03-21', 'Id-ul-Fitr', 'OPTIONAL', 'Optional holiday'],
      ['04-03', 'Good Friday', 'PUBLIC', 'Public holiday'],
      ['05-01', 'Labour Day / Maharashtra Day', 'PUBLIC', 'Public holiday'],
      ['08-15', 'Independence Day', 'PUBLIC', 'National holiday'],
      ['09-14', 'Ganesh Chaturthi', 'PUBLIC', 'Festival'],
      ['10-02', 'Gandhi Jayanti', 'PUBLIC', 'National holiday'],
      ['10-20', 'Dussehra (Vijayadashami)', 'PUBLIC', 'Festival'],
      ['11-09', 'Diwali (Balipratipada)', 'PUBLIC', 'Festival of lights'],
      ['11-24', 'Guru Nanak Jayanti', 'OPTIONAL', 'Optional holiday'],
      ['12-25', 'Christmas', 'PUBLIC', 'Public holiday'],
      ['12-31', 'Company Foundation Day', 'COMPANY', 'Company-wide day off'],
    ],
    2027: [
      ['01-01', "New Year's Day", 'OPTIONAL', 'Optional holiday'],
      ['01-14', 'Makar Sankranti / Pongal', 'OPTIONAL', 'Harvest festival'],
      ['01-26', 'Republic Day', 'PUBLIC', 'National holiday'],
      ['03-22', 'Holi', 'PUBLIC', 'Festival of colours'],
      ['03-26', 'Good Friday', 'PUBLIC', 'Public holiday'],
      ['05-01', 'Labour Day / Maharashtra Day', 'PUBLIC', 'Public holiday'],
      ['08-15', 'Independence Day', 'PUBLIC', 'National holiday'],
      ['10-02', 'Gandhi Jayanti', 'PUBLIC', 'National holiday'],
      ['12-25', 'Christmas', 'PUBLIC', 'Public holiday'],
    ],
  };
  const fixed: [string, string, Holiday['holidayType'], string][] = [
    ['01-26', 'Republic Day', 'PUBLIC', 'National holiday'],
    ['05-01', 'Labour Day', 'PUBLIC', 'Public holiday'],
    ['08-15', 'Independence Day', 'PUBLIC', 'National holiday'],
    ['10-02', 'Gandhi Jayanti', 'PUBLIC', 'National holiday'],
    ['12-25', 'Christmas', 'PUBLIC', 'Public holiday'],
  ];
  return (known[year] ?? fixed).map(([md, holidayName, holidayType, description]) => ({
    holidayName,
    holidayDate: `${year}-${md}`,
    holidayType,
    description,
  }));
}

const HANDOVER_TEMPLATES: Record<string, { title: string; description: string; tasks: [string, string, Priority][] }[]> = {
  Engineering: [
    { title: 'Payments API maintenance', description: 'Own the payments microservice: monitor alerts, review PRs touching settlement logic and coordinate with the bank integration team.', tasks: [['Review open PRs on settlement module', 'Review and merge PRs #412 and #418 after QA sign-off', 'HIGH'], ['Monitor reconciliation job', 'Check the nightly reconciliation dashboard and escalate mismatches above ₹10,000', 'CRITICAL'], ['Sync with HDFC integration team', 'Attend Thursday sync and share the API change log', 'MEDIUM']] },
    { title: 'Sprint deliverables & stand-ups', description: 'Drive remaining sprint stories, run daily stand-ups and keep the Jira board up to date.', tasks: [['Run daily stand-up', 'Facilitate the 10:00 stand-up and update blockers on the board', 'MEDIUM'], ['Complete story LF-231 (export to Excel)', 'Finish the pending unit tests and raise the PR', 'HIGH']] },
    { title: 'Production on-call & incident response', description: 'Primary on-call for production. Follow the runbook for P1/P2 incidents and keep the incident channel updated.', tasks: [['Be primary on-call (PagerDuty)', 'Swap the PagerDuty schedule and acknowledge alerts within 15 minutes', 'CRITICAL'], ['Rotate TLS certificates', 'Renew certificates expiring this month using the cert-manager runbook', 'HIGH'], ['Weekly cost report', 'Share AWS cost anomalies in #infra on Friday', 'LOW']] },
    { title: 'Release QA sign-off', description: 'Complete regression for the upcoming release and provide QA sign-off to the release manager.', tasks: [['Execute regression suite', 'Run the 312-case regression suite on staging', 'HIGH'], ['Triage new defects', 'Triage defects raised by UAT users daily', 'MEDIUM']] },
  ],
  'Product Design': [
    { title: 'Checkout redesign hand-off', description: 'Support engineering with the checkout redesign: answer spec questions and review implemented screens.', tasks: [['Design QA for checkout screens', 'Review staging builds against Figma and log visual bugs', 'HIGH'], ['Update component specs', 'Add missing states (error, loading) to the spec file', 'MEDIUM']] },
    { title: 'Design system component reviews', description: 'Review incoming component contributions and keep the design tokens changelog updated.', tasks: [['Review DS contributions', 'Review the 3 pending component proposals', 'MEDIUM'], ['Publish token changelog', 'Publish the monthly design-token changelog', 'LOW']] },
    { title: 'Usability study for onboarding', description: 'Run the remaining usability sessions and consolidate findings for the product review.', tasks: [['Conduct 4 usability sessions', 'Sessions are booked in the research calendar', 'HIGH'], ['Synthesise findings', 'Prepare the insights deck for the Friday product review', 'MEDIUM']] },
  ],
  'Sales & Marketing': [
    { title: 'Q4 enterprise pipeline follow-ups', description: 'Follow up on enterprise opportunities in negotiation and keep the CRM updated.', tasks: [['Follow up with Tata Motors procurement', 'Share the revised commercial proposal', 'CRITICAL'], ['Update CRM opportunities', 'Update stage and next steps for all open deals', 'MEDIUM']] },
    { title: 'Festive campaign launch', description: 'Launch the festive season campaign across email and social channels as per the approved calendar.', tasks: [['Schedule email campaign', 'Schedule the 3-part email series in HubSpot', 'HIGH'], ['Approve social creatives', 'Final approval of creatives with the agency', 'MEDIUM']] },
    { title: 'Key account renewals', description: 'Handle renewal conversations for key accounts due this month.', tasks: [['Renewal call with Infosys BPM', 'Discuss the renewal quote and usage review', 'HIGH'], ['Send renewal reminders', 'Send reminders to accounts renewing in 30 days', 'LOW']] },
  ],
  'Human Resources': [
    { title: 'Onboarding of new joiners', description: 'Coordinate onboarding for new joiners: documentation, IT assets and induction sessions.', tasks: [['Collect joining documents', 'Verify documents and update HRMS', 'HIGH'], ['Schedule induction', 'Book induction sessions with department heads', 'MEDIUM']] },
    { title: 'Payroll inputs for the month', description: 'Consolidate attendance, leave and reimbursement inputs for payroll processing.', tasks: [['Consolidate LOP days', 'Export unpaid leave days from LeaveFlow and share with payroll', 'CRITICAL'], ['Verify reimbursements', 'Verify claims above ₹5,000', 'MEDIUM']] },
    { title: 'Campus hiring coordination', description: 'Coordinate campus hiring drives with colleges and interview panels.', tasks: [['Confirm panel availability', 'Confirm interviewers for the NIT Trichy drive', 'HIGH'], ['Share offer letters', 'Release offer letters approved by the hiring committee', 'MEDIUM']] },
  ],
};

type Phase = 'past' | 'current' | 'upcoming';
interface LeaveSeed {
  emp: string;
  type: string;
  start: number; // offset in calendar days from today
  days: number; // working days
  status: LeaveStatus;
  backup: string;
  handover?: HandoverStatus;
  half?: HalfDay;
  reason: string;
  comment?: string;
  declineReason?: string;
}

const LEAVE_SEEDS: LeaveSeed[] = [
  // ---- past, approved (handovers completed) ----
  { emp: 'EMP005', type: 'EL', start: -280, days: 3, status: 'APPROVED', backup: 'EMP010', reason: 'Family function in Jaipur' },
  { emp: 'EMP006', type: 'SL', start: -250, days: 2, status: 'APPROVED', backup: 'EMP009', reason: 'Viral fever' },
  { emp: 'EMP012', type: 'CL', start: -230, days: 1, status: 'APPROVED', backup: 'EMP014', reason: 'Bank and passport office work' },
  { emp: 'EMP017', type: 'EL', start: -210, days: 4, status: 'APPROVED', backup: 'EMP019', reason: 'Vacation to Coorg' },
  { emp: 'EMP009', type: 'CL', start: -190, days: 2, status: 'APPROVED', backup: 'EMP006', reason: 'Shifting to a new house' },
  { emp: 'EMP018', type: 'SL', start: -175, days: 1, status: 'APPROVED', backup: 'EMP020', reason: 'Dental surgery' },
  { emp: 'EMP002', type: 'EL', start: -160, days: 3, status: 'APPROVED', backup: 'EMP003', reason: "Sister's wedding" },
  { emp: 'EMP013', type: 'AL', start: -150, days: 5, status: 'APPROVED', backup: 'EMP015', reason: 'Trip to Darjeeling with family' },
  { emp: 'EMP007', type: 'CL', start: -135, days: 2, status: 'APPROVED', backup: 'EMP006', reason: 'Personal work' },
  { emp: 'EMP020', type: 'EL', start: -120, days: 3, status: 'APPROVED', backup: 'EMP018', reason: 'Hometown visit — Varanasi' },
  { emp: 'EMP008', type: 'AL', start: -110, days: 5, status: 'APPROVED', backup: 'EMP010', reason: 'Ladakh road trip' },
  { emp: 'EMP014', type: 'SL', start: -95, days: 2, status: 'APPROVED', backup: 'EMP012', reason: 'Migraine and doctor visit' },
  { emp: 'EMP019', type: 'CL', start: -80, days: 1, status: 'APPROVED', backup: 'EMP017', reason: "Child's school annual day" },
  { emp: 'EMP010', type: 'EL', start: -70, days: 4, status: 'APPROVED', backup: 'EMP005', reason: 'Onam celebrations in Kochi' },
  { emp: 'EMP004', type: 'AL', start: -60, days: 3, status: 'APPROVED', backup: 'EMP005', reason: 'Family vacation' },
  { emp: 'EMP015', type: 'CL', start: -50, days: 2, status: 'APPROVED', backup: 'EMP013', reason: 'Navratri preparations' },
  { emp: 'EMP003', type: 'SL', start: -42, days: 1, status: 'APPROVED', backup: 'EMP002', reason: 'Food poisoning' },
  { emp: 'EMP016', type: 'EL', start: -35, days: 2, status: 'APPROVED', backup: 'EMP018', reason: 'Personal commitments' },
  { emp: 'EMP006', type: 'AL', start: -28, days: 3, status: 'APPROVED', backup: 'EMP007', reason: 'Trip to Goa' },
  { emp: 'EMP012', type: 'EL', start: -21, days: 5, status: 'APPROVED', backup: 'EMP014', reason: 'Diwali travel to Lucknow' },
  { emp: 'EMP011', type: 'CL', start: -14, days: 1, status: 'APPROVED', backup: 'EMP012', reason: 'Parent-teacher meeting' },
  { emp: 'EMP005', type: 'CL', start: -9, days: 1, status: 'APPROVED', backup: 'EMP010', half: 'FIRST_HALF', reason: 'Doctor appointment (morning)' },
  // ---- past, rejected / cancelled ----
  { emp: 'EMP009', type: 'EL', start: -100, days: 5, status: 'REJECTED', backup: 'EMP006', reason: 'Vacation', comment: 'Release week — critical production deployment. Please plan after the release.' },
  { emp: 'EMP018', type: 'AL', start: -40, days: 3, status: 'REJECTED', backup: 'EMP020', reason: 'Personal trip', comment: 'Quarter-end closing; two team members are already away.' },
  { emp: 'EMP017', type: 'CL', start: -20, days: 1, status: 'CANCELLED', backup: 'EMP019', reason: 'Personal work' },
  // ---- on leave today (handovers active) ----
  { emp: 'EMP008', type: 'EL', start: -1, days: 4, status: 'APPROVED', backup: 'EMP006', handover: 'ACTIVE', reason: 'Attending a friend\'s wedding in Udaipur' },
  { emp: 'EMP019', type: 'SL', start: 0, days: 2, status: 'APPROVED', backup: 'EMP017', handover: 'ACTIVE', reason: 'Recovering from flu' },
  // ---- upcoming, approved ----
  { emp: 'EMP013', type: 'CL', start: 1, days: 1, status: 'APPROVED', backup: 'EMP015', handover: 'ACTIVE', reason: 'Personal errands' },
  { emp: 'EMP012', type: 'AL', start: 6, days: 5, status: 'APPROVED', backup: 'EMP014', handover: 'ACTIVE', reason: 'Kerala backwaters vacation' },
  { emp: 'EMP010', type: 'CL', start: 9, days: 1, status: 'APPROVED', backup: 'EMP005', handover: 'ACTIVE', reason: 'Visa interview in Chennai' },
  { emp: 'EMP020', type: 'AL', start: 20, days: 5, status: 'APPROVED', backup: 'EMP018', handover: 'ACTIVE', reason: 'Year-end family trip' },
  // ---- pending approval ----
  { emp: 'EMP005', type: 'EL', start: 14, days: 5, status: 'PENDING', backup: 'EMP009', handover: 'PENDING_ACCEPTANCE', reason: 'Trip to Rishikesh with family' },
  { emp: 'EMP006', type: 'CL', start: 4, days: 2, status: 'PENDING', backup: 'EMP007', handover: 'ACCEPTED', reason: 'Brother\'s engagement ceremony' },
  // After Priya (EMP005) is back from Rishikesh, so the two aren't each other's backup on overlapping leave.
  { emp: 'EMP009', type: 'EL', start: 24, days: 3, status: 'PENDING', backup: 'EMP005', handover: 'PENDING_ACCEPTANCE', reason: 'Attending a tech conference abroad (personal)' },
  { emp: 'EMP014', type: 'AL', start: 12, days: 4, status: 'PENDING', backup: 'EMP012', handover: 'DECLINED', reason: 'Pongal at home in Madurai', declineReason: 'I am on leave myself during part of this period' },
  { emp: 'EMP017', type: 'EL', start: 8, days: 3, status: 'PENDING', backup: 'EMP019', handover: 'ACCEPTED', reason: 'Wedding anniversary trip' },
  { emp: 'EMP018', type: 'CL', start: 5, days: 1, status: 'PENDING', backup: 'EMP020', handover: 'PENDING_ACCEPTANCE', reason: 'Vehicle registration at RTO' },
  { emp: 'EMP007', type: 'EL', start: 15, days: 4, status: 'CHANGES_REQUESTED', backup: 'EMP006', handover: 'PENDING_ACCEPTANCE', reason: 'Vacation', comment: 'Release freeze that week — can you move this by one week and add the regression hand-off tasks?' },
  { emp: 'EMP002', type: 'AL', start: 25, days: 5, status: 'PENDING', backup: 'EMP003', handover: 'ACCEPTED', reason: 'Year-end vacation to Andaman' },
  { emp: 'EMP004', type: 'EL', start: 30, days: 3, status: 'PENDING', backup: 'EMP005', handover: 'PENDING_ACCEPTANCE', reason: 'Family function' },
];

export function buildSeed(now: Date = new Date()): Tables {
  const tables = emptyTables();
  const today = todayIso(DEFAULT_SETTINGS.timezone, now);
  const createdAt = now.toISOString();
  const years = [Number(today.slice(0, 4)) - 1, Number(today.slice(0, 4)), Number(today.slice(0, 4)) + 1];

  // ---- master data ----
  const employees: Employee[] = EMPLOYEES.map(([employeeId, employeeName, department, designation, managerId, role, joiningDate, workMode, location, phone]) => ({
    employeeId,
    employeeName,
    email: `${employeeName.toLowerCase().split(' ').join('.')}@${DOMAIN}`,
    phone,
    department,
    designation,
    managerId,
    joiningDate,
    employmentStatus: 'ACTIVE',
    role,
    profileImage: '',
    workMode,
    location,
  }));
  const empMap = new Map(employees.map((e) => [e.employeeId, e]));
  const holidays: Holiday[] = years.flatMap(holidaysFor).map((h, i) => ({ holidayId: `HOL${String(i + 1).padStart(3, '0')}`, ...h }));
  const nonWorking = holidays.filter((h) => h.holidayType !== 'OPTIONAL');
  const typeMap = new Map(LEAVE_TYPES.map((t) => [t.code, t]));
  const isWorking = (d: string) => DEFAULT_SETTINGS.workingDays.includes(dayjs(d).day()) && !nonWorking.some((h) => h.holidayDate === d);
  const nextWorking = (d: string) => {
    let x = d;
    while (!isWorking(x)) x = addDays(x, 1);
    return x;
  };
  const addWorking = (d: string, n: number) => {
    let x = d;
    for (let i = 1; i < n; i++) x = nextWorking(addDays(x, 1));
    return x;
  };

  const leaves: LeaveRequest[] = [];
  const handovers: WorkHandover[] = [];
  const tasks: HandoverTask[] = [];
  const approvals: Omit<Approval, 'approvalId'>[] = [];
  const notifications: Omit<Notification, 'notificationId'>[] = [];
  const templateCursor: Record<string, number> = {};
  const ts = (date: string, hour = 10) => dayjs(`${date}T${String(hour).padStart(2, '0')}:15:00+05:30`).toISOString();

  LEAVE_SEEDS.forEach((seed, i) => {
    const leaveId = `LV${String(i + 1).padStart(4, '0')}`;
    const employee = empMap.get(seed.emp)!;
    const type = typeMap.get(seed.type)!;
    const phase: Phase = seed.start < -1 ? 'past' : seed.start <= 0 ? 'current' : 'upcoming';
    const startDate = phase === 'current' ? addDays(today, seed.start) : nextWorking(addDays(today, seed.start));
    const endDate = phase === 'current' ? addDays(today, seed.start + seed.days - 1) : addWorking(startDate, seed.days);
    const halfDay = seed.half ?? 'NONE';
    const { totalDays } = calculateLeaveDays({ startDate, endDate, halfDay, workingDays: DEFAULT_SETTINGS.workingDays, holidays: nonWorking, excludeNonWorkingDays: true });
    const appliedDate = phase === 'upcoming' ? addDays(today, -((i % 5) + 1)) : addDays(startDate, -(7 + (i % 6)));
    const decided = ['APPROVED', 'REJECTED'].includes(seed.status);
    const decisionDate = phase === 'upcoming' ? addDays(appliedDate, 1) : addDays(appliedDate, 2);
    const approverId = employee.managerId || 'EMP001';

    leaves.push({
      leaveId,
      employeeId: seed.emp,
      leaveType: seed.type,
      startDate,
      endDate,
      totalDays,
      halfDay,
      reason: seed.reason,
      appliedDate,
      status: seed.status,
      approverId,
      approvalDate: decided ? decisionDate : '',
      rejectionReason: seed.status === 'REJECTED' ? seed.comment ?? '' : '',
      managerComment: seed.status === 'CHANGES_REQUESTED' ? seed.comment ?? '' : seed.status === 'APPROVED' ? 'Approved. Enjoy your time off!' : '',
      emergencyContact: `${employee.employeeName.split(' ')[1]} family — ${employee.phone.replace(/\d{2}$/, '99')}`,
      contactDuringLeave: phase === 'past' ? '' : 'Reachable on phone for emergencies',
      attachmentName: '',
      attachmentUrl: '',
      updatedAt: ts(decided ? decisionDate : appliedDate, 12),
    });
    approvals.push({ entityType: 'LEAVE', entityId: leaveId, action: 'SUBMITTED', actorId: seed.emp, comment: seed.reason, createdAt: ts(appliedDate) });
    if (decided) approvals.push({ entityType: 'LEAVE', entityId: leaveId, action: seed.status as 'APPROVED' | 'REJECTED', actorId: approverId, comment: seed.comment ?? 'Approved', createdAt: ts(decisionDate, 15) });
    if (seed.status === 'CHANGES_REQUESTED') approvals.push({ entityType: 'LEAVE', entityId: leaveId, action: 'CHANGES_REQUESTED', actorId: approverId, comment: seed.comment ?? '', createdAt: ts(addDays(appliedDate, 1), 15) });
    if (seed.status === 'CANCELLED') approvals.push({ entityType: 'LEAVE', entityId: leaveId, action: 'CANCELLED', actorId: seed.emp, comment: 'Plans changed', createdAt: ts(addDays(appliedDate, 2), 9) });

    // ---- handover ----
    const templates = HANDOVER_TEMPLATES[employee.department];
    const cursor = (templateCursor[employee.department] = ((templateCursor[employee.department] ?? -1) + 1) % templates.length);
    const tpl = templates[cursor];
    const handoverId = `HO${String(i + 1).padStart(4, '0')}`;
    const handoverStatus: HandoverStatus =
      seed.handover ?? (seed.status === 'APPROVED' ? 'COMPLETED' : 'CANCELLED');
    const hStart = addDays(startDate, -1);
    const accepted = ['ACCEPTED', 'ACTIVE', 'COMPLETED'].includes(handoverStatus) || (handoverStatus === 'CANCELLED' && seed.status === 'REJECTED');
    const handoverTasks: HandoverTask[] = tpl.tasks.map(([taskTitle, taskDescription, priority], ti) => {
      let taskStatus: TaskStatus = 'NOT_STARTED';
      if (handoverStatus === 'COMPLETED') taskStatus = 'COMPLETED';
      else if (handoverStatus === 'ACTIVE' && phase === 'current') taskStatus = (['IN_PROGRESS', 'COMPLETED', 'BLOCKED'] as TaskStatus[])[ti % 3];
      const dueDate = phase === 'current' && ti === 2 ? addDays(today, -1) : addDays(startDate, Math.min(ti, seed.days - 1));
      return {
        taskId: '',
        handoverId,
        taskTitle,
        taskDescription,
        priority,
        dueDate: phase === 'current' && ti === 0 ? addDays(today, -1) : dueDate,
        assignedEmployeeId: seed.backup,
        taskStatus,
        comments: taskStatus === 'BLOCKED' ? 'Waiting for access to the vendor portal' : taskStatus === 'COMPLETED' ? 'Done' : '',
        referenceLinks: 'https://confluence.leaveflow.demo/runbooks',
        expectedOutcome: 'Work continues without delays during the leave period',
        notes: '',
        createdAt: ts(appliedDate),
        updatedAt: ts(phase === 'past' ? endDate : appliedDate, 17),
      };
    });
    handovers.push({
      handoverId,
      leaveId,
      employeeId: seed.emp,
      backupEmployeeId: seed.backup,
      handoverTitle: tpl.title,
      handoverDescription: tpl.description,
      startDate: hStart,
      endDate,
      priority: tpl.tasks.some((t) => t[2] === 'CRITICAL') ? 'HIGH' : 'MEDIUM',
      instructions: 'Credentials are in the team vault. Escalate blockers to the reporting manager.',
      handoverStatus,
      acceptedDate: accepted ? ts(addDays(appliedDate, 1), 11) : '',
      declineReason: handoverStatus === 'DECLINED' ? seed.declineReason ?? '' : '',
      completionStatus: completionPercent(handoverTasks),
      createdAt: ts(appliedDate),
      completedDate: handoverStatus === 'COMPLETED' ? ts(addDays(endDate, 1), 10) : '',
    });
    tasks.push(...handoverTasks);
    approvals.push({ entityType: 'HANDOVER', entityId: handoverId, action: 'SUBMITTED', actorId: seed.emp, comment: '', createdAt: ts(appliedDate) });
    if (accepted) approvals.push({ entityType: 'HANDOVER', entityId: handoverId, action: 'ACCEPTED', actorId: seed.backup, comment: 'Happy to cover', createdAt: ts(addDays(appliedDate, 1), 11) });
    if (handoverStatus === 'DECLINED') approvals.push({ entityType: 'HANDOVER', entityId: handoverId, action: 'DECLINED', actorId: seed.backup, comment: seed.declineReason ?? '', createdAt: ts(addDays(appliedDate, 1), 11) });
    if (['ACTIVE', 'COMPLETED'].includes(handoverStatus)) approvals.push({ entityType: 'HANDOVER', entityId: handoverId, action: 'ACTIVATED', actorId: approverId, comment: 'Leave approved', createdAt: ts(decisionDate, 15) });
    if (handoverStatus === 'COMPLETED') approvals.push({ entityType: 'HANDOVER', entityId: handoverId, action: 'COMPLETED', actorId: 'SYSTEM', comment: 'Employee returned from leave', createdAt: ts(addDays(endDate, 1), 10) });
    if (handoverStatus === 'CANCELLED') approvals.push({ entityType: 'HANDOVER', entityId: handoverId, action: 'CANCELLED', actorId: approverId, comment: `Leave ${seed.status.toLowerCase()}`, createdAt: ts(decisionDate, 15) });

    // ---- notifications for the live (non-past) workflow ----
    const n = (recipientId: string, type: Notification['type'], title: string, message: string, link: string, entityType: string, entityId: string, isRead: boolean, at: string) =>
      notifications.push({ recipientId, type, title, message, entityType, entityId, link, isRead, createdAt: at, readAt: isRead ? at : '' });
    if (seed.status === 'PENDING') n(approverId, 'LEAVE_SUBMITTED', 'Leave approval required', `${employee.employeeName} applied for ${totalDays} day(s) of ${type.name} (${startDate} → ${endDate}).`, `/approvals?leave=${leaveId}`, 'Leave', leaveId, false, ts(appliedDate));
    if (handoverStatus === 'PENDING_ACCEPTANCE') n(seed.backup, 'HANDOVER_ASSIGNED', 'New work handover assigned', `${employee.employeeName} asked you to cover "${tpl.title}" from ${hStart} to ${endDate}. Please accept or decline.`, `/handovers?id=${handoverId}`, 'Handover', handoverId, false, ts(appliedDate, 11));
    if (handoverStatus === 'ACCEPTED') n(seed.emp, 'HANDOVER_ACCEPTED', 'Handover accepted', `${empMap.get(seed.backup)!.employeeName} accepted the handover "${tpl.title}".`, `/handovers?id=${handoverId}`, 'Handover', handoverId, false, ts(addDays(appliedDate, 1), 11));
    if (handoverStatus === 'DECLINED') n(seed.emp, 'HANDOVER_DECLINED', 'Handover declined', `${empMap.get(seed.backup)!.employeeName} declined "${tpl.title}": ${seed.declineReason}. Please choose another backup.`, `/my-leaves?leave=${leaveId}`, 'Handover', handoverId, false, ts(addDays(appliedDate, 1), 11));
    if (seed.status === 'CHANGES_REQUESTED') n(seed.emp, 'LEAVE_CHANGES_REQUESTED', 'Changes requested on your leave', `${empMap.get(approverId)!.employeeName} requested changes to leave ${leaveId}: ${seed.comment}`, `/apply-leave?edit=${leaveId}`, 'Leave', leaveId, false, ts(addDays(appliedDate, 1), 15));
    if (seed.status === 'APPROVED' && phase !== 'past') {
      n(seed.emp, 'LEAVE_APPROVED', 'Leave approved', `${empMap.get(approverId)!.employeeName} approved your leave ${leaveId} (${startDate} → ${endDate}).`, `/my-leaves?leave=${leaveId}`, 'Leave', leaveId, phase === 'current', ts(decisionDate, 15));
      n(seed.backup, 'HANDOVER_ACCEPTED', 'Handover is now active', `You are covering "${tpl.title}" for ${employee.employeeName} from ${hStart} to ${endDate}.`, `/handovers?id=${handoverId}`, 'Handover', handoverId, phase === 'current', ts(decisionDate, 15));
    }
    if (seed.status === 'REJECTED' && seed.start > -60) n(seed.emp, 'LEAVE_REJECTED', 'Leave rejected', `Your leave ${leaveId} was rejected: ${seed.comment}`, `/my-leaves?leave=${leaveId}`, 'Leave', leaveId, true, ts(decisionDate, 15));
  });

  // ---- balances & transactions derived from the leaves ----
  const balances: Omit<LeaveBalance, 'balanceId'>[] = [];
  const transactions: Omit<LeaveTransaction, 'transactionId'>[] = [];
  const currentYear = Number(today.slice(0, 4));
  const balanceYears = [...new Set([currentYear, ...leaves.map((l) => Number(l.startDate.slice(0, 4)))])].sort();
  for (const year of balanceYears) {
    for (const e of employees) {
      for (const t of LEAVE_TYPES.filter((x) => x.trackBalance && x.isActive)) {
        const mine = leaves.filter((l) => l.employeeId === e.employeeId && l.leaveType === t.code && l.startDate.startsWith(String(year)));
        if (year !== currentYear && mine.length === 0) continue;
        const used = mine.filter((l) => l.status === 'APPROVED').reduce((s, l) => s + l.totalDays, 0);
        const pending = mine.filter((l) => l.status === 'PENDING' || l.status === 'CHANGES_REQUESTED').reduce((s, l) => s + l.totalDays, 0);
        const carriedForward = year === currentYear && t.code === 'EL' ? [2, 4, 6, 3, 5][Number(e.employeeId.slice(-1)) % 5] : 0;
        const adjusted = year === currentYear && t.code === 'CO' && ['EMP006', 'EMP008', 'EMP018'].includes(e.employeeId) ? 1 : 0;
        balances.push({ employeeId: e.employeeId, year, leaveType: t.code, allocated: t.annualAllocation, carriedForward, adjusted, used, pending });
        const tx = (transactionType: LeaveTransaction['transactionType'], days: number, leaveId: string, reason: string, at: string, by = 'SYSTEM') =>
          transactions.push({ employeeId: e.employeeId, leaveType: t.code, year, transactionType, days, leaveId, reason, performedBy: by, createdAt: at });
        tx('ALLOCATION', t.annualAllocation, '', 'Annual allocation', ts(`${year}-01-01`, 9));
        if (carriedForward) tx('CARRY_FORWARD', carriedForward, '', `Carried forward from ${year - 1}`, ts(`${year}-01-01`, 9));
        if (adjusted) tx('COMP_OFF', adjusted, '', 'Worked on a weekend release', ts(addDays(today, -30), 12), 'EMP001');
        for (const l of mine) {
          tx('APPLIED', l.totalDays, l.leaveId, 'Leave applied', ts(l.appliedDate), l.employeeId);
          if (l.status === 'APPROVED') tx('APPROVED', l.totalDays, l.leaveId, 'Leave approved', ts(l.approvalDate || l.appliedDate, 15), l.approverId);
          if (l.status === 'REJECTED' || l.status === 'CANCELLED') tx('RELEASED', -l.totalDays, l.leaveId, `Leave ${l.status.toLowerCase()}`, ts(l.approvalDate || l.appliedDate, 15), l.approverId);
        }
      }
    }
  }

  // ---- assemble tables with generated IDs ----
  const withIds = <T extends object>(rows: T[], field: string, prefix: string, pad: number): Row[] =>
    rows.map((r, i) => ({ ...(r as Record<string, unknown>), [field]: `${prefix}${String(i + 1).padStart(pad, '0')}` }) as Row);

  tables.Employees = employees as unknown as Row[];
  tables.Departments = DEPARTMENTS as unknown as Row[];
  tables.LeaveTypes = LEAVE_TYPES as unknown as Row[];
  tables.Holidays = holidays as unknown as Row[];
  tables.LeaveRequests = leaves as unknown as Row[];
  tables.WorkHandovers = handovers as unknown as Row[];
  tables.HandoverTasks = withIds(tasks, 'taskId', 'TSK', 4);
  tables.Approvals = withIds(approvals.sort((a, b) => a.createdAt.localeCompare(b.createdAt)), 'approvalId', 'APR', 5);
  tables.Notifications = withIds(notifications.sort((a, b) => a.createdAt.localeCompare(b.createdAt)), 'notificationId', 'NTF', 5);
  tables.LeaveBalances = withIds(balances, 'balanceId', 'BAL', 4);
  tables.LeaveTransactions = withIds(transactions, 'transactionId', 'TXN', 5);
  tables.Settings = settingsToRows(DEFAULT_SETTINGS) as unknown as Row[];
  tables.AuditLog = [{ auditId: 'AUD000001', timestamp: createdAt, actorId: 'SYSTEM', action: 'WORKBOOK_SEEDED', entityType: 'Workbook', entityId: 'LeaveFlow', details: JSON.stringify({ employees: employees.length, leaves: leaves.length }) }];
  return tables;
}
