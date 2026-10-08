import { describe, expect, it } from "vitest";
import { normalizeBarcode } from "@/features/catalog/domain/barcode";
import { AppError } from "@/lib/errors/app-error";

describe("normalizeBarcode", () => {
  it.each([
    [" 9002-4901 0007-0 ", "9002490100070", "EAN-13"],
    ["036000291452", "036000291452", "UPC-A"],
    ["9638 5074", "96385074", "EAN-8"],
  ])("normalizes %s without losing leading zeroes", (input, value, format) => {
    expect(normalizeBarcode(input)).toEqual({ value, format });
  });

  it.each(["9002490100071", "036000291453", "96385075", "123", "abcd"])(
    "rejects invalid or unsupported barcode %s",
    (input) => {
      expect(() => normalizeBarcode(input)).toThrowError(AppError);
      expect(() => normalizeBarcode(input)).toThrowError(/barcode/i);
    },
  );
});
