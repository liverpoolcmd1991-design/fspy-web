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

import MathUtil from '../../solver/math-util'
import Point2D from '../../solver/point-2d'
import {
  ControlPointPairIndex,
  ControlPointPairState,
} from '../../types/control-points-state'
import ControlPoint from './control-point'
import ControlPolyline from './control-polyline'

interface HorizonControlProps {
  vanishingPointIndex: number
  color: string
  pointPair: ControlPointPairState
  vanishingPoint: Point2D | null
  dragCallback(
    controlPointIndex: ControlPointPairIndex,
    position: Point2D
  ): void
}

export default function HorizonControl(props: HorizonControlProps) {
  return (
    <g>
      {props.vanishingPoint && (
        <ControlPolyline
          dimmed={true}
          color={props.color}
          points={[
            props.vanishingPoint,
            MathUtil.lineSegmentMidpoint(props.pointPair),
          ]}
        />
      )}
      <ControlPolyline
        number={props.vanishingPointIndex + 1}
        points={props.pointPair}
        color={props.color}
      />
      <ControlPoint
        absolutePosition={props.pointPair[0]}
        onControlPointDrag={(position: Point2D) => {
          props.dragCallback(ControlPointPairIndex.First, position)
        }}
        fill={props.color}
      />
      <ControlPoint
        absolutePosition={props.pointPair[1]}
        onControlPointDrag={(position: Point2D) => {
          props.dragCallback(ControlPointPairIndex.Second, position)
        }}
        fill={props.color}
      />
    </g>
  )
}

