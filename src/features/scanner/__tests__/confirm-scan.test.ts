import { describe, expect, it, vi } from "vitest";
import {
  confirmScanWithClient,
  type ConfirmScanClient,
} from "@/features/scanner/server/confirm-scan";

const userId = "8fca7e30-7c5f-4775-b61e-cd52a965f407";
const scanId = "52000000-0000-0000-0000-000000000001";

function client(
  options: {
    user?: { id: string } | null;
    data?: Record<string, unknown> | null;
    error?: { code?: string; message: string } | null;
  } = {},
): ConfirmScanClient {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: options.user === undefined ? { id: userId } : options.user,
        },
        error: null,
      }),
    },
    rpc: vi.fn().mockResolvedValue({
      data: options.data ?? {
        scanId,
        productId: "30000000-0000-0000-0000-000000000001",
        collectionId: "collection-1",
        tastingSessionId: null,
        reviewId: null,
        provisional: false,
      },
      error: options.error ?? null,
    }),
  };
}

describe("confirmScan", () => {
  it("requires an authenticated owner before calling the RPC", async () => {
    const database = client({ user: null });
    const result = await confirmScanWithClient(database, {
      scanId,
      idempotencyKey: "confirm-once",
      confirmation: { productId: "30000000-0000-0000-0000-000000000001" },
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "UNAUTHENTICATED" },
    });
    expect(database.rpc).not.toHaveBeenCalled();
  });

  it("passes the authenticated user and stable idempotency key to the atomic RPC", async () => {
    const database = client();
    const input = {
      scanId,
      idempotencyKey: "confirm-once",
      confirmation: {
        productId: "30000000-0000-0000-0000-000000000001",
        collectionStatus: "tried" as const,
        rating: 8.5,
      },
    };

    const first = await confirmScanWithClient(database, input);
    const second = await confirmScanWithClient(database, input);

    expect(first).toEqual(second);
    expect(database.rpc).toHaveBeenCalledWith(
      "confirm_scan",
      expect.objectContaining({
        p_scan_id: scanId,
        p_user_id: userId,
        p_idempotency_key: "confirm-once",
      }),
    );
  });

  it("maps a duplicate barcode to a stable conflict", async () => {
    const database = client({
      data: null,
      error: { code: "23505", message: "duplicate barcode" },
    });
    const result = await confirmScanWithClient(database, {
      scanId,
      idempotencyKey: "confirm-conflict",
      confirmation: {
        provisionalProduct: {
          brandName: "Pulse",
          name: "Charge",
          barcode: "9002490100070",
          barcodeFormat: "EAN-13",
          sourceKind: "user",
          fieldNames: ["name"],
        },
      },
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", status: 409 },
    });
  });
});
