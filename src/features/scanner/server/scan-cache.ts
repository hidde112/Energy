import "server-only";

import { randomUUID } from "node:crypto";
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

export type IdentificationClaim =
  | { state: "claimed"; scanId: string; hypothesis?: VisionHypothesis }
  | { state: "existing"; scanId: string; result: IdentificationResult }
  | { state: "in_progress"; scanId: string };

export type ClaimIdentification = {
  userId: string;
  idempotencyKey: string;
  inputKind: "barcode" | "image" | "camera-frame";
  barcode?: string;
  fingerprint?: string;
};

export interface ScanCache {
  claim(input: ClaimIdentification): Promise<IdentificationClaim>;
  getResult(
    userId: string,
    idempotencyKey: string,
  ): Promise<IdentificationResult | null>;
  getHypothesis(
    userId: string,
    fingerprint: string,
  ): Promise<VisionHypothesis | null>;
  saveHypothesis(
    scanId: string,
    userId: string,
    fingerprint: string,
    hypothesis: VisionHypothesis,
  ): Promise<void>;
  markFailed(
    scanId: string,
    userId: string,
    failureCode: string,
  ): Promise<void>;
  saveResult(input: SaveIdentification): Promise<IdentificationResult>;
}

export class InMemoryScanCache implements ScanCache {
  private readonly results = new Map<string, IdentificationResult>();
  private readonly hypotheses = new Map<string, VisionHypothesis>();
  private readonly pending = new Map<
    string,
    { scanId: string; fingerprint?: string }
  >();

  async claim(input: ClaimIdentification): Promise<IdentificationClaim> {
    const key = `${input.userId}:${input.idempotencyKey}`;
    const existing = this.results.get(key);
    if (existing) {
      return { state: "existing", scanId: existing.scanId, result: existing };
    }
    const active = this.pending.get(key);
    if (active) return { state: "in_progress", scanId: active.scanId };
    if (input.fingerprint) {
      const sameImage = [...this.pending.values()].find(
        (claim) => claim.fingerprint === input.fingerprint,
      );
      if (sameImage) return { state: "in_progress", scanId: sameImage.scanId };
    }
    const scanId = randomUUID();
    this.pending.set(key, { scanId, fingerprint: input.fingerprint });
    return {
      state: "claimed",
      scanId,
      hypothesis: input.fingerprint
        ? this.hypotheses.get(`${input.userId}:${input.fingerprint}`)
        : undefined,
    };
  }

  async getResult(userId: string, idempotencyKey: string) {
    return this.results.get(`${userId}:${idempotencyKey}`) ?? null;
  }

  async getHypothesis(userId: string, fingerprint: string) {
    return this.hypotheses.get(`${userId}:${fingerprint}`) ?? null;
  }

  async saveHypothesis(
    _scanId: string,
    userId: string,
    fingerprint: string,
    hypothesis: VisionHypothesis,
  ) {
    this.hypotheses.set(`${userId}:${fingerprint}`, hypothesis);
  }

  async markFailed(scanId: string, userId: string) {
    for (const [key, claim] of this.pending) {
      if (key.startsWith(`${userId}:`) && claim.scanId === scanId) {
        this.pending.delete(key);
      }
    }
  }

  async saveResult(input: SaveIdentification) {
    const key = `${input.userId}:${input.idempotencyKey}`;
    const existing = this.results.get(key);
    if (existing) return existing;
    this.results.set(key, input.result);
    this.pending.delete(key);
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

  async claim(input: ClaimIdentification): Promise<IdentificationClaim> {
    const proposedScanId = randomUUID();
    const claimed = await this.client.rpc("claim_identification", {
      p_user_id: input.userId,
      p_input_kind: input.inputKind,
      p_idempotency_key: input.idempotencyKey,
      p_barcode: input.barcode ?? "",
      p_fingerprint: input.fingerprint ?? "",
      p_scan_id: proposedScanId,
    });
    if (claimed.error) {
      throw new AppError("UNEXPECTED", "Unable to claim identification work.", {
        cause: claimed.error,
      });
    }
    const value = usage(claimed.data as Json) as {
      state?: string;
      scanId?: string;
      result?: IdentificationResult;
      hypothesis?: VisionHypothesis;
    };
    if (!value.scanId || !value.state) {
      throw new AppError("UNEXPECTED", "Identification claim was invalid.");
    }
    if (value.state === "existing" && value.result) {
      return { state: "existing", scanId: value.scanId, result: value.result };
    }
    if (value.state === "claimed") {
      return {
        state: "claimed",
        scanId: value.scanId,
        hypothesis: value.hypothesis,
      };
    }
    if (value.state === "in_progress") {
      return { state: "in_progress", scanId: value.scanId };
    }
    throw new AppError("UNEXPECTED", "Identification claim was invalid.");
  }

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
      .in("status", ["pending", "identified", "failed"])
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

  async saveHypothesis(
    scanId: string,
    userId: string,
    fingerprint: string,
    hypothesis: VisionHypothesis,
  ) {
    const sanitized = { ...hypothesis, visibleText: [] as [] };
    const saved = await this.client.rpc("save_identification_hypothesis", {
      p_scan_id: scanId,
      p_user_id: userId,
      p_fingerprint: fingerprint,
      p_hypothesis: sanitized as unknown as Json,
    });
    if (saved.error) {
      throw new AppError("UNEXPECTED", "Unable to cache vision output.", {
        cause: saved.error,
      });
    }
  }

  async markFailed(scanId: string, userId: string, failureCode: string) {
    const failed = await this.client.rpc("fail_identification", {
      p_scan_id: scanId,
      p_user_id: userId,
      p_failure_code: failureCode,
    });
    if (failed.error) {
      throw new AppError(
        "UNEXPECTED",
        "Unable to release identification work.",
        {
          cause: failed.error,
        },
      );
    }
  }

  async saveResult(input: SaveIdentification) {
    const sanitizedHypothesis = input.hypothesis
      ? { ...input.hypothesis, visibleText: [] as [] }
      : undefined;
    const candidates = input.result.candidates.map((candidate, index) => ({
      scan_id: input.result.scanId,
      product_id: candidate.product.id,
      position: index + 1,
      score: candidate.score,
      confidence: candidate.confidence,
      hypothesis: candidate.signals as unknown as NonNullable<Json>,
    }));
    const completed = await this.client.rpc("complete_identification", {
      p_scan_id: input.result.scanId,
      p_user_id: input.userId,
      p_result: input.result as unknown as Json,
      p_hypothesis: (sanitizedHypothesis ?? null) as unknown as Json,
      p_candidates: candidates as unknown as Json,
    });
    if (completed.error) {
      throw new AppError("UNEXPECTED", "Unable to persist identification.", {
        cause: completed.error,
      });
    }
    return completed.data as unknown as IdentificationResult;
  }
}
