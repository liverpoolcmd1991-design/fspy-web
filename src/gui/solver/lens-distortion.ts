/**
 * fSpy Studio — Radial Lens Distortion (Brown-Conrady k1, k2) Undistortion & Estimation
 * Strictly opt-in utility for correcting barrel / pincushion lens distortion on wide-angle photos.
 */

import Point2D from './point-2d'
import MathUtil from './math-util'
import { VanishingPointControlState } from '../types/control-points-state'
import CoordinatesUtil, { ImageCoordinateFrame } from './coordinates-util'
import { CameraParameters } from './solver-result'
import Vector3D from './vector-3d'

/**
 * Undistorts a single relative image point [0, 1] using Brown-Conrady radial distortion (k1, k2)
 * around the image center (0.5, 0.5) normalized by aspect ratio.
 */
export function undistortRelativePoint(
  relPoint: Point2D,
  k1: number,
  k2: number,
  aspect = 1.5
): Point2D {
  if (Math.abs(k1) < 1e-6 && Math.abs(k2) < 1e-6) {
    return relPoint
  }
  const xn = (relPoint.x - 0.5) * 2
  const yn = ((relPoint.y - 0.5) * 2) / aspect
  const r2 = xn * xn + yn * yn
  const r4 = r2 * r2
  const factor = 1 + k1 * r2 + k2 * r4
  if (Math.abs(factor) < 1e-4) return relPoint
  const xu = xn / factor
  const yu = yn / factor
  return {
    x: 0.5 + xu * 0.5,
    y: 0.5 + yu * aspect * 0.5
  }
}

/**
 * Estimates the optimal radial distortion k1 in [-0.35, +0.35] that minimizes
 * the least-squares angular residual error across all active vanishing point line segments.
 */
export function autoEstimateK1FromVanishingLines(
  vpStates: VanishingPointControlState[],
  aspect = 1.5
): number {
  const validStates = vpStates.filter((vp) => vp.lineSegments.length >= 2)
  if (validStates.length === 0) return 0

  const evaluateCost = (k1: number): number => {
    let totalCost = 0
    for (const vpState of validStates) {
      const undistortedSegments: [Point2D, Point2D][] = vpState.lineSegments.map(
        (seg) => [
          undistortRelativePoint(seg[0], k1, 0, aspect),
          undistortRelativePoint(seg[1], k1, 0, aspect)
        ]
      )
      const vp = MathUtil.leastSquaresLineIntersection(undistortedSegments)
      if (!vp) {
        totalCost += 50
        continue
      }
      for (const seg of undistortedSegments) {
        const errDeg = MathUtil.lineSegmentAngleErrorDegrees(seg, vp)
        totalCost += errDeg * errDeg
      }
    }
    // Slight regularization toward 0 when only 2 segments per VP exist
    return totalCost + 0.02 * k1 * k1
  }

  let bestK1 = 0
  let bestCost = evaluateCost(0)

  // Coarse sweep [-0.30, 0.30]
  for (let k = -0.3; k <= 0.3001; k += 0.015) {
    const c = evaluateCost(k)
    if (c < bestCost) {
      bestCost = c
      bestK1 = k
    }
  }

  // Fine sweep around bestK1
  const fineStart = Math.max(-0.35, bestK1 - 0.02)
  const fineEnd = Math.min(0.35, bestK1 + 0.02)
  for (let k = fineStart; k <= fineEnd; k += 0.002) {
    const c = evaluateCost(k)
    if (c < bestCost) {
      bestCost = c
      bestK1 = k
    }
  }

  return Number(bestK1.toFixed(3))
}

/**
 * Renders an undistorted version of the source image URL using bilinear sampling
 * according to the Brown-Conrady radial distortion model (k1, k2).
 */
export async function renderUndistortedImage(
  sourceUrl: string,
  k1: number,
  k2: number,
  maxDimension = 1600
): Promise<{ url: string; blob: Blob } | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const srcW = img.naturalWidth || img.width
        const srcH = img.naturalHeight || img.height
        if (srcW < 8 || srcH < 8) {
          resolve(null)
          return
        }

        const scale = Math.min(1, maxDimension / Math.max(srcW, srcH))
        const w = Math.max(8, Math.round(srcW * scale))
        const h = Math.max(8, Math.round(srcH * scale))

        const srcCanvas = document.createElement('canvas')
        srcCanvas.width = w
        srcCanvas.height = h
        const srcCtx = srcCanvas.getContext('2d')
        if (!srcCtx) {
          resolve(null)
          return
        }
        srcCtx.drawImage(img, 0, 0, w, h)
        const srcData = srcCtx.getImageData(0, 0, w, h).data

        const dstCanvas = document.createElement('canvas')
        dstCanvas.width = w
        dstCanvas.height = h
        const dstCtx = dstCanvas.getContext('2d')
        if (!dstCtx) {
          resolve(null)
          return
        }
        const dstImgData = dstCtx.createImageData(w, h)
        const dstData = dstImgData.data

        const cx = 0.5 * w
        const cy = 0.5 * h
        const normScale = 1 / Math.max(cx, cy)

        for (let y = 0; y < h; y++) {
          const dy = (y - cy) * normScale
          const dy2 = dy * dy
          const rowOffset = y * w * 4

          for (let x = 0; x < w; x++) {
            const dx = (x - cx) * normScale
            const r2 = dx * dx + dy2
            const r4 = r2 * r2
            const factor = 1 + k1 * r2 + k2 * r4

            const sx = cx + dx * factor * Math.max(cx, cy)
            const sy = cy + dy * factor * Math.max(cx, cy)
            const dstIdx = rowOffset + x * 4

            if (sx >= 0 && sx < w - 1 && sy >= 0 && sy < h - 1) {
              const x0 = Math.floor(sx)
              const y0 = Math.floor(sy)
              const fx = sx - x0
              const fy = sy - y0
              const w00 = (1 - fx) * (1 - fy)
              const w10 = fx * (1 - fy)
              const w01 = (1 - fx) * fy
              const w11 = fx * fy

              const idx00 = (y0 * w + x0) * 4
              const idx10 = idx00 + 4
              const idx01 = idx00 + w * 4
              const idx11 = idx01 + 4

              dstData[dstIdx] =
                srcData[idx00] * w00 +
                srcData[idx10] * w10 +
                srcData[idx01] * w01 +
                srcData[idx11] * w11
              dstData[dstIdx + 1] =
                srcData[idx00 + 1] * w00 +
                srcData[idx10 + 1] * w10 +
                srcData[idx01 + 1] * w01 +
                srcData[idx11 + 1] * w11
              dstData[dstIdx + 2] =
                srcData[idx00 + 2] * w00 +
                srcData[idx10 + 2] * w10 +
                srcData[idx01 + 2] * w01 +
                srcData[idx11 + 2] * w11
              dstData[dstIdx + 3] = 255
            } else {
              dstData[dstIdx] = 11
              dstData[dstIdx + 1] = 11
              dstData[dstIdx + 2] = 14
              dstData[dstIdx + 3] = 255
            }
          }
        }

        dstCtx.putImageData(dstImgData, 0, 0)
        dstCanvas.toBlob((blob) => {
          if (!blob) {
            resolve(null)
            return
          }
          const url = URL.createObjectURL(blob)
          resolve({ url, blob })
        }, 'image/png')
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = sourceUrl
  })
}

/**
 * Computes the 3D world distance between two relative image points [p1, p2]
 * projected onto a chosen world plane using the solved camera parameters.
 */
export type WorldRulerPlane = 'ground-xy' | 'vertical-z' | 'wall-xz' | 'wall-yz'

export function computeWorldRulerDistance(
  p1Rel: Point2D,
  p2Rel: Point2D,
  plane: WorldRulerPlane,
  cameraParameters: CameraParameters
): number | null {
  const { imageWidth, imageHeight, viewTransform, principalPoint, horizontalFieldOfView } =
    cameraParameters
  if (imageWidth <= 0 || imageHeight <= 0) return null

  const p1Plane = CoordinatesUtil.convert(
    p1Rel,
    ImageCoordinateFrame.Relative,
    ImageCoordinateFrame.ImagePlane,
    imageWidth,
    imageHeight
  )
  const p2Plane = CoordinatesUtil.convert(
    p2Rel,
    ImageCoordinateFrame.Relative,
    ImageCoordinateFrame.ImagePlane,
    imageWidth,
    imageHeight
  )

  const unprojectRay = (pt: Point2D): [Vector3D, Vector3D] => [
    MathUtil.perspectiveUnproject(
      new Vector3D(pt.x, pt.y, 1),
      viewTransform,
      principalPoint,
      horizontalFieldOfView
    ),
    MathUtil.perspectiveUnproject(
      new Vector3D(pt.x, pt.y, 2),
      viewTransform,
      principalPoint,
      horizontalFieldOfView
    )
  ]

  const [r1Start, r1End] = unprojectRay(p1Plane)
  const [r2Start, r2End] = unprojectRay(p2Plane)

  const origin = new Vector3D(0, 0, 0)

  if (plane === 'ground-xy') {
    const u = new Vector3D(1, 0, 0)
    const v = new Vector3D(0, 1, 0)
    const hit1 = MathUtil.linePlaneIntersection(origin, u, v, r1Start, r1End)
    const hit2 = MathUtil.linePlaneIntersection(origin, u, v, r2Start, r2End)
    const dist = hit1.subtracted(hit2).length
    return Number.isFinite(dist) ? dist : null
  } else if (plane === 'wall-xz') {
    const u = new Vector3D(1, 0, 0)
    const v = new Vector3D(0, 0, 1)
    const hit1 = MathUtil.linePlaneIntersection(origin, u, v, r1Start, r1End)
    const hit2 = MathUtil.linePlaneIntersection(origin, u, v, r2Start, r2End)
    const dist = hit1.subtracted(hit2).length
    return Number.isFinite(dist) ? dist : null
  } else if (plane === 'wall-yz') {
    const u = new Vector3D(0, 1, 0)
    const v = new Vector3D(0, 0, 1)
    const hit1 = MathUtil.linePlaneIntersection(origin, u, v, r1Start, r1End)
    const hit2 = MathUtil.linePlaneIntersection(origin, u, v, r2Start, r2End)
    const dist = hit1.subtracted(hit2).length
    return Number.isFinite(dist) ? dist : null
  } else {
    // 'vertical-z': P1 lies on ground plane Z=0, P2 is measured along the vertical Z line passing through P1
    const u = new Vector3D(1, 0, 0)
    const v = new Vector3D(0, 1, 0)
    const baseHit = MathUtil.linePlaneIntersection(origin, u, v, r1Start, r1End)
    const zAxis = new Vector3D(0, 0, 1)
    const topHit = MathUtil.shortestLineSegmentBetweenLines(
      r2Start,
      r2End,
      baseHit,
      baseHit.added(zAxis)
    )[1]
    const dist = topHit.subtracted(baseHit).length
    return Number.isFinite(dist) ? dist : null
  }
}

