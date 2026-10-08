import { AppError } from "@/lib/errors/app-error";
import { parsePublicEnv } from "@/lib/env/public";
import { parseServerEnv } from "@/lib/env/server";

const publicVariables = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
};

describe("runtime configuration", () => {
  it("returns only browser-safe values from public configuration", () => {
    const configuration = parsePublicEnv({
      ...publicVariables,
      SUPABASE_SERVICE_ROLE_KEY: "service-secret",
      OPENAI_API_KEY: "openai-secret",
    });

    expect(configuration).toEqual(publicVariables);
    expect(configuration).not.toHaveProperty("SUPABASE_SERVICE_ROLE_KEY");
    expect(configuration).not.toHaveProperty("OPENAI_API_KEY");
  });

  it("reports missing public configuration with a stable code", () => {
    expect(() => parsePublicEnv({})).toThrowError(
      expect.objectContaining<Partial<AppError>>({
        code: "CONFIGURATION_MISSING",
      }),
    );
  });

  it("requires server credentials only when server configuration is parsed", () => {
    expect(() => parseServerEnv(publicVariables)).toThrowError(
      expect.objectContaining<Partial<AppError>>({
        code: "CONFIGURATION_MISSING",
      }),
    );

    expect(
      parseServerEnv({
        ...publicVariables,
        SUPABASE_SERVICE_ROLE_KEY: "service-secret",
        OPENAI_API_KEY: "openai-secret",
      }),
    ).toEqual({
      ...publicVariables,
      SUPABASE_SERVICE_ROLE_KEY: "service-secret",
      OPENAI_API_KEY: "openai-secret",
    });
  });
});
