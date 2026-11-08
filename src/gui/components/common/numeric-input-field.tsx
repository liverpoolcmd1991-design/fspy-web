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

import React, { useState } from 'react'

interface NumericInputFieldProps {
  precision?: number
  isDisabled?: boolean
  valueNotAvailable?: boolean
  value: number
  onSubmit(value: number): void
}

export default function NumericInputField(props: NumericInputFieldProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedValue, setEditedValue] = useState(props.value.toString())

  const parseNumeric = (str: string): number | undefined => {
    const parsed = parseFloat(str)
    return isNaN(parsed) ? undefined : parsed
  }

  const isValid = parseNumeric(editedValue) !== undefined

  const displayValue = props.valueNotAvailable
    ? 'n/a'
    : props.precision !== undefined
      ? props.value.toFixed(props.precision)
      : props.value.toString()

  const commitEdit = () => {
    setIsEditing(false)
    const num = parseNumeric(editedValue)
    if (num !== undefined) {
      props.onSubmit(num)
    }
  }

  return (
    <input
      type="text"
      disabled={props.isDisabled}
      value={isEditing ? editedValue : displayValue}
      onFocus={() => {
        if (!props.isDisabled) {
          setIsEditing(true)
          setEditedValue(props.value.toString())
        }
      }}
      onChange={(e) => {
        if (!props.isDisabled) {
          setEditedValue(e.target.value)
        }
      }}
      onBlur={() => {
        if (!props.isDisabled) {
          if (isValid) {
            commitEdit()
          } else {
            setIsEditing(false)
          }
        }
      }}
      onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
        if (props.isDisabled) return
        if (e.key === 'Escape') {
          setIsEditing(false)
          e.currentTarget.blur()
        } else if (e.key === 'Enter' && isValid) {
          e.preventDefault()
          commitEdit()
          e.currentTarget.blur()
        }
      }}
      className={`w-16 px-2 py-1 text-xs font-mono tabular-nums rounded-md border transition-colors focus:outline-none ${
        props.isDisabled
          ? 'bg-[#121417]/50 border-slate-800/70 text-slate-500 cursor-not-allowed'
          : isEditing
            ? isValid
              ? 'bg-[#121417] border-emerald-500 text-white'
              : 'bg-[#121417] border-rose-500 text-rose-200'
            : 'bg-[#121417] border-slate-700/80 text-slate-200 hover:border-slate-600'
      }`}
    />
  )
}

