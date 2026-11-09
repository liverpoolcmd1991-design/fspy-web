/**
 * fSpy
 * Copyright (c) 2020 - Per Gantelius
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import Point2D from './point-2d'
import Vector3D from './vector-3d'
import Transform from './transform'

export default class MathUtil {

  static normalized(vector: Point2D): Point2D {
    let l = this.distance({ x: 0, y: 0 }, vector)
    if (l != 0) {
      return {
        x: vector.x / l,
        y: vector.y / l
      }
    }

    // zero length vector. really undefined, but return something anyway
    return {
      x: 0,
      y: 0
    }
  }

  static dot(a: Point2D, b: Point2D): number {
    return a.x * b.x + a.y * b.y
  }

  static difference(a: Point2D, b: Point2D): Point2D {
    return {
      x: a.x - b.x,
      y: a.y - b.y
    }
  }

  static distance(a: Point2D, b: Point2D): number {
    let dx = a.x - b.x
    let dy = a.y - b.y
    return Math.sqrt(dx * dx + dy * dy)
  }

  static lineSegmentMidpoint(segment: [Point2D, Point2D]): Point2D {
    return {
      x: 0.5 * (segment[0].x + segment[1].x),
      y: 0.5 * (segment[0].y + segment[1].y)
    }
  }

  static lineIntersection(line1: [Point2D, Point2D], line2: [Point2D, Point2D]): Point2D | null {
    let d1 = this.distance(line1[0], line1[1])
    let d2 = this.distance(line2[0], line2[1])

    let epsilon = 1e-8
    if (Math.abs(d1) < epsilon || Math.abs(d2) < epsilon) {
      return null
    }

    // https://en.wikipedia.org/wiki/Line–line_intersection
    let x1 = line1[0].x
    let y1 = line1[0].y

    let x2 = line1[1].x
    let y2 = line1[1].y

    let x3 = line2[0].x
    let y3 = line2[0].y

    let x4 = line2[1].x
    let y4 = line2[1].y

    let denominator = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
    if (Math.abs(denominator) < epsilon) {
      return null
    }

    return {
      x: ((x1 * y2 - y1 * x2) * (x3 - x4) - (x1 - x2) * (x3 * y4 - y3 * x4)) / denominator,
      y: ((x1 * y2 - y1 * x2) * (y3 - y4) - (y1 - y2) * (x3 * y4 - y3 * x4)) / denominator
    }
  }

  /**
   * Computes the optimal vanishing point intersection of 2 or more line segments.
   * - For exactly 2 segments, uses exact closed-form lineIntersection.
   * - For 3+ segments, uses length-weighted least-squares normal equations
   *   minimizing perpendicular distance to all segments.
   */
  static leastSquaresLineIntersection(lines: [Point2D, Point2D][]): Point2D | null {
    if (lines.length < 2) {
      return null
    }
    if (lines.length === 2) {
      return this.lineIntersection(lines[0], lines[1])
    }

    const epsilon = 1e-10
    const solveWeighted = (irlsWeights?: number[]): Point2D | null => {
      let sAA = 0
      let sAB = 0
      let sBB = 0
      let sAC = 0
      let sBC = 0
      let validLines = 0

      for (let i = 0; i < lines.length; i++) {
        const p1 = lines[i][0]
        const p2 = lines[i][1]
        const dx = p2.x - p1.x
        const dy = p2.y - p1.y
        const len = Math.sqrt(dx * dx + dy * dy)
        if (len < 1e-7) {
          continue
        }
        // Unit normal to line: (a, b) = (-dy/len, dx/len), c = -(a*x1 + b*y1)
        const a = -dy / len
        const b = dx / len
        const c = -(a * p1.x + b * p1.y)
        // Weight by segment length and optional Huber IRLS robust weight
        const w = Math.max(0.05, len) * (irlsWeights ? irlsWeights[i] : 1)

        sAA += w * a * a
        sAB += w * a * b
        sBB += w * b * b
        sAC += w * a * c
        sBC += w * b * c
        validLines++
      }

      if (validLines < 2) {
        return null
      }

      const det = sAA * sBB - sAB * sAB
      if (Math.abs(det) < epsilon) {
        return null
      }

      return {
        x: (-sBB * sAC + sAB * sBC) / det,
        y: (sAB * sAC - sAA * sBC) / det
      }
    }

    const pass1 = solveWeighted()
    if (!pass1 || !Number.isFinite(pass1.x) || !Number.isFinite(pass1.y)) {
      return pass1
    }

    // 2nd Pass: Huber Iteratively Reweighted Least Squares (IRLS) to down-weight outlier lines when 3+ lines are used
    const residuals: number[] = []
    for (let i = 0; i < lines.length; i++) {
      const p1 = lines[i][0]
      const p2 = lines[i][1]
      const dx = p2.x - p1.x
      const dy = p2.y - p1.y
      const len = Math.hypot(dx, dy)
      if (len < 1e-7) {
        residuals.push(0)
        continue
      }
      const perpDist = Math.abs(-dy * (pass1.x - p1.x) + dx * (pass1.y - p1.y)) / len
      residuals.push(perpDist)
    }

    const sortedRes = [...residuals].sort((a, b) => a - b)
    const medianRes = sortedRes[Math.floor(sortedRes.length / 2)] || 1e-4
    const huberDelta = Math.max(1e-4, 1.4826 * medianRes * 1.5)
    const irlsWeights = residuals.map((r) =>
      r <= huberDelta ? 1 : Math.sqrt(huberDelta / r)
    )

    return solveWeighted(irlsWeights) ?? pass1
  }

  /**
   * Computes the angular residual error (in degrees) between a line segment [p1, p2]
   * and the ray connecting the segment's midpoint to the solved vanishing point.
   */
  static lineSegmentAngleErrorDegrees(segment: [Point2D, Point2D], vanishingPoint: Point2D): number {
    const len = this.distance(segment[0], segment[1])
    if (len < 1e-8) return 0
    const segDir = this.normalized(this.difference(segment[1], segment[0]))
    const mid = this.lineSegmentMidpoint(segment)
    const toVpLen = this.distance(mid, vanishingPoint)
    if (toVpLen < 1e-8) return 0
    const vpDir = this.normalized(this.difference(vanishingPoint, mid))
    const absDot = Math.min(1, Math.max(0, Math.abs(this.dot(segDir, vpDir))))
    return (Math.acos(absDot) * 180) / Math.PI
  }

  static triangleOrthoCenter(k: Point2D, l: Point2D, m: Point2D): Point2D {
    let a = k.x
    let b = k.y
    let c = l.x
    let d = l.y
    let e = m.x
    let f = m.y

    let N = b * c + d * e + f * a - c * f - b * e - a * d
    if (Math.abs(N) < 1e-9) {
      return {
        x: (a + c + e) / 3,
        y: (b + d + f) / 3
      }
    }
    let x = ((d - f) * b * b + (f - b) * d * d + (b - d) * f * f + a * b * (c - e) + c * d * (e - a) + e * f * (a - c)) / N
    let y = ((e - c) * a * a + (a - e) * c * c + (c - a) * e * e + a * b * (f - d) + c * d * (b - f) + e * f * (d - b)) / N

    return {
      x: x, y: y
    }
  }

  static thirdTriangleVertex(firstVertex: Point2D, secondVertex: Point2D, orthocenter: Point2D): Point2D {
    let a = firstVertex
    let b = secondVertex
    let o = orthocenter

    // compute p, the orthogonal projection of the orthocenter onto the line through a and b
    let aToB = this.normalized({ x: b.x - a.x, y: b.y - a.y })
    let proj = this.dot(aToB, this.difference(o, a))
    let p = {
      x: a.x + proj * aToB.x,
      y: a.y + proj * aToB.y
    }

    // the vertex c can be expressed as p + hn, where n is orthogonal to ab.
    let n = { x: aToB.y, y: -aToB.x }
    let denom = this.dot(n, this.difference(o, b))
    if (Math.abs(denom) < 1e-9) {
      return {
        x: p.x + n.x * 100,
        y: p.y + n.y * 100
      }
    }
    let h = this.dot(this.difference(a, p), this.difference(o, b)) / denom

    return {
      x: p.x + h * n.x,
      y: p.y + h * n.y
    }
  }

  static linePlaneIntersection(
    p0: Vector3D, p1: Vector3D, p2: Vector3D, la: Vector3D, lb: Vector3D
  ): Vector3D {
    // https://en.wikipedia.org/wiki/Line–plane_intersection
    let p01 = p1.subtracted(p0)
    let p02 = p2.subtracted(p0)
    let lab = lb.subtracted(la)
    let cross = p01.cross(p02)
    let numerator = cross.dot(la.subtracted(p0))
    let denominator = -(lab.dot(cross))
    if (Math.abs(denominator) < 1e-9) {
      return new Vector3D(NaN, NaN, NaN)
    }
    let t = numerator / denominator
    return new Vector3D(
      la.x + t * lab.x,
      la.y + t * lab.y,
      la.z + t * lab.z
    )
  }

  static shortestLineSegmentBetweenLines(p1: Vector3D, p2: Vector3D, p3: Vector3D, p4: Vector3D): [Vector3D, Vector3D] {
    // http://paulbourke.net/geometry/pointlineplane/

    function d(m: number, n: number, o: number, p: number): number {
      // dmnop = (xm - xn)(xo - xp) + (ym - yn)(yo - yp) + (zm - zn)(zo - zp)
      let allPoints = [p1, p2, p3, p4]
      let pm = allPoints[m - 1]
      let pn = allPoints[n - 1]
      let po = allPoints[o - 1]
      let pp = allPoints[p - 1]
      return (pm.x - pn.x) * (po.x - pp.x) + (pm.y - pn.y) * (po.y - pp.y) + (pm.z - pn.z) * (po.z - pp.z)
    }

    let d4343 = d(4, 3, 4, 3)
    let muaNumerator = d(1, 3, 4, 3) * d(4, 3, 2, 1) - d(1, 3, 2, 1) * d4343
    let muaDenominator = d(2, 1, 2, 1) * d4343 - d(4, 3, 2, 1) * d(4, 3, 2, 1)
    if (Math.abs(d4343) < 1e-9 || Math.abs(muaDenominator) < 1e-9) {
      return [p1.copy(), p3.copy()]
    }
    let mua = muaNumerator / muaDenominator
    let mub = (d(1, 3, 4, 3) + mua * d(4, 3, 2, 1)) / d4343

    return [
      new Vector3D(
        p1.x + mua * (p2.x - p1.x),
        p1.y + mua * (p2.y - p1.y),
        p1.z + mua * (p2.z - p1.z)
      ),
      new Vector3D(
        p3.x + mub * (p4.x - p3.x),
        p3.y + mub * (p4.y - p3.y),
        p3.z + mub * (p4.z - p3.z)
      )
    ]
  }

  static perspectiveUnproject(
    point: Vector3D,
    viewTransform: Transform,
    principalPoint: Point2D,
    horizontalFieldOfView: number
  ): Vector3D {
    let transform = this.modelViewProjection(
      viewTransform,
      principalPoint,
      horizontalFieldOfView
    ).inverted()
    return transform.transformedVector(point, true)
  }

  static perspectiveProject(
    point: Vector3D,
    viewTransform: Transform,
    principalPoint: Point2D,
    horizontalFieldOfView: number
  ): Point2D {
    let projected = this.modelViewProjection(
      viewTransform,
      principalPoint,
      horizontalFieldOfView
    ).transformedVector(
      point,
      true
    )
    return projected
  }

  static pointsAreOnTheSameSideOfLine(l1: Point2D, l2: Point2D, p1: Point2D, p2: Point2D): boolean {
    let lineDirection = {
      x: l2.x - l1.x,
      y: l2.y - l1.y
    }

    let lineNormal = {
      x: lineDirection.y,
      y: -lineDirection.x
    }

    let l1ToP1 = {
      x: p1.x - l1.x,
      y: p1.y - l1.y
    }

    let l1ToP2 = {
      x: p2.x - l1.x,
      y: p2.y - l1.y
    }

    let dot1 = l1ToP1.x * lineNormal.x + l1ToP1.y * lineNormal.y
    let dot2 = l1ToP2.x * lineNormal.x + l1ToP2.y * lineNormal.y

    return dot1 * dot2 > 0
  }

  static matrixToAxisAngle(transform: Transform): [number, number, number, number] {
    const [qx, qy, qz, qw] = this.matrixToQuaternion(transform)
    const clampedW = Math.max(-1, Math.min(1, qw))
    const angle = 2 * Math.acos(clampedW)
    const sinHalf = Math.sqrt(Math.max(0, 1 - clampedW * clampedW))

    if (sinHalf < 1e-6) {
      return [1, 0, 0, angle]
    }
    return [qx / sinHalf, qy / sinHalf, qz / sinHalf, angle]
  }

  static matrixToQuaternion(transform: Transform): [number, number, number, number] {
    // Shepperd's 4-branch numerically stable rotation matrix to quaternion extraction
    const m00 = transform.matrix[0][0]
    const m01 = transform.matrix[0][1]
    const m02 = transform.matrix[0][2]
    const m10 = transform.matrix[1][0]
    const m11 = transform.matrix[1][1]
    const m12 = transform.matrix[1][2]
    const m20 = transform.matrix[2][0]
    const m21 = transform.matrix[2][1]
    const m22 = transform.matrix[2][2]

    const trace = m00 + m11 + m22
    let qw: number
    let qx: number
    let qy: number
    let qz: number

    if (trace > 0) {
      const s = 0.5 / Math.sqrt(trace + 1.0)
      qw = 0.25 / s
      qx = (m21 - m12) * s
      qy = (m02 - m20) * s
      qz = (m10 - m01) * s
    } else if (m00 > m11 && m00 > m22) {
      const s = 2.0 * Math.sqrt(Math.max(0, 1.0 + m00 - m11 - m22))
      qw = (m21 - m12) / s
      qx = 0.25 * s
      qy = (m01 + m10) / s
      qz = (m02 + m20) / s
    } else if (m11 > m22) {
      const s = 2.0 * Math.sqrt(Math.max(0, 1.0 + m11 - m00 - m22))
      qw = (m02 - m20) / s
      qx = (m01 + m10) / s
      qy = 0.25 * s
      qz = (m12 + m21) / s
    } else {
      const s = 2.0 * Math.sqrt(Math.max(0, 1.0 + m22 - m00 - m11))
      qw = (m10 - m01) / s
      qx = (m02 + m20) / s
      qy = (m12 + m21) / s
      qz = 0.25 * s
    }

    const len = Math.hypot(qx, qy, qz, qw)
    if (len > 1e-9) {
      qx /= len
      qy /= len
      qz /= len
      qw /= len
    }
    return [qx, qy, qz, qw]
  }

  private static modelViewProjection(
    viewTransform: Transform,
    principalPoint: Point2D,
    horizontalFieldOfView: number
  ): Transform {
    let s = 1 / Math.tan(0.5 * horizontalFieldOfView)
    let n = 0.01
    let f = 10
    let projectionTransform = Transform.fromMatrix([
      [s, 0, -principalPoint.x, 0],
      [0, s, -principalPoint.y, 0],
      [0, 0, -(f + n) / (f - n), -2 * f * n / (f - n)],
      [0, 0, -1, 0]
    ])
    return viewTransform.leftMultiplied(projectionTransform)
  }
}
