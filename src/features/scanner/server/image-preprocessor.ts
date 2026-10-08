import "server-only";

import { createHash } from "node:crypto";
import sharp from "sharp";
import type { PreparedImage } from "@/features/scanner/providers/contracts";
import { AppError } from "@/lib/errors/app-error";

type ImageLimits = {
  maxBytes?: number;
  maxDimension?: number;
  maxPixels?: number;
};

function hasAllowedMagicBytes(bytes: Buffer) {
  const jpeg =
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff;
  const png =
    bytes.length >= 8 &&
    bytes
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const webp =
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP";
  return jpeg || png || webp;
}

export async function preprocessScanImage(
  file: Blob,
  limits: ImageLimits = {},
): Promise<PreparedImage> {
  const maxBytes = limits.maxBytes ?? 12 * 1024 * 1024;
  const maxDimension = limits.maxDimension ?? 12_000;
  const maxPixels = limits.maxPixels ?? 40_000_000;

  if (file.size === 0 || file.size > maxBytes) {
    throw new AppError("VALIDATION_ERROR", "The image is empty or too large.");
  }

  const input = Buffer.from(await file.arrayBuffer());
  if (!hasAllowedMagicBytes(input)) {
    throw new AppError(
      "VALIDATION_ERROR",
      "The file is not a supported JPEG, PNG, or WebP image.",
    );
  }

  try {
    const source = sharp(input, {
      failOn: "warning",
      limitInputPixels: maxPixels,
    });
    const metadata = await source.metadata();
    if (
      !metadata.width ||
      !metadata.height ||
      metadata.width < 32 ||
      metadata.height < 32
    ) {
      throw new AppError(
        "VALIDATION_ERROR",
        "The image dimensions are too small.",
      );
    }
    if (metadata.width > maxDimension || metadata.height > maxDimension) {
      throw new AppError(
        "VALIDATION_ERROR",
        "The image dimensions are too large.",
      );
    }

    const output = await source
      .rotate()
      .resize({
        width: 1_600,
        height: 1_600,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });

    return {
      bytes: output.data,
      mimeType: "image/jpeg",
      width: output.info.width,
      height: output.info.height,
      sha256: createHash("sha256").update(output.data).digest("hex"),
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      "VALIDATION_ERROR",
      "The image could not be safely decoded.",
      {
        cause: error,
      },
    );
  }
}
