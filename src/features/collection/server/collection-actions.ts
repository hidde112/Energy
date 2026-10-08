"use server";

import type { CollectionEntry } from "@/features/collection/domain/collection";
import {
  setCollectionStatusWithClient,
  type CollectionWriteClient,
  type SetCollectionStatusInput,
} from "@/features/collection/server/collection-service";
import type { ActionResult } from "@/lib/actions/action-result";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function setCollectionStatus(
  input: SetCollectionStatusInput,
): Promise<ActionResult<CollectionEntry>> {
  const client =
    (await createServerSupabaseClient()) as unknown as CollectionWriteClient;
  return setCollectionStatusWithClient(client, input);
}
