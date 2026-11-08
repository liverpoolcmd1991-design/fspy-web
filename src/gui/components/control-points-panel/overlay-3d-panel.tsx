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

import AABB from '../../solver/aabb'
import AABBOps from '../../solver/aabb-ops'
import CoordinatesUtil, {
  ImageCoordinateFrame,
} from '../../solver/coordinates-util'
import MathUtil from '../../solver/math-util'
import Point2D from '../../solver/point-2d'
import { CameraParameters } from '../../solver/solver-result'
import Vector3D from '../../solver/vector-3d'
import { Palette } from '../../style/palette'
import { Axis } from '../../types/calibration-settings'
import { GlobalSettings, Overlay3DGuide } from '../../types/global-settings'
import { axisGlyph } from './glyph-paths'

interface GridLineProps {
  points: Point2D[]
  isClosed?: boolean
}

function GridPolyline(props: GridLineProps) {
  const pairs = props.points.map((p) => `${p.x},${p.y}`).join(' ')

  if (props.isClosed) {
    return (
      <polygon
        points={pairs}
        fill="none"
        stroke={Palette.lightGray}
        strokeWidth={0.9}
        opacity={0.55}
        className="pointer-events-none"
      />
    )
  }

  return (
    <polyline
      points={pairs}
      fill="none"
      stroke={Palette.lightGray}
      strokeWidth={0.9}
      opacity={0.55}
      className="pointer-events-none"
    />
  )
}

interface Overlay3DPanelProps {
  width: number
  height: number
  imageAABB: AABB
  cameraParameters: CameraParameters
  globalSettings: GlobalSettings
  referenceDistanceAxis: Axis | null
}

export default function Overlay3DPanel(props: Overlay3DPanelProps) {
  const getNormalizationFactor = (): number => {
    const viewTransform = props.cameraParameters.viewTransform
    const fov = props.cameraParameters.horizontalFieldOfView
    const translation = new Vector3D(
      viewTransform.matrix[0][3],
      viewTransform.matrix[1][3],
      viewTransform.matrix[2][3]
    )
    const l = translation.length
    const s = Math.atan(0.5 * fov)
    return l * s
  }

  const project = (point: Vector3D): Point2D => {
    const viewTransform = props.cameraParameters.viewTransform
    const principalPoint = props.cameraParameters.principalPoint
    const imageWidth = AABBOps.width(props.imageAABB)
    const imageHeight = AABBOps.height(props.imageAABB)
    const horizontalFieldOfView = props.cameraParameters.horizontalFieldOfView

    const relativePosition = CoordinatesUtil.convert(
      MathUtil.perspectiveProject(
        point,
        viewTransform,
        principalPoint,
        horizontalFieldOfView
      ),
      ImageCoordinateFrame.ImagePlane,
      ImageCoordinateFrame.Relative,
      imageWidth,
      imageHeight
    )

    return {
      x:
        props.imageAABB.xMin +
        relativePosition.x * AABBOps.width(props.imageAABB),
      y:
        props.imageAABB.yMin +
        relativePosition.y * AABBOps.height(props.imageAABB),
    }
  }

  const renderBox = () => {
    const size = 0.3 * getNormalizationFactor()

    const zMinFace: Vector3D[] = [
      new Vector3D(-1, -1, -1),
      new Vector3D(1, -1, -1),
      new Vector3D(1, 1, -1),
      new Vector3D(-1, 1, -1),
    ]

    const zMaxFace: Vector3D[] = [
      new Vector3D(-1, -1, 1),
      new Vector3D(1, -1, 1),
      new Vector3D(1, 1, 1),
      new Vector3D(-1, 1, 1),
    ]

    const edges: Vector3D[][] = [
      [new Vector3D(-1, -1, -1), new Vector3D(-1, -1, 1)],
      [new Vector3D(1, -1, -1), new Vector3D(1, -1, 1)],
      [new Vector3D(1, 1, -1), new Vector3D(1, 1, 1)],
      [new Vector3D(-1, 1, -1), new Vector3D(-1, 1, 1)],
    ]

    const projectedFaces = [zMinFace, zMaxFace].map((face) =>
      face.map((vector: Vector3D) => project(vector.multipliedByScalar(size)))
    )

    const projectedEdges = edges.map((edge) =>
      edge.map((vector: Vector3D) => project(vector.multipliedByScalar(size)))
    )

    return (
      <g className="pointer-events-none">
        <GridPolyline points={projectedFaces[0]} isClosed={true} />
        <GridPolyline points={projectedFaces[1]} isClosed={true} />
        <GridPolyline points={projectedEdges[0]} />
        <GridPolyline points={projectedEdges[1]} />
        <GridPolyline points={projectedEdges[2]} />
        <GridPolyline points={projectedEdges[3]} />
      </g>
    )
  }

  const renderGridFloor = (normalAxis: Axis) => {
    const cellCount = 10
    const cellSize = 0.15 * getNormalizationFactor()
    const gridLines3D: [Vector3D, Vector3D][] = []
    const min = -0.5 * cellCount * cellSize
    const max = min + cellCount * cellSize

    function gridPoint(u: number, v: number): Vector3D {
      switch (normalAxis) {
        case Axis.NegativeX:
        case Axis.PositiveX:
          return new Vector3D(0, u, v)
        case Axis.NegativeY:
        case Axis.PositiveY:
          return new Vector3D(u, 0, v)
        case Axis.NegativeZ:
        case Axis.PositiveZ:
          return new Vector3D(u, v, 0)
      }
      throw new Error('Should not end up here')
    }

    for (let i = 0; i <= cellCount; i++) {
      const linePosition = min + i * cellSize
      gridLines3D.push([gridPoint(min, linePosition), gridPoint(max, linePosition)])
      gridLines3D.push([gridPoint(linePosition, min), gridPoint(linePosition, max)])
    }

    const gridLines2D: [Point2D, Point2D][] = gridLines3D.map((gridLine3D) => [
      project(gridLine3D[0]),
      project(gridLine3D[1]),
    ])

    return (
      <g className="pointer-events-none">
        {gridLines2D.map((endpoints, index) => (
          <GridPolyline key={index} points={endpoints} />
        ))}
      </g>
    )
  }

  const render3DGuide = (overlay3DGuide: Overlay3DGuide) => {
    switch (overlay3DGuide) {
      case Overlay3DGuide.Box:
        return renderBox()
      case Overlay3DGuide.XYGridFloor:
        return renderGridFloor(Axis.PositiveZ)
      case Overlay3DGuide.YZGridFloor:
        return renderGridFloor(Axis.PositiveX)
      case Overlay3DGuide.ZXGridFloor:
        return renderGridFloor(Axis.PositiveY)
      default:
        return null
    }
  }

  const renderAxis = (
    axis: Axis,
    axisLength: number,
    color: string,
    arrowAndLabelOnly: boolean
  ) => {
    const arrowSize = 0.12 * axisLength
    const projectedOrigin = project(new Vector3D())
    const endpoint = new Vector3D()
    const axisNormal = new Vector3D()
    switch (axis) {
      case Axis.PositiveX:
        endpoint.x = axisLength
        axisNormal.y = 1
        break
      case Axis.PositiveY:
        endpoint.y = axisLength
        axisNormal.z = 1
        break
      case Axis.PositiveZ:
        endpoint.z = axisLength
        axisNormal.y = 1
        break
      default:
        return null
    }

    const axisDirection = endpoint.normalized()
    const arrowWidth = 0.7
    const arrowWedgeStart = project(
      new Vector3D(
        endpoint.x + arrowSize * (arrowWidth * axisNormal.x - axisDirection.x),
        endpoint.y + arrowSize * (arrowWidth * axisNormal.y - axisDirection.y),
        endpoint.z + arrowSize * (arrowWidth * axisNormal.z - axisDirection.z)
      )
    )
    const arrowWedgeEnd = project(
      new Vector3D(
        endpoint.x + arrowSize * (-arrowWidth * axisNormal.x - axisDirection.x),
        endpoint.y + arrowSize * (-arrowWidth * axisNormal.y - axisDirection.y),
        endpoint.z + arrowSize * (-arrowWidth * axisNormal.z - axisDirection.z)
      )
    )

    const projectedEndpoint = project(endpoint)
    const labelPosition = project(endpoint.multipliedByScalar(1.1))
    return (
      <g className="pointer-events-none">
        {!arrowAndLabelOnly && (
          <polyline
            fill="none"
            strokeWidth={1.6}
            points={`${projectedOrigin.x},${projectedOrigin.y} ${projectedEndpoint.x},${projectedEndpoint.y}`}
            stroke={color}
          />
        )}
        <polyline
          fill="none"
          strokeWidth={1.6}
          points={`${arrowWedgeStart.x},${arrowWedgeStart.y} ${projectedEndpoint.x},${projectedEndpoint.y} ${arrowWedgeEnd.x},${arrowWedgeEnd.y}`}
          stroke={color}
        />
        {axisGlyph(axis, labelPosition, 8.5)}
      </g>
    )
  }

  const axisLength = 0.3 * getNormalizationFactor()

  return (
    <g className="pointer-events-none">
      {render3DGuide(props.globalSettings.overlay3DGuide)}
      {renderAxis(
        Axis.PositiveX,
        axisLength,
        Palette.red,
        props.referenceDistanceAxis === Axis.PositiveX ||
          props.referenceDistanceAxis === Axis.NegativeX
      )}
      {renderAxis(
        Axis.PositiveY,
        axisLength,
        Palette.green,
        props.referenceDistanceAxis === Axis.PositiveY ||
          props.referenceDistanceAxis === Axis.NegativeY
      )}
      {renderAxis(
        Axis.PositiveZ,
        axisLength,
        Palette.blue,
        props.referenceDistanceAxis === Axis.PositiveZ ||
          props.referenceDistanceAxis === Axis.NegativeZ
      )}
    </g>
  )
}

