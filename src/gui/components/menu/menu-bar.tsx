/**
 * fSpy
 * Copyright (c) 2020 - Per Gantelius
 */

import { useStore } from 'zustand'
import { useFSpyStore } from '../../store/use-fspy-store'
import { resourceURL } from '../../io/util'
import {
  FolderOpen,
  FilePlus2,
  Save,
  Undo2,
  Redo2,
  PanelLeftClose,
  PanelLeftOpen,
  FileCode2,
  Download,
  Sparkles,
  Share2,
  BookOpen,
  Image as ImageIcon
} from 'lucide-react'

interface MenuBarProps {
  onNewProject(): void
  onOpenFilePicker(): void
  onLoadExampleProject(): void
  onSaveProject(): void
  onExportBlenderScript(): void
  onExportCameraJson(): void
  onExportProjectImage(): void
}

export default function MenuBar(props: MenuBarProps) {
  const uiState = useFSpyStore((s) => s.uiState)
  const image = useFSpyStore((s) => s.image)
  const solverResult = useFSpyStore((s) => s.solverResult)
  const setSidePanelVisibility = useFSpyStore((s) => s.setSidePanelVisibility)
  const setActiveModal = useFSpyStore((s) => s.setActiveModal)

  const undo = useStore(useFSpyStore.temporal, (state) => state.undo)
  const redo = useStore(useFSpyStore.temporal, (state) => state.redo)
  const pastStates = useStore(useFSpyStore.temporal, (state) => state.pastStates)
  const futureStates = useStore(useFSpyStore.temporal, (state) => state.futureStates)

  const hasImage = image.url !== null
  const hasSolvedCamera = solverResult.cameraParameters !== null
  const canUndo = pastStates.length > 0
  const canRedo = futureStates.length > 0

  return (
    <header className='h-11 shrink-0 bg-[#121216] border-b border-zinc-800/90 px-3 flex items-center justify-between gap-2 select-none z-30'>
      {/* Brand & Active Project */}
      <div className='flex items-center gap-2.5 min-w-0'>
        <div className='flex items-center gap-2'>
          <img src={resourceURL('icon.svg')} alt='fSpy' className='w-5 h-5' />
          <span className='font-semibold text-xs tracking-tight text-zinc-100'>
            fSpy <span className='text-amber-400 font-mono text-[10px] ml-0.5'>STUDIO</span>
          </span>
        </div>

        <span className='h-3.5 w-px bg-zinc-800' />

        {/* File Operations */}
        <div className='flex items-center gap-1'>
          <button
            type='button'
            onClick={props.onNewProject}
            title='New Project'
            className='inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800/80 transition-colors cursor-pointer'
          >
            <FilePlus2 className='w-3.5 h-3.5 text-zinc-400' />
            <span className='hidden sm:inline'>New</span>
          </button>

          <button
            type='button'
            onClick={props.onOpenFilePicker}
            title='Open Image or .fspy Project'
            className='inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800/80 transition-colors cursor-pointer'
          >
            <FolderOpen className='w-3.5 h-3.5 text-amber-400' />
            <span>Open…</span>
          </button>

          <button
            type='button'
            onClick={props.onLoadExampleProject}
            title='Load Bundled Example Project'
            className='inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800/80 transition-colors cursor-pointer'
          >
            <Sparkles className='w-3.5 h-3.5 text-amber-400' />
            <span className='hidden md:inline'>Example</span>
          </button>

          <button
            type='button'
            disabled={!hasImage}
            onClick={props.onSaveProject}
            title='Save .fspy Binary Project (Ctrl+S)'
            className='inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800/80 disabled:opacity-35 disabled:pointer-events-none transition-colors cursor-pointer'
          >
            <Save className='w-3.5 h-3.5 text-zinc-400' />
            <span className='hidden sm:inline'>Save .fspy</span>
          </button>
        </div>

        <span className='h-3.5 w-px bg-zinc-800 hidden sm:inline-block' />

        {/* Undo / Redo */}
        <div className='flex items-center gap-0.5'>
          <button
            type='button'
            disabled={!canUndo}
            onClick={() => undo()}
            title='Undo (Ctrl+Z)'
            className='inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800/80 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer'
          >
            <Undo2 className='w-3.5 h-3.5' />
          </button>
          <button
            type='button'
            disabled={!canRedo}
            onClick={() => redo()}
            title='Redo (Ctrl+Y / Ctrl+Shift+Z)'
            className='inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800/80 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer'
          >
            <Redo2 className='w-3.5 h-3.5' />
          </button>
        </div>
      </div>

      {/* Center Project File Title */}
      <div className='hidden lg:flex items-center gap-2 text-xs text-zinc-400 truncate max-w-xs'>
        <span className='truncate font-mono text-[11px] text-zinc-300'>
          {uiState.projectName
            ? uiState.projectName
            : hasImage
              ? 'Untitled Calibration.fspy'
              : 'No Project Loaded'}
        </span>
        {uiState.projectHasUnsavedChanges && hasImage && (
          <span className='text-[10px] font-mono text-amber-400'>● Modified</span>
        )}
      </div>

      {/* Right Tools & Export */}
      <div className='flex items-center gap-1.5'>
        <button
          type='button'
          onClick={() => setActiveModal('guide')}
          title='Open Quick-Start Visual Guide for all fSpy Tools'
          className='inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-400/50 shadow-[0_0_12px_rgba(16,185,129,0.45)] hover:shadow-[0_0_16px_rgba(16,185,129,0.65)] transition-all cursor-pointer'
        >
          <span className='w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse' />
          <BookOpen className='w-3.5 h-3.5 text-emerald-300' />
          <span>Guide</span>
        </button>

        {hasImage && (
          <button
            type='button'
            onClick={props.onExportProjectImage}
            title='Export Reference Image'
            className='hidden xl:inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800/80 transition-colors cursor-pointer'
          >
            <ImageIcon className='w-3.5 h-3.5 text-zinc-400' />
            <span>Image</span>
          </button>
        )}

        <button
          type='button'
          disabled={!hasSolvedCamera}
          onClick={() => setActiveModal('export-hub')}
          title='Open Multi-DCC & Composite PNG Export Hub'
          className='inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-zinc-800/90 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/80 disabled:opacity-35 disabled:pointer-events-none transition-colors cursor-pointer'
        >
          <Share2 className='w-3.5 h-3.5 text-amber-400' />
          <span>Export Hub…</span>
        </button>

        <button
          type='button'
          disabled={!hasSolvedCamera}
          onClick={props.onExportCameraJson}
          title='Export Camera Parameters as JSON'
          className='hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-zinc-800/90 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/80 disabled:opacity-35 disabled:pointer-events-none transition-colors cursor-pointer'
        >
          <Download className='w-3.5 h-3.5' />
          <span>JSON</span>
        </button>

        <button
          type='button'
          disabled={!hasSolvedCamera}
          onClick={props.onExportBlenderScript}
          title='Export One-Click Blender Camera Setup Script (.py)'
          className='inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-zinc-950 disabled:opacity-35 disabled:pointer-events-none transition-colors cursor-pointer'
        >
          <FileCode2 className='w-3.5 h-3.5' />
          <span>Blender .py</span>
        </button>

        <span className='h-3.5 w-px bg-zinc-800' />

        <button
          type='button'
          disabled={!hasImage}
          onClick={() => setSidePanelVisibility(!uiState.sidePanelsAreVisible)}
          title='Toggle Side Inspector Panels (Tab)'
          className='inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800/80 disabled:opacity-35 disabled:pointer-events-none transition-colors cursor-pointer'
        >
          {uiState.sidePanelsAreVisible ? (
            <PanelLeftClose className='w-4 h-4 text-zinc-400' />
          ) : (
            <PanelLeftOpen className='w-4 h-4 text-amber-400' />
          )}
        </button>
      </div>
    </header>
  )
}
