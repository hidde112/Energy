"use client";

import { useState, type FormEvent } from "react";
import { Barcode as BarcodeIcon } from "lucide-react";
import { normalizeBarcode } from "@/features/catalog/domain/barcode";
import type { ScanInput } from "@/features/scanner/domain/scan-input";

export function ManualBarcodeForm({
  onCapture,
}: {
  onCapture: (input: ScanInput) => void;
}) {
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);

    try {
      onCapture({
        kind: "barcode",
        barcode: normalizeBarcode(String(form.get("barcode") ?? "")),
      });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Enter a valid barcode.",
      );
    }
  }

  return (
    <form className="manual-barcode-form" onSubmit={submit}>
      <label htmlFor="manual-barcode">Barcode number</label>
      <div>
        <BarcodeIcon aria-hidden="true" size={21} />
        <input
          autoComplete="off"
          id="manual-barcode"
          inputMode="numeric"
          name="barcode"
          placeholder="EAN or UPC"
          required
        />
        <button className="button button-secondary" type="submit">
          Use barcode
        </button>
      </div>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
