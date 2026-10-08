import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Barcode } from "@/features/catalog/domain/barcode";
import { normalizeProductName } from "@/features/catalog/domain/normalize";
import type {
  CatalogImage,
  ProductDetail,
  ProductSource,
  ProductSummary,
  SourceKind,
  VerificationStatus,
} from "@/features/catalog/domain/types";
import type {
  CatalogRepository,
  CatalogSearchOptions,
} from "@/features/catalog/server/catalog-repository";
import { AppError } from "@/lib/errors/app-error";
import type { Database } from "@/lib/supabase/database.types";

const productSelection = `
  *,
  brand:brands!products_brand_id_fkey(id,name,slug),
  images:product_images(id,external_url,storage_path,source_url,license,alt_text,is_primary,is_verified),
  sources:product_sources(source_kind,source_url,provider_record_id,field_names,license,confidence),
  barcodes:product_barcodes(barcode,format)
`;

type RawProduct = {
  id: string;
  name: string;
  normalized_name: string;
  flavor: string | null;
  variant: string | null;
  size_ml: number | null;
  verification_status: VerificationStatus;
  product_line: string | null;
  description: string | null;
  country_code: string | null;
  is_sugar_free: boolean | null;
  caffeine_mg_per_100ml: number | null;
  sugar_g_per_100ml: number | null;
  calories_per_100ml: number | null;
  sweeteners: string[] | null;
  ingredients: string | null;
  is_limited_edition: boolean | null;
  is_discontinued: boolean | null;
  introduced_year: number | null;
  brand: { id: string; name: string; slug: string };
  images: Array<{
    external_url: string | null;
    storage_path: string | null;
    source_url: string | null;
    license: string | null;
    alt_text: string | null;
    is_primary: boolean;
    is_verified: boolean;
  }>;
  sources: Array<{
    source_kind: SourceKind;
    source_url: string | null;
    provider_record_id: string | null;
    field_names: string[];
    license: string | null;
    confidence: number | null;
  }>;
  barcodes: Array<{ barcode: string; format: string }>;
};

function imageFrom(row: RawProduct): CatalogImage | null {
  const image =
    row.images.find((candidate) => candidate.is_primary) ?? row.images[0];
  const url = image?.external_url;
  if (!image || !url) return null;

  return {
    url,
    alt: image.alt_text || `${row.brand.name} ${row.name}`,
    sourceUrl: image.source_url,
    license: image.license,
    verified: image.is_verified,
  };
}

function summaryFrom(row: RawProduct): ProductSummary {
  return {
    id: row.id,
    name: row.name,
    normalizedName: row.normalized_name,
    brand: row.brand,
    flavor: row.flavor,
    variant: row.variant,
    sizeMl: row.size_ml,
    verificationStatus: row.verification_status,
    image: imageFrom(row),
  };
}

function detailFrom(row: RawProduct): ProductDetail {
  const sources: ProductSource[] = row.sources.map((source) => ({
    kind: source.source_kind,
    url: source.source_url,
    providerRecordId: source.provider_record_id,
    fieldNames: source.field_names,
    license: source.license,
    confidence: source.confidence,
  }));

  return {
    ...summaryFrom(row),
    productLine: row.product_line,
    description: row.description,
    countryCode: row.country_code,
    isSugarFree: row.is_sugar_free,
    caffeineMgPer100Ml: row.caffeine_mg_per_100ml,
    sugarGPer100Ml: row.sugar_g_per_100ml,
    caloriesPer100Ml: row.calories_per_100ml,
    sweeteners: row.sweeteners,
    ingredients: row.ingredients,
    isLimitedEdition: row.is_limited_edition,
    isDiscontinued: row.is_discontinued,
    introducedYear: row.introduced_year,
    barcodes: row.barcodes.map((barcode) => ({
      value: barcode.barcode,
      format: barcode.format as Barcode["format"],
    })),
    sources,
  };
}

function safeSearchTerm(value: string) {
  return value
    .replace(/[%_,().]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

export class SupabaseCatalogRepository implements CatalogRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async getById(id: string) {
    const result = await this.client
      .from("products")
      .select(productSelection)
      .eq("id", id)
      .is("archived_at", null)
      .maybeSingle();

    if (result.error) {
      throw new AppError("UNEXPECTED", "Unable to load the product.", {
        cause: result.error,
      });
    }

    return result.data
      ? detailFrom(result.data as unknown as RawProduct)
      : null;
  }

  async findByBarcode(barcode: Barcode) {
    const result = await this.client
      .from("product_barcodes")
      .select(`product:products!inner(${productSelection})`)
      .eq("barcode", barcode.value)
      .maybeSingle();

    if (result.error) {
      throw new AppError("UNEXPECTED", "Unable to look up that barcode.", {
        cause: result.error,
      });
    }

    const product = result.data?.product as unknown as RawProduct | undefined;
    return product ? detailFrom(product) : null;
  }

  async search(query: string, options: CatalogSearchOptions = {}) {
    const normalized = normalizeProductName(query);
    const term = safeSearchTerm(normalized);
    const page = Math.max(1, options.page ?? 1);
    const pageSize = Math.min(50, Math.max(1, options.pageSize ?? 20));

    const aliases = await this.client
      .from("product_aliases")
      .select("product_id")
      .ilike("normalized_alias", `%${term}%`)
      .limit(50);

    if (aliases.error) {
      throw new AppError("UNEXPECTED", "Unable to search the catalog.", {
        cause: aliases.error,
      });
    }

    const aliasIds = [
      ...new Set(aliases.data.map((alias) => alias.product_id)),
    ];
    const filters = [
      `name.ilike.%${term}%`,
      `normalized_name.ilike.%${term}%`,
      `flavor.ilike.%${term}%`,
      `product_line.ilike.%${term}%`,
    ];
    if (aliasIds.length > 0) filters.push(`id.in.(${aliasIds.join(",")})`);

    const start = (page - 1) * pageSize;
    const result = await this.client
      .from("products")
      .select(productSelection)
      .is("archived_at", null)
      .or(filters.join(","))
      .order("name")
      .range(start, start + pageSize - 1);

    if (result.error) {
      throw new AppError("UNEXPECTED", "Unable to search the catalog.", {
        cause: result.error,
      });
    }

    return (result.data as unknown as RawProduct[]).map(summaryFrom);
  }

  async findCandidates(name: string, limit = 8) {
    return this.search(name, { page: 1, pageSize: limit });
  }
}
