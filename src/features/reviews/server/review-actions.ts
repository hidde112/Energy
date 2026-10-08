"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";
import { parseRating } from "@/features/reviews/domain/rating";
import type { ActionResult } from "@/lib/actions/action-result";
import {
  E2E_REVIEW_COOKIE,
  E2E_USER_COOKIE,
  encodeFixture,
  isE2EMode,
} from "@/lib/e2e/fixtures";
import { AppError } from "@/lib/errors/app-error";
import { toProblemDetails } from "@/lib/errors/problem-details";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type SaveRatingInput = {
  productId: string;
  rating: number;
  body?: string;
  recordTasting: boolean;
  idempotencyKey: string;
};

export type SavedRating = {
  reviewId: string;
  tastingSessionId: string | null;
  rating: number;
};

const postgresUuid = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu);
const inputSchema = z.object({
  productId: postgresUuid,
  rating: z.number(),
  body: z.string().trim().max(4_000).optional(),
  recordTasting: z.boolean(),
  idempotencyKey: z.string().trim().min(8).max(200),
});
const resultSchema = z.object({
  reviewId: z.string(),
  tastingSessionId: z.string().nullable(),
  rating: z.number(),
});

export async function saveRating(
  input: SaveRatingInput,
): Promise<ActionResult<SavedRating>> {
  const correlationId = randomUUID();
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: toProblemDetails(
        new AppError("VALIDATION_ERROR", "Enter valid rating details."),
        correlationId,
      ),
    };
  }

  let rating: number;
  try {
    rating = parseRating(parsed.data.rating);
  } catch (error) {
    return { ok: false, error: toProblemDetails(error, correlationId) };
  }

  if (isE2EMode()) {
    const store = await cookies();
    if (!store.get(E2E_USER_COOKIE)?.value) {
      return {
        ok: false,
        error: toProblemDetails(
          new AppError("UNAUTHENTICATED", "Your guest session has expired."),
          correlationId,
        ),
      };
    }
    const saved: SavedRating = {
      reviewId: "73000000-0000-0000-0000-000000000001",
      tastingSessionId: parsed.data.recordTasting
        ? "72000000-0000-0000-0000-000000000001"
        : null,
      rating,
    };
    store.set(E2E_REVIEW_COOKIE, encodeFixture({ rating }), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
    return { ok: true, data: saved };
  }

  const client = await createServerSupabaseClient();
  const current = await client.auth.getUser();
  if (current.error || !current.data.user) {
    return {
      ok: false,
      error: toProblemDetails(
        new AppError("UNAUTHENTICATED", "Your guest session has expired."),
        correlationId,
      ),
    };
  }

  const result = await client.rpc("save_rating", {
    p_user_id: current.data.user.id,
    p_input: {
      product_id: parsed.data.productId,
      rating,
      body: parsed.data.body || null,
      notes: parsed.data.body || null,
      record_tasting: parsed.data.recordTasting,
    },
    p_idempotency_key: parsed.data.idempotencyKey,
  });
  if (result.error) {
    const code =
      result.error.code === "42501"
        ? "UNAUTHORIZED"
        : result.error.code === "P0002"
          ? "NOT_FOUND"
          : result.error.code === "22023"
            ? "VALIDATION_ERROR"
            : "UNEXPECTED";
    return {
      ok: false,
      error: toProblemDetails(
        new AppError(code, "Rating could not be saved.", {
          cause: result.error,
        }),
        correlationId,
      ),
    };
  }

  const saved = resultSchema.safeParse(result.data);
  if (!saved.success) {
    return {
      ok: false,
      error: toProblemDetails(
        new AppError("UNEXPECTED", "Rating returned invalid data."),
        correlationId,
      ),
    };
  }
  return { ok: true, data: saved.data };
}
