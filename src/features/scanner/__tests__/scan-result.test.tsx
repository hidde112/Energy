import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ScanResult } from "@/features/scanner/components/scan-result";
import type { ConfirmedScan } from "@/features/scanner/server/confirm-scan";
import type { IdentificationResult } from "@/features/scanner/server/identification-service";
import type { ActionResult } from "@/lib/actions/action-result";

const product = {
  id: "product-1",
  name: "Energy Drink",
  normalizedName: "energy drink",
  brand: { id: "brand-1", name: "Pulse", slug: "pulse" },
  flavor: null,
  variant: null,
  sizeMl: 250,
  verificationStatus: "verified" as const,
  image: null,
};

function result(confidence: "high" | "medium" | "low"): IdentificationResult {
  return {
    scanId: "52000000-0000-0000-0000-000000000001",
    source: "vision",
    confidence,
    candidates: Array.from({ length: 4 }, (_, index) => ({
      product: { ...product, id: `product-${index + 1}` },
      score: confidence === "low" ? 0.2 : 0.6,
      confidence,
      signals: {
        exactBarcode: false,
        name: 0.6,
        brand: 0.6,
        variant: 0,
        flavor: 0,
        size: 1,
      },
    })),
    externalProduct: null,
    requiresCorrection: confidence === "low",
  };
}

describe("ScanResult", () => {
  it("shows at most three medium candidates", () => {
    render(
      <ScanResult identification={result("medium")} onConfirm={vi.fn()} />,
    );
    expect(screen.getAllByRole("radio")).toHaveLength(3);
  });

  it("requires correction details for a low-confidence result", () => {
    render(<ScanResult identification={result("low")} onConfirm={vi.fn()} />);
    expect(screen.getByLabelText(/brand name/i)).toBeRequired();
    expect(screen.getByLabelText(/product name/i)).toBeRequired();
  });

  it("never shows success after failed persistence and blocks double submit", async () => {
    let resolve: ((value: ActionResult<ConfirmedScan>) => void) | undefined;
    const confirm = vi.fn(
      () =>
        new Promise<ActionResult<ConfirmedScan>>((done) => {
          resolve = done;
        }),
    );
    const user = userEvent.setup();
    render(<ScanResult identification={result("high")} onConfirm={confirm} />);

    const button = screen.getByRole("button", { name: /confirm product/i });
    await user.click(button);
    await user.click(button);
    expect(confirm).toHaveBeenCalledOnce();

    resolve?.({
      ok: false,
      error: {
        type: "https://energydex.app/problems/unexpected",
        title: "Confirmation could not be saved.",
        status: 500,
        code: "UNEXPECTED",
        correlationId: "confirm-test",
      },
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /could not be saved/i,
    );
    expect(
      screen.queryByText(/added to your collection/i),
    ).not.toBeInTheDocument();
  });
});
