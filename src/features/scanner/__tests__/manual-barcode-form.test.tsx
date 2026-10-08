import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ManualBarcodeForm } from "@/features/scanner/components/manual-barcode-form";

describe("ManualBarcodeForm", () => {
  it("normalizes and submits a valid barcode", async () => {
    const capture = vi.fn();
    const user = userEvent.setup();
    render(<ManualBarcodeForm onCapture={capture} />);

    await user.type(
      screen.getByLabelText(/barcode number/i),
      "9002 4901-0007 0",
    );
    await user.click(screen.getByRole("button", { name: /use barcode/i }));

    expect(capture).toHaveBeenCalledOnce();
    expect(capture).toHaveBeenCalledWith({
      kind: "barcode",
      barcode: { value: "9002490100070", format: "EAN-13" },
    });
  });

  it("keeps the form usable after an invalid checksum", async () => {
    const capture = vi.fn();
    const user = userEvent.setup();
    render(<ManualBarcodeForm onCapture={capture} />);

    await user.type(screen.getByLabelText(/barcode number/i), "9002490100071");
    await user.click(screen.getByRole("button", { name: /use barcode/i }));

    expect(capture).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/valid.*barcode/i);
    expect(screen.getByLabelText(/barcode number/i)).toBeEnabled();
  });
});
