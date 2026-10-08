"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { CandidateList } from "@/features/scanner/components/candidate-list";
import {
  collectionStatusLabels,
  collectionStatuses,
  type CollectionStatus,
} from "@/features/collection/domain/collection";
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
    const external = identification.externalProduct;
    const needsProvisional =
      Boolean(external) || identification.requiresCorrection || !selectedId;
    const collectionStatus = String(
      form.get("collectionStatus") ?? "tried",
    ) as CollectionStatus;
    const provisionalProduct = external
      ? {
          brandName: external.brand ?? "Unknown brand",
          name: external.name,
          sizeMl: external.sizeMl ?? undefined,
          barcode: external.barcode.value,
          barcodeFormat: external.barcode.format,
          sourceKind: "open_food_facts" as const,
          sourceUrl: external.source.url,
          providerRecordId: external.source.recordId,
          fieldNames: ["barcode", "brand", "name", "size_ml"],
          confidence: 1,
        }
      : {
          brandName: String(form.get("brandName") ?? ""),
          name: String(form.get("productName") ?? ""),
          sourceKind: "user" as const,
          fieldNames: ["brand", "name"],
        };
    const confirmation = needsProvisional
      ? {
          provisionalProduct,
          collectionStatus,
        }
      : { productId: selectedId, collectionStatus };

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
        <div className="confirmation-actions">
          <Link
            className="button button-primary"
            href={`/products/${confirmed.productId}/rate`}
          >
            Rate this drink
          </Link>
          <Link className="button button-secondary" href="/collection">
            View collection
          </Link>
        </div>
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
      {identification.externalProduct ? (
        <section
          className="external-match"
          aria-labelledby="external-match-heading"
        >
          <p className="eyebrow">Open Food Facts match</p>
          <h2 id="external-match-heading">
            {identification.externalProduct.name}
          </h2>
          <p>
            {identification.externalProduct.brand ?? "Unknown brand"}
            {identification.externalProduct.sizeMl
              ? ` · ${identification.externalProduct.sizeMl} ml`
              : ""}
          </p>
          <small>
            This sourced record will be added as provisional until verified.
          </small>
        </section>
      ) : null}
      {(identification.requiresCorrection || !selectedId) &&
      !identification.externalProduct ? (
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
      <label htmlFor="collection-status">Collection status</label>
      <select
        defaultValue="tried"
        id="collection-status"
        name="collectionStatus"
      >
        {collectionStatuses
          .filter((status) => status !== "archived")
          .map((status) => (
            <option key={status} value={status}>
              {collectionStatusLabels[status]}
            </option>
          ))}
      </select>
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
