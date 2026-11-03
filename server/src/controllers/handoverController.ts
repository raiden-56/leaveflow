import type { Request, Response } from 'express';
import { handoverInputSchema, handoverTaskInputSchema, rejectionSchema, taskUpdateSchema } from '@leaveflow/shared';
import type { Container } from '../config/services.js';
import { candidateQuery, createHandoverBody, handoverListQuery, optionalCommentBody, taskListQuery } from '../validators/index.js';

export function handoverController(c: Container) {
  return {
    async list(req: Request, res: Response) {
      res.json(await c.handovers.list(req.user!, handoverListQuery.parse(req.query)));
    },
    async get(req: Request, res: Response) {
      res.json(await c.handovers.get(req.user!, String(req.params.id)));
    },
    async create(req: Request, res: Response) {
      const { leaveId } = createHandoverBody.parse(req.body);
      res.status(201).json(await c.handovers.createStandalone(req.user!, leaveId, handoverInputSchema.parse(req.body)));
    },
    async update(req: Request, res: Response) {
      res.json(await c.handovers.update(req.user!, String(req.params.id), handoverInputSchema.parse(req.body)));
    },
    async accept(req: Request, res: Response) {
      const { comment } = optionalCommentBody.parse(req.body ?? {});
      res.json(await c.handovers.accept(req.user!, String(req.params.id), comment));
    },
    async decline(req: Request, res: Response) {
      const { comment } = rejectionSchema.parse(req.body);
      res.json(await c.handovers.decline(req.user!, String(req.params.id), comment));
    },
    async complete(req: Request, res: Response) {
      const { comment } = optionalCommentBody.parse(req.body ?? {});
      res.json(await c.handovers.complete(req.user!, String(req.params.id), comment));
    },
    async candidates(req: Request, res: Response) {
      const q = candidateQuery.parse(req.query);
      res.json(await c.handovers.backupCandidates(req.user!, q.startDate, q.endDate, q.excludeLeaveId));
    },
    // ---- tasks ----
    async listAllTasks(req: Request, res: Response) {
      res.json(await c.handovers.listTasks(req.user!, taskListQuery.parse(req.query)));
    },
    async listTasks(req: Request, res: Response) {
      res.json(await c.handovers.tasksForHandover(req.user!, String(req.params.id)));
    },
    async addTask(req: Request, res: Response) {
      res.status(201).json(await c.handovers.addTask(req.user!, String(req.params.id), handoverTaskInputSchema.parse(req.body)));
    },
    async updateTask(req: Request, res: Response) {
      res.json(await c.handovers.updateTask(req.user!, String(req.params.taskId), taskUpdateSchema.parse(req.body)));
    },
    async deleteTask(req: Request, res: Response) {
      await c.handovers.deleteTask(req.user!, String(req.params.taskId));
      res.status(204).end();
    },
  };
}
