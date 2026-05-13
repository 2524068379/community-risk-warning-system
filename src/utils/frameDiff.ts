export function toGrayscale(rgba: Uint8ClampedArray): Uint8ClampedArray {
  const pixelCount = rgba.length / 4
  const gray = new Uint8ClampedArray(pixelCount)
  for (let i = 0; i < pixelCount; i++) {
    const offset = i * 4
    gray[i] = Math.round(
      0.299 * rgba[offset] + 0.587 * rgba[offset + 1] + 0.114 * rgba[offset + 2]
    )
  }
  return gray
}

export function computeFrameDiff(
  current: Uint8ClampedArray,
  previous: Uint8ClampedArray,
  pixelThreshold = 30
): number {
  if (current.length !== previous.length) return 1
  if (current.length === 0) return 0
  let changed = 0
  for (let i = 0; i < current.length; i++) {
    if (Math.abs(current[i] - previous[i]) > pixelThreshold) {
      changed++
    }
  }
  return changed / current.length
}
