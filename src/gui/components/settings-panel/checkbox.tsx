/**
 * fSpy
 * Copyright (c) 2020 - Per Gantelius
 */

interface CheckboxProps {
  title: string
  isSelected: boolean
  onChange(isSelected: boolean): void
}

export default function Checkbox(props: CheckboxProps) {
  return (
    <label className='flex items-center justify-between cursor-pointer select-none py-1 group'>
      <span className='text-xs text-zinc-300 group-hover:text-zinc-100 transition-colors'>
        {props.title}
      </span>
      <button
        type='button'
        role='switch'
        aria-checked={props.isSelected}
        onClick={() => props.onChange(!props.isSelected)}
        className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${
          props.isSelected ? 'bg-amber-500' : 'bg-zinc-700'
        }`}
      >
        <span
          className={`inline-block h-3 w-3 transform rounded-full bg-zinc-950 transition-transform ${
            props.isSelected ? 'translate-x-3.5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </label>
  )
}
