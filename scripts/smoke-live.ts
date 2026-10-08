import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import {
  assertDeploymentPage,
  assertPwaManifest,
} from "../src/lib/smoke/live-contracts.ts";
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

type AuthCookie = {
  name: string;
  value: string;
  options?: Record<string, unknown>;
};

let authCookies: AuthCookie[] = [];
const userClient = createServerClient<Database>(
  supabaseUrl.toString(),
  publishableKey,
  {
    cookies: {
      getAll: () => authCookies,
      setAll: (updates) => {
        for (const update of updates) {
          authCookies = authCookies.filter(
            (cookie) => cookie.name !== update.name,
          );
          authCookies.push(update);
        }
      },
    },
    auth: { autoRefreshToken: false, persistSession: false },
  },
);
const adminClient = createClient<Database>(
  supabaseUrl.toString(),
  serviceRoleKey,
  { auth: { autoRefreshToken: false, persistSession: false } },
);
const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
const brandId = crypto.randomUUID();
const productId = crypto.randomUUID();
const barcodeBody = [...suffix.slice(0, 7)]
  .map((character) => String(Number.parseInt(character, 16) % 10))
  .join("");
const weighted = [...barcodeBody].reduce(
  (sum, digit, index) => sum + Number(digit) * (index % 2 === 0 ? 3 : 1),
  0,
);
const barcode = `${barcodeBody}${(10 - (weighted % 10)) % 10}`;
let userId: string | undefined;

function requireSuccess(error: { message: string } | null, label: string) {
  if (error) throw new Error(`${label}: ${error.message}`);
  console.log(`ok - ${label}`);
}

function cookieHeader() {
  return authCookies
    .filter((cookie) => cookie.value)
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");
}

async function appRequest(path: string, init: RequestInit = {}) {
  return fetch(new URL(path, liveBaseUrl), {
    ...init,
    headers: {
      ...init.headers,
      cookie: cookieHeader(),
    },
    signal: AbortSignal.timeout(15_000),
    redirect: "follow",
  });
}

try {
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

  await assertDeploymentPage(await appRequest("/"));
  console.log("ok - deployed ENERGYDEX application shell");
  await assertPwaManifest(await appRequest("/manifest.webmanifest"));
  console.log("ok - deployed PWA manifest contract");

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
  const barcodeRow = await adminClient.from("product_barcodes").insert({
    product_id: productId,
    barcode,
    format: "EAN-8",
  });
  requireSuccess(barcodeRow.error, "temporary catalog barcode");

  const identificationResponse = await appRequest("/api/scans/identify", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": `smoke-identify-${suffix}`,
    },
    body: JSON.stringify({ barcode }),
  });
  if (!identificationResponse.ok) {
    throw new Error(
      `deployed identify route returned HTTP ${identificationResponse.status}`,
    );
  }
  const identification = (await identificationResponse.json()) as {
    scanId?: string;
    source?: string;
    candidates?: Array<{ product?: { id?: string } }>;
  };
  if (
    !identification.scanId ||
    identification.source !== "catalog_barcode" ||
    identification.candidates?.[0]?.product?.id !== productId
  ) {
    throw new Error(
      "deployed identify route returned an invalid catalog match",
    );
  }
  console.log("ok - deployed barcode identification route");

  const confirmationResponse = await appRequest(
    `/api/scans/${identification.scanId}/confirm`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        scanId: identification.scanId,
        idempotencyKey: `smoke-confirm-${suffix}`,
        confirmation: { productId, collectionStatus: "tried" },
      }),
    },
  );
  if (!confirmationResponse.ok) {
    throw new Error(
      `deployed confirmation route returned HTTP ${confirmationResponse.status}`,
    );
  }
  const confirmation = (await confirmationResponse.json()) as {
    ok?: boolean;
    data?: { productId?: string };
  };
  if (!confirmation.ok || confirmation.data?.productId !== productId) {
    throw new Error("deployed confirmation route returned an invalid result");
  }
  console.log("ok - deployed owner-scoped confirmation route");

  const collection = await userClient
    .from("user_collections")
    .select("id")
    .eq("product_id", productId)
    .single();
  requireSuccess(collection.error, "collection persistence through RLS");

  const identifiedScan = await adminClient
    .from("scans")
    .select("status")
    .eq("id", identification.scanId)
    .single();
  requireSuccess(identifiedScan.error, "deployed scan persistence");
  if (!identifiedScan.data || identifiedScan.data.status !== "confirmed") {
    throw new Error("deployed scan did not reach confirmed status");
  }

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
