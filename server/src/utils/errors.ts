export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (message: string, details?: unknown) => new AppError(400, 'BAD_REQUEST', message, details);
export const validationError = (message: string, details?: unknown) =>
  new AppError(422, 'VALIDATION_ERROR', message, details);
export const unauthorized = (message = 'Authentication required') => new AppError(401, 'UNAUTHORIZED', message);
export const forbidden = (message = 'You do not have permission to perform this action') =>
  new AppError(403, 'FORBIDDEN', message);
export const notFound = (entity: string, id?: string) =>
  new AppError(404, 'NOT_FOUND', id ? `${entity} ${id} was not found` : `${entity} was not found`);
export const conflict = (message: string, details?: unknown) => new AppError(409, 'CONFLICT', message, details);
export const locked = (message: string) => new AppError(423, 'RESOURCE_LOCKED', message);

/** Throws a 422 when business rule validation produced errors. */
export function assertNoErrors(errors: string[]): void {
  if (errors.length > 0) throw validationError(errors[0], { errors });
}

export interface ErrorResponse {
  status: number;
  body: { error: { code: string; message: string; details?: unknown } };
}

/**
 * Maps any thrown value to the API's error shape. Shared by the Express error
 * middleware and the in-browser API used for the static (GitHub Pages) build.
 */
export function toErrorResponse(err: unknown): ErrorResponse | null {
  if (err instanceof AppError) {
    return { status: err.status, body: { error: { code: err.code, message: err.message, details: err.details } } };
  }
  const e = err as { name?: string; issues?: { path: (string | number)[]; message: string }[]; message?: string; body?: unknown };
  if (e?.name === 'ZodError' && Array.isArray(e.issues)) {
    const issues = e.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    const first = issues[0];
    return {
      status: 422,
      body: { error: { code: 'VALIDATION_ERROR', message: first ? `${first.path ? `${first.path}: ` : ''}${first.message}` : 'Invalid request', details: { issues } } },
    };
  }
  if (e?.name === 'MulterError') return { status: 400, body: { error: { code: 'UPLOAD_ERROR', message: e.message ?? 'Upload failed' } } };
  if (err instanceof SyntaxError && 'body' in (err as object)) {
    return { status: 400, body: { error: { code: 'BAD_JSON', message: 'Malformed JSON body' } } };
  }
  return null;
}
