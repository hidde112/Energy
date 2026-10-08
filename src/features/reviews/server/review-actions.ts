"use server";

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

async function client() {
  return (await createServerSupabaseClient()) as unknown as ReviewWriteClient;
}

export async function recordTasting(
  input: RecordTastingInput,
): Promise<ActionResult<TastingSession>> {
  return recordTastingWithClient(await client(), input);
}

export async function upsertCurrentReview(
  input: UpsertReviewInput,
): Promise<ActionResult<Review>> {
  return upsertCurrentReviewWithClient(await client(), input);
}
