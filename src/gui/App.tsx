/**
 * fSpy
 * Copyright (c) 2020 - Per Gantelius
 */

import { useEffect, useRef } from 'react'
import { useStore } from 'zustand'
import ControlPointsPanel from './components/control-points-panel/control-points-panel'
import ResultPanel from './components/result-panel/result-panel'
import SettingsPanel from './components/settings-panel/settings-panel'
import SplashScreen from './components/splash-screen'
import MenuBar from './components/menu/menu-bar'
import ExportHubModal from './components/modals/export-hub-modal'
import GuideModal from './components/modals/guide-modal'
import ProjectFile from './io/project-file'
import { extractExifFromBuffer, loadImage } from './io/util'
import {
  loadWorkspaceFromIndexedDB,
  saveWorkspaceToIndexedDB
} from './io/workspace-persistence'
import {
  useFSpyStore,
  exportBlenderPythonScript
} from './store/use-fspy-store'
import { saveAs } from 'file-saver'

export default function App() {
  const uiState = useFSpyStore((s) => s.uiState)
  const image = useFSpyStore((s) => s.image)
  const globalSettings = useFSpyStore((s) => s.globalSettings)
  const calibrationSettingsBase = useFSpyStore((s) => s.calibrationSettingsBase)
  const calibrationSettings1VP = useFSpyStore((s) => s.calibrationSettings1VP)
  const calibrationSettings2VP = useFSpyStore((s) => s.calibrationSettings2VP)
  const controlPointsStateBase = useFSpyStore((s) => s.controlPointsStateBase)
  const controlPointsState1VP = useFSpyStore((s) => s.controlPointsState1VP)
  const controlPointsState2VP = useFSpyStore((s) => s.controlPointsState2VP)
  const resultDisplaySettings = useFSpyStore((s) => s.resultDisplaySettings)
  const solverResult = useFSpyStore((s) => s.solverResult)
  const toastMessage = useFSpyStore((s) => s.toastMessage)
  const autoSaveEnabled = useFSpyStore((s) => s.autoSaveEnabled)
  const snapshotSlotsEnabled = useFSpyStore((s) => s.snapshotSlotsEnabled)

  const setImageData = useFSpyStore((s) => s.setImageData)
  const loadProjectState = useFSpyStore((s) => s.loadProjectState)
  const resetToNewProject = useFSpyStore((s) => s.resetToNewProject)
  const setSidePanelVisibility = useFSpyStore((s) => s.setSidePanelVisibility)
  const captureSnapshotSlot = useFSpyStore((s) => s.captureSnapshotSlot)
  const restoreSnapshotSlot = useFSpyStore((s) => s.restoreSnapshotSlot)
  const showToast = useFSpyStore((s) => s.showToast)

  const undo = useStore(useFSpyStore.temporal, (state) => state.undo)
  const redo = useStore(useFSpyStore.temporal, (state) => state.redo)

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const hasRestoredAutoSaveRef = useRef(false)

  // Restore workspace from IndexedDB on initial mount ONLY if user previously opted in
  useEffect(() => {
    if (!autoSaveEnabled || hasRestoredAutoSaveRef.current) return
    hasRestoredAutoSaveRef.current = true

    void loadWorkspaceFromIndexedDB().then((saved) => {
      if (!saved?.imageBytes) return
      const imageBytes = saved.imageBytes
      loadImage(
        imageBytes,
        (width: number, height: number, url: string) => {
          loadProjectState(
            saved.savedState,
            {
              width,
              height,
              url,
              data: imageBytes
            },
            saved.projectName || 'Restored Workspace',
            false
          )
          showToast('Restored workspace from opt-in browser auto-save')
        },
        () => {
          // Ignore invalid buffer
        }
      )
    })
  }, [autoSaveEnabled, loadProjectState, showToast])

  // Debounced IndexedDB persistence when autoSaveEnabled is true
  useEffect(() => {
    if (!autoSaveEnabled || !image.data) return
    const timer = window.setTimeout(() => {
      void saveWorkspaceToIndexedDB({
        savedState: {
          globalSettings,
          calibrationSettingsBase,
          calibrationSettings1VP,
          calibrationSettings2VP,
          controlPointsStateBase,
          controlPointsState1VP,
          controlPointsState2VP,
          resultDisplaySettings,
          cameraParameters: solverResult.cameraParameters
        },
        projectName: uiState.projectName,
        imageWidth: image.width,
        imageHeight: image.height,
        imageBytes: image.data,
        updatedAt: Date.now()
      })
    }, 650)

    return () => window.clearTimeout(timer)
  }, [
    autoSaveEnabled,
    uiState.projectName,
    image.data,
    image.width,
    image.height,
    globalSettings,
    calibrationSettingsBase,
    calibrationSettings1VP,
    calibrationSettings2VP,
    controlPointsStateBase,
    controlPointsState1VP,
    controlPointsState2VP,
    resultDisplaySettings,
    solverResult.cameraParameters
  ])

  const handleLoadImageBytes = async (fileName: string, bytes: Uint8Array) => {
    const exif = await extractExifFromBuffer(bytes)
    loadImage(
      bytes,
      (width: number, height: number, url: string) => {
        setImageData(fileName, url, bytes, width, height, exif)
        const exifSummary = exif?.focalLength35mm
          ? ` (EXIF ${exif.focalLength35mm}mm 35mm eq)`
          : exif?.focalLength
            ? ` (EXIF ${exif.focalLength}mm)`
            : ''
        showToast(`Loaded ${fileName}${exifSummary}`)
      },
      () => {
        showToast(`Could not load image "${fileName}". Supported formats: JPEG, PNG, WebP, BMP, SVG.`)
      }
    )
  }

  const handleFileBytes = async (fileName: string, arrayBuffer: ArrayBuffer) => {
    const bytes = new Uint8Array(arrayBuffer)
    if (ProjectFile.isProjectFile(bytes)) {
      ProjectFile.load(fileName, bytes, false)
    } else {
      await handleLoadImageBytes(fileName, bytes)
    }
  }

  const handleSaveProject = () => {
    if (!image.data) {
      showToast('Load an image before saving a .fspy project.')
      return
    }
    const existingName = uiState.projectName
      ? uiState.projectName.replace(/\.fspy$/i, '')
      : 'calibration'
    ProjectFile.save(`${existingName || 'calibration'}.fspy`)
  }

  const handleExportBlenderScript = () => {
    if (!solverResult.cameraParameters) {
      showToast('Solve valid camera parameters before exporting.')
      return
    }
    exportBlenderPythonScript(useFSpyStore.getState())
    showToast('Exported Blender Python script (.py)')
  }

  const handleExportCameraJson = () => {
    if (!solverResult.cameraParameters) {
      showToast('Solve valid camera parameters before exporting.')
      return
    }
    const jsonString = JSON.stringify(solverResult.cameraParameters, null, 2)
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' })
    saveAs(blob, 'camera-parameters.json')
    showToast('Exported camera parameters (camera-parameters.json)')
  }

  const handleExportProjectImage = () => {
    if (!image.data) return
    const safeBuffer = new Uint8Array(image.data).buffer
    const blob = new Blob([safeBuffer])
    saveAs(blob, 'reference-image.png')
    showToast('Exported reference image')
  }

  const handlersRef = useRef({
    handleFileBytes,
    handleSaveProject,
    undo,
    redo,
    snapshotSlotsEnabled,
    captureSnapshotSlot,
    restoreSnapshotSlot,
    setSidePanelVisibility
  })
  handlersRef.current = {
    handleFileBytes,
    handleSaveProject,
    undo,
    redo,
    snapshotSlotsEnabled,
    captureSnapshotSlot,
    restoreSnapshotSlot,
    setSidePanelVisibility
  }

  // Global drag-and-drop, clipboard image paste, and studio keyboard shortcuts (registered once on mount)
  useEffect(() => {
    const onDragOver = (ev: DragEvent) => {
      ev.preventDefault()
    }
    const onDrop = (ev: DragEvent) => {
      ev.preventDefault()
      const file = ev.dataTransfer?.files?.[0]
      if (file) {
        void file.arrayBuffer().then((ab) => {
          void handlersRef.current.handleFileBytes(file.name, ab)
        })
      }
    }
    const onPaste = (ev: ClipboardEvent) => {
      const items = ev.clipboardData?.items
      if (!items) return
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) {
            void file.arrayBuffer().then((ab) => {
              void handlersRef.current.handleFileBytes(
                file.name || 'clipboard-image.png',
                ab
              )
            })
            break
          }
        }
      }
    }
    const onKeyDown = (ev: KeyboardEvent) => {
      const target = ev.target as HTMLElement | null
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT')

      const h = handlersRef.current
      if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === 'z') {
        if (isInput) return
        ev.preventDefault()
        if (ev.shiftKey) {
          h.redo()
        } else {
          h.undo()
        }
      } else if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === 'y') {
        if (isInput) return
        ev.preventDefault()
        h.redo()
      } else if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === 's') {
        ev.preventDefault()
        h.handleSaveProject()
      } else if (ev.altKey && !isInput && h.snapshotSlotsEnabled) {
        const slotMap: Record<string, 0 | 1 | 2 | 3> = {
          '1': 0,
          '2': 1,
          '3': 2,
          '4': 3
        }
        const slot = slotMap[ev.key]
        if (slot !== undefined) {
          ev.preventDefault()
          if (ev.shiftKey) {
            h.captureSnapshotSlot(slot)
          } else {
            h.restoreSnapshotSlot(slot)
          }
        }
      } else if (ev.key === 'Tab' && !isInput) {
        if (useFSpyStore.getState().image.url !== null) {
          ev.preventDefault()
          const current = useFSpyStore.getState().uiState.sidePanelsAreVisible
          h.setSidePanelVisibility(!current)
        }
      }
    }

    window.addEventListener('dragover', onDragOver)
    window.addEventListener('drop', onDrop)
    window.addEventListener('paste', onPaste)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('drop', onDrop)
      window.removeEventListener('paste', onPaste)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  // Auto-dismiss toast notifications
  useEffect(() => {
    if (!toastMessage) return
    const timer = window.setTimeout(() => {
      showToast(null)
    }, 4200)
    return () => window.clearTimeout(timer)
  }, [toastMessage, showToast])

  const hasImageLoaded = image.url !== null

  return (
    <div className='h-screen w-screen overflow-hidden flex flex-col bg-[#0b0b0e] text-zinc-100'>
      {/* Hidden File Input for Open Image / .fspy */}
      <input
        ref={fileInputRef}
        type='file'
        accept='.fspy,image/*'
        className='hidden'
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) {
            void file.arrayBuffer().then((ab) => {
              void handleFileBytes(file.name, ab)
            })
          }
          e.target.value = ''
        }}
      />

      <MenuBar
        onNewProject={() => {
          resetToNewProject()
          showToast('Started new project')
        }}
        onOpenFilePicker={() => fileInputRef.current?.click()}
        onLoadExampleProject={() => {
          void ProjectFile.loadExample()
        }}
        onSaveProject={handleSaveProject}
        onExportBlenderScript={handleExportBlenderScript}
        onExportCameraJson={handleExportCameraJson}
        onExportProjectImage={handleExportProjectImage}
      />

      {hasImageLoaded ? (
        <div className='flex-1 flex min-h-0 overflow-hidden relative'>
          {uiState.sidePanelsAreVisible && <SettingsPanel />}
          <ControlPointsPanel />
          {uiState.sidePanelsAreVisible && (
            <ResultPanel
              onExportJson={handleExportCameraJson}
              onExportBlenderScript={handleExportBlenderScript}
            />
          )}
        </div>
      ) : (
        <SplashScreen
          onClickedOpenFile={() => fileInputRef.current?.click()}
          onClickedLoadExampleProject={() => {
            void ProjectFile.loadExample()
          }}
        />
      )}

      {/* Multi-DCC & Composite Calibration PNG Export Hub Modal */}
      <ExportHubModal />

      {/* Quick-Start Visual Guide Modal */}
      <GuideModal />

      {/* Non-intrusive Studio Toast Notification */}
      {toastMessage && (
        <div className='fixed bottom-14 left-1/2 -translate-x-1/2 z-50 pointer-events-none'>
          <div className='px-3.5 py-2 rounded-lg bg-zinc-900/95 border border-zinc-700/90 text-xs text-zinc-100 shadow-xl backdrop-blur-md flex items-center gap-2'>
            <span className='w-1.5 h-1.5 rounded-full bg-amber-400' />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}
    </div>
  )
}
