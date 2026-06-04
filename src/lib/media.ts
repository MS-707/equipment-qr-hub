/**
 * Shared media helpers — image compression + data-URL utilities.
 *
 * `compressPhoto` was originally inlined in PreTripInspection.tsx. It is
 * extracted here so pre-trip inspections and incident reports share one
 * implementation instead of duplicating it.
 */

/**
 * Reads an image File, scales it down to `maxW` (preserving aspect ratio),
 * and returns a compressed JPEG data URL. Mirrors the original inline behavior
 * (maxW 800, quality 0.7) so existing callers are unaffected.
 */
export function compressPhoto(file: File, maxW = 800, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const scale = img.width > maxW ? maxW / img.width : 1
        canvas.width = img.width * scale
        canvas.height = img.height * scale
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Canvas 2D context unavailable'))
          return
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.onerror = reject
      img.src = e.target?.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/** Rough byte size of a base64 data URL (for storage budgeting). */
export function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',')
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl
  return Math.floor((b64.length * 3) / 4)
}
