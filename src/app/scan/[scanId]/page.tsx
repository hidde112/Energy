import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { ScanResult } from "@/features/scanner/components/scan-result";
import type { IdentificationResult } from "@/features/scanner/server/identification-service";
import type { Json } from "@/lib/supabase/database.types";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  decodeFixture,
  E2E_SCAN_COOKIE,
  E2E_USER_COOKIE,
  isE2EMode,
  type E2EScan,
} from "@/lib/e2e/fixtures";

export const dynamic = "force-dynamic";

function storedResult(value: Json): IdentificationResult | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return (value as { result?: IdentificationResult }).result ?? null;
}

export default async function ScanResultPage({
  params,
}: {
  params: Promise<{ scanId: string }>;
}) {
  const { scanId } = await params;
  if (isE2EMode()) {
    const store = await cookies();
    const scan = decodeFixture<E2EScan>(store.get(E2E_SCAN_COOKIE)?.value);
    const userId = store.get(E2E_USER_COOKIE)?.value;
    if (!scan || scan.ownerId !== userId || scan.result.scanId !== scanId)
      notFound();
    return (
      <section className="scan-page">
        <p className="eyebrow">Identification result</p>
        <h1>Confirm the can.</h1>
        <ScanResult identification={scan.result} />
      </section>
    );
  }
  const client = await createServerSupabaseClient();
  const scan = await client
    .from("scans")
    .select("provider_usage")
    .eq("id", scanId)
    .maybeSingle();
  const identification = scan.data
    ? storedResult(scan.data.provider_usage)
    : null;
  if (!identification) notFound();

  return (
    <section className="scan-page">
      <p className="eyebrow">Identification result</p>
      <h1>Confirm the can.</h1>
      <ScanResult identification={identification} />
    </section>
  );
}
