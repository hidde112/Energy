"use server";

import {
  correctProvisionalProductWithClient,
  type ProductCorrectionClient,
  type ProductCorrectionInput,
} from "@/features/moderation/server/product-correction-service";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function correctProvisionalProduct(input: ProductCorrectionInput) {
  const client =
    (await createServerSupabaseClient()) as unknown as ProductCorrectionClient;
  return correctProvisionalProductWithClient(client, input);
}
