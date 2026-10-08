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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ scanId: string }> },
) {
  const correlationId = request.headers.get("x-request-id") ?? randomUUID();
  try {
    const { scanId } = await params;
    const body = (await request.json()) as Partial<ConfirmScanInput>;
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
