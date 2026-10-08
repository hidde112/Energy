import { notFound } from "next/navigation";
import { ProductDetail } from "@/features/catalog/components/product-detail";
import { SupabaseCatalogRepository } from "@/features/catalog/server/supabase-catalog-repository";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  const repository = new SupabaseCatalogRepository(
    await createServerSupabaseClient(),
  );
  const product = await repository.getById(productId);

  if (!product) notFound();

  return <ProductDetail product={product} />;
}
