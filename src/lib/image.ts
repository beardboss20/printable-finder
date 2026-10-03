const DECODE_ERROR = "Couldn't read this photo format — try a JPG/PNG or a screenshot";
const MAX_EDGE = 1280;
const MAX_BYTES = 25 * 1024 * 1024;

function looksLikeImage(file: File): boolean {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  if (type.startsWith("image/")) return true;
  return /\.(jpe?g|png|webp|gif|heic|heif|bmp|avif)$/.test(name);
}

export async function fileToCompressedDataUrl(file: File): Promise<string> {
  if (!looksLikeImage(file)) {
    throw new Error("Please choose a photo (JPG, PNG, or WebP).");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("That photo is a bit large. Try one under 25 MB.");
  }

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error(DECODE_ERROR);
    ctx.drawImage(bitmap, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", 0.85);
  } catch (err) {
    if (err instanceof Error && err.message === DECODE_ERROR) throw err;
    throw new Error(DECODE_ERROR);
  } finally {
    bitmap?.close();
  }
}
