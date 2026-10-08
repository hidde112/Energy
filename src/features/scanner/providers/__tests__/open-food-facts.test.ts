import { afterEach, describe, expect, it, vi } from "vitest";
import fixture from "@/features/scanner/providers/__fixtures__/open-food-facts.json";
import { OpenFoodFactsProvider } from "@/features/scanner/providers/open-food-facts";

const barcode = { value: "9002490100070", format: "EAN-13" } as const;

afterEach(() => {
  vi.useRealTimers();
});

describe("OpenFoodFactsProvider", () => {
  it("maps a product with durable source and license metadata", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(fixture), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const provider = new OpenFoodFactsProvider({ fetcher });

    const product = await provider.lookupBarcode(
      barcode,
      new AbortController().signal,
    );

    expect(product).toMatchObject({
      barcode,
      name: "Red Bull Energy Drink",
      brand: "Red Bull",
      sizeMl: 250,
      caffeineMgPer100Ml: 32,
      source: {
        provider: "open_food_facts",
        url: "https://world.openfoodfacts.org/product/9002490100070",
        license: "Open Database License (ODbL) 1.0",
      },
    });
  });

  it("returns null when Open Food Facts has no product", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: 0, code: barcode.value }), {
        status: 200,
      }),
    );
    const provider = new OpenFoodFactsProvider({ fetcher });

    await expect(
      provider.lookupBarcode(barcode, new AbortController().signal),
    ).resolves.toBeNull();
  });

  it("maps provider timeouts to a typed availability error", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn(
      (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    );
    const provider = new OpenFoodFactsProvider({ fetcher, timeoutMs: 100 });
    const pending = provider.lookupBarcode(
      barcode,
      new AbortController().signal,
    );
    const assertion = expect(pending).rejects.toMatchObject({
      code: "PROVIDER_UNAVAILABLE",
    });
    await vi.advanceTimersByTimeAsync(100);

    await assertion;
  });

  it("rejects malformed provider JSON without retrying", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: 1, product: { brands: 42 } }), {
        status: 200,
      }),
    );
    const provider = new OpenFoodFactsProvider({ fetcher });

    await expect(
      provider.lookupBarcode(barcode, new AbortController().signal),
    ).rejects.toMatchObject({ code: "PROVIDER_DATA_INVALID" });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("retries one transient network failure", async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("temporary network failure"))
      .mockResolvedValueOnce(
        new Response(JSON.stringify(fixture), { status: 200 }),
      );
    const provider = new OpenFoodFactsProvider({ fetcher });

    await expect(
      provider.lookupBarcode(barcode, new AbortController().signal),
    ).resolves.toMatchObject({ name: "Red Bull Energy Drink" });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
