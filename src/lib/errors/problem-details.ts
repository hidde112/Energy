import { AppError, type AppErrorCode } from "@/lib/errors/app-error";

const errorStatuses: Record<AppErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  UNAUTHORIZED: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  PROVIDER_UNAVAILABLE: 503,
  PROVIDER_DATA_INVALID: 502,
  CONFIGURATION_MISSING: 503,
  UNEXPECTED: 500,
};

export type ProblemDetails = {
  type: string;
  title: string;
  status: number;
  code: AppErrorCode;
  correlationId: string;
};

function problemType(code: AppErrorCode) {
  return `https://energydex.app/problems/${code.toLowerCase().replaceAll("_", "-")}`;
}

export function toProblemDetails(
  error: unknown,
  correlationId: string,
): ProblemDetails {
  if (error instanceof AppError) {
    return {
      type: problemType(error.code),
      title: error.message,
      status: errorStatuses[error.code],
      code: error.code,
      correlationId,
    };
  }

  return {
    type: problemType("UNEXPECTED"),
    title: "An unexpected error occurred.",
    status: errorStatuses.UNEXPECTED,
    code: "UNEXPECTED",
    correlationId,
  };
}
