import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  collectionStatuses,
  type CollectionEntry,
  type CollectionStatus,
} from "@/features/collection/domain/collection";
import type { ActionResult } from "@/lib/actions/action-result";
import { AppError } from "@/lib/errors/app-error";
import { toProblemDetails } from "@/lib/errors/problem-details";

export type SetCollectionStatusInput = {
  productId: string;
  status: CollectionStatus;
  note?: string;
};

type WriteResult = Promise<{
  data: CollectionEntry | null;
  error: { code?: string; message: string } | null;
}>;

export interface CollectionWriteClient {
  auth: {
    getUser(): Promise<{
      data: { user: { id: string } | null };
      error: { message: string } | null;
    }>;
  };
  from(table: "user_collections"): {
    upsert(
      values: Record<string, unknown>,
      options: { onConflict: string },
    ): { select(columns: string): { single(): WriteResult } };
  };
}

const inputSchema = z.object({
  productId: z
    .string()
    .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu),
  status: z.enum(collectionStatuses),
  note: z.string().trim().max(500).optional(),
});

export async function setCollectionStatusWithClient(
  client: CollectionWriteClient,
  input: SetCollectionStatusInput,
): Promise<ActionResult<CollectionEntry>> {
  const correlationId = randomUUID();
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: toProblemDetails(
        new AppError("VALIDATION_ERROR", "Choose a valid collection status."),
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

  const result = await client
    .from("user_collections")
    .upsert(
      {
        user_id: current.data.user.id,
        product_id: parsed.data.productId,
        status: parsed.data.status,
        note: parsed.data.note || null,
      },
      { onConflict: "user_id,product_id" },
    )
    .select("*")
    .single();

  if (result.error || !result.data) {
    return {
      ok: false,
      error: toProblemDetails(
        new AppError("UNEXPECTED", "Could not update your collection.", {
          cause: result.error,
        }),
        correlationId,
      ),
    };
  }

  return { ok: true, data: result.data };
}
