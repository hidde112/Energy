import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ScanCapture } from "@/features/scanner/components/scan-capture";
import {
  CameraController,
  decodeWithTimeout,
  type CameraAdapter,
} from "@/features/scanner/client/camera-controller";
import type { BarcodeDecoder } from "@/features/scanner/client/barcode-decoder";
import type { Barcode } from "@/features/catalog/domain/barcode";

function camera(overrides: Partial<CameraAdapter> = {}): CameraAdapter {
  return {
    start: vi.fn().mockResolvedValue({ torchSupported: false }),
    stop: vi.fn(),
    setTorch: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("camera capture", () => {
  it("requests the rear camera and stops every track", async () => {
    const stop = vi.fn();
    const getUserMedia = vi.fn().mockResolvedValue({
      getVideoTracks: () => [{ getCapabilities: () => ({}), stop }],
      getTracks: () => [{ stop }],
    });
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
    const controller = new CameraController({ decode: vi.fn() });
    const video = document.createElement("video");
    video.play = vi.fn().mockResolvedValue(undefined);

    await controller.start(video, vi.fn());

    expect(getUserMedia).toHaveBeenCalledWith({
      audio: false,
      video: { facingMode: { ideal: "environment" } },
    });
    controller.stop();
    expect(stop).toHaveBeenCalled();
  });

  it("cleans up a decoder timeout", async () => {
    vi.useFakeTimers();
    const decoder: BarcodeDecoder = {
      decode: vi.fn(() => new Promise<Barcode | null>(() => {})),
    };
    const pending = decodeWithTimeout(
      decoder,
      document.createElement("video"),
      100,
    );

    await vi.advanceTimersByTimeAsync(100);

    await expect(pending).resolves.toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("shows permission help while retaining gallery and manual entry", async () => {
    const denied = camera({
      start: vi
        .fn()
        .mockRejectedValue(
          new DOMException("Permission denied", "NotAllowedError"),
        ),
    });
    const user = userEvent.setup();
    render(<ScanCapture camera={denied} onCapture={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /start camera/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/permission/i);
    expect(screen.getByLabelText(/choose.*image/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/barcode number/i)).toBeInTheDocument();
  });

  it("hides torch controls when the active track does not support them", async () => {
    const user = userEvent.setup();
    render(<ScanCapture camera={camera()} onCapture={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /start camera/i }));

    expect(
      screen.queryByRole("button", { name: /torch/i }),
    ).not.toBeInTheDocument();
  });

  it("rejects unsupported and oversized gallery files", async () => {
    const capture = vi.fn();
    render(
      <ScanCapture camera={camera()} onCapture={capture} maxImageBytes={8} />,
    );
    const input = screen.getByLabelText(/choose.*image/i);

    fireEvent.change(input, {
      target: {
        files: [new File(["text"], "can.txt", { type: "text/plain" })],
      },
    });
    expect(screen.getByRole("alert")).toHaveTextContent(/jpeg.*png.*webp/i);

    fireEvent.change(input, {
      target: {
        files: [new File(["too large"], "can.jpg", { type: "image/jpeg" })],
      },
    });
    expect(screen.getByRole("alert")).toHaveTextContent(/too large/i);
    expect(capture).not.toHaveBeenCalled();
  });

  it("emits at most one capture when the decoder reports twice", async () => {
    const barcode: Barcode = { value: "9002490100070", format: "EAN-13" };
    let report: ((value: Barcode) => void) | undefined;
    const adapter = camera({
      start: vi.fn(async (_video, onDetected) => {
        report = onDetected;
        return { torchSupported: false };
      }),
    });
    const capture = vi.fn();
    const user = userEvent.setup();
    render(<ScanCapture camera={adapter} onCapture={capture} />);
    await user.click(screen.getByRole("button", { name: /start camera/i }));

    act(() => {
      report?.(barcode);
      report?.(barcode);
    });

    expect(capture).toHaveBeenCalledOnce();
    expect(adapter.stop).toHaveBeenCalledOnce();
  });
});
