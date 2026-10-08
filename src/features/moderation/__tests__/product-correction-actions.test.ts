import { describe, expect, it, vi } from "vitest";
import {
  correctProvisionalProductWithClient,
  type ProductCorrectionClient,
} from "@/features/moderation/server/product-correction-service";

function client(role: "user" | "moderator"): ProductCorrectionClient {
  return {
    auth: {
      getUser: vi
        .fn()
        .mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: role === "moderator" ? { role } : null,
              error: null,
            }),
          }),
        }),
      }),
    }),
    rpc: vi.fn().mockResolvedValue({
      data: {
        id: "product-1",
        name: "Corrected",
        verification_status: "verified",
      },
      error: null,
    }),
  };
}

describe("product correction", () => {
  it("denies non-moderators before any correction write", async () => {
    const database = client("user");
    const result = await correctProvisionalProductWithClient(database, {
      productId: "30000000-0000-0000-0000-000000000001",
      name: "Corrected",
      verificationStatus: "verified",
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "UNAUTHORIZED" },
    });
    expect(database.rpc).not.toHaveBeenCalled();
  });

  it("delegates moderator correction and audit creation to one RPC", async () => {
    const database = client("moderator");
    const result = await correctProvisionalProductWithClient(database, {
      productId: "30000000-0000-0000-0000-000000000001",
      name: "Corrected",
      verificationStatus: "verified",
    });

    expect(result).toMatchObject({ ok: true, data: { name: "Corrected" } });
    expect(database.rpc).toHaveBeenCalledOnce();
    expect(database.rpc).toHaveBeenCalledWith(
      "correct_provisional_product",
      expect.objectContaining({ p_correlation_id: expect.any(String) }),
    );
  });
});
