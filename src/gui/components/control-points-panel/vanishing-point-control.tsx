/**
 * fSpy
 * Copyright (c) 2020 - Per Gantelius
 */

import MathUtil from '../../solver/math-util'
import Point2D from '../../solver/point-2d'
import {
  ControlPointPairIndex,
  VanishingPointControlState
} from '../../types/control-points-state'
import ControlPoint from './control-point'
import ControlPolyline from './control-polyline'

interface VanishingPointControlProps {
  hideControlPoints?: boolean
  color: string
  controlState: VanishingPointControlState
  vanishingPoint: Point2D | null
  vanishingPointIndex: number
  showResiduals?: boolean
  segmentResidualAnglesDeg?: number[]

  onControlPointDrag(
    lineSegmentIndex: number,
    pointPairIndex: ControlPointPairIndex,
    position: Point2D
  ): void
}

export default function VanishingPointControl(
  props: VanishingPointControlProps
) {
  const renderLineSegment = (index: number) => {
    const seg = props.controlState.lineSegments[index]
    if (!seg) return null

    const mid = MathUtil.lineSegmentMidpoint(seg)
    const residualDeg = props.segmentResidualAnglesDeg?.[index]
    const showBadge =
      Boolean(props.showResiduals) &&
      typeof residualDeg === 'number' &&
      !Number.isNaN(residualDeg)

    let badgeColor = '#10b981' // emerald
    if (typeof residualDeg === 'number') {
      if (residualDeg > 0.85) badgeColor = '#ef4444' // red
      else if (residualDeg > 0.25) badgeColor = '#f59e0b' // amber
    }

    return (
      <g key={index}>
        <ControlPolyline
          number={props.vanishingPointIndex + 1}
          points={seg}
          color={props.color}
        />
        {showBadge && (
          <g
            transform={`translate(${mid.x}, ${mid.y - 14})`}
            className='pointer-events-none select-none'
          >
            <rect
              x={-22}
              y={-9}
              width={44}
              height={16}
              rx={4}
              fill='#09090b'
              fillOpacity={0.88}
              stroke={badgeColor}
              strokeWidth={1}
            />
            <text
              x={0}
              y={2}
              textAnchor='middle'
              fill={badgeColor}
              fontSize={9.5}
              fontFamily='"JetBrains Mono", monospace'
              fontWeight={600}
            >
              {residualDeg.toFixed(2)}°
            </text>
          </g>
        )}
        <ControlPoint
          hidden={props.hideControlPoints}
          absolutePosition={seg[0]}
          onControlPointDrag={(position: Point2D) => {
            props.onControlPointDrag(index, ControlPointPairIndex.First, position)
          }}
          fill={props.color}
        />
        <ControlPoint
          hidden={props.hideControlPoints}
          absolutePosition={seg[1]}
          onControlPointDrag={(position: Point2D) => {
            props.onControlPointDrag(index, ControlPointPairIndex.Second, position)
          }}
          fill={props.color}
        />
      </g>
    )
  }

  const renderVanishingPoint = () => {
    if (!props.vanishingPoint) {
      return null
    }

    const vp = props.vanishingPoint
    return (
      <g className='pointer-events-none'>
        {props.controlState.lineSegments.map((seg, idx) => {
          const mid = MathUtil.lineSegmentMidpoint(seg)
          return (
            <ControlPolyline
              key={`ray-${idx}`}
              color={props.color}
              dimmed={true}
              points={[mid, vp]}
            />
          )
        })}
        <circle
          cx={vp.x}
          cy={vp.y}
          r={4}
          fill={props.color}
          stroke='#09090b'
          strokeWidth={1.25}
          opacity={0.95}
        />
      </g>
    )
  }

  return (
    <g>
      {renderVanishingPoint()}
      {props.controlState.lineSegments.map((_, index) =>
        renderLineSegment(index)
      )}
    </g>
  )
}
