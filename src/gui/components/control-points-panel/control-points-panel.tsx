/**
 * fSpy
 * Copyright (c) 2020 - Per Gantelius
 */

import {
  Box,
  ChevronDown,
  ChevronUp,
  Layers,
  Magnet,
  Maximize2,
  Orbit,
  RotateCcw,
  Ruler,
  Video,
  ZoomIn,
  ZoomOut
} from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'
import AABB from '../../solver/aabb'
import AABBOps from '../../solver/aabb-ops'
import CoordinatesUtil, {
  ImageCoordinateFrame
} from '../../solver/coordinates-util'
import {
  buildEdgeGradientMap,
  DetectedEdgeSegment,
  snapRelativePointToEdge
} from '../../solver/edge-detector'
import {
  computeWorldRulerDistance,
  renderUndistortedImage,
  undistortRelativePoint
} from '../../solver/lens-distortion'
import MathUtil from '../../solver/math-util'
import Point2D from '../../solver/point-2d'
import {
  computeProjectedBlockoutVolumeHandles,
  computeRepeatedCloneWireframesSVG,
  estimateQuadPhysicalAspect,
  projectBlockoutPointToRelative,
  renderUnwarpedQuadTexture,
  solveExtrudedHeightZFromRelativePoint,
  solveRevolvedLathe3D,
  solveSweptColumn3D,
  unprojectRelativePointToGroundXY,
  unprojectRelativePointToPlaneZ
} from '../../solver/scene-reconstruction'
import Solver from '../../solver/solver'
import { useFSpyStore } from '../../store/use-fspy-store'
import { Palette } from '../../style/palette'
import {
  Axis,
  PrincipalPointMode1VP,
  PrincipalPointMode2VP,
  ReferenceDistanceUnit
} from '../../types/calibration-settings'
import {
  ControlPointPairIndex,
  ControlPointPairState,
  VanishingPointControlState
} from '../../types/control-points-state'
import { CalibrationMode, Overlay3DGuide } from '../../types/global-settings'
import ControlPoint from './control-point'
import HorizonControl from './horizon-control'
import MagnifyingGlass from './magnifying-glass'
import OriginControl from './origin-control'
import Overlay3DPanel from './overlay-3d-panel'
import PrincipalPointControl from './principal-point-control'
import ReferenceDistanceControl from './reference-distance-control'
import ThreeOverlay from './three-overlay'
import VanishingPointControl from './vanishing-point-control'

export default function ControlPointsPanel() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [bounds, setBounds] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0
  })
  const [magnifyingGlassPosition, setMagnifyingGlassPosition] =
    useState<Point2D>({ x: 0, y: 0 })
  const [isDraggingControlPoint, setIsDraggingControlPoint] = useState(false)
  const [shiftIsDown, setShiftIsDown] = useState(false)
  const [altIsDown, setAltIsDown] = useState(false)
  const [spaceIsDown, setSpaceIsDown] = useState(false)
  const [isPanning, setIsPanning] = useState(false)
  const [dockCollapsed, setDockCollapsed] = useState(false)
  const [snappedIndicatorPos, setSnappedIndicatorPos] =
    useState<Point2D | null>(null)
  const [snappedSegmentAbs, setSnappedSegmentAbs] = useState<{
    p1: Point2D
    p2: Point2D
  } | null>(null)
  const [snappedKind, setSnappedKind] = useState<
    'corner' | 'segment' | 'ridge' | null
  >(null)
  const [footprintDrag, setFootprintDrag] = useState<{
    startAbs: Point2D
    currentAbs: Point2D
  } | null>(null)

  const panStartRef = useRef<{
    clientX: number
    clientY: number
    panX: number
    panY: number
  } | null>(null)

  const globalSettings = useFSpyStore((s) => s.globalSettings)
  const imageState = useFSpyStore((s) => s.image)
  const uiState = useFSpyStore((s) => s.uiState)
  const calibrationSettingsBase = useFSpyStore((s) => s.calibrationSettingsBase)
  const calibrationSettings1VP = useFSpyStore((s) => s.calibrationSettings1VP)
  const calibrationSettings2VP = useFSpyStore((s) => s.calibrationSettings2VP)
  const controlPointsStateBase = useFSpyStore((s) => s.controlPointsStateBase)
  const controlPointsState1VP = useFSpyStore((s) => s.controlPointsState1VP)
  const controlPointsState2VP = useFSpyStore((s) => s.controlPointsState2VP)
  const solverResult = useFSpyStore((s) => s.solverResult)
  const viewport = useFSpyStore((s) => s.viewport)

  // Opt-In Fork States
  const showResidualErrorHUD = useFSpyStore((s) => s.showResidualErrorHUD)
  const edgeSnappingEnabled = useFSpyStore((s) => s.edgeSnappingEnabled)
  const showDetectedEdgesOverlay = useFSpyStore(
    (s) => s.showDetectedEdgesOverlay
  )
  const edgeMap = useFSpyStore((s) => s.edgeMap)
  const showThreeMeshOverlay = useFSpyStore((s) => s.showThreeMeshOverlay)
  const threeProxyPreset = useFSpyStore((s) => s.threeProxyPreset)
  const threeProxyTransform = useFSpyStore((s) => s.threeProxyTransform)
  const customModelUrl = useFSpyStore((s) => s.customModelUrl)
  const customModelFormat = useFSpyStore((s) => s.customModelFormat)
  const sunShadowConfig = useFSpyStore((s) => s.sunShadowConfig)

  const lensDistortionEnabled = useFSpyStore((s) => s.lensDistortionEnabled)
  const lensK1 = useFSpyStore((s) => s.lensK1)
  const lensK2 = useFSpyStore((s) => s.lensK2)
  const undistortedImageUrl = useFSpyStore((s) => s.undistortedImageUrl)

  const worldRulerEnabled = useFSpyStore((s) => s.worldRulerEnabled)
  const worldRulerPlane = useFSpyStore((s) => s.worldRulerPlane)
  const worldRulerPoints = useFSpyStore((s) => s.worldRulerPoints)

  const sceneBlockout = useFSpyStore((s) => s.sceneBlockout)
  const activeSceneTool = useFSpyStore((s) => s.activeSceneTool)
  const textureUnwarp = useFSpyStore((s) => s.textureUnwarp)
  const parallaxAnimator = useFSpyStore((s) => s.parallaxAnimator)

  const setViewport = useFSpyStore((s) => s.setViewport)
  const resetViewport = useFSpyStore((s) => s.resetViewport)
  const setShowThreeMeshOverlay = useFSpyStore((s) => s.setShowThreeMeshOverlay)
  const setEdgeSnappingEnabled = useFSpyStore((s) => s.setEdgeSnappingEnabled)
  const setEdgeMap = useFSpyStore((s) => s.setEdgeMap)
  const setUndistortedImageUrl = useFSpyStore((s) => s.setUndistortedImageUrl)
  const setWorldRulerEnabled = useFSpyStore((s) => s.setWorldRulerEnabled)
  const setWorldRulerPoint = useFSpyStore((s) => s.setWorldRulerPoint)
  const setSceneBlockout = useFSpyStore((s) => s.setSceneBlockout)
  const setActiveSidebarTab = useFSpyStore((s) => s.setActiveSidebarTab)
  const setActiveSceneTool = useFSpyStore((s) => s.setActiveSceneTool)
  const addBlockoutVolume = useFSpyStore((s) => s.addBlockoutVolume)
  const updateBlockoutVolume = useFSpyStore((s) => s.updateBlockoutVolume)
  const setBillboardPolygonVertex = useFSpyStore(
    (s) => s.setBillboardPolygonVertex
  )
  const updateSweptWallRail = useFSpyStore((s) => s.updateSweptWallRail)
  const setSweptRailWaypoint = useFSpyStore((s) => s.setSweptRailWaypoint)
  const setWallCutoutCorner = useFSpyStore((s) => s.setWallCutoutCorner)
  const updateWallReliefExtrusion = useFSpyStore(
    (s) => s.updateWallReliefExtrusion
  )
  const setWallReliefCorner = useFSpyStore((s) => s.setWallReliefCorner)
  const updateSweptCylinderColumn = useFSpyStore(
    (s) => s.updateSweptCylinderColumn
  )
  const updateStaircaseExtrusion = useFSpyStore(
    (s) => s.updateStaircaseExtrusion
  )
  const updateFloorPolygonPrism = useFSpyStore(
    (s) => s.updateFloorPolygonPrism
  )
  const setFloorPrismVertex = useFSpyStore((s) => s.setFloorPrismVertex)
  const updateRevolvedLatheObject = useFSpyStore(
    (s) => s.updateRevolvedLatheObject
  )
  const setCofferedArrayCorner = useFSpyStore((s) => s.setCofferedArrayCorner)
  const updateCurvedArcWall = useFSpyStore((s) => s.updateCurvedArcWall)
  const setTextureUnwarp = useFSpyStore((s) => s.setTextureUnwarp)
  const setTextureUnwarpCorner = useFSpyStore((s) => s.setTextureUnwarpCorner)
  const setParallaxAnimator = useFSpyStore((s) => s.setParallaxAnimator)
  const setOverlay3DGuide = useFSpyStore((s) => s.setOverlay3DGuide)
  const setImageOpacity = useFSpyStore((s) => s.setImageOpacity)
  const resetControlPoints = useFSpyStore((s) => s.resetControlPoints)
  const showToast = useFSpyStore((s) => s.showToast)

  const setOriginPosition = useFSpyStore((s) => s.setOriginPosition)
  const setPrincipalPointPosition = useFSpyStore(
    (s) => s.setPrincipalPointPosition
  )
  const setReferenceDistanceAnchor = useFSpyStore(
    (s) => s.setReferenceDistanceAnchor
  )
  const setReferenceDistanceHandleOffset = useFSpyStore(
    (s) => s.setReferenceDistanceHandleOffset
  )
  const setHorizonControlPointPosition = useFSpyStore(
    (s) => s.setHorizonControlPointPosition
  )
  const setFirstVPControlPoint = useFSpyStore((s) => s.setFirstVPControlPoint)
  const setSecondVPControlPoint = useFSpyStore((s) => s.setSecondVPControlPoint)
  const setThirdVPControlPoint = useFSpyStore((s) => s.setThirdVPControlPoint)

  const activeImageSrc =
    lensDistortionEnabled && undistortedImageUrl
      ? undistortedImageUrl
      : imageState.url

  // Pre-warm Sobel/NMS edge map whenever an image is loaded so snapping is instant
  useEffect(() => {
    if (!imageState.url || edgeMap) return

    let cancelled = false
    void buildEdgeGradientMap(imageState.url).then((computed) => {
      if (!cancelled && computed) {
        setEdgeMap(computed)
      }
    })
    return () => {
      cancelled = true
    }
  }, [imageState.url, edgeMap, setEdgeMap])

  // Render undistorted backdrop image when Opt-In Lens Distortion is enabled
  useEffect(() => {
    if (
      !lensDistortionEnabled ||
      !imageState.url ||
      (Math.abs(lensK1) < 1e-6 && Math.abs(lensK2) < 1e-6)
    ) {
      setUndistortedImageUrl(null)
      return
    }

    let cancelled = false
    const timer = window.setTimeout(() => {
      void renderUndistortedImage(imageState.url!, lensK1, lensK2, 1400).then(
        (res) => {
          if (!cancelled) {
            setUndistortedImageUrl(res ? res.url : null)
          }
        }
      )
    }, 90)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [
    lensDistortionEnabled,
    lensK1,
    lensK2,
    imageState.url,
    setUndistortedImageUrl
  ])

  // Live Perspective Texture Unwarp Preview Generator (Opt-In)
  useEffect(() => {
    if (!textureUnwarp.enabled || !activeImageSrc) return

    const autoAspect = estimateQuadPhysicalAspect(
      textureUnwarp.quad,
      solverResult.cameraParameters
    )
    const targetAspect =
      textureUnwarp.aspectPreset === '1:1'
        ? 1
        : textureUnwarp.aspectPreset === '4:3'
          ? 4 / 3
          : textureUnwarp.aspectPreset === '16:9'
            ? 16 / 9
            : autoAspect

    let cancelled = false
    const timer = window.setTimeout(() => {
      void renderUnwarpedQuadTexture(
        activeImageSrc,
        textureUnwarp.quad,
        targetAspect,
        360
      ).then((res) => {
        if (!cancelled && res) {
          setTextureUnwarp({
            previewDataUrl: res.url,
            estimatedAspect: autoAspect
          })
        }
      })
    }, 80)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [
    textureUnwarp.enabled,
    textureUnwarp.quad,
    textureUnwarp.aspectPreset,
    activeImageSrc,
    solverResult.cameraParameters,
    setTextureUnwarp
  ])

  // Observe container resize using native ResizeObserver
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const updateSize = () => {
      const rect = el.getBoundingClientRect()
      setBounds({ width: rect.width, height: rect.height })
    }
    updateSize()

    const observer = new ResizeObserver(() => {
      updateSize()
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Global keyboard & pointer release listeners
  useEffect(() => {
    const handlePointerUp = () => {
      setIsDraggingControlPoint(false)
      setSnappedIndicatorPos(null)
      setSnappedSegmentAbs(null)
      setSnappedKind(null)
      setIsPanning(false)
      panStartRef.current = null
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'SELECT' ||
          target.tagName === 'TEXTAREA')

      if (event.key === 'Shift') {
        setShiftIsDown(true)
      }
      if (event.key === 'Alt') {
        setAltIsDown(true)
      }
      if (event.code === 'Space' && !isInput) {
        setSpaceIsDown(true)
      }
      if (
        event.key.toLowerCase() === 'f' &&
        !isInput &&
        !event.ctrlKey &&
        !event.metaKey
      ) {
        resetViewport()
      }
      if (
        event.key.toLowerCase() === 'h' &&
        !isInput &&
        !event.ctrlKey &&
        !event.metaKey
      ) {
        setDockCollapsed((prev) => !prev)
      }
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Shift') {
        setShiftIsDown(false)
      }
      if (event.key === 'Alt') {
        setAltIsDown(false)
      }
      if (event.code === 'Space') {
        setSpaceIsDown(false)
      }
    }

    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [resetViewport])

  const imageAbsoluteAABB = (): AABB | null => {
    const imageWidth = imageState.width
    const imageHeight = imageState.height
    const { width, height } = bounds

    if (!imageWidth || !imageHeight || width <= 0 || height <= 0) {
      return null
    }

    const pad = uiState.sidePanelsAreVisible ? 28 : 0
    const availW = Math.max(40, width - 2 * pad)
    const availH = Math.max(40, height - 2 * pad)
    const imageAspect = imageWidth / imageHeight
    const aspect = availW / availH

    let baseScale = 1
    let baseX = pad
    let baseY = pad

    if (imageAspect > aspect) {
      baseScale = availW / imageWidth
      baseY = pad + 0.5 * (availH - baseScale * imageHeight)
    } else {
      baseScale = availH / imageHeight
      baseX = pad + 0.5 * (availW - baseScale * imageWidth)
    }

    const scaledW = baseScale * imageWidth * viewport.zoom
    const scaledH = baseScale * imageHeight * viewport.zoom

    const centerX = baseX + 0.5 * baseScale * imageWidth + viewport.panX
    const centerY = baseY + 0.5 * baseScale * imageHeight + viewport.panY

    return {
      xMin: centerX - 0.5 * scaledW,
      yMin: centerY - 0.5 * scaledH,
      xMax: centerX + 0.5 * scaledW,
      yMax: centerY + 0.5 * scaledH
    }
  }

  const aabb = imageAbsoluteAABB()

  const rel2AbsPoint = (point: Point2D): Point2D => {
    if (!aabb) return { x: 0, y: 0 }
    return {
      x: aabb.xMin + point.x * (aabb.xMax - aabb.xMin),
      y: aabb.yMin + point.y * (aabb.yMax - aabb.yMin)
    }
  }

  const clampedAbsPoint = (point: Point2D): Point2D => {
    if (!aabb) return { x: 0, y: 0 }
    return {
      x: Math.min(Math.max(aabb.xMin, point.x), aabb.xMax),
      y: Math.min(Math.max(aabb.yMin, point.y), aabb.yMax)
    }
  }

  const abs2RelPoint = (point: Point2D, clamp: boolean = true): Point2D => {
    if (!aabb) return { x: 0, y: 0 }
    const relativePosition = {
      x: (point.x - aabb.xMin) / (aabb.xMax - aabb.xMin),
      y: (point.y - aabb.yMin) / (aabb.yMax - aabb.yMin)
    }
    if (clamp) {
      relativePosition.x = Math.min(1, Math.max(0, relativePosition.x))
      relativePosition.y = Math.min(1, Math.max(0, relativePosition.y))
    }
    return relativePosition
  }

  const abs2RelWithOptionalSnap = (
    absPos: Point2D,
    anchorRelPoint?: Point2D
  ): Point2D => {
    const rawRel = abs2RelPoint(absPos, true)
    if ((edgeSnappingEnabled || altIsDown) && edgeMap) {
      const snapRes = snapRelativePointToEdge(rawRel, edgeMap, {
        searchRadiusPx: 20,
        minStrengthThreshold: 0.065,
        anchorRelPoint
      })
      if (snapRes.snapped) {
        setSnappedIndicatorPos(rel2AbsPoint(snapRes.point))
        setSnappedKind(snapRes.snapKind ?? 'ridge')
        if (snapRes.snappedSegment) {
          setSnappedSegmentAbs({
            p1: rel2AbsPoint(snapRes.snappedSegment.p1),
            p2: rel2AbsPoint(snapRes.snappedSegment.p2)
          })
        } else {
          setSnappedSegmentAbs(null)
        }
        return snapRes.point
      }
    }
    setSnappedIndicatorPos(null)
    setSnappedSegmentAbs(null)
    setSnappedKind(null)
    return rawRel
  }

  const imagePlane2Abs = (imagePlanePosition: Point2D): Point2D => {
    const imageWidth = imageState.width
    const imageHeight = imageState.height
    if (!imageWidth || !imageHeight) return { x: 0, y: 0 }
    const relativePos = CoordinatesUtil.convert(
      imagePlanePosition,
      ImageCoordinateFrame.ImagePlane,
      ImageCoordinateFrame.Relative,
      imageWidth,
      imageHeight
    )
    return rel2AbsPoint(relativePos)
  }

  const rel2AbsControlPointPairState = (
    rel: ControlPointPairState
  ): ControlPointPairState => [rel2AbsPoint(rel[0]), rel2AbsPoint(rel[1])]

  const rel2AbsVanishingPointControlState = (
    state: VanishingPointControlState
  ): VanishingPointControlState => ({
    lineSegments: state.lineSegments.map((seg) =>
      rel2AbsControlPointPairState(seg)
    )
  })

  const vanishingPointAbs = (vanishingPointIndex: number): Point2D | null => {
    const cameraParameters = solverResult.cameraParameters
    const imageWidth = imageState.width
    const imageHeight = imageState.height
    if (cameraParameters && imageWidth && imageHeight) {
      const imagePlanePos =
        cameraParameters.vanishingPoints[vanishingPointIndex]
      return imagePlane2Abs(imagePlanePos)
    }
    return null
  }

  const vanishingPointColor = (vanishingPointIndex: number): string => {
    const firstAxisColor = Palette.colorForAxis(
      calibrationSettingsBase.firstVanishingPointAxis
    )
    const secondAxisColor = Palette.colorForAxis(
      calibrationSettingsBase.secondVanishingPointAxis
    )
    switch (vanishingPointIndex) {
      case 0:
        return firstAxisColor
      case 1:
        return secondAxisColor
    }

    const axisColors = [
      Palette.colorForAxis(Axis.PositiveX),
      Palette.colorForAxis(Axis.PositiveY),
      Palette.colorForAxis(Axis.PositiveZ)
    ]

    for (const axisColor of axisColors) {
      if ([firstAxisColor, secondAxisColor].indexOf(axisColor) < 0) {
        return axisColor
      }
    }
    return firstAxisColor
  }

  const didDragControlPoint = (
    absolutePosition: Point2D,
    referenceDistanceHandleIndex?: number
  ) => {
    if (bounds.height <= 0) return

    let nextLoupePos = clampedAbsPoint(absolutePosition)
    if (
      referenceDistanceHandleIndex !== undefined &&
      solverResult.cameraParameters
    ) {
      const cameraParameters = solverResult.cameraParameters
      const referenceAxis = calibrationSettingsBase.referenceDistanceAxis
      const imageWidth = imageState.width
      const imageHeight = imageState.height
      if (imageWidth && imageHeight && referenceAxis) {
        const handlePositions =
          Solver.referenceDistanceHandlesRelativePositions(
            controlPointsStateBase,
            referenceAxis,
            cameraParameters.vanishingPoints,
            cameraParameters.vanishingPointAxes,
            imageWidth,
            imageHeight
          )
        nextLoupePos = rel2AbsPoint(
          handlePositions[referenceDistanceHandleIndex]
        )
      }
    }

    setIsDraggingControlPoint(true)
    setMagnifyingGlassPosition(nextLoupePos)
  }

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (sceneBlockout.enabled && sceneBlockout.freeOrbitMode) return
    e.preventDefault()
    const zoomFactor = e.deltaY < 0 ? 1.12 : 1 / 1.12
    const nextZoom = Math.min(8, Math.max(0.25, viewport.zoom * zoomFactor))
    setViewport({ zoom: nextZoom })
  }

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (sceneBlockout.enabled && sceneBlockout.freeOrbitMode) return
    if (e.button === 1 || (e.button === 0 && spaceIsDown)) {
      e.preventDefault()
      setIsPanning(true)
      panStartRef.current = {
        clientX: e.clientX,
        clientY: e.clientY,
        panX: viewport.panX,
        panY: viewport.panY
      }
      return
    }

    // Interactive 3D Ground Footprint Box Creator
    if (
      e.button === 0 &&
      sceneBlockout.enabled &&
      sceneBlockout.interactiveDrawMode &&
      solverResult.cameraParameters &&
      containerRef.current
    ) {
      const rect = containerRef.current.getBoundingClientRect()
      const pt = { x: e.clientX - rect.left, y: e.clientY - rect.top }
      setFootprintDrag({ startAbs: pt, currentAbs: pt })
    }
  }

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (footprintDrag && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      const pt = { x: e.clientX - rect.left, y: e.clientY - rect.top }
      setFootprintDrag({ ...footprintDrag, currentAbs: pt })
      return
    }

    if (!isPanning || !panStartRef.current) return
    const dx = e.clientX - panStartRef.current.clientX
    const dy = e.clientY - panStartRef.current.clientY
    setViewport({
      panX: panStartRef.current.panX + dx,
      panY: panStartRef.current.panY + dy
    })
  }

  const handleCanvasPointerUp = () => {
    if (footprintDrag && solverResult.cameraParameters) {
      const startRel = abs2RelPoint(footprintDrag.startAbs, true)
      const endRel = abs2RelPoint(footprintDrag.currentAbs, true)
      const g1 = unprojectRelativePointToGroundXY(
        startRel,
        solverResult.cameraParameters
      )
      const g2 = unprojectRelativePointToGroundXY(
        endRel,
        solverResult.cameraParameters
      )
      if (g1 && g2) {
        const widthX = Math.max(0.3, Math.min(8, Math.abs(g2.x - g1.x)))
        const depthY = Math.max(0.3, Math.min(8, Math.abs(g2.y - g1.y)))
        const cx = Number((0.5 * (g1.x + g2.x)).toFixed(2))
        const cy = Number((0.5 * (g1.y + g2.y)).toFixed(2))
        addBlockoutVolume({
          widthX: Number(widthX.toFixed(2)),
          depthY: Number(depthY.toFixed(2)),
          heightZ: 1.2,
          offsetX: cx,
          offsetY: cy,
          offsetZ: 0
        })
        setSceneBlockout({ interactiveDrawMode: false })
        showToast('Created 3D Blockout Volume on ground plane (Z=0)')
      }
      setFootprintDrag(null)
    }
  }

  const handleAssignDetectedEdge = (
    seg: DetectedEdgeSegment,
    ev: React.MouseEvent
  ) => {
    ev.stopPropagation()
    const assignToVP2 =
      ev.shiftKey &&
      globalSettings.calibrationMode === CalibrationMode.TwoVanishingPoints
    if (assignToVP2) {
      setSecondVPControlPoint(0, ControlPointPairIndex.First, seg.p1)
      setSecondVPControlPoint(0, ControlPointPairIndex.Second, seg.p2)
      showToast('Assigned detected edge to VP 2 (Segment 1)')
    } else {
      setFirstVPControlPoint(0, ControlPointPairIndex.First, seg.p1)
      setFirstVPControlPoint(0, ControlPointPairIndex.Second, seg.p2)
      showToast(
        'Assigned detected edge to VP 1 (Hold Shift + Click to assign to VP 2)'
      )
    }
  }

  const renderBlockoutViewportHandles = () => {
    if (
      !sceneBlockout.enabled ||
      !sceneBlockout.showViewportHandles ||
      sceneBlockout.freeOrbitMode ||
      parallaxAnimator.enabled ||
      !solverResult.cameraParameters
    ) {
      return null
    }

    const camParams = solverResult.cameraParameters

    return (
      <g>
        {sceneBlockout.volumes.map((vol) => {
          const isSelected = vol.id === sceneBlockout.selectedVolumeId
          const proj = computeProjectedBlockoutVolumeHandles(vol, camParams)
          const bAbs = proj.bottomCorners.map((pt) => rel2AbsPoint(pt))
          const tAbs = proj.topCorners.map((pt) => rel2AbsPoint(pt))

          const bottomPoly = bAbs.map((p) => `${p.x},${p.y}`).join(' ')
          const topPoly = tAbs.map((p) => `${p.x},${p.y}`).join(' ')

          const floorCenterAbs = rel2AbsPoint(proj.floorCenter)
          const roofCenterAbs = rel2AbsPoint(proj.roofCenter)
          const widthEdgeAbs = rel2AbsPoint(proj.widthPlusEdge)
          const depthEdgeAbs = rel2AbsPoint(proj.depthPlusEdge)
          const yawAbs = rel2AbsPoint(proj.yawHandle)

          const rad = (vol.rotationZ * Math.PI) / 180
          const cos = Math.cos(rad)
          const sin = Math.sin(rad)

          return (
            <g key={`vol-handles-${vol.id}`}>
              {/* Clickable Base & Roof Polygons to select any 3D Box in the viewport */}
              <polygon
                points={bottomPoly}
                fill={
                  isSelected
                    ? 'rgba(56, 189, 248, 0.12)'
                    : 'rgba(148, 163, 184, 0.05)'
                }
                stroke={isSelected ? '#38bdf8' : 'rgba(148, 163, 184, 0.45)'}
                strokeWidth={isSelected ? 1.8 : 1.1}
                className='cursor-pointer'
                onClick={(e) => {
                  e.stopPropagation()
                  setSceneBlockout({ selectedVolumeId: vol.id })
                  setActiveSidebarTab('scene')
                  setActiveSceneTool('boxes')
                }}
              />
              <polygon
                points={topPoly}
                fill={
                  isSelected
                    ? 'rgba(56, 189, 248, 0.16)'
                    : 'rgba(148, 163, 184, 0.05)'
                }
                stroke={isSelected ? '#38bdf8' : 'rgba(148, 163, 184, 0.45)'}
                strokeWidth={isSelected ? 2.0 : 1.1}
                className='cursor-pointer'
                onClick={(e) => {
                  e.stopPropagation()
                  setSceneBlockout({ selectedVolumeId: vol.id })
                  setActiveSidebarTab('scene')
                  setActiveSceneTool('boxes')
                }}
              />
              {/* 4 Vertical Pillar Edges */}
              {[0, 1, 2, 3].map((ci) => (
                <line
                  key={`pillar-${vol.id}-${ci}`}
                  x1={bAbs[ci].x}
                  y1={bAbs[ci].y}
                  x2={tAbs[ci].x}
                  y2={tAbs[ci].y}
                  stroke={isSelected ? '#38bdf8' : 'rgba(148, 163, 184, 0.4)'}
                  strokeWidth={isSelected ? 1.6 : 1}
                  strokeDasharray={isSelected ? undefined : '4 3'}
                  className='pointer-events-none'
                />
              ))}

              {/* Interactive Push/Pull Handles for Selected 3D Box */}
              {isSelected && (
                <g>
                  {/* Vertical Extrusion Spine (Floor Center -> Roof Center) */}
                  <line
                    x1={floorCenterAbs.x}
                    y1={floorCenterAbs.y}
                    x2={roofCenterAbs.x}
                    y2={roofCenterAbs.y}
                    stroke='#38bdf8'
                    strokeWidth={1.6}
                    strokeDasharray='4 3'
                    className='pointer-events-none'
                  />
                  {/* Yaw Handle Arm */}
                  <line
                    x1={floorCenterAbs.x}
                    y1={floorCenterAbs.y}
                    x2={yawAbs.x}
                    y2={yawAbs.y}
                    stroke='#c084fc'
                    strokeWidth={1.4}
                    strokeDasharray='3 3'
                    className='pointer-events-none'
                  />

                  {/* 1. Floor Move Handle (XY Slide on Z = offsetZ) */}
                  <ControlPoint
                    absolutePosition={floorCenterAbs}
                    stroke='#fbbf24'
                    fill='rgba(251, 191, 36, 0.35)'
                    onControlPointDrag={(dragPos: Point2D) => {
                      didDragControlPoint(dragPos)
                      const rel = abs2RelWithOptionalSnap(dragPos)
                      const hit = unprojectRelativePointToPlaneZ(
                        rel,
                        vol.offsetZ,
                        camParams
                      )
                      if (hit) {
                        updateBlockoutVolume(vol.id, {
                          offsetX: Number(hit.x.toFixed(2)),
                          offsetY: Number(hit.y.toFixed(2))
                        })
                      }
                    }}
                  />
                  <text
                    x={floorCenterAbs.x + 9}
                    y={floorCenterAbs.y + 4}
                    fill='#fde68a'
                    fontSize={9.5}
                    fontFamily='JetBrains Mono, monospace'
                    fontWeight={700}
                    className='pointer-events-none select-none'
                  >
                    XY Move
                  </text>

                  {/* 2. Width (+X) Push/Pull Handle */}
                  <ControlPoint
                    absolutePosition={widthEdgeAbs}
                    stroke='#f87171'
                    fill='rgba(248, 113, 113, 0.35)'
                    onControlPointDrag={(dragPos: Point2D) => {
                      didDragControlPoint(dragPos)
                      const rel = abs2RelWithOptionalSnap(dragPos)
                      const hit = unprojectRelativePointToPlaneZ(
                        rel,
                        vol.offsetZ + 0.25 * vol.heightZ,
                        camParams
                      )
                      if (hit) {
                        const dx = hit.x - vol.offsetX
                        const dy = hit.y - vol.offsetY
                        const localX = Math.abs(dx * cos + dy * sin)
                        const nextW = Math.max(
                          0.15,
                          Math.min(12, Number((localX * 2).toFixed(2)))
                        )
                        updateBlockoutVolume(vol.id, { widthX: nextW })
                      }
                    }}
                  />
                  <text
                    x={widthEdgeAbs.x + 8}
                    y={widthEdgeAbs.y - 6}
                    fill='#fca5a5'
                    fontSize={9.5}
                    fontFamily='JetBrains Mono, monospace'
                    fontWeight={700}
                    className='pointer-events-none select-none'
                  >
                    W:{vol.widthX.toFixed(2)}
                  </text>

                  {/* 3. Depth (+Y) Push/Pull Handle */}
                  <ControlPoint
                    absolutePosition={depthEdgeAbs}
                    stroke='#4ade80'
                    fill='rgba(74, 222, 128, 0.35)'
                    onControlPointDrag={(dragPos: Point2D) => {
                      didDragControlPoint(dragPos)
                      const rel = abs2RelWithOptionalSnap(dragPos)
                      const hit = unprojectRelativePointToPlaneZ(
                        rel,
                        vol.offsetZ + 0.25 * vol.heightZ,
                        camParams
                      )
                      if (hit) {
                        const dx = hit.x - vol.offsetX
                        const dy = hit.y - vol.offsetY
                        const localY = Math.abs(-dx * sin + dy * cos)
                        const nextD = Math.max(
                          0.15,
                          Math.min(12, Number((localY * 2).toFixed(2)))
                        )
                        updateBlockoutVolume(vol.id, { depthY: nextD })
                      }
                    }}
                  />
                  <text
                    x={depthEdgeAbs.x + 8}
                    y={depthEdgeAbs.y - 6}
                    fill='#86efac'
                    fontSize={9.5}
                    fontFamily='JetBrains Mono, monospace'
                    fontWeight={700}
                    className='pointer-events-none select-none'
                  >
                    D:{vol.depthY.toFixed(2)}
                  </text>

                  {/* 4. Yaw Rotation Handle */}
                  <ControlPoint
                    absolutePosition={yawAbs}
                    stroke='#c084fc'
                    fill='rgba(192, 132, 252, 0.35)'
                    onControlPointDrag={(dragPos: Point2D) => {
                      didDragControlPoint(dragPos)
                      const rel = abs2RelPoint(dragPos, false)
                      const hit = unprojectRelativePointToPlaneZ(
                        rel,
                        vol.offsetZ,
                        camParams
                      )
                      if (hit) {
                        const angDeg = Math.round(
                          (Math.atan2(
                            hit.y - vol.offsetY,
                            hit.x - vol.offsetX
                          ) *
                            180) /
                            Math.PI
                        )
                        updateBlockoutVolume(vol.id, { rotationZ: angDeg })
                      }
                    }}
                  />
                  <text
                    x={yawAbs.x + 8}
                    y={yawAbs.y + 3}
                    fill='#d8b4fe'
                    fontSize={9.5}
                    fontFamily='JetBrains Mono, monospace'
                    fontWeight={700}
                    className='pointer-events-none select-none'
                  >
                    {vol.rotationZ}°
                  </text>

                  {/* 5. Top Roof Extrude Handle (Z+ Height Pull) */}
                  <ControlPoint
                    absolutePosition={roofCenterAbs}
                    stroke='#38bdf8'
                    fill='rgba(56, 189, 248, 0.45)'
                    onControlPointDrag={(dragPos: Point2D) => {
                      didDragControlPoint(dragPos)
                      const rel = abs2RelWithOptionalSnap(dragPos)
                      const nextH = solveExtrudedHeightZFromRelativePoint(
                        rel,
                        { x: vol.offsetX, y: vol.offsetY },
                        vol.offsetZ,
                        camParams
                      )
                      if (nextH !== null) {
                        updateBlockoutVolume(vol.id, { heightZ: nextH })
                      }
                    }}
                  />

                  {/* Live 3D Box Dimension Readout Badge above Roof Handle */}
                  <g
                    transform={`translate(${roofCenterAbs.x}, ${roofCenterAbs.y - 20})`}
                    className='pointer-events-none select-none'
                  >
                    <rect
                      x={-76}
                      y={-11}
                      width={152}
                      height={20}
                      rx={5}
                      fill='rgba(8, 15, 26, 0.92)'
                      stroke='#38bdf8'
                      strokeWidth={1.1}
                    />
                    <text
                      x={0}
                      y={2.5}
                      textAnchor='middle'
                      fill='#bae6fd'
                      fontSize={9.5}
                      fontFamily='JetBrains Mono, monospace'
                      fontWeight={600}
                    >
                      Z↑ H:{vol.heightZ.toFixed(2)}m ({vol.widthX.toFixed(1)}×
                      {vol.depthY.toFixed(1)})
                    </text>
                  </g>
                </g>
              )}
            </g>
          )
        })}
      </g>
    )
  }

  const renderBillboardCutoutsOverlay = () => {
    if (
      !sceneBlockout.enabled ||
      !sceneBlockout.billboardsEnabled ||
      sceneBlockout.freeOrbitMode ||
      parallaxAnimator.enabled
    ) {
      return null
    }

    return (
      <g>
        {sceneBlockout.billboards.map((bb) => {
          const isSelected = bb.id === sceneBlockout.selectedBillboardId
          const ptsAbs = bb.polygonRel.map((pt) => rel2AbsPoint(pt))
          const polyStr = ptsAbs.map((p) => `${p.x},${p.y}`).join(' ')

          // Compute top-center for badge readout
          let minY = Infinity
          let sumX = 0
          ptsAbs.forEach((p) => {
            if (p.y < minY) minY = p.y
            sumX += p.x
          })
          const badgeX = ptsAbs.length > 0 ? sumX / ptsAbs.length : 0

          return (
            <g key={`billboard-poly-${bb.id}`}>
              <polygon
                points={polyStr}
                fill={
                  isSelected
                    ? 'rgba(16, 185, 129, 0.16)'
                    : 'rgba(16, 185, 129, 0.06)'
                }
                stroke={isSelected ? '#34d399' : 'rgba(52, 211, 153, 0.55)'}
                strokeWidth={isSelected ? 2.1 : 1.2}
                strokeDasharray='5 3'
                className='cursor-pointer'
                onClick={(e) => {
                  e.stopPropagation()
                  setSceneBlockout({ selectedBillboardId: bb.id })
                  setActiveSidebarTab('scene')
                  setActiveSceneTool('billboards')
                }}
              />

              {isSelected &&
                ptsAbs.map((pos, vIdx) => (
                  <ControlPoint
                    key={`bb-vert-${bb.id}-${vIdx}`}
                    absolutePosition={pos}
                    stroke='#34d399'
                    fill='rgba(16, 185, 129, 0.4)'
                    onControlPointDrag={(dragPos: Point2D) => {
                      didDragControlPoint(dragPos)
                      setBillboardPolygonVertex(
                        bb.id,
                        vIdx,
                        abs2RelWithOptionalSnap(dragPos)
                      )
                    }}
                  />
                ))}

              {isSelected && ptsAbs.length > 0 && (
                <g
                  transform={`translate(${badgeX}, ${minY - 16})`}
                  className='pointer-events-none select-none'
                >
                  <rect
                    x={-84}
                    y={-11}
                    width={168}
                    height={20}
                    rx={5}
                    fill='rgba(6, 20, 16, 0.92)'
                    stroke='#34d399'
                    strokeWidth={1.1}
                  />
                  <text
                    x={0}
                    y={2.5}
                    textAnchor='middle'
                    fill='#6ee7b7'
                    fontSize={9.5}
                    fontFamily='JetBrains Mono, monospace'
                    fontWeight={600}
                  >
                    Cutout ({bb.baseX.toFixed(1)},{bb.baseY.toFixed(1)}) H:
                    {bb.height.toFixed(2)}m
                  </text>
                </g>
              )}
            </g>
          )
        })}
      </g>
    )
  }

  const renderHallwayWallDetailsOverlay = () => {
    if (
      !sceneBlockout.enabled ||
      sceneBlockout.freeOrbitMode ||
      parallaxAnimator.enabled
    ) {
      return null
    }

    const cornerLabels = ['TL', 'TR', 'BR', 'BL']

    return (
      <g>
        {/* Option 1 (Optional): 3D Swept Rail, Multi-Bend Pipe & Catenary Cable Handles */}
        {sceneBlockout.sweptRailsEnabled &&
          sceneBlockout.sweptRails.map((rail) => {
            const isSel = rail.id === sceneBlockout.selectedSweptRailId
            const p1Abs = rel2AbsPoint(rail.p1Rel)
            const p2Abs = rel2AbsPoint(rail.p2Rel)
            const waypointsAbs = (rail.waypointsRel ?? []).map((wp) =>
              rel2AbsPoint(wp)
            )
            const allChainAbs = [p1Abs, ...waypointsAbs, p2Abs]
            const polyLineStr = allChainAbs
              .map((pt) => `${pt.x},${pt.y}`)
              .join(' ')
            const midX = 0.5 * (p1Abs.x + p2Abs.x)
            const midY = 0.5 * (p1Abs.y + p2Abs.y)

            return (
              <g key={`swept-rail-svg-${rail.id}`}>
                <polyline
                  points={polyLineStr}
                  fill='none'
                  stroke={isSel ? '#f43f5e' : 'rgba(244, 63, 94, 0.6)'}
                  strokeWidth={isSel ? 3.2 : 2.0}
                  strokeDasharray='6 3'
                  className='cursor-pointer'
                  onClick={(e) => {
                    e.stopPropagation()
                    setSceneBlockout({ selectedSweptRailId: rail.id })
                    setActiveSidebarTab('scene')
                    setActiveSceneTool('rails')
                  }}
                />
                {isSel && (
                  <>
                    <ControlPoint
                      absolutePosition={p1Abs}
                      stroke='#f43f5e'
                      fill='rgba(244, 63, 94, 0.4)'
                      onControlPointDrag={(dragPos: Point2D) => {
                        didDragControlPoint(dragPos)
                        updateSweptWallRail(rail.id, {
                          p1Rel: abs2RelWithOptionalSnap(dragPos, rail.p2Rel)
                        })
                      }}
                    />
                    <text
                      x={p1Abs.x + 8}
                      y={p1Abs.y - 7}
                      fill='#fda4af'
                      fontSize={9.5}
                      fontFamily='JetBrains Mono, monospace'
                      fontWeight={700}
                      className='pointer-events-none select-none'
                    >
                      Rail P1
                    </text>

                    {waypointsAbs.map((wpAbs, wpIdx) => (
                      <g key={`rail-wp-${rail.id}-${wpIdx}`}>
                        <ControlPoint
                          absolutePosition={wpAbs}
                          stroke='#fb7185'
                          fill='rgba(251, 113, 133, 0.42)'
                          onControlPointDrag={(dragPos: Point2D) => {
                            didDragControlPoint(dragPos)
                            setSweptRailWaypoint(
                              rail.id,
                              wpIdx,
                              abs2RelWithOptionalSnap(dragPos)
                            )
                          }}
                        />
                        <text
                          x={wpAbs.x + 8}
                          y={wpAbs.y - 7}
                          fill='#fecdd3'
                          fontSize={9}
                          fontFamily='JetBrains Mono, monospace'
                          fontWeight={700}
                          className='pointer-events-none select-none'
                        >
                          Bend B{wpIdx + 1}
                        </text>
                      </g>
                    ))}

                    <ControlPoint
                      absolutePosition={p2Abs}
                      stroke='#f43f5e'
                      fill='rgba(244, 63, 94, 0.4)'
                      onControlPointDrag={(dragPos: Point2D) => {
                        didDragControlPoint(dragPos)
                        updateSweptWallRail(rail.id, {
                          p2Rel: abs2RelWithOptionalSnap(dragPos, rail.p1Rel)
                        })
                      }}
                    />
                    <text
                      x={p2Abs.x + 8}
                      y={p2Abs.y - 7}
                      fill='#fda4af'
                      fontSize={9.5}
                      fontFamily='JetBrains Mono, monospace'
                      fontWeight={700}
                      className='pointer-events-none select-none'
                    >
                      Rail P2
                    </text>

                    <g
                      transform={`translate(${midX}, ${midY - 16})`}
                      className='pointer-events-none select-none'
                    >
                      <rect
                        x={-88}
                        y={-11}
                        width={176}
                        height={20}
                        rx={5}
                        fill='rgba(28, 10, 18, 0.92)'
                        stroke='#f43f5e'
                        strokeWidth={1.1}
                      />
                      <text
                        x={0}
                        y={2.5}
                        textAnchor='middle'
                        fill='#fda4af'
                        fontSize={9.5}
                        fontFamily='JetBrains Mono, monospace'
                        fontWeight={600}
                      >
                        {rail.pathMode === 'catenary-sag'
                          ? `Catenary Sag (${(rail.catenarySag ?? 0.22).toFixed(2)}m)`
                          : `3D Pipe (+${rail.standOff.toFixed(2)}m off wall)`}
                      </text>
                    </g>
                  </>
                )}
              </g>
            )
          })}

        {/* Option 2 (Optional): Wall-Parallel Offset Cutout Layer Handles */}
        {sceneBlockout.wallCutoutsEnabled &&
          sceneBlockout.wallCutouts.map((wc) => {
            const isSel = wc.id === sceneBlockout.selectedWallCutoutId
            const ptsAbs = wc.quadRel.map((pt) => rel2AbsPoint(pt))
            const polyStr = ptsAbs.map((p) => `${p.x},${p.y}`).join(' ')
            const topMidX = 0.5 * (ptsAbs[0].x + ptsAbs[1].x)
            const topMidY = Math.min(ptsAbs[0].y, ptsAbs[1].y)

            return (
              <g key={`wall-cutout-svg-${wc.id}`}>
                <polygon
                  points={polyStr}
                  fill={
                    isSel
                      ? 'rgba(168, 85, 247, 0.16)'
                      : 'rgba(168, 85, 247, 0.06)'
                  }
                  stroke={isSel ? '#a855f7' : 'rgba(168, 85, 247, 0.55)'}
                  strokeWidth={isSel ? 2.1 : 1.2}
                  strokeDasharray='5 3'
                  className='cursor-pointer'
                  onClick={(e) => {
                    e.stopPropagation()
                    setSceneBlockout({ selectedWallCutoutId: wc.id })
                    setActiveSidebarTab('scene')
                    setActiveSceneTool('wall-cutouts')
                  }}
                />
                {isSel &&
                  ptsAbs.map((pos, cIdx) => (
                    <g key={`wc-corner-${wc.id}-${cIdx}`}>
                      <ControlPoint
                        absolutePosition={pos}
                        stroke='#a855f7'
                        fill='rgba(168, 85, 247, 0.4)'
                        onControlPointDrag={(dragPos: Point2D) => {
                          didDragControlPoint(dragPos)
                          setWallCutoutCorner(
                            wc.id,
                            cIdx as 0 | 1 | 2 | 3,
                            abs2RelWithOptionalSnap(dragPos)
                          )
                        }}
                      />
                      <text
                        x={pos.x + 8}
                        y={pos.y - 6}
                        fill='#d8b4fe'
                        fontSize={9}
                        fontFamily='JetBrains Mono, monospace'
                        fontWeight={700}
                        className='pointer-events-none select-none'
                      >
                        {cornerLabels[cIdx]}
                      </text>
                    </g>
                  ))}
                {isSel && (
                  <g
                    transform={`translate(${topMidX}, ${topMidY - 16})`}
                    className='pointer-events-none select-none'
                  >
                    <rect
                      x={-88}
                      y={-11}
                      width={176}
                      height={20}
                      rx={5}
                      fill='rgba(22, 10, 32, 0.92)'
                      stroke='#a855f7'
                      strokeWidth={1.1}
                    />
                    <text
                      x={0}
                      y={2.5}
                      textAnchor='middle'
                      fill='#e9d5ff'
                      fontSize={9.5}
                      fontFamily='JetBrains Mono, monospace'
                      fontWeight={600}
                    >
                      Wall Cutout (+{wc.standOff.toFixed(2)}m · {wc.alphaMode})
                    </text>
                  </g>
                )}
              </g>
            )
          })}

        {/* Option 3 (Optional): Wall Relief & Recessed Alcove Extruder Handles */}
        {sceneBlockout.wallReliefsEnabled &&
          sceneBlockout.wallReliefs.map((rel) => {
            const isSel = rel.id === sceneBlockout.selectedWallReliefId
            const ptsAbs = rel.quadRel.map((pt) => rel2AbsPoint(pt))
            const polyStr = ptsAbs.map((p) => `${p.x},${p.y}`).join(' ')
            const topMidX = 0.5 * (ptsAbs[0].x + ptsAbs[1].x)
            const topMidY = Math.min(ptsAbs[0].y, ptsAbs[1].y)
            const isRecessed = rel.extrudeDepth < 0

            return (
              <g key={`wall-relief-svg-${rel.id}`}>
                <polygon
                  points={polyStr}
                  fill={
                    isSel
                      ? 'rgba(6, 182, 212, 0.16)'
                      : 'rgba(6, 182, 212, 0.06)'
                  }
                  stroke={isSel ? '#06b6d4' : 'rgba(6, 182, 212, 0.55)'}
                  strokeWidth={isSel ? 2.1 : 1.2}
                  strokeDasharray='5 3'
                  className='cursor-pointer'
                  onClick={(e) => {
                    e.stopPropagation()
                    setSceneBlockout({ selectedWallReliefId: rel.id })
                    setActiveSidebarTab('scene')
                    setActiveSceneTool('reliefs')
                  }}
                />
                {isSel &&
                  ptsAbs.map((pos, cIdx) => (
                    <g key={`rel-corner-${rel.id}-${cIdx}`}>
                      <ControlPoint
                        absolutePosition={pos}
                        stroke='#06b6d4'
                        fill='rgba(6, 182, 212, 0.4)'
                        onControlPointDrag={(dragPos: Point2D) => {
                          didDragControlPoint(dragPos)
                          setWallReliefCorner(
                            rel.id,
                            cIdx as 0 | 1 | 2 | 3,
                            abs2RelWithOptionalSnap(dragPos)
                          )
                        }}
                      />
                      <text
                        x={pos.x + 8}
                        y={pos.y - 6}
                        fill='#a5f3fc'
                        fontSize={9}
                        fontFamily='JetBrains Mono, monospace'
                        fontWeight={700}
                        className='pointer-events-none select-none'
                      >
                        {cornerLabels[cIdx]}
                      </text>
                    </g>
                  ))}
                {isSel && (
                  <g
                    transform={`translate(${topMidX}, ${topMidY - 16})`}
                    className='pointer-events-none select-none'
                  >
                    <rect
                      x={-88}
                      y={-11}
                      width={176}
                      height={20}
                      rx={5}
                      fill='rgba(8, 24, 30, 0.92)'
                      stroke='#06b6d4'
                      strokeWidth={1.1}
                    />
                    <text
                      x={0}
                      y={2.5}
                      textAnchor='middle'
                      fill='#a5f3fc'
                      fontSize={9.5}
                      fontFamily='JetBrains Mono, monospace'
                      fontWeight={600}
                    >
                      {rel.passThroughPortal
                        ? `Open Portal + Annex (${(rel.annexLength ?? 2.2).toFixed(1)}m)`
                        : `${isRecessed ? 'Recessed Alcove' : 'Pop-Out Ledge'} (${rel.extrudeDepth >= 0 ? '+' : ''}${rel.extrudeDepth.toFixed(2)}m)`}
                    </text>
                  </g>
                )}
              </g>
            )
          })}

        {/* Option 4 (Optional): "3-Sweep" Cylinder & Pillar Snapper Handles */}
        {sceneBlockout.sweptColumnsEnabled &&
          sceneBlockout.sweptColumns.map((col) => {
            const isSel = col.id === sceneBlockout.selectedSweptColumnId
            const bLeftAbs = rel2AbsPoint(col.baseLeftRel)
            const bRightAbs = rel2AbsPoint(col.baseRightRel)
            const topAbs = rel2AbsPoint(col.topCenterRel)
            const baseMidAbs = {
              x: 0.5 * (bLeftAbs.x + bRightAbs.x),
              y: 0.5 * (bLeftAbs.y + bRightAbs.y)
            }
            const solved = solverResult.cameraParameters
              ? solveSweptColumn3D(col, solverResult.cameraParameters)
              : null

            return (
              <g key={`swept-col-svg-${col.id}`}>
                {/* Base Diameter Line */}
                <line
                  x1={bLeftAbs.x}
                  y1={bLeftAbs.y}
                  x2={bRightAbs.x}
                  y2={bRightAbs.y}
                  stroke={isSel ? '#eab308' : 'rgba(234, 179, 8, 0.6)'}
                  strokeWidth={isSel ? 2.4 : 1.5}
                  className='cursor-pointer'
                  onClick={(e) => {
                    e.stopPropagation()
                    setSceneBlockout({ selectedSweptColumnId: col.id })
                    setActiveSidebarTab('scene')
                    setActiveSceneTool('columns')
                  }}
                />
                {/* Vertical Spine */}
                <line
                  x1={baseMidAbs.x}
                  y1={baseMidAbs.y}
                  x2={topAbs.x}
                  y2={topAbs.y}
                  stroke={isSel ? '#eab308' : 'rgba(234, 179, 8, 0.55)'}
                  strokeWidth={isSel ? 2.0 : 1.2}
                  strokeDasharray='5 3'
                  className='cursor-pointer'
                  onClick={(e) => {
                    e.stopPropagation()
                    setSceneBlockout({ selectedSweptColumnId: col.id })
                    setActiveSidebarTab('scene')
                    setActiveSceneTool('columns')
                  }}
                />
                {isSel && (
                  <>
                    <ControlPoint
                      absolutePosition={bLeftAbs}
                      stroke='#eab308'
                      fill='rgba(234, 179, 8, 0.4)'
                      onControlPointDrag={(dragPos: Point2D) => {
                        didDragControlPoint(dragPos)
                        updateSweptCylinderColumn(col.id, {
                          baseLeftRel: abs2RelWithOptionalSnap(dragPos)
                        })
                      }}
                    />
                    <text
                      x={bLeftAbs.x - 36}
                      y={bLeftAbs.y + 14}
                      fill='#fef08a'
                      fontSize={9}
                      fontFamily='JetBrains Mono, monospace'
                      fontWeight={700}
                      className='pointer-events-none select-none'
                    >
                      Base L
                    </text>

                    <ControlPoint
                      absolutePosition={bRightAbs}
                      stroke='#eab308'
                      fill='rgba(234, 179, 8, 0.4)'
                      onControlPointDrag={(dragPos: Point2D) => {
                        didDragControlPoint(dragPos)
                        updateSweptCylinderColumn(col.id, {
                          baseRightRel: abs2RelWithOptionalSnap(dragPos)
                        })
                      }}
                    />
                    <text
                      x={bRightAbs.x + 8}
                      y={bRightAbs.y + 14}
                      fill='#fef08a'
                      fontSize={9}
                      fontFamily='JetBrains Mono, monospace'
                      fontWeight={700}
                      className='pointer-events-none select-none'
                    >
                      Base R
                    </text>

                    <ControlPoint
                      absolutePosition={topAbs}
                      stroke='#eab308'
                      fill='rgba(234, 179, 8, 0.4)'
                      onControlPointDrag={(dragPos: Point2D) => {
                        didDragControlPoint(dragPos)
                        updateSweptCylinderColumn(col.id, {
                          topCenterRel: abs2RelWithOptionalSnap(dragPos)
                        })
                      }}
                    />
                    <g
                      transform={`translate(${topAbs.x}, ${topAbs.y - 18})`}
                      className='pointer-events-none select-none'
                    >
                      <rect
                        x={-84}
                        y={-11}
                        width={168}
                        height={20}
                        rx={5}
                        fill='rgba(28, 22, 6, 0.92)'
                        stroke='#eab308'
                        strokeWidth={1.1}
                      />
                      <text
                        x={0}
                        y={2.5}
                        textAnchor='middle'
                        fill='#fef08a'
                        fontSize={9.5}
                        fontFamily='JetBrains Mono, monospace'
                        fontWeight={600}
                      >
                        {solved
                          ? `3-Sweep Ø${(solved.radius * 2).toFixed(2)}m · H:${solved.height.toFixed(2)}m`
                          : '3-Sweep Pillar'}
                      </text>
                    </g>
                  </>
                )}
              </g>
            )
          })}

        {/* Option 5 (Optional): Parametric 3D Staircase & Sloped Ramp Handles */}
        {sceneBlockout.staircasesEnabled &&
          solverResult.cameraParameters &&
          sceneBlockout.staircases.map((st) => {
            const isSel = st.id === sceneBlockout.selectedStaircaseId
            const camParams = solverResult.cameraParameters!
            const yawRad = (st.yawDeg * Math.PI) / 180
            const cosY = Math.cos(yawRad)
            const sinY = Math.sin(yawRad)

            const toWorld = (lx: number, ly: number, lz: number) => ({
              x: st.offsetX + lx * cosY - ly * sinY,
              y: st.offsetY + lx * sinY + ly * cosY,
              z: st.offsetZ + lz
            })

            const baseFrontCenter3D = toWorld(0, 0, 0)
            const topBackCenter3D = toWorld(0, st.runDepthY, st.totalHeightZ)
            const backFloorCenter3D = toWorld(0, st.runDepthY, 0)
            const rightMidFloor3D = toWorld(
              st.widthX * 0.5,
              st.runDepthY * 0.5,
              0
            )

            const baseAbs = rel2AbsPoint(
              projectBlockoutPointToRelative(baseFrontCenter3D, camParams)
            )
            const topAbs = rel2AbsPoint(
              projectBlockoutPointToRelative(topBackCenter3D, camParams)
            )
            const backFloorAbs = rel2AbsPoint(
              projectBlockoutPointToRelative(backFloorCenter3D, camParams)
            )
            const rightMidAbs = rel2AbsPoint(
              projectBlockoutPointToRelative(rightMidFloor3D, camParams)
            )

            return (
              <g key={`staircase-svg-${st.id}`}>
                {/* Slope spine line from Bottom Step to Top Landing */}
                <line
                  x1={baseAbs.x}
                  y1={baseAbs.y}
                  x2={topAbs.x}
                  y2={topAbs.y}
                  stroke='#10b981'
                  strokeWidth={isSel ? 2.5 : 1.5}
                  strokeDasharray='5 3'
                  className='cursor-pointer'
                  onClick={() => {
                    setSceneBlockout({ selectedStaircaseId: st.id })
                    setActiveSidebarTab('scene')
                    setActiveSceneTool('stairs')
                  }}
                />

                {isSel && sceneBlockout.showViewportHandles && (
                  <>
                    {/* Bottom Step XY Move Handle */}
                    <ControlPoint
                      absolutePosition={baseAbs}
                      stroke='#10b981'
                      fill='rgba(16, 185, 129, 0.42)'
                      onControlPointDrag={(dragPos: Point2D) => {
                        didDragControlPoint(dragPos)
                        const hit = unprojectRelativePointToPlaneZ(
                          abs2RelWithOptionalSnap(dragPos),
                          st.offsetZ,
                          camParams
                        )
                        if (hit) {
                          updateStaircaseExtrusion(st.id, {
                            offsetX: Number(hit.x.toFixed(2)),
                            offsetY: Number(hit.y.toFixed(2))
                          })
                        }
                      }}
                    />
                    <text
                      x={baseAbs.x + 10}
                      y={baseAbs.y + 4}
                      fill='#6ee7b7'
                      fontSize={9}
                      fontFamily='JetBrains Mono, monospace'
                      fontWeight={700}
                      className='pointer-events-none select-none'
                    >
                      Stair Base XY
                    </text>

                    {/* Run Depth Handle */}
                    <ControlPoint
                      absolutePosition={backFloorAbs}
                      stroke='#34d399'
                      fill='rgba(52, 211, 153, 0.35)'
                      onControlPointDrag={(dragPos: Point2D) => {
                        didDragControlPoint(dragPos)
                        const hit = unprojectRelativePointToPlaneZ(
                          abs2RelWithOptionalSnap(dragPos),
                          st.offsetZ,
                          camParams
                        )
                        if (hit) {
                          const dx = hit.x - st.offsetX
                          const dy = hit.y - st.offsetY
                          const projRun = -dx * sinY + dy * cosY
                          updateStaircaseExtrusion(st.id, {
                            runDepthY: Number(
                              Math.max(0.4, Math.min(10, projRun)).toFixed(2)
                            )
                          })
                        }
                      }}
                    />
                    <text
                      x={backFloorAbs.x + 8}
                      y={backFloorAbs.y + 12}
                      fill='#a7f3d0'
                      fontSize={9}
                      fontFamily='JetBrains Mono, monospace'
                      fontWeight={700}
                      className='pointer-events-none select-none'
                    >
                      Run:{st.runDepthY.toFixed(1)}m
                    </text>

                    {/* Width Handle */}
                    <ControlPoint
                      absolutePosition={rightMidAbs}
                      stroke='#34d399'
                      fill='rgba(52, 211, 153, 0.35)'
                      onControlPointDrag={(dragPos: Point2D) => {
                        didDragControlPoint(dragPos)
                        const hit = unprojectRelativePointToPlaneZ(
                          abs2RelWithOptionalSnap(dragPos),
                          st.offsetZ,
                          camParams
                        )
                        if (hit) {
                          const dx = hit.x - st.offsetX
                          const dy = hit.y - st.offsetY
                          const localX = Math.abs(dx * cosY + dy * sinY)
                          updateStaircaseExtrusion(st.id, {
                            widthX: Number(
                              Math.max(0.4, Math.min(8, localX * 2)).toFixed(2)
                            )
                          })
                        }
                      }}
                    />
                    <text
                      x={rightMidAbs.x + 8}
                      y={rightMidAbs.y + 4}
                      fill='#a7f3d0'
                      fontSize={9}
                      fontFamily='JetBrains Mono, monospace'
                      fontWeight={700}
                      className='pointer-events-none select-none'
                    >
                      W:{st.widthX.toFixed(1)}m
                    </text>

                    {/* Top Landing Height Z↑ Handle */}
                    <ControlPoint
                      absolutePosition={topAbs}
                      stroke='#10b981'
                      fill='rgba(16, 185, 129, 0.45)'
                      onControlPointDrag={(dragPos: Point2D) => {
                        didDragControlPoint(dragPos)
                        const solvedH = solveExtrudedHeightZFromRelativePoint(
                          abs2RelWithOptionalSnap(dragPos),
                          { x: backFloorCenter3D.x, y: backFloorCenter3D.y },
                          st.offsetZ,
                          camParams
                        )
                        if (solvedH !== null) {
                          updateStaircaseExtrusion(st.id, {
                            totalHeightZ: Number(
                              Math.max(0.2, Math.min(6, solvedH)).toFixed(2)
                            )
                          })
                        }
                      }}
                    />
                    <g
                      transform={`translate(${topAbs.x}, ${topAbs.y - 18})`}
                      className='pointer-events-none select-none'
                    >
                      <rect
                        x={-88}
                        y={-11}
                        width={176}
                        height={20}
                        rx={5}
                        fill='rgba(4, 24, 18, 0.92)'
                        stroke='#10b981'
                        strokeWidth={1.1}
                      />
                      <text
                        x={0}
                        y={2.5}
                        textAnchor='middle'
                        fill='#a7f3d0'
                        fontSize={9.5}
                        fontFamily='JetBrains Mono, monospace'
                        fontWeight={600}
                      >
                        {st.mode === 'smooth-ramp'
                          ? `Ramp H:${st.totalHeightZ.toFixed(2)}m · D:${st.runDepthY.toFixed(1)}m`
                          : `${st.stepCount} Steps · H:${st.totalHeightZ.toFixed(2)}m`}
                      </text>
                    </g>
                  </>
                )}
              </g>
            )
          })}

        {/* Option 6 (Optional): Arbitrary N-Point 3D Floor Polygon Prism Handles */}
        {sceneBlockout.floorPrismsEnabled &&
          sceneBlockout.floorPrisms.map((prism) => {
            const isSel = prism.id === sceneBlockout.selectedFloorPrismId
            const ptsAbs = prism.polygonRel.map((pt) => rel2AbsPoint(pt))
            const polyStr = ptsAbs.map((p) => `${p.x},${p.y}`).join(' ')

            // Compute 3D centroid on Z = baseZ to project the Z↑ Top Height handle
            const camParams = solverResult.cameraParameters
            let topHandleAbs: Point2D | null = null
            let centroidXY: { x: number; y: number } | null = null
            if (camParams) {
              const floorHits = prism.polygonRel
                .map((rel) =>
                  unprojectRelativePointToPlaneZ(rel, prism.baseZ, camParams)
                )
                .filter((h): h is NonNullable<typeof h> => h !== null)
              if (floorHits.length >= 3) {
                const cx =
                  floorHits.reduce((a, b) => a + b.x, 0) / floorHits.length
                const cy =
                  floorHits.reduce((a, b) => a + b.y, 0) / floorHits.length
                centroidXY = { x: cx, y: cy }
                topHandleAbs = rel2AbsPoint(
                  projectBlockoutPointToRelative(
                    { x: cx, y: cy, z: prism.baseZ + prism.heightZ },
                    camParams
                  )
                )
              }
            }

            return (
              <g key={`floor-prism-svg-${prism.id}`}>
                <polygon
                  points={polyStr}
                  fill={
                    isSel
                      ? 'rgba(249, 115, 22, 0.16)'
                      : 'rgba(249, 115, 22, 0.06)'
                  }
                  stroke={isSel ? '#f97316' : 'rgba(249, 115, 22, 0.5)'}
                  strokeWidth={isSel ? 2.2 : 1.4}
                  strokeDasharray='5 3'
                  className='cursor-pointer'
                  onClick={(e) => {
                    e.stopPropagation()
                    setSceneBlockout({ selectedFloorPrismId: prism.id })
                    setActiveSidebarTab('scene')
                    setActiveSceneTool('prisms')
                  }}
                />
                {isSel &&
                  ptsAbs.map((pos, idx) => (
                    <g key={`prism-vtx-${prism.id}-${idx}`}>
                      <ControlPoint
                        absolutePosition={pos}
                        stroke='#f97316'
                        fill='rgba(249, 115, 22, 0.42)'
                        onControlPointDrag={(dragPos: Point2D) => {
                          didDragControlPoint(dragPos)
                          setFloorPrismVertex(
                            prism.id,
                            idx,
                            abs2RelWithOptionalSnap(dragPos)
                          )
                        }}
                      />
                      <text
                        x={pos.x + 8}
                        y={pos.y - 6}
                        fill='#fed7aa'
                        fontSize={9}
                        fontFamily='JetBrains Mono, monospace'
                        fontWeight={700}
                        className='pointer-events-none select-none'
                      >
                        F{idx + 1}
                      </text>
                    </g>
                  ))}

                {isSel &&
                  topHandleAbs &&
                  centroidXY &&
                  camParams &&
                  sceneBlockout.showViewportHandles && (
                    <>
                      <ControlPoint
                        absolutePosition={topHandleAbs}
                        stroke='#fb923c'
                        fill='rgba(251, 146, 60, 0.5)'
                        onControlPointDrag={(dragPos: Point2D) => {
                          didDragControlPoint(dragPos)
                          const solvedH = solveExtrudedHeightZFromRelativePoint(
                            abs2RelWithOptionalSnap(dragPos),
                            centroidXY,
                            prism.baseZ,
                            camParams
                          )
                          if (solvedH !== null) {
                            updateFloorPolygonPrism(prism.id, {
                              heightZ: Number(
                                Math.max(0.1, Math.min(8, solvedH)).toFixed(2)
                              )
                            })
                          }
                        }}
                      />
                      <g
                        transform={`translate(${topHandleAbs.x}, ${topHandleAbs.y - 18})`}
                        className='pointer-events-none select-none'
                      >
                        <rect
                          x={-82}
                          y={-11}
                          width={164}
                          height={20}
                          rx={5}
                          fill='rgba(32, 14, 4, 0.92)'
                          stroke='#f97316'
                          strokeWidth={1.1}
                        />
                        <text
                          x={0}
                          y={2.5}
                          textAnchor='middle'
                          fill='#fed7aa'
                          fontSize={9.5}
                          fontFamily='JetBrains Mono, monospace'
                          fontWeight={600}
                        >
                          {prism.polygonRel.length}-Gon Prism · Z↑ {prism.heightZ.toFixed(2)}m
                        </text>
                      </g>
                    </>
                  )}
              </g>
            )
          })}

        {/* Option 7 (Optional): Axis-Symmetric 3D Revolved "Lathe" Object Handles */}
        {sceneBlockout.latheObjectsEnabled &&
          sceneBlockout.latheObjects.map((lathe) => {
            const isSel = lathe.id === sceneBlockout.selectedLatheObjectId
            const centerAbs = rel2AbsPoint(lathe.baseCenterRel)
            const edgeAbs = rel2AbsPoint(lathe.baseEdgeRel)
            const topAbs = rel2AbsPoint(lathe.topCenterRel)
            const solved = solverResult.cameraParameters
              ? solveRevolvedLathe3D(lathe, solverResult.cameraParameters)
              : null

            return (
              <g key={`lathe-svg-${lathe.id}`}>
                <line
                  x1={centerAbs.x}
                  y1={centerAbs.y}
                  x2={topAbs.x}
                  y2={topAbs.y}
                  stroke={isSel ? '#ec4899' : 'rgba(236, 72, 153, 0.5)'}
                  strokeWidth={isSel ? 2.4 : 1.5}
                  strokeDasharray='4 3'
                  className='cursor-pointer'
                  onClick={(e) => {
                    e.stopPropagation()
                    setSceneBlockout({ selectedLatheObjectId: lathe.id })
                    setActiveSidebarTab('scene')
                    setActiveSceneTool('lathe')
                  }}
                />
                <line
                  x1={centerAbs.x}
                  y1={centerAbs.y}
                  x2={edgeAbs.x}
                  y2={edgeAbs.y}
                  stroke={isSel ? '#f472b6' : 'rgba(244, 114, 182, 0.5)'}
                  strokeWidth={isSel ? 2.4 : 1.5}
                  className='pointer-events-none'
                />

                {isSel && (
                  <>
                    <ControlPoint
                      absolutePosition={centerAbs}
                      stroke='#ec4899'
                      fill='rgba(236, 72, 153, 0.42)'
                      onControlPointDrag={(dragPos: Point2D) => {
                        didDragControlPoint(dragPos)
                        updateRevolvedLatheObject(lathe.id, {
                          baseCenterRel: abs2RelWithOptionalSnap(dragPos)
                        })
                      }}
                    />
                    <text
                      x={centerAbs.x - 36}
                      y={centerAbs.y + 15}
                      fill='#fbcfe8'
                      fontSize={9}
                      fontFamily='JetBrains Mono, monospace'
                      fontWeight={700}
                      className='pointer-events-none select-none'
                    >
                      Center
                    </text>

                    <ControlPoint
                      absolutePosition={edgeAbs}
                      stroke='#ec4899'
                      fill='rgba(236, 72, 153, 0.42)'
                      onControlPointDrag={(dragPos: Point2D) => {
                        didDragControlPoint(dragPos)
                        updateRevolvedLatheObject(lathe.id, {
                          baseEdgeRel: abs2RelWithOptionalSnap(dragPos)
                        })
                      }}
                    />
                    <text
                      x={edgeAbs.x + 8}
                      y={edgeAbs.y + 14}
                      fill='#fbcfe8'
                      fontSize={9}
                      fontFamily='JetBrains Mono, monospace'
                      fontWeight={700}
                      className='pointer-events-none select-none'
                    >
                      Radius R
                    </text>

                    <ControlPoint
                      absolutePosition={topAbs}
                      stroke='#ec4899'
                      fill='rgba(236, 72, 153, 0.42)'
                      onControlPointDrag={(dragPos: Point2D) => {
                        didDragControlPoint(dragPos)
                        updateRevolvedLatheObject(lathe.id, {
                          topCenterRel: abs2RelWithOptionalSnap(dragPos)
                        })
                      }}
                    />
                    <g
                      transform={`translate(${topAbs.x}, ${topAbs.y - 18})`}
                      className='pointer-events-none select-none'
                    >
                      <rect
                        x={-86}
                        y={-11}
                        width={172}
                        height={20}
                        rx={5}
                        fill='rgba(32, 6, 22, 0.92)'
                        stroke='#ec4899'
                        strokeWidth={1.1}
                      />
                      <text
                        x={0}
                        y={2.5}
                        textAnchor='middle'
                        fill='#fbcfe8'
                        fontSize={9.5}
                        fontFamily='JetBrains Mono, monospace'
                        fontWeight={600}
                      >
                        {solved
                          ? `3D Lathe Ø${(solved.baseRadius * 2).toFixed(2)}m · H:${solved.height.toFixed(2)}m`
                          : '3D Revolved Lathe'}
                      </text>
                    </g>
                  </>
                )}
              </g>
            )
          })}

        {/* Option 8 (Optional): Parametric 3D Coffered Ceiling Grid & Repeating Wall Panel Array Handles */}
        {(sceneBlockout.cofferedArraysEnabled ?? false) &&
          (sceneBlockout.cofferedArrays ?? []).map((arr) => {
            const isSel = arr.id === sceneBlockout.selectedCofferedArrayId
            const ptsAbs = arr.quadRel.map((pt) => rel2AbsPoint(pt))
            const polyStr = ptsAbs.map((p) => `${p.x},${p.y}`).join(' ')
            const topMidX = 0.5 * (ptsAbs[0].x + ptsAbs[1].x)
            const topMidY = 0.5 * (ptsAbs[0].y + ptsAbs[1].y)

            const rows = Math.max(1, Math.min(8, Math.round(arr.rows)))
            const cols = Math.max(1, Math.min(8, Math.round(arr.cols)))
            const gridLines: { x1: number; y1: number; x2: number; y2: number }[] = []

            for (let r = 1; r < rows; r++) {
              const v = r / rows
              gridLines.push({
                x1: ptsAbs[0].x * (1 - v) + ptsAbs[3].x * v,
                y1: ptsAbs[0].y * (1 - v) + ptsAbs[3].y * v,
                x2: ptsAbs[1].x * (1 - v) + ptsAbs[2].x * v,
                y2: ptsAbs[1].y * (1 - v) + ptsAbs[2].y * v
              })
            }
            for (let c = 1; c < cols; c++) {
              const u = c / cols
              gridLines.push({
                x1: ptsAbs[0].x * (1 - u) + ptsAbs[1].x * u,
                y1: ptsAbs[0].y * (1 - u) + ptsAbs[1].y * u,
                x2: ptsAbs[3].x * (1 - u) + ptsAbs[2].x * u,
                y2: ptsAbs[3].y * (1 - u) + ptsAbs[2].y * u
              })
            }

            return (
              <g key={`coffered-arr-svg-${arr.id}`}>
                <polygon
                  points={polyStr}
                  fill={
                    isSel
                      ? 'rgba(129, 140, 248, 0.14)'
                      : 'rgba(129, 140, 248, 0.05)'
                  }
                  stroke={isSel ? '#818cf8' : 'rgba(129, 140, 248, 0.5)'}
                  strokeWidth={isSel ? 2.2 : 1.4}
                  strokeDasharray='5 3'
                  className='cursor-pointer'
                  onClick={(e) => {
                    e.stopPropagation()
                    setSceneBlockout({ selectedCofferedArrayId: arr.id })
                    setActiveSidebarTab('scene')
                    setActiveSceneTool('coffers')
                  }}
                />
                {gridLines.map((gl, gIdx) => (
                  <line
                    key={`coffer-grid-${arr.id}-${gIdx}`}
                    x1={gl.x1}
                    y1={gl.y1}
                    x2={gl.x2}
                    y2={gl.y2}
                    stroke='rgba(129, 140, 248, 0.45)'
                    strokeWidth={1.1}
                    strokeDasharray='3 3'
                    className='pointer-events-none'
                  />
                ))}
                {isSel &&
                  ptsAbs.map((pos, cIdx) => (
                    <g key={`coffer-corner-${arr.id}-${cIdx}`}>
                      <ControlPoint
                        absolutePosition={pos}
                        stroke='#818cf8'
                        fill='rgba(129, 140, 248, 0.42)'
                        onControlPointDrag={(dragPos: Point2D) => {
                          didDragControlPoint(dragPos)
                          setCofferedArrayCorner(
                            arr.id,
                            cIdx as 0 | 1 | 2 | 3,
                            abs2RelWithOptionalSnap(dragPos)
                          )
                        }}
                      />
                      <text
                        x={pos.x + 8}
                        y={pos.y - 6}
                        fill='#c7d2fe'
                        fontSize={9}
                        fontFamily='JetBrains Mono, monospace'
                        fontWeight={700}
                        className='pointer-events-none select-none'
                      >
                        {cornerLabels[cIdx]}
                      </text>
                    </g>
                  ))}
                {isSel && (
                  <g
                    transform={`translate(${topMidX}, ${topMidY - 16})`}
                    className='pointer-events-none select-none'
                  >
                    <rect
                      x={-90}
                      y={-11}
                      width={180}
                      height={20}
                      rx={5}
                      fill='rgba(14, 16, 38, 0.92)'
                      stroke='#818cf8'
                      strokeWidth={1.1}
                    />
                    <text
                      x={0}
                      y={2.5}
                      textAnchor='middle'
                      fill='#c7d2fe'
                      fontSize={9.5}
                      fontFamily='JetBrains Mono, monospace'
                      fontWeight={600}
                    >
                      {rows}×{cols} Coffer Grid ({arr.recessDepth >= 0 ? '+' : ''}
                      {arr.recessDepth.toFixed(2)}m)
                    </text>
                  </g>
                )}
              </g>
            )
          })}

        {/* Option 9 (Optional): 3-Point Curved Arc Wall & Bow-Window Bay Extruder Handles */}
        {(sceneBlockout.curvedWallsEnabled ?? false) &&
          (sceneBlockout.curvedWalls ?? []).map((cw) => {
            const isSel = cw.id === sceneBlockout.selectedCurvedWallId
            const sAbs = rel2AbsPoint(cw.startRel)
            const aAbs = rel2AbsPoint(cw.apexRel)
            const eAbs = rel2AbsPoint(cw.endRel)

            // Quadratic Bezier control point in 2D screen space passing through aAbs at t=0.5
            const ctrlX = 2 * aAbs.x - 0.5 * (sAbs.x + eAbs.x)
            const ctrlY = 2 * aAbs.y - 0.5 * (sAbs.y + eAbs.y)
            const svgPathD = `M ${sAbs.x} ${sAbs.y} Q ${ctrlX} ${ctrlY} ${eAbs.x} ${eAbs.y}`

            const camParams = solverResult.cameraParameters
            let topApexAbs: Point2D | null = null
            let apex3D: { x: number; y: number } | null = null
            if (camParams) {
              const hitA = unprojectRelativePointToPlaneZ(
                cw.apexRel,
                cw.baseZ,
                camParams
              )
              if (hitA) {
                apex3D = { x: hitA.x, y: hitA.y }
                topApexAbs = rel2AbsPoint(
                  projectBlockoutPointToRelative(
                    { x: hitA.x, y: hitA.y, z: cw.baseZ + cw.heightZ },
                    camParams
                  )
                )
              }
            }

            return (
              <g key={`curved-wall-svg-${cw.id}`}>
                <path
                  d={svgPathD}
                  fill='none'
                  stroke={isSel ? '#14b8a6' : 'rgba(20, 184, 166, 0.55)'}
                  strokeWidth={isSel ? 3.0 : 1.8}
                  strokeDasharray='6 3'
                  className='cursor-pointer'
                  onClick={(ev) => {
                    ev.stopPropagation()
                    setSceneBlockout({ selectedCurvedWallId: cw.id })
                    setActiveSidebarTab('scene')
                    setActiveSceneTool('curved-walls')
                  }}
                />
                {isSel && (
                  <>
                    <ControlPoint
                      absolutePosition={sAbs}
                      stroke='#14b8a6'
                      fill='rgba(20, 184, 166, 0.42)'
                      onControlPointDrag={(dragPos: Point2D) => {
                        didDragControlPoint(dragPos)
                        updateCurvedArcWall(cw.id, {
                          startRel: abs2RelWithOptionalSnap(dragPos)
                        })
                      }}
                    />
                    <text
                      x={sAbs.x - 32}
                      y={sAbs.y + 14}
                      fill='#99f6e4'
                      fontSize={9}
                      fontFamily='JetBrains Mono, monospace'
                      fontWeight={700}
                      className='pointer-events-none select-none'
                    >
                      Arc Start
                    </text>

                    <ControlPoint
                      absolutePosition={aAbs}
                      stroke='#2dd4bf'
                      fill='rgba(45, 212, 191, 0.45)'
                      onControlPointDrag={(dragPos: Point2D) => {
                        didDragControlPoint(dragPos)
                        updateCurvedArcWall(cw.id, {
                          apexRel: abs2RelWithOptionalSnap(dragPos)
                        })
                      }}
                    />
                    <text
                      x={aAbs.x + 8}
                      y={aAbs.y + 14}
                      fill='#99f6e4'
                      fontSize={9}
                      fontFamily='JetBrains Mono, monospace'
                      fontWeight={700}
                      className='pointer-events-none select-none'
                    >
                      Arc Apex
                    </text>

                    <ControlPoint
                      absolutePosition={eAbs}
                      stroke='#14b8a6'
                      fill='rgba(20, 184, 166, 0.42)'
                      onControlPointDrag={(dragPos: Point2D) => {
                        didDragControlPoint(dragPos)
                        updateCurvedArcWall(cw.id, {
                          endRel: abs2RelWithOptionalSnap(dragPos)
                        })
                      }}
                    />
                    <text
                      x={eAbs.x + 8}
                      y={eAbs.y + 14}
                      fill='#99f6e4'
                      fontSize={9}
                      fontFamily='JetBrains Mono, monospace'
                      fontWeight={700}
                      className='pointer-events-none select-none'
                    >
                      Arc End
                    </text>

                    {topApexAbs &&
                      apex3D &&
                      camParams &&
                      sceneBlockout.showViewportHandles && (
                        <>
                          <line
                            x1={aAbs.x}
                            y1={aAbs.y}
                            x2={topApexAbs.x}
                            y2={topApexAbs.y}
                            stroke='#2dd4bf'
                            strokeWidth={1.6}
                            strokeDasharray='4 3'
                            className='pointer-events-none'
                          />
                          <ControlPoint
                            absolutePosition={topApexAbs}
                            stroke='#2dd4bf'
                            fill='rgba(45, 212, 191, 0.5)'
                            onControlPointDrag={(dragPos: Point2D) => {
                              didDragControlPoint(dragPos)
                              const solvedH =
                                solveExtrudedHeightZFromRelativePoint(
                                  abs2RelWithOptionalSnap(dragPos),
                                  apex3D,
                                  cw.baseZ,
                                  camParams
                                )
                              if (solvedH !== null) {
                                updateCurvedArcWall(cw.id, {
                                  heightZ: Number(
                                    Math.max(0.2, Math.min(8, solvedH)).toFixed(
                                      2
                                    )
                                  )
                                })
                              }
                            }}
                          />
                          <g
                            transform={`translate(${topApexAbs.x}, ${topApexAbs.y - 18})`}
                            className='pointer-events-none select-none'
                          >
                            <rect
                              x={-84}
                              y={-11}
                              width={168}
                              height={20}
                              rx={5}
                              fill='rgba(4, 26, 24, 0.92)'
                              stroke='#14b8a6'
                              strokeWidth={1.1}
                            />
                            <text
                              x={0}
                              y={2.5}
                              textAnchor='middle'
                              fill='#99f6e4'
                              fontSize={9.5}
                              fontFamily='JetBrains Mono, monospace'
                              fontWeight={600}
                            >
                              Curved Wall · Z↑ {cw.heightZ.toFixed(2)}m
                            </text>
                          </g>
                        </>
                      )}
                  </>
                )}
              </g>
            )
          })}
      </g>
    )
  }

  const renderRepeatedCloneWireframesOverlay = () => {
    if (
      !sceneBlockout.enabled ||
      sceneBlockout.freeOrbitMode ||
      parallaxAnimator.enabled ||
      !solverResult.cameraParameters
    ) {
      return null
    }

    const clones = computeRepeatedCloneWireframesSVG(
      sceneBlockout,
      solverResult.cameraParameters
    )
    if (clones.length === 0) return null

    return (
      <g className='pointer-events-none select-none'>
        {clones.map((clone) => {
          const badgeAbs = rel2AbsPoint(clone.badgeAnchorRel)
          return (
            <g key={clone.id} opacity={0.82}>
              {clone.polylinesRel.map((polyRel, pIdx) => {
                const ptsStr = polyRel
                  .map((pt) => {
                    const abs = rel2AbsPoint(pt)
                    return `${abs.x},${abs.y}`
                  })
                  .join(' ')
                return (
                  <polyline
                    key={`${clone.id}-poly-${pIdx}`}
                    points={ptsStr}
                    fill='none'
                    stroke={clone.color}
                    strokeWidth={1.6}
                    strokeDasharray='4 3'
                  />
                )
              })}
              <g transform={`translate(${badgeAbs.x}, ${badgeAbs.y - 10})`}>
                <rect
                  x={-42}
                  y={-9}
                  width={84}
                  height={16}
                  rx={4}
                  fill='rgba(10, 14, 22, 0.88)'
                  stroke={clone.color}
                  strokeWidth={1}
                />
                <text
                  x={0}
                  y={2}
                  textAnchor='middle'
                  fill='#f8fafc'
                  fontSize={8.5}
                  fontFamily='JetBrains Mono, monospace'
                  fontWeight={700}
                >
                  {clone.label}
                </text>
              </g>
            </g>
          )
        })}
      </g>
    )
  }

  const renderTextureUnwarpQuadOverlay = () => {
    if (!textureUnwarp.enabled) return null

    const cornersAbs = textureUnwarp.quad.map((pt) => rel2AbsPoint(pt))
    const cornerLabels = ['TL', 'TR', 'BR', 'BL']
    const polyPoints = cornersAbs.map((p) => `${p.x},${p.y}`).join(' ')

    return (
      <g>
        <polygon
          points={polyPoints}
          fill='rgba(244, 63, 94, 0.14)'
          stroke='#fb7185'
          strokeWidth={2}
          strokeDasharray='6 3'
          className='pointer-events-none'
        />
        {cornersAbs.map((pos, idx) => (
          <g key={`unwarp-corner-${idx}`}>
            <ControlPoint
              absolutePosition={pos}
              stroke='#fb7185'
              fill='rgba(244, 63, 94, 0.35)'
              onControlPointDrag={(dragPos: Point2D) => {
                didDragControlPoint(dragPos)
                setTextureUnwarpCorner(
                  idx as 0 | 1 | 2 | 3,
                  abs2RelWithOptionalSnap(dragPos)
                )
              }}
            />
            <text
              x={pos.x + 9}
              y={pos.y - 8}
              fill='#fda4af'
              fontSize={10}
              fontFamily='JetBrains Mono, monospace'
              fontWeight={700}
              className='pointer-events-none select-none'
            >
              {cornerLabels[idx]}
            </text>
          </g>
        ))}
      </g>
    )
  }

  const renderWorldRulerOverlay = () => {
    if (!worldRulerEnabled || !solverResult.cameraParameters) return null

    const aspect =
      imageState.width && imageState.height
        ? imageState.width / imageState.height
        : 1.5
    const p1Rel =
      lensDistortionEnabled && (Math.abs(lensK1) > 1e-6 || Math.abs(lensK2) > 1e-6)
        ? undistortRelativePoint(worldRulerPoints[0], lensK1, lensK2, aspect)
        : worldRulerPoints[0]
    const p2Rel =
      lensDistortionEnabled && (Math.abs(lensK1) > 1e-6 || Math.abs(lensK2) > 1e-6)
        ? undistortRelativePoint(worldRulerPoints[1], lensK1, lensK2, aspect)
        : worldRulerPoints[1]

    const measuredDist = computeWorldRulerDistance(
      p1Rel,
      p2Rel,
      worldRulerPlane,
      solverResult.cameraParameters
    )

    const p1Abs = rel2AbsPoint(worldRulerPoints[0])
    const p2Abs = rel2AbsPoint(worldRulerPoints[1])
    const midAbs = {
      x: 0.5 * (p1Abs.x + p2Abs.x),
      y: 0.5 * (p1Abs.y + p2Abs.y)
    }

    const unitLabel =
      calibrationSettingsBase.referenceDistanceUnit === ReferenceDistanceUnit.None
        ? 'units'
        : calibrationSettingsBase.referenceDistanceUnit

    const planeLabel =
      worldRulerPlane === 'ground-xy'
        ? 'XY Floor'
        : worldRulerPlane === 'vertical-z'
          ? 'Z Height'
          : worldRulerPlane === 'wall-xz'
            ? 'XZ Wall'
            : 'YZ Wall'

    return (
      <g>
        {/* Measurement Line */}
        <line
          x1={p1Abs.x}
          y1={p1Abs.y}
          x2={p2Abs.x}
          y2={p2Abs.y}
          stroke='#34d399'
          strokeWidth={2.2}
          strokeDasharray='5 3'
        />

        {/* Endpoint A */}
        <ControlPoint
          absolutePosition={p1Abs}
          stroke='#34d399'
          fill='rgba(16, 185, 129, 0.25)'
          onControlPointDrag={(pos: Point2D) => {
            didDragControlPoint(pos)
            setWorldRulerPoint(
              0,
              abs2RelWithOptionalSnap(pos, worldRulerPoints[1])
            )
          }}
        />
        {/* Endpoint B */}
        <ControlPoint
          absolutePosition={p2Abs}
          stroke='#34d399'
          fill='rgba(16, 185, 129, 0.25)'
          onControlPointDrag={(pos: Point2D) => {
            didDragControlPoint(pos)
            setWorldRulerPoint(
              1,
              abs2RelWithOptionalSnap(pos, worldRulerPoints[0])
            )
          }}
        />

        {/* Midpoint 3D Distance Readout Pill */}
        <g
          transform={`translate(${midAbs.x}, ${midAbs.y - 16})`}
          className='pointer-events-none select-none'
        >
          <rect
            x={-68}
            y={-12}
            width={136}
            height={22}
            rx={5}
            fill='rgba(9, 13, 18, 0.92)'
            stroke='#34d399'
            strokeWidth={1.1}
          />
          <text
            x={0}
            y={2.5}
            textAnchor='middle'
            fill='#6ee7b7'
            fontSize={10.5}
            fontFamily='JetBrains Mono, monospace'
            fontWeight={600}
          >
            {measuredDist !== null
              ? `${measuredDist.toFixed(3)} ${unitLabel} (${planeLabel})`
              : `Horizon Clip (${planeLabel})`}
          </text>
        </g>
      </g>
    )
  }

  const renderReferenceDistanceControl = () => {
    const referenceAxis = calibrationSettingsBase.referenceDistanceAxis
    if (referenceAxis === null) return null

    const cameraParameters = solverResult.cameraParameters
    if (!cameraParameters) return null

    const imageWidth = imageState.width
    const imageHeight = imageState.height
    if (!imageWidth || !imageHeight) return null

    const referenceAxisVpIndex = Solver.vanishingPointIndexForAxis(
      referenceAxis,
      cameraParameters.vanishingPointAxes
    )
    const uIndex = (referenceAxisVpIndex + 1) % 3
    const vIndex = (referenceAxisVpIndex + 2) % 3

    const positionRel = controlPointsStateBase.referenceDistanceAnchor
    const position = CoordinatesUtil.convert(
      positionRel,
      ImageCoordinateFrame.Relative,
      ImageCoordinateFrame.ImagePlane,
      imageWidth,
      imageHeight
    )

    const origin = CoordinatesUtil.convert(
      controlPointsStateBase.origin,
      ImageCoordinateFrame.Relative,
      ImageCoordinateFrame.ImagePlane,
      imageWidth,
      imageHeight
    )

    const anchorPositionIsValid = MathUtil.pointsAreOnTheSameSideOfLine(
      cameraParameters.vanishingPoints[uIndex],
      cameraParameters.vanishingPoints[vIndex],
      origin,
      position
    )

    const uIntersectionPlane = MathUtil.lineIntersection(
      [origin, cameraParameters.vanishingPoints[uIndex]],
      [position, cameraParameters.vanishingPoints[vIndex]]
    )
    const vIntersectionPlane = MathUtil.lineIntersection(
      [origin, cameraParameters.vanishingPoints[vIndex]],
      [position, cameraParameters.vanishingPoints[uIndex]]
    )

    if (!uIntersectionPlane || !vIntersectionPlane) {
      return null
    }

    const uIntersection = imagePlane2Abs(uIntersectionPlane)
    const vIntersection = imagePlane2Abs(vIntersectionPlane)
    const posAbs = imagePlane2Abs(position)
    const originAbs = imagePlane2Abs(origin)

    const referenceAxisVpRel = CoordinatesUtil.convert(
      cameraParameters.vanishingPoints[referenceAxisVpIndex],
      ImageCoordinateFrame.ImagePlane,
      ImageCoordinateFrame.Relative,
      imageWidth,
      imageHeight
    )

    const anchorToVpRel = MathUtil.normalized({
      x: referenceAxisVpRel.x - positionRel.x,
      y: referenceAxisVpRel.y - positionRel.y
    })

    const handlePositions = Solver.referenceDistanceHandlesRelativePositions(
      controlPointsStateBase,
      referenceAxis,
      cameraParameters.vanishingPoints,
      cameraParameters.vanishingPointAxes,
      imageWidth,
      imageHeight
    )

    return (
      <ReferenceDistanceControl
        referenceAxis={referenceAxis}
        origin={originAbs}
        horizonVanishingPoints={[
          imagePlane2Abs(cameraParameters.vanishingPoints[uIndex]),
          imagePlane2Abs(cameraParameters.vanishingPoints[vIndex])
        ]}
        uIntersection={uIntersection}
        vIntersection={vIntersection}
        anchorPositionIsValid={anchorPositionIsValid}
        anchorPosition={posAbs}
        handlePositions={[
          rel2AbsPoint(handlePositions[0]),
          rel2AbsPoint(handlePositions[1])
        ]}
        anchorDragCallback={(pos: Point2D) => {
          didDragControlPoint(pos)
          setReferenceDistanceAnchor(abs2RelWithOptionalSnap(pos))
        }}
        handleDragCallback={(handleIndex: number, dragPosition: Point2D) => {
          const dragRel = abs2RelPoint(dragPosition, false)
          const a = {
            x: dragRel.x - positionRel.x,
            y: dragRel.y - positionRel.y
          }
          const offset = MathUtil.dot(anchorToVpRel, a)
          didDragControlPoint(dragPosition, handleIndex)
          setReferenceDistanceHandleOffset(handleIndex, offset)
        }}
      />
    )
  }

  const render1VPControlPoints = () => {
    const cameraParameters = solverResult.cameraParameters
    const secondVanishingPoint = cameraParameters
      ? cameraParameters.vanishingPoints[1]
      : null
    return (
      <g>
        <HorizonControl
          vanishingPointIndex={1}
          vanishingPoint={
            secondVanishingPoint ? imagePlane2Abs(secondVanishingPoint) : null
          }
          color={vanishingPointColor(1)}
          pointPair={rel2AbsControlPointPairState(
            controlPointsState1VP.horizon
          )}
          dragCallback={(
            controlPointIndex: ControlPointPairIndex,
            position: Point2D
          ) => {
            didDragControlPoint(position)
            const oppositeIdx =
              controlPointIndex === ControlPointPairIndex.First
                ? ControlPointPairIndex.Second
                : ControlPointPairIndex.First
            const anchorRel = controlPointsState1VP.horizon[oppositeIdx]
            setHorizonControlPointPosition(
              controlPointIndex,
              abs2RelWithOptionalSnap(position, anchorRel)
            )
          }}
        />
        <PrincipalPointControl
          absolutePosition={rel2AbsPoint(controlPointsStateBase.principalPoint)}
          enabled={
            calibrationSettings1VP.principalPointMode ===
            PrincipalPointMode1VP.Manual
          }
          visible={
            calibrationSettings1VP.principalPointMode ===
            PrincipalPointMode1VP.Manual
          }
          dragCallback={(absolutePosition: Point2D) => {
            didDragControlPoint(absolutePosition)
            setPrincipalPointPosition(abs2RelWithOptionalSnap(absolutePosition))
          }}
        />
      </g>
    )
  }

  const render2VPControlPoints = () => {
    const firstVanishingPointControlState =
      controlPointsStateBase.firstVanishingPoint
    let secondVanishingPointControlState =
      controlPointsState2VP.secondVanishingPoint
    if (calibrationSettings2VP.quadModeEnabled) {
      secondVanishingPointControlState = {
        lineSegments: [
          [
            firstVanishingPointControlState.lineSegments[0][0],
            firstVanishingPointControlState.lineSegments[1][0]
          ],
          [
            firstVanishingPointControlState.lineSegments[0][1],
            firstVanishingPointControlState.lineSegments[1][1]
          ]
        ]
      }
    }

    let principalPoint2VPAbs: Point2D | null = null
    if (
      calibrationSettings2VP.principalPointMode ===
      PrincipalPointMode2VP.FromThirdVanishingPoint
    ) {
      if (solverResult.cameraParameters?.principalPoint) {
        principalPoint2VPAbs = imagePlane2Abs(
          solverResult.cameraParameters.principalPoint
        )
      }
    } else if (
      calibrationSettings2VP.principalPointMode === PrincipalPointMode2VP.Manual
    ) {
      principalPoint2VPAbs = rel2AbsPoint(controlPointsStateBase.principalPoint)
    }

    const vp2Residuals = solverResult.vpResiduals?.find(
      (r) => r.vpIndex === 1
    )?.segmentAnglesDeg
    const vp3Residuals = solverResult.vpResiduals?.find(
      (r) => r.vpIndex === 2
    )?.segmentAnglesDeg

    return (
      <g>
        <VanishingPointControl
          hideControlPoints={calibrationSettings2VP.quadModeEnabled}
          vanishingPointIndex={1}
          color={vanishingPointColor(1)}
          controlState={rel2AbsVanishingPointControlState(
            secondVanishingPointControlState
          )}
          vanishingPoint={vanishingPointAbs(1)}
          showResiduals={showResidualErrorHUD}
          segmentResidualAnglesDeg={vp2Residuals}
          onControlPointDrag={(
            lineSegmentIndex: number,
            pointPairIndex: ControlPointPairIndex,
            position: Point2D
          ) => {
            if (!calibrationSettings2VP.quadModeEnabled) {
              didDragControlPoint(position)
              const oppositeIdx =
                pointPairIndex === ControlPointPairIndex.First
                  ? ControlPointPairIndex.Second
                  : ControlPointPairIndex.First
              const anchorRel =
                controlPointsState2VP.secondVanishingPoint.lineSegments[
                  lineSegmentIndex
                ]?.[oppositeIdx]
              setSecondVPControlPoint(
                lineSegmentIndex,
                pointPairIndex,
                abs2RelWithOptionalSnap(position, anchorRel)
              )
            }
          }}
        />
        {calibrationSettings2VP.principalPointMode ===
          PrincipalPointMode2VP.FromThirdVanishingPoint && (
          <VanishingPointControl
            vanishingPointIndex={2}
            color={vanishingPointColor(2)}
            controlState={rel2AbsVanishingPointControlState(
              controlPointsState2VP.thirdVanishingPoint
            )}
            vanishingPoint={vanishingPointAbs(2)}
            showResiduals={showResidualErrorHUD}
            segmentResidualAnglesDeg={vp3Residuals}
            onControlPointDrag={(
              lineSegmentIndex: number,
              pointPairIndex: ControlPointPairIndex,
              position: Point2D
            ) => {
              didDragControlPoint(position)
              const oppositeIdx =
                pointPairIndex === ControlPointPairIndex.First
                  ? ControlPointPairIndex.Second
                  : ControlPointPairIndex.First
              const anchorRel =
                controlPointsState2VP.thirdVanishingPoint.lineSegments[
                  lineSegmentIndex
                ]?.[oppositeIdx]
              setThirdVPControlPoint(
                lineSegmentIndex,
                pointPairIndex,
                abs2RelWithOptionalSnap(position, anchorRel)
              )
            }}
          />
        )}
        {principalPoint2VPAbs && (
          <PrincipalPointControl
            absolutePosition={principalPoint2VPAbs}
            enabled={
              calibrationSettings2VP.principalPointMode ===
              PrincipalPointMode2VP.Manual
            }
            visible={
              calibrationSettings2VP.principalPointMode !==
              PrincipalPointMode2VP.Default
            }
            dragCallback={(absolutePosition: Point2D) => {
              didDragControlPoint(absolutePosition)
              setPrincipalPointPosition(
                abs2RelWithOptionalSnap(absolutePosition)
              )
            }}
          />
        )}
      </g>
    )
  }

  const is1VPMode =
    globalSettings.calibrationMode === CalibrationMode.OneVanishingPoint
  const hasImage = imageState.url !== null
  const isFreeOrbitActive =
    sceneBlockout.enabled && sceneBlockout.freeOrbitMode
  const vp1Residuals = solverResult.vpResiduals?.find(
    (r) => r.vpIndex === 0
  )?.segmentAnglesDeg

  return (
    <div
      id='center-panel'
      ref={containerRef}
      onWheel={handleWheel}
      onPointerDown={handleCanvasPointerDown}
      onPointerMove={handleCanvasPointerMove}
      onPointerUp={handleCanvasPointerUp}
      className={`relative flex-1 h-full overflow-hidden bg-[#121417] select-none ${
        spaceIsDown || isPanning
          ? 'cursor-grab active:cursor-grabbing'
          : sceneBlockout.enabled && sceneBlockout.interactiveDrawMode
            ? 'cursor-crosshair'
            : ''
      }`}
    >
      {/* Subtle studio calibration dot-grid backdrop */}
      <div
        className='absolute inset-0 pointer-events-none opacity-20'
        style={{
          backgroundImage:
            'radial-gradient(rgba(148, 163, 184, 0.35) 1px, transparent 1px)',
          backgroundSize: '24px 24px'
        }}
      />

      {hasImage && aabb && (
        <>
          {/* Reference Background Image (or Undistorted Plate if Opt-In Lens Undistortion is active) */}
          <img
            src={activeImageSrc!}
            alt='Calibration reference'
            referrerPolicy='no-referrer'
            draggable={false}
            style={{
              opacity: globalSettings.imageOpacity,
              position: 'absolute',
              left: aabb.xMin,
              top: aabb.yMin,
              width: AABBOps.width(aabb),
              height: AABBOps.height(aabb)
            }}
            className='pointer-events-none select-none shadow-2xl ring-1 ring-white/10'
          />

          {/* Three.js Real-Time 3D Calibration Proxy, Reconstructed 3D Scene & Free 3D Orbit (Opt-In) */}
          {solverResult.cameraParameters && (
            <ThreeOverlay
              imageAABB={aabb}
              cameraParameters={solverResult.cameraParameters}
              visible={showThreeMeshOverlay}
              preset={threeProxyPreset}
              proxyTransform={threeProxyTransform}
              customModelUrl={customModelUrl}
              customModelFormat={customModelFormat}
              sunShadowConfig={sunShadowConfig}
              sceneBlockout={sceneBlockout}
              parallaxAnimator={parallaxAnimator}
              imageUrl={activeImageSrc}
            />
          )}

          {/* High-DPI Interactive Vector SVG Control Layer (hidden during Free 3D Orbit or active 2.5D Parallax Camera playback) */}
          {!isFreeOrbitActive && !parallaxAnimator.enabled && (
            <svg
              width={bounds.width}
              height={bounds.height}
              className='absolute inset-0 z-20 overflow-visible'
            >
              {/* Opt-In Detected Architectural Edges Overlay */}
              {showDetectedEdgesOverlay && edgeMap && (
                <g>
                  {edgeMap.segments.slice(0, 36).map((seg, idx) => {
                    const p1 = rel2AbsPoint(seg.p1)
                    const p2 = rel2AbsPoint(seg.p2)
                    return (
                      <line
                        key={`det-edge-${idx}`}
                        x1={p1.x}
                        y1={p1.y}
                        x2={p2.x}
                        y2={p2.y}
                        stroke='#22d3ee'
                        strokeWidth={2.5}
                        strokeOpacity={0.6}
                        strokeDasharray='4 3'
                        className='cursor-pointer hover:stroke-amber-400 hover:stroke-opacity-100'
                        onClick={(ev) => handleAssignDetectedEdge(seg, ev)}
                      />
                    )
                  })}
                </g>
              )}

              {solverResult.cameraParameters && (
                <Overlay3DPanel
                  referenceDistanceAxis={
                    calibrationSettingsBase.referenceDistanceAxis
                  }
                  imageAABB={aabb}
                  width={bounds.width}
                  height={bounds.height}
                  cameraParameters={solverResult.cameraParameters}
                  globalSettings={globalSettings}
                />
              )}
              {is1VPMode ? render1VPControlPoints() : render2VPControlPoints()}
              <g>
                <VanishingPointControl
                  vanishingPointIndex={0}
                  color={vanishingPointColor(0)}
                  controlState={rel2AbsVanishingPointControlState(
                    controlPointsStateBase.firstVanishingPoint
                  )}
                  vanishingPoint={vanishingPointAbs(0)}
                  showResiduals={showResidualErrorHUD}
                  segmentResidualAnglesDeg={vp1Residuals}
                  onControlPointDrag={(
                    lineSegmentIndex: number,
                    pointPairIndex: ControlPointPairIndex,
                    position: Point2D
                  ) => {
                    didDragControlPoint(position)
                    const oppositeIdx =
                      pointPairIndex === ControlPointPairIndex.First
                        ? ControlPointPairIndex.Second
                        : ControlPointPairIndex.First
                    const anchorRel =
                      controlPointsStateBase.firstVanishingPoint.lineSegments[
                        lineSegmentIndex
                      ]?.[oppositeIdx]
                    setFirstVPControlPoint(
                      lineSegmentIndex,
                      pointPairIndex,
                      abs2RelWithOptionalSnap(position, anchorRel)
                    )
                  }}
                />
                <OriginControl
                  absolutePosition={rel2AbsPoint(controlPointsStateBase.origin)}
                  dragCallback={(absolutePosition: Point2D) => {
                    didDragControlPoint(absolutePosition)
                    setOriginPosition(abs2RelWithOptionalSnap(absolutePosition))
                  }}
                />
                {renderReferenceDistanceControl()}
                {renderWorldRulerOverlay()}
                {renderRepeatedCloneWireframesOverlay()}
                {renderBlockoutViewportHandles()}
                {renderBillboardCutoutsOverlay()}
                {renderHallwayWallDetailsOverlay()}
                {renderTextureUnwarpQuadOverlay()}
              </g>

              {/* Interactive Ground Footprint Drag Preview */}
              {footprintDrag && (
                <rect
                  x={Math.min(
                    footprintDrag.startAbs.x,
                    footprintDrag.currentAbs.x
                  )}
                  y={Math.min(
                    footprintDrag.startAbs.y,
                    footprintDrag.currentAbs.y
                  )}
                  width={Math.abs(
                    footprintDrag.currentAbs.x - footprintDrag.startAbs.x
                  )}
                  height={Math.abs(
                    footprintDrag.currentAbs.y - footprintDrag.startAbs.y
                  )}
                  fill='rgba(56, 189, 248, 0.18)'
                  stroke='#38bdf8'
                  strokeWidth={2}
                  strokeDasharray='5 3'
                  className='pointer-events-none'
                />
              )}

              {/* Visual Sub-Pixel Magnetic Snap Ring & Snapped Line Segment Indicator */}
              {snappedIndicatorPos && (
                <g className='pointer-events-none'>
                  {snappedSegmentAbs && (
                    <line
                      x1={snappedSegmentAbs.p1.x}
                      y1={snappedSegmentAbs.p1.y}
                      x2={snappedSegmentAbs.p2.x}
                      y2={snappedSegmentAbs.p2.y}
                      stroke='#22d3ee'
                      strokeWidth={2.5}
                      strokeOpacity={0.85}
                      strokeDasharray='5 3'
                    />
                  )}
                  <circle
                    cx={snappedIndicatorPos.x}
                    cy={snappedIndicatorPos.y}
                    r={12}
                    fill='rgba(34, 211, 238, 0.14)'
                    stroke={snappedKind === 'corner' ? '#fbbf24' : '#22d3ee'}
                    strokeWidth={2}
                  />
                  <circle
                    cx={snappedIndicatorPos.x}
                    cy={snappedIndicatorPos.y}
                    r={3}
                    fill={snappedKind === 'corner' ? '#fbbf24' : '#22d3ee'}
                  />
                  <g
                    transform={`translate(${snappedIndicatorPos.x}, ${snappedIndicatorPos.y - 20})`}
                  >
                    <rect
                      x={-38}
                      y={-9}
                      width={76}
                      height={16}
                      rx={4}
                      fill='rgba(8, 18, 28, 0.92)'
                      stroke={snappedKind === 'corner' ? '#fbbf24' : '#22d3ee'}
                      strokeWidth={1}
                    />
                    <text
                      x={0}
                      y={2}
                      textAnchor='middle'
                      fill={snappedKind === 'corner' ? '#fde68a' : '#a5f3fc'}
                      fontSize={8.5}
                      fontFamily='JetBrains Mono, monospace'
                      fontWeight={700}
                    >
                      {snappedKind === 'corner'
                        ? 'CORNER SNAP'
                        : snappedKind === 'segment'
                          ? 'LINE SNAP'
                          : 'EDGE SNAP'}
                    </text>
                  </g>
                </g>
              )}
            </svg>
          )}

          {/* Precision Shift-Drag Loupe */}
          {isDraggingControlPoint &&
            shiftIsDown &&
            imageState.width !== null &&
            imageState.height !== null && (
              <MagnifyingGlass
                imageWith={imageState.width}
                imageHeight={imageState.height}
                imageSrc={activeImageSrc}
                position={magnifyingGlassPosition}
                relativeImagePosition={abs2RelPoint(
                  magnifyingGlassPosition,
                  false
                )}
              />
            )}

          {/* Top-Left Minimal Status / Hint Overlay */}
          {isFreeOrbitActive ? (
            <div className='absolute top-3 left-3 z-30 flex items-center gap-3 text-xs text-sky-200 bg-[#111827] border border-sky-500/50 px-3.5 py-2 rounded-lg shadow-xl'>
              <Orbit className='w-4 h-4 text-sky-400 shrink-0' />
              <span className='font-semibold'>
                Free 3D Orbit View (Camera-Projected 3D Scene)
              </span>
              <span className='text-slate-400'>
                Left-drag: Orbit · Right-drag: Pan · Scroll: Zoom
              </span>
              <button
                type='button'
                onClick={() => setSceneBlockout({ freeOrbitMode: false })}
                className='ml-2 px-2.5 py-1 rounded bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold transition-colors cursor-pointer'
              >
                Return to Photo View
              </button>
            </div>
          ) : parallaxAnimator.enabled ? (
            <div className='absolute top-3 left-3 z-30 flex items-center gap-3 text-xs text-violet-200 bg-[#151126] border border-violet-500/50 px-3.5 py-2 rounded-lg shadow-xl'>
              <Video className='w-4 h-4 text-violet-400 shrink-0' />
              <span className='font-semibold'>
                2.5D Parallax Shot ({parallaxAnimator.preset})
              </span>
              <button
                type='button'
                onClick={() =>
                  setParallaxAnimator({ isPlaying: !parallaxAnimator.isPlaying })
                }
                className='px-2.5 py-1 rounded bg-violet-500/25 hover:bg-violet-500/40 text-violet-200 border border-violet-500/40 font-semibold transition-colors cursor-pointer'
              >
                {parallaxAnimator.isPlaying ? 'Pause Motion' : 'Play Motion'}
              </button>
              <button
                type='button'
                onClick={() =>
                  setParallaxAnimator({ enabled: false, isPlaying: false })
                }
                className='px-2.5 py-1 rounded bg-violet-500 hover:bg-violet-400 text-slate-950 font-semibold transition-colors cursor-pointer'
              >
                Return to Photo View
              </button>
            </div>
          ) : (
            <div className='absolute top-3 left-3 z-30 pointer-events-none flex items-center gap-3 text-xs text-slate-400 bg-[#181b20]/90 border border-slate-800/90 px-3 py-1.5 rounded-lg'>
              <span className='font-medium text-slate-200'>
                {is1VPMode ? '1-Point Perspective' : '2-Point Perspective'}
              </span>
              <span aria-hidden='true'>·</span>
              <span>Hold Shift for precision loupe</span>
              <span aria-hidden='true'>·</span>
              <span>Hold Alt to edge-snap</span>
              {sceneBlockout.enabled && sceneBlockout.interactiveDrawMode && (
                <>
                  <span aria-hidden='true'>·</span>
                  <span className='text-sky-300 font-semibold'>
                    Click &amp; drag on floor to spawn 3D Box
                  </span>
                </>
              )}
              {sceneBlockout.enabled &&
                sceneBlockout.showViewportHandles &&
                !sceneBlockout.interactiveDrawMode && (
                  <>
                    <span aria-hidden='true'>·</span>
                    <span className='text-sky-300 font-medium'>
                      Click any 3D handle to inspect · Drag Z↑ / W / D to Push/Pull
                    </span>
                  </>
                )}
            </div>
          )}

          {/* On-Canvas Context-Sensitive 3D Scene & Vanishing-Line Repeat Array Quick-Bar */}
          {sceneBlockout.enabled &&
            !isFreeOrbitActive &&
            !parallaxAnimator.enabled && (
              <div className='absolute top-3 right-3 z-30 flex items-center gap-2 bg-[#141821] border border-sky-500/40 px-3 py-1.5 rounded-lg shadow-xl text-xs text-slate-200'>
                <span className='text-[11px] font-semibold text-sky-300'>
                  3D Tool:
                </span>
                <select
                  value={activeSceneTool}
                  onChange={(e) => {
                    setActiveSidebarTab('scene')
                    setActiveSceneTool(e.target.value as typeof activeSceneTool)
                  }}
                  className='bg-[#0f131a] border border-slate-700/80 rounded px-2 py-0.5 text-[11px] text-slate-100 focus:outline-none focus:border-sky-400'
                >
                  <option value='room'>Room Shell</option>
                  <option value='boxes'>3D Boxes</option>
                  <option value='columns'>3-Sweep Pillars</option>
                  <option value='reliefs'>Doors &amp; Portals</option>
                  <option value='rails'>Pipes &amp; Cables</option>
                  <option value='stairs'>Stairs &amp; Ramps</option>
                  <option value='prisms'>Floor Prisms</option>
                  <option value='lathe'>3D Lathe</option>
                  <option value='coffers'>Coffer Grid</option>
                  <option value='curved-walls'>Curved Wall</option>
                  <option value='billboards'>2.5D Cutouts</option>
                  <option value='wall-cutouts'>Wall Decals</option>
                  <option value='ai-bridge'>Depth &amp; Normals</option>
                </select>

                {/* Direct On-Canvas Repeat Array Controls when Boxes, Pillars, Doors, or Rails are active */}
                {activeSceneTool === 'boxes' &&
                  (() => {
                    const selVol =
                      sceneBlockout.volumes.find(
                        (v) => v.id === sceneBlockout.selectedVolumeId
                      ) ?? sceneBlockout.volumes[0]
                    if (!selVol) return null
                    return (
                      <div className='flex items-center gap-1.5 pl-2 border-l border-slate-700/80'>
                        <span className='text-[10px] text-amber-300 font-medium'>
                          Clone Array:
                        </span>
                        <input
                          type='range'
                          min={1}
                          max={8}
                          step={1}
                          value={selVol.repeatCount ?? 1}
                          onChange={(e) =>
                            updateBlockoutVolume(selVol.id, {
                              repeatCount: parseInt(e.target.value, 10)
                            })
                          }
                          className='w-14 accent-amber-400 cursor-pointer'
                          title='Clone selected 3D Box along vanishing line'
                        />
                        <span className='font-mono text-[10px] text-amber-200'>
                          {selVol.repeatCount ?? 1}×
                        </span>
                      </div>
                    )
                  })()}

                {activeSceneTool === 'columns' &&
                  (() => {
                    const selCol =
                      sceneBlockout.sweptColumns.find(
                        (c) => c.id === sceneBlockout.selectedSweptColumnId
                      ) ?? sceneBlockout.sweptColumns[0]
                    if (!selCol) return null
                    return (
                      <div className='flex items-center gap-1.5 pl-2 border-l border-slate-700/80'>
                        <span className='text-[10px] text-amber-300 font-medium'>
                          Colonnade:
                        </span>
                        <input
                          type='range'
                          min={1}
                          max={10}
                          step={1}
                          value={selCol.repeatCount ?? 1}
                          onChange={(e) =>
                            updateSweptCylinderColumn(selCol.id, {
                              repeatCount: parseInt(e.target.value, 10)
                            })
                          }
                          className='w-14 accent-amber-400 cursor-pointer'
                          title='Clone selected 3-Sweep Pillar along colonnade vanishing line'
                        />
                        <span className='font-mono text-[10px] text-amber-200'>
                          {selCol.repeatCount ?? 1}×
                        </span>
                      </div>
                    )
                  })()}

                {activeSceneTool === 'reliefs' &&
                  (() => {
                    const selRel =
                      sceneBlockout.wallReliefs.find(
                        (r) => r.id === sceneBlockout.selectedWallReliefId
                      ) ?? sceneBlockout.wallReliefs[0]
                    if (!selRel) return null
                    return (
                      <div className='flex items-center gap-1.5 pl-2 border-l border-slate-700/80'>
                        <span className='text-[10px] text-cyan-300 font-medium'>
                          Repeat Doors:
                        </span>
                        <input
                          type='range'
                          min={1}
                          max={8}
                          step={1}
                          value={selRel.repeatCount ?? 1}
                          onChange={(e) =>
                            updateWallReliefExtrusion(selRel.id, {
                              repeatCount: parseInt(e.target.value, 10)
                            })
                          }
                          className='w-14 accent-cyan-400 cursor-pointer'
                          title='Clone selected Door/Portal along hallway wall'
                        />
                        <span className='font-mono text-[10px] text-cyan-200'>
                          {selRel.repeatCount ?? 1}×
                        </span>
                      </div>
                    )
                  })()}

                {activeSceneTool === 'rails' &&
                  (() => {
                    const selRail =
                      sceneBlockout.sweptRails.find(
                        (r) => r.id === sceneBlockout.selectedSweptRailId
                      ) ?? sceneBlockout.sweptRails[0]
                    if (!selRail) return null
                    return (
                      <div className='flex items-center gap-1.5 pl-2 border-l border-slate-700/80'>
                        <span className='text-[10px] text-rose-300 font-medium'>
                          Parallel Pipes:
                        </span>
                        <input
                          type='range'
                          min={1}
                          max={8}
                          step={1}
                          value={selRail.repeatCount ?? 1}
                          onChange={(e) =>
                            updateSweptWallRail(selRail.id, {
                              repeatCount: parseInt(e.target.value, 10)
                            })
                          }
                          className='w-14 accent-rose-400 cursor-pointer'
                          title='Clone parallel pipes/cables along axis'
                        />
                        <span className='font-mono text-[10px] text-rose-200'>
                          {selRail.repeatCount ?? 1}×
                        </span>
                      </div>
                    )
                  })()}

                <button
                  type='button'
                  onClick={() => setSceneBlockout({ freeOrbitMode: true })}
                  className='ml-1 flex items-center gap-1 px-2 py-0.5 rounded bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold transition-colors cursor-pointer'
                  title='Detach camera and orbit freely around the reconstructed 3D scene'
                >
                  <Orbit className='w-3 h-3' />
                  <span>3D Orbit</span>
                </button>
              </div>
            )}

          {/* Collapsible Bottom Control Dock (Zero Viewport Occlusion) */}
          <div
            style={{
              bottom: '16px',
              left: '50%',
              transform: 'translateX(-50%)',
              maxWidth: 'min(1040px, 96vw)'
            }}
            className='absolute z-30 flex flex-col items-center'
          >
            <button
              type='button'
              onClick={() => setDockCollapsed((prev) => !prev)}
              className='flex items-center gap-1.5 px-3 py-1 text-[11px] font-medium text-slate-300 bg-[#181b20] hover:bg-slate-800 border border-b-0 border-slate-700/80 rounded-t-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer'
              title='Toggle Viewport Controls (H)'
            >
              {dockCollapsed ? (
                <>
                  <ChevronUp className='w-3.5 h-3.5 text-amber-400' />
                  <span>Show Controls</span>
                </>
              ) : (
                <>
                  <ChevronDown className='w-3.5 h-3.5 text-slate-400' />
                  <span>Hide Controls</span>
                </>
              )}
            </button>

            {!dockCollapsed && (
              <div className='flex items-center gap-2.5 px-3.5 py-2 bg-[#181b20] border border-slate-700/80 rounded-xl shadow-2xl text-xs text-slate-200'>
                {/* Zoom Controls */}
                <div className='flex items-center gap-1'>
                  <button
                    type='button'
                    onClick={() =>
                      setViewport({
                        zoom: Math.max(0.25, viewport.zoom / 1.2)
                      })
                    }
                    className='p-1.5 rounded-md hover:bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer'
                    title='Zoom Out'
                  >
                    <ZoomOut className='w-3.5 h-3.5' />
                  </button>
                  <span className='w-12 text-center font-mono tabular-nums text-[11px] text-slate-300'>
                    {Math.round(viewport.zoom * 100)}%
                  </span>
                  <button
                    type='button'
                    onClick={() =>
                      setViewport({
                        zoom: Math.min(8, viewport.zoom * 1.2)
                      })
                    }
                    className='p-1.5 rounded-md hover:bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer'
                    title='Zoom In'
                  >
                    <ZoomIn className='w-3.5 h-3.5' />
                  </button>
                  <button
                    type='button'
                    onClick={resetViewport}
                    className='flex items-center gap-1 px-2 py-1 rounded-md hover:bg-slate-800 text-slate-300 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer'
                    title='Fit Image to Viewport (F)'
                  >
                    <Maximize2 className='w-3.5 h-3.5' />
                    <span>Fit</span>
                  </button>
                </div>

                <div className='h-4 w-px bg-slate-800' />

                {/* Image Opacity Quick Slider */}
                <div className='flex items-center gap-2'>
                  <span className='text-slate-400 whitespace-nowrap shrink-0'>
                    Opacity
                  </span>
                  <input
                    type='range'
                    min={0.05}
                    max={1}
                    step={0.05}
                    value={globalSettings.imageOpacity}
                    onChange={(e) =>
                      setImageOpacity(parseFloat(e.target.value))
                    }
                    className='w-20'
                  />
                  <span className='w-8 font-mono tabular-nums text-[11px] text-slate-300'>
                    {Math.round(globalSettings.imageOpacity * 100)}%
                  </span>
                </div>

                <div className='h-4 w-px bg-slate-800' />

                {/* Wireframe 3D Guide Selector */}
                <div className='flex items-center gap-1.5'>
                  <span className='text-slate-400 whitespace-nowrap shrink-0'>
                    Guide
                  </span>
                  <select
                    value={globalSettings.overlay3DGuide}
                    onChange={(e) =>
                      setOverlay3DGuide(e.target.value as Overlay3DGuide)
                    }
                    className='bg-[#121417] border border-slate-700/80 rounded-md px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-amber-500'
                  >
                    <option value={Overlay3DGuide.None}>Off</option>
                    <option value={Overlay3DGuide.Box}>3D Box</option>
                    <option value={Overlay3DGuide.XYGridFloor}>
                      XY Grid Floor
                    </option>
                    <option value={Overlay3DGuide.YZGridFloor}>
                      YZ Grid Floor
                    </option>
                    <option value={Overlay3DGuide.ZXGridFloor}>
                      ZX Grid Floor
                    </option>
                  </select>
                </div>

                <div className='h-4 w-px bg-slate-800' />

                {/* Opt-In Magnetic Edge Snap Toggle */}
                <button
                  type='button'
                  onClick={() => setEdgeSnappingEnabled(!edgeSnappingEnabled)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    edgeSnappingEnabled
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'text-slate-300 hover:bg-slate-800 border border-transparent'
                  }`}
                  title='Opt-In: Sub-Pixel Magnetic Edge Snapping'
                >
                  <Magnet className='w-3.5 h-3.5' />
                  <span>Edge Snap</span>
                </button>

                {/* Opt-In 3D World Ruler Toggle */}
                <button
                  type='button'
                  onClick={() => setWorldRulerEnabled(!worldRulerEnabled)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    worldRulerEnabled
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'text-slate-300 hover:bg-slate-800 border border-transparent'
                  }`}
                  title='Opt-In: 3D World Tape Measure / Ruler'
                >
                  <Ruler className='w-3.5 h-3.5' />
                  <span>3D Ruler</span>
                </button>

                {/* Opt-In Three.js Shaded 3D Proxy Toggle */}
                <button
                  type='button'
                  onClick={() => setShowThreeMeshOverlay(!showThreeMeshOverlay)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    showThreeMeshOverlay
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'text-slate-300 hover:bg-slate-800 border border-transparent'
                  }`}
                  title='Opt-In: Toggle Shaded Three.js 3D Reference Mesh'
                >
                  <Box className='w-3.5 h-3.5' />
                  <span>3D Proxy</span>
                </button>

                {/* Opt-In 3D Scene Builder & Free 3D Orbit Toggle */}
                <button
                  type='button'
                  onClick={() =>
                    setSceneBlockout({ enabled: !sceneBlockout.enabled })
                  }
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    sceneBlockout.enabled
                      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                      : 'text-slate-300 hover:bg-slate-800 border border-transparent'
                  }`}
                  title='Opt-In: 3D Scene Blockout & Camera-Projected Photo Mapping'
                >
                  <Layers className='w-3.5 h-3.5' />
                  <span>3D Scene</span>
                </button>

                {sceneBlockout.enabled && (
                  <button
                    type='button'
                    onClick={() =>
                      setSceneBlockout({
                        freeOrbitMode: !sceneBlockout.freeOrbitMode
                      })
                    }
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      sceneBlockout.freeOrbitMode
                        ? 'bg-sky-500 text-slate-950'
                        : 'bg-sky-500/15 text-sky-300 border border-sky-500/30 hover:bg-sky-500/25'
                    }`}
                    title='Detach camera and orbit freely around the photo-projected 3D scene'
                  >
                    <Orbit className='w-3.5 h-3.5' />
                    <span>
                      {sceneBlockout.freeOrbitMode ? 'Exit Orbit' : '3D Orbit'}
                    </span>
                  </button>
                )}

                <div className='h-4 w-px bg-slate-800' />

                {/* Reset Control Points */}
                <button
                  type='button'
                  onClick={resetControlPoints}
                  className='flex items-center gap-1 px-2 py-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer'
                  title='Reset Control Points to Default Positions'
                >
                  <RotateCcw className='w-3.5 h-3.5' />
                  <span>Reset</span>
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
