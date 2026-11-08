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

import { ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

export interface DropdownOption<T> {
  id: string
  value: T
  title: string
  circleColor?: string
  strokeCircle?: boolean
}

export interface DropdownProps<T> {
  options: DropdownOption<T>[]
  selectedOptionId: string
  disabled?: boolean
  onOptionSelected(value: T): void
}

export default function Dropdown<T>(props: DropdownProps<T>) {
  const [menuIsVisible, setMenuIsVisible] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        event.target instanceof Node &&
        !containerRef.current.contains(event.target)
      ) {
        setMenuIsVisible(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectedOption = props.options.find(
    (opt) => opt.id === props.selectedOptionId
  )

  const renderBadge = (option: DropdownOption<T>) => {
    if (!option.circleColor) return null
    if (option.strokeCircle) {
      return (
        <span
          className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
          style={{ border: `1.5px solid ${option.circleColor}` }}
        />
      )
    }
    return (
      <span
        className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
        style={{ backgroundColor: option.circleColor }}
      />
    )
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        disabled={props.disabled}
        onClick={() => {
          if (!props.disabled) {
            setMenuIsVisible((prev) => !prev)
          }
        }}
        className={`flex items-center justify-between gap-2 w-full px-2.5 py-1.5 text-xs rounded-md border transition-colors ${
          props.disabled
            ? 'bg-[#121417]/60 border-slate-800/70 text-slate-500 cursor-not-allowed'
            : 'bg-[#121417] border-slate-700/80 text-slate-200 hover:border-slate-600 focus-visible:outline-none focus-visible:border-sky-500'
        }`}
      >
        <span className="flex items-center gap-2 truncate">
          {selectedOption && renderBadge(selectedOption)}
          <span className="truncate">
            {selectedOption ? selectedOption.title : 'Select...'}
          </span>
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      </button>

      {menuIsVisible && !props.disabled && (
        <div className="absolute left-0 right-0 mt-1 max-h-52 overflow-y-auto rounded-md bg-[#181b20] border border-slate-700 shadow-2xl z-50 py-1">
          {props.options.map((option, index) => {
            const isSelected = option.id === props.selectedOptionId
            return (
              <button
                type="button"
                key={option.id || index}
                onClick={() => {
                  props.onOptionSelected(option.value)
                  setMenuIsVisible(false)
                }}
                className={`flex items-center gap-2 w-full px-2.5 py-1.5 text-left text-xs transition-colors ${
                  isSelected
                    ? 'bg-sky-500/20 text-sky-200 font-medium'
                    : 'text-slate-300 hover:bg-slate-800/90 hover:text-white'
                }`}
              >
                {renderBadge(option)}
                <span className="truncate">{option.title}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

