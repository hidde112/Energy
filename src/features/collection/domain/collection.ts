import type { Database } from "@/lib/supabase/database.types";
import type { ProductSummary } from "@/features/catalog/domain/types";

export type CollectionStatus = Database["public"]["Enums"]["collection_status"];
export type CollectionEntry =
  Database["public"]["Tables"]["user_collections"]["Row"];

export type CollectionListItem = Pick<
  CollectionEntry,
  "id" | "status" | "note"
> & {
  product: ProductSummary;
};

export const collectionStatuses: readonly CollectionStatus[] = [
  "tried",
  "want_to_try",
  "favorite",
  "disliked",
  "collected_physical",
  "want_to_buy",
  "archived",
];

export const collectionStatusLabels: Record<CollectionStatus, string> = {
  tried: "Tried",
  want_to_try: "Want to try",
  favorite: "Favorite",
  disliked: "Disliked",
  collected_physical: "Collected",
  want_to_buy: "Want to buy",
  archived: "Archived",
};

export function getCollectionFlags(status: CollectionStatus) {
  return {
    hasTried:
      status === "tried" || status === "favorite" || status === "disliked",
    physicallyCollected: status === "collected_physical",
  };
}

export function transitionCollectionStatus(
  _current: CollectionStatus,
  next: CollectionStatus,
) {
  return next;
}
