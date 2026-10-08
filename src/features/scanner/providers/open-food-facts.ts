import "server-only";

import { z } from "zod";
import type { Barcode } from "@/features/catalog/domain/barcode";
import type {
  ExternalProduct,
  ProductDataProvider,
} from "@/features/scanner/providers/contracts";
import { AppError } from "@/lib/errors/app-error";

const responseSchema = z.object({
  status: z.number(),
  code: z.string().optional(),
  product: z
    .object({
      product_name: z.string().min(1),
      brands: z.string().optional(),
      quantity: z.string().optional(),
      image_front_url: z.url().optional(),
      ingredients_text: z.string().optional(),
      nutriments: z
        .object({
          caffeine_100ml: z.number().nonnegative().optional(),
          sugars_100g: z.number().nonnegative().optional(),
          "energy-kcal_100g": z.number().nonnegative().optional(),
        })
        .optional(),
    })
    .optional(),
});

type Fetcher = typeof fetch;

function parseSizeMl(quantity: string | undefined) {
  if (!quantity) return null;
  const match = quantity.match(/([0-9]+(?:[.,][0-9]+)?)\s*(ml|cl|l)\b/iu);
  if (!match) return null;
  const amount = Number(match[1]?.replace(",", "."));
  const unit = match[2]?.toLocaleLowerCase("en-US");
  if (!Number.isFinite(amount)) return null;
  if (unit === "l") return Math.round(amount * 1_000);
  if (unit === "cl") return Math.round(amount * 10);
  return Math.round(amount);
}

export class OpenFoodFactsProvider implements ProductDataProvider {
  private readonly fetcher: Fetcher;
  private readonly timeoutMs: number;

  constructor(options: { fetcher?: Fetcher; timeoutMs?: number } = {}) {
    this.fetcher = options.fetcher ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 5_000;
  }

  async lookupBarcode(barcode: Barcode, signal: AbortSignal) {
    const url = `https://world.openfoodfacts.org/api/v2/product/${barcode.value}.json`;
    const controller = new AbortController();
    const relayAbort = () => controller.abort(signal.reason);
    signal.addEventListener("abort", relayAbort, { once: true });
    const timeout = setTimeout(
      () => controller.abort("provider-timeout"),
      this.timeoutMs,
    );

    try {
      let response: Response | undefined;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          response = await this.fetcher(url, {
            headers: {
              "user-agent": "ENERGYDEX/0.1 (catalog identification)",
            },
            signal: controller.signal,
          });
        } catch (error) {
          if (controller.signal.aborted || attempt === 1) throw error;
          continue;
        }
        if (response.status !== 429 && response.status < 500) break;
      }

      if (!response || response.status === 429 || response.status >= 500) {
        throw new AppError(
          "PROVIDER_UNAVAILABLE",
          "Open Food Facts is temporarily unavailable.",
        );
      }
      if (response.status === 404) return null;
      if (!response.ok) {
        throw new AppError(
          "PROVIDER_UNAVAILABLE",
          "Open Food Facts could not complete the lookup.",
        );
      }

      let body: unknown;
      try {
        body = await response.json();
      } catch (error) {
        throw new AppError(
          "PROVIDER_DATA_INVALID",
          "Open Food Facts returned invalid data.",
          { cause: error },
        );
      }

      const parsed = responseSchema.safeParse(body);
      if (!parsed.success) {
        throw new AppError(
          "PROVIDER_DATA_INVALID",
          "Open Food Facts returned invalid data.",
          { cause: parsed.error },
        );
      }
      if (parsed.data.status === 0 || !parsed.data.product) return null;

      const product = parsed.data.product;
      const sourceUrl = `https://world.openfoodfacts.org/product/${barcode.value}`;
      const result: ExternalProduct = {
        barcode,
        name: product.product_name,
        brand: product.brands?.split(",")[0]?.trim() || null,
        sizeMl: parseSizeMl(product.quantity),
        imageUrl: product.image_front_url ?? null,
        ingredients: product.ingredients_text ?? null,
        caffeineMgPer100Ml:
          product.nutriments?.caffeine_100ml === undefined
            ? null
            : product.nutriments.caffeine_100ml * 1_000,
        sugarGPer100Ml: product.nutriments?.sugars_100g ?? null,
        caloriesPer100Ml: product.nutriments?.["energy-kcal_100g"] ?? null,
        source: {
          provider: "open_food_facts",
          url: sourceUrl,
          license: "Open Database License (ODbL) 1.0",
          recordId: parsed.data.code ?? barcode.value,
        },
      };
      return result;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        "PROVIDER_UNAVAILABLE",
        "Open Food Facts is temporarily unavailable.",
        { cause: error },
      );
    } finally {
      clearTimeout(timeout);
      signal.removeEventListener("abort", relayAbort);
    }
  }
}
