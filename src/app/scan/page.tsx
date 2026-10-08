import { ScanWorkspace } from "@/features/scanner/components/scan-workspace";

export const metadata = { title: "Scan" };

export default function ScanPage() {
  return (
    <section className="scan-page">
      <p className="eyebrow">Identify a drink</p>
      <h1>Scan the energy.</h1>
      <p>
        Barcode first. Image matching is the fallback when the can is unknown.
      </p>
      <ScanWorkspace />
    </section>
  );
}
