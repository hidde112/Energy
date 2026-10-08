import { AppError } from "@/lib/errors/app-error";
import { toProblemDetails } from "@/lib/errors/problem-details";

describe("toProblemDetails", () => {
  it.each([
    ["VALIDATION_ERROR", 400],
    ["UNAUTHENTICATED", 401],
    ["UNAUTHORIZED", 403],
    ["NOT_FOUND", 404],
    ["CONFLICT", 409],
    ["RATE_LIMITED", 429],
    ["PROVIDER_UNAVAILABLE", 503],
    ["CONFIGURATION_MISSING", 503],
  ] as const)("maps %s to HTTP %i", (code, status) => {
    const problem = toProblemDetails(
      new AppError(code, "Safe detail"),
      "corr-123",
    );

    expect(problem).toEqual({
      type: `https://energydex.app/problems/${code.toLowerCase().replaceAll("_", "-")}`,
      title: "Safe detail",
      status,
      code,
      correlationId: "corr-123",
    });
  });

  it("hides unexpected error details while retaining the correlation id", () => {
    const problem = toProblemDetails(
      new Error("database password leaked"),
      "corr-456",
    );

    expect(problem).toEqual({
      type: "https://energydex.app/problems/unexpected",
      title: "An unexpected error occurred.",
      status: 500,
      code: "UNEXPECTED",
      correlationId: "corr-456",
    });
    expect(JSON.stringify(problem)).not.toContain("database password");
  });
});
