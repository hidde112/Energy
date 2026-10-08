import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/supabase/database.types";

const required = [
  "ENERGYDEX_LIVE_BASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
] as const;

const missing = required.filter((name) => !process.env[name]?.trim());
if (missing.length > 0) {
  console.error(
    `Live smoke test blocked: configure ${missing.join(", ")} in the shell or deployment environment.`,
  );
  process.exit(2);
}

const liveBaseUrl = new URL(process.env.ENERGYDEX_LIVE_BASE_URL!);
const supabaseUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const openAiKey = process.env.OPENAI_API_KEY!;

async function check(
  label: string,
  url: URL,
  init: RequestInit = {},
  expected: number[] = [200],
) {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(15_000),
    redirect: "follow",
  });
  if (!expected.includes(response.status)) {
    throw new Error(`${label} returned HTTP ${response.status}.`);
  }
  console.log(`ok - ${label} (${response.status})`);
}

const userClient = createClient<Database>(
  supabaseUrl.toString(),
  publishableKey,
  { auth: { autoRefreshToken: false, persistSession: false } },
);
const adminClient = createClient<Database>(
  supabaseUrl.toString(),
  serviceRoleKey,
  { auth: { autoRefreshToken: false, persistSession: false } },
);
const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
const brandId = crypto.randomUUID();
const productId = crypto.randomUUID();
const scanId = crypto.randomUUID();
let userId: string | undefined;

function requireSuccess(error: { message: string } | null, label: string) {
  if (error) throw new Error(`${label}: ${error.message}`);
  console.log(`ok - ${label}`);
}

try {
  await check("ENERGYDEX deployment", new URL("/", liveBaseUrl));
  await check("PWA manifest", new URL("/manifest.webmanifest", liveBaseUrl));
  await check(
    "Supabase Auth settings",
    new URL("/auth/v1/settings", supabaseUrl),
    {
      headers: { apikey: publishableKey },
    },
  );
  await check("Supabase REST API", new URL("/rest/v1/", supabaseUrl), {
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${publishableKey}`,
    },
  });
  await check(
    "OpenAI credential",
    new URL("https://api.openai.com/v1/models"),
    {
      headers: { Authorization: `Bearer ${openAiKey}` },
    },
  );

  const anonymous = await userClient.auth.signInAnonymously();
  requireSuccess(anonymous.error, "anonymous Auth sign-in");
  userId = anonymous.data.user?.id;
  if (!userId) throw new Error("anonymous Auth did not return a user ID");

  const profile = await userClient
    .from("profiles")
    .update({
      username: `smoke_${suffix}`,
      display_name: "ENERGYDEX smoke",
      onboarding_completed_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .select("user_id")
    .single();
  requireSuccess(profile.error, "profile trigger and owner RLS");

  const brand = await adminClient.from("brands").insert({
    id: brandId,
    name: `Smoke Brand ${suffix}`,
    normalized_name: `smoke brand ${suffix}`,
    slug: `smoke-brand-${suffix}`,
  });
  requireSuccess(brand.error, "temporary catalog brand");
  const product = await adminClient.from("products").insert({
    id: productId,
    brand_id: brandId,
    name: `Smoke Product ${suffix}`,
    normalized_name: `smoke product ${suffix}`,
    size_ml: 250,
    verification_status: "verified",
    verified_at: new Date().toISOString(),
  });
  requireSuccess(product.error, "temporary catalog product");
  const scan = await adminClient.from("scans").insert({
    id: scanId,
    user_id: userId,
    status: "identified",
    input_kind: "barcode",
    idempotency_key: `smoke-identify-${suffix}`,
    matched_product_id: productId,
    provider_usage: { smoke: true },
  });
  requireSuccess(scan.error, "server-owned scan persistence");
  const candidate = await adminClient.from("scan_candidates").insert({
    scan_id: scanId,
    product_id: productId,
    position: 1,
    score: 1,
    confidence: "high",
    hypothesis: { smoke: true },
  });
  requireSuccess(candidate.error, "server-owned candidate persistence");

  const confirmation = await userClient.rpc("confirm_scan", {
    p_scan_id: scanId,
    p_user_id: userId,
    p_confirmation: { product_id: productId, collection_status: "tried" },
    p_idempotency_key: `smoke-confirm-${suffix}`,
  });
  requireSuccess(confirmation.error, "owner-scoped confirmation RPC");
  const collection = await userClient
    .from("user_collections")
    .select("id")
    .eq("product_id", productId)
    .single();
  requireSuccess(collection.error, "collection persistence through RLS");

  console.log(
    "Live smoke test passed; no paid vision request was made. Temporary rows are being removed.",
  );
} catch (error) {
  console.error(
    `Live smoke test failed: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
} finally {
  if (userId) await adminClient.auth.admin.deleteUser(userId);
  await adminClient.from("products").delete().eq("id", productId);
  await adminClient.from("brands").delete().eq("id", brandId);
}
