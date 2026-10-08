import { describe, expect, it } from "vitest";
import type { ProductSummary } from "@/features/catalog/domain/types";
import {
  MATCH_WEIGHTS,
  rankCandidates,
  type MatchableProduct,
} from "@/features/scanner/domain/matching";
import {
  HIGH_CONFIDENCE_THRESHOLD,
  MEDIUM_CONFIDENCE_THRESHOLD,
  classifyConfidence,
} from "@/features/scanner/domain/confidence";
import type { VisionHypothesis } from "@/features/scanner/providers/contracts";

function product(overrides: Partial<MatchableProduct> = {}): MatchableProduct {
  const base: ProductSummary = {
    id: "product-1",
    name: "Red Bull Energy Drink",
    normalizedName: "red bull energy drink",
    brand: { id: "brand-1", name: "Red Bull", slug: "red-bull" },
    flavor: null,
    variant: "Original",
    sizeMl: 250,
    verificationStatus: "verified",
    image: null,
  };
  return { ...base, aliases: [], barcodes: [], ...overrides };
}

const hypothesis: VisionHypothesis = {
  brand: "Red Bull",
  productName: "Energy Drink",
  flavor: null,
  variant: "Original",
  sizeMl: 250,
  barcode: null,
  confidence: 0.9,
  visibleText: [],
};

describe("candidate matching", () => {
  it("always ranks an exact barcode above every fuzzy signal", () => {
    const exact = product({
      id: "exact",
      name: "Different label",
      normalizedName: "different label",
      brand: { id: "other", name: "Other", slug: "other" },
      variant: null,
      sizeMl: null,
      barcodes: [{ value: "9002490100070", format: "EAN-13" }],
    });
    const fuzzy = product({ id: "fuzzy" });

    const ranked = rankCandidates(
      {
        ...hypothesis,
        barcode: { value: "9002490100070", format: "EAN-13" },
      },
      [fuzzy, exact],
    );

    expect(ranked[0]).toMatchObject({ product: { id: "exact" }, score: 1 });
  });

  it("uses deterministic brand, alias, variant, flavor, and size weights", () => {
    const aliasMatch = product({
      id: "alias",
      name: "RB Classic",
      normalizedName: "rb classic",
      aliases: ["energy drink"],
      flavor: "Original",
    });
    const brandOnly = product({
      id: "brand-only",
      name: "Tropical Edition",
      normalizedName: "tropical edition",
      variant: null,
      sizeMl: 500,
    });

    const ranked = rankCandidates(hypothesis, [brandOnly, aliasMatch]);

    expect(ranked.map((candidate) => candidate.product.id)).toEqual([
      "alias",
      "brand-only",
    ]);
    expect(MATCH_WEIGHTS).toEqual({
      name: 0.35,
      brand: 0.3,
      variant: 0.15,
      flavor: 0.1,
      size: 0.1,
    });
  });

  it("classifies named confidence thresholds", () => {
    expect(classifyConfidence(HIGH_CONFIDENCE_THRESHOLD)).toBe("high");
    expect(classifyConfidence(MEDIUM_CONFIDENCE_THRESHOLD)).toBe("medium");
    expect(classifyConfidence(MEDIUM_CONFIDENCE_THRESHOLD - 0.001)).toBe("low");
  });
});
