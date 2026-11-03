import type { Request, Response } from 'express';
import { HALF_DAY_LABELS, LEAVE_STATUS_LABELS, HANDOVER_STATUS_LABELS, leaveApplicationSchema, leavePreviewSchema, rejectionSchema } from '@leaveflow/shared';
import type { Container } from '../config/services.js';
import { badRequest } from '../utils/errors.js';
import { sendWorkbook, sheet } from '../utils/spreadsheet.js';
import { calendarQuery, leaveListQuery, optionalCommentBody, paginate } from '../validators/index.js';

export function leaveController(c: Container) {
  return {
    async list(req: Request, res: Response) {
      const { page, pageSize, ...filters } = leaveListQuery.parse(req.query);
      res.json(paginate(await c.leaves.list(req.user!, filters), page, pageSize));
    },
    async get(req: Request, res: Response) {
      res.json(await c.leaves.getDetails(req.user!, String(req.params.id)));
    },
    async preview(req: Request, res: Response) {
      res.json(await c.leaves.preview(req.user!, leavePreviewSchema.parse(req.body)));
    },
    async create(req: Request, res: Response) {
      res.status(201).json(await c.leaves.apply(req.user!, leaveApplicationSchema.parse(req.body)));
    },
    async update(req: Request, res: Response) {
      res.json(await c.leaves.update(req.user!, String(req.params.id), leaveApplicationSchema.parse(req.body)));
    },
    async cancel(req: Request, res: Response) {
      const reason = typeof req.body?.reason === 'string' ? req.body.reason.slice(0, 500) : '';
      res.json(await c.leaves.cancel(req.user!, String(req.params.id), reason));
    },
    async approve(req: Request, res: Response) {
      const { comment } = optionalCommentBody.parse(req.body ?? {});
      res.json(await c.leaves.approve(req.user!, String(req.params.id), comment));
    },
    async reject(req: Request, res: Response) {
      const { comment } = rejectionSchema.parse(req.body);
      res.json(await c.leaves.reject(req.user!, String(req.params.id), comment));
    },
    async requestChanges(req: Request, res: Response) {
      const { comment } = rejectionSchema.parse(req.body);
      res.json(await c.leaves.requestChanges(req.user!, String(req.params.id), comment));
    },
    async calendar(req: Request, res: Response) {
      const q = calendarQuery.parse(req.query);
      const [events, holidays] = await Promise.all([
        c.leaves.calendar(req.user!, q),
        c.holidays.list(),
      ]);
      res.json({ events, holidays: holidays.filter((h) => h.holidayDate >= q.from && h.holidayDate <= q.to) });
    },
    async uploadAttachment(req: Request, res: Response) {
      if (!req.file) throw badRequest('No file uploaded');
      res.status(201).json({ attachmentName: req.file.originalname, attachmentUrl: `/api/uploads/${req.file.filename}` });
    },
    async export(req: Request, res: Response) {
      const { page: _p, pageSize: _s, ...filters } = leaveListQuery.parse(req.query);
      const rows = await c.leaves.list(req.user!, filters);
      await sendWorkbook(res, 'leave-history', [
        sheet({
          name: 'Leave History',
          rows,
          columns: [
            { header: 'Leave ID', value: (r) => r.leaveId },
            { header: 'Employee ID', value: (r) => r.employeeId },
            { header: 'Employee', value: (r) => r.employee?.employeeName, width: 24 },
            { header: 'Department', value: (r) => r.employee?.department, width: 20 },
            { header: 'Leave Type', value: (r) => r.leaveTypeName, width: 18 },
            { header: 'Start Date', value: (r) => r.startDate },
            { header: 'End Date', value: (r) => r.endDate },
            { header: 'Days', value: (r) => r.totalDays },
            { header: 'Session', value: (r) => HALF_DAY_LABELS[r.halfDay] },
            { header: 'Applied On', value: (r) => r.appliedDate },
            { header: 'Status', value: (r) => LEAVE_STATUS_LABELS[r.status] },
            { header: 'Approved/Decided By', value: (r) => r.approver?.employeeName, width: 22 },
            { header: 'Decision Date', value: (r) => r.approvalDate },
            { header: 'Rejection Reason', value: (r) => r.rejectionReason, width: 30 },
            { header: 'Backup Employee', value: (r) => r.handover?.backupEmployee?.employeeName, width: 22 },
            { header: 'Handover Status', value: (r) => (r.handover ? HANDOVER_STATUS_LABELS[r.handover.handoverStatus] : '') },
            { header: 'Reason', value: (r) => r.reason, width: 36 },
          ],
        }),
      ]);
    },
  };
}
