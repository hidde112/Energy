import "server-only";

import type {
  ProductDetail,
  ProductSummary,
} from "@/features/catalog/domain/types";
import type { CollectionListItem } from "@/features/collection/domain/collection";
import type { Profile } from "@/features/identity/contracts";
import type { IdentificationResult } from "@/features/scanner/server/identification-service";

export const E2E_USER_COOKIE = "energydex-e2e-user";
export const E2E_PROFILE_COOKIE = "energydex-e2e-profile";
export const E2E_SCAN_COOKIE = "energydex-e2e-scan";
export const E2E_COLLECTION_COOKIE = "energydex-e2e-collection";
export const E2E_REVIEW_COOKIE = "energydex-e2e-review";
export const E2E_PRODUCT_ID = "30000000-0000-0000-0000-000000000001";

export function isE2EMode() {
  return (
    process.env.NODE_ENV !== "production" && process.env.ENERGYDEX_E2E === "1"
  );
}

export function encodeFixture(value: unknown) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

export function decodeFixture<T>(value: string | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

export const fixtureProduct: ProductDetail = {
  id: E2E_PRODUCT_ID,
  name: "Red Bull Energy Drink",
  normalizedName: "red bull energy drink",
  brand: {
    id: "20000000-0000-0000-0000-000000000001",
    name: "Red Bull",
    slug: "red-bull",
  },
  flavor: "Original",
  variant: null,
  sizeMl: 250,
  verificationStatus: "verified",
  image: null,
  productLine: null,
  description: "The original energy drink.",
  countryCode: "AT",
  isSugarFree: false,
  caffeineMgPer100Ml: 32,
  sugarGPer100Ml: 11,
  caloriesPer100Ml: 45,
  sweeteners: null,
  ingredients: null,
  isLimitedEdition: false,
  isDiscontinued: false,
  introducedYear: 1987,
  barcodes: [],
  sources: [],
};

function productSummary(
  id: string,
  name: string,
  brand: string,
): ProductSummary {
  return {
    ...fixtureProduct,
    id,
    name,
    normalizedName: name.toLowerCase(),
    brand: {
      ...fixtureProduct.brand,
      name: brand,
      slug: brand.toLowerCase().replaceAll(" ", "-"),
    },
  };
}

function candidate(product: ProductSummary, score: number) {
  return {
    product,
    score,
    confidence: "medium" as const,
    signals: {
      exactBarcode: false,
      name: score,
      brand: score,
      variant: 0,
      flavor: 0,
      size: 0,
    },
  };
}

export function fixtureIdentification(
  scanId: string,
  kind: "barcode" | "image",
): IdentificationResult {
  if (kind === "barcode") {
    return {
      scanId,
      source: "catalog_barcode",
      confidence: "high",
      candidates: [
        {
          ...candidate(fixtureProduct, 1),
          confidence: "high",
          signals: {
            ...candidate(fixtureProduct, 1).signals,
            exactBarcode: true,
          },
        },
      ],
      externalProduct: null,
      requiresCorrection: false,
    };
  }

  return {
    scanId,
    source: "vision",
    confidence: "medium",
    candidates: [
      candidate(fixtureProduct, 0.78),
      candidate(
        productSummary(
          "30000000-0000-0000-0000-000000000002",
          "Monster Energy Original",
          "Monster",
        ),
        0.7,
      ),
      candidate(
        productSummary(
          "30000000-0000-0000-0000-000000000003",
          "Rockstar Original",
          "Rockstar",
        ),
        0.64,
      ),
    ],
    externalProduct: null,
    requiresCorrection: false,
  };
}

export type E2EScan = {
  ownerId: string;
  result: IdentificationResult;
};

export function fixtureProfile(
  userId: string,
  username: string | null = null,
  displayName: string | null = null,
): Profile {
  const now = new Date().toISOString();
  return {
    user_id: userId,
    username,
    display_name: displayName,
    avatar_path: null,
    bio: null,
    preferred_locale: "en",
    onboarding_completed_at: username ? now : null,
    created_at: now,
    updated_at: now,
  };
}

export function fixtureCollection(): CollectionListItem[] {
  return [
    {
      id: "40000000-0000-0000-0000-000000000001",
      status: "tried",
      note: null,
      product: fixtureProduct,
    },
  ];
}
