import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Database } from "@/lib/supabase/database.types";
import type { ActionResult } from "@/lib/actions/action-result";
import { AppError } from "@/lib/errors/app-error";
import { toProblemDetails } from "@/lib/errors/problem-details";
import { normalizeProductName } from "@/features/catalog/domain/normalize";

export type Product = Database["public"]["Tables"]["products"]["Row"];
export type ProductCorrectionInput = {
  productId: string;
  name: string;
  flavor?: string;
  variant?: string;
  sizeMl?: number;
  verificationStatus: "community_confirmed" | "verified" | "rejected";
};

export interface ProductCorrectionClient {
  auth: {
    getUser(): Promise<{
      data: { user: { id: string } | null };
      error: { message: string } | null;
    }>;
  };
  from(table: "app_user_roles"): {
    select(columns: string): {
      eq(
        column: "user_id",
        value: string,
      ): {
        in(
          column: "role",
          values: string[],
        ): {
          maybeSingle(): Promise<{
            data: { role: string } | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
  };
  rpc(
    name: "correct_provisional_product",
    args: Record<string, unknown>,
  ): Promise<{
    data: unknown;
    error: { code?: string; message: string } | null;
  }>;
}

const postgresUuid = z.string().regex(/^[0-9a-f-]{36}$/iu);
const correctionSchema = z.object({
  productId: postgresUuid,
  name: z.string().trim().min(1).max(180),
  flavor: z.string().trim().max(120).optional(),
  variant: z.string().trim().max(120).optional(),
  sizeMl: z.number().int().positive().max(10_000).optional(),
  verificationStatus: z.enum(["community_confirmed", "verified", "rejected"]),
});

export async function correctProvisionalProductWithClient(
  client: ProductCorrectionClient,
  input: ProductCorrectionInput,
): Promise<ActionResult<Product>> {
  const correlationId = randomUUID();
  const parsed = correctionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: toProblemDetails(
        new AppError("VALIDATION_ERROR", "Enter a valid catalog correction."),
        correlationId,
      ),
    };
  }
  const current = await client.auth.getUser();
  if (current.error || !current.data.user) {
    return {
      ok: false,
      error: toProblemDetails(
        new AppError("UNAUTHENTICATED", "Sign in to moderate products."),
        correlationId,
      ),
    };
  }
  const role = await client
    .from("app_user_roles")
    .select("role")
    .eq("user_id", current.data.user.id)
    .in("role", ["moderator", "admin"])
    .maybeSingle();
  if (role.error || !role.data) {
    return {
      ok: false,
      error: toProblemDetails(
        new AppError("UNAUTHORIZED", "Moderator access is required."),
        correlationId,
      ),
    };
  }
  const result = await client.rpc("correct_provisional_product", {
    p_product_id: parsed.data.productId,
    p_correction: {
      name: parsed.data.name,
      normalized_name: normalizeProductName(parsed.data.name),
      flavor: parsed.data.flavor,
      variant: parsed.data.variant,
      size_ml: parsed.data.sizeMl,
      verification_status: parsed.data.verificationStatus,
    },
    p_correlation_id: correlationId,
  });
  if (result.error) {
    return {
      ok: false,
      error: toProblemDetails(
        new AppError("UNEXPECTED", "The correction could not be saved.", {
          cause: result.error,
        }),
        correlationId,
      ),
    };
  }
  return { ok: true, data: result.data as Product };
}
