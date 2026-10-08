import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { normalizeProductName } from "@/features/catalog/domain/normalize";
import {
  collectionStatuses,
  type CollectionStatus,
} from "@/features/collection/domain/collection";
import type { ActionResult } from "@/lib/actions/action-result";
import { AppError } from "@/lib/errors/app-error";
import { toProblemDetails } from "@/lib/errors/problem-details";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type ProvisionalProductConfirmation = {
  brandName: string;
  name: string;
  flavor?: string;
  variant?: string;
  sizeMl?: number;
  barcode?: string;
  barcodeFormat?: "EAN-8" | "EAN-13" | "UPC-A";
  sourceKind:
    "internal" | "open_food_facts" | "manufacturer" | "user" | "openai";
  sourceUrl?: string;
  providerRecordId?: string;
  fieldNames: string[];
  confidence?: number;
};

export type ScanConfirmation = {
  productId?: string;
  provisionalProduct?: ProvisionalProductConfirmation;
  collectionStatus?: CollectionStatus;
  rating?: number;
  recordTasting?: boolean;
  tastingNotes?: string;
  reviewBody?: string;
};

export type ConfirmScanInput = {
  scanId: string;
  idempotencyKey: string;
  confirmation: ScanConfirmation;
};

export type ConfirmedScan = {
  scanId: string;
  productId: string;
  collectionId: string | null;
  tastingSessionId: string | null;
  reviewId: string | null;
  provisional: boolean;
};

export interface ConfirmScanClient {
  auth: {
    getUser(): Promise<{
      data: { user: { id: string } | null };
      error: { message: string } | null;
    }>;
  };
  rpc(
    name: "confirm_scan",
    args: Record<string, unknown>,
  ): Promise<{
    data: unknown;
    error: { code?: string; message: string } | null;
  }>;
}

const postgresUuid = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu);
const provisionalSchema = z.object({
  brandName: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(180),
  flavor: z.string().trim().max(120).optional(),
  variant: z.string().trim().max(120).optional(),
  sizeMl: z.number().int().positive().max(10_000).optional(),
  barcode: z.string().optional(),
  barcodeFormat: z.enum(["EAN-8", "EAN-13", "UPC-A"]).optional(),
  sourceKind: z.enum([
    "internal",
    "open_food_facts",
    "manufacturer",
    "user",
    "openai",
  ]),
  sourceUrl: z.url().optional(),
  providerRecordId: z.string().max(200).optional(),
  fieldNames: z.array(z.string().min(1).max(80)).min(1).max(30),
  confidence: z.number().min(0).max(1).optional(),
});
const inputSchema = z.object({
  scanId: postgresUuid,
  idempotencyKey: z.string().trim().min(8).max(200),
  confirmation: z
    .object({
      productId: postgresUuid.optional(),
      provisionalProduct: provisionalSchema.optional(),
      collectionStatus: z.enum(collectionStatuses).optional(),
      rating: z
        .number()
        .min(0.5)
        .max(10)
        .refine((value) => Number.isInteger(value * 2))
        .optional(),
      recordTasting: z.boolean().optional(),
      tastingNotes: z.string().trim().max(2_000).optional(),
      reviewBody: z.string().trim().max(4_000).optional(),
    })
    .refine(
      (value) => Boolean(value.productId) !== Boolean(value.provisionalProduct),
      {
        message: "Choose exactly one product confirmation.",
      },
    ),
});
const resultSchema = z.object({
  scanId: z.string(),
  productId: z.string(),
  collectionId: z.string().nullable(),
  tastingSessionId: z.string().nullable(),
  reviewId: z.string().nullable(),
  provisional: z.boolean(),
});

function rpcConfirmation(confirmation: ScanConfirmation) {
  const provisional = confirmation.provisionalProduct;
  return {
    product_id: confirmation.productId,
    provisional_product: provisional
      ? {
          brand_name: provisional.brandName.trim(),
          normalized_brand_name: normalizeProductName(provisional.brandName),
          name: provisional.name.trim(),
          normalized_name: normalizeProductName(provisional.name),
          flavor: provisional.flavor,
          variant: provisional.variant,
          size_ml: provisional.sizeMl,
          barcode: provisional.barcode,
          barcode_format: provisional.barcodeFormat,
          source_kind: provisional.sourceKind,
          source_url: provisional.sourceUrl,
          provider_record_id: provisional.providerRecordId,
          field_names: provisional.fieldNames,
          confidence: provisional.confidence,
        }
      : undefined,
    collection_status: confirmation.collectionStatus,
    rating: confirmation.rating,
    record_tasting: confirmation.recordTasting,
    tasting_notes: confirmation.tastingNotes,
    review_body: confirmation.reviewBody,
  };
}

export async function confirmScanWithClient(
  client: ConfirmScanClient,
  input: ConfirmScanInput,
): Promise<ActionResult<ConfirmedScan>> {
  const correlationId = randomUUID();
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: toProblemDetails(
        new AppError(
          "VALIDATION_ERROR",
          parsed.error.issues[0]?.message ?? "Invalid confirmation.",
        ),
        correlationId,
      ),
    };
  }

  const current = await client.auth.getUser();
  if (current.error || !current.data.user) {
    return {
      ok: false,
      error: toProblemDetails(
        new AppError("UNAUTHENTICATED", "Your guest session has expired."),
        correlationId,
      ),
    };
  }

  const result = await client.rpc("confirm_scan", {
    p_scan_id: parsed.data.scanId,
    p_user_id: current.data.user.id,
    p_confirmation: rpcConfirmation(parsed.data.confirmation),
    p_idempotency_key: parsed.data.idempotencyKey,
  });
  if (result.error) {
    const code =
      result.error.code === "23505"
        ? "CONFLICT"
        : result.error.code === "42501"
          ? "UNAUTHORIZED"
          : result.error.code === "P0002"
            ? "NOT_FOUND"
            : "UNEXPECTED";
    const message =
      code === "CONFLICT"
        ? "That barcode already belongs to another product."
        : code === "UNAUTHORIZED"
          ? "You do not own this scan."
          : code === "NOT_FOUND"
            ? "The scan or product was not found."
            : "Confirmation could not be saved.";
    return {
      ok: false,
      error: toProblemDetails(
        new AppError(code, message, { cause: result.error }),
        correlationId,
      ),
    };
  }

  const confirmed = resultSchema.safeParse(result.data);
  if (!confirmed.success) {
    return {
      ok: false,
      error: toProblemDetails(
        new AppError("UNEXPECTED", "Confirmation returned invalid data."),
        correlationId,
      ),
    };
  }
  return { ok: true, data: confirmed.data };
}

export async function confirmScan(input: ConfirmScanInput) {
  const client =
    (await createServerSupabaseClient()) as unknown as ConfirmScanClient;
  return confirmScanWithClient(client, input);
}
