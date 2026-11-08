/**
 * fSpy
 * Copyright (c) 2020 - Per Gantelius
 */

import { resourceURL } from '../io/util'
import { FolderOpen, Sparkles, Compass, Layers, FileCode2 } from 'lucide-react'

interface SplashScreenProps {
  onClickedLoadExampleProject(): void
  onClickedOpenFile(): void
}

export default function SplashScreen(props: SplashScreenProps) {
  return (
    <main className='flex-1 bg-[#0b0b0e] flex flex-col items-center justify-center p-6 select-none relative overflow-hidden'>
      {/* Subtle perspective grid lines in background */}
      <div
        className='absolute inset-0 pointer-events-none opacity-25'
        style={{
          backgroundImage:
            'radial-gradient(circle at 50% 45%, rgba(245, 158, 11, 0.08), transparent 60%), linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '100% 100%, 48px 48px, 48px 48px'
        }}
      />

      <div className='relative z-10 max-w-lg w-full rounded-xl border border-zinc-800/90 bg-[#131318]/90 backdrop-blur-md p-8 shadow-2xl text-center space-y-6'>
        <div className='flex flex-col items-center space-y-3'>
          <div className='w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shadow-inner'>
            <img src={resourceURL('icon.svg')} alt='fSpy Logo' className='w-10 h-10' />
          </div>
          <div>
            <h1 className='text-xl font-semibold tracking-tight text-zinc-100'>
              fSpy Studio
            </h1>
            <p className='text-xs text-zinc-400 mt-1'>
              Precision Still Image Camera Matching &amp; Perspective Calibration
            </p>
          </div>
        </div>

        {/* Dropzone Box */}
        <div
          onClick={props.onClickedOpenFile}
          className='group cursor-pointer rounded-lg border border-dashed border-zinc-700 hover:border-amber-500/70 bg-zinc-900/50 hover:bg-zinc-900/90 px-6 py-7 transition-all'
        >
          <p className='text-xs font-medium text-zinc-200 group-hover:text-amber-300 transition-colors'>
            Drop a reference image (JPEG, PNG, WebP) or <span className='font-mono'>.fspy</span> project anywhere
          </p>
          <p className='text-[11px] text-zinc-500 mt-1'>
            Or press <kbd className='px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono text-[10px]'>Ctrl+V</kbd> to paste an image directly from your clipboard
          </p>
        </div>

        {/* Primary Action Buttons */}
        <div className='grid grid-cols-1 sm:grid-cols-2 gap-2.5'>
          <button
            type='button'
            onClick={props.onClickedOpenFile}
            className='inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-xs transition-colors cursor-pointer'
          >
            <FolderOpen className='w-4 h-4' />
            <span>Open Image or .fspy…</span>
          </button>

          <button
            type='button'
            onClick={props.onClickedLoadExampleProject}
            className='inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700 font-medium text-xs transition-colors cursor-pointer'
          >
            <Sparkles className='w-4 h-4 text-amber-400' />
            <span>Load Example Project</span>
          </button>
        </div>

        {/* Feature Highlights */}
        <div className='pt-4 border-t border-zinc-800/80 grid grid-cols-3 gap-3 text-left'>
          <div className='space-y-1'>
            <div className='flex items-center gap-1.5 text-[11px] font-medium text-zinc-300'>
              <Compass className='w-3.5 h-3.5 text-amber-400 shrink-0' />
              <span>EXIF &amp; 1/2-VP</span>
            </div>
            <p className='text-[10px] text-zinc-500 leading-relaxed'>
              Auto-reads lens focal length metadata &amp; solves 3D transforms.
            </p>
          </div>
          <div className='space-y-1'>
            <div className='flex items-center gap-1.5 text-[11px] font-medium text-zinc-300'>
              <Layers className='w-3.5 h-3.5 text-amber-400 shrink-0' />
              <span>Three.js Proxy</span>
            </div>
            <p className='text-[10px] text-zinc-500 leading-relaxed'>
              Inspect solved perspective with a real-time 3D reference rig.
            </p>
          </div>
          <div className='space-y-1'>
            <div className='flex items-center gap-1.5 text-[11px] font-medium text-zinc-300'>
              <FileCode2 className='w-3.5 h-3.5 text-amber-400 shrink-0' />
              <span>Blender .py</span>
            </div>
            <p className='text-[10px] text-zinc-500 leading-relaxed'>
              Export binary <span className='font-mono'>.fspy</span> files or a ready-to-run Blender script.
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
