import "server-only";

import { AppError } from "@/lib/errors/app-error";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type DashboardCollectionRow = {
  productId: string;
  status: string;
  productName: string;
  brandId: string;
  brandName: string;
};

export interface DashboardRepository {
  getCollectionRows(userId: string): Promise<DashboardCollectionRow[]>;
  getCurrentRatings(userId: string): Promise<number[]>;
}

export type DashboardSummary = {
  uniqueProducts: number;
  uniqueBrands: number;
  averageRating: number | null;
  physicallyCollected: number;
  recentProducts: Array<{
    id: string;
    name: string;
    brandName: string;
    status: string;
  }>;
};

async function supabaseRepository(): Promise<DashboardRepository> {
  const client = await createServerSupabaseClient();
  return {
    async getCollectionRows(userId) {
      const result = await client
        .from("user_collections")
        .select(
          "product_id,status,product:products!inner(name,brand:brands!products_brand_id_fkey(id,name))",
        )
        .eq("user_id", userId)
        .neq("status", "archived")
        .order("updated_at", { ascending: false })
        .limit(20);
      if (result.error) {
        throw new AppError(
          "UNEXPECTED",
          "Unable to load dashboard collection data.",
          {
            cause: result.error,
          },
        );
      }
      return (
        result.data as unknown as Array<{
          product_id: string;
          status: string;
          product: { name: string; brand: { id: string; name: string } };
        }>
      ).map((row) => ({
        productId: row.product_id,
        status: row.status,
        productName: row.product.name,
        brandId: row.product.brand.id,
        brandName: row.product.brand.name,
      }));
    },
    async getCurrentRatings(userId) {
      const result = await client
        .from("reviews")
        .select("rating")
        .eq("user_id", userId);
      if (result.error) {
        throw new AppError("UNEXPECTED", "Unable to load dashboard ratings.", {
          cause: result.error,
        });
      }
      return result.data.map((row) => row.rating);
    },
  };
}

export const emptyDashboard: DashboardSummary = {
  uniqueProducts: 0,
  uniqueBrands: 0,
  averageRating: null,
  physicallyCollected: 0,
  recentProducts: [],
};

export async function getDashboard(
  userId: string,
  providedRepository?: DashboardRepository,
): Promise<DashboardSummary> {
  const repository = providedRepository ?? (await supabaseRepository());
  const [collection, ratings] = await Promise.all([
    repository.getCollectionRows(userId),
    repository.getCurrentRatings(userId),
  ]);
  const uniqueProducts = new Set(collection.map((row) => row.productId));
  const uniqueBrands = new Set(collection.map((row) => row.brandId));
  const recentIds = new Set<string>();
  const recentProducts = collection
    .filter((row) => {
      if (recentIds.has(row.productId)) return false;
      recentIds.add(row.productId);
      return true;
    })
    .slice(0, 4)
    .map((row) => ({
      id: row.productId,
      name: row.productName,
      brandName: row.brandName,
      status: row.status,
    }));

  return {
    uniqueProducts: uniqueProducts.size,
    uniqueBrands: uniqueBrands.size,
    averageRating:
      ratings.length === 0
        ? null
        : Math.round(
            (ratings.reduce((sum, rating) => sum + rating, 0) /
              ratings.length) *
              10,
          ) / 10,
    physicallyCollected: collection.filter(
      (row) => row.status === "collected_physical",
    ).length,
    recentProducts,
  };
}
