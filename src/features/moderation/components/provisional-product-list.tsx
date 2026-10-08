"use client";

import { useState } from "react";
import { correctProvisionalProduct } from "@/features/moderation/server/product-correction-actions";
import type { Product } from "@/features/moderation/server/product-correction-service";

export function ProvisionalProductList({ products }: { products: Product[] }) {
  const [message, setMessage] = useState<string | null>(null);

  if (products.length === 0)
    return <p className="empty-state">No provisional products await review.</p>;

  return (
    <div className="moderation-list">
      {message ? <p role="status">{message}</p> : null}
      {products.map((product) => (
        <form
          action={async (form) => {
            const result = await correctProvisionalProduct({
              productId: product.id,
              name: String(form.get("name") ?? ""),
              verificationStatus: String(form.get("status")) as
                "verified" | "rejected",
            });
            setMessage(
              result.ok
                ? "Correction saved with audit history."
                : result.error.title,
            );
          }}
          key={product.id}
        >
          <input
            aria-label="Product name"
            defaultValue={product.name}
            name="name"
            required
          />
          <select
            aria-label="Verification status"
            name="status"
            defaultValue="verified"
          >
            <option value="verified">Verify</option>
            <option value="rejected">Reject</option>
          </select>
          <button className="button button-primary" type="submit">
            Save correction
          </button>
        </form>
      ))}
    </div>
  );
}
