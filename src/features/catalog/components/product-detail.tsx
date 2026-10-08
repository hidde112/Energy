import { ExternalLink } from "lucide-react";
import { ProductCard } from "@/features/catalog/components/product-card";
import type { ProductDetail as ProductDetailType } from "@/features/catalog/domain/types";

function Fact({
  label,
  value,
}: {
  label: string;
  value: string | number | null;
}) {
  return (
    <div className="product-fact">
      <dt>{label}</dt>
      <dd>{value ?? "Unknown"}</dd>
    </div>
  );
}

export function ProductDetail({ product }: { product: ProductDetailType }) {
  return (
    <article className="product-detail">
      <ProductCard product={product} />
      <section className="product-facts" aria-labelledby="facts-heading">
        <p className="eyebrow">Product facts</p>
        <h1 id="facts-heading">What’s in the can</h1>
        <dl>
          <Fact label="Caffeine / 100 ml" value={product.caffeineMgPer100Ml} />
          <Fact label="Sugar / 100 ml" value={product.sugarGPer100Ml} />
          <Fact label="Calories / 100 ml" value={product.caloriesPer100Ml} />
          <Fact
            label="Sugar free"
            value={
              product.isSugarFree === null
                ? null
                : product.isSugarFree
                  ? "Yes"
                  : "No"
            }
          />
        </dl>
        {product.description ? <p>{product.description}</p> : null}
      </section>
      <section className="source-list" aria-labelledby="sources-heading">
        <p className="eyebrow">Provenance</p>
        <h2 id="sources-heading">Sources</h2>
        {product.sources.length === 0 ? (
          <p>Source details are pending.</p>
        ) : (
          <ul>
            {product.sources.map((source, index) => (
              <li key={`${source.kind}-${source.providerRecordId ?? index}`}>
                <strong>{source.kind.replaceAll("_", " ")}</strong>
                <span>{source.fieldNames.join(", ") || "Catalog record"}</span>
                {source.url ? (
                  <a href={source.url} rel="noreferrer" target="_blank">
                    View source <ExternalLink size={14} />
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </article>
  );
}
