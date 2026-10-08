import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/errors/app-error";
import type { Database } from "@/lib/supabase/database.types";

export interface RateLimiter {
  consume(
    userId: string,
    action: string,
    limit: number,
    windowMs: number,
  ): Promise<boolean>;
}

export class DatabaseRateLimiter implements RateLimiter {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async consume(
    userId: string,
    action: string,
    limit: number,
    windowMs: number,
  ) {
    const since = new Date(Date.now() - windowMs).toISOString();
    const countResult = await this.client
      .from("rate_limit_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("action", action)
      .gte("occurred_at", since);

    if (countResult.error) {
      throw new AppError("UNEXPECTED", "Unable to check the request limit.", {
        cause: countResult.error,
      });
    }
    if ((countResult.count ?? 0) >= limit) return false;

    const insertResult = await this.client
      .from("rate_limit_events")
      .insert({ user_id: userId, action });
    if (insertResult.error) {
      throw new AppError("UNEXPECTED", "Unable to record the request limit.", {
        cause: insertResult.error,
      });
    }
    return true;
  }
}
