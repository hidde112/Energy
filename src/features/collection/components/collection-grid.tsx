"use client";

import { useState } from "react";
import { Archive, Check, PackageCheck } from "lucide-react";
import { ProductCard } from "@/features/catalog/components/product-card";
import {
  collectionStatusLabels,
  type CollectionEntry,
  type CollectionListItem,
  type CollectionStatus,
} from "@/features/collection/domain/collection";
import { setCollectionStatus } from "@/features/collection/server/collection-actions";
import type { SetCollectionStatusInput } from "@/features/collection/server/collection-service";
import type { ActionResult } from "@/lib/actions/action-result";

export function CollectionGrid({
  initialItems,
  onSetStatus = setCollectionStatus,
}: {
  initialItems: CollectionListItem[];
  onSetStatus?: (
    input: SetCollectionStatusInput,
  ) => Promise<ActionResult<CollectionEntry>>;
}) {
  const [items, setItems] = useState(initialItems);
  const [error, setError] = useState<string | null>(null);

  async function updateStatus(
    item: CollectionListItem,
    status: CollectionStatus,
  ) {
    const previous = item.status;
    setError(null);
    setItems((current) =>
      current.map((candidate) =>
        candidate.id === item.id ? { ...candidate, status } : candidate,
      ),
    );

    const result = await onSetStatus({ productId: item.product.id, status });
    if (!result.ok) {
      setItems((current) =>
        current.map((candidate) =>
          candidate.id === item.id
            ? { ...candidate, status: previous }
            : candidate,
        ),
      );
      setError(result.error.title);
    }
  }

  if (items.length === 0) {
    return (
      <p className="empty-state">
        Your collection is ready for its first scan.
      </p>
    );
  }

  return (
    <div>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="collection-grid">
        {items.map((item) => (
          <article className="collection-item" key={item.id}>
            <ProductCard product={item.product} />
            <div className="collection-controls">
              <strong aria-label="Current status">
                {collectionStatusLabels[item.status]}
              </strong>
              <div>
                <button
                  aria-label="Mark tried"
                  className="icon-button"
                  onClick={() => updateStatus(item, "tried")}
                  type="button"
                >
                  <Check size={17} /> Tried
                </button>
                <button
                  aria-label="Mark collected"
                  className="icon-button"
                  onClick={() => updateStatus(item, "collected_physical")}
                  type="button"
                >
                  <PackageCheck size={17} /> Collected
                </button>
                <button
                  aria-label="Archive"
                  className="icon-button"
                  onClick={() => updateStatus(item, "archived")}
                  type="button"
                >
                  <Archive size={17} />
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
