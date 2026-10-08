import { describe, expect, it } from "vitest";
import {
  assertDeploymentPage,
  assertPwaManifest,
} from "@/lib/smoke/live-contracts";

function response(body: BodyInit, options: ResponseInit & { url: string }) {
  const value = new Response(body, options);
  Object.defineProperty(value, "url", { value: options.url });
  return value;
}

describe("live smoke response contracts", () => {
  it("rejects a deployment that silently redirects to setup", async () => {
    const value = response("<h1>Setup ENERGYDEX</h1>", {
      status: 200,
      headers: { "content-type": "text/html" },
      url: "https://energydex.test/setup",
    });

    await expect(assertDeploymentPage(value)).rejects.toThrow(
      /redirected to setup/i,
    );
  });

  it("requires the ENERGYDEX application shell", async () => {
    const value = response("<html><h1>ENERGYDEX</h1></html>", {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
      url: "https://energydex.test/",
    });

    await expect(assertDeploymentPage(value)).resolves.toBeUndefined();
  });

  it("rejects setup HTML returned for the manifest URL", async () => {
    const value = response("<h1>Setup ENERGYDEX</h1>", {
      status: 200,
      headers: { "content-type": "text/html" },
      url: "https://energydex.test/setup",
    });

    await expect(assertPwaManifest(value)).rejects.toThrow(/manifest/i);
  });

  it("accepts the expected installable manifest contract", async () => {
    const value = response(
      JSON.stringify({
        name: "ENERGYDEX",
        start_url: "/",
        display: "standalone",
      }),
      {
        status: 200,
        headers: { "content-type": "application/manifest+json" },
        url: "https://energydex.test/manifest.webmanifest",
      },
    );

    await expect(assertPwaManifest(value)).resolves.toBeUndefined();
  });
});
