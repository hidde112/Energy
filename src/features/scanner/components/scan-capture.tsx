"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Flashlight, ImagePlus, X } from "lucide-react";
import { ManualBarcodeForm } from "@/features/scanner/components/manual-barcode-form";
import {
  CameraController,
  type CameraAdapter,
} from "@/features/scanner/client/camera-controller";
import type { ScanInput } from "@/features/scanner/domain/scan-input";

const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export function ScanCapture({
  onCapture,
  camera,
  maxImageBytes = 10 * 1024 * 1024,
}: {
  onCapture: (input: ScanInput) => void;
  camera?: CameraAdapter;
  maxImageBytes?: number;
}) {
  const cameraRef = useRef<CameraAdapter | null>(null);
  if (cameraRef.current === null) {
    cameraRef.current = camera ?? new CameraController();
  }

  const videoRef = useRef<HTMLVideoElement>(null);
  const captured = useRef(false);
  const [active, setActive] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => cameraRef.current?.stop(), []);

  function captureOnce(input: ScanInput) {
    if (captured.current) return;
    captured.current = true;
    cameraRef.current?.stop();
    setActive(false);
    onCapture(input);
  }

  async function startCamera() {
    if (!videoRef.current) return;
    setError(null);
    captured.current = false;

    try {
      const capabilities = await cameraRef.current!.start(
        videoRef.current,
        (barcode) => captureOnce({ kind: "barcode", barcode }),
      );
      setTorchSupported(capabilities.torchSupported);
      setActive(true);
    } catch (caught) {
      cameraRef.current?.stop();
      setActive(false);
      setTorchSupported(false);
      const denied =
        caught instanceof DOMException && caught.name === "NotAllowedError";
      setError(
        denied
          ? "Camera permission was denied. Choose an image or enter the barcode instead."
          : "The camera is unavailable. Choose an image or enter the barcode instead.",
      );
    }
  }

  function stopCamera() {
    cameraRef.current?.stop();
    setActive(false);
    setTorchSupported(false);
    setTorchEnabled(false);
  }

  async function toggleTorch() {
    const next = !torchEnabled;
    try {
      await cameraRef.current?.setTorch(next);
      setTorchEnabled(next);
    } catch {
      setTorchSupported(false);
    }
  }

  function chooseImage(file: File | undefined) {
    setError(null);
    if (!file) return;
    if (!allowedImageTypes.has(file.type)) {
      setError("Choose a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > maxImageBytes) {
      setError("That image is too large. Choose a smaller file.");
      return;
    }

    captured.current = false;
    captureOnce({ kind: "image", file });
  }

  return (
    <div className="scan-capture">
      <div className={active ? "camera-stage active" : "camera-stage"}>
        <video aria-label="Camera preview" ref={videoRef} />
        {!active ? (
          <div className="camera-placeholder">
            <Camera aria-hidden="true" size={42} />
            <p>Line up the barcode or front of the can.</p>
          </div>
        ) : null}
        <div className="camera-actions">
          {!active ? (
            <button
              className="button button-primary"
              onClick={startCamera}
              type="button"
            >
              <Camera size={19} /> Start camera
            </button>
          ) : (
            <button
              className="button button-secondary"
              onClick={stopCamera}
              type="button"
            >
              <X size={19} /> Cancel camera
            </button>
          )}
          {active && torchSupported ? (
            <button
              className="button button-secondary"
              onClick={toggleTorch}
              type="button"
            >
              <Flashlight size={19} />{" "}
              {torchEnabled ? "Turn torch off" : "Turn torch on"}
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="scan-fallbacks">
        <label className="upload-button">
          <ImagePlus aria-hidden="true" size={21} />
          Choose can image
          <input
            accept="image/jpeg,image/png,image/webp"
            aria-label="Choose can image"
            onChange={(event) => chooseImage(event.target.files?.[0])}
            type="file"
          />
        </label>
        <ManualBarcodeForm onCapture={captureOnce} />
      </div>
    </div>
  );
}
