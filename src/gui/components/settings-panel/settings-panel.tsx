/**
 * fSpy
 * Copyright (c) 2020 - Per Gantelius
 */

import { useEffect, useRef, useState } from 'react'
import { CalibrationMode, Overlay3DGuide } from '../../types/global-settings'
import Overlay3DGuideDropdown from './overlay-3d-guide-dropdown'
import { PrincipalPointMode1VP, PrincipalPointMode2VP } from '../../types/calibration-settings'
import Checkbox from './checkbox'
import ReferenceDistanceForm from './reference-distance-form'
import AxisDropdown from './axis-dropdown'
import CameraPresetForm from './../common/camera-preset-form'
import Dropdown from '../common/dropdown'
import { Palette } from '../../style/palette'
import NumericInputField from '../common/numeric-input-field'
import { cameraPresets } from '../../solver/camera-presets'
import { buildEdgeGradientMap } from '../../solver/edge-detector'
import {
  renderUndistortedImage,
  WorldRulerPlane
} from '../../solver/lens-distortion'
import {
  downloadAllPBRMapsBundle,
  downloadPBRMap,
  generatePBRMapsFromUnwarpedUrl,
  PBRGeneratedMaps,
  renderPBRLitPreviewToCanvas
} from '../../solver/pbr-material-builder'
import {
  generateAISceneArchitectPrompt,
  getSampleAIHallwayBlueprintJSON,
  parseAndApplyAISceneJSON
} from '../../solver/ai-scene-bridge'
import {
  BaseboardProfileType,
  CeilingProfileType,
  CrownMoldingProfileType,
  exportReconstructedSceneGLB,
  HostWallType,
  LathePresetType,
  ParallaxMotionPreset,
  renderUnwarpedQuadTexture,
  RoomShellType,
  solveRevolvedLathe3D,
  solveSweptColumn3D,
  StaircaseMode,
  StairTurnDirection,
  SweptColumnProfile,
  SweptRailPathMode,
  SweptRailProfile,
  UnwarpAspectPreset,
  WallCutoutAlphaMode,
  WallReliefArchType
} from '../../solver/scene-reconstruction'
import {
  ThreeProxyPreset,
  useFSpyStore
} from '../../store/use-fspy-store'
import { saveAs } from 'file-saver'
import {
  Aperture,
  Bookmark,
  Box,
  Camera,
  Crop,
  Database,
  Download,
  Layers,
  Magnet,
  Minus,
  MousePointerClick,
  Orbit,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Ruler,
  Sliders,
  Sparkles,
  Sun,
  Trash2,
  Upload,
  Video,
  Wand2
} from 'lucide-react'

const SNAPSHOT_SLOTS: { index: 0 | 1 | 2 | 3; label: string }[] = [
  { index: 0, label: 'A' },
  { index: 1, label: 'B' },
  { index: 2, label: 'C' },
  { index: 3, label: 'D' }
]

export default function SettingsPanel() {
  const modelInputRef = useRef<HTMLInputElement | null>(null)

  const globalSettings = useFSpyStore((s) => s.globalSettings)
  const calibrationSettingsBase = useFSpyStore((s) => s.calibrationSettingsBase)
  const calibrationSettings1VP = useFSpyStore((s) => s.calibrationSettings1VP)
  const calibrationSettings2VP = useFSpyStore((s) => s.calibrationSettings2VP)
  const controlPointsStateBase = useFSpyStore((s) => s.controlPointsStateBase)
  const controlPointsState2VP = useFSpyStore((s) => s.controlPointsState2VP)
  const imageState = useFSpyStore((s) => s.image)
  const uiState = useFSpyStore((s) => s.uiState)
  const solverResult = useFSpyStore((s) => s.solverResult)
  const exifData = useFSpyStore((s) => s.exifData)

  // Opt-In Fork States
  const multiLineSolverEnabled = useFSpyStore((s) => s.multiLineSolverEnabled)
  const showResidualErrorHUD = useFSpyStore((s) => s.showResidualErrorHUD)
  const edgeSnappingEnabled = useFSpyStore((s) => s.edgeSnappingEnabled)
  const showDetectedEdgesOverlay = useFSpyStore((s) => s.showDetectedEdgesOverlay)
  const edgeMap = useFSpyStore((s) => s.edgeMap)
  const showThreeMeshOverlay = useFSpyStore((s) => s.showThreeMeshOverlay)
  const threeProxyPreset = useFSpyStore((s) => s.threeProxyPreset)
  const threeProxyTransform = useFSpyStore((s) => s.threeProxyTransform)
  const customModelName = useFSpyStore((s) => s.customModelName)
  const sunShadowConfig = useFSpyStore((s) => s.sunShadowConfig)

  const lensDistortionEnabled = useFSpyStore((s) => s.lensDistortionEnabled)
  const lensK1 = useFSpyStore((s) => s.lensK1)
  const lensK2 = useFSpyStore((s) => s.lensK2)
  const undistortedImageUrl = useFSpyStore((s) => s.undistortedImageUrl)

  const worldRulerEnabled = useFSpyStore((s) => s.worldRulerEnabled)
  const worldRulerPlane = useFSpyStore((s) => s.worldRulerPlane)

  const snapshotSlotsEnabled = useFSpyStore((s) => s.snapshotSlotsEnabled)
  const snapshots = useFSpyStore((s) => s.snapshots)
  const activeSnapshotSlot = useFSpyStore((s) => s.activeSnapshotSlot)
  const autoSaveEnabled = useFSpyStore((s) => s.autoSaveEnabled)

  const sceneBlockout = useFSpyStore((s) => s.sceneBlockout)
  const textureUnwarp = useFSpyStore((s) => s.textureUnwarp)
  const pbrMaterialConfig = useFSpyStore((s) => s.pbrMaterialConfig)
  const parallaxAnimator = useFSpyStore((s) => s.parallaxAnimator)

  const [pbrMaps, setPbrMaps] = useState<PBRGeneratedMaps | null>(null)
  const [recordingVideo, setRecordingVideo] = useState(false)
  const [aiBridgeOpen, setAiBridgeOpen] = useState(false)
  const [aiJsonInput, setAiJsonInput] = useState('')
  const [aiParseError, setAiParseError] = useState<string | null>(null)
  const pbrCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const pbrHoverLightRef = useRef<{ x: number; y: number } | null>(null)

  const setCalibrationMode = useFSpyStore((s) => s.setCalibrationMode)
  const setImageOpacity = useFSpyStore((s) => s.setImageOpacity)
  const setOverlay3DGuide = useFSpyStore((s) => s.setOverlay3DGuide)
  const setFirstVanishingPointAxis = useFSpyStore((s) => s.setFirstVanishingPointAxis)
  const setSecondVanishingPointAxis = useFSpyStore((s) => s.setSecondVanishingPointAxis)
  const setReferenceDistanceAxis = useFSpyStore((s) => s.setReferenceDistanceAxis)
  const setReferenceDistance = useFSpyStore((s) => s.setReferenceDistance)
  const setReferenceDistanceUnit = useFSpyStore((s) => s.setReferenceDistanceUnit)
  const setCameraPreset = useFSpyStore((s) => s.setCameraPreset)
  const setCustomSensorSize = useFSpyStore((s) => s.setCustomSensorSize)
  const setPrincipalPointMode1VP = useFSpyStore((s) => s.setPrincipalPointMode1VP)
  const setAbsoluteFocalLength1VP = useFSpyStore((s) => s.setAbsoluteFocalLength1VP)
  const setPrincipalPointMode2VP = useFSpyStore((s) => s.setPrincipalPointMode2VP)
  const setQuadModeEnabled = useFSpyStore((s) => s.setQuadModeEnabled)
  const applyExifFocalLength = useFSpyStore((s) => s.applyExifFocalLength)

  // Opt-In Actions
  const setMultiLineSolverEnabled = useFSpyStore((s) => s.setMultiLineSolverEnabled)
  const setShowResidualErrorHUD = useFSpyStore((s) => s.setShowResidualErrorHUD)
  const addVPLineSegment = useFSpyStore((s) => s.addVPLineSegment)
  const removeVPLineSegment = useFSpyStore((s) => s.removeVPLineSegment)
  const setEdgeSnappingEnabled = useFSpyStore((s) => s.setEdgeSnappingEnabled)
  const setShowDetectedEdgesOverlay = useFSpyStore((s) => s.setShowDetectedEdgesOverlay)
  const setEdgeMap = useFSpyStore((s) => s.setEdgeMap)
  const applyAutoSuggestedVPLines = useFSpyStore((s) => s.applyAutoSuggestedVPLines)
  const setShowThreeMeshOverlay = useFSpyStore((s) => s.setShowThreeMeshOverlay)
  const setThreeProxyPreset = useFSpyStore((s) => s.setThreeProxyPreset)
  const setThreeProxyTransform = useFSpyStore((s) => s.setThreeProxyTransform)
  const resetThreeProxyTransform = useFSpyStore((s) => s.resetThreeProxyTransform)
  const setCustomModel = useFSpyStore((s) => s.setCustomModel)
  const setSunShadowConfig = useFSpyStore((s) => s.setSunShadowConfig)

  const setLensDistortionEnabled = useFSpyStore((s) => s.setLensDistortionEnabled)
  const setLensDistortionParams = useFSpyStore((s) => s.setLensDistortionParams)
  const autoEstimateLensK1 = useFSpyStore((s) => s.autoEstimateLensK1)

  const setWorldRulerEnabled = useFSpyStore((s) => s.setWorldRulerEnabled)
  const setWorldRulerPlane = useFSpyStore((s) => s.setWorldRulerPlane)

  const setSnapshotSlotsEnabled = useFSpyStore((s) => s.setSnapshotSlotsEnabled)
  const captureSnapshotSlot = useFSpyStore((s) => s.captureSnapshotSlot)
  const restoreSnapshotSlot = useFSpyStore((s) => s.restoreSnapshotSlot)
  const clearSnapshotSlot = useFSpyStore((s) => s.clearSnapshotSlot)
  const setAutoSaveEnabled = useFSpyStore((s) => s.setAutoSaveEnabled)

  const setSceneBlockout = useFSpyStore((s) => s.setSceneBlockout)
  const addBlockoutVolume = useFSpyStore((s) => s.addBlockoutVolume)
  const updateBlockoutVolume = useFSpyStore((s) => s.updateBlockoutVolume)
  const removeBlockoutVolume = useFSpyStore((s) => s.removeBlockoutVolume)
  const addBillboardCutout = useFSpyStore((s) => s.addBillboardCutout)
  const updateBillboardCutout = useFSpyStore((s) => s.updateBillboardCutout)
  const removeBillboardCutout = useFSpyStore((s) => s.removeBillboardCutout)
  const addBillboardPolygonVertex = useFSpyStore(
    (s) => s.addBillboardPolygonVertex
  )
  const removeBillboardPolygonVertex = useFSpyStore(
    (s) => s.removeBillboardPolygonVertex
  )
  const addSweptWallRail = useFSpyStore((s) => s.addSweptWallRail)
  const updateSweptWallRail = useFSpyStore((s) => s.updateSweptWallRail)
  const removeSweptWallRail = useFSpyStore((s) => s.removeSweptWallRail)
  const addSweptRailWaypoint = useFSpyStore((s) => s.addSweptRailWaypoint)
  const removeSweptRailWaypoint = useFSpyStore((s) => s.removeSweptRailWaypoint)
  const addWallParallelCutout = useFSpyStore((s) => s.addWallParallelCutout)
  const updateWallParallelCutout = useFSpyStore(
    (s) => s.updateWallParallelCutout
  )
  const removeWallParallelCutout = useFSpyStore(
    (s) => s.removeWallParallelCutout
  )
  const addWallReliefExtrusion = useFSpyStore((s) => s.addWallReliefExtrusion)
  const updateWallReliefExtrusion = useFSpyStore(
    (s) => s.updateWallReliefExtrusion
  )
  const removeWallReliefExtrusion = useFSpyStore(
    (s) => s.removeWallReliefExtrusion
  )
  const addSweptCylinderColumn = useFSpyStore((s) => s.addSweptCylinderColumn)
  const updateSweptCylinderColumn = useFSpyStore(
    (s) => s.updateSweptCylinderColumn
  )
  const removeSweptCylinderColumn = useFSpyStore(
    (s) => s.removeSweptCylinderColumn
  )
  const addStaircaseExtrusion = useFSpyStore((s) => s.addStaircaseExtrusion)
  const updateStaircaseExtrusion = useFSpyStore(
    (s) => s.updateStaircaseExtrusion
  )
  const removeStaircaseExtrusion = useFSpyStore(
    (s) => s.removeStaircaseExtrusion
  )
  const addFloorPolygonPrism = useFSpyStore((s) => s.addFloorPolygonPrism)
  const updateFloorPolygonPrism = useFSpyStore((s) => s.updateFloorPolygonPrism)
  const removeFloorPolygonPrism = useFSpyStore((s) => s.removeFloorPolygonPrism)
  const addFloorPrismVertex = useFSpyStore((s) => s.addFloorPrismVertex)
  const removeFloorPrismVertex = useFSpyStore((s) => s.removeFloorPrismVertex)
  const addRevolvedLatheObject = useFSpyStore((s) => s.addRevolvedLatheObject)
  const updateRevolvedLatheObject = useFSpyStore(
    (s) => s.updateRevolvedLatheObject
  )
  const removeRevolvedLatheObject = useFSpyStore(
    (s) => s.removeRevolvedLatheObject
  )
  const addCofferedPanelArray = useFSpyStore((s) => s.addCofferedPanelArray)
  const updateCofferedPanelArray = useFSpyStore(
    (s) => s.updateCofferedPanelArray
  )
  const removeCofferedPanelArray = useFSpyStore(
    (s) => s.removeCofferedPanelArray
  )
  const addCurvedArcWall = useFSpyStore((s) => s.addCurvedArcWall)
  const updateCurvedArcWall = useFSpyStore((s) => s.updateCurvedArcWall)
  const removeCurvedArcWall = useFSpyStore((s) => s.removeCurvedArcWall)
  const setTextureUnwarp = useFSpyStore((s) => s.setTextureUnwarp)
  const setPBRMaterialConfig = useFSpyStore((s) => s.setPBRMaterialConfig)
  const setParallaxAnimator = useFSpyStore((s) => s.setParallaxAnimator)
  const showToast = useFSpyStore((s) => s.showToast)

  const is1VPMode = globalSettings.calibrationMode === CalibrationMode.OneVanishingPoint

  const presetId = calibrationSettingsBase.cameraData.presetId
  let presetFocalLength: number | undefined
  if (presetId !== null && cameraPresets[presetId]) {
    presetFocalLength = cameraPresets[presetId].focalLength
  }

  let focalLengthValue = calibrationSettings1VP.absoluteFocalLength
  if (presetFocalLength !== undefined) {
    focalLengthValue = presetFocalLength
  }

  const hasExifInfo =
    exifData && (exifData.make || exifData.model || exifData.focalLength || exifData.focalLength35mm)

  const activeImageSrc =
    lensDistortionEnabled && undistortedImageUrl
      ? undistortedImageUrl
      : imageState.url

  const handleAutoDetectLinesClick = async () => {
    if (!imageState.url) return
    if (!edgeMap) {
      showToast('Detecting architectural edges…')
      const computed = await buildEdgeGradientMap(imageState.url)
      if (computed) {
        setEdgeMap(computed)
      }
    }
    applyAutoSuggestedVPLines()
  }

  const handleExportUndistortedPlate = async () => {
    if (!imageState.url) return
    showToast('Rendering undistorted reference plate…')
    const rendered = await renderUndistortedImage(
      imageState.url,
      lensK1,
      lensK2,
      3840
    )
    if (!rendered) {
      showToast('Failed to render undistorted plate.')
      return
    }
    saveAs(rendered.blob, `undistorted_k1_${lensK1.toFixed(3)}.png`)
    showToast('Exported undistorted plate (.png)')
  }

  const handleExportReconstructedGLB = async () => {
    if (!activeImageSrc || !solverResult.cameraParameters) {
      showToast('Solve valid camera parameters before exporting 3D scene.')
      return
    }
    showToast('Building & exporting textured 3D Scene (.glb)…')
    const ok = await exportReconstructedSceneGLB(
      activeImageSrc,
      sceneBlockout,
      solverResult.cameraParameters,
      uiState.projectName
    )
    if (ok) {
      showToast('Exported camera-projected 3D Scene (.glb)')
    } else {
      showToast('Failed to export .glb scene.')
    }
  }

  const handleDownloadUnwarpedTexture = async () => {
    if (!activeImageSrc) return
    const targetAspect =
      textureUnwarp.aspectPreset === '1:1'
        ? 1
        : textureUnwarp.aspectPreset === '4:3'
          ? 4 / 3
          : textureUnwarp.aspectPreset === '16:9'
            ? 16 / 9
            : textureUnwarp.estimatedAspect

    showToast('Unwarping high-resolution flat surface texture…')
    const res = await renderUnwarpedQuadTexture(
      activeImageSrc,
      textureUnwarp.quad,
      targetAspect,
      2048
    )
    if (!res) {
      showToast('Could not unwarp selected quad.')
      return
    }
    saveAs(res.blob, `fspy_flat_texture_${res.width}x${res.height}.png`)
    showToast(`Exported flat texture (${res.width}×${res.height} .png)`)
  }

  // Synthesize Multi-Scale PBR Maps whenever unwarped preview or PBR settings change
  useEffect(() => {
    if (
      !textureUnwarp.enabled ||
      !pbrMaterialConfig.enabled ||
      !textureUnwarp.previewDataUrl
    ) {
      setPbrMaps(null)
      return
    }

    let cancelled = false
    const timer = window.setTimeout(() => {
      void generatePBRMapsFromUnwarpedUrl(
        textureUnwarp.previewDataUrl!,
        pbrMaterialConfig,
        320
      ).then((generated) => {
        if (!cancelled && generated) {
          setPbrMaps(generated)
        }
      })
    }, 90)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [
    textureUnwarp.enabled,
    textureUnwarp.previewDataUrl,
    pbrMaterialConfig
  ])

  // Real-Time 60fps 3D Point-Light Material Tester Loop
  useEffect(() => {
    if (!pbrMaps || !pbrMaterialConfig.enabled) return
    let rafId = 0
    const startMs = performance.now()

    const animateLight = (now: number) => {
      const canvas = pbrCanvasRef.current
      if (canvas) {
        const hover = pbrHoverLightRef.current
        const elapsedSec = (now - startMs) / 1000
        const lightPos = hover
          ? { x: hover.x, y: hover.y, z: 0.42 }
          : {
              x: Math.cos(elapsedSec * 1.6) * 0.55,
              y: Math.sin(elapsedSec * 1.6) * 0.45,
              z: 0.48
            }
        renderPBRLitPreviewToCanvas(
          canvas,
          pbrMaps,
          lightPos,
          pbrMaterialConfig.previewRepeat
        )
      }
      rafId = requestAnimationFrame(animateLight)
    }

    rafId = requestAnimationFrame(animateLight)
    return () => {
      cancelAnimationFrame(rafId)
    }
  }, [pbrMaps, pbrMaterialConfig.enabled, pbrMaterialConfig.previewRepeat])

  const handleRecordParallaxVideo = () => {
    const glCanvas = document.getElementById(
      'fspy-three-webgl-canvas'
    ) as HTMLCanvasElement | null
    if (!glCanvas || typeof glCanvas.captureStream !== 'function') {
      showToast('WebGL video capture is not supported in this browser')
      return
    }
    if (!solverResult.cameraParameters) {
      showToast('Solve camera calibration before recording 2.5D video')
      return
    }

    setParallaxAnimator({ enabled: true, isPlaying: true, manualPhase: 0 })
    setRecordingVideo(true)
    showToast(`Recording ${parallaxAnimator.durationSec.toFixed(1)}s 2.5D Parallax clip…`)

    try {
      const stream = glCanvas.captureStream(30)
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm'
      const recorder = new MediaRecorder(stream, { mimeType })
      const chunks: BlobPart[] = []
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' })
        const safeName =
          (uiState.projectName || 'fSpy_Scene')
            .replace(/\.fspy$/i, '')
            .replace(/[^a-zA-Z0-9_-]/g, '_') || 'fSpy_Scene'
        saveAs(blob, `${safeName}_2.5D_Parallax.webm`)
        setRecordingVideo(false)
        showToast('Exported 2.5D Parallax Camera Shot (.webm)')
      }
      recorder.start()
      window.setTimeout(
        () => {
          if (recorder.state === 'recording') {
            recorder.stop()
          }
        },
        Math.max(1500, parallaxAnimator.durationSec * 1000)
      )
    } catch {
      setRecordingVideo(false)
      showToast('Failed to record WebM stream')
    }
  }

  const selectedVolume =
    sceneBlockout.volumes.find((v) => v.id === sceneBlockout.selectedVolumeId) ??
    sceneBlockout.volumes[0] ??
    null

  const selectedBillboard =
    sceneBlockout.billboards.find(
      (b) => b.id === sceneBlockout.selectedBillboardId
    ) ??
    sceneBlockout.billboards[0] ??
    null

  const selectedSweptRail =
    sceneBlockout.sweptRails.find(
      (r) => r.id === sceneBlockout.selectedSweptRailId
    ) ??
    sceneBlockout.sweptRails[0] ??
    null

  const selectedWallCutout =
    sceneBlockout.wallCutouts.find(
      (wc) => wc.id === sceneBlockout.selectedWallCutoutId
    ) ??
    sceneBlockout.wallCutouts[0] ??
    null

  const selectedWallRelief =
    sceneBlockout.wallReliefs.find(
      (rel) => rel.id === sceneBlockout.selectedWallReliefId
    ) ??
    sceneBlockout.wallReliefs[0] ??
    null

  const selectedSweptColumn =
    sceneBlockout.sweptColumns.find(
      (col) => col.id === sceneBlockout.selectedSweptColumnId
    ) ??
    sceneBlockout.sweptColumns[0] ??
    null

  const selectedStaircase =
    sceneBlockout.staircases.find(
      (st) => st.id === sceneBlockout.selectedStaircaseId
    ) ??
    sceneBlockout.staircases[0] ??
    null

  const selectedFloorPrism =
    (sceneBlockout.floorPrisms ?? []).find(
      (fp) => fp.id === sceneBlockout.selectedFloorPrismId
    ) ??
    (sceneBlockout.floorPrisms ?? [])[0] ??
    null

  const selectedLatheObject =
    (sceneBlockout.latheObjects ?? []).find(
      (lo) => lo.id === sceneBlockout.selectedLatheObjectId
    ) ??
    (sceneBlockout.latheObjects ?? [])[0] ??
    null

  const selectedCofferedArray =
    (sceneBlockout.cofferedArrays ?? []).find(
      (ca) => ca.id === sceneBlockout.selectedCofferedArrayId
    ) ??
    (sceneBlockout.cofferedArrays ?? [])[0] ??
    null

  const selectedCurvedWall =
    (sceneBlockout.curvedWalls ?? []).find(
      (cw) => cw.id === sceneBlockout.selectedCurvedWallId
    ) ??
    (sceneBlockout.curvedWalls ?? [])[0] ??
    null

  const vp1Count = controlPointsStateBase.firstVanishingPoint.lineSegments.length
  const vp2Count = controlPointsState2VP.secondVanishingPoint.lineSegments.length
  const vp3Count = controlPointsState2VP.thirdVanishingPoint.lineSegments.length

  return (
    <aside className='w-68 shrink-0 bg-[#141418] border-r border-zinc-800/80 flex flex-col h-full overflow-y-auto select-none'>
      {/* Hidden input for custom .glb / .gltf / .obj 3D models */}
      <input
        ref={modelInputRef}
        type='file'
        accept='.glb,.gltf,.obj'
        className='hidden'
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) {
            const ext = file.name.toLowerCase().endsWith('.obj') ? 'obj' : 'glb'
            const objectUrl = URL.createObjectURL(file)
            setCustomModel(objectUrl, ext, file.name)
            showToast(`Loaded 3D proxy mesh "${file.name}"`)
          }
          e.target.value = ''
        }}
      />

      <div className='px-3.5 py-2.5 border-b border-zinc-800/80 flex items-center justify-between'>
        <span className='text-[11px] font-semibold uppercase tracking-wider text-zinc-400'>
          Calibration Setup
        </span>
        <span className='text-[10px] font-mono text-zinc-500'>
          {is1VPMode ? '1-Point' : '2-Point'}
        </span>
      </div>

      {/* Automatic EXIF Metadata Card if detected (Opt-in Apply button) */}
      {hasExifInfo && (
        <div className='mx-3 mt-3 p-2.5 rounded-md bg-amber-500/10 border border-amber-500/25 space-y-1.5'>
          <div className='flex items-center gap-1.5 text-[11px] font-medium text-amber-300'>
            <Camera className='w-3.5 h-3.5 shrink-0 text-amber-400' />
            <span className='truncate'>
              {[exifData.make, exifData.model].filter(Boolean).join(' ') || 'EXIF Metadata Detected'}
            </span>
          </div>
          {(exifData.focalLength || exifData.focalLength35mm) && (
            <div className='flex items-center justify-between gap-2 pt-0.5'>
              <span className='text-[11px] font-mono text-zinc-300 tabular-nums'>
                {exifData.focalLength35mm
                  ? `${exifData.focalLength35mm}mm (35mm eq)`
                  : `${exifData.focalLength}mm`}
              </span>
              {is1VPMode && (
                <button
                  type='button'
                  onClick={applyExifFocalLength}
                  className='inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-[10px] font-medium transition-colors cursor-pointer'
                >
                  <Sparkles className='w-2.5 h-2.5' />
                  Apply
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Mode Switcher */}
      <div className='p-3.5 border-b border-zinc-800/80 space-y-2'>
        <div className='text-[11px] font-semibold uppercase tracking-wider text-zinc-400'>
          Vanishing Points
        </div>
        <div className='grid grid-cols-2 gap-1 p-0.5 rounded-md bg-zinc-900 border border-zinc-800'>
          <button
            type='button'
            onClick={() => setCalibrationMode(CalibrationMode.OneVanishingPoint)}
            className={`py-1 text-xs font-medium rounded transition-colors cursor-pointer ${
              is1VPMode
                ? 'bg-zinc-800 text-amber-400 shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            1 Vanishing Pt
          </button>
          <button
            type='button'
            onClick={() => setCalibrationMode(CalibrationMode.TwoVanishingPoints)}
            className={`py-1 text-xs font-medium rounded transition-colors cursor-pointer ${
              !is1VPMode
                ? 'bg-zinc-800 text-amber-400 shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            2 Vanishing Pts
          </button>
        </div>
      </div>

      {/* Vanishing Point Axes */}
      <div className='p-3.5 border-b border-zinc-800/80 space-y-2.5'>
        <div className='text-[11px] font-semibold uppercase tracking-wider text-zinc-400'>
          Vanishing Point Axes
        </div>
        <div className='space-y-2'>
          <div className='flex items-center gap-2'>
            <span className='w-4 text-xs font-mono text-zinc-400 text-center'>1</span>
            <div className='flex-1'>
              <AxisDropdown
                selectedAxis={calibrationSettingsBase.firstVanishingPointAxis}
                onChange={setFirstVanishingPointAxis}
              />
            </div>
          </div>
          <div className='flex items-center gap-2'>
            <span className='w-4 text-xs font-mono text-zinc-400 text-center'>2</span>
            <div className='flex-1'>
              <AxisDropdown
                selectedAxis={calibrationSettingsBase.secondVanishingPointAxis}
                onChange={setSecondVanishingPointAxis}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Reference Distance */}
      <div className='p-3.5 border-b border-zinc-800/80 space-y-2'>
        <div className='text-[11px] font-semibold uppercase tracking-wider text-zinc-400'>
          Reference Distance
        </div>
        <ReferenceDistanceForm
          referenceAxis={calibrationSettingsBase.referenceDistanceAxis}
          referenceDistance={calibrationSettingsBase.referenceDistance}
          referenceDistanceUnit={calibrationSettingsBase.referenceDistanceUnit}
          onReferenceAxisChange={setReferenceDistanceAxis}
          onReferenceDistanceChange={setReferenceDistance}
          onReferenceDistanceUnitChange={setReferenceDistanceUnit}
        />
      </div>

      {/* Mode Specific Settings */}
      {is1VPMode ? (
        <>
          <div className='p-3.5 border-b border-zinc-800/80 space-y-2'>
            <div className='text-[11px] font-semibold uppercase tracking-wider text-zinc-400'>
              Principal Point
            </div>
            <Dropdown
              options={[
                {
                  value: PrincipalPointMode1VP.Default,
                  id: PrincipalPointMode1VP.Default,
                  title: 'Image midpoint',
                  circleColor: Palette.principalPointColor,
                  strokeCircle: true
                },
                {
                  value: PrincipalPointMode1VP.Manual,
                  id: PrincipalPointMode1VP.Manual,
                  title: PrincipalPointMode1VP.Manual,
                  circleColor: Palette.principalPointColor
                }
              ]}
              selectedOptionId={calibrationSettings1VP.principalPointMode}
              onOptionSelected={(selectedValue: PrincipalPointMode1VP) => {
                setPrincipalPointMode1VP(selectedValue)
              }}
            />
          </div>
          <div className='p-3.5 border-b border-zinc-800/80 space-y-2.5'>
            <div className='text-[11px] font-semibold uppercase tracking-wider text-zinc-400'>
              Camera Sensor &amp; Lens
            </div>
            <CameraPresetForm
              cameraData={calibrationSettingsBase.cameraData}
              absoluteFocalLength={calibrationSettings1VP.absoluteFocalLength}
              onCameraPresetChange={setCameraPreset}
              onSensorSizeChange={setCustomSensorSize}
            >
              <div className='space-y-2 pt-1'>
                <div className='flex items-center justify-between gap-2'>
                  <span className='text-xs text-zinc-400'>Focal length (mm)</span>
                  <div className='w-24'>
                    <NumericInputField
                      precision={2}
                      isDisabled={presetFocalLength !== undefined}
                      value={focalLengthValue}
                      onSubmit={setAbsoluteFocalLength1VP}
                    />
                  </div>
                </div>
                <input
                  disabled={presetFocalLength !== undefined}
                  type='range'
                  min='10'
                  max='200'
                  step='0.5'
                  value={focalLengthValue}
                  onChange={(event) => {
                    setAbsoluteFocalLength1VP(parseFloat(event.target.value))
                  }}
                />
              </div>
            </CameraPresetForm>
          </div>
        </>
      ) : (
        <>
          <div className='p-3.5 border-b border-zinc-800/80 space-y-2'>
            <div className='text-[11px] font-semibold uppercase tracking-wider text-zinc-400'>
              Principal Point
            </div>
            <Dropdown
              options={[
                {
                  value: PrincipalPointMode2VP.Default,
                  id: PrincipalPointMode2VP.Default,
                  title: 'Image midpoint',
                  circleColor: Palette.principalPointColor,
                  strokeCircle: true
                },
                {
                  value: PrincipalPointMode2VP.Manual,
                  id: PrincipalPointMode2VP.Manual,
                  title: PrincipalPointMode2VP.Manual,
                  circleColor: Palette.principalPointColor
                },
                {
                  value: PrincipalPointMode2VP.FromThirdVanishingPoint,
                  id: PrincipalPointMode2VP.FromThirdVanishingPoint,
                  title: 'From 3rd vanishing point',
                  circleColor: Palette.principalPointColor,
                  strokeCircle: true
                }
              ]}
              selectedOptionId={calibrationSettings2VP.principalPointMode}
              onOptionSelected={(selectedValue: PrincipalPointMode2VP) => {
                setPrincipalPointMode2VP(selectedValue)
              }}
            />
          </div>
          <div className='p-3.5 border-b border-zinc-800/80'>
            <Checkbox
              title='Rectangle mode (Quad)'
              isSelected={calibrationSettings2VP.quadModeEnabled}
              onChange={(isSelected: boolean) => setQuadModeEnabled(isSelected)}
            />
          </div>
        </>
      )}

      {/* Classic 3D Guide & Image Dimming */}
      <div className='p-3.5 border-b border-zinc-800/80 space-y-2.5'>
        <div className='text-[11px] font-semibold uppercase tracking-wider text-zinc-400'>
          Viewport Overlay
        </div>
        <Overlay3DGuideDropdown
          overlay3DGuide={globalSettings.overlay3DGuide}
          onChange={(overlay3DGuide: Overlay3DGuide) => {
            setOverlay3DGuide(overlay3DGuide)
          }}
        />
        <div className='pt-1'>
          <Checkbox
            title='Dim backdrop image'
            isSelected={globalSettings.imageOpacity < 1}
            onChange={(checked: boolean) => {
              setImageOpacity(checked ? 0.25 : 1)
            }}
          />
        </div>
        <div className='space-y-1 pt-1'>
          <div className='flex items-center justify-between text-[11px] text-zinc-400'>
            <span>Image opacity</span>
            <span className='font-mono tabular-nums text-zinc-300'>
              {Math.round(globalSettings.imageOpacity * 100)}%
            </span>
          </div>
          <input
            type='range'
            min='0.05'
            max='1'
            step='0.05'
            value={globalSettings.imageOpacity}
            onChange={(e) => setImageOpacity(parseFloat(e.target.value))}
          />
        </div>
      </div>

      {/* ===================================================================== */}
      {/* OPT-IN STUDIO EXTENSIONS (All strictly opt-in, disabled by default)   */}
      {/* ===================================================================== */}
      <div className='p-3.5 space-y-3 bg-[#101014]'>
        <div className='flex items-center justify-between'>
          <span className='text-[11px] font-semibold uppercase tracking-wider text-amber-400/90 flex items-center gap-1.5'>
            <Sliders className='w-3 h-3' />
            <span>Studio Extensions (Opt-In)</span>
          </span>
        </div>

        {/* NEW: Photo-to-3D Scene Builder, Camera-Projection & Free 3D Orbit */}
        <div className='rounded-lg border border-sky-500/30 bg-sky-950/15 p-2.5 space-y-2.5'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-1.5 text-[11px] font-semibold text-sky-300'>
              <Layers className='w-3.5 h-3.5 text-sky-400' />
              <span>Photo-to-3D Scene Builder</span>
            </div>
            <span className='text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300'>
              3D Map
            </span>
          </div>

          <Checkbox
            title='Enable 3D room & box builder'
            isSelected={sceneBlockout.enabled}
            onChange={(enabled) => setSceneBlockout({ enabled })}
          />

          {sceneBlockout.enabled && (
            <div className='pt-2 border-t border-zinc-800/80 space-y-2.5'>
              {/* Free 3D Orbit Inspection Button */}
              <button
                type='button'
                onClick={() =>
                  setSceneBlockout({
                    freeOrbitMode: !sceneBlockout.freeOrbitMode
                  })
                }
                className={`w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer ${
                  sceneBlockout.freeOrbitMode
                    ? 'bg-sky-500 text-zinc-950'
                    : 'bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 border border-sky-500/40'
                }`}
              >
                <Orbit className='w-3.5 h-3.5' />
                <span>
                  {sceneBlockout.freeOrbitMode
                    ? 'Exit Free 3D Orbit View'
                    : 'Inspect in Free 3D Orbit'}
                </span>
              </button>

              <Checkbox
                title='Project photo onto 3D surfaces'
                isSelected={sceneBlockout.projectPhotoTexture}
                onChange={(projectPhotoTexture) =>
                  setSceneBlockout({ projectPhotoTexture })
                }
              />
              <Checkbox
                title='Direct viewport 3D box handles'
                isSelected={sceneBlockout.showViewportHandles}
                onChange={(showViewportHandles) =>
                  setSceneBlockout({ showViewportHandles })
                }
              />
              <Checkbox
                title='Show 3D structural wireframes'
                isSelected={sceneBlockout.wireframeOverlay}
                onChange={(wireframeOverlay) =>
                  setSceneBlockout({ wireframeOverlay })
                }
              />

              {/* Opt-In #3: Automatic Foreground Occlusion Inpainting (Background De-Ghosting) */}
              <div className='pt-1.5 border-t border-zinc-800/80 space-y-1.5'>
                <Checkbox
                  title='Inpaint background behind 3D objects'
                  isSelected={sceneBlockout.inpaintOccludedBackground}
                  onChange={(inpaintOccludedBackground) =>
                    setSceneBlockout({ inpaintOccludedBackground })
                  }
                />
                {sceneBlockout.inpaintOccludedBackground && (
                  <div className='flex items-center gap-2 text-[11px] pl-1'>
                    <span
                      className='w-16 text-zinc-400'
                      title='Extra margin (in pixels) around foreground silhouettes to erase edge halos'
                    >
                      Margin
                    </span>
                    <input
                      type='range'
                      min={2}
                      max={18}
                      step={1}
                      value={sceneBlockout.inpaintDilationPx}
                      onChange={(e) =>
                        setSceneBlockout({
                          inpaintDilationPx: parseInt(e.target.value, 10)
                        })
                      }
                    />
                    <span className='w-8 text-right font-mono tabular-nums text-zinc-300'>
                      {sceneBlockout.inpaintDilationPx}px
                    </span>
                  </div>
                )}
              </div>

              {/* Room / Stage Shell Controls */}
              <div className='pt-1.5 border-t border-zinc-800/80 space-y-1.5'>
                <span className='text-[11px] font-medium text-zinc-300 block'>
                  3D Room / Stage Walls
                </span>
                <select
                  value={sceneBlockout.roomShellType}
                  onChange={(e) =>
                    setSceneBlockout({
                      roomShellType: e.target.value as RoomShellType
                    })
                  }
                  className='w-full bg-zinc-900 border border-zinc-700/80 rounded-md px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-sky-500'
                >
                  <option value='corner-stage'>
                    Corner Stage (Floor + 2 Walls)
                  </option>
                  <option value='interior-room'>
                    5-Wall Interior Room Shell
                  </option>
                  <option value='none'>No Room Shell (Boxes Only)</option>
                </select>

                {sceneBlockout.roomShellType !== 'none' && (
                  <div className='space-y-1.5 pt-1'>
                    <div className='flex items-center gap-2 text-[11px]'>
                      <span className='w-11 text-zinc-400'>Width X</span>
                      <input
                        type='range'
                        min={1}
                        max={12}
                        step={0.2}
                        value={sceneBlockout.roomWidthX}
                        onChange={(e) =>
                          setSceneBlockout({
                            roomWidthX: parseFloat(e.target.value)
                          })
                        }
                      />
                      <span className='w-8 text-right font-mono tabular-nums text-zinc-300'>
                        {sceneBlockout.roomWidthX.toFixed(1)}
                      </span>
                    </div>

                    <div className='flex items-center gap-2 text-[11px]'>
                      <span className='w-11 text-zinc-400'>Depth Y</span>
                      <input
                        type='range'
                        min={1}
                        max={12}
                        step={0.2}
                        value={sceneBlockout.roomDepthY}
                        onChange={(e) =>
                          setSceneBlockout({
                            roomDepthY: parseFloat(e.target.value)
                          })
                        }
                      />
                      <span className='w-8 text-right font-mono tabular-nums text-zinc-300'>
                        {sceneBlockout.roomDepthY.toFixed(1)}
                      </span>
                    </div>

                    <div className='flex items-center gap-2 text-[11px]'>
                      <span className='w-11 text-zinc-400'>Height Z</span>
                      <input
                        type='range'
                        min={1}
                        max={8}
                        step={0.2}
                        value={sceneBlockout.roomHeightZ}
                        onChange={(e) =>
                          setSceneBlockout({
                            roomHeightZ: parseFloat(e.target.value)
                          })
                        }
                      />
                      <span className='w-8 text-right font-mono tabular-nums text-zinc-300'>
                        {sceneBlockout.roomHeightZ.toFixed(1)}
                      </span>
                    </div>

                    {/* Optional Enclosed Ceiling Plane & Overhead Soffit Cross-Beams */}
                    <div className='pt-1.5 mt-1 border-t border-zinc-800/70 space-y-1.5'>
                      <div className='flex items-center justify-between'>
                        <Checkbox
                          title='Close Ceiling Plane (Optional)'
                          isSelected={sceneBlockout.ceilingClosureEnabled}
                          onChange={(ceilingClosureEnabled) =>
                            setSceneBlockout({ ceilingClosureEnabled })
                          }
                        />
                        <span className='text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300'>
                          Optional
                        </span>
                      </div>

                      {sceneBlockout.ceilingClosureEnabled && (
                        <div className='space-y-1.5 pl-1 bg-zinc-950/60 p-1.5 rounded border border-sky-500/20'>
                          <div className='flex items-center justify-between text-[10.5px]'>
                            <span className='text-zinc-400'>Ceiling Shape</span>
                            <select
                              value={sceneBlockout.ceilingProfile ?? 'flat'}
                              onChange={(e) =>
                                setSceneBlockout({
                                  ceilingProfile: e.target
                                    .value as CeilingProfileType
                                })
                              }
                              className='bg-zinc-900 border border-zinc-700/80 rounded px-1.5 py-1 text-[10.5px] text-zinc-200'
                            >
                              <option value='flat'>Flat Horizontal</option>
                              <option value='barrel-vault'>
                                3D Barrel Vault (Curved Tunnel)
                              </option>
                              <option value='pitched-gable'>
                                Pitched Gable (A-Frame Roof)
                              </option>
                            </select>
                          </div>

                          {(sceneBlockout.ceilingProfile ?? 'flat') !==
                            'flat' && (
                            <div className='flex items-center gap-2 text-[11px]'>
                              <span
                                className='w-16 text-zinc-400'
                                title='Apex height of the barrel vault arch or pitched gable roof ridge above the wall top'
                              >
                                Vault Rise
                              </span>
                              <input
                                type='range'
                                min={0.15}
                                max={2.5}
                                step={0.05}
                                value={sceneBlockout.ceilingVaultRise ?? 0.65}
                                onChange={(e) =>
                                  setSceneBlockout({
                                    ceilingVaultRise: parseFloat(e.target.value)
                                  })
                                }
                              />
                              <span className='w-10 text-right font-mono tabular-nums text-sky-300'>
                                {(
                                  sceneBlockout.ceilingVaultRise ?? 0.65
                                ).toFixed(2)}
                                m
                              </span>
                            </div>
                          )}

                          <div className='flex items-center gap-2 text-[11px]'>
                            <span
                              className='w-16 text-zinc-400'
                              title='Number of 3D overhead cross-beams or curved vault ribs hanging from the ceiling'
                            >
                              Beams / Ribs
                            </span>
                            <input
                              type='range'
                              min={0}
                              max={8}
                              step={1}
                              value={sceneBlockout.ceilingBeamCount}
                              onChange={(e) =>
                                setSceneBlockout({
                                  ceilingBeamCount: parseInt(e.target.value, 10)
                                })
                              }
                            />
                            <span className='w-8 text-right font-mono tabular-nums text-sky-300'>
                              {sceneBlockout.ceilingBeamCount}
                            </span>
                          </div>

                          {sceneBlockout.ceilingBeamCount > 0 && (
                            <div className='flex items-center gap-2 text-[11px]'>
                              <span className='w-16 text-zinc-400'>
                                Beam Drop
                              </span>
                              <input
                                type='range'
                                min={0.05}
                                max={0.55}
                                step={0.02}
                                value={sceneBlockout.ceilingBeamDrop}
                                onChange={(e) =>
                                  setSceneBlockout({
                                    ceilingBeamDrop: parseFloat(e.target.value)
                                  })
                                }
                              />
                              <span className='w-10 text-right font-mono tabular-nums text-zinc-300'>
                                {sceneBlockout.ceilingBeamDrop.toFixed(2)}m
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Optional 1-Click Mitered 3D Baseboard, Chair-Rail & Crown Molding Sweeper */}
                    <div className='pt-1.5 mt-1 border-t border-zinc-800/70 space-y-1.5'>
                      <div className='flex items-center justify-between'>
                        <Checkbox
                          title='3D Baseboard & Crown Trim (Optional)'
                          isSelected={
                            sceneBlockout.perimeterMoldingsEnabled ?? false
                          }
                          onChange={(perimeterMoldingsEnabled) =>
                            setSceneBlockout({ perimeterMoldingsEnabled })
                          }
                        />
                        <span className='text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300'>
                          Optional
                        </span>
                      </div>

                      {(sceneBlockout.perimeterMoldingsEnabled ?? false) && (
                        <div className='space-y-1.5 pl-1 bg-zinc-950/60 p-1.5 rounded border border-amber-500/20'>
                          <p className='text-[9.5px] text-zinc-400 leading-snug'>
                            Sweeps 3D trim profiles along active room walls with{' '}
                            <strong className='text-amber-200'>
                              45° corner miters
                            </strong>{' '}
                            & doorway gap clipping.
                          </p>

                          <Checkbox
                            title='Sweep 3D baseboard skirting'
                            isSelected={sceneBlockout.baseboardEnabled ?? true}
                            onChange={(baseboardEnabled) =>
                              setSceneBlockout({ baseboardEnabled })
                            }
                          />

                          {(sceneBlockout.baseboardEnabled ?? true) && (
                            <>
                              <div className='flex items-center justify-between text-[10.5px]'>
                                <span className='text-zinc-400'>
                                  Base Profile
                                </span>
                                <select
                                  value={
                                    sceneBlockout.baseboardProfile ??
                                    'stepped-skirting'
                                  }
                                  onChange={(e) =>
                                    setSceneBlockout({
                                      baseboardProfile: e.target
                                        .value as BaseboardProfileType
                                    })
                                  }
                                  className='bg-zinc-900 border border-zinc-700/80 rounded px-1.5 py-1 text-[10.5px] text-zinc-200'
                                >
                                  <option value='stepped-skirting'>
                                    Stepped Skirting Board
                                  </option>
                                  <option value='beveled-plinth'>
                                    Beveled Plinth Trim
                                  </option>
                                  <option value='tall-wainscot'>
                                    Tall Wainscot Cap + Base
                                  </option>
                                </select>
                              </div>

                              <div className='flex items-center gap-2 text-[11px]'>
                                <span className='w-16 text-zinc-400'>
                                  Base H
                                </span>
                                <input
                                  type='range'
                                  min={0.06}
                                  max={0.5}
                                  step={0.02}
                                  value={sceneBlockout.baseboardHeight ?? 0.16}
                                  onChange={(e) =>
                                    setSceneBlockout({
                                      baseboardHeight: parseFloat(
                                        e.target.value
                                      )
                                    })
                                  }
                                />
                                <span className='w-11 text-right font-mono tabular-nums text-amber-300'>
                                  {(
                                    sceneBlockout.baseboardHeight ?? 0.16
                                  ).toFixed(2)}
                                  m
                                </span>
                              </div>
                            </>
                          )}

                          <Checkbox
                            title='Sweep 3D ceiling crown molding'
                            isSelected={
                              sceneBlockout.crownMoldingEnabled ?? true
                            }
                            onChange={(crownMoldingEnabled) =>
                              setSceneBlockout({ crownMoldingEnabled })
                            }
                          />

                          {(sceneBlockout.crownMoldingEnabled ?? true) && (
                            <>
                              <div className='flex items-center justify-between text-[10.5px]'>
                                <span className='text-zinc-400'>
                                  Crown Profile
                                </span>
                                <select
                                  value={
                                    sceneBlockout.crownProfile ?? 'ogee-cornice'
                                  }
                                  onChange={(e) =>
                                    setSceneBlockout({
                                      crownProfile: e.target
                                        .value as CrownMoldingProfileType
                                    })
                                  }
                                  className='bg-zinc-900 border border-zinc-700/80 rounded px-1.5 py-1 text-[10.5px] text-zinc-200'
                                >
                                  <option value='ogee-cornice'>
                                    Stepped Ogee Cornice
                                  </option>
                                  <option value='stepped-coving'>
                                    Box Coving Soffit
                                  </option>
                                  <option value='led-cove-tray'>
                                    Recessed Tray Lip
                                  </option>
                                </select>
                              </div>

                              <div className='flex items-center gap-2 text-[11px]'>
                                <span className='w-16 text-zinc-400'>
                                  Crown Drop
                                </span>
                                <input
                                  type='range'
                                  min={0.06}
                                  max={0.45}
                                  step={0.02}
                                  value={sceneBlockout.crownDropHeight ?? 0.16}
                                  onChange={(e) =>
                                    setSceneBlockout({
                                      crownDropHeight: parseFloat(
                                        e.target.value
                                      ),
                                      crownProjection: parseFloat(
                                        e.target.value
                                      )
                                    })
                                  }
                                />
                                <span className='w-11 text-right font-mono tabular-nums text-amber-300'>
                                  {(
                                    sceneBlockout.crownDropHeight ?? 0.16
                                  ).toFixed(2)}
                                  m
                                </span>
                              </div>
                            </>
                          )}

                          <Checkbox
                            title='Add waist-height chair rail trim'
                            isSelected={sceneBlockout.chairRailEnabled ?? false}
                            onChange={(chairRailEnabled) =>
                              setSceneBlockout({ chairRailEnabled })
                            }
                          />

                          {(sceneBlockout.chairRailEnabled ?? false) && (
                            <div className='flex items-center gap-2 text-[11px]'>
                              <span className='w-16 text-zinc-400'>
                                Rail Z Ht
                              </span>
                              <input
                                type='range'
                                min={0.5}
                                max={1.5}
                                step={0.05}
                                value={sceneBlockout.chairRailHeightZ ?? 0.95}
                                onChange={(e) =>
                                  setSceneBlockout({
                                    chairRailHeightZ: parseFloat(e.target.value)
                                  })
                                }
                              />
                              <span className='w-11 text-right font-mono tabular-nums text-amber-300'>
                                {(
                                  sceneBlockout.chairRailHeightZ ?? 0.95
                                ).toFixed(2)}
                                m
                              </span>
                            </div>
                          )}

                          <Checkbox
                            title='Auto-clip trim at floor-level doorways'
                            isSelected={
                              sceneBlockout.clipMoldingsAtPortals ?? true
                            }
                            onChange={(clipMoldingsAtPortals) =>
                              setSceneBlockout({ clipMoldingsAtPortals })
                            }
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Extruded 3D Boxes / Volumes */}
              <div className='pt-1.5 border-t border-zinc-800/80 space-y-2'>
                <div className='flex items-center justify-between'>
                  <span className='text-[11px] font-medium text-zinc-300'>
                    3D Boxes ({sceneBlockout.volumes.length})
                  </span>
                  <div className='flex items-center gap-1'>
                    <button
                      type='button'
                      onClick={() =>
                        setSceneBlockout({
                          interactiveDrawMode: !sceneBlockout.interactiveDrawMode,
                          freeOrbitMode: false
                        })
                      }
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium cursor-pointer ${
                        sceneBlockout.interactiveDrawMode
                          ? 'bg-sky-500 text-zinc-950'
                          : 'bg-zinc-800 hover:bg-zinc-700 text-sky-300'
                      }`}
                      title='Click and drag on the photo floor to draw a new 3D box'
                    >
                      <MousePointerClick className='w-3 h-3' />
                      <span>Draw</span>
                    </button>
                    <button
                      type='button'
                      onClick={() => addBlockoutVolume()}
                      className='inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[10px] font-medium cursor-pointer'
                    >
                      <Plus className='w-3 h-3' />
                      <span>Add</span>
                    </button>
                  </div>
                </div>

                {sceneBlockout.volumes.length > 0 && selectedVolume && (
                  <div className='space-y-1.5 bg-zinc-950/60 p-2 rounded border border-zinc-800/90'>
                    <div className='flex items-center gap-1'>
                      <select
                        value={selectedVolume.id}
                        onChange={(e) =>
                          setSceneBlockout({ selectedVolumeId: e.target.value })
                        }
                        className='flex-1 bg-zinc-900 border border-zinc-700/80 rounded px-1.5 py-1 text-[11px] text-zinc-200 focus:outline-none'
                      >
                        {sceneBlockout.volumes.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type='button'
                        onClick={() => removeBlockoutVolume(selectedVolume.id)}
                        className='p-1 rounded text-zinc-400 hover:text-red-400 hover:bg-zinc-800 cursor-pointer'
                        title='Delete selected 3D Box'
                      >
                        <Trash2 className='w-3.5 h-3.5' />
                      </button>
                    </div>

                    <div className='flex items-center gap-2 text-[11px]'>
                      <span className='w-10 text-zinc-400'>Size X</span>
                      <input
                        type='range'
                        min={0.2}
                        max={6}
                        step={0.1}
                        value={selectedVolume.widthX}
                        onChange={(e) =>
                          updateBlockoutVolume(selectedVolume.id, {
                            widthX: parseFloat(e.target.value)
                          })
                        }
                      />
                      <span className='w-8 text-right font-mono tabular-nums text-zinc-300'>
                        {selectedVolume.widthX.toFixed(1)}
                      </span>
                    </div>

                    <div className='flex items-center gap-2 text-[11px]'>
                      <span className='w-10 text-zinc-400'>Size Y</span>
                      <input
                        type='range'
                        min={0.2}
                        max={6}
                        step={0.1}
                        value={selectedVolume.depthY}
                        onChange={(e) =>
                          updateBlockoutVolume(selectedVolume.id, {
                            depthY: parseFloat(e.target.value)
                          })
                        }
                      />
                      <span className='w-8 text-right font-mono tabular-nums text-zinc-300'>
                        {selectedVolume.depthY.toFixed(1)}
                      </span>
                    </div>

                    <div className='flex items-center gap-2 text-[11px]'>
                      <span className='w-10 text-zinc-400'>Height</span>
                      <input
                        type='range'
                        min={0.2}
                        max={6}
                        step={0.1}
                        value={selectedVolume.heightZ}
                        onChange={(e) =>
                          updateBlockoutVolume(selectedVolume.id, {
                            heightZ: parseFloat(e.target.value)
                          })
                        }
                      />
                      <span className='w-8 text-right font-mono tabular-nums text-zinc-300'>
                        {selectedVolume.heightZ.toFixed(1)}
                      </span>
                    </div>

                    <div className='flex items-center gap-2 text-[11px]'>
                      <span className='w-10 text-red-400 font-mono'>Pos X</span>
                      <input
                        type='range'
                        min={-6}
                        max={6}
                        step={0.1}
                        value={selectedVolume.offsetX}
                        onChange={(e) =>
                          updateBlockoutVolume(selectedVolume.id, {
                            offsetX: parseFloat(e.target.value)
                          })
                        }
                      />
                      <span className='w-8 text-right font-mono tabular-nums text-zinc-300'>
                        {selectedVolume.offsetX.toFixed(1)}
                      </span>
                    </div>

                    <div className='flex items-center gap-2 text-[11px]'>
                      <span className='w-10 text-emerald-400 font-mono'>Pos Y</span>
                      <input
                        type='range'
                        min={-6}
                        max={6}
                        step={0.1}
                        value={selectedVolume.offsetY}
                        onChange={(e) =>
                          updateBlockoutVolume(selectedVolume.id, {
                            offsetY: parseFloat(e.target.value)
                          })
                        }
                      />
                      <span className='w-8 text-right font-mono tabular-nums text-zinc-300'>
                        {selectedVolume.offsetY.toFixed(1)}
                      </span>
                    </div>

                    <div className='flex items-center gap-2 text-[11px]'>
                      <span className='w-10 text-blue-400 font-mono'>Elev Z</span>
                      <input
                        type='range'
                        min={-2}
                        max={4}
                        step={0.1}
                        value={selectedVolume.offsetZ}
                        onChange={(e) =>
                          updateBlockoutVolume(selectedVolume.id, {
                            offsetZ: parseFloat(e.target.value)
                          })
                        }
                      />
                      <span className='w-8 text-right font-mono tabular-nums text-zinc-300'>
                        {selectedVolume.offsetZ.toFixed(1)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Opt-In #2: 3D Alpha-Masked Cutout Billboards (Standees for People, Trees, Curved Props) */}
              <div className='pt-1.5 border-t border-zinc-800/80 space-y-2'>
                <div className='flex items-center justify-between'>
                  <span className='text-[11px] font-medium text-emerald-300'>
                    3D Cutout Billboards ({sceneBlockout.billboards.length})
                  </span>
                  <button
                    type='button'
                    onClick={() => addBillboardCutout()}
                    className='inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/35 text-emerald-200 text-[10px] font-medium cursor-pointer'
                  >
                    <Plus className='w-3 h-3' />
                    <span>Add Cutout</span>
                  </button>
                </div>

                <Checkbox
                  title='Enable alpha-masked 3D standees'
                  isSelected={sceneBlockout.billboardsEnabled}
                  onChange={(billboardsEnabled) =>
                    setSceneBlockout({ billboardsEnabled })
                  }
                />

                {sceneBlockout.billboardsEnabled &&
                  sceneBlockout.billboards.length > 0 &&
                  selectedBillboard && (
                    <div className='space-y-1.5 bg-zinc-950/60 p-2 rounded border border-emerald-500/25'>
                      <div className='flex items-center gap-1'>
                        <select
                          value={selectedBillboard.id}
                          onChange={(e) =>
                            setSceneBlockout({
                              selectedBillboardId: e.target.value
                            })
                          }
                          className='flex-1 bg-zinc-900 border border-zinc-700/80 rounded px-1.5 py-1 text-[11px] text-zinc-200 focus:outline-none'
                        >
                          {sceneBlockout.billboards.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type='button'
                          onClick={() =>
                            removeBillboardCutout(selectedBillboard.id)
                          }
                          className='p-1 rounded text-zinc-400 hover:text-red-400 hover:bg-zinc-800 cursor-pointer'
                          title='Delete selected 3D Cutout Billboard'
                        >
                          <Trash2 className='w-3.5 h-3.5' />
                        </button>
                      </div>

                      <div className='flex items-center justify-between text-[11px] pt-0.5'>
                        <span className='text-zinc-400'>
                          Mask vertices ({selectedBillboard.polygonRel.length}/12)
                        </span>
                        <div className='flex items-center gap-1'>
                          <button
                            type='button'
                            disabled={selectedBillboard.polygonRel.length <= 4}
                            onClick={() =>
                              removeBillboardPolygonVertex(selectedBillboard.id)
                            }
                            className='p-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 text-zinc-200 cursor-pointer'
                            title='Remove polygon vertex'
                          >
                            <Minus className='w-3 h-3' />
                          </button>
                          <button
                            type='button'
                            disabled={selectedBillboard.polygonRel.length >= 12}
                            onClick={() =>
                              addBillboardPolygonVertex(selectedBillboard.id)
                            }
                            className='p-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 text-zinc-200 cursor-pointer'
                            title='Add polygon vertex'
                          >
                            <Plus className='w-3 h-3' />
                          </button>
                        </div>
                      </div>

                      <Checkbox
                        title='Auto-fit 3D floor pos from mask'
                        isSelected={selectedBillboard.autoFitFromPolygon}
                        onChange={(autoFitFromPolygon) =>
                          updateBillboardCutout(selectedBillboard.id, {
                            autoFitFromPolygon
                          })
                        }
                      />
                      <Checkbox
                        title='Always face camera in 3D'
                        isSelected={selectedBillboard.faceCamera}
                        onChange={(faceCamera) =>
                          updateBillboardCutout(selectedBillboard.id, {
                            faceCamera
                          })
                        }
                      />

                      <div className='flex items-center gap-2 text-[11px]'>
                        <span className='w-12 text-zinc-400'>Feather</span>
                        <input
                          type='range'
                          min={0}
                          max={8}
                          step={0.5}
                          value={selectedBillboard.featherPx}
                          onChange={(e) =>
                            updateBillboardCutout(selectedBillboard.id, {
                              featherPx: parseFloat(e.target.value)
                            })
                          }
                        />
                        <span className='w-8 text-right font-mono tabular-nums text-zinc-300'>
                          {selectedBillboard.featherPx.toFixed(1)}px
                        </span>
                      </div>

                      <div className='flex items-center gap-2 text-[11px]'>
                        <span className='w-12 text-red-400 font-mono'>
                          Base X
                        </span>
                        <input
                          type='range'
                          min={-6}
                          max={6}
                          step={0.1}
                          value={selectedBillboard.baseX}
                          onChange={(e) =>
                            updateBillboardCutout(selectedBillboard.id, {
                              baseX: parseFloat(e.target.value),
                              autoFitFromPolygon: false
                            })
                          }
                        />
                        <span className='w-8 text-right font-mono tabular-nums text-zinc-300'>
                          {selectedBillboard.baseX.toFixed(1)}
                        </span>
                      </div>

                      <div className='flex items-center gap-2 text-[11px]'>
                        <span className='w-12 text-emerald-400 font-mono'>
                          Base Y
                        </span>
                        <input
                          type='range'
                          min={-6}
                          max={6}
                          step={0.1}
                          value={selectedBillboard.baseY}
                          onChange={(e) =>
                            updateBillboardCutout(selectedBillboard.id, {
                              baseY: parseFloat(e.target.value),
                              autoFitFromPolygon: false
                            })
                          }
                        />
                        <span className='w-8 text-right font-mono tabular-nums text-zinc-300'>
                          {selectedBillboard.baseY.toFixed(1)}
                        </span>
                      </div>

                      <div className='flex items-center gap-2 text-[11px]'>
                        <span className='w-12 text-zinc-400'>Height</span>
                        <input
                          type='range'
                          min={0.3}
                          max={6}
                          step={0.1}
                          value={selectedBillboard.height}
                          onChange={(e) =>
                            updateBillboardCutout(selectedBillboard.id, {
                              height: parseFloat(e.target.value),
                              autoFitFromPolygon: false
                            })
                          }
                        />
                        <span className='w-8 text-right font-mono tabular-nums text-zinc-300'>
                          {selectedBillboard.height.toFixed(1)}m
                        </span>
                      </div>
                    </div>
                  )}
              </div>

              {/* Opt-In #4: Hallway & Architectural Wall Details (7 Optional Specialized Tools) */}
              <div className='pt-2 border-t border-zinc-800/80 space-y-2.5'>
                <div className='rounded-md bg-zinc-950/90 border border-zinc-800 p-2 space-y-1'>
                  <div className='flex items-center justify-between'>
                    <span className='text-[11px] font-semibold text-zinc-200'>
                      Hallway & Architectural Geometry
                    </span>
                    <span className='text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700'>
                      7 Optional Tools
                    </span>
                  </div>
                  <p className='text-[10px] text-zinc-400 leading-relaxed'>
                    All 7 tools below are <strong className='text-zinc-200'>strictly optional</strong>. Enable only the tool that matches the architectural feature in your photo:
                  </p>
                </div>

                {/* OPTION 1 (OPTIONAL): 2-Click / Multi-Bend / Catenary 3D Swept Rail & Pipe Tool */}
                <div className='rounded-md border border-rose-500/30 bg-rose-950/15 p-2 space-y-1.5'>
                  <div className='flex items-center justify-between'>
                    <span className='text-[10.5px] font-semibold text-rose-300'>
                      1. 3D Swept Rail, Pipe & Catenary Cable
                    </span>
                    <span className='text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300'>
                      Optional
                    </span>
                  </div>
                  <p className='text-[10px] text-zinc-400 leading-snug'>
                    <strong className='text-rose-200'>Best for:</strong> Solid hallway handrails, multi-bend 90° elbow conduits & sagging overhead cables/string lights.
                  </p>

                  <div className='flex items-center justify-between pt-0.5'>
                    <Checkbox
                      title='Enable 2-click 3D wall rails'
                      isSelected={sceneBlockout.sweptRailsEnabled}
                      onChange={(sweptRailsEnabled) =>
                        setSceneBlockout({ sweptRailsEnabled })
                      }
                    />
                    <button
                      type='button'
                      onClick={() => addSweptWallRail()}
                      className='inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/35 text-rose-200 text-[10px] font-medium cursor-pointer'
                    >
                      <Plus className='w-3 h-3' />
                      <span>Add Rail</span>
                    </button>
                  </div>

                  {sceneBlockout.sweptRailsEnabled &&
                    sceneBlockout.sweptRails.length > 0 &&
                    selectedSweptRail && (
                      <div className='space-y-1.5 bg-zinc-950/70 p-2 rounded border border-rose-500/25 mt-1'>
                        <div className='flex items-center gap-1'>
                          <select
                            value={selectedSweptRail.id}
                            onChange={(e) =>
                              setSceneBlockout({
                                selectedSweptRailId: e.target.value
                              })
                            }
                            className='flex-1 bg-zinc-900 border border-zinc-700/80 rounded px-1.5 py-1 text-[11px] text-zinc-200 focus:outline-none'
                          >
                            {sceneBlockout.sweptRails.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.name}
                              </option>
                            ))}
                          </select>
                          <button
                            type='button'
                            onClick={() =>
                              removeSweptWallRail(selectedSweptRail.id)
                            }
                            className='p-1 rounded text-zinc-400 hover:text-red-400 hover:bg-zinc-800 cursor-pointer'
                            title='Delete selected 3D Swept Rail'
                          >
                            <Trash2 className='w-3.5 h-3.5' />
                          </button>
                        </div>

                        <div className='grid grid-cols-2 gap-1 text-[10.5px]'>
                          <div>
                            <span className='text-zinc-400 block mb-0.5'>
                              Host Wall
                            </span>
                            <select
                              value={selectedSweptRail.hostWall}
                              onChange={(e) =>
                                updateSweptWallRail(selectedSweptRail.id, {
                                  hostWall: e.target.value as HostWallType
                                })
                              }
                              className='w-full bg-zinc-900 border border-zinc-700/80 rounded px-1.5 py-1 text-[10.5px] text-zinc-200'
                            >
                              <option value='left-wall-yz'>Left Wall (YZ)</option>
                              <option value='right-wall-yz'>Right Wall (YZ)</option>
                              <option value='back-wall-xz'>Back Wall (XZ)</option>
                              <option value='floor-xy'>Floor (XY)</option>
                            </select>
                          </div>
                          <div>
                            <span className='text-zinc-400 block mb-0.5'>
                              3D Profile
                            </span>
                            <select
                              value={selectedSweptRail.profile}
                              onChange={(e) =>
                                updateSweptWallRail(selectedSweptRail.id, {
                                  profile: e.target.value as SweptRailProfile
                                })
                              }
                              className='w-full bg-zinc-900 border border-zinc-700/80 rounded px-1.5 py-1 text-[10.5px] text-zinc-200'
                            >
                              <option value='round-pipe'>Round Pipe</option>
                              <option value='square-bar'>Square Bar</option>
                              <option value='molding-bevel'>Bevel Rail</option>
                            </select>
                          </div>
                        </div>

                        <div className='flex items-center justify-between gap-1 text-[10.5px]'>
                          <span className='text-zinc-400'>Path Mode</span>
                          <select
                            value={
                              selectedSweptRail.pathMode ?? 'straight-or-elbows'
                            }
                            onChange={(e) =>
                              updateSweptWallRail(selectedSweptRail.id, {
                                pathMode: e.target.value as SweptRailPathMode
                              })
                            }
                            className='bg-zinc-900 border border-zinc-700/80 rounded px-1.5 py-1 text-[10.5px] text-zinc-200'
                          >
                            <option value='straight-or-elbows'>
                              Straight / 90° Elbows
                            </option>
                            <option value='smooth-spline'>
                              Smooth Curved Spline
                            </option>
                            <option value='catenary-sag'>
                              Gravity Catenary Cable Sag
                            </option>
                          </select>
                        </div>

                        <div className='flex items-center justify-between text-[10px] bg-zinc-900/80 px-2 py-1 rounded border border-zinc-800'>
                          <span className='text-zinc-400'>
                            Intermediate Bends:{' '}
                            <strong className='text-rose-300 font-mono'>
                              {(selectedSweptRail.waypointsRel ?? []).length}
                            </strong>
                          </span>
                          <div className='flex items-center gap-1'>
                            <button
                              type='button'
                              onClick={() =>
                                addSweptRailWaypoint(selectedSweptRail.id)
                              }
                              className='inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/35 text-rose-200 cursor-pointer'
                              title='Add an intermediate bend waypoint along this rail or conduit'
                            >
                              <Plus className='w-2.5 h-2.5' />
                              <span>Bend</span>
                            </button>
                            <button
                              type='button'
                              disabled={
                                (selectedSweptRail.waypointsRel ?? []).length ===
                                0
                              }
                              onClick={() =>
                                removeSweptRailWaypoint(selectedSweptRail.id)
                              }
                              className='inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-300 cursor-pointer'
                              title='Remove last bend waypoint'
                            >
                              <Minus className='w-2.5 h-2.5' />
                            </button>
                          </div>
                        </div>

                        {(selectedSweptRail.pathMode ?? 'straight-or-elbows') ===
                          'catenary-sag' && (
                          <div className='flex items-center gap-2 text-[11px]'>
                            <span
                              className='w-16 text-zinc-400'
                              title='Downward gravity sag (in meters) for hanging cables, chains, or string lights'
                            >
                              Cable Sag
                            </span>
                            <input
                              type='range'
                              min={0.02}
                              max={1.2}
                              step={0.02}
                              value={selectedSweptRail.catenarySag ?? 0.25}
                              onChange={(e) =>
                                updateSweptWallRail(selectedSweptRail.id, {
                                  catenarySag: parseFloat(e.target.value)
                                })
                              }
                            />
                            <span className='w-10 text-right font-mono tabular-nums text-rose-300'>
                              {(selectedSweptRail.catenarySag ?? 0.25).toFixed(
                                2
                              )}
                              m
                            </span>
                          </div>
                        )}

                        <div className='flex items-center gap-2 text-[11px]'>
                          <span
                            className='w-16 text-zinc-400'
                            title='Distance the handrail floats outward from the host wall'
                          >
                            Stand-Off
                          </span>
                          <input
                            type='range'
                            min={0.01}
                            max={0.45}
                            step={0.01}
                            value={selectedSweptRail.standOff}
                            onChange={(e) =>
                              updateSweptWallRail(selectedSweptRail.id, {
                                standOff: parseFloat(e.target.value)
                              })
                            }
                          />
                          <span className='w-10 text-right font-mono tabular-nums text-zinc-300'>
                            {selectedSweptRail.standOff.toFixed(2)}m
                          </span>
                        </div>

                        <div className='flex items-center gap-2 text-[11px]'>
                          <span className='w-16 text-zinc-400'>Thickness</span>
                          <input
                            type='range'
                            min={0.01}
                            max={0.18}
                            step={0.005}
                            value={selectedSweptRail.radius}
                            onChange={(e) =>
                              updateSweptWallRail(selectedSweptRail.id, {
                                radius: parseFloat(e.target.value)
                              })
                            }
                          />
                          <span className='w-10 text-right font-mono tabular-nums text-zinc-300'>
                            {selectedSweptRail.radius.toFixed(3)}m
                          </span>
                        </div>

                        <div className='flex items-center gap-2 text-[11px]'>
                          <span
                            className='w-16 text-zinc-400'
                            title='Number of 3D wall-mount brackets connecting the rail back to the wall'
                          >
                            Brackets
                          </span>
                          <input
                            type='range'
                            min={0}
                            max={6}
                            step={1}
                            value={selectedSweptRail.bracketCount}
                            onChange={(e) =>
                              updateSweptWallRail(selectedSweptRail.id, {
                                bracketCount: parseInt(e.target.value, 10)
                              })
                            }
                          />
                          <span className='w-10 text-right font-mono tabular-nums text-zinc-300'>
                            {selectedSweptRail.bracketCount}
                          </span>
                        </div>
                      </div>
                    )}
                </div>

                {/* OPTION 2 (OPTIONAL): Wall-Parallel Offset Cutout Layer */}
                <div className='rounded-md border border-purple-500/30 bg-purple-950/15 p-2 space-y-1.5'>
                  <div className='flex items-center justify-between'>
                    <span className='text-[10.5px] font-semibold text-purple-300'>
                      2. Wall-Parallel Cutout Layer
                    </span>
                    <span className='text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300'>
                      Optional
                    </span>
                  </div>
                  <p className='text-[10px] text-zinc-400 leading-snug'>
                    <strong className='text-purple-200'>Best for:</strong> Ornate wrought-iron railings, balusters, radiators & wall signage (auto-punches transparent gaps between bars).
                  </p>

                  <div className='flex items-center justify-between pt-0.5'>
                    <Checkbox
                      title='Enable wall-parallel cutouts'
                      isSelected={sceneBlockout.wallCutoutsEnabled}
                      onChange={(wallCutoutsEnabled) =>
                        setSceneBlockout({ wallCutoutsEnabled })
                      }
                    />
                    <button
                      type='button'
                      onClick={() => addWallParallelCutout()}
                      className='inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/35 text-purple-200 text-[10px] font-medium cursor-pointer'
                    >
                      <Plus className='w-3 h-3' />
                      <span>Add Layer</span>
                    </button>
                  </div>

                  {sceneBlockout.wallCutoutsEnabled &&
                    sceneBlockout.wallCutouts.length > 0 &&
                    selectedWallCutout && (
                      <div className='space-y-1.5 bg-zinc-950/70 p-2 rounded border border-purple-500/25 mt-1'>
                        <div className='flex items-center gap-1'>
                          <select
                            value={selectedWallCutout.id}
                            onChange={(e) =>
                              setSceneBlockout({
                                selectedWallCutoutId: e.target.value
                              })
                            }
                            className='flex-1 bg-zinc-900 border border-zinc-700/80 rounded px-1.5 py-1 text-[11px] text-zinc-200 focus:outline-none'
                          >
                            {sceneBlockout.wallCutouts.map((wc) => (
                              <option key={wc.id} value={wc.id}>
                                {wc.name}
                              </option>
                            ))}
                          </select>
                          <button
                            type='button'
                            onClick={() =>
                              removeWallParallelCutout(selectedWallCutout.id)
                            }
                            className='p-1 rounded text-zinc-400 hover:text-red-400 hover:bg-zinc-800 cursor-pointer'
                            title='Delete selected Wall-Parallel Cutout'
                          >
                            <Trash2 className='w-3.5 h-3.5' />
                          </button>
                        </div>

                        <div className='grid grid-cols-2 gap-1 text-[10.5px]'>
                          <div>
                            <span className='text-zinc-400 block mb-0.5'>
                              Host Wall
                            </span>
                            <select
                              value={selectedWallCutout.hostWall}
                              onChange={(e) =>
                                updateWallParallelCutout(
                                  selectedWallCutout.id,
                                  {
                                    hostWall: e.target.value as HostWallType
                                  }
                                )
                              }
                              className='w-full bg-zinc-900 border border-zinc-700/80 rounded px-1.5 py-1 text-[10.5px] text-zinc-200'
                            >
                              <option value='left-wall-yz'>Left Wall (YZ)</option>
                              <option value='right-wall-yz'>Right Wall (YZ)</option>
                              <option value='back-wall-xz'>Back Wall (XZ)</option>
                            </select>
                          </div>
                          <div>
                            <span className='text-zinc-400 block mb-0.5'>
                              Gap Alpha Key
                            </span>
                            <select
                              value={selectedWallCutout.alphaMode}
                              onChange={(e) =>
                                updateWallParallelCutout(
                                  selectedWallCutout.id,
                                  {
                                    alphaMode:
                                      e.target.value as WallCutoutAlphaMode
                                  }
                                )
                              }
                              className='w-full bg-zinc-900 border border-zinc-700/80 rounded px-1.5 py-1 text-[10.5px] text-zinc-200'
                            >
                              <option value='edge-contrast'>
                                Auto Contrast Bars
                              </option>
                              <option value='dark-bars'>
                                Keep Dark Iron Bars
                              </option>
                              <option value='bright-bars'>
                                Keep Bright Bars
                              </option>
                              <option value='full-strip'>
                                Solid Strip (No Key)
                              </option>
                            </select>
                          </div>
                        </div>

                        <div className='flex items-center gap-2 text-[11px]'>
                          <span className='w-16 text-zinc-400'>Stand-Off</span>
                          <input
                            type='range'
                            min={0.02}
                            max={0.5}
                            step={0.01}
                            value={selectedWallCutout.standOff}
                            onChange={(e) =>
                              updateWallParallelCutout(selectedWallCutout.id, {
                                standOff: parseFloat(e.target.value)
                              })
                            }
                          />
                          <span className='w-10 text-right font-mono tabular-nums text-zinc-300'>
                            {selectedWallCutout.standOff.toFixed(2)}m
                          </span>
                        </div>

                        {selectedWallCutout.alphaMode !== 'full-strip' && (
                          <div className='flex items-center gap-2 text-[11px]'>
                            <span className='w-16 text-zinc-400'>Key Thresh</span>
                            <input
                              type='range'
                              min={0.08}
                              max={0.85}
                              step={0.02}
                              value={selectedWallCutout.threshold}
                              onChange={(e) =>
                                updateWallParallelCutout(
                                  selectedWallCutout.id,
                                  {
                                    threshold: parseFloat(e.target.value)
                                  }
                                )
                              }
                            />
                            <span className='w-10 text-right font-mono tabular-nums text-zinc-300'>
                              {Math.round(selectedWallCutout.threshold * 100)}%
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                </div>

                {/* OPTION 3 (OPTIONAL): Wall Relief & Recessed Alcove Extruder */}
                <div className='rounded-md border border-cyan-500/30 bg-cyan-950/15 p-2 space-y-1.5'>
                  <div className='flex items-center justify-between'>
                    <span className='text-[10.5px] font-semibold text-cyan-300'>
                      3. Wall Relief & Alcove Extruder
                    </span>
                    <span className='text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300'>
                      Optional
                    </span>
                  </div>
                  <p className='text-[10px] text-zinc-400 leading-snug'>
                    <strong className='text-cyan-200'>Best for:</strong> Protruding window sills & ledges (<code className='text-cyan-300'>+Depth</code>) OR recessed windows, doorways & niches (<code className='text-cyan-300'>-Depth</code>).
                  </p>

                  <div className='flex items-center justify-between pt-0.5'>
                    <Checkbox
                      title='Enable wall relief / alcoves'
                      isSelected={sceneBlockout.wallReliefsEnabled}
                      onChange={(wallReliefsEnabled) =>
                        setSceneBlockout({ wallReliefsEnabled })
                      }
                    />
                    <button
                      type='button'
                      onClick={() => addWallReliefExtrusion()}
                      className='inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/35 text-cyan-200 text-[10px] font-medium cursor-pointer'
                    >
                      <Plus className='w-3 h-3' />
                      <span>Add Relief</span>
                    </button>
                  </div>

                  {sceneBlockout.wallReliefsEnabled &&
                    sceneBlockout.wallReliefs.length > 0 &&
                    selectedWallRelief && (
                      <div className='space-y-1.5 bg-zinc-950/70 p-2 rounded border border-cyan-500/25 mt-1'>
                        <div className='flex items-center gap-1'>
                          <select
                            value={selectedWallRelief.id}
                            onChange={(e) =>
                              setSceneBlockout({
                                selectedWallReliefId: e.target.value
                              })
                            }
                            className='flex-1 bg-zinc-900 border border-zinc-700/80 rounded px-1.5 py-1 text-[11px] text-zinc-200 focus:outline-none'
                          >
                            {sceneBlockout.wallReliefs.map((rel) => (
                              <option key={rel.id} value={rel.id}>
                                {rel.name}
                              </option>
                            ))}
                          </select>
                          <button
                            type='button'
                            onClick={() =>
                              removeWallReliefExtrusion(selectedWallRelief.id)
                            }
                            className='p-1 rounded text-zinc-400 hover:text-red-400 hover:bg-zinc-800 cursor-pointer'
                            title='Delete selected Wall Relief / Alcove'
                          >
                            <Trash2 className='w-3.5 h-3.5' />
                          </button>
                        </div>

                        <div className='flex items-center justify-between text-[10.5px]'>
                          <span className='text-zinc-400'>Host Wall</span>
                          <select
                            value={selectedWallRelief.hostWall}
                            onChange={(e) =>
                              updateWallReliefExtrusion(selectedWallRelief.id, {
                                hostWall: e.target.value as HostWallType
                              })
                            }
                            className='bg-zinc-900 border border-zinc-700/80 rounded px-1.5 py-1 text-[10.5px] text-zinc-200'
                          >
                            <option value='back-wall-xz'>Back Wall (XZ)</option>
                            <option value='left-wall-yz'>Left Wall (YZ)</option>
                            <option value='right-wall-yz'>Right Wall (YZ)</option>
                          </select>
                        </div>

                        <div className='flex items-center justify-between text-[10.5px]'>
                          <span className='text-zinc-400'>Top Arch Profile</span>
                          <select
                            value={selectedWallRelief.archType ?? 'rectangular'}
                            onChange={(e) =>
                              updateWallReliefExtrusion(selectedWallRelief.id, {
                                archType: e.target.value as WallReliefArchType
                              })
                            }
                            className='bg-zinc-900 border border-zinc-700/80 rounded px-1.5 py-1 text-[10.5px] text-zinc-200'
                          >
                            <option value='rectangular'>
                              Flat Rectangular Lintel
                            </option>
                            <option value='roman-arch'>
                              Roman Semi-Circular Arch
                            </option>
                            <option value='segmental-arch'>
                              Segmental Shallow Arch
                            </option>
                            <option value='gothic-arch'>
                              Pointed Gothic Arch
                            </option>
                          </select>
                        </div>

                        {(selectedWallRelief.archType ?? 'rectangular') !==
                          'rectangular' && (
                          <div className='flex items-center gap-2 text-[11px]'>
                            <span
                              className='w-16 text-zinc-400'
                              title='Portion of the opening height occupied by the curved 3D arch crown'
                            >
                              Arch Rise
                            </span>
                            <input
                              type='range'
                              min={0.15}
                              max={0.6}
                              step={0.02}
                              value={selectedWallRelief.archRiseRatio ?? 0.35}
                              onChange={(e) =>
                                updateWallReliefExtrusion(
                                  selectedWallRelief.id,
                                  {
                                    archRiseRatio: parseFloat(e.target.value)
                                  }
                                )
                              }
                            />
                            <span className='w-12 text-right font-mono tabular-nums text-cyan-300'>
                              {Math.round(
                                (selectedWallRelief.archRiseRatio ?? 0.35) * 100
                              )}
                              %
                            </span>
                          </div>
                        )}

                        <div className='flex items-center gap-2 text-[11px]'>
                          <span
                            className='w-16 text-zinc-400'
                            title='Negative (-) carves a recessed alcove/window inward; Positive (+) pops a ledge outward'
                          >
                            Depth ±
                          </span>
                          <input
                            type='range'
                            min={-0.6}
                            max={0.6}
                            step={0.02}
                            value={selectedWallRelief.extrudeDepth}
                            onChange={(e) =>
                              updateWallReliefExtrusion(selectedWallRelief.id, {
                                extrudeDepth: parseFloat(e.target.value)
                              })
                            }
                          />
                          <span className='w-12 text-right font-mono tabular-nums text-cyan-300'>
                            {selectedWallRelief.extrudeDepth >= 0 ? '+' : ''}
                            {selectedWallRelief.extrudeDepth.toFixed(2)}m
                          </span>
                        </div>

                        {/* Optional Pass-Through Boolean Portal Cutter & 3D Annex Corridor */}
                        <div className='pt-1.5 mt-1 border-t border-cyan-500/20 space-y-1.5'>
                          <div className='flex items-center justify-between'>
                            <Checkbox
                              title='Punch Open Portal + 3D Annex Room'
                              isSelected={
                                selectedWallRelief.passThroughPortal ?? false
                              }
                              onChange={(passThroughPortal) =>
                                updateWallReliefExtrusion(
                                  selectedWallRelief.id,
                                  {
                                    passThroughPortal
                                  }
                                )
                              }
                            />
                            <span className='text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300'>
                              Optional
                            </span>
                          </div>

                          {(selectedWallRelief.passThroughPortal ?? false) && (
                            <div className='space-y-1.5 bg-cyan-950/25 p-1.5 rounded border border-cyan-500/25'>
                              <p className='text-[9.5px] text-zinc-400 leading-snug'>
                                Cuts a real topological hole through the host
                                wall and extrudes a connected{' '}
                                <strong className='text-cyan-200'>
                                  3D Annex / Side Hallway
                                </strong>{' '}
                                behind the opening.
                              </p>

                              <div className='flex items-center gap-2 text-[11px]'>
                                <span
                                  className='w-16 text-zinc-400'
                                  title='Depth of the side hallway or annex room behind the punched doorway'
                                >
                                  Annex Len
                                </span>
                                <input
                                  type='range'
                                  min={0.4}
                                  max={6.0}
                                  step={0.1}
                                  value={selectedWallRelief.annexLength ?? 1.8}
                                  onChange={(e) =>
                                    updateWallReliefExtrusion(
                                      selectedWallRelief.id,
                                      {
                                        annexLength: parseFloat(e.target.value)
                                      }
                                    )
                                  }
                                />
                                <span className='w-12 text-right font-mono tabular-nums text-cyan-300'>
                                  {(
                                    selectedWallRelief.annexLength ?? 1.8
                                  ).toFixed(1)}
                                  m
                                </span>
                              </div>

                              <div className='flex items-center gap-2 text-[11px]'>
                                <span
                                  className='w-16 text-zinc-400'
                                  title='How much wider the annex room expands laterally beyond the doorway jambs (T-junction / wider room)'
                                >
                                  Expand W
                                </span>
                                <input
                                  type='range'
                                  min={0}
                                  max={2.0}
                                  step={0.05}
                                  value={
                                    selectedWallRelief.annexWidthExpand ?? 0.35
                                  }
                                  onChange={(e) =>
                                    updateWallReliefExtrusion(
                                      selectedWallRelief.id,
                                      {
                                        annexWidthExpand: parseFloat(
                                          e.target.value
                                        )
                                      }
                                    )
                                  }
                                />
                                <span className='w-12 text-right font-mono tabular-nums text-cyan-300'>
                                  +
                                  {(
                                    selectedWallRelief.annexWidthExpand ?? 0.35
                                  ).toFixed(2)}
                                  m
                                </span>
                              </div>

                              <Checkbox
                                title='Leave annex far end open (through-corridor)'
                                isSelected={
                                  selectedWallRelief.annexOpenEnd ?? false
                                }
                                onChange={(annexOpenEnd) =>
                                  updateWallReliefExtrusion(
                                    selectedWallRelief.id,
                                    {
                                      annexOpenEnd
                                    }
                                  )
                                }
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                </div>

                {/* OPTION 4 (OPTIONAL): "3-Sweep" Cylinder & Pillar Snapper */}
                <div className='rounded-md border border-yellow-500/30 bg-yellow-950/15 p-2 space-y-1.5'>
                  <div className='flex items-center justify-between'>
                    <span className='text-[10.5px] font-semibold text-yellow-300'>
                      4. &ldquo;3-Sweep&rdquo; Pillar & Column
                    </span>
                    <span className='text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-300'>
                      Optional
                    </span>
                  </div>
                  <p className='text-[10px] text-zinc-400 leading-snug'>
                    <strong className='text-yellow-200'>Best for:</strong> Freestanding vertical columns, pillars, bollards & vertical pipes (solves 3D diameter & height from 3 points).
                  </p>

                  <div className='flex items-center justify-between pt-0.5'>
                    <Checkbox
                      title='Enable 3-Sweep 3D columns'
                      isSelected={sceneBlockout.sweptColumnsEnabled}
                      onChange={(sweptColumnsEnabled) =>
                        setSceneBlockout({ sweptColumnsEnabled })
                      }
                    />
                    <button
                      type='button'
                      onClick={() => addSweptCylinderColumn()}
                      className='inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/35 text-yellow-200 text-[10px] font-medium cursor-pointer'
                    >
                      <Plus className='w-3 h-3' />
                      <span>Add Pillar</span>
                    </button>
                  </div>

                  {sceneBlockout.sweptColumnsEnabled &&
                    sceneBlockout.sweptColumns.length > 0 &&
                    selectedSweptColumn && (
                      <div className='space-y-1.5 bg-zinc-950/70 p-2 rounded border border-yellow-500/25 mt-1'>
                        <div className='flex items-center gap-1'>
                          <select
                            value={selectedSweptColumn.id}
                            onChange={(e) =>
                              setSceneBlockout({
                                selectedSweptColumnId: e.target.value
                              })
                            }
                            className='flex-1 bg-zinc-900 border border-zinc-700/80 rounded px-1.5 py-1 text-[11px] text-zinc-200 focus:outline-none'
                          >
                            {sceneBlockout.sweptColumns.map((col) => (
                              <option key={col.id} value={col.id}>
                                {col.name}
                              </option>
                            ))}
                          </select>
                          <button
                            type='button'
                            onClick={() =>
                              removeSweptCylinderColumn(selectedSweptColumn.id)
                            }
                            className='p-1 rounded text-zinc-400 hover:text-red-400 hover:bg-zinc-800 cursor-pointer'
                            title='Delete selected 3-Sweep Pillar'
                          >
                            <Trash2 className='w-3.5 h-3.5' />
                          </button>
                        </div>

                        <div className='flex items-center justify-between text-[10.5px]'>
                          <span className='text-zinc-400'>Column Shape</span>
                          <select
                            value={selectedSweptColumn.profile}
                            onChange={(e) =>
                              updateSweptCylinderColumn(
                                selectedSweptColumn.id,
                                {
                                  profile: e.target.value as SweptColumnProfile
                                }
                              )
                            }
                            className='bg-zinc-900 border border-zinc-700/80 rounded px-1.5 py-1 text-[10.5px] text-zinc-200'
                          >
                            <option value='round-column'>
                              Round Cylinder (24-seg)
                            </option>
                            <option value='octagonal-pillar'>
                              Octagonal Pillar
                            </option>
                            <option value='square-pillar'>
                              Square Column
                            </option>
                          </select>
                        </div>

                        {solverResult.cameraParameters && (() => {
                          const solved = solveSweptColumn3D(
                            selectedSweptColumn,
                            solverResult.cameraParameters
                          )
                          if (!solved) return null
                          return (
                            <div className='text-[10px] font-mono text-yellow-200/90 bg-yellow-500/10 border border-yellow-500/20 rounded px-2 py-1 flex items-center justify-between'>
                              <span>Ø {(solved.radius * 2).toFixed(2)}m</span>
                              <span>H {solved.height.toFixed(2)}m</span>
                              <span>
                                ({solved.centerX.toFixed(1)},{' '}
                                {solved.centerY.toFixed(1)})
                              </span>
                            </div>
                          )
                        })()}
                      </div>
                    )}
                </div>

                {/* OPTION 5 (OPTIONAL): Parametric 3D Staircase & Sloped Ramp Generator */}
                <div className='rounded-md border border-emerald-500/30 bg-emerald-950/15 p-2 space-y-1.5'>
                  <div className='flex items-center justify-between'>
                    <span className='text-[10.5px] font-semibold text-emerald-300'>
                      5. 3D Staircase & Sloped Ramp
                    </span>
                    <span className='text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300'>
                      Optional
                    </span>
                  </div>
                  <p className='text-[10px] text-zinc-400 leading-snug'>
                    <strong className='text-emerald-200'>Best for:</strong> Flights of stairs, hallway steps, stoops & sloped ramps (auto-builds 3D vertical risers, horizontal treads & side walls).
                  </p>

                  <div className='flex items-center justify-between pt-0.5'>
                    <Checkbox
                      title='Enable 3D stairs / ramps'
                      isSelected={sceneBlockout.staircasesEnabled}
                      onChange={(staircasesEnabled) =>
                        setSceneBlockout({ staircasesEnabled })
                      }
                    />
                    <button
                      type='button'
                      onClick={() => addStaircaseExtrusion()}
                      className='inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/35 text-emerald-200 text-[10px] font-medium cursor-pointer'
                    >
                      <Plus className='w-3 h-3' />
                      <span>Add Stairs</span>
                    </button>
                  </div>

                  {sceneBlockout.staircasesEnabled &&
                    sceneBlockout.staircases.length > 0 &&
                    selectedStaircase && (
                      <div className='space-y-1.5 bg-zinc-950/70 p-2 rounded border border-emerald-500/25 mt-1'>
                        <div className='flex items-center gap-1'>
                          <select
                            value={selectedStaircase.id}
                            onChange={(e) =>
                              setSceneBlockout({
                                selectedStaircaseId: e.target.value
                              })
                            }
                            className='flex-1 bg-zinc-900 border border-zinc-700/80 rounded px-1.5 py-1 text-[11px] text-zinc-200 focus:outline-none'
                          >
                            {sceneBlockout.staircases.map((st) => (
                              <option key={st.id} value={st.id}>
                                {st.name}
                              </option>
                            ))}
                          </select>
                          <button
                            type='button'
                            onClick={() =>
                              removeStaircaseExtrusion(selectedStaircase.id)
                            }
                            className='p-1 rounded text-zinc-400 hover:text-red-400 hover:bg-zinc-800 cursor-pointer'
                            title='Delete selected 3D Staircase / Ramp'
                          >
                            <Trash2 className='w-3.5 h-3.5' />
                          </button>
                        </div>

                        <div className='flex items-center justify-between text-[10.5px]'>
                          <span className='text-zinc-400'>Geometry Mode</span>
                          <select
                            value={selectedStaircase.mode}
                            onChange={(e) =>
                              updateStaircaseExtrusion(selectedStaircase.id, {
                                mode: e.target.value as StaircaseMode
                              })
                            }
                            className='bg-zinc-900 border border-zinc-700/80 rounded px-1.5 py-1 text-[10.5px] text-zinc-200'
                          >
                            <option value='stepped-stairs'>
                              Straight Stepped Staircase
                            </option>
                            <option value='smooth-ramp'>
                              Smooth Sloped Ramp
                            </option>
                            <option value='l-landing-90'>
                              90° L-Landing Staircase
                            </option>
                            <option value='u-switchback-180'>
                              180° U-Switchback Stairs
                            </option>
                            <option value='helical-spiral'>
                              Helical / Spiral Staircase
                            </option>
                          </select>
                        </div>

                        {selectedStaircase.mode !== 'smooth-ramp' && (
                          <div className='flex items-center gap-2 text-[11px]'>
                            <span className='w-16 text-zinc-400'>Steps</span>
                            <input
                              type='range'
                              min={2}
                              max={28}
                              step={1}
                              value={selectedStaircase.stepCount}
                              onChange={(e) =>
                                updateStaircaseExtrusion(selectedStaircase.id, {
                                  stepCount: parseInt(e.target.value, 10)
                                })
                              }
                            />
                            <span className='w-10 text-right font-mono tabular-nums text-emerald-300'>
                              {selectedStaircase.stepCount}
                            </span>
                          </div>
                        )}

                        {(selectedStaircase.mode === 'l-landing-90' ||
                          selectedStaircase.mode === 'u-switchback-180' ||
                          selectedStaircase.mode === 'helical-spiral') && (
                          <div className='space-y-1.5 bg-emerald-950/25 p-1.5 rounded border border-emerald-500/20'>
                            <div className='flex items-center justify-between text-[10.5px]'>
                              <span className='text-zinc-400'>
                                Turn Direction
                              </span>
                              <select
                                value={
                                  selectedStaircase.turnDirection ?? 'left-ccw'
                                }
                                onChange={(e) =>
                                  updateStaircaseExtrusion(
                                    selectedStaircase.id,
                                    {
                                      turnDirection: e.target
                                        .value as StairTurnDirection
                                    }
                                  )
                                }
                                className='bg-zinc-900 border border-zinc-700/80 rounded px-1.5 py-0.5 text-[10.5px] text-zinc-200'
                              >
                                <option value='left-ccw'>
                                  Turn Left (CCW)
                                </option>
                                <option value='right-cw'>
                                  Turn Right (CW)
                                </option>
                              </select>
                            </div>

                            {selectedStaircase.mode === 'helical-spiral' && (
                              <>
                                <div className='flex items-center gap-2 text-[11px]'>
                                  <span className='w-16 text-zinc-400'>
                                    Sweep Arc
                                  </span>
                                  <input
                                    type='range'
                                    min={60}
                                    max={360}
                                    step={15}
                                    value={
                                      selectedStaircase.spiralArcDeg ?? 180
                                    }
                                    onChange={(e) =>
                                      updateStaircaseExtrusion(
                                        selectedStaircase.id,
                                        {
                                          spiralArcDeg: parseFloat(
                                            e.target.value
                                          )
                                        }
                                      )
                                    }
                                  />
                                  <span className='w-10 text-right font-mono tabular-nums text-emerald-300'>
                                    {Math.round(
                                      selectedStaircase.spiralArcDeg ?? 180
                                    )}
                                    °
                                  </span>
                                </div>

                                <div className='flex items-center gap-2 text-[11px]'>
                                  <span className='w-16 text-zinc-400'>
                                    Core Rad
                                  </span>
                                  <input
                                    type='range'
                                    min={0.05}
                                    max={1.5}
                                    step={0.05}
                                    value={
                                      selectedStaircase.innerRadius ?? 0.25
                                    }
                                    onChange={(e) =>
                                      updateStaircaseExtrusion(
                                        selectedStaircase.id,
                                        {
                                          innerRadius: parseFloat(
                                            e.target.value
                                          )
                                        }
                                      )
                                    }
                                  />
                                  <span className='w-10 text-right font-mono tabular-nums text-zinc-300'>
                                    {(
                                      selectedStaircase.innerRadius ?? 0.25
                                    ).toFixed(2)}
                                    m
                                  </span>
                                </div>
                              </>
                            )}
                          </div>
                        )}

                        <div className='flex items-center gap-2 text-[11px]'>
                          <span className='w-16 text-zinc-400'>Width X</span>
                          <input
                            type='range'
                            min={0.5}
                            max={6.0}
                            step={0.1}
                            value={selectedStaircase.widthX}
                            onChange={(e) =>
                              updateStaircaseExtrusion(selectedStaircase.id, {
                                widthX: parseFloat(e.target.value)
                              })
                            }
                          />
                          <span className='w-10 text-right font-mono tabular-nums text-zinc-300'>
                            {selectedStaircase.widthX.toFixed(1)}m
                          </span>
                        </div>

                        <div className='flex items-center gap-2 text-[11px]'>
                          <span className='w-16 text-zinc-400'>Run Y</span>
                          <input
                            type='range'
                            min={0.5}
                            max={6.0}
                            step={0.1}
                            value={selectedStaircase.runDepthY}
                            onChange={(e) =>
                              updateStaircaseExtrusion(selectedStaircase.id, {
                                runDepthY: parseFloat(e.target.value)
                              })
                            }
                          />
                          <span className='w-10 text-right font-mono tabular-nums text-zinc-300'>
                            {selectedStaircase.runDepthY.toFixed(1)}m
                          </span>
                        </div>

                        <div className='flex items-center gap-2 text-[11px]'>
                          <span className='w-16 text-zinc-400'>Height Z</span>
                          <input
                            type='range'
                            min={0.2}
                            max={4.5}
                            step={0.05}
                            value={selectedStaircase.totalHeightZ}
                            onChange={(e) =>
                              updateStaircaseExtrusion(selectedStaircase.id, {
                                totalHeightZ: parseFloat(e.target.value)
                              })
                            }
                          />
                          <span className='w-10 text-right font-mono tabular-nums text-emerald-300'>
                            {selectedStaircase.totalHeightZ.toFixed(2)}m
                          </span>
                        </div>

                        <div className='flex items-center gap-2 text-[11px]'>
                          <span className='w-16 text-zinc-400'>Yaw °</span>
                          <input
                            type='range'
                            min={-180}
                            max={180}
                            step={5}
                            value={selectedStaircase.yawDeg}
                            onChange={(e) =>
                              updateStaircaseExtrusion(selectedStaircase.id, {
                                yawDeg: parseFloat(e.target.value)
                              })
                            }
                          />
                          <span className='w-10 text-right font-mono tabular-nums text-zinc-300'>
                            {Math.round(selectedStaircase.yawDeg)}°
                          </span>
                        </div>

                        <Checkbox
                          title='Close solid side stringer walls'
                          isSelected={selectedStaircase.closedStringers}
                          onChange={(closedStringers) =>
                            updateStaircaseExtrusion(selectedStaircase.id, {
                              closedStringers
                            })
                          }
                        />
                      </div>
                    )}
                </div>

                {/* OPTION 6 (OPTIONAL): Arbitrary N-Point 3D Floor Polygon Prism Extruder */}
                <div className='rounded-md border border-orange-500/30 bg-orange-950/15 p-2 space-y-1.5'>
                  <div className='flex items-center justify-between'>
                    <span className='text-[10.5px] font-semibold text-orange-300'>
                      6. N-Point 3D Floor Polygon Prism
                    </span>
                    <span className='text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300'>
                      Optional
                    </span>
                  </div>
                  <p className='text-[10px] text-zinc-400 leading-snug'>
                    <strong className='text-orange-200'>Best for:</strong> L-shaped counters, angled bay windows, hexagonal islands, sidewalk curbs & non-rectangular platforms.
                  </p>

                  <div className='flex items-center justify-between pt-0.5'>
                    <Checkbox
                      title='Enable 3D floor polygon prisms'
                      isSelected={sceneBlockout.floorPrismsEnabled ?? false}
                      onChange={(floorPrismsEnabled) =>
                        setSceneBlockout({ floorPrismsEnabled })
                      }
                    />
                    <button
                      type='button'
                      onClick={() => addFloorPolygonPrism()}
                      className='inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/35 text-orange-200 text-[10px] font-medium cursor-pointer'
                    >
                      <Plus className='w-3 h-3' />
                      <span>Add Prism</span>
                    </button>
                  </div>

                  {(sceneBlockout.floorPrismsEnabled ?? false) &&
                    (sceneBlockout.floorPrisms ?? []).length > 0 &&
                    selectedFloorPrism && (
                      <div className='space-y-1.5 bg-zinc-950/70 p-2 rounded border border-orange-500/25 mt-1'>
                        <div className='flex items-center gap-1'>
                          <select
                            value={selectedFloorPrism.id}
                            onChange={(e) =>
                              setSceneBlockout({
                                selectedFloorPrismId: e.target.value
                              })
                            }
                            className='flex-1 bg-zinc-900 border border-zinc-700/80 rounded px-1.5 py-1 text-[11px] text-zinc-200 focus:outline-none'
                          >
                            {(sceneBlockout.floorPrisms ?? []).map((fp) => (
                              <option key={fp.id} value={fp.id}>
                                {fp.name}
                              </option>
                            ))}
                          </select>
                          <button
                            type='button'
                            onClick={() =>
                              removeFloorPolygonPrism(selectedFloorPrism.id)
                            }
                            className='p-1 rounded text-zinc-400 hover:text-red-400 hover:bg-zinc-800 cursor-pointer'
                            title='Delete selected 3D Floor Polygon Prism'
                          >
                            <Trash2 className='w-3.5 h-3.5' />
                          </button>
                        </div>

                        <div className='flex items-center justify-between text-[10px] bg-zinc-900/80 px-2 py-1 rounded border border-zinc-800'>
                          <span className='text-zinc-400'>
                            Floor Corners (F1..F
                            {selectedFloorPrism.polygonRel.length}):{' '}
                            <strong className='text-orange-300 font-mono'>
                              {selectedFloorPrism.polygonRel.length}
                            </strong>
                          </span>
                          <div className='flex items-center gap-1'>
                            <button
                              type='button'
                              disabled={
                                selectedFloorPrism.polygonRel.length >= 12
                              }
                              onClick={() =>
                                addFloorPrismVertex(selectedFloorPrism.id)
                              }
                              className='inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-orange-500/20 hover:bg-orange-500/30 disabled:opacity-40 border border-orange-500/35 text-orange-200 cursor-pointer'
                              title='Add floor polygon corner (up to 12)'
                            >
                              <Plus className='w-2.5 h-2.5' />
                              <span>Corner</span>
                            </button>
                            <button
                              type='button'
                              disabled={
                                selectedFloorPrism.polygonRel.length <= 3
                              }
                              onClick={() =>
                                removeFloorPrismVertex(selectedFloorPrism.id)
                              }
                              className='inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-300 cursor-pointer'
                              title='Remove last floor polygon corner (min 3)'
                            >
                              <Minus className='w-2.5 h-2.5' />
                            </button>
                          </div>
                        </div>

                        <div className='flex items-center gap-2 text-[11px]'>
                          <span className='w-16 text-zinc-400'>Height Z</span>
                          <input
                            type='range'
                            min={0.05}
                            max={4.5}
                            step={0.05}
                            value={selectedFloorPrism.heightZ}
                            onChange={(e) =>
                              updateFloorPolygonPrism(selectedFloorPrism.id, {
                                heightZ: parseFloat(e.target.value)
                              })
                            }
                          />
                          <span className='w-10 text-right font-mono tabular-nums text-orange-300'>
                            {selectedFloorPrism.heightZ.toFixed(2)}m
                          </span>
                        </div>

                        <div className='flex items-center gap-2 text-[11px]'>
                          <span className='w-16 text-zinc-400'>Base Z</span>
                          <input
                            type='range'
                            min={0}
                            max={2.5}
                            step={0.05}
                            value={selectedFloorPrism.baseZ}
                            onChange={(e) =>
                              updateFloorPolygonPrism(selectedFloorPrism.id, {
                                baseZ: parseFloat(e.target.value)
                              })
                            }
                          />
                          <span className='w-10 text-right font-mono tabular-nums text-zinc-300'>
                            {selectedFloorPrism.baseZ.toFixed(2)}m
                          </span>
                        </div>

                        <div className='flex items-center gap-2 text-[11px]'>
                          <span
                            className='w-16 text-zinc-400'
                            title='Optional top chamfer/bevel inset for stepped plinths or counter edges'
                          >
                            Top Bevel
                          </span>
                          <input
                            type='range'
                            min={0}
                            max={0.25}
                            step={0.01}
                            value={selectedFloorPrism.bevelTop}
                            onChange={(e) =>
                              updateFloorPolygonPrism(selectedFloorPrism.id, {
                                bevelTop: parseFloat(e.target.value)
                              })
                            }
                          />
                          <span className='w-10 text-right font-mono tabular-nums text-zinc-300'>
                            {selectedFloorPrism.bevelTop.toFixed(2)}m
                          </span>
                        </div>
                      </div>
                    )}
                </div>

                {/* OPTION 7 (OPTIONAL): Axis-Symmetric 3D Revolved "Lathe" Object */}
                <div className='rounded-md border border-pink-500/30 bg-pink-950/15 p-2 space-y-1.5'>
                  <div className='flex items-center justify-between'>
                    <span className='text-[10.5px] font-semibold text-pink-300'>
                      7. 3D Revolved &ldquo;Lathe&rdquo; Object
                    </span>
                    <span className='text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-pink-500/20 text-pink-300'>
                      Optional
                    </span>
                  </div>
                  <p className='text-[10px] text-zinc-400 leading-snug'>
                    <strong className='text-pink-200'>Best for:</strong> Turned classical columns (base + shaft + capital), round café tables, planters, vases & bollards.
                  </p>

                  <div className='flex items-center justify-between pt-0.5'>
                    <Checkbox
                      title='Enable 360° 3D lathe objects'
                      isSelected={sceneBlockout.latheObjectsEnabled ?? false}
                      onChange={(latheObjectsEnabled) =>
                        setSceneBlockout({ latheObjectsEnabled })
                      }
                    />
                    <button
                      type='button'
                      onClick={() => addRevolvedLatheObject()}
                      className='inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-pink-500/20 hover:bg-pink-500/30 border border-pink-500/35 text-pink-200 text-[10px] font-medium cursor-pointer'
                    >
                      <Plus className='w-3 h-3' />
                      <span>Add Lathe</span>
                    </button>
                  </div>

                  {(sceneBlockout.latheObjectsEnabled ?? false) &&
                    (sceneBlockout.latheObjects ?? []).length > 0 &&
                    selectedLatheObject && (
                      <div className='space-y-1.5 bg-zinc-950/70 p-2 rounded border border-pink-500/25 mt-1'>
                        <div className='flex items-center gap-1'>
                          <select
                            value={selectedLatheObject.id}
                            onChange={(e) =>
                              setSceneBlockout({
                                selectedLatheObjectId: e.target.value
                              })
                            }
                            className='flex-1 bg-zinc-900 border border-zinc-700/80 rounded px-1.5 py-1 text-[11px] text-zinc-200 focus:outline-none'
                          >
                            {(sceneBlockout.latheObjects ?? []).map((lo) => (
                              <option key={lo.id} value={lo.id}>
                                {lo.name}
                              </option>
                            ))}
                          </select>
                          <button
                            type='button'
                            onClick={() =>
                              removeRevolvedLatheObject(selectedLatheObject.id)
                            }
                            className='p-1 rounded text-zinc-400 hover:text-red-400 hover:bg-zinc-800 cursor-pointer'
                            title='Delete selected 3D Revolved Lathe Object'
                          >
                            <Trash2 className='w-3.5 h-3.5' />
                          </button>
                        </div>

                        <div className='flex items-center justify-between text-[10.5px]'>
                          <span className='text-zinc-400'>Turned Profile</span>
                          <select
                            value={selectedLatheObject.preset}
                            onChange={(e) =>
                              updateRevolvedLatheObject(
                                selectedLatheObject.id,
                                {
                                  preset: e.target.value as LathePresetType
                                }
                              )
                            }
                            className='bg-zinc-900 border border-zinc-700/80 rounded px-1.5 py-1 text-[10.5px] text-zinc-200'
                          >
                            <option value='classical-column'>
                              Classical Column (Base + Capital)
                            </option>
                            <option value='pedestal-table'>
                              Round Pedestal Café Table
                            </option>
                            <option value='vase-planter'>
                              Curved Urn / Planter Pot
                            </option>
                            <option value='tapered-bollard'>
                              Domed Street Bollard / Baluster
                            </option>
                            <option value='custom-profile'>
                              Custom 4-Band Radii
                            </option>
                          </select>
                        </div>

                        {selectedLatheObject.preset === 'custom-profile' && (
                          <div className='space-y-1 bg-zinc-900/70 p-1.5 rounded border border-zinc-800'>
                            {(
                              [
                                ['Foot R', 0],
                                ['Waist R', 1],
                                ['Neck R', 2],
                                ['Crown R', 3]
                              ] as const
                            ).map(([label, idx]) => (
                              <div
                                key={label}
                                className='flex items-center gap-2 text-[10.5px]'
                              >
                                <span className='w-14 text-zinc-400'>
                                  {label}
                                </span>
                                <input
                                  type='range'
                                  min={0.15}
                                  max={2.0}
                                  step={0.05}
                                  value={selectedLatheObject.profileRadii[idx]}
                                  onChange={(e) => {
                                    const next: [
                                      number,
                                      number,
                                      number,
                                      number
                                    ] = [
                                      selectedLatheObject.profileRadii[0],
                                      selectedLatheObject.profileRadii[1],
                                      selectedLatheObject.profileRadii[2],
                                      selectedLatheObject.profileRadii[3]
                                    ]
                                    next[idx] = parseFloat(e.target.value)
                                    updateRevolvedLatheObject(
                                      selectedLatheObject.id,
                                      { profileRadii: next }
                                    )
                                  }}
                                />
                                <span className='w-9 text-right font-mono tabular-nums text-pink-300'>
                                  {selectedLatheObject.profileRadii[idx].toFixed(
                                    2
                                  )}
                                  ×
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className='flex items-center gap-2 text-[11px]'>
                          <span className='w-16 text-zinc-400'>Radial Segs</span>
                          <input
                            type='range'
                            min={12}
                            max={48}
                            step={4}
                            value={selectedLatheObject.radialSegments}
                            onChange={(e) =>
                              updateRevolvedLatheObject(
                                selectedLatheObject.id,
                                {
                                  radialSegments: parseInt(e.target.value, 10)
                                }
                              )
                            }
                          />
                          <span className='w-10 text-right font-mono tabular-nums text-zinc-300'>
                            {selectedLatheObject.radialSegments}
                          </span>
                        </div>

                        {solverResult.cameraParameters &&
                          (() => {
                            const solved = solveRevolvedLathe3D(
                              selectedLatheObject,
                              solverResult.cameraParameters
                            )
                            if (!solved) return null
                            return (
                              <div className='text-[10px] font-mono text-pink-200/90 bg-pink-500/10 border border-pink-500/20 rounded px-2 py-1 flex items-center justify-between'>
                                <span>
                                  Ø {(solved.baseRadius * 2).toFixed(2)}m
                                </span>
                                <span>H {solved.height.toFixed(2)}m</span>
                                <span>
                                  ({solved.centerX.toFixed(1)},{' '}
                                  {solved.centerY.toFixed(1)})
                                </span>
                              </div>
                            )
                          })()}
                      </div>
                    )}
                </div>

                {/* OPTION 8 (OPTIONAL): Parametric 3D Coffered Ceiling & Wall Panel Array Generator */}
                <div className='rounded-md border border-indigo-400/35 bg-indigo-950/20 p-2 space-y-1.5'>
                  <div className='flex items-center justify-between'>
                    <span className='text-[10.5px] font-semibold text-indigo-300'>
                      8. 3D Coffered Ceiling & Panel Grid
                    </span>
                    <span className='text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300'>
                      Optional
                    </span>
                  </div>
                  <p className='text-[10px] text-zinc-400 leading-snug'>
                    <strong className='text-indigo-200'>Best for:</strong>{' '}
                    Coffered ceiling grids, acoustic drop-tiles, repeating
                    wainscot wall paneling, or multi-pane window mullions (4
                    corners → <code className='text-indigo-300'>R × C</code> 3D
                    grid).
                  </p>

                  <div className='flex items-center justify-between pt-0.5'>
                    <Checkbox
                      title='Enable 3D coffered / panel grids'
                      isSelected={sceneBlockout.cofferedArraysEnabled ?? false}
                      onChange={(cofferedArraysEnabled) =>
                        setSceneBlockout({ cofferedArraysEnabled })
                      }
                    />
                    <button
                      type='button'
                      onClick={() => addCofferedPanelArray()}
                      className='inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/35 text-indigo-200 text-[10px] font-medium cursor-pointer'
                    >
                      <Plus className='w-3 h-3' />
                      <span>Add Grid</span>
                    </button>
                  </div>

                  {(sceneBlockout.cofferedArraysEnabled ?? false) &&
                    (sceneBlockout.cofferedArrays ?? []).length > 0 &&
                    selectedCofferedArray && (
                      <div className='space-y-1.5 bg-zinc-950/70 p-2 rounded border border-indigo-500/25 mt-1'>
                        <div className='flex items-center gap-1'>
                          <select
                            value={selectedCofferedArray.id}
                            onChange={(e) =>
                              setSceneBlockout({
                                selectedCofferedArrayId: e.target.value
                              })
                            }
                            className='flex-1 bg-zinc-900 border border-zinc-700/80 rounded px-1.5 py-1 text-[11px] text-zinc-200 focus:outline-none'
                          >
                            {(sceneBlockout.cofferedArrays ?? []).map((ca) => (
                              <option key={ca.id} value={ca.id}>
                                {ca.name}
                              </option>
                            ))}
                          </select>
                          <button
                            type='button'
                            onClick={() =>
                              removeCofferedPanelArray(selectedCofferedArray.id)
                            }
                            className='p-1 rounded text-zinc-400 hover:text-red-400 hover:bg-zinc-800 cursor-pointer'
                            title='Delete selected 3D Coffered / Panel Grid'
                          >
                            <Trash2 className='w-3.5 h-3.5' />
                          </button>
                        </div>

                        <div className='flex items-center justify-between text-[10.5px]'>
                          <span className='text-zinc-400'>Host Surface</span>
                          <select
                            value={selectedCofferedArray.hostWall}
                            onChange={(e) =>
                              updateCofferedPanelArray(
                                selectedCofferedArray.id,
                                {
                                  hostWall: e.target.value as HostWallType
                                }
                              )
                            }
                            className='bg-zinc-900 border border-zinc-700/80 rounded px-1.5 py-1 text-[10.5px] text-zinc-200'
                          >
                            <option value='ceiling-xy'>
                              Ceiling Plane (Z = Room Height)
                            </option>
                            <option value='back-wall-xz'>Back Wall (XZ)</option>
                            <option value='left-wall-yz'>Left Wall (YZ)</option>
                            <option value='right-wall-yz'>
                              Right Wall (YZ)
                            </option>
                            <option value='floor-xy'>Floor Plane (XY)</option>
                          </select>
                        </div>

                        <div className='grid grid-cols-2 gap-1.5 text-[11px]'>
                          <div className='flex items-center gap-1.5 bg-zinc-900/70 px-1.5 py-1 rounded border border-zinc-800'>
                            <span className='text-zinc-400'>Rows</span>
                            <input
                              type='range'
                              min={1}
                              max={8}
                              step={1}
                              value={selectedCofferedArray.rows}
                              onChange={(e) =>
                                updateCofferedPanelArray(
                                  selectedCofferedArray.id,
                                  {
                                    rows: parseInt(e.target.value, 10)
                                  }
                                )
                              }
                            />
                            <span className='font-mono text-indigo-300'>
                              {selectedCofferedArray.rows}
                            </span>
                          </div>

                          <div className='flex items-center gap-1.5 bg-zinc-900/70 px-1.5 py-1 rounded border border-zinc-800'>
                            <span className='text-zinc-400'>Cols</span>
                            <input
                              type='range'
                              min={1}
                              max={8}
                              step={1}
                              value={selectedCofferedArray.cols}
                              onChange={(e) =>
                                updateCofferedPanelArray(
                                  selectedCofferedArray.id,
                                  {
                                    cols: parseInt(e.target.value, 10)
                                  }
                                )
                              }
                            />
                            <span className='font-mono text-indigo-300'>
                              {selectedCofferedArray.cols}
                            </span>
                          </div>
                        </div>

                        <div className='flex items-center gap-2 text-[11px]'>
                          <span
                            className='w-16 text-zinc-400'
                            title='Width of the raised framing rails and stiles between coffered cells'
                          >
                            Frame Width
                          </span>
                          <input
                            type='range'
                            min={0.04}
                            max={0.35}
                            step={0.01}
                            value={selectedCofferedArray.stileWidthRatio}
                            onChange={(e) =>
                              updateCofferedPanelArray(
                                selectedCofferedArray.id,
                                {
                                  stileWidthRatio: parseFloat(e.target.value)
                                }
                              )
                            }
                          />
                          <span className='w-11 text-right font-mono tabular-nums text-zinc-300'>
                            {Math.round(
                              selectedCofferedArray.stileWidthRatio * 100
                            )}
                            %
                          </span>
                        </div>

                        <div className='flex items-center gap-2 text-[11px]'>
                          <span
                            className='w-16 text-zinc-400'
                            title='Chamfer / sloped bevel margin transitioning from the outer frame into each recessed coffer'
                          >
                            Bevel Slope
                          </span>
                          <input
                            type='range'
                            min={0.02}
                            max={0.35}
                            step={0.01}
                            value={selectedCofferedArray.bevelMarginRatio}
                            onChange={(e) =>
                              updateCofferedPanelArray(
                                selectedCofferedArray.id,
                                {
                                  bevelMarginRatio: parseFloat(e.target.value)
                                }
                              )
                            }
                          />
                          <span className='w-11 text-right font-mono tabular-nums text-zinc-300'>
                            {Math.round(
                              selectedCofferedArray.bevelMarginRatio * 100
                            )}
                            %
                          </span>
                        </div>

                        <div className='flex items-center gap-2 text-[11px]'>
                          <span
                            className='w-16 text-zinc-400'
                            title='Negative (-) carves recessed coffers into the ceiling/wall; Positive (+) pops raised bossed panels outward'
                          >
                            Depth ±
                          </span>
                          <input
                            type='range'
                            min={-0.45}
                            max={0.35}
                            step={0.01}
                            value={selectedCofferedArray.recessDepth}
                            onChange={(e) =>
                              updateCofferedPanelArray(
                                selectedCofferedArray.id,
                                {
                                  recessDepth: parseFloat(e.target.value)
                                }
                              )
                            }
                          />
                          <span className='w-12 text-right font-mono tabular-nums text-indigo-300'>
                            {selectedCofferedArray.recessDepth >= 0 ? '+' : ''}
                            {selectedCofferedArray.recessDepth.toFixed(2)}m
                          </span>
                        </div>
                      </div>
                    )}
                </div>

                {/* OPTION 9 (OPTIONAL): 3-Point Curved Arc Wall & Bow-Window Bay Extruder */}
                <div className='rounded-md border border-teal-500/35 bg-teal-950/15 p-2 space-y-1.5'>
                  <div className='flex items-center justify-between'>
                    <span className='text-[10.5px] font-semibold text-teal-300'>
                      9. 3-Point Curved Arc Wall & Bay
                    </span>
                    <span className='text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300'>
                      Optional
                    </span>
                  </div>
                  <p className='text-[10px] text-zinc-400 leading-snug'>
                    <strong className='text-teal-200'>Best for:</strong>{' '}
                    Sweeping curved corridor walls, rounded reception desks,
                    semi-circular apses, rotundas & bow-window bays (3 floor
                    handles + height).
                  </p>

                  <div className='flex items-center justify-between pt-0.5'>
                    <Checkbox
                      title='Enable 3-point curved arc walls'
                      isSelected={sceneBlockout.curvedWallsEnabled ?? false}
                      onChange={(curvedWallsEnabled) =>
                        setSceneBlockout({ curvedWallsEnabled })
                      }
                    />
                    <button
                      type='button'
                      onClick={() => addCurvedArcWall()}
                      className='inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/35 text-teal-200 text-[10px] font-medium cursor-pointer'
                    >
                      <Plus className='w-3 h-3' />
                      <span>Add Arc Wall</span>
                    </button>
                  </div>

                  {(sceneBlockout.curvedWallsEnabled ?? false) &&
                    (sceneBlockout.curvedWalls ?? []).length > 0 &&
                    selectedCurvedWall && (
                      <div className='space-y-1.5 bg-zinc-950/70 p-2 rounded border border-teal-500/25 mt-1'>
                        <div className='flex items-center gap-1'>
                          <select
                            value={selectedCurvedWall.id}
                            onChange={(e) =>
                              setSceneBlockout({
                                selectedCurvedWallId: e.target.value
                              })
                            }
                            className='flex-1 bg-zinc-900 border border-zinc-700/80 rounded px-1.5 py-1 text-[11px] text-zinc-200 focus:outline-none'
                          >
                            {(sceneBlockout.curvedWalls ?? []).map((cw) => (
                              <option key={cw.id} value={cw.id}>
                                {cw.name}
                              </option>
                            ))}
                          </select>
                          <button
                            type='button'
                            onClick={() =>
                              removeCurvedArcWall(selectedCurvedWall.id)
                            }
                            className='p-1 rounded text-zinc-400 hover:text-red-400 hover:bg-zinc-800 cursor-pointer'
                            title='Delete selected 3-Point Curved Arc Wall'
                          >
                            <Trash2 className='w-3.5 h-3.5' />
                          </button>
                        </div>

                        <div className='flex items-center gap-2 text-[11px]'>
                          <span className='w-16 text-zinc-400'>Height Z</span>
                          <input
                            type='range'
                            min={0.2}
                            max={6.0}
                            step={0.1}
                            value={selectedCurvedWall.heightZ}
                            onChange={(e) =>
                              updateCurvedArcWall(selectedCurvedWall.id, {
                                heightZ: parseFloat(e.target.value)
                              })
                            }
                          />
                          <span className='w-11 text-right font-mono tabular-nums text-teal-300'>
                            {selectedCurvedWall.heightZ.toFixed(2)}m
                          </span>
                        </div>

                        <div className='flex items-center gap-2 text-[11px]'>
                          <span className='w-16 text-zinc-400'>Thickness</span>
                          <input
                            type='range'
                            min={0.04}
                            max={1.0}
                            step={0.02}
                            value={selectedCurvedWall.thickness}
                            onChange={(e) =>
                              updateCurvedArcWall(selectedCurvedWall.id, {
                                thickness: parseFloat(e.target.value)
                              })
                            }
                          />
                          <span className='w-11 text-right font-mono tabular-nums text-zinc-300'>
                            {selectedCurvedWall.thickness.toFixed(2)}m
                          </span>
                        </div>

                        <div className='flex items-center gap-2 text-[11px]'>
                          <span className='w-16 text-zinc-400'>Base Z</span>
                          <input
                            type='range'
                            min={0}
                            max={3.0}
                            step={0.05}
                            value={selectedCurvedWall.baseZ}
                            onChange={(e) =>
                              updateCurvedArcWall(selectedCurvedWall.id, {
                                baseZ: parseFloat(e.target.value)
                              })
                            }
                          />
                          <span className='w-11 text-right font-mono tabular-nums text-zinc-300'>
                            {selectedCurvedWall.baseZ.toFixed(2)}m
                          </span>
                        </div>

                        <div className='flex items-center gap-2 text-[11px]'>
                          <span className='w-16 text-zinc-400'>Arc Segs</span>
                          <input
                            type='range'
                            min={8}
                            max={48}
                            step={4}
                            value={selectedCurvedWall.segments}
                            onChange={(e) =>
                              updateCurvedArcWall(selectedCurvedWall.id, {
                                segments: parseInt(e.target.value, 10)
                              })
                            }
                          />
                          <span className='w-11 text-right font-mono tabular-nums text-zinc-300'>
                            {selectedCurvedWall.segments}
                          </span>
                        </div>
                      </div>
                    )}
                </div>

                {/* ZERO-API "AI SCENE ARCHITECT BRIDGE" (OPTIONAL — Copy Prompt -> Paste JSON) */}
                <div className='rounded-md border border-indigo-500/35 bg-indigo-950/20 p-2 space-y-2'>
                  <div className='flex items-center justify-between'>
                    <div className='flex items-center gap-1.5'>
                      <Wand2 className='w-3.5 h-3.5 text-indigo-400' />
                      <span className='text-[10.5px] font-semibold text-indigo-200'>
                        AI Scene Architect Bridge
                      </span>
                    </div>
                    <span className='text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300'>
                      Zero-API · Optional
                    </span>
                  </div>

                  <p className='text-[10px] text-zinc-400 leading-snug'>
                    <strong className='text-indigo-200'>How it works:</strong> Copy our calibrated vision prompt, drop your photo + prompt into any free Vision AI (ChatGPT, Claude, Gemini), and paste the JSON reply back here to auto-build the 3D scene.
                  </p>

                  <Checkbox
                    title='Open AI Prompt & JSON Scene Importer'
                    isSelected={aiBridgeOpen}
                    onChange={(open) => {
                      setAiBridgeOpen(open)
                      setAiParseError(null)
                    }}
                  />

                  {aiBridgeOpen && (
                    <div className='space-y-2 bg-zinc-950/80 p-2 rounded border border-indigo-500/25'>
                      <div className='grid grid-cols-2 gap-1.5'>
                        <button
                          type='button'
                          onClick={() => {
                            const promptText = generateAISceneArchitectPrompt(
                              imageState.width ?? 1920,
                              imageState.height ?? 1080,
                              solverResult.cameraParameters,
                              sceneBlockout
                            )
                            void navigator.clipboard
                              .writeText(promptText)
                              .then(() => {
                                showToast(
                                  'Copied Calibrated Vision AI Prompt to clipboard!'
                                )
                              })
                              .catch(() => {
                                setAiJsonInput(promptText)
                                showToast(
                                  'Placed Vision Prompt in box below — copy it to your AI!'
                                )
                              })
                          }}
                          className='flex items-center justify-center gap-1 px-2 py-1.5 rounded bg-indigo-500/25 hover:bg-indigo-500/35 border border-indigo-500/40 text-indigo-200 text-[10.5px] font-semibold cursor-pointer'
                        >
                          <Sparkles className='w-3 h-3 text-indigo-300' />
                          <span>1. Copy AI Prompt</span>
                        </button>

                        <button
                          type='button'
                          onClick={() => {
                            setAiJsonInput(getSampleAIHallwayBlueprintJSON())
                            setAiParseError(null)
                            showToast('Loaded sample Hallway AI JSON blueprint')
                          }}
                          className='flex items-center justify-center gap-1 px-2 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-[10.5px] font-medium cursor-pointer'
                          title='Load a sample hallway JSON blueprint to test how the importer populates the 3D scene'
                        >
                          <span>Load Demo JSON</span>
                        </button>
                      </div>

                      <textarea
                        rows={5}
                        value={aiJsonInput}
                        onChange={(e) => {
                          setAiJsonInput(e.target.value)
                          if (aiParseError) setAiParseError(null)
                        }}
                        placeholder='2. Paste the JSON block returned by ChatGPT / Claude / Gemini here…'
                        className='w-full bg-zinc-900 border border-zinc-700/80 rounded p-1.5 text-[10.5px] font-mono text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-indigo-400'
                      />

                      {aiParseError && (
                        <div className='text-[10px] text-red-300 bg-red-950/60 border border-red-500/30 rounded px-2 py-1'>
                          {aiParseError}
                        </div>
                      )}

                      <button
                        type='button'
                        onClick={() => {
                          const res = parseAndApplyAISceneJSON(
                            aiJsonInput,
                            sceneBlockout
                          )
                          if (!res.ok || !res.updatedConfig) {
                            setAiParseError(
                              res.error || 'Could not parse AI JSON.'
                            )
                            return
                          }
                          setAiParseError(null)
                          setSceneBlockout(res.updatedConfig)
                          showToast(res.summary)
                        }}
                        className='w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded bg-indigo-500 hover:bg-indigo-400 text-zinc-950 font-semibold text-[11px] transition-colors cursor-pointer'
                      >
                        <Wand2 className='w-3.5 h-3.5' />
                        <span>3. Parse & Build 3D Scene from AI JSON</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* One-Click Binary .GLB 3D Scene Export */}
              <button
                type='button'
                onClick={() => {
                  void handleExportReconstructedGLB()
                }}
                className='w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-xs transition-colors cursor-pointer'
              >
                <Download className='w-3.5 h-3.5' />
                <span>Download Textured 3D Scene (.glb)</span>
              </button>
            </div>
          )}
        </div>

        {/* NEW: Perspective Texture Unwarper (Flat Wallpaper / Facade Extractor) */}
        <div className='rounded-lg border border-rose-500/30 bg-rose-950/15 p-2.5 space-y-2'>
          <div className='flex items-center gap-1.5 text-[11px] font-semibold text-rose-300'>
            <Crop className='w-3.5 h-3.5 text-rose-400' />
            <span>Flat Texture Extractor (Unwarp)</span>
          </div>

          <Checkbox
            title='Enable 4-corner surface unwarper'
            isSelected={textureUnwarp.enabled}
            onChange={(enabled) => setTextureUnwarp({ enabled })}
          />

          {textureUnwarp.enabled && (
            <div className='pt-1.5 border-t border-zinc-800/80 space-y-2'>
              <div className='space-y-1'>
                <span className='text-[10px] text-zinc-400 block'>
                  Drag TL / TR / BR / BL handles on photo
                </span>
                <select
                  value={textureUnwarp.aspectPreset}
                  onChange={(e) =>
                    setTextureUnwarp({
                      aspectPreset: e.target.value as UnwarpAspectPreset
                    })
                  }
                  className='w-full bg-zinc-900 border border-zinc-700/80 rounded-md px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-rose-500'
                >
                  <option value='auto-3d'>
                    Auto 3D Solved Aspect ({textureUnwarp.estimatedAspect.toFixed(2)}:1)
                  </option>
                  <option value='1:1'>1:1 Square Tile</option>
                  <option value='4:3'>4:3 Standard</option>
                  <option value='16:9'>16:9 Wide</option>
                </select>
              </div>

              {textureUnwarp.previewDataUrl && (
                <div className='rounded overflow-hidden border border-zinc-800 bg-zinc-950 p-1'>
                  <img
                    src={textureUnwarp.previewDataUrl}
                    alt='Unwarped flat texture preview'
                    className='w-full h-24 object-contain rounded-xs'
                  />
                </div>
              )}

              <button
                type='button'
                onClick={() => {
                  void handleDownloadUnwarpedTexture()
                }}
                className='w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-xs font-medium text-rose-200 transition-colors cursor-pointer'
              >
                <Download className='w-3.5 h-3.5 text-rose-400' />
                <span>Download Flat Texture (.png)</span>
              </button>

              {/* Opt-In Multi-Scale PBR Material Builder & Live 3D Lit Preview */}
              <div className='pt-2 border-t border-zinc-800/80 space-y-2'>
                <div className='flex items-center justify-between'>
                  <div className='flex items-center gap-1.5 text-[11px] font-semibold text-amber-300'>
                    <Sparkles className='w-3.5 h-3.5 text-amber-400' />
                    <span>Multi-Scale PBR Material Builder</span>
                  </div>
                  <span className='text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300'>
                    PBR
                  </span>
                </div>

                <Checkbox
                  title='Synthesize Normal, Roughness & AO'
                  isSelected={pbrMaterialConfig.enabled}
                  onChange={(enabled) => setPBRMaterialConfig({ enabled })}
                />

                {pbrMaterialConfig.enabled && (
                  <div className='space-y-2 pt-1'>
                    {/* Live Interactive 3D Point-Light Material Tester */}
                    <div className='rounded-md overflow-hidden border border-amber-500/35 bg-zinc-950 p-1.5 space-y-1'>
                      <div className='flex items-center justify-between text-[10px]'>
                        <span className='text-amber-300 font-medium'>
                          3D Point-Light Relight (Hover to aim light)
                        </span>
                        <button
                          type='button'
                          onClick={() =>
                            setPBRMaterialConfig({
                              previewRepeat:
                                pbrMaterialConfig.previewRepeat === 2 ? 1 : 2
                            })
                          }
                          className='px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-mono text-[9.5px] cursor-pointer'
                        >
                          {pbrMaterialConfig.previewRepeat === 2
                            ? '2×2 Tiled'
                            : '1×1 Single'}
                        </button>
                      </div>
                      <canvas
                        ref={pbrCanvasRef}
                        width={224}
                        height={144}
                        onMouseMove={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect()
                          const nx =
                            ((e.clientX - rect.left) / Math.max(1, rect.width) -
                              0.5) *
                            1.5
                          const ny =
                            (0.5 -
                              (e.clientY - rect.top) /
                                Math.max(1, rect.height)) *
                            1.5
                          pbrHoverLightRef.current = { x: nx, y: ny }
                        }}
                        onMouseLeave={() => {
                          pbrHoverLightRef.current = null
                        }}
                        className='w-full h-32 rounded-xs cursor-crosshair bg-black block'
                      />
                    </div>

                    {/* Multi-Scale Frequency & Delighting Controls */}
                    <Checkbox
                      title='Seamless toroidal tile blending'
                      isSelected={pbrMaterialConfig.seamlessTiling}
                      onChange={(seamlessTiling) =>
                        setPBRMaterialConfig({ seamlessTiling })
                      }
                    />
                    <Checkbox
                      title='Invert height (dark = raised)'
                      isSelected={pbrMaterialConfig.invertHeight}
                      onChange={(invertHeight) =>
                        setPBRMaterialConfig({ invertHeight })
                      }
                    />

                    <div className='space-y-1.5 pt-0.5'>
                      <div className='flex items-center gap-2 text-[11px]'>
                        <span className='w-14 text-zinc-400'>Delight</span>
                        <input
                          type='range'
                          min={0}
                          max={1}
                          step={0.05}
                          value={pbrMaterialConfig.delightStrength}
                          onChange={(e) =>
                            setPBRMaterialConfig({
                              delightStrength: parseFloat(e.target.value)
                            })
                          }
                        />
                        <span className='w-9 text-right font-mono tabular-nums text-zinc-300'>
                          {Math.round(pbrMaterialConfig.delightStrength * 100)}%
                        </span>
                      </div>

                      {pbrMaterialConfig.seamlessTiling && (
                        <div className='flex items-center gap-2 text-[11px]'>
                          <span className='w-14 text-zinc-400'>Seam</span>
                          <input
                            type='range'
                            min={0.05}
                            max={0.45}
                            step={0.02}
                            value={pbrMaterialConfig.seamlessBlend}
                            onChange={(e) =>
                              setPBRMaterialConfig({
                                seamlessBlend: parseFloat(e.target.value)
                              })
                            }
                          />
                          <span className='w-9 text-right font-mono tabular-nums text-zinc-300'>
                            {Math.round(pbrMaterialConfig.seamlessBlend * 100)}%
                          </span>
                        </div>
                      )}

                      <div className='flex items-center gap-2 text-[11px]'>
                        <span className='w-14 text-zinc-400'>Bump</span>
                        <input
                          type='range'
                          min={0.4}
                          max={7.0}
                          step={0.2}
                          value={pbrMaterialConfig.normalStrength}
                          onChange={(e) =>
                            setPBRMaterialConfig({
                              normalStrength: parseFloat(e.target.value)
                            })
                          }
                        />
                        <span className='w-9 text-right font-mono tabular-nums text-zinc-300'>
                          {pbrMaterialConfig.normalStrength.toFixed(1)}
                        </span>
                      </div>

                      <div className='flex items-center gap-2 text-[11px]'>
                        <span className='w-14 text-zinc-400' title='Fine Pores & Wood Grain'>
                          Micro
                        </span>
                        <input
                          type='range'
                          min={0}
                          max={2}
                          step={0.1}
                          value={pbrMaterialConfig.microWeight}
                          onChange={(e) =>
                            setPBRMaterialConfig({
                              microWeight: parseFloat(e.target.value)
                            })
                          }
                        />
                        <span className='w-9 text-right font-mono tabular-nums text-zinc-300'>
                          {pbrMaterialConfig.microWeight.toFixed(1)}
                        </span>
                      </div>

                      <div className='flex items-center gap-2 text-[11px]'>
                        <span className='w-14 text-zinc-400' title='Mortar Grooves & Bevels'>
                          Meso
                        </span>
                        <input
                          type='range'
                          min={0}
                          max={2}
                          step={0.1}
                          value={pbrMaterialConfig.mesoWeight}
                          onChange={(e) =>
                            setPBRMaterialConfig({
                              mesoWeight: parseFloat(e.target.value)
                            })
                          }
                        />
                        <span className='w-9 text-right font-mono tabular-nums text-zinc-300'>
                          {pbrMaterialConfig.mesoWeight.toFixed(1)}
                        </span>
                      </div>

                      <div className='flex items-center gap-2 text-[11px]'>
                        <span className='w-14 text-zinc-400' title='Broad 3D Brick / Board Volume'>
                          Macro
                        </span>
                        <input
                          type='range'
                          min={0}
                          max={2}
                          step={0.1}
                          value={pbrMaterialConfig.macroWeight}
                          onChange={(e) =>
                            setPBRMaterialConfig({
                              macroWeight: parseFloat(e.target.value)
                            })
                          }
                        />
                        <span className='w-9 text-right font-mono tabular-nums text-zinc-300'>
                          {pbrMaterialConfig.macroWeight.toFixed(1)}
                        </span>
                      </div>

                      <div className='flex items-center gap-2 text-[11px]'>
                        <span className='w-14 text-zinc-400'>Rough</span>
                        <input
                          type='range'
                          min={0.08}
                          max={0.95}
                          step={0.04}
                          value={pbrMaterialConfig.roughnessBase}
                          onChange={(e) =>
                            setPBRMaterialConfig({
                              roughnessBase: parseFloat(e.target.value)
                            })
                          }
                        />
                        <span className='w-9 text-right font-mono tabular-nums text-zinc-300'>
                          {Math.round(pbrMaterialConfig.roughnessBase * 100)}%
                        </span>
                      </div>

                      <div className='flex items-center gap-2 text-[11px]'>
                        <span className='w-14 text-zinc-400'>Cavity AO</span>
                        <input
                          type='range'
                          min={0}
                          max={1.5}
                          step={0.05}
                          value={pbrMaterialConfig.aoStrength}
                          onChange={(e) =>
                            setPBRMaterialConfig({
                              aoStrength: parseFloat(e.target.value)
                            })
                          }
                        />
                        <span className='w-9 text-right font-mono tabular-nums text-zinc-300'>
                          {Math.round(pbrMaterialConfig.aoStrength * 100)}%
                        </span>
                      </div>
                    </div>

                    {/* 4-Map Individual Click-to-Download Strip */}
                    {pbrMaps && (
                      <div className='space-y-1.5 pt-1'>
                        <div className='grid grid-cols-4 gap-1'>
                          {[
                            {
                              label: 'Albedo',
                              url: pbrMaps.albedoDataUrl,
                              suffix: 'Albedo_BaseColor'
                            },
                            {
                              label: 'Normal',
                              url: pbrMaps.normalDataUrl,
                              suffix: 'Normal_OpenGL'
                            },
                            {
                              label: 'Rough',
                              url: pbrMaps.roughnessDataUrl,
                              suffix: 'Roughness'
                            },
                            {
                              label: 'AO/Hgt',
                              url: pbrMaps.aoDataUrl,
                              suffix: 'AmbientOcclusion'
                            }
                          ].map((m) => (
                            <button
                              key={m.label}
                              type='button'
                              onClick={() => {
                                downloadPBRMap(
                                  m.url,
                                  uiState.projectName || 'fSpy_Material',
                                  m.suffix
                                )
                                showToast(`Downloaded ${m.label} map (.png)`)
                              }}
                              className='group relative rounded overflow-hidden border border-zinc-800 hover:border-amber-400 bg-zinc-950 p-0.5 cursor-pointer'
                              title={`Click to download ${m.label} (.png)`}
                            >
                              <img
                                src={m.url}
                                alt={m.label}
                                className='w-full h-11 object-cover rounded-2xs'
                              />
                              <span className='block text-[9px] font-mono text-zinc-300 group-hover:text-amber-300 text-center pt-0.5'>
                                {m.label}
                              </span>
                            </button>
                          ))}
                        </div>

                        <button
                          type='button'
                          onClick={() => {
                            downloadAllPBRMapsBundle(
                              pbrMaps,
                              uiState.projectName || 'fSpy_Material'
                            )
                            showToast(
                              'Downloading 5-Map PBR Pack (Albedo, Normal, Roughness, AO, Height)…'
                            )
                          }}
                          className='w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-xs transition-colors cursor-pointer'
                        >
                          <Download className='w-3.5 h-3.5' />
                          <span>Download All 5 PBR Maps (.png)</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* NEW: Cinematic 2.5D Parallax Camera Animator (Still Photo -> Moving 3D Shot) */}
        <div className='rounded-lg border border-violet-500/35 bg-violet-950/15 p-2.5 space-y-2'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-1.5 text-[11px] font-semibold text-violet-300'>
              <Video className='w-3.5 h-3.5 text-violet-400' />
              <span>2.5D Parallax Camera Animator</span>
            </div>
            <span className='text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300'>
              Motion
            </span>
          </div>

          <Checkbox
            title='Enable 2.5D parallax camera rig'
            isSelected={parallaxAnimator.enabled}
            onChange={(enabled) =>
              setParallaxAnimator({
                enabled,
                isPlaying: enabled
              })
            }
          />

          {parallaxAnimator.enabled && (
            <div className='pt-1.5 border-t border-zinc-800/80 space-y-2'>
              <div className='space-y-1'>
                <span className='text-[10px] text-zinc-400 block'>
                  Camera Motion Path Preset
                </span>
                <select
                  value={parallaxAnimator.preset}
                  onChange={(e) =>
                    setParallaxAnimator({
                      preset: e.target.value as ParallaxMotionPreset
                    })
                  }
                  className='w-full bg-zinc-900 border border-zinc-700/80 rounded-md px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-violet-500'
                >
                  <option value='orbit-arc'>3D Parallax Orbit Arc</option>
                  <option value='dolly-in'>Slow Push-In / Optical Dolly</option>
                  <option value='crane-rise'>Cinematic Crane Rise &amp; Tilt</option>
                  <option value='truck-pan'>Lateral Tracking Shot</option>
                  <option value='figure-eight'>Handheld Floating Drift</option>
                </select>
              </div>

              <div className='flex items-center gap-1.5'>
                <button
                  type='button'
                  onClick={() =>
                    setParallaxAnimator({
                      isPlaying: !parallaxAnimator.isPlaying
                    })
                  }
                  className={`flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer ${
                    parallaxAnimator.isPlaying
                      ? 'bg-violet-500 text-zinc-950'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-violet-200 border border-violet-500/40'
                  }`}
                >
                  {parallaxAnimator.isPlaying ? (
                    <>
                      <Pause className='w-3.5 h-3.5' />
                      <span>Pause Motion</span>
                    </>
                  ) : (
                    <>
                      <Play className='w-3.5 h-3.5' />
                      <span>Play Motion</span>
                    </>
                  )}
                </button>
              </div>

              {!parallaxAnimator.isPlaying && (
                <div className='flex items-center gap-2 text-[11px]'>
                  <span className='w-12 text-zinc-400'>Scrub</span>
                  <input
                    type='range'
                    min={0}
                    max={1}
                    step={0.01}
                    value={parallaxAnimator.manualPhase}
                    onChange={(e) =>
                      setParallaxAnimator({
                        manualPhase: parseFloat(e.target.value)
                      })
                    }
                  />
                  <span className='w-9 text-right font-mono tabular-nums text-zinc-300'>
                    {Math.round(parallaxAnimator.manualPhase * 100)}%
                  </span>
                </div>
              )}

              <div className='flex items-center gap-2 text-[11px]'>
                <span className='w-12 text-zinc-400'>Travel</span>
                <input
                  type='range'
                  min={0.1}
                  max={2.2}
                  step={0.05}
                  value={parallaxAnimator.amplitude}
                  onChange={(e) =>
                    setParallaxAnimator({
                      amplitude: parseFloat(e.target.value)
                    })
                  }
                />
                <span className='w-9 text-right font-mono tabular-nums text-zinc-300'>
                  {parallaxAnimator.amplitude.toFixed(2)}m
                </span>
              </div>

              <div className='flex items-center gap-2 text-[11px]'>
                <span className='w-12 text-zinc-400'>Duration</span>
                <input
                  type='range'
                  min={1.5}
                  max={10}
                  step={0.5}
                  value={parallaxAnimator.durationSec}
                  onChange={(e) =>
                    setParallaxAnimator({
                      durationSec: parseFloat(e.target.value)
                    })
                  }
                />
                <span className='w-9 text-right font-mono tabular-nums text-zinc-300'>
                  {parallaxAnimator.durationSec.toFixed(1)}s
                </span>
              </div>

              <div className='flex items-center gap-2 text-[11px]'>
                <span className='w-12 text-zinc-400'>Target Z</span>
                <input
                  type='range'
                  min={0}
                  max={3}
                  step={0.1}
                  value={parallaxAnimator.lookAtHeightZ}
                  onChange={(e) =>
                    setParallaxAnimator({
                      lookAtHeightZ: parseFloat(e.target.value)
                    })
                  }
                />
                <span className='w-9 text-right font-mono tabular-nums text-zinc-300'>
                  {parallaxAnimator.lookAtHeightZ.toFixed(1)}m
                </span>
              </div>

              <Checkbox
                title='Smooth ping-pong loop'
                isSelected={parallaxAnimator.pingPong}
                onChange={(pingPong) => setParallaxAnimator({ pingPong })}
              />

              <button
                type='button'
                disabled={recordingVideo}
                onClick={handleRecordParallaxVideo}
                className='w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded bg-violet-500/25 hover:bg-violet-500/35 border border-violet-500/45 text-xs font-semibold text-violet-200 transition-colors cursor-pointer disabled:opacity-50'
              >
                <Download className='w-3.5 h-3.5 text-violet-300' />
                <span>
                  {recordingVideo
                    ? 'Recording 2.5D Clip…'
                    : 'Record 2.5D Video (.webm)'}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* 1. Multi-Line Least-Squares Vanishing Point Solver */}
        <div className='rounded-lg border border-zinc-800/90 bg-zinc-900/50 p-2.5 space-y-2'>
          <Checkbox
            title='Multi-line least-squares VP'
            isSelected={multiLineSolverEnabled}
            onChange={setMultiLineSolverEnabled}
          />
          <Checkbox
            title='Show line residual errors (°)'
            isSelected={showResidualErrorHUD}
            onChange={setShowResidualErrorHUD}
          />

          {multiLineSolverEnabled && (
            <div className='pt-1.5 border-t border-zinc-800/80 space-y-1.5'>
              {/* VP 1 Line Count */}
              <div className='flex items-center justify-between text-xs'>
                <span className='text-zinc-400'>VP 1 lines ({vp1Count}/6)</span>
                <div className='flex items-center gap-1'>
                  <button
                    type='button'
                    disabled={vp1Count <= 2}
                    onClick={() => removeVPLineSegment(0)}
                    className='p-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 text-zinc-200 cursor-pointer'
                    title='Remove line from VP 1'
                  >
                    <Minus className='w-3 h-3' />
                  </button>
                  <button
                    type='button'
                    disabled={vp1Count >= 6}
                    onClick={() => addVPLineSegment(0)}
                    className='p-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 text-zinc-200 cursor-pointer'
                    title='Add line to VP 1'
                  >
                    <Plus className='w-3 h-3' />
                  </button>
                </div>
              </div>

              {/* VP 2 Line Count */}
              {!is1VPMode && !calibrationSettings2VP.quadModeEnabled && (
                <div className='flex items-center justify-between text-xs'>
                  <span className='text-zinc-400'>VP 2 lines ({vp2Count}/6)</span>
                  <div className='flex items-center gap-1'>
                    <button
                      type='button'
                      disabled={vp2Count <= 2}
                      onClick={() => removeVPLineSegment(1)}
                      className='p-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 text-zinc-200 cursor-pointer'
                      title='Remove line from VP 2'
                    >
                      <Minus className='w-3 h-3' />
                    </button>
                    <button
                      type='button'
                      disabled={vp2Count >= 6}
                      onClick={() => addVPLineSegment(1)}
                      className='p-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 text-zinc-200 cursor-pointer'
                      title='Add line to VP 2'
                    >
                      <Plus className='w-3 h-3' />
                    </button>
                  </div>
                </div>
              )}

              {/* VP 3 Line Count */}
              {!is1VPMode &&
                calibrationSettings2VP.principalPointMode ===
                  PrincipalPointMode2VP.FromThirdVanishingPoint && (
                  <div className='flex items-center justify-between text-xs'>
                    <span className='text-zinc-400'>VP 3 lines ({vp3Count}/6)</span>
                    <div className='flex items-center gap-1'>
                      <button
                        type='button'
                        disabled={vp3Count <= 2}
                        onClick={() => removeVPLineSegment(2)}
                        className='p-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 text-zinc-200 cursor-pointer'
                        title='Remove line from VP 3'
                      >
                        <Minus className='w-3 h-3' />
                      </button>
                      <button
                        type='button'
                        disabled={vp3Count >= 6}
                        onClick={() => addVPLineSegment(2)}
                        className='p-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 text-zinc-200 cursor-pointer'
                        title='Add line to VP 3'
                      >
                        <Plus className='w-3 h-3' />
                      </button>
                    </div>
                  </div>
                )}
            </div>
          )}
        </div>

        {/* 2. Automatic Edge Snapping & Line Detection Assistant */}
        <div className='rounded-lg border border-zinc-800/90 bg-zinc-900/50 p-2.5 space-y-2'>
          <div className='flex items-center gap-1.5 text-[11px] font-medium text-zinc-300'>
            <Magnet className='w-3.5 h-3.5 text-cyan-400' />
            <span>Edge &amp; Line Assistant</span>
          </div>
          <Checkbox
            title='Magnetic sub-pixel edge snap'
            isSelected={edgeSnappingEnabled}
            onChange={setEdgeSnappingEnabled}
          />
          <Checkbox
            title='Show detected straight edges'
            isSelected={showDetectedEdgesOverlay}
            onChange={setShowDetectedEdgesOverlay}
          />
          <button
            type='button'
            onClick={() => {
              void handleAutoDetectLinesClick()
            }}
            className='w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-medium text-zinc-200 transition-colors cursor-pointer'
          >
            <Wand2 className='w-3.5 h-3.5 text-cyan-400' />
            <span>Auto-Suggest VP Lines</span>
          </button>
        </div>

        {/* 3. Radial Lens Distortion Undistortion (k1, k2 Brown-Conrady) */}
        <div className='rounded-lg border border-zinc-800/90 bg-zinc-900/50 p-2.5 space-y-2'>
          <div className='flex items-center gap-1.5 text-[11px] font-medium text-zinc-300'>
            <Aperture className='w-3.5 h-3.5 text-violet-400' />
            <span>Radial Lens Undistortion</span>
          </div>
          <Checkbox
            title='Enable k1 / k2 undistortion'
            isSelected={lensDistortionEnabled}
            onChange={setLensDistortionEnabled}
          />

          {lensDistortionEnabled && (
            <div className='pt-1.5 border-t border-zinc-800/80 space-y-2'>
              <div className='flex items-center justify-between text-[11px] text-zinc-400'>
                <span>Barrel / Pincushion</span>
                <button
                  type='button'
                  onClick={() => setLensDistortionParams(0, 0)}
                  className='inline-flex items-center gap-1 text-[10px] text-zinc-400 hover:text-zinc-200 cursor-pointer'
                >
                  <RotateCcw className='w-2.5 h-2.5' />
                  <span>Reset</span>
                </button>
              </div>

              <div className='flex items-center gap-2 text-[11px]'>
                <span className='w-5 font-mono text-violet-300'>k1</span>
                <input
                  type='range'
                  min={-0.35}
                  max={0.35}
                  step={0.005}
                  value={lensK1}
                  onChange={(e) =>
                    setLensDistortionParams(parseFloat(e.target.value), lensK2)
                  }
                />
                <span className='w-11 text-right font-mono tabular-nums text-zinc-300'>
                  {lensK1.toFixed(3)}
                </span>
              </div>

              <div className='flex items-center gap-2 text-[11px]'>
                <span className='w-5 font-mono text-violet-300'>k2</span>
                <input
                  type='range'
                  min={-0.2}
                  max={0.2}
                  step={0.005}
                  value={lensK2}
                  onChange={(e) =>
                    setLensDistortionParams(lensK1, parseFloat(e.target.value))
                  }
                />
                <span className='w-11 text-right font-mono tabular-nums text-zinc-300'>
                  {lensK2.toFixed(3)}
                </span>
              </div>

              <div className='grid grid-cols-1 gap-1.5 pt-0.5'>
                <button
                  type='button'
                  onClick={autoEstimateLensK1}
                  className='w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-medium text-zinc-200 transition-colors cursor-pointer'
                >
                  <Sparkles className='w-3.5 h-3.5 text-violet-400' />
                  <span>Auto-Estimate k1 from VP Lines</span>
                </button>
                <button
                  type='button'
                  onClick={() => {
                    void handleExportUndistortedPlate()
                  }}
                  className='w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-medium text-zinc-200 transition-colors cursor-pointer'
                >
                  <Download className='w-3.5 h-3.5 text-violet-400' />
                  <span>Export Undistorted Plate (.png)</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 4. Multi-Reference 3D World Ruler / Tape Measure */}
        <div className='rounded-lg border border-zinc-800/90 bg-zinc-900/50 p-2.5 space-y-2'>
          <div className='flex items-center gap-1.5 text-[11px] font-medium text-zinc-300'>
            <Ruler className='w-3.5 h-3.5 text-emerald-400' />
            <span>3D World Tape Measure</span>
          </div>
          <Checkbox
            title='Enable interactive 3D ruler'
            isSelected={worldRulerEnabled}
            onChange={setWorldRulerEnabled}
          />
          {worldRulerEnabled && (
            <div className='pt-1.5 border-t border-zinc-800/80 space-y-1.5'>
              <span className='text-[11px] text-zinc-400 block'>
                Measurement Constraint Plane
              </span>
              <select
                value={worldRulerPlane}
                onChange={(e) =>
                  setWorldRulerPlane(e.target.value as WorldRulerPlane)
                }
                className='w-full bg-zinc-900 border border-zinc-700/80 rounded-md px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500'
              >
                <option value='ground-xy'>Ground Floor Plane (Z = 0)</option>
                <option value='vertical-z'>Vertical Height Plumb (Z Axis)</option>
                <option value='wall-xz'>XZ Wall Plane (Y = 0)</option>
                <option value='wall-yz'>YZ Wall Plane (X = 0)</option>
              </select>
            </div>
          )}
        </div>

        {/* 5. Interactive 3D Proxy Objects, Custom .GLB/.OBJ & Sun Shadow Matcher */}
        <div className='rounded-lg border border-zinc-800/90 bg-zinc-900/50 p-2.5 space-y-2.5'>
          <div className='flex items-center gap-1.5 text-[11px] font-medium text-zinc-300'>
            <Box className='w-3.5 h-3.5 text-amber-400' />
            <span>3D Proxy &amp; Shadow Matcher</span>
          </div>
          <Checkbox
            title='Enable 3D proxy mesh'
            isSelected={showThreeMeshOverlay}
            onChange={setShowThreeMeshOverlay}
          />

          {showThreeMeshOverlay && (
            <div className='pt-1.5 border-t border-zinc-800/80 space-y-2.5'>
              <div className='space-y-1'>
                <span className='text-[11px] text-zinc-400'>Proxy Mesh Preset</span>
                <select
                  value={threeProxyPreset}
                  onChange={(e) =>
                    setThreeProxyPreset(e.target.value as ThreeProxyPreset)
                  }
                  className='w-full bg-zinc-900 border border-zinc-700/80 rounded-md px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-amber-500'
                >
                  <option value='calibration-rig'>Optical Calibration Tower</option>
                  <option value='human-1.8m'>1.8m Human Scale Reference</option>
                  <option value='arch-portal'>Architectural Portal / Arch</option>
                  <option value='vehicle-sedan'>Vehicle Proportion Blockout</option>
                  <option value='checker-floor'>Checkerboard Floor Grid</option>
                  {customModelName && (
                    <option value='custom-model'>Custom: {customModelName}</option>
                  )}
                </select>
              </div>

              <button
                type='button'
                onClick={() => modelInputRef.current?.click()}
                className='w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-medium text-zinc-200 transition-colors cursor-pointer'
              >
                <Upload className='w-3.5 h-3.5 text-amber-400' />
                <span className='truncate'>
                  {customModelName ? `Loaded: ${customModelName}` : 'Load Custom .glb / .obj…'}
                </span>
              </button>

              <Checkbox
                title='Wireframe proxy material'
                isSelected={threeProxyTransform.wireframe}
                onChange={(wireframe) => setThreeProxyTransform({ wireframe })}
              />

              {/* World X / Y / Z Offset Sliders */}
              <div className='space-y-1.5 pt-1'>
                <div className='flex items-center justify-between text-[11px] text-zinc-400'>
                  <span>Slide X / Y / Z (World)</span>
                  <button
                    type='button'
                    onClick={resetThreeProxyTransform}
                    className='inline-flex items-center gap-1 text-[10px] text-zinc-400 hover:text-zinc-200 cursor-pointer'
                    title='Reset 3D Proxy Transform'
                  >
                    <RotateCcw className='w-2.5 h-2.5' />
                    <span>Reset</span>
                  </button>
                </div>

                <div className='flex items-center gap-2 text-[11px]'>
                  <span className='w-4 font-mono text-red-400'>X</span>
                  <input
                    type='range'
                    min={-6}
                    max={6}
                    step={0.1}
                    value={threeProxyTransform.offsetX}
                    onChange={(e) =>
                      setThreeProxyTransform({ offsetX: parseFloat(e.target.value) })
                    }
                  />
                  <span className='w-9 text-right font-mono tabular-nums text-zinc-300'>
                    {threeProxyTransform.offsetX.toFixed(1)}
                  </span>
                </div>

                <div className='flex items-center gap-2 text-[11px]'>
                  <span className='w-4 font-mono text-emerald-400'>Y</span>
                  <input
                    type='range'
                    min={-6}
                    max={6}
                    step={0.1}
                    value={threeProxyTransform.offsetY}
                    onChange={(e) =>
                      setThreeProxyTransform({ offsetY: parseFloat(e.target.value) })
                    }
                  />
                  <span className='w-9 text-right font-mono tabular-nums text-zinc-300'>
                    {threeProxyTransform.offsetY.toFixed(1)}
                  </span>
                </div>

                <div className='flex items-center gap-2 text-[11px]'>
                  <span className='w-4 font-mono text-blue-400'>Z</span>
                  <input
                    type='range'
                    min={-3}
                    max={3}
                    step={0.1}
                    value={threeProxyTransform.offsetZ}
                    onChange={(e) =>
                      setThreeProxyTransform({ offsetZ: parseFloat(e.target.value) })
                    }
                  />
                  <span className='w-9 text-right font-mono tabular-nums text-zinc-300'>
                    {threeProxyTransform.offsetZ.toFixed(1)}
                  </span>
                </div>

                <div className='flex items-center gap-2 text-[11px]'>
                  <span className='w-8 text-zinc-400'>Rot Z</span>
                  <input
                    type='range'
                    min={-180}
                    max={180}
                    step={5}
                    value={threeProxyTransform.rotationZ}
                    onChange={(e) =>
                      setThreeProxyTransform({ rotationZ: parseFloat(e.target.value) })
                    }
                  />
                  <span className='w-9 text-right font-mono tabular-nums text-zinc-300'>
                    {threeProxyTransform.rotationZ}°
                  </span>
                </div>

                <div className='flex items-center gap-2 text-[11px]'>
                  <span className='w-8 text-zinc-400'>Scale</span>
                  <input
                    type='range'
                    min={0.2}
                    max={3}
                    step={0.05}
                    value={threeProxyTransform.scale}
                    onChange={(e) =>
                      setThreeProxyTransform({ scale: parseFloat(e.target.value) })
                    }
                  />
                  <span className='w-9 text-right font-mono tabular-nums text-zinc-300'>
                    {threeProxyTransform.scale.toFixed(2)}×
                  </span>
                </div>
              </div>

              {/* Opt-In Sun & Shadow-Catcher Direction Matcher */}
              <div className='pt-2 border-t border-zinc-800/80 space-y-2'>
                <div className='flex items-center gap-1.5 text-[11px] font-medium text-amber-300'>
                  <Sun className='w-3.5 h-3.5 text-amber-400' />
                  <span>Sun &amp; Ground Shadow-Catcher</span>
                </div>
                <Checkbox
                  title='Enable ground shadow-catcher'
                  isSelected={sunShadowConfig.enabled}
                  onChange={(enabled) => setSunShadowConfig({ enabled })}
                />

                {sunShadowConfig.enabled && (
                  <div className='space-y-1.5 pt-1'>
                    <div className='flex items-center gap-2 text-[11px]'>
                      <span className='w-10 text-zinc-400'>Azimuth</span>
                      <input
                        type='range'
                        min={0}
                        max={360}
                        step={2}
                        value={sunShadowConfig.azimuthDeg}
                        onChange={(e) =>
                          setSunShadowConfig({
                            azimuthDeg: parseFloat(e.target.value)
                          })
                        }
                      />
                      <span className='w-9 text-right font-mono tabular-nums text-zinc-300'>
                        {sunShadowConfig.azimuthDeg}°
                      </span>
                    </div>

                    <div className='flex items-center gap-2 text-[11px]'>
                      <span className='w-10 text-zinc-400'>Elev</span>
                      <input
                        type='range'
                        min={6}
                        max={88}
                        step={1}
                        value={sunShadowConfig.elevationDeg}
                        onChange={(e) =>
                          setSunShadowConfig({
                            elevationDeg: parseFloat(e.target.value)
                          })
                        }
                      />
                      <span className='w-9 text-right font-mono tabular-nums text-zinc-300'>
                        {sunShadowConfig.elevationDeg}°
                      </span>
                    </div>

                    <div className='flex items-center gap-2 text-[11px]'>
                      <span className='w-10 text-zinc-400'>Shadow</span>
                      <input
                        type='range'
                        min={0.15}
                        max={0.95}
                        step={0.05}
                        value={sunShadowConfig.shadowOpacity}
                        onChange={(e) =>
                          setSunShadowConfig({
                            shadowOpacity: parseFloat(e.target.value)
                          })
                        }
                      />
                      <span className='w-9 text-right font-mono tabular-nums text-zinc-300'>
                        {Math.round(sunShadowConfig.shadowOpacity * 100)}%
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 6. Calibration Snapshot Slots (A/B/C/D) & Local Browser Auto-Save */}
        <div className='rounded-lg border border-zinc-800/90 bg-zinc-900/50 p-2.5 space-y-2.5'>
          <div className='flex items-center gap-1.5 text-[11px] font-medium text-zinc-300'>
            <Bookmark className='w-3.5 h-3.5 text-sky-400' />
            <span>Snapshots &amp; Persistence</span>
          </div>

          <Checkbox
            title='Enable A/B/C/D snapshot slots'
            isSelected={snapshotSlotsEnabled}
            onChange={setSnapshotSlotsEnabled}
          />

          {snapshotSlotsEnabled && (
            <div className='pt-1.5 border-t border-zinc-800/80 space-y-1.5'>
              <div className='text-[10px] text-zinc-500 flex items-center justify-between'>
                <span>Compare candidate solves</span>
                <span className='font-mono'>Alt+1..4</span>
              </div>
              <div className='grid grid-cols-2 gap-1.5'>
                {SNAPSHOT_SLOTS.map(({ index, label }) => {
                  const snap = snapshots[index]
                  const isActive = activeSnapshotSlot === index
                  return (
                    <div
                      key={label}
                      className={`p-2 rounded border text-[11px] space-y-1.5 transition-colors ${
                        isActive
                          ? 'bg-sky-500/10 border-sky-500/40'
                          : 'bg-zinc-950/60 border-zinc-800'
                      }`}
                    >
                      <div className='flex items-center justify-between'>
                        <span className='font-mono font-bold text-zinc-200'>
                          Slot {label}
                        </span>
                        {snap && (
                          <button
                            type='button'
                            onClick={() => clearSnapshotSlot(index)}
                            className='text-zinc-500 hover:text-red-400 cursor-pointer'
                            title={`Clear Slot ${label}`}
                          >
                            <Trash2 className='w-3 h-3' />
                          </button>
                        )}
                      </div>

                      {snap ? (
                        <div className='text-[10px] font-mono text-zinc-400 space-y-0.5 tabular-nums'>
                          <div>
                            {snap.focalMm
                              ? `${snap.focalMm.toFixed(1)}mm`
                              : 'Unsolved'}{' '}
                            ·{' '}
                            {snap.hfovDeg ? `${snap.hfovDeg.toFixed(1)}°` : '—'}
                          </div>
                          {snap.rmsDeg !== null && (
                            <div className='text-emerald-400'>
                              RMS {snap.rmsDeg.toFixed(3)}°
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className='text-[10px] text-zinc-600 italic'>
                          Empty slot
                        </div>
                      )}

                      <div className='flex items-center gap-1 pt-0.5'>
                        <button
                          type='button'
                          onClick={() => captureSnapshotSlot(index)}
                          className='flex-1 py-0.5 px-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[10px] font-medium cursor-pointer'
                        >
                          Save
                        </button>
                        {snap && (
                          <button
                            type='button'
                            onClick={() => restoreSnapshotSlot(index)}
                            className='flex-1 py-0.5 px-1.5 rounded bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 text-[10px] font-medium cursor-pointer'
                          >
                            Load
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className='pt-1 border-t border-zinc-800/80'>
            <Checkbox
              title='Opt-in browser auto-save (IDB)'
              isSelected={autoSaveEnabled}
              onChange={setAutoSaveEnabled}
            />
            {autoSaveEnabled && (
              <div className='mt-1 flex items-center gap-1.5 text-[10px] text-emerald-400/90'>
                <Database className='w-3 h-3 shrink-0' />
                <span>Workspace auto-saved locally in IndexedDB</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  )
}
