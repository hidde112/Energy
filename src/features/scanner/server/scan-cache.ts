import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { VisionHypothesis } from "@/features/scanner/providers/contracts";
import type { IdentificationResult } from "@/features/scanner/server/identification-service";
import { AppError } from "@/lib/errors/app-error";
import type { Database, Json } from "@/lib/supabase/database.types";

export type SaveIdentification = {
  userId: string;
  idempotencyKey: string;
  inputKind: "barcode" | "image" | "camera-frame";
  barcode?: string;
  fingerprint?: string;
  hypothesis?: VisionHypothesis;
  result: IdentificationResult;
};

export interface ScanCache {
  getResult(
    userId: string,
    idempotencyKey: string,
  ): Promise<IdentificationResult | null>;
  getHypothesis(
    userId: string,
    fingerprint: string,
  ): Promise<VisionHypothesis | null>;
  saveResult(input: SaveIdentification): Promise<IdentificationResult>;
}

export class InMemoryScanCache implements ScanCache {
  private readonly results = new Map<string, IdentificationResult>();
  private readonly hypotheses = new Map<string, VisionHypothesis>();

  async getResult(userId: string, idempotencyKey: string) {
    return this.results.get(`${userId}:${idempotencyKey}`) ?? null;
  }

  async getHypothesis(userId: string, fingerprint: string) {
    return this.hypotheses.get(`${userId}:${fingerprint}`) ?? null;
  }

  async saveResult(input: SaveIdentification) {
    const key = `${input.userId}:${input.idempotencyKey}`;
    const existing = this.results.get(key);
    if (existing) return existing;
    this.results.set(key, input.result);
    if (input.fingerprint && input.hypothesis) {
      this.hypotheses.set(
        `${input.userId}:${input.fingerprint}`,
        input.hypothesis,
      );
    }
    return input.result;
  }
}

type StoredUsage = {
  result?: IdentificationResult;
  visionHypothesis?: Omit<VisionHypothesis, "visibleText"> & {
    visibleText: [];
  };
};

function usage(value: Json): StoredUsage {
  return (value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {}) as unknown as StoredUsage;
}

export class SupabaseScanCache implements ScanCache {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async getResult(userId: string, idempotencyKey: string) {
    const found = await this.client
      .from("scans")
      .select("provider_usage")
      .eq("user_id", userId)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    if (found.error) {
      throw new AppError("UNEXPECTED", "Unable to read the scan cache.", {
        cause: found.error,
      });
    }
    return found.data
      ? (usage(found.data.provider_usage).result ?? null)
      : null;
  }

  async getHypothesis(userId: string, fingerprint: string) {
    const found = await this.client
      .from("scans")
      .select("provider_usage")
      .eq("user_id", userId)
      .eq("image_fingerprint", fingerprint)
      .eq("status", "identified")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (found.error) {
      throw new AppError("UNEXPECTED", "Unable to read the image cache.", {
        cause: found.error,
      });
    }
    return found.data
      ? (usage(found.data.provider_usage).visionHypothesis ?? null)
      : null;
  }

  async saveResult(input: SaveIdentification) {
    const sanitizedHypothesis = input.hypothesis
      ? { ...input.hypothesis, visibleText: [] as [] }
      : undefined;
    const inserted = await this.client.from("scans").insert({
      id: input.result.scanId,
      user_id: input.userId,
      idempotency_key: input.idempotencyKey,
      input_kind: input.inputKind,
      barcode: input.barcode ?? null,
      image_fingerprint: input.fingerprint ?? null,
      matched_product_id: input.result.candidates[0]?.product.id ?? null,
      status: "identified",
      provider_usage: {
        source: input.result.source,
        result: input.result,
        visionHypothesis: sanitizedHypothesis,
      } as unknown as NonNullable<Json>,
    });

    if (inserted.error?.code === "23505") {
      const existing = await this.getResult(input.userId, input.idempotencyKey);
      if (existing) return existing;
    }
    if (inserted.error) {
      throw new AppError("UNEXPECTED", "Unable to persist the scan.", {
        cause: inserted.error,
      });
    }

    if (input.result.candidates.length > 0) {
      const candidates = input.result.candidates.map((candidate, index) => ({
        scan_id: input.result.scanId,
        product_id: candidate.product.id,
        position: index + 1,
        score: candidate.score,
        confidence: candidate.confidence,
        hypothesis: candidate.signals as unknown as NonNullable<Json>,
      }));
      const candidateResult = await this.client
        .from("scan_candidates")
        .insert(candidates);
      if (candidateResult.error) {
        throw new AppError("UNEXPECTED", "Unable to persist scan candidates.", {
          cause: candidateResult.error,
        });
      }
    }

    return input.result;
  }
}
