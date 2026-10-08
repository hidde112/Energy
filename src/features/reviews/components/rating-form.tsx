"use client";

import { useState, type FormEvent } from "react";
import { Star } from "lucide-react";
import {
  parseRating,
  type Review,
  type TastingSession,
} from "@/features/reviews/domain/rating";
import {
  recordTasting,
  upsertCurrentReview,
} from "@/features/reviews/server/review-actions";
import type {
  RecordTastingInput,
  UpsertReviewInput,
} from "@/features/reviews/server/review-service";
import type { ActionResult } from "@/lib/actions/action-result";

export function RatingForm({
  productId,
  initialRating = 7,
  onSave = upsertCurrentReview,
  onRecordTasting = recordTasting,
}: {
  productId: string;
  initialRating?: number;
  onSave?: (input: UpsertReviewInput) => Promise<ActionResult<Review>>;
  onRecordTasting?: (
    input: RecordTastingInput,
  ) => Promise<ActionResult<TastingSession>>;
}) {
  const [rating, setRating] = useState(String(initialRating));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);

    try {
      const value = parseRating(Number(rating));
      const form = new FormData(event.currentTarget);
      let tastingSessionId: string | undefined;

      if (form.get("recordTasting") === "on") {
        const tasting = await onRecordTasting({ productId });
        if (!tasting.ok) {
          setError(tasting.error.title);
          return;
        }
        tastingSessionId = tasting.data.id;
      }

      const result = await onSave({
        productId,
        tastingSessionId,
        rating: value,
        body: String(form.get("body") ?? ""),
      });
      if (!result.ok) {
        setError(result.error.title);
        return;
      }
      setSaved(true);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Rating could not be saved.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="rating-form" onSubmit={handleSubmit}>
      <label htmlFor="rating">Overall rating</label>
      <div className="rating-input">
        <Star aria-hidden="true" fill="currentColor" size={24} />
        <input
          id="rating"
          inputMode="decimal"
          max="10"
          min="0.5"
          onChange={(event) => setRating(event.target.value)}
          required
          step="0.5"
          type="number"
          value={rating}
        />
        <span>/ 10</span>
      </div>
      <label htmlFor="review-body">
        Tasting note <span>(optional)</span>
      </label>
      <textarea id="review-body" maxLength={4000} name="body" rows={4} />
      <label className="check-field">
        <input name="recordTasting" type="checkbox" />
        Record a new tasting session
      </label>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="form-success" role="status">
          Rating saved.
        </p>
      ) : null}
      <button
        className="button button-primary"
        disabled={pending}
        type="submit"
      >
        {pending ? "Saving…" : "Save rating"}
      </button>
    </form>
  );
}
