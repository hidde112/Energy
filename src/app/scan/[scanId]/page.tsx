import { notFound } from "next/navigation";
import { ScanResult } from "@/features/scanner/components/scan-result";
import type { IdentificationResult } from "@/features/scanner/server/identification-service";
import type { Json } from "@/lib/supabase/database.types";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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
