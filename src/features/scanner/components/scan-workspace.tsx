"use client";

import { useState } from "react";
import { ScanCapture } from "@/features/scanner/components/scan-capture";
import type { ScanInput } from "@/features/scanner/domain/scan-input";

export function ScanWorkspace() {
  const [input, setInput] = useState<ScanInput | null>(null);

  return (
    <>
      <ScanCapture onCapture={setInput} />
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
