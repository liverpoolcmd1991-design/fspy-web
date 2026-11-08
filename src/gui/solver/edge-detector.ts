/**
 * fSpy Studio — Smart Sub-Pixel Edge Detector, Corner/Segment Snapper & RANSAC VP Line Finder
 * Uses 98th-percentile contrast normalization, Non-Maximum Suppression (NMS),
 * collinear segment merging, corner-intersection detection, and orientation-aware snapping.
 */

import Point2D from './point-2d'
import { ControlPointPairState } from '../types/control-points-state'

export interface DetectedEdgeSegment {
  p1: Point2D // Relative [0, 1] coordinates
  p2: Point2D // Relative [0, 1] coordinates
  angleRad: number
  strength: number
  lengthRel: number
}

export interface EdgeGradientMap {
  width: number
  height: number
  /** Normalized Sobel gradient magnitude [0..1] (98th-percentile contrast normalized) */
  mag: Float32Array
  /** Non-Maximum Suppressed ridge strength [0..1] */
  nms: Float32Array
  /** Normalized gradient normal X component */
  nx: Float32Array
  /** Normalized gradient normal Y component */
  ny: Float32Array
  /** Extracted prominent straight line segments in relative [0..1] coordinates */
  segments: DetectedEdgeSegment[]
  /** Detected architectural corner intersections in relative [0..1] coordinates */
  corners: Point2D[]
}

export interface SnapOptions {
  searchRadiusPx?: number
  minStrengthThreshold?: number
  /** Optional opposite endpoint of the line/rail being dragged to prefer collinear edges */
  anchorRelPoint?: Point2D
}

export interface SnapResult {
  point: Point2D
  snapped: boolean
  snappedSegment?: DetectedEdgeSegment
  snapKind?: 'corner' | 'segment' | 'ridge'
}

/**
 * Computes a downsampled Sobel gradient map, NMS ridge map, straight architectural
 * line segments, and corner intersections from an image URL.
 */
export async function buildEdgeGradientMap(
  imageUrl: string,
  maxDimension = 960
): Promise<EdgeGradientMap | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const scale = Math.min(
          1,
          maxDimension / Math.max(img.naturalWidth || 1, img.naturalHeight || 1)
        )
        const width = Math.max(64, Math.round(img.naturalWidth * scale))
        const height = Math.max(64, Math.round(img.naturalHeight * scale))

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(null)
          return
        }

        ctx.drawImage(img, 0, 0, width, height)
        const rgba = ctx.getImageData(0, 0, width, height).data
        const count = width * height

        // 1. Convert to perceptual luma [0..255]
        const luma = new Float32Array(count)
        for (let i = 0; i < count; i++) {
          const offset = i * 4
          luma[i] =
            0.299 * rgba[offset] +
            0.587 * rgba[offset + 1] +
            0.114 * rgba[offset + 2]
        }

        // 2. Separable 5-tap Gaussian smoothing [1, 4, 6, 4, 1] / 16 to suppress sensor/JPEG grain
        const tempBlur = new Float32Array(count)
        const blurred = new Float32Array(count)
        for (let y = 0; y < height; y++) {
          const row = y * width
          for (let x = 0; x < width; x++) {
            const xm2 = Math.max(0, x - 2)
            const xm1 = Math.max(0, x - 1)
            const xp1 = Math.min(width - 1, x + 1)
            const xp2 = Math.min(width - 1, x + 2)
            tempBlur[row + x] =
              (luma[row + xm2] +
                4 * luma[row + xm1] +
                6 * luma[row + x] +
                4 * luma[row + xp1] +
                luma[row + xp2]) *
              0.0625
          }
        }
        for (let y = 0; y < height; y++) {
          const ym2 = Math.max(0, y - 2) * width
          const ym1 = Math.max(0, y - 1) * width
          const y0 = y * width
          const yp1 = Math.min(height - 1, y + 1) * width
          const yp2 = Math.min(height - 1, y + 2) * width
          for (let x = 0; x < width; x++) {
            blurred[y0 + x] =
              (tempBlur[ym2 + x] +
                4 * tempBlur[ym1 + x] +
                6 * tempBlur[y0 + x] +
                4 * tempBlur[yp1 + x] +
                tempBlur[yp2 + x]) *
              0.0625
          }
        }

        // 3. Sobel 3x3 gradient operator
        const mag = new Float32Array(count)
        const nx = new Float32Array(count)
        const ny = new Float32Array(count)

        // Histogram for robust 98th-percentile contrast normalization
        const histBins = 512
        const hist = new Uint32Array(histBins)
        let rawMax = 1e-5

        for (let y = 1; y < height - 1; y++) {
          for (let x = 1; x < width - 1; x++) {
            const idx = y * width + x
            const tl = blurred[(y - 1) * width + (x - 1)]
            const tc = blurred[(y - 1) * width + x]
            const tr = blurred[(y - 1) * width + (x + 1)]
            const ml = blurred[y * width + (x - 1)]
            const mr = blurred[y * width + (x + 1)]
            const bl = blurred[(y + 1) * width + (x - 1)]
            const bc = blurred[(y + 1) * width + x]
            const br = blurred[(y + 1) * width + (x + 1)]

            const gx = -tl + tr - 2 * ml + 2 * mr - bl + br
            const gy = -tl - 2 * tc - tr + bl + 2 * bc + br
            const m = Math.hypot(gx, gy)
            mag[idx] = m
            if (m > 1e-5) {
              nx[idx] = gx / m
              ny[idx] = gy / m
              if (m > rawMax) rawMax = m
            }
          }
        }

        let nonZeroCount = 0
        for (let i = 0; i < count; i++) {
          const m = mag[i]
          if (m > 1.5) {
            const bin = Math.min(
              histBins - 1,
              Math.floor((m / rawMax) * (histBins - 1))
            )
            hist[bin]++
            nonZeroCount++
          }
        }

        // Find 98th percentile of active gradients so bright windows don't crush indoor walls
        let accum = 0
        const targetRank = Math.floor(nonZeroCount * 0.98)
        let p98Bin = histBins - 1
        for (let b = 0; b < histBins; b++) {
          accum += hist[b]
          if (accum >= targetRank) {
            p98Bin = Math.max(8, b)
            break
          }
        }
        const normScale = Math.max(12, (p98Bin / (histBins - 1)) * rawMax)

        for (let i = 0; i < count; i++) {
          const normalized = Math.min(1, mag[i] / normScale)
          // Gentle gamma boost so medium-contrast indoor edges (baseboards, tiles) snap reliably
          mag[i] = normalized > 0 ? Math.pow(normalized, 0.78) : 0
        }

        // 4. Non-Maximum Suppression (NMS) along gradient normal to isolate crisp 1px edge ridges
        const nms = new Float32Array(count)
        for (let y = 2; y < height - 2; y++) {
          for (let x = 2; x < width - 2; x++) {
            const idx = y * width + x
            const m = mag[idx]
            if (m < 0.05) continue
            const dx = Math.round(nx[idx])
            const dy = Math.round(ny[idx])
            const mPrev = mag[(y - dy) * width + (x - dx)]
            const mNext = mag[(y + dy) * width + (x + dx)]
            if (m >= mPrev * 0.96 && m >= mNext * 0.96) {
              nms[idx] = m
            } else {
              nms[idx] = m * 0.35
            }
          }
        }

        const segments = extractStraightSegments(width, height, mag, nms, nx, ny)
        const corners = extractCornerIntersections(segments)
        resolve({ width, height, mag, nms, nx, ny, segments, corners })
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = imageUrl
  })
}

/**
 * Extracts prominent straight architectural line segments from the Sobel/NMS gradient field
 * and merges collinear neighboring segments.
 */
function extractStraightSegments(
  width: number,
  height: number,
  mag: Float32Array,
  nms: Float32Array,
  nx: Float32Array,
  ny: Float32Array
): DetectedEdgeSegment[] {
  const visited = new Uint8Array(width * height)
  const rawSegments: DetectedEdgeSegment[] = []

  // Collect strong NMS ridge candidates
  const candidates: number[] = []
  const threshold = 0.14
  for (let y = 4; y < height - 4; y += 2) {
    for (let x = 4; x < width - 4; x += 2) {
      const idx = y * width + x
      if (nms[idx] >= threshold) {
        candidates.push(idx)
      }
    }
  }

  candidates.sort((a, b) => nms[b] - nms[a])

  const angleToleranceCos = Math.cos((15 * Math.PI) / 180) // 15 deg tolerance
  const minLengthPx = Math.max(12, Math.round(Math.min(width, height) * 0.028))

  for (let c = 0; c < candidates.length && rawSegments.length < 110; c++) {
    const seedIdx = candidates[c]
    if (visited[seedIdx]) continue

    const seedX = seedIdx % width
    const seedY = Math.floor(seedIdx / width)
    const refNx = nx[seedIdx]
    const refNy = ny[seedIdx]

    // Tangent vector is perpendicular to gradient normal
    const tx = -refNy
    const ty = refNx

    const pointsX: number[] = [seedX]
    const pointsY: number[] = [seedY]
    let sumStrength = mag[seedIdx]
    visited[seedIdx] = 1

    for (const dir of [-1, 1]) {
      let curX = seedX
      let curY = seedY
      let misses = 0

      for (let step = 1; step < 300; step++) {
        const nextX = curX + dir * tx
        const nextY = curY + dir * ty
        const ix = Math.round(nextX)
        const iy = Math.round(nextY)

        if (ix < 2 || ix >= width - 2 || iy < 2 || iy >= height - 2) {
          break
        }

        // Search 1px perpendicular neighborhood for the strongest aligned edge pixel
        let bestIdx = -1
        let bestM = 0
        let bestX = ix
        let bestY = iy

        for (let offset = -1; offset <= 1; offset++) {
          const sx = Math.round(nextX + offset * refNx)
          const sy = Math.round(nextY + offset * refNy)
          if (sx < 2 || sx >= width - 2 || sy < 2 || sy >= height - 2) continue
          const sIdx = sy * width + sx
          const m = mag[sIdx]
          if (m >= threshold * 0.72) {
            const dot = Math.abs(nx[sIdx] * refNx + ny[sIdx] * refNy)
            if (dot >= angleToleranceCos && m > bestM) {
              bestM = m
              bestIdx = sIdx
              bestX = sx
              bestY = sy
            }
          }
        }

        if (bestIdx !== -1) {
          visited[bestIdx] = 1
          pointsX.push(bestX)
          pointsY.push(bestY)
          sumStrength += bestM
          curX = bestX
          curY = bestY
          misses = 0
        } else {
          misses++
          curX = nextX
          curY = nextY
          if (misses > 3) break
        }
      }
    }

    if (pointsX.length < minLengthPx) continue

    // Orthogonal Deming regression (PCA) on collected pixel coordinates
    let meanX = 0
    let meanY = 0
    const n = pointsX.length
    for (let i = 0; i < n; i++) {
      meanX += pointsX[i]
      meanY += pointsY[i]
    }
    meanX /= n
    meanY /= n

    let sxx = 0
    let syy = 0
    let sxy = 0
    for (let i = 0; i < n; i++) {
      const dx = pointsX[i] - meanX
      const dy = pointsY[i] - meanY
      sxx += dx * dx
      syy += dy * dy
      sxy += dx * dy
    }

    const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy)
    const dirX = Math.cos(angle)
    const dirY = Math.sin(angle)

    let minProj = Infinity
    let maxProj = -Infinity
    let maxOrthoResid = 0
    for (let i = 0; i < n; i++) {
      const dx = pointsX[i] - meanX
      const dy = pointsY[i] - meanY
      const proj = dx * dirX + dy * dirY
      const ortho = Math.abs(-dx * dirY + dy * dirX)
      if (proj < minProj) minProj = proj
      if (proj > maxProj) maxProj = proj
      if (ortho > maxOrthoResid) maxOrthoResid = ortho
    }

    if (maxOrthoResid > 3.2) continue

    const p1: Point2D = {
      x: Math.min(0.995, Math.max(0.005, (meanX + minProj * dirX) / width)),
      y: Math.min(0.995, Math.max(0.005, (meanY + minProj * dirY) / height))
    }
    const p2: Point2D = {
      x: Math.min(0.995, Math.max(0.005, (meanX + maxProj * dirX) / width)),
      y: Math.min(0.995, Math.max(0.005, (meanY + maxProj * dirY) / height))
    }

    const lengthRel = Math.hypot(p2.x - p1.x, p2.y - p1.y)
    if (lengthRel < 0.04) continue

    rawSegments.push({
      p1,
      p2,
      angleRad: Math.atan2(p2.y - p1.y, p2.x - p1.x),
      strength: sumStrength / n,
      lengthRel
    })
  }

  // Merge collinear neighboring segments that lie along the same architectural edge
  const merged = mergeCollinearSegments(rawSegments)
  merged.sort((a, b) => b.lengthRel * b.strength - a.lengthRel * a.strength)
  return merged.slice(0, 72)
}

function mergeCollinearSegments(
  segments: DetectedEdgeSegment[]
): DetectedEdgeSegment[] {
  const used = new Uint8Array(segments.length)
  const out: DetectedEdgeSegment[] = []

  for (let i = 0; i < segments.length; i++) {
    if (used[i]) continue
    let cur = segments[i]
    used[i] = 1

    let changed = true
    while (changed) {
      changed = false
      const dx = cur.p2.x - cur.p1.x
      const dy = cur.p2.y - cur.p1.y
      const len = Math.hypot(dx, dy)
      if (len < 1e-5) break
      const ux = dx / len
      const uy = dy / len

      for (let j = i + 1; j < segments.length; j++) {
        if (used[j]) continue
        const cand = segments[j]
        const cdx = cand.p2.x - cand.p1.x
        const cdy = cand.p2.y - cand.p1.y
        const clen = Math.hypot(cdx, cdy)
        if (clen < 1e-5) continue
        const dot = Math.abs((ux * cdx + uy * cdy) / clen)
        if (dot < Math.cos((6 * Math.PI) / 180)) continue

        // Perpendicular distance from candidate endpoints to cur line
        const ortho1 = Math.abs(
          (cand.p1.x - cur.p1.x) * -uy + (cand.p1.y - cur.p1.y) * ux
        )
        const ortho2 = Math.abs(
          (cand.p2.x - cur.p1.x) * -uy + (cand.p2.y - cur.p1.y) * ux
        )
        if (ortho1 > 0.008 || ortho2 > 0.008) continue

        // Project all 4 endpoints onto cur axis
        const tA = 0
        const tB = len
        const tC = (cand.p1.x - cur.p1.x) * ux + (cand.p1.y - cur.p1.y) * uy
        const tD = (cand.p2.x - cur.p1.x) * ux + (cand.p2.y - cur.p1.y) * uy
        const cMin = Math.min(tC, tD)
        const cMax = Math.max(tC, tD)

        // Merge if overlapping or separated by a small gap (< 3.5% of image)
        if (cMax >= tA - 0.035 && cMin <= tB + 0.035) {
          const allPts = [
            { pt: cur.p1, t: tA },
            { pt: cur.p2, t: tB },
            { pt: cand.p1, t: tC },
            { pt: cand.p2, t: tD }
          ]
          allPts.sort((a, b) => a.t - b.t)
          const p1 = allPts[0].pt
          const p2 = allPts[3].pt
          const lengthRel = Math.hypot(p2.x - p1.x, p2.y - p1.y)
          cur = {
            p1,
            p2,
            angleRad: Math.atan2(p2.y - p1.y, p2.x - p1.x),
            strength:
              (cur.strength * cur.lengthRel + cand.strength * cand.lengthRel) /
              Math.max(1e-5, cur.lengthRel + cand.lengthRel),
            lengthRel
          }
          used[j] = 1
          changed = true
        }
      }
    }
    out.push(cur)
  }

  return out
}

/**
 * Finds architectural corners where two strong detected segments meet or nearly meet.
 */
function extractCornerIntersections(
  segments: DetectedEdgeSegment[]
): Point2D[] {
  const corners: Point2D[] = []
  const top = segments.slice(0, 42)

  for (let i = 0; i < top.length; i++) {
    for (let j = i + 1; j < top.length; j++) {
      const a = top[i]
      const b = top[j]
      const ax = a.p2.x - a.p1.x
      const ay = a.p2.y - a.p1.y
      const bx = b.p2.x - b.p1.x
      const by = b.p2.y - b.p1.y
      const al = Math.hypot(ax, ay)
      const bl = Math.hypot(bx, by)
      if (al < 1e-5 || bl < 1e-5) continue

      // Must intersect at a meaningful angle (> 25 deg)
      const cosAng = Math.abs((ax * bx + ay * by) / (al * bl))
      if (cosAng > Math.cos((25 * Math.PI) / 180)) continue

      const denom = ax * by - ay * bx
      if (Math.abs(denom) < 1e-6) continue

      const dx = b.p1.x - a.p1.x
      const dy = b.p1.y - a.p1.y
      const t = (dx * by - dy * bx) / denom
      const u = (dx * ay - dy * ax) / denom

      // Allow small extension beyond segment endpoints (up to 4.5% of image)
      const extA = 0.045 / al
      const extB = 0.045 / bl
      if (t >= -extA && t <= 1 + extA && u >= -extB && u <= 1 + extB) {
        const ix = a.p1.x + t * ax
        const iy = a.p1.y + t * ay
        if (ix >= 0.01 && ix <= 0.99 && iy >= 0.01 && iy <= 0.99) {
          const isDuplicate = corners.some(
            (c) => Math.hypot(c.x - ix, c.y - iy) < 0.012
          )
          if (!isDuplicate) {
            corners.push({ x: ix, y: iy })
          }
        }
      }
    }
  }

  return corners
}

/**
 * Refines a relative point by walking 1-2px along the local Sobel normal and fitting a parabola.
 */
function refineSubPixelPeak(
  relPt: Point2D,
  edgeMap: EdgeGradientMap
): Point2D {
  const { width, height, mag, nx, ny } = edgeMap
  const cx = Math.min(width - 2, Math.max(1, Math.round(relPt.x * width)))
  const cy = Math.min(height - 2, Math.max(1, Math.round(relPt.y * height)))
  const idx = cy * width + cx
  const m0 = mag[idx]
  if (m0 < 0.04) return relPt

  const gnx = nx[idx]
  const gny = ny[idx]
  const prevX = Math.min(width - 1, Math.max(0, Math.round(cx - gnx)))
  const prevY = Math.min(height - 1, Math.max(0, Math.round(cy - gny)))
  const nextX = Math.min(width - 1, Math.max(0, Math.round(cx + gnx)))
  const nextY = Math.min(height - 1, Math.max(0, Math.round(cy + gny)))

  const mPrev = mag[prevY * width + prevX]
  const mNext = mag[nextY * width + nextX]
  const denom = 2 * (mPrev - 2 * m0 + mNext)

  let subShift = 0
  if (Math.abs(denom) > 1e-5) {
    subShift = Math.max(-0.65, Math.min(0.65, (mPrev - mNext) / denom))
  }

  return {
    x: Math.min(1, Math.max(0, (cx + subShift * gnx) / width)),
    y: Math.min(1, Math.max(0, (cy + subShift * gny) / height))
  }
}

/**
 * Snaps a relative [0..1] point to:
 * 1. Nearby architectural corner intersections (when no directional anchor is active),
 * 2. Nearby detected straight architectural line segments (with directional bonus if anchorRelPoint is provided),
 * 3. Local Non-Maximum-Suppressed Sobel gradient ridges with sub-pixel parabolic refinement.
 */
export function snapRelativePointToEdge(
  relPoint: Point2D,
  edgeMap: EdgeGradientMap,
  optionsOrRadius: number | SnapOptions = 20,
  minStrengthThresholdArg = 0.07
): SnapResult {
  const opts: SnapOptions =
    typeof optionsOrRadius === 'number'
      ? {
          searchRadiusPx: optionsOrRadius,
          minStrengthThreshold: minStrengthThresholdArg
        }
      : optionsOrRadius

  const searchRadiusPx = opts.searchRadiusPx ?? 20
  const minStrengthThreshold = opts.minStrengthThreshold ?? 0.07
  const anchorRelPoint = opts.anchorRelPoint

  const { width, height, mag, nms, nx, ny, segments, corners } = edgeMap
  const diagPx = Math.hypot(width, height)

  // Compute optional unit direction from anchorRelPoint -> relPoint
  let lineDirX = 0
  let lineDirY = 0
  let hasLineDir = false
  if (anchorRelPoint) {
    const ldx = (relPoint.x - anchorRelPoint.x) * width
    const ldy = (relPoint.y - anchorRelPoint.y) * height
    const lLen = Math.hypot(ldx, ldy)
    if (lLen > 12) {
      lineDirX = ldx / lLen
      lineDirY = ldy / lLen
      hasLineDir = true
    }
  }

  // STAGE 1: Corner Intersection Snap (within 10px when placing corners/origins/quads)
  if (!hasLineDir && corners && corners.length > 0) {
    const cornerRadiusPx = Math.min(11, searchRadiusPx * 0.6)
    let bestCorner: Point2D | null = null
    let bestCornerDistPx = cornerRadiusPx
    for (let i = 0; i < corners.length; i++) {
      const c = corners[i]
      const distPx = Math.hypot(
        (c.x - relPoint.x) * width,
        (c.y - relPoint.y) * height
      )
      if (distPx < bestCornerDistPx) {
        bestCornerDistPx = distPx
        bestCorner = c
      }
    }
    if (bestCorner) {
      return {
        point: refineSubPixelPeak(bestCorner, edgeMap),
        snapped: true,
        snapKind: 'corner'
      }
    }
  }

  // STAGE 2: Extracted Straight Architectural Segment Snap
  const segRadiusPx = Math.max(14, searchRadiusPx * 0.9)
  let bestSeg: DetectedEdgeSegment | undefined
  let bestSegPoint: Point2D | null = null
  let bestSegScore = 0

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    const x1 = seg.p1.x * width
    const y1 = seg.p1.y * height
    const x2 = seg.p2.x * width
    const y2 = seg.p2.y * height
    const sx = x2 - x1
    const sy = y2 - y1
    const sLenSq = sx * sx + sy * sy
    if (sLenSq < 25) continue
    const sLen = Math.sqrt(sLenSq)

    const px = relPoint.x * width
    const py = relPoint.y * height

    // Allow a small 10px extension past the segment endpoints so users can drag along the full line
    const extT = Math.min(0.15, 10 / sLen)
    const rawT = ((px - x1) * sx + (py - y1) * sy) / sLenSq
    if (rawT < -extT || rawT > 1 + extT) continue

    const clampedT = Math.max(-extT, Math.min(1 + extT, rawT))
    const projX = x1 + clampedT * sx
    const projY = y1 + clampedT * sy
    const distPx = Math.hypot(px - projX, py - projY)
    if (distPx > segRadiusPx) continue

    const distWeight = Math.exp(
      -(distPx * distPx) / (2 * (segRadiusPx * 0.48) * (segRadiusPx * 0.48))
    )

    // Direction alignment bonus if dragging a line endpoint with a known opposite anchor
    let dirBonus = 1.0
    if (hasLineDir) {
      const segUx = sx / sLen
      const segUy = sy / sLen
      const align = Math.abs(segUx * lineDirX + segUy * lineDirY)
      // Strong boost when the segment is roughly collinear with the line being dragged
      dirBonus = align > 0.88 ? 1.85 : align > 0.7 ? 1.35 : 0.75
    }

    const lengthBonus = 1 + Math.min(0.6, (sLen / diagPx) * 2.2)
    const score = seg.strength * distWeight * dirBonus * lengthBonus

    if (score > bestSegScore) {
      bestSegScore = score
      bestSeg = seg
      bestSegPoint = {
        x: Math.min(1, Math.max(0, projX / width)),
        y: Math.min(1, Math.max(0, projY / height))
      }
    }
  }

  if (bestSegPoint && bestSeg && bestSegScore >= minStrengthThreshold * 0.85) {
    return {
      point: refineSubPixelPeak(bestSegPoint, edgeMap),
      snapped: true,
      snappedSegment: bestSeg,
      snapKind: 'segment'
    }
  }

  // STAGE 3: Local NMS / Sobel Gradient Ridge Search with Orientation Bonus
  const cx = relPoint.x * width
  const cy = relPoint.y * height
  const xMin = Math.max(2, Math.floor(cx - searchRadiusPx))
  const xMax = Math.min(width - 3, Math.ceil(cx + searchRadiusPx))
  const yMin = Math.max(2, Math.floor(cy - searchRadiusPx))
  const yMax = Math.min(height - 3, Math.ceil(cy + searchRadiusPx))

  let bestScore = 0
  let bestX = Math.round(cx)
  let bestY = Math.round(cy)
  let bestMag = 0

  const sigmaSq = searchRadiusPx * searchRadiusPx * 0.42

  for (let y = yMin; y <= yMax; y++) {
    for (let x = xMin; x <= xMax; x++) {
      const dx = x - cx
      const dy = y - cy
      const distSq = dx * dx + dy * dy
      if (distSq > searchRadiusPx * searchRadiusPx) continue

      const idx = y * width + x
      const m = Math.max(nms[idx], mag[idx] * 0.82)
      if (m < minStrengthThreshold) continue

      let dirBonus = 1.0
      if (hasLineDir) {
        // Edge tangent is (-ny, nx)
        const tx = -ny[idx]
        const ty = nx[idx]
        const align = Math.abs(tx * lineDirX + ty * lineDirY)
        dirBonus = 0.75 + 0.85 * align
      }

      const spatialWeight = Math.exp(-distSq / (2 * sigmaSq))
      const score = m * spatialWeight * dirBonus
      if (score > bestScore) {
        bestScore = score
        bestX = x
        bestY = y
        bestMag = mag[idx]
      }
    }
  }

  if (bestMag < minStrengthThreshold) {
    return { point: relPoint, snapped: false }
  }

  const refined = refineSubPixelPeak(
    { x: bestX / width, y: bestY / height },
    edgeMap
  )

  return {
    point: refined,
    snapped: true,
    snapKind: 'ridge'
  }
}

/**
 * Intersects two segments in relative [0..1] space.
 */
function intersectSegmentsRel(
  a: DetectedEdgeSegment,
  b: DetectedEdgeSegment
): Point2D | null {
  const x1 = a.p1.x
  const y1 = a.p1.y
  const x2 = a.p2.x
  const y2 = a.p2.y
  const x3 = b.p1.x
  const y3 = b.p1.y
  const x4 = b.p2.x
  const y4 = b.p2.y

  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
  if (Math.abs(denom) < 1e-7) return null

  const px =
    ((x1 * y2 - y1 * x2) * (x3 - x4) - (x1 - x2) * (x3 * y4 - y3 * x4)) /
    denom
  const py =
    ((x1 * y2 - y1 * x2) * (y3 - y4) - (y1 - y2) * (x3 * y4 - y3 * x4)) /
    denom

  if (!Number.isFinite(px) || !Number.isFinite(py)) return null
  return { x: px, y: py }
}

/**
 * Finds the dominant vanishing point cluster among a pool of candidate segments using RANSAC.
 */
function findDominantVanishingPointCluster(
  pool: DetectedEdgeSegment[],
  angleToleranceDeg = 2.6
): { vp: Point2D; inliers: DetectedEdgeSegment[] } | null {
  if (pool.length < 2) return null

  const tolRad = (angleToleranceDeg * Math.PI) / 180
  let bestVP: Point2D | null = null
  let bestScore = -1
  let bestInliers: DetectedEdgeSegment[] = []

  const topCount = Math.min(pool.length, 32)
  for (let i = 0; i < topCount; i++) {
    for (let j = i + 1; j < topCount; j++) {
      const vp = intersectSegmentsRel(pool[i], pool[j])
      if (!vp) continue
      // Reject degenerately far intersections (> 50x image width)
      if (Math.hypot(vp.x - 0.5, vp.y - 0.5) > 50) continue

      let score = 0
      const inliers: DetectedEdgeSegment[] = []

      for (let k = 0; k < pool.length; k++) {
        const seg = pool[k]
        const midX = 0.5 * (seg.p1.x + seg.p2.x)
        const midY = 0.5 * (seg.p1.y + seg.p2.y)
        const toVpX = vp.x - midX
        const toVpY = vp.y - midY
        const toVpLen = Math.hypot(toVpX, toVpY)
        if (toVpLen < 1e-5) continue

        // Ensure the vanishing point doesn't lie strictly inside the segment itself
        const segDx = seg.p2.x - seg.p1.x
        const segDy = seg.p2.y - seg.p1.y
        const segLen = Math.hypot(segDx, segDy)
        if (segLen < 1e-5) continue

        const cosErr = Math.min(
          1,
          Math.abs((segDx * toVpX + segDy * toVpY) / (segLen * toVpLen))
        )
        const angErr = Math.acos(cosErr)
        if (angErr <= tolRad) {
          const weight =
            seg.lengthRel * seg.strength * (1 - 0.5 * (angErr / tolRad))
          score += weight
          inliers.push(seg)
        }
      }

      if (inliers.length >= 2 && score > bestScore) {
        bestScore = score
        bestVP = vp
        bestInliers = inliers
      }
    }
  }

  if (!bestVP || bestInliers.length < 2) return null
  return { vp: bestVP, inliers: bestInliers }
}

/**
 * Selects `count` well-separated segments from an inlier cluster so the VP lines aren't stacked on top of each other.
 */
function pickSpatiallySeparatedSegments(
  inliers: DetectedEdgeSegment[],
  count: number
): ControlPointPairState[] {
  const sorted = [...inliers].sort(
    (a, b) => b.lengthRel * b.strength - a.lengthRel * a.strength
  )
  const chosen: DetectedEdgeSegment[] = []

  for (const cand of sorted) {
    if (chosen.length >= count) break
    const cMidX = 0.5 * (cand.p1.x + cand.p2.x)
    const cMidY = 0.5 * (cand.p1.y + cand.p2.y)
    const tooClose = chosen.some((existing) => {
      const eMidX = 0.5 * (existing.p1.x + existing.p2.x)
      const eMidY = 0.5 * (existing.p1.y + existing.p2.y)
      return Math.hypot(cMidX - eMidX, cMidY - eMidY) < 0.07
    })
    if (!tooClose) {
      chosen.push(cand)
    }
  }

  // Fill any remaining slots if needed
  for (const cand of sorted) {
    if (chosen.length >= count) break
    if (!chosen.includes(cand)) {
      chosen.push(cand)
    }
  }

  return chosen.map((s) => [
    { x: s.p1.x, y: s.p1.y },
    { x: s.p2.x, y: s.p2.y }
  ])
}

/**
 * Automatically groups detected straight segments into 2 dominant vanishing-point clusters
 * using Sequential RANSAC Vanishing Point Clustering (works on 1-point hallways, 2-point rooms, and exteriors).
 */
export function autoSuggestVanishingPointLines(
  edgeMap: EdgeGradientMap,
  countPerVP = 2
): {
  vp1Segments: ControlPointPairState[]
  vp2Segments: ControlPointPairState[]
} | null {
  if (edgeMap.segments.length < 4) return null

  // Separate nearly-vertical segments (within 22 deg of vertical) vs perspective/horizontal segments
  const nonVerticalPool: DetectedEdgeSegment[] = []
  const verticalPool: DetectedEdgeSegment[] = []

  for (const seg of edgeMap.segments) {
    const absDeg = Math.abs((seg.angleRad * 180) / Math.PI)
    const distFromVert = Math.abs(absDeg - 90)
    if (distFromVert <= 20) {
      verticalPool.push(seg)
    } else {
      nonVerticalPool.push(seg)
    }
  }

  // Cluster 1: Find primary perspective vanishing point from non-vertical architectural edges
  const primaryPool =
    nonVerticalPool.length >= 2 ? nonVerticalPool : edgeMap.segments
  const cluster1 = findDominantVanishingPointCluster(primaryPool, 2.8)
  if (!cluster1) return null

  const vp1Segments = pickSpatiallySeparatedSegments(
    cluster1.inliers,
    countPerVP
  )

  // Remove cluster1 inliers and try to find a distinct second vanishing point cluster
  const remainingNonVert = nonVerticalPool.filter(
    (s) => !cluster1.inliers.includes(s)
  )
  const cluster2Persp = findDominantVanishingPointCluster(remainingNonVert, 3.0)

  let vp2Segments: ControlPointPairState[] = []

  // Check if cluster2Persp is genuinely distinct from cluster1.vp
  const vpDist = cluster2Persp
    ? Math.hypot(
        cluster2Persp.vp.x - cluster1.vp.x,
        cluster2Persp.vp.y - cluster1.vp.y
      )
    : 0

  if (
    cluster2Persp &&
    vpDist > 0.22 &&
    cluster2Persp.inliers.length >= 2 &&
    (!verticalPool.length ||
      cluster2Persp.inliers.length >= verticalPool.length * 0.7)
  ) {
    vp2Segments = pickSpatiallySeparatedSegments(
      cluster2Persp.inliers,
      countPerVP
    )
  } else if (verticalPool.length >= 2) {
    const clusterVert = findDominantVanishingPointCluster(verticalPool, 3.2)
    vp2Segments = pickSpatiallySeparatedSegments(
      clusterVert ? clusterVert.inliers : verticalPool,
      countPerVP
    )
  } else if (cluster2Persp && cluster2Persp.inliers.length >= 2) {
    vp2Segments = pickSpatiallySeparatedSegments(
      cluster2Persp.inliers,
      countPerVP
    )
  }

  if (vp1Segments.length < 2 || vp2Segments.length < 2) {
    return null
  }

  return {
    vp1Segments,
    vp2Segments
  }
}
