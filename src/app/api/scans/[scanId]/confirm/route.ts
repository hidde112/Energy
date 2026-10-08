import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import {
  confirmScanWithClient,
  type ConfirmScanClient,
  type ConfirmScanInput,
} from "@/features/scanner/server/confirm-scan";
import { AppError } from "@/lib/errors/app-error";
import { toProblemDetails } from "@/lib/errors/problem-details";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  decodeFixture,
  E2E_COLLECTION_COOKIE,
  E2E_PRODUCT_ID,
  E2E_SCAN_COOKIE,
  E2E_USER_COOKIE,
  encodeFixture,
  fixtureCollection,
  isE2EMode,
  type E2EScan,
} from "@/lib/e2e/fixtures";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ scanId: string }> },
) {
  const correlationId = request.headers.get("x-request-id") ?? randomUUID();
  try {
    const { scanId } = await params;
    const body = (await request.json()) as Partial<ConfirmScanInput>;
    if (isE2EMode()) {
      const userId = request.cookies.get(E2E_USER_COOKIE)?.value;
      const scan = decodeFixture<E2EScan>(
        request.cookies.get(E2E_SCAN_COOKIE)?.value,
      );
      if (
        !userId ||
        !scan ||
        scan.ownerId !== userId ||
        scan.result.scanId !== scanId
      ) {
        throw new AppError("NOT_FOUND", "The scan or product was not found.");
      }
      const result = {
        ok: true as const,
        data: {
          scanId,
          productId: body.confirmation?.productId ?? E2E_PRODUCT_ID,
          collectionId: "40000000-0000-0000-0000-000000000001",
          tastingSessionId: null,
          reviewId: null,
          provisional: Boolean(body.confirmation?.provisionalProduct),
        },
      };
      const response = NextResponse.json(result, {
        headers: { "x-correlation-id": correlationId },
      });
      response.cookies.set(
        E2E_COLLECTION_COOKIE,
        encodeFixture(fixtureCollection()),
        {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
        },
      );
      return response;
    }
    const client =
      (await createServerSupabaseClient()) as unknown as ConfirmScanClient;
    const result = await confirmScanWithClient(client, {
      scanId,
      idempotencyKey: String(body.idempotencyKey ?? ""),
      confirmation: body.confirmation ?? {},
    });
    if (!result.ok) {
      return NextResponse.json(result, {
        status: result.error.status,
        headers: { "x-correlation-id": result.error.correlationId },
      });
    }
    return NextResponse.json(result, {
      headers: { "x-correlation-id": correlationId },
    });
  } catch (error) {
    const problem = toProblemDetails(
      error instanceof SyntaxError
        ? new AppError("VALIDATION_ERROR", "Send a valid confirmation request.")
        : error,
      correlationId,
    );
    return NextResponse.json(
      { ok: false, error: problem },
      { status: problem.status },
    );
  }
}
