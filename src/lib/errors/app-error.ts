export const appErrorCodes = [
  "VALIDATION_ERROR",
  "UNAUTHENTICATED",
  "UNAUTHORIZED",
  "NOT_FOUND",
  "CONFLICT",
  "RATE_LIMITED",
  "PROVIDER_UNAVAILABLE",
  "PROVIDER_DATA_INVALID",
  "CONFIGURATION_MISSING",
  "UNEXPECTED",
] as const;

export type AppErrorCode = (typeof appErrorCodes)[number];

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly metadata?: Record<string, unknown>;

  constructor(
    code: AppErrorCode,
    message: string,
    options?: { cause?: unknown; metadata?: Record<string, unknown> },
  ) {
    super(message, { cause: options?.cause });
    this.name = "AppError";
    this.code = code;
    this.metadata = options?.metadata;
  }
}
