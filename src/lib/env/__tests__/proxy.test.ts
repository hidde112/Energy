import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { proxy } from "@/proxy";

afterEach(() => vi.unstubAllEnvs());

function withoutConfiguration(path: string) {
  vi.stubEnv("ENERGYDEX_E2E", "0");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
  return proxy(new NextRequest(`http://localhost${path}`));
}

describe("configuration proxy", () => {
  it("keeps the setup route reachable without Supabase bindings", async () => {
    const response = await withoutConfiguration("/setup");
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("redirects pages to setup when public bindings are missing", async () => {
    const response = await withoutConfiguration("/profile");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/setup");
  });

  it("returns problem details for APIs when public bindings are missing", async () => {
    const response = await withoutConfiguration("/api/scans/identify");
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      code: "CONFIGURATION_MISSING",
      status: 503,
    });
  });
});
