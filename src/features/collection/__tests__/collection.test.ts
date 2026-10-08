import { describe, expect, it, vi } from "vitest";
import {
  getCollectionFlags,
  transitionCollectionStatus,
} from "@/features/collection/domain/collection";
import {
  setCollectionStatusWithClient,
  type CollectionWriteClient,
} from "@/features/collection/server/collection-service";

const userId = "8fca7e30-7c5f-4775-b61e-cd52a965f407";
const productId = "30000000-0000-0000-0000-000000000001";

function createClient(): CollectionWriteClient {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: userId } },
        error: null,
      }),
    },
    from: vi.fn().mockReturnValue({
      upsert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: "collection-1",
              user_id: userId,
              product_id: productId,
              status: "tried",
              note: null,
              added_at: "2026-10-08T12:00:00.000Z",
              updated_at: "2026-10-08T12:00:00.000Z",
            },
            error: null,
          }),
        }),
      }),
    }),
  };
}

describe("collection state", () => {
  it("keeps trying a drink distinct from physically collecting its can", () => {
    expect(getCollectionFlags("tried")).toEqual({
      hasTried: true,
      physicallyCollected: false,
    });
    expect(getCollectionFlags("collected_physical")).toEqual({
      hasTried: false,
      physicallyCollected: true,
    });
  });

  it("supports archive, reactivate, and idempotent transitions", () => {
    expect(transitionCollectionStatus("favorite", "archived")).toBe("archived");
    expect(transitionCollectionStatus("archived", "tried")).toBe("tried");
    expect(transitionCollectionStatus("tried", "tried")).toBe("tried");
  });

  it("always scopes writes to the authenticated user", async () => {
    const client = createClient();

    await setCollectionStatusWithClient(client, {
      productId,
      status: "tried",
      userId: "attacker-controlled-id",
    } as never);

    const upsert = vi.mocked(client.from).mock.results[0]?.value.upsert;
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: userId, product_id: productId }),
      { onConflict: "user_id,product_id" },
    );
  });
});
