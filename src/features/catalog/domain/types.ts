import type { Database } from "@/lib/supabase/database.types";
import type { Barcode } from "@/features/catalog/domain/barcode";

export type VerificationStatus =
  Database["public"]["Enums"]["product_verification_status"];
export type SourceKind = Database["public"]["Enums"]["source_kind"];

export type BrandSummary = {
  id: string;
  name: string;
  slug: string;
};

export type CatalogImage = {
  url: string;
  alt: string;
  sourceUrl: string | null;
  license: string | null;
  verified: boolean;
};

export type ProductSource = {
  kind: SourceKind;
  url: string | null;
  providerRecordId: string | null;
  fieldNames: string[];
  license: string | null;
  confidence: number | null;
};

export type ProductSummary = {
  id: string;
  name: string;
  normalizedName: string;
  brand: BrandSummary;
  flavor: string | null;
  variant: string | null;
  sizeMl: number | null;
  verificationStatus: VerificationStatus;
  image: CatalogImage | null;
};

export type ProductDetail = ProductSummary & {
  productLine: string | null;
  description: string | null;
  countryCode: string | null;
  isSugarFree: boolean | null;
  caffeineMgPer100Ml: number | null;
  sugarGPer100Ml: number | null;
  caloriesPer100Ml: number | null;
  sweeteners: string[] | null;
  ingredients: string | null;
  isLimitedEdition: boolean | null;
  isDiscontinued: boolean | null;
  introducedYear: number | null;
  barcodes: Barcode[];
  sources: ProductSource[];
};
