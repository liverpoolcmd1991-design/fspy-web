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

interface MagnifyingGlassProps {
  position: Point2D
  relativeImagePosition: Point2D
  imageWith: number
  imageHeight: number
  imageSrc: string | null
}

export default function MagnifyingGlass(props: MagnifyingGlassProps) {
  const diameter = 176
  const zoom = (20 * diameter) / props.imageWith
  if (!props.imageSrc) {
    return null
  }
  const xGlass = props.position.x - diameter / 2
  const yGlass = props.position.y - diameter / 2
  const xBg =
    -zoom * props.imageWith * props.relativeImagePosition.x + 0.5 * diameter
  const yBg =
    -zoom * props.imageHeight * props.relativeImagePosition.y + 0.5 * diameter
  const crossSize = 28

  return (
    <div
      className="pointer-events-none z-30 shadow-2xl"
      style={{
        willChange: 'transform',
        width: `${diameter}px`,
        height: `${diameter}px`,
        position: 'absolute',
        left: 0,
        top: 0,
        overflow: 'hidden',
        border: '2px solid #38bdf8',
        borderRadius: '50%',
        backgroundColor: '#0f172a',
        transform: `translate(${xGlass}px, ${yGlass}px)`,
      }}
    >
      <div
        style={{
          willChange: 'transform',
          backgroundRepeat: 'no-repeat',
          backgroundImage: `url(${props.imageSrc})`,
          backgroundSize: 'cover',
          imageRendering: 'pixelated',
          width: `${zoom * props.imageWith}px`,
          height: `${zoom * props.imageHeight}px`,
          transform: `translate(${xBg}px, ${yBg}px)`,
        }}
      />
      <div
        style={{
          width: crossSize,
          height: 1,
          backgroundColor: '#38bdf8',
          position: 'absolute',
          top: diameter / 2,
          left: diameter / 2 - crossSize / 2,
        }}
      />
      <div
        style={{
          width: 1,
          height: crossSize,
          backgroundColor: '#38bdf8',
          position: 'absolute',
          top: diameter / 2 - crossSize / 2,
          left: diameter / 2,
        }}
      />
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] font-mono tabular-nums text-sky-200 bg-slate-950/85 px-1.5 py-0.5 rounded">
        {(props.relativeImagePosition.x * props.imageWith).toFixed(1)},{' '}
        {(props.relativeImagePosition.y * props.imageHeight).toFixed(1)}
      </div>
    </div>
  )
}

