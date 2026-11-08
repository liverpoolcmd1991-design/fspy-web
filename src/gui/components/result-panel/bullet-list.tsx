/**
 * fSpy
 * Copyright (c) 2020 - Per Gantelius
 */

import { AlertTriangle, AlertOctagon } from 'lucide-react'

export enum BulletListType {
  Warnings,
  Errors
}

interface BulletListProps {
  messages: string[]
  type: BulletListType
}

export default function BulletList(props: BulletListProps) {
  const isError = props.type === BulletListType.Errors

  return (
    <ul className='space-y-1.5 m-0 p-0 list-none'>
      {props.messages.map((message: string, i: number) => (
        <li
          key={i}
          className={`flex items-start gap-2 rounded-md border px-2.5 py-2 text-[11px] leading-snug ${
            isError
              ? 'bg-red-950/35 border-red-800/50 text-red-200'
              : 'bg-amber-950/30 border-amber-800/40 text-amber-200'
          }`}
        >
          {isError ? (
            <AlertOctagon className='w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5' />
          ) : (
            <AlertTriangle className='w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5' />
          )}
          <span>{message}</span>
        </li>
      ))}
    </ul>
  )
}
