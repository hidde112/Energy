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
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  E2E_SCAN_COOKIE,
  E2E_USER_COOKIE,
  encodeFixture,
  fixtureIdentification,
  isE2EMode,
  type E2EScan,
} from "@/lib/e2e/fixtures";

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
    if (isE2EMode()) {
      const userId = request.cookies.get(E2E_USER_COOKIE)?.value;
      if (!userId)
        throw new AppError("UNAUTHENTICATED", "A guest session is required.");
      const input = await scanInput(request);
      if (input.kind === "image" && input.file.name === "provider-outage.jpg") {
        throw new AppError(
          "PROVIDER_UNAVAILABLE",
          "Image identification is temporarily unavailable. Try a barcode instead.",
        );
      }
      const scanId = randomUUID();
      const result = fixtureIdentification(
        scanId,
        input.kind === "barcode" ? "barcode" : "image",
      );
      const response = NextResponse.json(result, {
        headers: { "x-correlation-id": correlationId },
      });
      response.cookies.set(
        E2E_SCAN_COOKIE,
        encodeFixture({ ownerId: userId, result } satisfies E2EScan),
        { httpOnly: true, sameSite: "lax", path: "/" },
      );
      return response;
    }
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

    const admin = createAdminSupabaseClient();
    const service = new IdentificationService({
      catalog: new SupabaseCatalogRepository(client),
      productData: new OpenFoodFactsProvider(),
      vision: new OpenAiVisionProvider(),
      cache: new SupabaseScanCache(admin),
      rateLimiter: new DatabaseRateLimiter(admin),
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
