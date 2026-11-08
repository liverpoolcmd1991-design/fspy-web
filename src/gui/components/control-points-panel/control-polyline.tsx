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
import { numberGlyph } from './glyph-paths'

interface ControlPolylineProps {
  points: Point2D[]
  number?: number
  color?: string
  dimmed?: boolean
  dashed?: boolean
}

export default function ControlPolyline(props: ControlPolylineProps) {
  if (props.points.length === 0) {
    return null
  }

  let xMean = 0
  let yMean = 0
  const pairs: string[] = []
  for (const point of props.points) {
    xMean += point.x / props.points.length
    yMean += point.y / props.points.length
    pairs.push(`${point.x},${point.y}`)
  }

  const xOffset = props.number === 1 ? -1 : 0

  return (
    <g className="pointer-events-none">
      <polyline
        points={pairs.join(' ')}
        fill="none"
        stroke={props.color}
        strokeWidth={props.dimmed ? 1.15 : 1.65}
        opacity={props.dimmed ? 0.45 : 0.95}
        strokeDasharray={props.dashed ? '3, 4' : undefined}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {props.number !== undefined && (
        <>
          <circle
            cx={xMean}
            cy={yMean}
            r={8.5}
            fill={Palette.black}
            opacity={0.72}
            stroke={props.color}
            strokeWidth={1}
          />
          {numberGlyph(
            props.number,
            Palette.white,
            { x: xMean + xOffset, y: yMean },
            7.5
          )}
        </>
      )}
    </g>
  )
}

