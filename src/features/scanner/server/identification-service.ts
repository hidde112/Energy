import "server-only";

import type { CatalogRepository } from "@/features/catalog/server/catalog-repository";
import type { ProductDetail } from "@/features/catalog/domain/types";
import {
  classifyConfidence,
  type Confidence,
} from "@/features/scanner/domain/confidence";
import {
  rankCandidates,
  type RankedCandidate,
} from "@/features/scanner/domain/matching";
import type { ScanInput } from "@/features/scanner/domain/scan-input";
import type {
  ExternalProduct,
  PreparedImage,
  ProductDataProvider,
  VisionProvider,
} from "@/features/scanner/providers/contracts";
import { preprocessScanImage } from "@/features/scanner/server/image-preprocessor";
import type { ScanCache } from "@/features/scanner/server/scan-cache";
import { AppError } from "@/lib/errors/app-error";
import type { RateLimiter } from "@/lib/rate-limit/database-rate-limiter";

export type IdentificationSource =
  | "catalog_barcode"
  | "external_barcode"
  | "barcode_not_found"
  | "vision"
  | "vision_cache";

export type IdentificationResult = {
  scanId: string;
  source: IdentificationSource;
  confidence: Confidence;
  candidates: RankedCandidate[];
  externalProduct: ExternalProduct | null;
  requiresCorrection: boolean;
};

type IdentificationDependencies = {
  catalog: CatalogRepository;
  productData: ProductDataProvider;
  vision: VisionProvider;
  cache: ScanCache;
  rateLimiter: RateLimiter;
  prepareImage?: (file: Blob) => Promise<PreparedImage>;
};

function summary(product: ProductDetail) {
  return {
    id: product.id,
    name: product.name,
    normalizedName: product.normalizedName,
    brand: product.brand,
    flavor: product.flavor,
    variant: product.variant,
    sizeMl: product.sizeMl,
    verificationStatus: product.verificationStatus,
    image: product.image,
  };
}

export class IdentificationService {
  private readonly prepareImage: (file: Blob) => Promise<PreparedImage>;

  constructor(private readonly dependencies: IdentificationDependencies) {
    this.prepareImage = dependencies.prepareImage ?? preprocessScanImage;
  }

  async identify(
    userId: string,
    input: ScanInput,
    idempotencyKey: string,
  ): Promise<IdentificationResult> {
    if (input.kind === "barcode") {
      const claim = await this.dependencies.cache.claim({
        userId,
        idempotencyKey,
        inputKind: "barcode",
        barcode: input.barcode.value,
      });
      if (claim.state === "existing") return claim.result;
      if (claim.state === "in_progress") {
        throw new AppError(
          "CONFLICT",
          "This identification is already in progress. Retry shortly.",
        );
      }
      try {
        await this.consumeRateLimit(userId);
        return await this.identifyBarcode(
          userId,
          input.barcode,
          idempotencyKey,
          claim.scanId,
        );
      } catch (error) {
        await this.releaseClaim(claim.scanId, userId, error);
        throw error;
      }
    }

    const blob = input.kind === "image" ? input.file : input.frame;
    const prepared = await this.prepareImage(blob);
    const claim = await this.dependencies.cache.claim({
      userId,
      idempotencyKey,
      inputKind: input.kind,
      fingerprint: prepared.sha256,
    });
    if (claim.state === "existing") return claim.result;
    if (claim.state === "in_progress") {
      throw new AppError(
        "CONFLICT",
        "This image is already being identified. Retry shortly.",
      );
    }

    try {
      await this.consumeRateLimit(userId);
      let hypothesis =
        claim.hypothesis ??
        (await this.dependencies.cache.getHypothesis(userId, prepared.sha256));
      const source: IdentificationSource = hypothesis
        ? "vision_cache"
        : "vision";
      if (!hypothesis) {
        hypothesis = await this.dependencies.vision.identify(
          prepared,
          new AbortController().signal,
        );
        await this.dependencies.cache.saveHypothesis(
          claim.scanId,
          userId,
          prepared.sha256,
          hypothesis,
        );
      }

      const queries = [
        hypothesis.productName,
        [hypothesis.brand, hypothesis.productName].filter(Boolean).join(" "),
        hypothesis.brand,
        hypothesis.variant,
      ].filter((value, index, values): value is string =>
        Boolean(value && values.indexOf(value) === index),
      );
      const candidateGroups = await Promise.all(
        queries.map((query) =>
          this.dependencies.catalog.findCandidates(query, 12),
        ),
      );
      const products = [
        ...new Map(
          candidateGroups.flat().map((product) => [product.id, product]),
        ).values(),
      ];
      const ranked = rankCandidates(hypothesis, products);
      const confidence = ranked[0]
        ? classifyConfidence(ranked[0].score)
        : "low";
      const candidateLimit = confidence === "high" ? 1 : 3;
      const result: IdentificationResult = {
        scanId: claim.scanId,
        source,
        confidence,
        candidates: ranked.slice(0, candidateLimit),
        externalProduct: null,
        requiresCorrection: confidence === "low",
      };
      return await this.dependencies.cache.saveResult({
        userId,
        idempotencyKey,
        inputKind: input.kind,
        fingerprint: prepared.sha256,
        hypothesis,
        result,
      });
    } catch (error) {
      await this.releaseClaim(claim.scanId, userId, error);
      throw error;
    }
  }

  private async consumeRateLimit(userId: string) {
    const allowed = await this.dependencies.rateLimiter.consume(
      userId,
      "identify",
      20,
      60 * 60 * 1_000,
    );
    if (!allowed) {
      throw new AppError("RATE_LIMITED", "Too many identification requests.");
    }
  }

  private async releaseClaim(scanId: string, userId: string, error: unknown) {
    const failureCode = error instanceof AppError ? error.code : "UNEXPECTED";
    try {
      await this.dependencies.cache.markFailed(scanId, userId, failureCode);
    } catch {
      // Preserve the original provider/persistence error. The database lease
      // expires and can still be reclaimed if releasing it also fails.
    }
  }

  private async identifyBarcode(
    userId: string,
    barcode: Extract<ScanInput, { kind: "barcode" }>["barcode"],
    idempotencyKey: string,
    scanId: string,
  ) {
    const catalogProduct =
      await this.dependencies.catalog.findByBarcode(barcode);
    if (catalogProduct) {
      const candidate: RankedCandidate = {
        product: summary(catalogProduct),
        score: 1,
        confidence: "high",
        signals: {
          exactBarcode: true,
          name: 0,
          brand: 0,
          variant: 0,
          flavor: 0,
          size: 0,
        },
      };
      const result: IdentificationResult = {
        scanId,
        source: "catalog_barcode",
        confidence: "high",
        candidates: [candidate],
        externalProduct: null,
        requiresCorrection: false,
      };
      return this.dependencies.cache.saveResult({
        userId,
        idempotencyKey,
        inputKind: "barcode",
        barcode: barcode.value,
        result,
      });
    }

    const externalProduct = await this.dependencies.productData.lookupBarcode(
      barcode,
      new AbortController().signal,
    );
    const result: IdentificationResult = {
      scanId,
      source: externalProduct ? "external_barcode" : "barcode_not_found",
      confidence: externalProduct ? "high" : "low",
      candidates: [],
      externalProduct,
      requiresCorrection: !externalProduct,
    };
    return this.dependencies.cache.saveResult({
      userId,
      idempotencyKey,
      inputKind: "barcode",
      barcode: barcode.value,
      result,
    });
  }
}
