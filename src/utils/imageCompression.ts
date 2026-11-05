/**
 * Compresses an image File or Blob by drawing it onto a canvas
 * and re-exporting as JPEG at the specified quality.
 *
 * @param input  - The original File or Blob to compress
 * @param quality - JPEG quality (0–1). Default 0.5 (50%)
 * @param maxDimension - Cap width/height to this value. Default 1920
 * @returns A compressed JPEG Blob
 */
export async function compressImageFile(
  input: File | Blob,
  quality: number = 0.5,
  maxDimension: number = 1920
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(input);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      // Calculate scaled dimensions
      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        const ratio = Math.min(maxDimension / width, maxDimension / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Image compression failed'));
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image for compression'));
    };

    img.src = objectUrl;
  });
}

/**
 * Iteratively compresses an image until output is ≤ targetRatio × original size.
 * Starts at quality 0.5 and steps down by 0.1 to a floor of 0.1.
 *
 * @param input        - The original File or Blob to compress
 * @param targetRatio  - Target size as fraction of original (e.g. 0.25 = 25%)
 * @param maxDimension - Cap width/height to this value. Default 1200
 * @returns A compressed JPEG Blob
 */
export async function compressToTargetSize(
  input: File | Blob,
  targetRatio: number = 0.25,
  maxDimension: number = 1200
): Promise<Blob> {
  const originalSize = input.size;
  const targetSize = originalSize * targetRatio;

  let quality = 0.5;
  let result = await compressImageFile(input, quality, maxDimension);

  while (result.size > targetSize && quality > 0.1) {
    quality = Math.max(quality - 0.1, 0.1);
    result = await compressImageFile(input, quality, maxDimension);
    if (quality <= 0.1) break;
  }

  return result;
}
