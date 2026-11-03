/// <reference types="multer" />
import type { Employee } from '@leaveflow/shared';

declare global {
  namespace Express {
    interface Request {
      user?: Employee;
    }
  }
}

export {};
