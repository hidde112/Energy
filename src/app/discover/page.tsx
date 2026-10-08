import { CatalogSearch } from "@/features/catalog/components/catalog-search";

export const metadata = { title: "Discover" };

export default function DiscoverPage() {
  return (
    <section className="catalog-page">
      <p className="eyebrow">Sourced catalog</p>
      <h1>Find your next charge.</h1>
      <p>Search verified drinks and your own provisional scan matches.</p>
      <CatalogSearch />
    </section>
  );
}
