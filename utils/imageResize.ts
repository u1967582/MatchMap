import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

/**
 * Tamaño máximo por tipo de imagen. La imagen se reduce para caber en la caja
 * manteniendo su proporción; nunca se amplía.
 *
 * bar usa 1400 px de ancho para cubrir un iPhone Pro Max (430 pt × 3x) sin
 * reescalar al mostrarla.
 */
export const UPLOAD_IMAGE_SIZES = {
  avatar: { width: 400, height: 400 },
  bar: { width: 1400, height: 788 },
  menu: { width: 900, height: 1200 },
  post: { width: 1200, height: 675 },
} as const;

export type UploadImageType = keyof typeof UPLOAD_IMAGE_SIZES;

export const UPLOAD_JPEG_QUALITY = 0.75;

/**
 * Dimensiones finales para que (width × height) quepa en la caja del tipo.
 * Devuelve null si la imagen ya cabe (no hace falta redimensionar).
 */
export function computeUploadSize(
  width: number,
  height: number,
  type: UploadImageType
): { width: number; height: number } | null {
  const box = UPLOAD_IMAGE_SIZES[type];
  if (!width || !height) return null;

  const scale = Math.min(box.width / width, box.height / height);
  if (scale >= 1) return null;

  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}

/**
 * Redimensiona y comprime un asset de expo-image-picker antes de subirlo.
 * Si falla el manipulado, devuelve la URI original para no bloquear la subida.
 */
export async function resizeForUpload(
  asset: { uri: string; width?: number; height?: number },
  type: UploadImageType
): Promise<string> {
  try {
    const size = computeUploadSize(asset.width ?? 0, asset.height ?? 0, type);
    const result = await manipulateAsync(asset.uri, size ? [{ resize: size }] : [], {
      compress: UPLOAD_JPEG_QUALITY,
      format: SaveFormat.JPEG,
    });
    return result.uri;
  } catch (error) {
    console.warn('No se pudo redimensionar la imagen, se sube la original:', error);
    return asset.uri;
  }
}
