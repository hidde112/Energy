import type { Database } from "@/lib/supabase/database.types";
import { AppError } from "@/lib/errors/app-error";

export type Review = Database["public"]["Tables"]["reviews"]["Row"];
export type TastingSession =
  Database["public"]["Tables"]["tasting_sessions"]["Row"];

export function parseRating(value: number) {
  if (
    !Number.isFinite(value) ||
    value < 0.5 ||
    value > 10 ||
    !Number.isInteger(value * 2)
  ) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Rating must be between 0.5 and 10 in half-point steps.",
    );
  }

  return value;
}
