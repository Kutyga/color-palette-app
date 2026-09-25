/**
 * Уменьшает фото до maxSide по длинной стороне и сжимает в JPEG — телефонные снимки по 5–10 МБ
 * грузились бы долго, а Pl@ntNet принимает до 4 МБ. Ориентацию EXIF учитывает браузер.
 */
export async function toJpeg(file: Blob, maxSide = 1600, quality = 0.85): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("Не удалось прочитать изображение");
  });
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Не удалось сжать фото"))), "image/jpeg", quality),
  );
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function blobToBase64(blob: Blob): Promise<string> {
  return (await blobToDataUrl(blob)).split(",", 2)[1];
}
