import { z } from "zod";
import { AppError } from "@/lib/errors/app-error";

const serverEnvSchema = z
  .object({
    NEXT_PUBLIC_SUPABASE_URL: z.url(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    OPENAI_API_KEY: z.string().min(1),
  })
  .strip();

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parseServerEnv(
  input: Record<string, string | undefined>,
): ServerEnv {
  const result = serverEnvSchema.safeParse(input);

  if (!result.success) {
    throw new AppError(
      "CONFIGURATION_MISSING",
      "ENERGYDEX is missing server configuration.",
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
