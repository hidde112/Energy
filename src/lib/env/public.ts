import { z } from "zod";
import { AppError } from "@/lib/errors/app-error";

const publicEnvSchema = z
  .object({
    NEXT_PUBLIC_SUPABASE_URL: z.url(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  })
  .strip();

export type PublicEnv = z.infer<typeof publicEnvSchema>;

export function parsePublicEnv(
  input: Record<string, string | undefined>,
): PublicEnv {
  const result = publicEnvSchema.safeParse(input);

  if (!result.success) {
    throw new AppError(
      "CONFIGURATION_MISSING",
      "ENERGYDEX is missing public configuration.",
      {
        cause: result.error,
        metadata: {
          fields: result.error.issues.map((issue) => issue.path.join(".")),
        },
      },
    );
  }

  return result.data;
}
