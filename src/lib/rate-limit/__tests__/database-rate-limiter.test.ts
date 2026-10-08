import { describe, expect, it, vi } from "vitest";
import { DatabaseRateLimiter } from "@/lib/rate-limit/database-rate-limiter";

describe("DatabaseRateLimiter", () => {
  it("consumes a quota slot through one atomic database RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    const client = { rpc };
    const limiter = new DatabaseRateLimiter(client as never);

    await expect(
      limiter.consume("user-1", "identify", 20, 3_600_000),
    ).resolves.toBe(true);
    expect(rpc).toHaveBeenCalledWith("consume_rate_limit", {
      p_user_id: "user-1",
      p_action: "identify",
      p_limit: 20,
      p_window_ms: 3_600_000,
    });
    expect(rpc).toHaveBeenCalledOnce();
  });
});
