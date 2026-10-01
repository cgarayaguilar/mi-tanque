/** Longest side and quality of fleet photos (backend specs/0003 RF-13). */
export const PHOTO_MAX_SIDE = 1600
const JPEG_QUALITY = 0.8

/**
 * Shrinks a photo to fit PHOTO_MAX_SIDE and re-encodes it as JPEG (about
 * 300 KB from a phone camera), so uploads are fast on weak signal and well
 * under Storage's 2 MB ceiling.
 */
export const compressImage = async (file: Blob): Promise<Blob> => {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(
    1,
    PHOTO_MAX_SIDE / Math.max(bitmap.width, bitmap.height)
  )
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas 2D is not available')
  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => {
        if (blob) resolve(blob)
        else reject(new Error('Could not encode the photo'))
      },
      'image/jpeg',
      JPEG_QUALITY
    )
  })
}
