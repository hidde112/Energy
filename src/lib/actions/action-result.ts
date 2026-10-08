import type { ProblemDetails } from "@/lib/errors/problem-details";

export type ActionResult<T> =
  { ok: true; data: T } | { ok: false; error: ProblemDetails };
