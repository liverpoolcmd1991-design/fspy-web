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

import { Check, Copy } from 'lucide-react'
import { useState } from 'react'

interface TableRowProps {
  title: string
  value: number | null
  isFirstRow?: boolean
  isLastRow?: boolean
}

export default function TableRow(props: TableRowProps) {
  const [copied, setCopied] = useState(false)

  const valueClipboardString =
    props.value === null ? 'null' : props.value.toString()

  let valueDisplayString = 'n/a'
  if (props.value !== null) {
    if (typeof props.value === 'number') {
      valueDisplayString =
        props.value === Math.floor(props.value)
          ? props.value.toString()
          : props.value.toPrecision(7)
    } else {
      valueDisplayString = String(props.value)
    }
  }

  const handleCopy = () => {
    navigator.clipboard
      .writeText(valueClipboardString)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1200)
      })
      .catch((error: unknown) =>
        console.error('Failed to copy text to clipboard:', error)
      )
  }

  return (
    <div className="flex items-center justify-between py-1 text-xs group">
      <span className="text-slate-400 w-20 shrink-0">{props.title}</span>
      <span className="font-mono tabular-nums text-slate-200 truncate">
        {valueDisplayString}
      </span>
      <button
        type="button"
        onClick={handleCopy}
        className="flex items-center gap-1 px-2 py-0.5 text-[11px] rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors shrink-0 ml-2"
        title={`Copy ${props.title}`}
      >
        {copied ? (
          <>
            <Check className="w-3 h-3 text-emerald-400" />
            <span className="text-emerald-300">Copied</span>
          </>
        ) : (
          <>
            <Copy className="w-3 h-3 text-slate-400" />
            <span>Copy</span>
          </>
        )}
      </button>
    </div>
  )
}

