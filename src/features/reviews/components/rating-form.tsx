"use client";

import { useRef, useState, type FormEvent } from "react";
import { Star } from "lucide-react";
import { parseRating } from "@/features/reviews/domain/rating";
import {
  saveRating,
  type SavedRating,
  type SaveRatingInput,
} from "@/features/reviews/server/review-actions";
import type { ActionResult } from "@/lib/actions/action-result";

export function RatingForm({
  productId,
  initialRating = 7,
  onSave = saveRating,
}: {
  productId: string;
  initialRating?: number;
  onSave?: (input: SaveRatingInput) => Promise<ActionResult<SavedRating>>;
}) {
  const [rating, setRating] = useState(String(initialRating));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const idempotencyKey = useRef(crypto.randomUUID());

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);

    try {
      const value = parseRating(Number(rating));
      const form = new FormData(event.currentTarget);
      const result = await onSave({
        productId,
        rating: value,
        body: String(form.get("body") ?? ""),
        recordTasting: form.get("recordTasting") === "on",
        idempotencyKey: idempotencyKey.current,
      });
      if (!result.ok) {
        setError(result.error.title);
        return;
      }
      setSaved(true);
      idempotencyKey.current = crypto.randomUUID();
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
