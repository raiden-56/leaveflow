import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import multer from 'multer';
import { badRequest } from '../utils/errors.js';

const ATTACHMENT_TYPES = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.doc', '.docx']);
const SHEET_TYPES = new Set(['.xlsx', '.csv']);

/** Leave attachments (medical certificates etc.), stored on disk with random names. */
export function attachmentUpload(uploadDir: string) {
  fs.mkdirSync(uploadDir, { recursive: true });
  return multer({
    storage: multer.diskStorage({
      destination: uploadDir,
      filename: (_req, file, cb) => cb(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
    }),
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) => {
      if (ATTACHMENT_TYPES.has(path.extname(file.originalname).toLowerCase())) cb(null, true);
      else cb(badRequest('Only PDF, image or Word documents up to 5 MB are allowed'));
    },
  });
}

/** Excel imports are parsed in memory and never written to disk. */
export const spreadsheetUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (SHEET_TYPES.has(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(badRequest('Upload an .xlsx file'));
  },
});
