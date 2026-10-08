import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import type { Review } from "@/features/reviews/domain/rating";
import { RatingForm } from "@/features/reviews/components/rating-form";
import { SupabaseCatalogRepository } from "@/features/catalog/server/supabase-catalog-repository";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  decodeFixture,
  E2E_PRODUCT_ID,
  E2E_REVIEW_COOKIE,
  fixtureProduct,
  isE2EMode,
} from "@/lib/e2e/fixtures";

export const metadata = { title: "Rate drink" };
export const dynamic = "force-dynamic";

export default async function RateProductPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  if (isE2EMode()) {
    if (productId !== E2E_PRODUCT_ID) notFound();
    const review = decodeFixture<Review>(
      (await cookies()).get(E2E_REVIEW_COOKIE)?.value,
    );
    return (
      <section className="rating-page">
        <p className="eyebrow">{fixtureProduct.brand.name}</p>
        <h1>{fixtureProduct.name}</h1>
        <p>Your current rating is the only one used in aggregate scores.</p>
        <RatingForm
          initialRating={review?.rating ?? 7}
          productId={fixtureProduct.id}
        />
      </section>
    );
  }
  const client = await createServerSupabaseClient();
  const repository = new SupabaseCatalogRepository(client);
  const product = await repository.getById(productId);
  if (!product) notFound();

  const review = await client
    .from("reviews")
    .select("rating")
    .eq("product_id", productId)
    .maybeSingle();

  return (
    <section className="rating-page">
      <p className="eyebrow">{product.brand.name}</p>
      <h1>{product.name}</h1>
      <p>Your current rating is the only one used in aggregate scores.</p>
      <RatingForm
        initialRating={review.data?.rating ?? 7}
        productId={product.id}
      />
    </section>
  );
}
