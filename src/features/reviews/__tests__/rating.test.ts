import { describe, expect, it, vi } from "vitest";
import { parseRating } from "@/features/reviews/domain/rating";
import {
  recordTastingWithClient,
  upsertCurrentReviewWithClient,
  type ReviewWriteClient,
} from "@/features/reviews/server/review-service";

const userId = "8fca7e30-7c5f-4775-b61e-cd52a965f407";
const productId = "30000000-0000-0000-0000-000000000001";

function createClient(): ReviewWriteClient {
  const single = vi
    .fn()
    .mockResolvedValueOnce({
      data: {
        id: "40000000-0000-0000-0000-000000000001",
        user_id: userId,
        product_id: productId,
        tasted_at: "2026-10-08T12:00:00.000Z",
        location: null,
        price: null,
        currency: null,
        store: null,
        notes: null,
        created_at: "2026-10-08T12:00:00.000Z",
      },
      error: null,
    })
    .mockResolvedValueOnce({
      data: {
        id: "40000000-0000-0000-0000-000000000002",
        user_id: userId,
        product_id: productId,
        tasted_at: "2026-10-08T13:00:00.000Z",
        location: null,
        price: null,
        currency: null,
        store: null,
        notes: null,
        created_at: "2026-10-08T13:00:00.000Z",
      },
      error: null,
    })
    .mockResolvedValue({
      data: {
        id: "review-1",
        user_id: userId,
        product_id: productId,
        rating: 8.5,
        body: null,
        tags: [],
        tasting_session_id: "40000000-0000-0000-0000-000000000002",
        taste_rating: null,
        sweetness_rating: null,
        freshness_rating: null,
        aftertaste_rating: null,
        design_rating: null,
        value_rating: null,
        created_at: "2026-10-08T12:00:00.000Z",
        updated_at: "2026-10-08T13:00:00.000Z",
      },
      error: null,
    });

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: userId } },
        error: null,
      }),
    },
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ single }),
      }),
      upsert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ single }),
      }),
    }),
  };
}

describe("ratings", () => {
  it.each([0.5, 1, 7.5, 10])("accepts half-point rating %s", (rating) => {
    expect(parseRating(rating)).toBe(rating);
  });

  it.each([0, 0.4, 7.3, 10.5, Number.NaN])(
    "rejects invalid rating %s",
    (rating) => {
      expect(() => parseRating(rating)).toThrow(/rating/i);
    },
  );

  it("records multiple immutable tastings but upserts one current review", async () => {
    const client = createClient();

    await recordTastingWithClient(client, { productId });
    await recordTastingWithClient(client, { productId });
    const review = await upsertCurrentReviewWithClient(client, {
      productId,
      tastingSessionId: "40000000-0000-0000-0000-000000000002",
      rating: 8.5,
    });

    const tableCalls = vi.mocked(client.from).mock.calls;
    expect(
      tableCalls.filter(([table]) => table === "tasting_sessions"),
    ).toHaveLength(2);
    expect(tableCalls.filter(([table]) => table === "reviews")).toHaveLength(1);
    const reviewBuilder = vi.mocked(client.from).mock.results[2]?.value;
    expect(reviewBuilder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: userId, rating: 8.5 }),
      { onConflict: "user_id,product_id" },
    );
    expect(review).toMatchObject({ ok: true, data: { id: "review-1" } });
  });
});
