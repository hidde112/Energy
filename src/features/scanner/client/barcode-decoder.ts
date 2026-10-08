import { BrowserMultiFormatReader } from "@zxing/browser";
import {
  normalizeBarcode,
  type Barcode,
} from "@/features/catalog/domain/barcode";

export type BarcodeSource =
  HTMLVideoElement | HTMLImageElement | HTMLCanvasElement;

export interface BarcodeDecoder {
  decode(source: BarcodeSource): Promise<Barcode | null>;
}

export class ZxingBarcodeDecoder implements BarcodeDecoder {
  private readonly reader = new BrowserMultiFormatReader();

  async decode(source: BarcodeSource) {
    try {
      const result = this.reader.decode(source as HTMLVideoElement);
      return normalizeBarcode(result.getText());
    } catch {
      return null;
    }
  }
}
