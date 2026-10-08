import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";
import OfflinePage from "@/app/offline/page";

describe("PWA", () => {
  it("exposes an installable manifest with theme and maskable icons", () => {
    const value = manifest();
    expect(value.display).toBe("standalone");
    expect(value.theme_color).toBe("#b9ff38");
    expect(value.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          src: "/icons/icon-192.png",
          sizes: "192x192",
        }),
        expect.objectContaining({
          src: "/icons/icon-512.png",
          sizes: "512x512",
        }),
        expect.objectContaining({
          src: "/icons/maskable-512.png",
          purpose: "maskable",
        }),
      ]),
    );
  });

  it("renders an explicit offline recovery state", () => {
    render(<OfflinePage />);
    expect(
      screen.getByRole("heading", { name: /offline/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /try again/i })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("caches only static GETs and never queues private mutations", async () => {
    const worker = await readFile(join(process.cwd(), "public/sw.js"), "utf8");
    expect(worker).toContain('request.method !== "GET"');
    expect(worker).toContain('caches.match("/offline")');
    expect(worker).not.toMatch(/sync|indexedDB|POST|mutation/iu);
  });
});
