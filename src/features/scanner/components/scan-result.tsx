"use client";

import { useRef, useState, type FormEvent } from "react";
import { CandidateList } from "@/features/scanner/components/candidate-list";
import type {
  ConfirmedScan,
  ConfirmScanInput,
} from "@/features/scanner/server/confirm-scan";
import type { IdentificationResult } from "@/features/scanner/server/identification-service";
import type { ActionResult } from "@/lib/actions/action-result";

async function postConfirmation(
  input: ConfirmScanInput,
): Promise<ActionResult<ConfirmedScan>> {
  const response = await fetch(`/api/scans/${input.scanId}/confirm`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return (await response.json()) as ActionResult<ConfirmedScan>;
}

export function ScanResult({
  identification,
  onConfirm = postConfirmation,
}: {
  identification: IdentificationResult;
  onConfirm?: (input: ConfirmScanInput) => Promise<ActionResult<ConfirmedScan>>;
}) {
  const candidates = identification.candidates.slice(
    0,
    identification.confidence === "high" ? 1 : 3,
  );
  const [selectedId, setSelectedId] = useState(
    candidates[0]?.product.id ?? null,
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<ConfirmedScan | null>(null);
  const idempotencyKey = useRef(crypto.randomUUID());

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const needsProvisional = identification.requiresCorrection || !selectedId;
    const confirmation = needsProvisional
      ? {
          provisionalProduct: {
            brandName: String(form.get("brandName") ?? ""),
            name: String(form.get("productName") ?? ""),
            sourceKind: "user" as const,
            fieldNames: ["brand", "name"],
          },
          collectionStatus: "tried" as const,
        }
      : { productId: selectedId, collectionStatus: "tried" as const };

    try {
      const result = await onConfirm({
        scanId: identification.scanId,
        idempotencyKey: idempotencyKey.current,
        confirmation,
      });
      if (!result.ok) {
        setError(result.error.title);
        return;
      }
      setConfirmed(result.data);
    } catch {
      setError(
        "Confirmation could not be saved. Try again with the same selection.",
      );
    } finally {
      setPending(false);
    }
  }

  if (confirmed) {
    return (
      <section className="confirmation-success" role="status">
        <h1>Added to your collection.</h1>
        <p>Your scan and collection update are safely stored.</p>
      </section>
    );
  }

  return (
    <form className="scan-result" onSubmit={submit}>
      <p className={`confidence-label ${identification.confidence}`}>
        {identification.confidence} confidence
      </p>
      {candidates.length > 0 ? (
        <CandidateList
          candidates={candidates}
          onSelect={setSelectedId}
          selectedId={selectedId}
        />
      ) : null}
      {identification.requiresCorrection || !selectedId ? (
        <fieldset className="correction-fields">
          <legend>Tell us what’s on the can</legend>
          <label htmlFor="correction-brand">Brand name</label>
          <input id="correction-brand" name="brandName" required />
          <label htmlFor="correction-product">Product name</label>
          <input id="correction-product" name="productName" required />
          <p>
            This creates a provisional entry with your correction as its source.
          </p>
        </fieldset>
      ) : null}
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <button
        className="button button-primary"
        disabled={pending}
        type="submit"
      >
        {pending ? "Saving…" : "Confirm product"}
      </button>
    </form>
  );
}
