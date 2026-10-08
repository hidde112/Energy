import { AppError } from "@/lib/errors/app-error";

export function normalizeProductName(input: string) {
  const normalized = input
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/gu, " ");

  if (!normalized) {
    throw new AppError("VALIDATION_ERROR", "Enter a valid product name.");
  }

  return normalized;
}
