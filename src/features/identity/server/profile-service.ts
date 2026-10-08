import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import type {
  OnboardingInput,
  Profile,
  ProfileWriteClient,
} from "@/features/identity/contracts";
import type { ActionResult } from "@/lib/actions/action-result";
import { AppError } from "@/lib/errors/app-error";
import { toProblemDetails } from "@/lib/errors/problem-details";

const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9][a-z0-9_]{2,29}$/u, {
    message:
      "Use 3–30 lowercase letters, numbers, or underscores, starting with a letter or number.",
  });

const displayNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(60)
  .refine((value) => !/[\p{Cc}\p{Cf}]/u.test(value), {
    message: "Display names cannot contain control characters.",
  })
  .transform((value) => value.normalize("NFC"));

const onboardingSchema = z.object({
  username: usernameSchema,
  displayName: z.union([displayNameSchema, z.literal("")]).optional(),
});

function fail(error: unknown, correlationId: string): ActionResult<never> {
  return { ok: false, error: toProblemDetails(error, correlationId) };
}

export async function completeOnboardingWithClient(
  client: ProfileWriteClient,
  input: OnboardingInput,
): Promise<ActionResult<Profile>> {
  const correlationId = randomUUID();
  const parsed = onboardingSchema.safeParse(input);

  if (!parsed.success) {
    return fail(
      new AppError(
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message ?? "Invalid profile.",
      ),
      correlationId,
    );
  }

  const current = await client.auth.getUser();
  if (current.error || !current.data.user) {
    return fail(
      new AppError("UNAUTHENTICATED", "Your guest session has expired.", {
        cause: current.error,
      }),
      correlationId,
    );
  }

  const result = await client
    .from("profiles")
    .update({
      username: parsed.data.username,
      display_name: parsed.data.displayName || null,
      onboarding_completed_at: new Date().toISOString(),
    })
    .eq("user_id", current.data.user.id)
    .select("*")
    .single();

  if (result.error?.code === "23505") {
    return fail(
      new AppError("CONFLICT", "That username is already taken."),
      correlationId,
    );
  }

  if (result.error || !result.data) {
    return fail(
      new AppError("UNEXPECTED", "Unable to save your profile.", {
        cause: result.error,
      }),
      correlationId,
    );
  }

  return { ok: true, data: result.data };
}
