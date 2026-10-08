"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ScanCapture } from "@/features/scanner/components/scan-capture";
import type { ScanInput } from "@/features/scanner/domain/scan-input";

export function ScanWorkspace() {
  const router = useRouter();
  const [captureAttempt, setCaptureAttempt] = useState(0);
  const [input, setInput] = useState<ScanInput | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function identify(captured: ScanInput) {
    setInput(captured);
    setError(null);
    const idempotencyKey = crypto.randomUUID();
    const init: RequestInit = {
      method: "POST",
      headers: { "idempotency-key": idempotencyKey },
    };
    if (captured.kind === "barcode") {
      init.headers = {
        ...init.headers,
        "content-type": "application/json",
      };
      init.body = JSON.stringify({ barcode: captured.barcode.value });
    } else {
      const form = new FormData();
      const file =
        captured.kind === "image"
          ? captured.file
          : new File([captured.frame], "camera-frame.jpg", {
              type: captured.frame.type || "image/jpeg",
            });
      form.set("file", file);
      init.body = form;
    }

    try {
      const response = await fetch("/api/scans/identify", init);
      const body = (await response.json()) as {
        scanId?: string;
        title?: string;
      };
      if (!response.ok || !body.scanId) {
        setError(body.title ?? "Identification failed. Try another method.");
        setCaptureAttempt((current) => current + 1);
        return;
      }
      router.push(`/scan/${body.scanId}`);
    } catch {
      setError("Identification failed. Check your connection and try again.");
      setCaptureAttempt((current) => current + 1);
    }
  }

  return (
    <>
      <ScanCapture key={captureAttempt} onCapture={identify} />
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {input ? (
        <p className="scan-ready" role="status">
          {input.kind === "barcode"
            ? `Barcode ${input.barcode.value} is ready to identify.`
            : input.kind === "image"
              ? `${input.file.name} is ready to identify.`
              : "Camera frame is ready to identify."}
        </p>
      ) : null}
    </>
  );
}
