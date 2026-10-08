import "server-only";

import { randomUUID } from "node:crypto";
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
    const existing = await this.dependencies.cache.getResult(
      userId,
      idempotencyKey,
    );
    if (existing) return existing;

    const allowed = await this.dependencies.rateLimiter.consume(
      userId,
      "identify",
      20,
      60 * 60 * 1_000,
    );
    if (!allowed) {
      throw new AppError("RATE_LIMITED", "Too many identification requests.");
    }

    if (input.kind === "barcode") {
      return this.identifyBarcode(userId, input.barcode, idempotencyKey);
    }

    const blob = input.kind === "image" ? input.file : input.frame;
    const prepared = await this.prepareImage(blob);
    let hypothesis = await this.dependencies.cache.getHypothesis(
      userId,
      prepared.sha256,
    );
    const source: IdentificationSource = hypothesis ? "vision_cache" : "vision";
    if (!hypothesis) {
      hypothesis = await this.dependencies.vision.identify(
        prepared,
        new AbortController().signal,
      );
    }

    const query = [hypothesis.brand, hypothesis.productName, hypothesis.variant]
      .filter(Boolean)
      .join(" ");
    const products = query
      ? await this.dependencies.catalog.findCandidates(query, 12)
      : [];
    const ranked = rankCandidates(hypothesis, products);
    const confidence = ranked[0] ? classifyConfidence(ranked[0].score) : "low";
    const candidateLimit = confidence === "high" ? 1 : 3;
    const result: IdentificationResult = {
      scanId: randomUUID(),
      source,
      confidence,
      candidates: ranked.slice(0, candidateLimit),
      externalProduct: null,
      requiresCorrection: confidence === "low",
    };
    return this.dependencies.cache.saveResult({
      userId,
      idempotencyKey,
      inputKind: input.kind,
      fingerprint: prepared.sha256,
      hypothesis,
      result,
    });
  }

  private async identifyBarcode(
    userId: string,
    barcode: Extract<ScanInput, { kind: "barcode" }>["barcode"],
    idempotencyKey: string,
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
        scanId: randomUUID(),
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
      scanId: randomUUID(),
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
