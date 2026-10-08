import type { Barcode } from "@/features/catalog/domain/barcode";

export type ExternalProduct = {
  barcode: Barcode;
  name: string;
  brand: string | null;
  sizeMl: number | null;
  imageUrl: string | null;
  ingredients: string | null;
  caffeineMgPer100Ml: number | null;
  sugarGPer100Ml: number | null;
  caloriesPer100Ml: number | null;
  source: {
    provider: "open_food_facts";
    url: string;
    license: string;
    recordId: string;
  };
};

export type PreparedImage = {
  bytes: Buffer;
  mimeType: "image/jpeg";
  width: number;
  height: number;
  sha256: string;
};

export type VisionHypothesis = {
  brand: string | null;
  productName: string | null;
  flavor: string | null;
  variant: string | null;
  sizeMl: number | null;
  barcode: Barcode | null;
  confidence: number;
  visibleText: string[];
};

export interface ProductDataProvider {
  lookupBarcode(
    barcode: Barcode,
    signal: AbortSignal,
  ): Promise<ExternalProduct | null>;
}

export interface VisionProvider {
  identify(
    image: PreparedImage,
    signal: AbortSignal,
  ): Promise<VisionHypothesis>;
}
