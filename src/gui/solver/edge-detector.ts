/**
 * fSpy Studio — Sub-Pixel Sobel Edge Snapper & Straight Line Segment Detector
 * Strictly opt-in utility for magnetic control-point snapping and auto-VP line suggestion.
 */

import Point2D from './point-2d'
import MathUtil from './math-util'
import { ControlPointPairState } from '../types/control-points-state'

export interface DetectedEdgeSegment {
  /** Start point in relative [0, 1] image coordinates */
  p1: Point2D
  /** End point in relative [0, 1] image coordinates */
  p2: Point2D
  /** Orientation angle in radians [-PI/2, PI/2) */
  angle: number
  /** Length in normalized relative coordinates */
  length: number
  /** Mean gradient strength */
  strength: number
}

export interface EdgeGradientMap {
  width: number
  height: number
  /** Normalized Sobel gradient magnitude [0, 1] */
  mag: Float32Array
  /** Sobel X derivative */
  gx: Float32Array
  /** Sobel Y derivative */
  gy: Float32Array
  /** Extracted straight architectural line segments */
  segments: DetectedEdgeSegment[]
}

/**
 * Builds a Sobel gradient map and extracts straight architectural line segments
 * from an image URL using an offscreen canvas.
 */
export async function buildEdgeGradientMap(
  imageUrl: string,
  maxDimension = 768
): Promise<EdgeGradientMap | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const srcW = img.naturalWidth || img.width
        const srcH = img.naturalHeight || img.height
        if (srcW < 16 || srcH < 16) {
          resolve(null)
          return
        }

        const scale = Math.min(1, maxDimension / Math.max(srcW, srcH))
        const w = Math.max(16, Math.round(srcW * scale))
        const h = Math.max(16, Math.round(srcH * scale))

        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(null)
          return
        }

        ctx.drawImage(img, 0, 0, w, h)
        const rgba = ctx.getImageData(0, 0, w, h).data

        // Convert to grayscale luminance [0..255]
        const lum = new Float32Array(w * h)
        for (let i = 0, p = 0; i < lum.length; i++, p += 4) {
          lum[i] = 0.299 * rgba[p] + 0.587 * rgba[p + 1] + 0.114 * rgba[p + 2]
        }

        // Light 3x3 Gaussian smoothing to suppress sensor noise
        const smooth = new Float32Array(w * h)
        for (let y = 1; y < h - 1; y++) {
          const row = y * w
          for (let x = 1; x < w - 1; x++) {
            const idx = row + x
            smooth[idx] =
              (4 * lum[idx] +
                2 * (lum[idx - 1] + lum[idx + 1] + lum[idx - w] + lum[idx + w]) +
                (lum[idx - w - 1] + lum[idx - w + 1] + lum[idx + w - 1] + lum[idx + w + 1])) /
              16
          }
        }

        const gx = new Float32Array(w * h)
        const gy = new Float32Array(w * h)
        const mag = new Float32Array(w * h)
        let maxMag = 1e-5

        for (let y = 1; y < h - 1; y++) {
          const row = y * w
          for (let x = 1; x < w - 1; x++) {
            const idx = row + x
            const sx =
              -smooth[idx - w - 1] +
              smooth[idx - w + 1] -
              2 * smooth[idx - 1] +
              2 * smooth[idx + 1] -
              smooth[idx + w - 1] +
              smooth[idx + w + 1]
            const sy =
              -smooth[idx - w - 1] -
              2 * smooth[idx - w] -
              smooth[idx - w + 1] +
              smooth[idx + w - 1] +
              2 * smooth[idx + w] +
              smooth[idx + w + 1]

            gx[idx] = sx
            gy[idx] = sy
            const m = Math.hypot(sx, sy)
            mag[idx] = m
            if (m > maxMag) maxMag = m
          }
        }

        for (let i = 0; i < mag.length; i++) {
          mag[i] /= maxMag
        }

        const segments = extractStraightSegments(w, h, mag, gx, gy)
        resolve({ width: w, height: h, mag, gx, gy, segments })
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = imageUrl
  })
}

/**
 * Sub-pixel magnetic edge snapping.
 * Searches a local radius around `relPoint` in `edgeMap`, locates the strongest
 * non-maximum-suppressed gradient ridge, and interpolates to sub-pixel accuracy.
 */
export function snapRelativePointToEdge(
  relPoint: Point2D,
  edgeMap: EdgeGradientMap,
  searchRadiusPx = 11,
  minStrengthThreshold = 0.16
): { point: Point2D; snapped: boolean } {
  const { width, height, mag, gx, gy } = edgeMap
  const cx = relPoint.x * width
  const cy = relPoint.y * height

  const x0 = Math.max(2, Math.floor(cx - searchRadiusPx))
  const x1 = Math.min(width - 3, Math.ceil(cx + searchRadiusPx))
  const y0 = Math.max(2, Math.floor(cy - searchRadiusPx))
  const y1 = Math.min(height - 3, Math.ceil(cy + searchRadiusPx))

  let bestScore = 0
  let bestX = -1
  let bestY = -1

  for (let y = y0; y <= y1; y++) {
    const dy = y - cy
    const row = y * width
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx
      const distSq = dx * dx + dy * dy
      if (distSq > searchRadiusPx * searchRadiusPx) continue

      const m = mag[row + x]
      if (m < minStrengthThreshold) continue

      // Distance falloff so closer strong edges win over distant edges
      const weight = 1 - Math.sqrt(distSq) / (searchRadiusPx + 2)
      const score = m * (0.65 + 0.35 * weight)
      if (score > bestScore) {
        bestScore = score
        bestX = x
        bestY = y
      }
    }
  }

  if (bestX < 0 || bestY < 0) {
    return { point: relPoint, snapped: false }
  }

  // Sub-pixel parabolic refinement along the gradient normal direction
  const idx = bestY * width + bestX
  const gradX = gx[idx]
  const gradY = gy[idx]
  const gradLen = Math.hypot(gradX, gradY)

  let subX = bestX
  let subY = bestY

  if (gradLen > 1e-5) {
    const nx = gradX / gradLen
    const ny = gradY / gradLen
    const prevX = Math.round(bestX - nx)
    const prevY = Math.round(bestY - ny)
    const nextX = Math.round(bestX + nx)
    const nextY = Math.round(bestY + ny)

    const m0 = mag[idx]
    const mPrev = mag[prevY * width + prevX]
    const mNext = mag[nextY * width + nextX]
    const denom = 2 * (mPrev - 2 * m0 + mNext)
    if (Math.abs(denom) > 1e-5) {
      const offset = Math.max(-0.5, Math.min(0.5, (mPrev - mNext) / denom))
      subX += offset * nx
      subY += offset * ny
    }
  }

  return {
    point: {
      x: Math.max(0, Math.min(1, subX / width)),
      y: Math.max(0, Math.min(1, subY / height))
    },
    snapped: true
  }
}

/**
 * Extracts straight line segments by grouping connected pixels with coherent tangent angles.
 */
function extractStraightSegments(
  w: number,
  h: number,
  mag: Float32Array,
  gx: Float32Array,
  gy: Float32Array
): DetectedEdgeSegment[] {
  const visited = new Uint8Array(w * h)
  const threshold = 0.22
  const angleTolerance = (12 * Math.PI) / 180
  const minPixels = Math.max(22, Math.round(Math.hypot(w, h) * 0.032))
  const segments: DetectedEdgeSegment[] = []

  // Collect strong seed pixels sorted by magnitude descending
  const seeds: number[] = []
  for (let y = 2; y < h - 2; y += 2) {
    const row = y * w
    for (let x = 2; x < w - 2; x += 2) {
      const idx = row + x
      if (mag[idx] >= threshold) {
        seeds.push(idx)
      }
    }
  }
  seeds.sort((a, b) => mag[b] - mag[a])

  const maxSeeds = Math.min(seeds.length, 2500)
  for (let s = 0; s < maxSeeds; s++) {
    const seedIdx = seeds[s]
    if (visited[seedIdx]) continue

    // Tangent direction is perpendicular to gradient (-gy, gx)
    const seedAngle = normalizeLineAngle(Math.atan2(gx[seedIdx], -gy[seedIdx]))
    const regionX: number[] = []
    const regionY: number[] = []
    const queue: number[] = [seedIdx]
    visited[seedIdx] = 1
    let sumStrength = 0

    while (queue.length > 0 && regionX.length < 600) {
      const curr = queue.pop()!
      const cy = Math.floor(curr / w)
      const cx = curr - cy * w
      regionX.push(cx)
      regionY.push(cy)
      sumStrength += mag[curr]

      for (let dy = -1; dy <= 1; dy++) {
        const ny = cy + dy
        if (ny < 2 || ny >= h - 2) continue
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue
          const nx = cx + dx
          if (nx < 2 || nx >= w - 2) continue
          const nIdx = ny * w + nx
          if (visited[nIdx] || mag[nIdx] < threshold * 0.8) continue

          const nAngle = normalizeLineAngle(Math.atan2(gx[nIdx], -gy[nIdx]))
          if (angleDiff(seedAngle, nAngle) <= angleTolerance) {
            visited[nIdx] = 1
            queue.push(nIdx)
          }
        }
      }
    }

    if (regionX.length < minPixels) continue

    // Fit principal axis line segment to region points
    let meanX = 0
    let meanY = 0
    const n = regionX.length
    for (let i = 0; i < n; i++) {
      meanX += regionX[i]
      meanY += regionY[i]
    }
    meanX /= n
    meanY /= n

    let covXX = 0
    let covXY = 0
    let covYY = 0
    for (let i = 0; i < n; i++) {
      const dx = regionX[i] - meanX
      const dy = regionY[i] - meanY
      covXX += dx * dx
      covXY += dx * dy
      covYY += dy * dy
    }

    const theta = 0.5 * Math.atan2(2 * covXY, covXX - covYY)
    const dirX = Math.cos(theta)
    const dirY = Math.sin(theta)

    // Check straightness via minor eigenvalue ratio
    let minT = Infinity
    let maxT = -Infinity
    let maxOrtho = 0
    for (let i = 0; i < n; i++) {
      const dx = regionX[i] - meanX
      const dy = regionY[i] - meanY
      const t = dx * dirX + dy * dirY
      const ortho = Math.abs(-dx * dirY + dy * dirX)
      if (t < minT) minT = t
      if (t > maxT) maxT = t
      if (ortho > maxOrtho) maxOrtho = ortho
    }

    const segLenPx = maxT - minT
    if (segLenPx < minPixels || maxOrtho > Math.max(3.5, segLenPx * 0.06)) {
      continue
    }

    const p1: Point2D = {
      x: Math.max(0.02, Math.min(0.98, (meanX + minT * dirX) / w)),
      y: Math.max(0.02, Math.min(0.98, (meanY + minT * dirY) / h))
    }
    const p2: Point2D = {
      x: Math.max(0.02, Math.min(0.98, (meanX + maxT * dirX) / w)),
      y: Math.max(0.02, Math.min(0.98, (meanY + maxT * dirY) / h))
    }
    const relLen = MathUtil.distance(p1, p2)
    if (relLen < 0.08) continue

    segments.push({
      p1,
      p2,
      angle: normalizeLineAngle(theta),
      length: relLen,
      strength: sumStrength / n
    })
  }

  segments.sort((a, b) => b.length * b.strength - a.length * a.strength)
  return segments.slice(0, 64)
}

function normalizeLineAngle(rad: number): number {
  let a = rad % Math.PI
  if (a >= Math.PI / 2) a -= Math.PI
  if (a < -Math.PI / 2) a += Math.PI
  return a
}

function angleDiff(a: number, b: number): number {
  let d = Math.abs(a - b)
  if (d > Math.PI / 2) d = Math.PI - d
  return d
}

/**
 * Clusters detected straight segments into 2 dominant vanishing point groups
 * (e.g. horizontal architectural lines and vertical/orthogonal perspective lines)
 * and returns top well-separated segment pairs for VP1 and VP2.
 */
export function autoSuggestVanishingPointLines(
  edgeMap: EdgeGradientMap,
  linesPerVP = 2
): {
  vp1Segments: ControlPointPairState[]
  vp2Segments: ControlPointPairState[]
} | null {
  const segs = edgeMap.segments
  if (segs.length < 4) return null

  // Partition segments into non-vertical (|angle| < 62 deg) and near-vertical / secondary group
  const horizontalLike = segs.filter((s) => Math.abs(s.angle) < (62 * Math.PI) / 180)
  const verticalLike = segs.filter((s) => Math.abs(s.angle) >= (62 * Math.PI) / 180)

  const pickBestConsensusGroup = (pool: DetectedEdgeSegment[], count: number): DetectedEdgeSegment[] => {
    if (pool.length <= count) return pool
    let bestInliers: DetectedEdgeSegment[] = []
    let bestScore = -1

    const limit = Math.min(pool.length, 24)
    for (let i = 0; i < limit; i++) {
      for (let j = i + 1; j < limit; j++) {
        const s1 = pool[i]
        const s2 = pool[j]
        // Avoid segments that are spatially overlapping
        const mid1 = MathUtil.lineSegmentMidpoint([s1.p1, s1.p2])
        const mid2 = MathUtil.lineSegmentMidpoint([s2.p1, s2.p2])
        if (MathUtil.distance(mid1, mid2) < 0.08) continue

        const vp = MathUtil.lineIntersection([s1.p1, s1.p2], [s2.p1, s2.p2])
        if (!vp) continue

        const inliers: DetectedEdgeSegment[] = []
        let score = 0
        for (let k = 0; k < pool.length; k++) {
          const candidate = pool[k]
          const errDeg = MathUtil.lineSegmentAngleErrorDegrees([candidate.p1, candidate.p2], vp)
          if (errDeg < 2.2) {
            inliers.push(candidate)
            score += candidate.length * candidate.strength * (2.5 - errDeg)
          }
        }

        if (score > bestScore && inliers.length >= 2) {
          bestScore = score
          bestInliers = inliers
        }
      }
    }

    if (bestInliers.length < 2) {
      return pool.slice(0, count)
    }

    // Pick well-spaced segments from the winning consensus cluster
    const chosen: DetectedEdgeSegment[] = [bestInliers[0]]
    for (const cand of bestInliers) {
      if (chosen.length >= count) break
      const midCand = MathUtil.lineSegmentMidpoint([cand.p1, cand.p2])
      const farEnough = chosen.every(
        (c) => MathUtil.distance(MathUtil.lineSegmentMidpoint([c.p1, c.p2]), midCand) > 0.07
      )
      if (farEnough) {
        chosen.push(cand)
      }
    }
    while (chosen.length < count && chosen.length < bestInliers.length) {
      const next = bestInliers.find((b) => !chosen.includes(b))
      if (!next) break
      chosen.push(next)
    }
    return chosen
  }

  let vp1Pool = horizontalLike
  let vp2Pool = verticalLike

  // If image has 2 horizontal vanishing points, split horizontalLike by sign of angle or leftover from VP1
  const vp1Chosen = pickBestConsensusGroup(vp1Pool.length >= 2 ? vp1Pool : segs, linesPerVP)
  if (vp2Pool.length < 2) {
    vp2Pool = segs.filter((s) => !vp1Chosen.includes(s))
  }
  const vp2Chosen = pickBestConsensusGroup(vp2Pool, linesPerVP)

  if (vp1Chosen.length < 2 || vp2Chosen.length < 2) {
    return null
  }

  return {
    vp1Segments: vp1Chosen.map((s) => [{ ...s.p1 }, { ...s.p2 }]),
    vp2Segments: vp2Chosen.map((s) => [{ ...s.p1 }, { ...s.p2 }])
  }
}
