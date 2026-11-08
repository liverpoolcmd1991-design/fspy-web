/**
 * fSpy Studio — Multi-DCC & Composite Calibration Export Hub Modal
 */

import { useState } from 'react'
import {
  Box,
  Check,
  Copy,
  Download,
  FileCode2,
  Image as ImageIcon,
  X
} from 'lucide-react'
import {
  DCC_EXPORT_FORMATS,
  DCCExportFormat,
  downloadDCCExport,
  exportCompositeCalibrationPNG,
  generateDCCExportCode
} from '../../io/dcc-exporters'
import { exportReconstructedSceneGLB } from '../../solver/scene-reconstruction'
import { useFSpyStore } from '../../store/use-fspy-store'

export default function ExportHubModal() {
  const activeModal = useFSpyStore((s) => s.activeModal)
  const setActiveModal = useFSpyStore((s) => s.setActiveModal)
  const showToast = useFSpyStore((s) => s.showToast)
  const state = useFSpyStore()

  const [selectedFormat, setSelectedFormat] =
    useState<DCCExportFormat>('blender-addon-52')
  const [copied, setCopied] = useState(false)
  const [renderingPng, setRenderingPng] = useState(false)
  const [exportingGlb, setExportingGlb] = useState(false)

  if (activeModal !== 'export-hub') {
    return null
  }

  const codePreview = generateDCCExportCode(state, selectedFormat)
  const activeDescriptor = DCC_EXPORT_FORMATS.find(
    (d) => d.id === selectedFormat
  )!

  const handleCopyCode = () => {
    navigator.clipboard
      .writeText(codePreview)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1600)
        showToast(`Copied ${activeDescriptor.title} script to clipboard`)
      })
      .catch(() => {
        showToast('Clipboard copy failed')
      })
  }

  const handleDownloadFile = () => {
    downloadDCCExport(state, selectedFormat)
    showToast(`Downloaded ${activeDescriptor.title}`)
  }

  const handleDownloadCompositePng = async () => {
    setRenderingPng(true)
    try {
      await exportCompositeCalibrationPNG(state)
      showToast('Exported Composite Calibration Sheet (.png)')
    } finally {
      setRenderingPng(false)
    }
  }

  const handleDownloadSceneGlb = async () => {
    if (!state.solverResult.cameraParameters) {
      showToast('Solve camera calibration before exporting 3D scene')
      return
    }
    const activeImg =
      state.lensDistortionEnabled && state.undistortedImageUrl
        ? state.undistortedImageUrl
        : state.image.url
    if (!activeImg) return
    setExportingGlb(true)
    try {
      await exportReconstructedSceneGLB(
        activeImg,
        { ...state.sceneBlockout, enabled: true },
        state.solverResult.cameraParameters,
        state.uiState.projectName || 'fSpy_Scene'
      )
      showToast('Exported camera-projected 3D Scene (.glb)')
    } finally {
      setExportingGlb(false)
    }
  }

  return (
    <div
      className='fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 select-none'
      onClick={() => setActiveModal(null)}
    >
      <div
        className='w-full max-w-4xl rounded-xl bg-[#141419] border border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[86vh]'
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className='px-5 py-3.5 border-b border-zinc-800 flex items-center justify-between'>
          <div className='flex items-center gap-2.5'>
            <FileCode2 className='w-4 h-4 text-amber-400' />
            <div>
              <h2 className='text-sm font-semibold text-zinc-100'>
                Multi-DCC Camera &amp; 3D Scene Export Hub
              </h2>
              <p className='text-[11px] text-zinc-400'>
                Export solved cameras, camera-projected 3D scenes (.glb), and composite proof sheets
              </p>
            </div>
          </div>
          <button
            type='button'
            onClick={() => setActiveModal(null)}
            className='p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors cursor-pointer'
          >
            <X className='w-4 h-4' />
          </button>
        </div>

        {/* Body */}
        <div className='flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12 overflow-hidden'>
          {/* Format Sidebar */}
          <div className='md:col-span-5 border-r border-zinc-800/90 p-3.5 overflow-y-auto space-y-1.5 bg-[#101014]'>
            <div className='text-[10px] font-semibold uppercase tracking-wider text-zinc-500 px-2 pb-1'>
              3D DCC &amp; Engine Scripts
            </div>
            {DCC_EXPORT_FORMATS.map((fmt) => {
              const isSelected = fmt.id === selectedFormat
              return (
                <button
                  key={fmt.id}
                  type='button'
                  onClick={() => setSelectedFormat(fmt.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500/12 border-amber-500/40 text-zinc-100'
                      : 'bg-zinc-900/50 border-zinc-800/70 text-zinc-300 hover:bg-zinc-800/70'
                  }`}
                >
                  <div className='flex items-center justify-between'>
                    <span className='text-xs font-semibold'>{fmt.title}</span>
                    <span className='text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400'>
                      .{fmt.extension}
                    </span>
                  </div>
                  <p className='text-[11px] text-zinc-400 mt-0.5 leading-snug'>
                    {fmt.subtitle}
                  </p>
                </button>
              )
            })}

            <div className='pt-3 space-y-1.5'>
              <div className='text-[10px] font-semibold uppercase tracking-wider text-zinc-500 px-2 pb-1'>
                3D Geometry &amp; Calibration Proof
              </div>
              <button
                type='button'
                disabled={exportingGlb}
                onClick={() => {
                  void handleDownloadSceneGlb()
                }}
                className='w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-emerald-500/35 text-left transition-colors cursor-pointer'
              >
                <div className='flex items-center gap-2.5'>
                  <Box className='w-4 h-4 text-emerald-400 shrink-0' />
                  <div>
                    <div className='text-xs font-semibold text-zinc-100'>
                      {exportingGlb
                        ? 'Baking Camera UVs & Exporting…'
                        : 'Textured 3D Scene Model (.glb)'}
                    </div>
                    <div className='text-[10px] text-zinc-400'>
                      Room shell + blockout boxes with baked photo UVs
                    </div>
                  </div>
                </div>
                <Download className='w-3.5 h-3.5 text-emerald-300 shrink-0' />
              </button>

              <button
                type='button'
                disabled={renderingPng}
                onClick={() => {
                  void handleDownloadCompositePng()
                }}
                className='w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-left transition-colors cursor-pointer'
              >
                <div className='flex items-center gap-2.5'>
                  <ImageIcon className='w-4 h-4 text-amber-400 shrink-0' />
                  <div>
                    <div className='text-xs font-semibold text-zinc-100'>
                      {renderingPng
                        ? 'Rendering Calibration Sheet…'
                        : 'Composite Calibration Sheet (.png)'}
                    </div>
                    <div className='text-[10px] text-zinc-400'>
                      Reference photo + vanishing rays + telemetry bar
                    </div>
                  </div>
                </div>
                <Download className='w-3.5 h-3.5 text-zinc-300 shrink-0' />
              </button>
            </div>
          </div>

          {/* Live Script Preview & Actions */}
          <div className='md:col-span-7 flex flex-col min-h-0 bg-[#0c0c10]'>
            <div className='px-4 py-2.5 border-b border-zinc-800/80 flex items-center justify-between gap-2'>
              <span className='text-xs font-medium text-zinc-200 truncate'>
                {activeDescriptor.title}
              </span>
              <div className='flex items-center gap-2 shrink-0'>
                <button
                  type='button'
                  onClick={handleCopyCode}
                  className='inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-medium transition-colors cursor-pointer'
                >
                  {copied ? (
                    <>
                      <Check className='w-3.5 h-3.5 text-emerald-400' />
                      <span className='text-emerald-300'>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className='w-3.5 h-3.5' />
                      <span>Copy Script</span>
                    </>
                  )}
                </button>
                <button
                  type='button'
                  onClick={handleDownloadFile}
                  className='inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-semibold transition-colors cursor-pointer'
                >
                  <Download className='w-3.5 h-3.5' />
                  <span>Download .{activeDescriptor.extension}</span>
                </button>
              </div>
            </div>
            <pre className='flex-1 p-4 overflow-auto text-[11px] leading-relaxed font-mono text-zinc-300 select-text'>
              <code>{codePreview}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}
