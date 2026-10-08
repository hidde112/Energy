import { AppError } from "@/lib/errors/app-error";

export type BarcodeFormat = "EAN-8" | "EAN-13" | "UPC-A";

export type Barcode = {
  value: string;
  format: BarcodeFormat;
};

function hasValidChecksum(value: string) {
  const checkDigit = Number(value.at(-1));
  const data = value.slice(0, -1);
  let sum = 0;

  for (
    let index = data.length - 1, position = 0;
    index >= 0;
    index--, position++
  ) {
    const digit = Number(data[index]);
    sum += digit * (position % 2 === 0 ? 3 : 1);
  }

  return (10 - (sum % 10)) % 10 === checkDigit;
}

export function normalizeBarcode(input: string): Barcode {
  const value = input.replace(/[\s-]/gu, "");
  const formatByLength: Partial<Record<number, BarcodeFormat>> = {
    8: "EAN-8",
    12: "UPC-A",
    13: "EAN-13",
  };
  const format = formatByLength[value.length];

  if (!format || !/^\d+$/u.test(value) || !hasValidChecksum(value)) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Enter a valid EAN-8, EAN-13, or UPC-A barcode.",
    );
  }

  return { value, format };
}
