export {};

const required = [
  "ENERGYDEX_LIVE_BASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
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
  console.log("Live smoke test passed without making a paid vision request.");
} catch (error) {
  console.error(
    `Live smoke test failed: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
}
