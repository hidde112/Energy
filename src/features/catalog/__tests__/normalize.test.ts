import { describe, expect, it } from "vitest";
import { normalizeProductName } from "@/features/catalog/domain/normalize";

describe("normalizeProductName", () => {
  it.each([
    ["  Crème BRÛLÉE—Energy  ", "creme brulee energy"],
    ["Monster   Ultra / Violet", "monster ultra violet"],
    ["MØNSTER  日本", "mønster 日本"],
  ])("normalizes %s for accent and case-safe matching", (input, expected) => {
    expect(normalizeProductName(input)).toBe(expected);
  });

  it("rejects an empty normalized name", () => {
    expect(() => normalizeProductName(" — ")).toThrow(/product name/i);
  });
});
