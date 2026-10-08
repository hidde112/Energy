import type { Barcode } from "@/features/catalog/domain/barcode";
import {
  ZxingBarcodeDecoder,
  type BarcodeDecoder,
  type BarcodeSource,
} from "@/features/scanner/client/barcode-decoder";

export type CameraCapabilities = { torchSupported: boolean };

export interface CameraAdapter {
  start(
    video: HTMLVideoElement,
    onDetected: (barcode: Barcode) => void,
  ): Promise<CameraCapabilities>;
  stop(): void;
  setTorch(enabled: boolean): Promise<void>;
}

export async function decodeWithTimeout(
  decoder: BarcodeDecoder,
  source: BarcodeSource,
  timeoutMs: number,
) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      decoder.decode(source),
      new Promise<null>((resolve) => {
        timeout = setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export class CameraController implements CameraAdapter {
  private stream: MediaStream | null = null;
  private interval: ReturnType<typeof setInterval> | null = null;
  private videoTrack: MediaStreamTrack | null = null;
  private decoding = false;

  constructor(
    private readonly decoder: BarcodeDecoder = new ZxingBarcodeDecoder(),
  ) {}

  async start(
    video: HTMLVideoElement,
    onDetected: (barcode: Barcode) => void,
  ): Promise<CameraCapabilities> {
    this.stop();
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new DOMException("Camera unavailable", "NotFoundError");
    }

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: "environment" } },
    });
    this.videoTrack = this.stream.getVideoTracks()[0] ?? null;
    video.srcObject = this.stream;
    video.muted = true;
    video.setAttribute("playsinline", "true");
    await video.play();

    this.interval = setInterval(async () => {
      if (this.decoding) return;
      this.decoding = true;
      try {
        const barcode = await decodeWithTimeout(this.decoder, video, 450);
        if (barcode) onDetected(barcode);
      } finally {
        this.decoding = false;
      }
    }, 250);

    const capabilities = this.videoTrack?.getCapabilities?.() as
      (MediaTrackCapabilities & { torch?: boolean }) | undefined;
    return { torchSupported: capabilities?.torch === true };
  }

  async setTorch(enabled: boolean) {
    if (!this.videoTrack?.applyConstraints) return;
    const constraints = {
      advanced: [{ torch: enabled }],
    } as unknown as MediaTrackConstraints;
    await this.videoTrack.applyConstraints(constraints);
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
    for (const track of this.stream?.getTracks() ?? []) track.stop();
    this.stream = null;
    this.videoTrack = null;
    this.decoding = false;
  }
}
