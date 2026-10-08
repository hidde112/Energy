import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, Beaker, Can } from "lucide-react";
import type { ProductSummary } from "@/features/catalog/domain/types";

export function ProductCard({ product }: { product: ProductSummary }) {
  const verified = product.verificationStatus === "verified";

  return (
    <Link className="product-card" href={`/products/${product.id}`}>
      <div className="product-card-image">
        {product.image ? (
          <Image
            alt={product.image.alt}
            height={240}
            src={product.image.url}
            unoptimized
            width={180}
          />
        ) : (
          <Can aria-label="No product image available" size={42} />
        )}
      </div>
      <div className="product-card-copy">
        <p>{product.brand.name}</p>
        <h2>{product.name}</h2>
        <span
          className={
            verified ? "trust-label verified" : "trust-label provisional"
          }
        >
          {verified ? <BadgeCheck size={15} /> : <Beaker size={15} />}
          {verified ? "Verified" : "Provisional · visible to you"}
        </span>
        <small>
          {[
            product.variant,
            product.flavor,
            product.sizeMl ? `${product.sizeMl} ml` : null,
          ]
            .filter(Boolean)
            .join(" · ") || "Details pending"}
        </small>
      </div>
    </Link>
  );
}
