import type { Barcode } from "@/features/catalog/domain/barcode";
import type {
  ProductDetail,
  ProductSummary,
} from "@/features/catalog/domain/types";

export type CatalogSearchOptions = {
  page?: number;
  pageSize?: number;
};

export interface CatalogRepository {
  findByBarcode(barcode: Barcode): Promise<ProductDetail | null>;
  search(
    query: string,
    options?: CatalogSearchOptions,
  ): Promise<ProductSummary[]>;
  getById(id: string): Promise<ProductDetail | null>;
  findCandidates(name: string, limit?: number): Promise<ProductSummary[]>;
}
