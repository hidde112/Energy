import type { User } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];

export type OnboardingInput = {
  username: string;
  displayName?: string;
};

export type SupabaseErrorLike = {
  code?: string;
  message: string;
};

type UserResult = Promise<{
  data: { user: User | null };
  error: SupabaseErrorLike | null;
}>;

export interface IdentityClient {
  auth: {
    getUser(): UserResult;
    signInAnonymously(): UserResult;
  };
  from(table: "profiles"): {
    select(columns: string): {
      maybeSingle(): Promise<{
        data: Profile | null;
        error: SupabaseErrorLike | null;
      }>;
    };
  };
}

export interface ProfileWriteClient {
  auth: Pick<IdentityClient["auth"], "getUser">;
  from(table: "profiles"): {
    update(values: ProfileUpdate): {
      eq(
        column: "user_id",
        value: string,
      ): {
        select(columns: string): {
          single(): Promise<{
            data: Profile | null;
            error: SupabaseErrorLike | null;
          }>;
        };
      };
    };
  };
}
