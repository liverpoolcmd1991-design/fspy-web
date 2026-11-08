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

import Constants from '../../constants'
import MathUtil from '../../solver/math-util'
import Point2D from '../../solver/point-2d'
import { Palette } from '../../style/palette'
import { Axis } from '../../types/calibration-settings'
import ControlPoint from './control-point'
import ControlPolyline from './control-polyline'
import ReferenceDistanceAnchorControl from './reference-distance-anchor-control'

export const dashedRulerStyle = {
  stroke: Palette.gray,
  opacity: 0.5,
  strokeDasharray: '2,6',
}

interface ReferenceDistanceControlProps {
  referenceAxis: Axis
  anchorPosition: Point2D
  handlePositions: [Point2D, Point2D]
  horizonVanishingPoints: [Point2D, Point2D]
  origin: Point2D
  uIntersection: Point2D
  vIntersection: Point2D
  anchorPositionIsValid: boolean
  anchorDragCallback(position: Point2D): void
  handleDragCallback(handleIndex: number, offset: Point2D): void
}

export default function ReferenceDistanceControl(
  props: ReferenceDistanceControlProps
) {
  const renderDistanceHandles = () => {
    if (!props.anchorPositionIsValid) {
      return null
    }

    const normal = {
      x: props.anchorPosition.y - props.handlePositions[0].y,
      y: -props.anchorPosition.x + props.handlePositions[0].x,
    }

    const axisColor = Palette.colorForAxis(props.referenceAxis)

    return (
      <g>
        <ControlPolyline
          dimmed={true}
          dashed={true}
          color={axisColor}
          points={[props.anchorPosition, props.handlePositions[1]]}
        />
        <ControlPolyline color={axisColor} points={props.handlePositions} />
        <ControlPoint
          lineNormal={normal}
          absolutePosition={props.handlePositions[0]}
          onControlPointDrag={(position: Point2D) => {
            props.handleDragCallback(0, position)
          }}
          stroke={axisColor}
        />
        <ControlPoint
          lineNormal={normal}
          absolutePosition={props.handlePositions[1]}
          onControlPointDrag={(position: Point2D) => {
            props.handleDragCallback(1, position)
          }}
          stroke={axisColor}
        />
      </g>
    )
  }

  if (Constants.referenceDistanceAnchorEnabled) {
    const horizonDir = MathUtil.normalized(
      MathUtil.difference(
        props.horizonVanishingPoints[0],
        props.horizonVanishingPoints[1]
      )
    )

    const l = 10000
    const horizonLineStart = {
      x: props.horizonVanishingPoints[0].x - l * horizonDir.x,
      y: props.horizonVanishingPoints[0].y - l * horizonDir.y,
    }
    const horizonLineEnd = {
      x: props.horizonVanishingPoints[0].x + l * horizonDir.x,
      y: props.horizonVanishingPoints[0].y + l * horizonDir.y,
    }

    return (
      <g>
        <ControlPolyline
          points={[horizonLineStart, horizonLineEnd]}
          color={Palette.referenceDistanceControlColor}
          dimmed={true}
        />
        <ReferenceDistanceAnchorControl
          anchorPositionIsValid={props.anchorPositionIsValid}
          absolutePosition={props.anchorPosition}
          dragCallback={props.anchorDragCallback}
          uIntersection={props.uIntersection}
          vIntersection={props.vIntersection}
          origin={props.origin}
        />
        {renderDistanceHandles()}
      </g>
    )
  } else {
    return <g>{renderDistanceHandles()}</g>
  }
}

