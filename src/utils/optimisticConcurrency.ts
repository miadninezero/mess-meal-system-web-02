export class ConcurrencyConflictError extends Error {
  readonly code = 'CONCURRENCY_CONFLICT';
  readonly recordLabel: string;
  readonly expectedVersion: number | null;
  readonly actualVersion: number | null;

  constructor(params: {
    recordLabel: string;
    expectedVersion: number | null;
    actualVersion: number | null;
    message?: string;
  }) {
    super(
      params.message ||
        `This ${params.recordLabel} was modified by another user while you were editing. Please reload the latest data before saving.`
    );
    this.name = 'ConcurrencyConflictError';
    this.recordLabel = params.recordLabel;
    this.expectedVersion = params.expectedVersion;
    this.actualVersion = params.actualVersion;
  }
}

export function isConcurrencyConflictError(err: unknown): err is ConcurrencyConflictError {
  return (
    err instanceof ConcurrencyConflictError ||
    (typeof err === 'object' &&
      err !== null &&
      ((err as { code?: unknown }).code === 'CONCURRENCY_CONFLICT' ||
        (err as { name?: unknown }).name === 'ConcurrencyConflictError'))
  );
}

/**
 * Normalizes stored document versions. Legacy documents created before
 * optimistic concurrency control was introduced default to version 0.
 */
export function normalizeVersion(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return Math.floor(value);
  }
  return 0;
}

/**
 * Validates optimistic concurrency preconditions inside a transaction and
 * returns the next incremented version number to persist.
 */
export function assertAndNextVersion(params: {
  exists: boolean;
  currentVersion: unknown;
  expectedVersion: number | null;
  recordLabel: string;
}): number {
  if (!params.exists) {
    if (params.expectedVersion === null) {
      return 1;
    }
    throw new ConcurrencyConflictError({
      recordLabel: params.recordLabel,
      expectedVersion: params.expectedVersion,
      actualVersion: null,
      message: `This ${params.recordLabel} was removed or updated by another user. Reload the latest data and try again.`,
    });
  }

  const actualVersion = normalizeVersion(params.currentVersion);
  if (params.expectedVersion === null || params.expectedVersion !== actualVersion) {
    throw new ConcurrencyConflictError({
      recordLabel: params.recordLabel,
      expectedVersion: params.expectedVersion,
      actualVersion,
    });
  }

  return actualVersion + 1;
}
