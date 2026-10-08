import { notFound } from "next/navigation";
import { ProvisionalProductList } from "@/features/moderation/components/provisional-product-list";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Product moderation" };

export default async function ProductModerationPage() {
  const client = await createServerSupabaseClient();
  const auth = await client.auth.getUser();
  if (!auth.data.user) notFound();
  const role = await client
    .from("app_user_roles")
    .select("role")
    .eq("user_id", auth.data.user.id)
    .in("role", ["moderator", "admin"])
    .maybeSingle();
  if (!role.data) notFound();

  const products = await client
    .from("products")
    .select("*")
    .eq("verification_status", "provisional")
    .order("created_at");

  return (
    <section className="catalog-page">
      <p className="eyebrow">Moderator queue</p>
      <h1>Catalog review.</h1>
      <ProvisionalProductList products={products.data ?? []} />
    </section>
  );
}
