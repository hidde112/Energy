import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  parseRating,
  type Review,
  type TastingSession,
} from "@/features/reviews/domain/rating";
import type { ActionResult } from "@/lib/actions/action-result";
import { AppError } from "@/lib/errors/app-error";
import { toProblemDetails } from "@/lib/errors/problem-details";

export type RecordTastingInput = {
  productId: string;
  tastedAt?: string;
  location?: string;
  price?: number;
  currency?: string;
  store?: string;
  notes?: string;
};

export type UpsertReviewInput = {
  productId: string;
  tastingSessionId?: string;
  rating: number;
  body?: string;
  tags?: string[];
};

type ReviewWriteResult = Promise<{
  data: Review | TastingSession | null;
  error: { code?: string; message: string } | null;
}>;

export interface ReviewWriteClient {
  auth: {
    getUser(): Promise<{
      data: { user: { id: string } | null };
      error: { message: string } | null;
    }>;
  };
  from(table: "tasting_sessions" | "reviews"): {
    insert(values: Record<string, unknown>): {
      select(columns: string): { single(): ReviewWriteResult };
    };
    upsert(
      values: Record<string, unknown>,
      options: { onConflict: string },
    ): { select(columns: string): { single(): ReviewWriteResult } };
  };
}

const postgresUuid = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu);

const tastingSchema = z.object({
  productId: postgresUuid,
  tastedAt: z.string().datetime().optional(),
  location: z.string().trim().max(120).optional(),
  price: z.number().nonnegative().max(100_000).optional(),
  currency: z.string().trim().length(3).toUpperCase().optional(),
  store: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(2_000).optional(),
});

const reviewSchema = z.object({
  productId: postgresUuid,
  tastingSessionId: postgresUuid.optional(),
  rating: z.number(),
  body: z.string().trim().max(4_000).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
});

function failure<T>(error: AppError, correlationId: string): ActionResult<T> {
  return { ok: false, error: toProblemDetails(error, correlationId) };
}

async function currentUser(client: ReviewWriteClient) {
  const result = await client.auth.getUser();
  if (result.error || !result.data.user) {
    throw new AppError("UNAUTHENTICATED", "Your guest session has expired.", {
      cause: result.error,
    });
  }
  return result.data.user;
}

export async function recordTastingWithClient(
  client: ReviewWriteClient,
  input: RecordTastingInput,
): Promise<ActionResult<TastingSession>> {
  const correlationId = randomUUID();
  const parsed = tastingSchema.safeParse(input);
  if (!parsed.success) {
    return failure(
      new AppError("VALIDATION_ERROR", "Enter valid tasting details."),
      correlationId,
    );
  }

  try {
    const user = await currentUser(client);
    const result = await client
      .from("tasting_sessions")
      .insert({
        user_id: user.id,
        product_id: parsed.data.productId,
        tasted_at: parsed.data.tastedAt,
        location: parsed.data.location || null,
        price: parsed.data.price,
        currency: parsed.data.currency,
        store: parsed.data.store || null,
        notes: parsed.data.notes || null,
      })
      .select("*")
      .single();

    if (result.error || !result.data) throw result.error;
    return { ok: true, data: result.data as TastingSession };
  } catch (error) {
    return failure(
      error instanceof AppError
        ? error
        : new AppError("UNEXPECTED", "Tasting could not be saved.", {
            cause: error,
          }),
      correlationId,
    );
  }
}

export async function upsertCurrentReviewWithClient(
  client: ReviewWriteClient,
  input: UpsertReviewInput,
): Promise<ActionResult<Review>> {
  const correlationId = randomUUID();
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) {
    return failure(
      new AppError("VALIDATION_ERROR", "Enter valid review details."),
      correlationId,
    );
  }

  try {
    const rating = parseRating(parsed.data.rating);
    const user = await currentUser(client);
    const result = await client
      .from("reviews")
      .upsert(
        {
          user_id: user.id,
          product_id: parsed.data.productId,
          tasting_session_id: parsed.data.tastingSessionId || null,
          rating,
          body: parsed.data.body || null,
          tags: parsed.data.tags ?? [],
        },
        { onConflict: "user_id,product_id" },
      )
      .select("*")
      .single();

    if (result.error || !result.data) throw result.error;
    return { ok: true, data: result.data as Review };
  } catch (error) {
    return failure(
      error instanceof AppError
        ? error
        : new AppError("UNEXPECTED", "Rating could not be saved.", {
            cause: error,
          }),
      correlationId,
    );
  }
}
