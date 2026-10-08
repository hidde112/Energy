import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { normalizeBarcode } from "@/features/catalog/domain/barcode";
import { SupabaseCatalogRepository } from "@/features/catalog/server/supabase-catalog-repository";
import type { ScanInput } from "@/features/scanner/domain/scan-input";
import { OpenFoodFactsProvider } from "@/features/scanner/providers/open-food-facts";
import { OpenAiVisionProvider } from "@/features/scanner/providers/openai-vision";
import { IdentificationService } from "@/features/scanner/server/identification-service";
import { SupabaseScanCache } from "@/features/scanner/server/scan-cache";
import { AppError } from "@/lib/errors/app-error";
import { toProblemDetails } from "@/lib/errors/problem-details";
import { DatabaseRateLimiter } from "@/lib/rate-limit/database-rate-limiter";
import { createServerSupabaseClient } from "@/lib/supabase/server";

async function scanInput(request: NextRequest): Promise<ScanInput> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new AppError("VALIDATION_ERROR", "Choose an image to identify.");
    }
    return { kind: "image", file };
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    throw new AppError("VALIDATION_ERROR", "Send a valid scan request.", {
      cause: error,
    });
  }
  const barcode =
    body && typeof body === "object" && "barcode" in body
      ? String(body.barcode)
      : "";
  return { kind: "barcode", barcode: normalizeBarcode(barcode) };
}

export async function POST(request: NextRequest) {
  const correlationId = request.headers.get("x-request-id") ?? randomUUID();
  try {
    const client = await createServerSupabaseClient();
    const auth = await client.auth.getUser();
    if (auth.error || !auth.data.user) {
      throw new AppError("UNAUTHENTICATED", "A guest session is required.");
    }
    const idempotencyKey = request.headers.get("idempotency-key")?.trim();
    if (!idempotencyKey || idempotencyKey.length > 200) {
      throw new AppError(
        "VALIDATION_ERROR",
        "A valid Idempotency-Key header is required.",
      );
    }

    const service = new IdentificationService({
      catalog: new SupabaseCatalogRepository(client),
      productData: new OpenFoodFactsProvider(),
      vision: new OpenAiVisionProvider(),
      cache: new SupabaseScanCache(client),
      rateLimiter: new DatabaseRateLimiter(client),
    });
    const result = await service.identify(
      auth.data.user.id,
      await scanInput(request),
      idempotencyKey,
    );
    return NextResponse.json(result, {
      headers: { "x-correlation-id": correlationId },
    });
  } catch (error) {
    const problem = toProblemDetails(error, correlationId);
    return NextResponse.json(problem, {
      status: problem.status,
      headers: { "x-correlation-id": correlationId },
    });
  }
}
