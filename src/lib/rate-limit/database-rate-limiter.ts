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
    const consumed = await this.client.rpc("consume_rate_limit", {
      p_user_id: userId,
      p_action: action,
      p_limit: limit,
      p_window_ms: windowMs,
    });
    if (consumed.error) {
      throw new AppError("UNEXPECTED", "Unable to consume the request limit.", {
        cause: consumed.error,
      });
    }
    return consumed.data;
  }
}
