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

import Point2D from '../../solver/point-2d'
import { Palette } from '../../style/palette'
import ControlPoint from './control-point'
import ControlPolyline from './control-polyline'

interface ReferenceDistanceAnchorControlProps {
  absolutePosition: Point2D
  origin: Point2D
  uIntersection: Point2D
  vIntersection: Point2D
  anchorPositionIsValid: boolean
  dragCallback(position: Point2D): void
}

export default function ReferenceDistanceAnchorControl(
  props: ReferenceDistanceAnchorControlProps
) {
  const r = 15
  const cx = props.absolutePosition.x
  const cy = props.absolutePosition.y
  const trianglePoints = [
    `${cx},${cy - r}`,
    `${cx - r * 0.866},${cy + r * 0.5}`,
    `${cx + r * 0.866},${cy + r * 0.5}`,
  ].join(' ')

  return (
    <g>
      {props.anchorPositionIsValid ? (
        <g>
          <ControlPolyline
            dimmed={true}
            dashed={true}
            color={Palette.referenceDistanceControlColor}
            points={[props.origin, props.uIntersection]}
          />
          <ControlPolyline
            dimmed={true}
            dashed={true}
            color={Palette.referenceDistanceControlColor}
            points={[props.origin, props.vIntersection]}
          />
          <ControlPolyline
            dimmed={true}
            dashed={true}
            color={Palette.referenceDistanceControlColor}
            points={[props.absolutePosition, props.uIntersection]}
          />
          <ControlPolyline
            dimmed={true}
            dashed={true}
            color={Palette.referenceDistanceControlColor}
            points={[props.absolutePosition, props.vIntersection]}
          />
        </g>
      ) : (
        <polygon
          points={trianglePoints}
          fill="none"
          stroke={Palette.orange}
          strokeWidth={1.5}
          className="pointer-events-none"
        />
      )}
      <ControlPoint
        absolutePosition={props.absolutePosition}
        onControlPointDrag={props.dragCallback}
        fill={Palette.referenceDistanceControlColor}
      />
    </g>
  )
}

