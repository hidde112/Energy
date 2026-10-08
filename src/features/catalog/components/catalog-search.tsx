"use client";

import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { ProductCard } from "@/features/catalog/components/product-card";
import type { ProductSummary } from "@/features/catalog/domain/types";

type SearchFunction = (query: string) => Promise<ProductSummary[]>;
const emptyProducts: ProductSummary[] = [];

async function searchCatalog(query: string) {
  const response = await fetch(
    `/api/catalog/search?q=${encodeURIComponent(query)}`,
  );
  if (!response.ok) throw new Error("Catalog search failed");
  const body = (await response.json()) as { items: ProductSummary[] };
  return body.items;
}

export function CatalogSearch({
  initialProducts = emptyProducts,
  search = searchCatalog,
  debounceMs = 300,
}: {
  initialProducts?: ProductSummary[];
  search?: SearchFunction;
  debounceMs?: number;
}) {
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState(initialProducts);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const isInitial = query.trim().length < 2;
  const visibleProducts = isInitial ? initialProducts : products;
  const visibleState = isInitial ? "idle" : state;

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return;

    let active = true;
    const timeout = window.setTimeout(async () => {
      setState("loading");
      try {
        const found = await search(trimmed);
        if (active) {
          setProducts(found);
          setState("ready");
        }
      } catch {
        if (active) setState("error");
      }
    }, debounceMs);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [debounceMs, initialProducts, query, search]);

  return (
    <div className="catalog-search">
      <label className="search-field">
        <Search aria-hidden="true" size={21} />
        <span className="sr-only">Search the drink catalog</span>
        <input
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search brand, drink, or flavor"
          type="search"
          value={query}
        />
      </label>

      <p aria-live="polite" className="search-status">
        {visibleState === "loading" ? "Searching the Dex…" : null}
        {visibleState === "error" ? "Search is unavailable. Try again." : null}
        {visibleState === "ready" && visibleProducts.length === 0
          ? "No drinks found. A scan can help identify a missing can."
          : null}
      </p>

      {visibleProducts.length > 0 ? (
        <div className="product-grid">
          {visibleProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
