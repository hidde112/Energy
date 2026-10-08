import type { Barcode } from "@/features/catalog/domain/barcode";
import { normalizeProductName } from "@/features/catalog/domain/normalize";
import type { ProductSummary } from "@/features/catalog/domain/types";
import {
  classifyConfidence,
  type Confidence,
} from "@/features/scanner/domain/confidence";
import type { VisionHypothesis } from "@/features/scanner/providers/contracts";

export const MATCH_WEIGHTS = {
  name: 0.35,
  brand: 0.3,
  variant: 0.15,
  flavor: 0.1,
  size: 0.1,
} as const;

export type MatchableProduct = ProductSummary & {
  aliases?: string[];
  barcodes?: Barcode[];
};

export type MatchSignals = {
  exactBarcode: boolean;
  name: number;
  brand: number;
  variant: number;
  flavor: number;
  size: number;
};

export type RankedCandidate = {
  product: ProductSummary;
  score: number;
  confidence: Confidence;
  signals: MatchSignals;
};

function normalize(value: string | null | undefined) {
  if (!value?.trim()) return "";
  try {
    return normalizeProductName(value);
  } catch {
    return "";
  }
}

function similarity(
  left: string | null | undefined,
  right: string | null | undefined,
) {
  const a = normalize(left);
  const b = normalize(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.85;

  const aTokens = new Set(a.split(" "));
  const bTokens = new Set(b.split(" "));
  const intersection = [...aTokens].filter((token) =>
    bTokens.has(token),
  ).length;
  return (2 * intersection) / (aTokens.size + bTokens.size);
}

function roundScore(score: number) {
  return Math.round(Math.min(1, Math.max(0, score)) * 10_000) / 10_000;
}

export function rankCandidates(
  hypothesis: VisionHypothesis,
  products: MatchableProduct[],
): RankedCandidate[] {
  return products
    .map((product) => {
      const exactBarcode = Boolean(
        hypothesis.barcode &&
        product.barcodes?.some(
          (barcode) => barcode.value === hypothesis.barcode?.value,
        ),
      );
      const name = Math.max(
        similarity(hypothesis.productName, product.name),
        ...(product.aliases ?? []).map((alias) =>
          similarity(hypothesis.productName, alias),
        ),
      );
      const signals: MatchSignals = {
        exactBarcode,
        name,
        brand: similarity(hypothesis.brand, product.brand.name),
        variant: similarity(hypothesis.variant, product.variant),
        flavor: similarity(hypothesis.flavor, product.flavor),
        size:
          hypothesis.sizeMl !== null && product.sizeMl === hypothesis.sizeMl
            ? 1
            : 0,
      };
      const weighted = exactBarcode
        ? 1
        : signals.name * MATCH_WEIGHTS.name +
          signals.brand * MATCH_WEIGHTS.brand +
          signals.variant * MATCH_WEIGHTS.variant +
          signals.flavor * MATCH_WEIGHTS.flavor +
          signals.size * MATCH_WEIGHTS.size;
      const score = roundScore(weighted);
      return { product, score, confidence: classifyConfidence(score), signals };
    })
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.product.id.localeCompare(right.product.id),
    );
}
