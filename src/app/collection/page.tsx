import { CollectionGrid } from "@/features/collection/components/collection-grid";
import { cookies } from "next/headers";
import type { CollectionListItem } from "@/features/collection/domain/collection";
import { AppError } from "@/lib/errors/app-error";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  decodeFixture,
  E2E_COLLECTION_COOKIE,
  isE2EMode,
} from "@/lib/e2e/fixtures";

export const metadata = { title: "Collection" };
export const dynamic = "force-dynamic";

type RawCollection = {
  id: string;
  status: CollectionListItem["status"];
  note: string | null;
  product: {
    id: string;
    name: string;
    normalized_name: string;
    flavor: string | null;
    variant: string | null;
    size_ml: number | null;
    verification_status: CollectionListItem["product"]["verificationStatus"];
    brand: { id: string; name: string; slug: string };
  };
};

export default async function CollectionPage() {
  if (isE2EMode()) {
    const value = (await cookies()).get(E2E_COLLECTION_COOKIE)?.value;
    const items = decodeFixture<CollectionListItem[]>(value) ?? [];
    return (
      <section className="catalog-page">
        <p className="eyebrow">Your energy archive</p>
        <h1>Collection.</h1>
        <p>
          Track what you tried separately from the cans you physically kept.
        </p>
        <CollectionGrid initialItems={items} />
      </section>
    );
  }
  const client = await createServerSupabaseClient();
  const result = await client
    .from("user_collections")
    .select(
      `
      id,status,note,
      product:products!inner(
        id,name,normalized_name,flavor,variant,size_ml,verification_status,
        brand:brands!products_brand_id_fkey(id,name,slug)
      )
    `,
    )
    .neq("status", "archived")
    .order("updated_at", { ascending: false });

  if (result.error) {
    throw new AppError("UNEXPECTED", "Unable to load your collection.", {
      cause: result.error,
    });
  }

  const items = (result.data as unknown as RawCollection[]).map((entry) => ({
    id: entry.id,
    status: entry.status,
    note: entry.note,
    product: {
      id: entry.product.id,
      name: entry.product.name,
      normalizedName: entry.product.normalized_name,
      brand: entry.product.brand,
      flavor: entry.product.flavor,
      variant: entry.product.variant,
      sizeMl: entry.product.size_ml,
      verificationStatus: entry.product.verification_status,
      image: null,
    },
  }));

  return (
    <section className="catalog-page">
      <p className="eyebrow">Your energy archive</p>
      <h1>Collection.</h1>
      <p>Track what you tried separately from the cans you physically kept.</p>
      <CollectionGrid initialItems={items} />
    </section>
  );
}
