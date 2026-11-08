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

import React, { useRef, useState } from 'react'
import MathUtil from '../../solver/math-util'
import Point2D from '../../solver/point-2d'
import ControlPolyline from './control-polyline'

interface ControlPointProps {
  hidden?: boolean
  absolutePosition: Point2D
  fill?: string | undefined
  stroke?: string | undefined
  isDragDisabled?: boolean
  lineNormal?: Point2D
  onControlPointDrag(absolutePosition: Point2D): void
}

const HIT_RADIUS = 11
const RADIUS = 4.2
const SHIFT_DRAG_DAMPING = 0.1

export default function ControlPoint(props: ControlPointProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  const dragStateRef = useRef<{
    active: boolean
    virtualPos: Point2D
    lastClientPos: Point2D
  }>({
    active: false,
    virtualPos: { x: 0, y: 0 },
    lastClientPos: { x: 0, y: 0 },
  })

  if (props.hidden) {
    return null
  }

  const handlePointerDown = (e: React.PointerEvent<SVGCircleElement>) => {
    if (props.isDragDisabled || e.button !== 0) {
      return
    }
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)

    dragStateRef.current = {
      active: true,
      virtualPos: {
        x: props.absolutePosition.x,
        y: props.absolutePosition.y,
      },
      lastClientPos: { x: e.clientX, y: e.clientY },
    }
    setIsDragging(true)
    props.onControlPointDrag(dragStateRef.current.virtualPos)
  }

  const handlePointerMove = (e: React.PointerEvent<SVGCircleElement>) => {
    if (!dragStateRef.current.active) {
      return
    }
    e.stopPropagation()

    const damping = e.shiftKey ? SHIFT_DRAG_DAMPING : 1.0
    const dx = e.clientX - dragStateRef.current.lastClientPos.x
    const dy = e.clientY - dragStateRef.current.lastClientPos.y

    const nextPos = {
      x: dragStateRef.current.virtualPos.x + damping * dx,
      y: dragStateRef.current.virtualPos.y + damping * dy,
    }

    dragStateRef.current.virtualPos = nextPos
    dragStateRef.current.lastClientPos = { x: e.clientX, y: e.clientY }

    props.onControlPointDrag(nextPos)
  }

  const handlePointerUp = (e: React.PointerEvent<SVGCircleElement>) => {
    if (!dragStateRef.current.active) {
      return
    }
    e.stopPropagation()
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    dragStateRef.current.active = false
    setIsDragging(false)
  }

  let visualNode: React.ReactNode
  if (props.lineNormal) {
    const normal = MathUtil.normalized(props.lineNormal)
    const width = 7.5
    visualNode = (
      <ControlPolyline
        color={props.stroke}
        points={[
          {
            x: props.absolutePosition.x + width * normal.x,
            y: props.absolutePosition.y + width * normal.y,
          },
          {
            x: props.absolutePosition.x - width * normal.x,
            y: props.absolutePosition.y - width * normal.y,
          },
        ]}
      />
    )
  } else {
    const activeRadius = isDragging || isHovered ? RADIUS + 1.5 : RADIUS
    visualNode = (
      <g className="pointer-events-none">
        {(isHovered || isDragging) && (
          <circle
            cx={props.absolutePosition.x}
            cy={props.absolutePosition.y}
            r={activeRadius + 4}
            fill="none"
            stroke={props.fill ?? props.stroke ?? '#ffffff'}
            strokeWidth={1.2}
            opacity={0.45}
          />
        )}
        <circle
          cx={props.absolutePosition.x}
          cy={props.absolutePosition.y}
          r={activeRadius}
          fill={props.fill ?? 'rgba(15, 23, 42, 0.7)'}
          stroke={props.stroke ?? '#0f172a'}
          strokeWidth={1.6}
        />
      </g>
    )
  }

  return (
    <g>
      {visualNode}
      <circle
        cx={props.absolutePosition.x}
        cy={props.absolutePosition.y}
        r={HIT_RADIUS}
        fill="transparent"
        className={
          props.isDragDisabled ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
        }
        onPointerEnter={() => setIsHovered(true)}
        onPointerLeave={() => setIsHovered(false)}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />
    </g>
  )
}

