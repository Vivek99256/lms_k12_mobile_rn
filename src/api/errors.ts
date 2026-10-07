export type ApiErrorKind =
  | 'network'
  | 'timeout'
  | 'unauthorized' // token missing/expired/rejected -> sign out
  | 'forbidden' // authenticated but not allowed
  | 'validation'
  | 'server'
  | 'config';

export class ApiError extends Error {
  constructor(
    readonly kind: ApiErrorKind,
    message: string,
    readonly status?: number,
    readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Errors where retrying cannot help. */
  get isFinal(): boolean {
    return this.kind === 'unauthorized' || this.kind === 'forbidden' || this.kind === 'validation' || this.kind === 'config';
  }
}

export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError;

export function userMessage(e: unknown): string {
  if (isApiError(e)) return e.message;
  return 'Something went wrong. Please try again.';
}
