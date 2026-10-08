import type { Barcode } from "@/features/catalog/domain/barcode";

export type ScanInput =
  | { kind: "barcode"; barcode: Barcode }
  | { kind: "image"; file: File }
  | { kind: "camera-frame"; frame: Blob };
