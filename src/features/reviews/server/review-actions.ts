"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import type { Review, TastingSession } from "@/features/reviews/domain/rating";
import {
  recordTastingWithClient,
  upsertCurrentReviewWithClient,
  type RecordTastingInput,
  type ReviewWriteClient,
  type UpsertReviewInput,
} from "@/features/reviews/server/review-service";
import type { ActionResult } from "@/lib/actions/action-result";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  E2E_REVIEW_COOKIE,
  E2E_USER_COOKIE,
  encodeFixture,
  isE2EMode,
} from "@/lib/e2e/fixtures";

async function e2eClient(): Promise<ReviewWriteClient> {
  const store = await cookies();
  const userId = store.get(E2E_USER_COOKIE)?.value;
  const now = new Date().toISOString();
  return {
    auth: {
      getUser: async () => ({
        data: { user: userId ? { id: userId } : null },
        error: null,
      }),
    },
    from: () => ({
      insert: (values) => ({
        select: () => ({
          single: async () => ({
            data: {
              id: randomUUID(),
              created_at: now,
              tasted_at: now,
              location: null,
              price: null,
              currency: null,
              store: null,
              notes: null,
              ...values,
            } as TastingSession,
            error: null,
          }),
        }),
      }),
      upsert: (values) => ({
        select: () => ({
          single: async () => {
            const review = {
              id: randomUUID(),
              created_at: now,
              updated_at: now,
              tasting_session_id: null,
              body: null,
              tags: [],
              taste_rating: null,
              sweetness_rating: null,
              freshness_rating: null,
              design_rating: null,
              value_rating: null,
              aftertaste_rating: null,
              ...values,
            } as unknown as Review;
            store.set(E2E_REVIEW_COOKIE, encodeFixture(review), {
              httpOnly: true,
              sameSite: "lax",
              path: "/",
            });
            return { data: review, error: null };
          },
        }),
      }),
    }),
  } as ReviewWriteClient;
}

async function client() {
  return (await createServerSupabaseClient()) as unknown as ReviewWriteClient;
}

export async function recordTasting(
  input: RecordTastingInput,
): Promise<ActionResult<TastingSession>> {
  return recordTastingWithClient(
    isE2EMode() ? await e2eClient() : await client(),
    input,
  );
}

export async function upsertCurrentReview(
  input: UpsertReviewInput,
): Promise<ActionResult<Review>> {
  return upsertCurrentReviewWithClient(
    isE2EMode() ? await e2eClient() : await client(),
    input,
  );
}
