import { describe, expect, it, vi } from "vitest";
import type { Barcode } from "@/features/catalog/domain/barcode";
import type { CatalogRepository } from "@/features/catalog/server/catalog-repository";
import type {
  ProductDetail,
  ProductSummary,
} from "@/features/catalog/domain/types";
import { AppError } from "@/lib/errors/app-error";
import {
  IdentificationService,
  type IdentificationResult,
} from "@/features/scanner/server/identification-service";
import { InMemoryScanCache } from "@/features/scanner/server/scan-cache";
import type {
  ProductDataProvider,
  VisionHypothesis,
  VisionProvider,
} from "@/features/scanner/providers/contracts";

const userId = "8fca7e30-7c5f-4775-b61e-cd52a965f407";
const barcode: Barcode = { value: "9002490100070", format: "EAN-13" };
const summary: ProductSummary = {
  id: "30000000-0000-0000-0000-000000000001",
  name: "Red Bull Energy Drink",
  normalizedName: "red bull energy drink",
  brand: { id: "brand-1", name: "Red Bull", slug: "red-bull" },
  flavor: null,
  variant: "Original",
  sizeMl: 250,
  verificationStatus: "verified",
  image: null,
};
const detail: ProductDetail = {
  ...summary,
  productLine: null,
  description: null,
  countryCode: null,
  isSugarFree: null,
  caffeineMgPer100Ml: null,
  sugarGPer100Ml: null,
  caloriesPer100Ml: null,
  sweeteners: null,
  ingredients: null,
  isLimitedEdition: null,
  isDiscontinued: null,
  introducedYear: null,
  barcodes: [barcode],
  sources: [],
};
const hypothesis: VisionHypothesis = {
  brand: "Red Bull",
  productName: "Energy Drink",
  flavor: null,
  variant: "Original",
  sizeMl: 250,
  barcode: null,
  confidence: 0.9,
  visibleText: ["Red Bull"],
};

function dependencies(
  options: {
    catalogProduct?: ProductDetail | null;
    candidates?: ProductSummary[];
    allowed?: boolean;
    visionError?: Error;
  } = {},
) {
  const catalog: CatalogRepository = {
    findByBarcode: vi.fn().mockResolvedValue(options.catalogProduct ?? null),
    search: vi.fn().mockResolvedValue([]),
    getById: vi.fn().mockResolvedValue(null),
    findCandidates: vi.fn().mockResolvedValue(options.candidates ?? [summary]),
  };
  const productData: ProductDataProvider = {
    lookupBarcode: vi.fn().mockResolvedValue(null),
  };
  const vision: VisionProvider = {
    identify: options.visionError
      ? vi.fn().mockRejectedValue(options.visionError)
      : vi.fn().mockResolvedValue(hypothesis),
  };
  const cache = new InMemoryScanCache();
  const rateLimiter = {
    consume: vi.fn().mockResolvedValue(options.allowed ?? true),
  };
  const prepareImage = vi.fn().mockResolvedValue({
    bytes: Buffer.from("prepared"),
    mimeType: "image/jpeg" as const,
    width: 100,
    height: 200,
    sha256: "fingerprint-1",
  });

  return { catalog, productData, vision, cache, rateLimiter, prepareImage };
}

describe("IdentificationService", () => {
  it("returns an exact catalog barcode hit without invoking paid vision", async () => {
    const deps = dependencies({ catalogProduct: detail });
    const service = new IdentificationService(deps);

    const result = await service.identify(
      userId,
      { kind: "barcode", barcode },
      "barcode-once",
    );

    expect(result).toMatchObject({
      confidence: "high",
      source: "catalog_barcode",
    });
    expect(result.candidates).toHaveLength(1);
    expect(deps.vision.identify).not.toHaveBeenCalled();
    expect(deps.productData.lookupBarcode).not.toHaveBeenCalled();
  });

  it("uses one candidate for high, at most three for medium, and correction for low", async () => {
    const products = [
      summary,
      { ...summary, id: "product-2", name: "Red Bull Original" },
      { ...summary, id: "product-3", name: "Red Bull Classic" },
      { ...summary, id: "product-4", name: "Red Bull Zero", sizeMl: 500 },
    ];
    const high = dependencies({ candidates: products });
    const highResult = await new IdentificationService(high).identify(
      userId,
      { kind: "image", file: new File(["image"], "can.jpg") },
      "high",
    );
    expect(highResult.candidates).toHaveLength(1);

    const mediumProducts = products.map((candidate, index) => ({
      ...candidate,
      id: `medium-${index}`,
      name: "Energy Drink",
      normalizedName: "energy drink",
      brand: { id: "other", name: "Other", slug: "other" },
    }));
    const medium = dependencies({ candidates: mediumProducts });
    const mediumResult = await new IdentificationService(medium).identify(
      userId,
      { kind: "image", file: new File(["image"], "can.jpg") },
      "medium",
    );
    expect(mediumResult.confidence).toBe("medium");
    expect(mediumResult.candidates).toHaveLength(3);

    const low = dependencies({ candidates: [] });
    const lowResult = await new IdentificationService(low).identify(
      userId,
      { kind: "image", file: new File(["image"], "can.jpg") },
      "low",
    );
    expect(lowResult).toMatchObject({
      confidence: "low",
      requiresCorrection: true,
    });
    expect(lowResult.candidates.length).toBeLessThanOrEqual(3);
  });

  it("reuses an image fingerprint without a second inference", async () => {
    const deps = dependencies();
    const service = new IdentificationService(deps);
    const input = {
      kind: "image",
      file: new File(["same"], "can.jpg"),
    } as const;

    await service.identify(userId, input, "first-key");
    await service.identify(userId, input, "second-key");

    expect(deps.vision.identify).toHaveBeenCalledOnce();
  });

  it("returns the original result for an idempotency-key retry", async () => {
    const deps = dependencies();
    const service = new IdentificationService(deps);
    const input = {
      kind: "image",
      file: new File(["same"], "can.jpg"),
    } as const;

    const first = await service.identify(userId, input, "same-key");
    const second = await service.identify(userId, input, "same-key");

    expect(second).toEqual<IdentificationResult>(first);
    expect(deps.rateLimiter.consume).toHaveBeenCalledOnce();
  });

  it("throws RATE_LIMITED before provider work", async () => {
    const deps = dependencies({ allowed: false });
    const service = new IdentificationService(deps);

    await expect(
      service.identify(
        userId,
        { kind: "image", file: new File(["image"], "can.jpg") },
        "limited",
      ),
    ).rejects.toMatchObject({ code: "RATE_LIMITED" });
    expect(deps.vision.identify).not.toHaveBeenCalled();
  });

  it("does not persist a result or mutate catalog data after a provider timeout", async () => {
    const deps = dependencies({
      visionError: new AppError("PROVIDER_UNAVAILABLE", "Vision timed out."),
    });
    const service = new IdentificationService(deps);

    await expect(
      service.identify(
        userId,
        { kind: "image", file: new File(["image"], "can.jpg") },
        "timeout",
      ),
    ).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
    await expect(deps.cache.getResult(userId, "timeout")).resolves.toBeNull();
    expect(deps.catalog.findCandidates).not.toHaveBeenCalled();
  });
});
