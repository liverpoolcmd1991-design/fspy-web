/**
 * fSpy
 * Copyright (c) 2020 - Per Gantelius
 */

import { saveAs } from 'file-saver'
import {
  defaultCalibrationSettings1VP,
  defaultCalibrationSettings2VP,
  defaultCalibrationSettingsBase
} from '../defaults/calibration-settings'
import {
  defaultControlPointsState1VP,
  defaultControlPointsState2VP,
  defaultControlPointsStateBase
} from '../defaults/control-points-state'
import { defaultGlobalSettings } from '../defaults/global-settings'
import { defaultImageState } from '../defaults/image-state'
import { defaultResultDisplaySettings } from '../defaults/result-display-settings'
import { defaultSolverResult } from '../defaults/solver-result'
import { defaultUIState } from '../defaults/ui-state'
import SavedState from '../io/saved-state'
import { ExtractedExifData } from '../io/util'
import {
  clearWorkspaceIndexedDB,
  getAutoSaveOptInPreference,
  setAutoSaveOptInPreference
} from '../io/workspace-persistence'
import { cameraPresets } from '../solver/camera-presets'
import {
  autoSuggestVanishingPointLines,
  EdgeGradientMap
} from '../solver/edge-detector'
import {
  autoEstimateK1FromVanishingLines,
  undistortRelativePoint,
  WorldRulerPlane
} from '../solver/lens-distortion'
import {
  BillboardCutout,
  BlockoutVolume,
  CofferedPanelArray,
  createDefaultBillboardCutout,
  createDefaultCofferedPanelArray,
  createDefaultCurvedArcWall,
  createDefaultFloorPolygonPrism,
  createDefaultParallaxAnimatorConfig,
  createDefaultRevolvedLatheObject,
  createDefaultSceneBlockoutConfig,
  createDefaultStaircaseExtrusion,
  createDefaultSweptCylinderColumn,
  createDefaultSweptWallRail,
  createDefaultTextureUnwarpConfig,
  createDefaultWallParallelCutout,
  createDefaultWallReliefExtrusion,
  CurvedArcWall,
  fitBillboard3DFromPolygon,
  FloorPolygonPrism,
  ParallaxAnimatorConfig,
  RevolvedLatheObject,
  SceneBlockoutConfig,
  StaircaseExtrusion,
  SweptCylinderColumn,
  SweptWallRail,
  TextureUnwarpConfig,
  WallParallelCutout,
  WallReliefExtrusion
} from '../solver/scene-reconstruction'
import {
  createDefaultPBRMaterialConfig,
  PBRMaterialConfig
} from '../solver/pbr-material-builder'
import Point2D from '../solver/point-2d'
import Solver from '../solver/solver'
import { SolverResult } from '../solver/solver-result'
import {
  Axis,
  CalibrationSettings1VP,
  CalibrationSettings2VP,
  CalibrationSettingsBase,
  PrincipalPointMode1VP,
  PrincipalPointMode2VP,
  ReferenceDistanceUnit
} from '../types/calibration-settings'
import {
  ControlPointPairIndex,
  ControlPointPairState,
  ControlPointsState1VP,
  ControlPointsState2VP,
  ControlPointsStateBase
} from '../types/control-points-state'
import { CalibrationMode, GlobalSettings, Overlay3DGuide } from '../types/global-settings'
import { ImageState } from '../types/image-state'
import {
  FieldOfViewFormat,
  OrientationFormat,
  PrincipalPointFormat,
  ResultDisplaySettings
} from '../types/result-display-settings'
import { UIState } from '../types/ui-state'
import { temporal } from 'zundo'
import { create } from 'zustand'

export interface ViewportTransform {
  zoom: number
  panX: number
  panY: number
}

export type ActiveModalType = 'about' | 'shortcuts' | 'export-hub' | 'guide' | null

export type SidebarTabId = 'calibrate' | 'scene' | 'pbr' | 'animate'

export type SceneToolId =
  | 'room'
  | 'boxes'
  | 'billboards'
  | 'rails'
  | 'wall-cutouts'
  | 'reliefs'
  | 'columns'
  | 'stairs'
  | 'prisms'
  | 'lathe'
  | 'coffers'
  | 'curved-walls'
  | 'ai-bridge'

export type ThreeProxyPreset =
  | 'calibration-rig'
  | 'human-1.8m'
  | 'arch-portal'
  | 'vehicle-sedan'
  | 'checker-floor'
  | 'custom-model'

export interface ThreeProxyTransform {
  offsetX: number
  offsetY: number
  offsetZ: number
  rotationZ: number
  scale: number
  wireframe: boolean
}

export interface SunShadowConfig {
  enabled: boolean
  azimuthDeg: number
  elevationDeg: number
  shadowOpacity: number
}

export interface CalibrationSnapshot {
  slotIndex: number
  label: string
  hfovDeg: number | null
  focalMm: number | null
  rmsDeg: number | null
  globalSettings: GlobalSettings
  calibrationSettingsBase: CalibrationSettingsBase
  calibrationSettings1VP: CalibrationSettings1VP
  calibrationSettings2VP: CalibrationSettings2VP
  controlPointsStateBase: ControlPointsStateBase
  controlPointsState1VP: ControlPointsState1VP
  controlPointsState2VP: ControlPointsState2VP
  multiLineSolverEnabled: boolean
  lensDistortionEnabled: boolean
  lensK1: number
  lensK2: number
}

export interface FSpyStoreState {
  uiState: UIState
  globalSettings: GlobalSettings
  calibrationSettingsBase: CalibrationSettingsBase
  calibrationSettings1VP: CalibrationSettings1VP
  calibrationSettings2VP: CalibrationSettings2VP
  controlPointsStateBase: ControlPointsStateBase
  controlPointsState1VP: ControlPointsState1VP
  controlPointsState2VP: ControlPointsState2VP
  resultDisplaySettings: ResultDisplaySettings
  image: ImageState
  solverResult: SolverResult

  // Modernized Studio UI & Opt-In Extensions (All default to false / classic fSpy)
  viewport: ViewportTransform
  exifData: ExtractedExifData | null
  toastMessage: string | null
  activeModal: ActiveModalType
  activeSidebarTab: SidebarTabId
  activeSceneTool: SceneToolId

  // Opt-In #1: Multi-Line Least-Squares VP Solver & Residual Diagnostics
  multiLineSolverEnabled: boolean
  showResidualErrorHUD: boolean

  // Opt-In #2: Sub-Pixel Edge Snapping & Line Detection Assistant
  edgeSnappingEnabled: boolean
  showDetectedEdgesOverlay: boolean
  edgeMap: EdgeGradientMap | null

  // Opt-In #3: Interactive 3D Proxy Objects & Custom .GLB/.OBJ Loader
  showThreeMeshOverlay: boolean
  threeProxyPreset: ThreeProxyPreset
  threeProxyTransform: ThreeProxyTransform
  customModelUrl: string | null
  customModelFormat: 'glb' | 'obj' | null
  customModelName: string | null

  // Opt-In #4: Radial Lens Distortion Undistortion (k1, k2)
  lensDistortionEnabled: boolean
  lensK1: number
  lensK2: number
  undistortedImageUrl: string | null

  // Opt-In #5: Multi-Reference 3D World Ruler Verifier
  worldRulerEnabled: boolean
  worldRulerPlane: WorldRulerPlane
  worldRulerPoints: [Point2D, Point2D]

  // Opt-In #6: Interactive Sun & Shadow-Catcher Direction Matcher
  sunShadowConfig: SunShadowConfig

  // Opt-In #7: Calibration Snapshot Slots (A/B/C/D) & Local Workspace Auto-Save
  snapshotSlotsEnabled: boolean
  snapshots: [
    CalibrationSnapshot | null,
    CalibrationSnapshot | null,
    CalibrationSnapshot | null,
    CalibrationSnapshot | null
  ]
  activeSnapshotSlot: number | null
  autoSaveEnabled: boolean

  // Opt-In #8: 3D Scene Blockout, Room Shell, Camera-Projected Textures & Free 3D Orbit
  sceneBlockout: SceneBlockoutConfig

  // Opt-In #9: Perspective Texture Unwarper (Flat Wallpaper / Facade Extractor)
  textureUnwarp: TextureUnwarpConfig

  // Opt-In #10: Multi-Scale PBR Material Builder (Delighting, Seamless Tiling, Normal, Roughness, AO)
  pbrMaterialConfig: PBRMaterialConfig

  // Opt-In #11: Cinematic 2.5D Parallax Camera Animator (Still Photo -> Moving 3D Shot)
  parallaxAnimator: ParallaxAnimatorConfig

  // Project & Image Actions
  resetToNewProject: () => void
  loadProjectState: (
    loadedState: SavedState,
    image: ImageState,
    filePath: string | null,
    isExampleProject: boolean
  ) => void
  setImageData: (
    fileName: string,
    url: string,
    data: Uint8Array,
    width: number,
    height: number,
    exifData?: ExtractedExifData | null
  ) => void
  applyExifFocalLength: () => void

  // Global settings actions
  setCalibrationMode: (mode: CalibrationMode) => void
  setImageOpacity: (opacity: number) => void
  setOverlay3DGuide: (guide: Overlay3DGuide) => void
  setSidePanelVisibility: (visible: boolean) => void
  toggleSidePanelVisibility: () => void

  // Opt-In #1 Actions (Multi-Line & Residuals)
  setMultiLineSolverEnabled: (enabled: boolean) => void
  setShowResidualErrorHUD: (enabled: boolean) => void
  addVPLineSegment: (vpIndex: 0 | 1 | 2) => void
  removeVPLineSegment: (vpIndex: 0 | 1 | 2) => void

  // Opt-In #2 Actions (Edge Snapping & Auto-Lines)
  setEdgeSnappingEnabled: (enabled: boolean) => void
  setShowDetectedEdgesOverlay: (enabled: boolean) => void
  setEdgeMap: (edgeMap: EdgeGradientMap | null) => void
  applyAutoSuggestedVPLines: () => void

  // Opt-In #3 Actions (3D Proxy Rig & Custom GLB/OBJ)
  setShowThreeMeshOverlay: (enabled: boolean) => void
  setThreeProxyPreset: (preset: ThreeProxyPreset) => void
  setThreeProxyTransform: (partial: Partial<ThreeProxyTransform>) => void
  resetThreeProxyTransform: () => void
  setCustomModel: (url: string | null, format: 'glb' | 'obj' | null, name: string | null) => void

  // Opt-In #4 Actions (Radial Lens Distortion)
  setLensDistortionEnabled: (enabled: boolean) => void
  setLensDistortionParams: (k1: number, k2: number) => void
  setUndistortedImageUrl: (url: string | null) => void
  autoEstimateLensK1: () => void

  // Opt-In #5 Actions (3D World Ruler Verifier)
  setWorldRulerEnabled: (enabled: boolean) => void
  setWorldRulerPlane: (plane: WorldRulerPlane) => void
  setWorldRulerPoint: (index: 0 | 1, pos: Point2D) => void

  // Opt-In #6 Actions (Sun & Shadow-Catcher Matcher)
  setSunShadowConfig: (partial: Partial<SunShadowConfig>) => void

  // Opt-In #7 Actions (Snapshots A/B/C/D & Local Auto-Save)
  setSnapshotSlotsEnabled: (enabled: boolean) => void
  captureSnapshotSlot: (slotIndex: 0 | 1 | 2 | 3) => void
  restoreSnapshotSlot: (slotIndex: 0 | 1 | 2 | 3) => void
  clearSnapshotSlot: (slotIndex: 0 | 1 | 2 | 3) => void
  setAutoSaveEnabled: (enabled: boolean) => void

  // Opt-In #8 Actions (3D Scene Blockout, Camera-Projected Textures, Cutout Billboards & Free 3D Orbit)
  setSceneBlockout: (partial: Partial<SceneBlockoutConfig>) => void
  addBlockoutVolume: (partial?: Partial<BlockoutVolume>) => void
  updateBlockoutVolume: (id: string, partial: Partial<BlockoutVolume>) => void
  removeBlockoutVolume: (id: string) => void
  addBillboardCutout: () => void
  updateBillboardCutout: (id: string, partial: Partial<BillboardCutout>) => void
  removeBillboardCutout: (id: string) => void
  setBillboardPolygonVertex: (id: string, vertexIndex: number, pos: Point2D) => void
  addBillboardPolygonVertex: (id: string) => void
  removeBillboardPolygonVertex: (id: string) => void

  // Architectural & Hallway Wall Detail Option 1 (Optional): 3D Swept Rail, Multi-Bend Pipe & Catenary Cable
  addSweptWallRail: () => void
  updateSweptWallRail: (id: string, partial: Partial<SweptWallRail>) => void
  removeSweptWallRail: (id: string) => void
  addSweptRailWaypoint: (id: string) => void
  removeSweptRailWaypoint: (id: string) => void
  setSweptRailWaypoint: (id: string, waypointIndex: number, pos: Point2D) => void

  // Architectural & Hallway Wall Detail Option 2 (Optional): Wall-Parallel Offset Cutout Layer
  addWallParallelCutout: () => void
  updateWallParallelCutout: (id: string, partial: Partial<WallParallelCutout>) => void
  removeWallParallelCutout: (id: string) => void
  setWallCutoutCorner: (id: string, cornerIndex: 0 | 1 | 2 | 3, pos: Point2D) => void

  // Architectural & Hallway Wall Detail Option 3 (Optional): Wall Relief & Recessed Alcove Extruder
  addWallReliefExtrusion: () => void
  updateWallReliefExtrusion: (id: string, partial: Partial<WallReliefExtrusion>) => void
  removeWallReliefExtrusion: (id: string) => void
  setWallReliefCorner: (id: string, cornerIndex: 0 | 1 | 2 | 3, pos: Point2D) => void

  // Architectural & Hallway Wall Detail Option 4 (Optional): 3-Sweep Cylinder & Pillar Snapper
  addSweptCylinderColumn: () => void
  updateSweptCylinderColumn: (id: string, partial: Partial<SweptCylinderColumn>) => void
  removeSweptCylinderColumn: (id: string) => void

  // Architectural & Hallway Wall Detail Option 5 (Optional): Parametric 3D Staircase & Sloped Ramp
  addStaircaseExtrusion: () => void
  updateStaircaseExtrusion: (id: string, partial: Partial<StaircaseExtrusion>) => void
  removeStaircaseExtrusion: (id: string) => void

  // Architectural & Hallway Wall Detail Option 6 (Optional): Arbitrary N-Point 3D Floor Polygon Prism
  addFloorPolygonPrism: () => void
  updateFloorPolygonPrism: (id: string, partial: Partial<FloorPolygonPrism>) => void
  removeFloorPolygonPrism: (id: string) => void
  setFloorPrismVertex: (id: string, vertexIndex: number, pos: Point2D) => void
  addFloorPrismVertex: (id: string) => void
  removeFloorPrismVertex: (id: string) => void

  // Architectural & Hallway Wall Detail Option 7 (Optional): Axis-Symmetric 3D Revolved Lathe Object
  addRevolvedLatheObject: () => void
  updateRevolvedLatheObject: (id: string, partial: Partial<RevolvedLatheObject>) => void
  removeRevolvedLatheObject: (id: string) => void

  // Architectural & Hallway Wall Detail Option 8 (Optional): 3D Coffered Ceiling Grid & Repeating Wall Panel Array
  addCofferedPanelArray: () => void
  updateCofferedPanelArray: (id: string, partial: Partial<CofferedPanelArray>) => void
  removeCofferedPanelArray: (id: string) => void
  setCofferedArrayCorner: (id: string, cornerIndex: 0 | 1 | 2 | 3, pos: Point2D) => void

  // Architectural & Hallway Wall Detail Option 9 (Optional): 3-Point Curved Arc Wall & Bow-Window Bay Extruder
  addCurvedArcWall: () => void
  updateCurvedArcWall: (id: string, partial: Partial<CurvedArcWall>) => void
  removeCurvedArcWall: (id: string) => void

  // Opt-In #9 Actions (Perspective Texture Unwarper)
  setTextureUnwarp: (partial: Partial<TextureUnwarpConfig>) => void
  setTextureUnwarpCorner: (cornerIndex: 0 | 1 | 2 | 3, pos: Point2D) => void

  // Opt-In #10 Actions (Multi-Scale PBR Material Builder)
  setPBRMaterialConfig: (partial: Partial<PBRMaterialConfig>) => void

  // Opt-In #11 Actions (Cinematic 2.5D Parallax Camera Animator)
  setParallaxAnimator: (partial: Partial<ParallaxAnimatorConfig>) => void

  // Calibration settings actions
  setFirstVanishingPointAxis: (axis: Axis) => void
  setSecondVanishingPointAxis: (axis: Axis) => void
  setReferenceDistanceAxis: (axis: Axis | null) => void
  setReferenceDistance: (distance: number) => void
  setReferenceDistanceUnit: (unit: ReferenceDistanceUnit) => void
  setCameraPreset: (presetId: string | null) => void
  setCustomSensorSize: (width: number | undefined, height: number | undefined) => void
  setPrincipalPointMode1VP: (mode: PrincipalPointMode1VP) => void
  setAbsoluteFocalLength1VP: (focalLength: number) => void
  setPrincipalPointMode2VP: (mode: PrincipalPointMode2VP) => void
  setQuadModeEnabled: (enabled: boolean) => void

  // Control points actions
  setOriginPosition: (pos: Point2D) => void
  setPrincipalPointPosition: (pos: Point2D) => void
  setReferenceDistanceAnchor: (pos: Point2D) => void
  setReferenceDistanceHandleOffset: (handleIndex: number, offset: number) => void
  setHorizonControlPointPosition: (pointIndex: ControlPointPairIndex, pos: Point2D) => void
  setFirstVPControlPoint: (lineSegmentIndex: number, pointIndex: ControlPointPairIndex, pos: Point2D) => void
  setSecondVPControlPoint: (lineSegmentIndex: number, pointIndex: ControlPointPairIndex, pos: Point2D) => void
  setThirdVPControlPoint: (lineSegmentIndex: number, pointIndex: ControlPointPairIndex, pos: Point2D) => void
  resetControlPoints: () => void

  // Result display settings actions
  setFieldOfViewFormat: (format: FieldOfViewFormat) => void
  setOrientationFormat: (format: OrientationFormat) => void
  setPrincipalPointFormat: (format: PrincipalPointFormat) => void
  setDisplayAbsoluteFocalLength: (enabled: boolean) => void

  // Viewport & UI helpers
  setViewport: (viewport: Partial<ViewportTransform>) => void
  resetViewport: () => void
  showToast: (message: string | null) => void
  setActiveModal: (modal: ActiveModalType) => void
  setActiveSidebarTab: (tab: SidebarTabId) => void
  setActiveSceneTool: (tool: SceneToolId) => void
  activateSceneToolAndEnable: (tool: SceneToolId) => void
  markProjectSaved: (projectName?: string) => void
}

const defaultThreeProxyTransform: ThreeProxyTransform = {
  offsetX: 0,
  offsetY: 0,
  offsetZ: 0,
  rotationZ: 0,
  scale: 1,
  wireframe: false
}

const defaultSunShadowConfig: SunShadowConfig = {
  enabled: false,
  azimuthDeg: 135,
  elevationDeg: 42,
  shadowOpacity: 0.55
}

function undistortControlPointsForSolve(
  base: ControlPointsStateBase,
  cp1: ControlPointsState1VP,
  cp2: ControlPointsState2VP,
  k1: number,
  k2: number,
  aspect: number
): {
  base: ControlPointsStateBase
  cp1: ControlPointsState1VP
  cp2: ControlPointsState2VP
} {
  if (Math.abs(k1) < 1e-6 && Math.abs(k2) < 1e-6) {
    return { base, cp1, cp2 }
  }
  const u = (pt: Point2D) => undistortRelativePoint(pt, k1, k2, aspect)
  const uSegs = (segs: ControlPointPairState[]): ControlPointPairState[] =>
    segs.map((s) => [u(s[0]), u(s[1])])

  return {
    base: {
      ...base,
      origin: u(base.origin),
      principalPoint: u(base.principalPoint),
      referenceDistanceAnchor: u(base.referenceDistanceAnchor),
      firstVanishingPoint: {
        lineSegments: uSegs(base.firstVanishingPoint.lineSegments)
      }
    },
    cp1: {
      horizon: [u(cp1.horizon[0]), u(cp1.horizon[1])]
    },
    cp2: {
      secondVanishingPoint: {
        lineSegments: uSegs(cp2.secondVanishingPoint.lineSegments)
      },
      thirdVanishingPoint: {
        lineSegments: uSegs(cp2.thirdVanishingPoint.lineSegments)
      }
    }
  }
}

function computeSolverResult(state: {
  globalSettings: GlobalSettings
  calibrationSettingsBase: CalibrationSettingsBase
  calibrationSettings1VP: CalibrationSettings1VP
  calibrationSettings2VP: CalibrationSettings2VP
  controlPointsStateBase: ControlPointsStateBase
  controlPointsState1VP: ControlPointsState1VP
  controlPointsState2VP: ControlPointsState2VP
  image: ImageState
  lensDistortionEnabled?: boolean
  lensK1?: number
  lensK2?: number
}): SolverResult {
  let base = state.controlPointsStateBase
  let cp1 = state.controlPointsState1VP
  let cp2 = state.controlPointsState2VP

  if (state.lensDistortionEnabled && state.image.width && state.image.height) {
    const aspect = state.image.width / state.image.height
    const undistorted = undistortControlPointsForSolve(
      base,
      cp1,
      cp2,
      state.lensK1 ?? 0,
      state.lensK2 ?? 0,
      aspect
    )
    base = undistorted.base
    cp1 = undistorted.cp1
    cp2 = undistorted.cp2
  }

  if (state.globalSettings.calibrationMode === CalibrationMode.OneVanishingPoint) {
    return Solver.solve1VP(
      state.calibrationSettingsBase,
      state.calibrationSettings1VP,
      base,
      cp1,
      state.image
    )
  } else {
    return Solver.solve2VP(
      state.calibrationSettingsBase,
      state.calibrationSettings2VP,
      base,
      cp2,
      state.image
    )
  }
}

function updateLineSegmentPoint(
  segments: ControlPointPairState[],
  lineSegmentIndex: number,
  pointIndex: ControlPointPairIndex,
  pos: Point2D
): ControlPointPairState[] {
  const next: ControlPointPairState[] = segments.map((seg) => [
    { ...seg[0] },
    { ...seg[1] }
  ])
  if (next[lineSegmentIndex]) {
    next[lineSegmentIndex][pointIndex] = { x: pos.x, y: pos.y }
  }
  return next
}

function createAdditionalLineSegment(existing: ControlPointPairState[]): ControlPointPairState {
  const count = existing.length
  const last = existing[count - 1] ?? [
    { x: 0.25, y: 0.45 },
    { x: 0.45, y: 0.45 }
  ]
  const dx = last[1].x - last[0].x
  const dy = last[1].y - last[0].y
  const len = Math.hypot(dx, dy) || 0.15
  const nx = -dy / len
  const ny = dx / len
  const shift = (count % 2 === 0 ? 1 : -1) * 0.06
  const clamp = (v: number) => Math.max(0.05, Math.min(0.95, v))
  return [
    { x: clamp(last[0].x + nx * shift), y: clamp(last[0].y + ny * shift) },
    { x: clamp(last[1].x + nx * shift), y: clamp(last[1].y + ny * shift) }
  ]
}

export const useFSpyStore = create<FSpyStoreState>()(
  temporal(
    (set, get) => ({
      uiState: { ...defaultUIState },
      globalSettings: { ...defaultGlobalSettings },
      calibrationSettingsBase: { ...defaultCalibrationSettingsBase },
      calibrationSettings1VP: { ...defaultCalibrationSettings1VP },
      calibrationSettings2VP: { ...defaultCalibrationSettings2VP },
      controlPointsStateBase: { ...defaultControlPointsStateBase },
      controlPointsState1VP: { ...defaultControlPointsState1VP },
      controlPointsState2VP: { ...defaultControlPointsState2VP },
      resultDisplaySettings: { ...defaultResultDisplaySettings },
      image: { ...defaultImageState },
      solverResult: { ...defaultSolverResult },

      viewport: { zoom: 1, panX: 0, panY: 0 },
      exifData: null,
      toastMessage: null,
      activeModal: null,
      activeSidebarTab: 'calibrate',
      activeSceneTool: 'boxes',

      // All fork enhancements default to false (strictly opt-in)
      multiLineSolverEnabled: false,
      showResidualErrorHUD: false,
      edgeSnappingEnabled: false,
      showDetectedEdgesOverlay: false,
      edgeMap: null,
      showThreeMeshOverlay: false,
      threeProxyPreset: 'calibration-rig',
      threeProxyTransform: { ...defaultThreeProxyTransform },
      customModelUrl: null,
      customModelFormat: null,
      customModelName: null,

      lensDistortionEnabled: false,
      lensK1: 0,
      lensK2: 0,
      undistortedImageUrl: null,

      worldRulerEnabled: false,
      worldRulerPlane: 'ground-xy',
      worldRulerPoints: [
        { x: 0.36, y: 0.72 },
        { x: 0.64, y: 0.72 }
      ],

      sunShadowConfig: { ...defaultSunShadowConfig },

      snapshotSlotsEnabled: false,
      snapshots: [null, null, null, null],
      activeSnapshotSlot: null,
      autoSaveEnabled: getAutoSaveOptInPreference(),

      sceneBlockout: createDefaultSceneBlockoutConfig(),
      textureUnwarp: createDefaultTextureUnwarpConfig(),
      pbrMaterialConfig: createDefaultPBRMaterialConfig(),
      parallaxAnimator: createDefaultParallaxAnimatorConfig(),

      resetToNewProject: () => {
        const prevUndistorted = get().undistortedImageUrl
        if (prevUndistorted) URL.revokeObjectURL(prevUndistorted)
        set({
          uiState: { ...defaultUIState },
          globalSettings: { ...defaultGlobalSettings },
          calibrationSettingsBase: { ...defaultCalibrationSettingsBase },
          calibrationSettings1VP: { ...defaultCalibrationSettings1VP },
          calibrationSettings2VP: { ...defaultCalibrationSettings2VP },
          controlPointsStateBase: { ...defaultControlPointsStateBase },
          controlPointsState1VP: { ...defaultControlPointsState1VP },
          controlPointsState2VP: { ...defaultControlPointsState2VP },
          resultDisplaySettings: { ...defaultResultDisplaySettings },
          image: { ...defaultImageState },
          solverResult: { ...defaultSolverResult },
          viewport: { zoom: 1, panX: 0, panY: 0 },
          exifData: null,
          edgeMap: null,
          lensK1: 0,
          lensK2: 0,
          undistortedImageUrl: null,
          snapshots: [null, null, null, null],
          activeSnapshotSlot: null,
          threeProxyTransform: { ...defaultThreeProxyTransform },
          sceneBlockout: createDefaultSceneBlockoutConfig(),
          textureUnwarp: createDefaultTextureUnwarpConfig(),
          pbrMaterialConfig: createDefaultPBRMaterialConfig(),
          parallaxAnimator: createDefaultParallaxAnimatorConfig()
        })
      },

      loadProjectState: (loadedState, image, filePath, isExampleProject) => {
        const prevUndistorted = get().undistortedImageUrl
        if (prevUndistorted) URL.revokeObjectURL(prevUndistorted)

        const fileName = filePath ? filePath.split(/[/\\]/).pop() ?? null : null
        const cleanName = fileName ? fileName.replace(/\.fspy$/i, '') : null
        const hasExtraLines =
          loadedState.controlPointsStateBase.firstVanishingPoint.lineSegments.length > 2 ||
          loadedState.controlPointsState2VP.secondVanishingPoint.lineSegments.length > 2 ||
          loadedState.controlPointsState2VP.thirdVanishingPoint.lineSegments.length > 2
        const nextState = {
          globalSettings: loadedState.globalSettings,
          calibrationSettingsBase: loadedState.calibrationSettingsBase,
          calibrationSettings1VP: loadedState.calibrationSettings1VP,
          calibrationSettings2VP: loadedState.calibrationSettings2VP,
          controlPointsStateBase: loadedState.controlPointsStateBase,
          controlPointsState1VP: loadedState.controlPointsState1VP,
          controlPointsState2VP: loadedState.controlPointsState2VP,
          resultDisplaySettings: loadedState.resultDisplaySettings ?? defaultResultDisplaySettings,
          image
        }
        set({
          ...nextState,
          multiLineSolverEnabled: hasExtraLines ? true : get().multiLineSolverEnabled,
          lensK1: 0,
          lensK2: 0,
          undistortedImageUrl: null,
          uiState: {
            ...get().uiState,
            projectName: isExampleProject ? 'Example project' : cleanName,
            projectHasUnsavedChanges: false
          },
          viewport: { zoom: 1, panX: 0, panY: 0 },
          exifData: null,
          edgeMap: null,
          solverResult: computeSolverResult(nextState)
        })
      },

      setImageData: (fileName, url, data, width, height, exifData = null) => {
        const state = get()
        if (state.undistortedImageUrl) {
          URL.revokeObjectURL(state.undistortedImageUrl)
        }
        const image: ImageState = { width, height, url, data }
        const cleanName = fileName.replace(/\.[^.]+$/, '')
        const solverResult = computeSolverResult({
          globalSettings: state.globalSettings,
          calibrationSettingsBase: state.calibrationSettingsBase,
          calibrationSettings1VP: state.calibrationSettings1VP,
          calibrationSettings2VP: state.calibrationSettings2VP,
          controlPointsStateBase: state.controlPointsStateBase,
          controlPointsState1VP: state.controlPointsState1VP,
          controlPointsState2VP: state.controlPointsState2VP,
          image,
          lensDistortionEnabled: state.lensDistortionEnabled,
          lensK1: 0,
          lensK2: 0
        })

        set({
          image,
          exifData,
          edgeMap: null,
          lensK1: 0,
          lensK2: 0,
          undistortedImageUrl: null,
          solverResult,
          viewport: { zoom: 1, panX: 0, panY: 0 },
          uiState: {
            ...state.uiState,
            projectName: state.uiState.projectName ?? cleanName,
            projectHasUnsavedChanges: true
          }
        })
      },

      applyExifFocalLength: () => {
        const state = get()
        if (!state.exifData) return
        const nextCalibrationBase = { ...state.calibrationSettingsBase }
        const nextCalibration1VP = { ...state.calibrationSettings1VP }

        if (state.exifData.focalLength35mm) {
          nextCalibration1VP.absoluteFocalLength = state.exifData.focalLength35mm
          nextCalibrationBase.cameraData = {
            presetId: '35_mm_film',
            presetData: cameraPresets['35_mm_film'],
            customSensorWidth: 36,
            customSensorHeight: 24
          }
        } else if (state.exifData.focalLength) {
          nextCalibration1VP.absoluteFocalLength = state.exifData.focalLength
        }

        set({
          calibrationSettingsBase: nextCalibrationBase,
          calibrationSettings1VP: nextCalibration1VP,
          solverResult: computeSolverResult({
            ...state,
            calibrationSettingsBase: nextCalibrationBase,
            calibrationSettings1VP: nextCalibration1VP
          }),
          toastMessage: 'Applied EXIF focal length to camera solver'
        })
      },

      setCalibrationMode: (calibrationMode) => {
        const state = get()
        const globalSettings = { ...state.globalSettings, calibrationMode }
        set({
          globalSettings,
          uiState: { ...state.uiState, projectHasUnsavedChanges: true },
          solverResult: computeSolverResult({ ...state, globalSettings })
        })
      },

      setImageOpacity: (imageOpacity) => {
        const state = get()
        const clamped = Math.min(1, Math.max(0.05, imageOpacity))
        set({
          globalSettings: { ...state.globalSettings, imageOpacity: clamped },
          uiState: { ...state.uiState, projectHasUnsavedChanges: true }
        })
      },

      setOverlay3DGuide: (overlay3DGuide) => {
        const state = get()
        set({
          globalSettings: { ...state.globalSettings, overlay3DGuide },
          uiState: { ...state.uiState, projectHasUnsavedChanges: true }
        })
      },

      setSidePanelVisibility: (sidePanelsAreVisible) => {
        set({
          uiState: { ...get().uiState, sidePanelsAreVisible }
        })
      },

      toggleSidePanelVisibility: () => {
        const current = get().uiState.sidePanelsAreVisible
        set({
          uiState: { ...get().uiState, sidePanelsAreVisible: !current }
        })
      },

      // Opt-In #1 Actions: Multi-Line Least-Squares Solver & Residual Diagnostics
      setMultiLineSolverEnabled: (multiLineSolverEnabled) => {
        const state = get()
        if (!multiLineSolverEnabled) {
          const controlPointsStateBase: ControlPointsStateBase = {
            ...state.controlPointsStateBase,
            firstVanishingPoint: {
              lineSegments: state.controlPointsStateBase.firstVanishingPoint.lineSegments.slice(0, 2)
            }
          }
          const controlPointsState2VP: ControlPointsState2VP = {
            secondVanishingPoint: {
              lineSegments: state.controlPointsState2VP.secondVanishingPoint.lineSegments.slice(0, 2)
            },
            thirdVanishingPoint: {
              lineSegments: state.controlPointsState2VP.thirdVanishingPoint.lineSegments.slice(0, 2)
            }
          }
          set({
            multiLineSolverEnabled: false,
            controlPointsStateBase,
            controlPointsState2VP,
            solverResult: computeSolverResult({
              ...state,
              controlPointsStateBase,
              controlPointsState2VP
            })
          })
        } else {
          set({ multiLineSolverEnabled: true })
        }
      },

      setShowResidualErrorHUD: (showResidualErrorHUD) => {
        set({ showResidualErrorHUD })
      },

      addVPLineSegment: (vpIndex) => {
        const state = get()
        const maxLines = 6
        if (vpIndex === 0) {
          const existing = state.controlPointsStateBase.firstVanishingPoint.lineSegments
          if (existing.length >= maxLines) return
          const controlPointsStateBase: ControlPointsStateBase = {
            ...state.controlPointsStateBase,
            firstVanishingPoint: {
              lineSegments: [...existing, createAdditionalLineSegment(existing)]
            }
          }
          set({
            multiLineSolverEnabled: true,
            controlPointsStateBase,
            uiState: { ...state.uiState, projectHasUnsavedChanges: true },
            solverResult: computeSolverResult({ ...state, controlPointsStateBase })
          })
        } else if (vpIndex === 1) {
          const existing = state.controlPointsState2VP.secondVanishingPoint.lineSegments
          if (existing.length >= maxLines) return
          const controlPointsState2VP: ControlPointsState2VP = {
            ...state.controlPointsState2VP,
            secondVanishingPoint: {
              lineSegments: [...existing, createAdditionalLineSegment(existing)]
            }
          }
          set({
            multiLineSolverEnabled: true,
            controlPointsState2VP,
            uiState: { ...state.uiState, projectHasUnsavedChanges: true },
            solverResult: computeSolverResult({ ...state, controlPointsState2VP })
          })
        } else {
          const existing = state.controlPointsState2VP.thirdVanishingPoint.lineSegments
          if (existing.length >= maxLines) return
          const controlPointsState2VP: ControlPointsState2VP = {
            ...state.controlPointsState2VP,
            thirdVanishingPoint: {
              lineSegments: [...existing, createAdditionalLineSegment(existing)]
            }
          }
          set({
            multiLineSolverEnabled: true,
            controlPointsState2VP,
            uiState: { ...state.uiState, projectHasUnsavedChanges: true },
            solverResult: computeSolverResult({ ...state, controlPointsState2VP })
          })
        }
      },

      removeVPLineSegment: (vpIndex) => {
        const state = get()
        if (vpIndex === 0) {
          const existing = state.controlPointsStateBase.firstVanishingPoint.lineSegments
          if (existing.length <= 2) return
          const controlPointsStateBase: ControlPointsStateBase = {
            ...state.controlPointsStateBase,
            firstVanishingPoint: {
              lineSegments: existing.slice(0, existing.length - 1)
            }
          }
          set({
            controlPointsStateBase,
            uiState: { ...state.uiState, projectHasUnsavedChanges: true },
            solverResult: computeSolverResult({ ...state, controlPointsStateBase })
          })
        } else if (vpIndex === 1) {
          const existing = state.controlPointsState2VP.secondVanishingPoint.lineSegments
          if (existing.length <= 2) return
          const controlPointsState2VP: ControlPointsState2VP = {
            ...state.controlPointsState2VP,
            secondVanishingPoint: {
              lineSegments: existing.slice(0, existing.length - 1)
            }
          }
          set({
            controlPointsState2VP,
            uiState: { ...state.uiState, projectHasUnsavedChanges: true },
            solverResult: computeSolverResult({ ...state, controlPointsState2VP })
          })
        } else {
          const existing = state.controlPointsState2VP.thirdVanishingPoint.lineSegments
          if (existing.length <= 2) return
          const controlPointsState2VP: ControlPointsState2VP = {
            ...state.controlPointsState2VP,
            thirdVanishingPoint: {
              lineSegments: existing.slice(0, existing.length - 1)
            }
          }
          set({
            controlPointsState2VP,
            uiState: { ...state.uiState, projectHasUnsavedChanges: true },
            solverResult: computeSolverResult({ ...state, controlPointsState2VP })
          })
        }
      },

      // Opt-In #2 Actions: Sub-Pixel Edge Snapping & Auto-Lines
      setEdgeSnappingEnabled: (edgeSnappingEnabled) => {
        set({ edgeSnappingEnabled })
      },

      setShowDetectedEdgesOverlay: (showDetectedEdgesOverlay) => {
        set({ showDetectedEdgesOverlay })
      },

      setEdgeMap: (edgeMap) => {
        set({ edgeMap })
      },

      applyAutoSuggestedVPLines: () => {
        const state = get()
        if (!state.edgeMap) {
          set({ toastMessage: 'Analyzing image edges… try again in a moment.' })
          return
        }
        const countPerVP = state.multiLineSolverEnabled
          ? Math.max(2, state.controlPointsStateBase.firstVanishingPoint.lineSegments.length)
          : 2
        const suggested = autoSuggestVanishingPointLines(state.edgeMap, countPerVP)
        if (!suggested) {
          set({
            toastMessage: 'Not enough distinct architectural edges found to auto-align.'
          })
          return
        }

        const controlPointsStateBase: ControlPointsStateBase = {
          ...state.controlPointsStateBase,
          firstVanishingPoint: {
            lineSegments: suggested.vp1Segments
          }
        }
        const controlPointsState2VP: ControlPointsState2VP = {
          ...state.controlPointsState2VP,
          secondVanishingPoint: {
            lineSegments: suggested.vp2Segments
          }
        }
        set({
          controlPointsStateBase,
          controlPointsState2VP,
          uiState: { ...state.uiState, projectHasUnsavedChanges: true },
          solverResult: computeSolverResult({
            ...state,
            controlPointsStateBase,
            controlPointsState2VP
          }),
          toastMessage: `Auto-aligned ${suggested.vp1Segments.length} lines per vanishing point (Ctrl+Z to undo)`
        })
      },

      // Opt-In #3 Actions: Interactive 3D Proxy Objects & Custom GLB/OBJ Loader
      setShowThreeMeshOverlay: (showThreeMeshOverlay) => {
        set({ showThreeMeshOverlay })
      },

      setThreeProxyPreset: (threeProxyPreset) => {
        set({ threeProxyPreset, showThreeMeshOverlay: true })
      },

      setThreeProxyTransform: (partial) => {
        set({
          threeProxyTransform: { ...get().threeProxyTransform, ...partial }
        })
      },

      resetThreeProxyTransform: () => {
        set({
          threeProxyTransform: { ...defaultThreeProxyTransform }
        })
      },

      setCustomModel: (customModelUrl, customModelFormat, customModelName) => {
        const prevUrl = get().customModelUrl
        if (prevUrl && prevUrl !== customModelUrl) {
          URL.revokeObjectURL(prevUrl)
        }
        set({
          customModelUrl,
          customModelFormat,
          customModelName,
          threeProxyPreset: customModelUrl ? 'custom-model' : 'calibration-rig',
          showThreeMeshOverlay: Boolean(customModelUrl) || get().showThreeMeshOverlay
        })
      },

      // Opt-In #4 Actions: Radial Lens Distortion (k1, k2)
      setLensDistortionEnabled: (lensDistortionEnabled) => {
        const state = get()
        if (!lensDistortionEnabled && state.undistortedImageUrl) {
          URL.revokeObjectURL(state.undistortedImageUrl)
        }
        set({
          lensDistortionEnabled,
          undistortedImageUrl: lensDistortionEnabled ? state.undistortedImageUrl : null,
          solverResult: computeSolverResult({
            ...state,
            lensDistortionEnabled
          })
        })
      },

      setLensDistortionParams: (lensK1, lensK2) => {
        const state = get()
        set({
          lensK1,
          lensK2,
          solverResult: computeSolverResult({
            ...state,
            lensK1,
            lensK2
          })
        })
      },

      setUndistortedImageUrl: (undistortedImageUrl) => {
        const prev = get().undistortedImageUrl
        if (prev && prev !== undistortedImageUrl) {
          URL.revokeObjectURL(prev)
        }
        set({ undistortedImageUrl })
      },

      autoEstimateLensK1: () => {
        const state = get()
        const aspect =
          state.image.width && state.image.height
            ? state.image.width / state.image.height
            : 1.5
        const vpStates = [state.controlPointsStateBase.firstVanishingPoint]
        if (state.globalSettings.calibrationMode === CalibrationMode.TwoVanishingPoints) {
          vpStates.push(state.controlPointsState2VP.secondVanishingPoint)
          if (
            state.calibrationSettings2VP.principalPointMode ===
            PrincipalPointMode2VP.FromThirdVanishingPoint
          ) {
            vpStates.push(state.controlPointsState2VP.thirdVanishingPoint)
          }
        }
        const estimatedK1 = autoEstimateK1FromVanishingLines(vpStates, aspect)
        set({
          lensDistortionEnabled: true,
          lensK1: estimatedK1,
          solverResult: computeSolverResult({
            ...state,
            lensDistortionEnabled: true,
            lensK1: estimatedK1
          }),
          toastMessage: `Estimated radial distortion k1 = ${estimatedK1.toFixed(3)}`
        })
      },

      // Opt-In #5 Actions: 3D World Ruler Verifier
      setWorldRulerEnabled: (worldRulerEnabled) => {
        set({ worldRulerEnabled })
      },

      setWorldRulerPlane: (worldRulerPlane) => {
        set({ worldRulerPlane })
      },

      setWorldRulerPoint: (index, pos) => {
        const state = get()
        const next: [Point2D, Point2D] = [
          { ...state.worldRulerPoints[0] },
          { ...state.worldRulerPoints[1] }
        ]
        next[index] = { x: pos.x, y: pos.y }
        set({ worldRulerPoints: next })
      },

      // Opt-In #6 Actions: Interactive Sun & Shadow-Catcher Matcher
      setSunShadowConfig: (partial) => {
        const state = get()
        const next = { ...state.sunShadowConfig, ...partial }
        set({
          sunShadowConfig: next,
          showThreeMeshOverlay: next.enabled ? true : state.showThreeMeshOverlay
        })
      },

      // Opt-In #7 Actions: Calibration Snapshot Slots (A/B/C/D) & Auto-Save
      setSnapshotSlotsEnabled: (snapshotSlotsEnabled) => {
        set({ snapshotSlotsEnabled })
      },

      captureSnapshotSlot: (slotIndex) => {
        const state = get()
        const params = state.solverResult.cameraParameters
        const hfovDeg = params ? (params.horizontalFieldOfView * 180) / Math.PI : null

        const cameraData = state.calibrationSettingsBase.cameraData
        let sensorWidth = cameraData.customSensorWidth
        let sensorHeight = cameraData.customSensorHeight
        if (cameraData.presetId && cameraPresets[cameraData.presetId]) {
          sensorWidth = cameraPresets[cameraData.presetId].sensorWidth
          sensorHeight = cameraPresets[cameraData.presetId].sensorHeight
        }
        const focalMm = params
          ? sensorWidth >= sensorHeight
            ? 0.5 * sensorWidth * params.relativeFocalLength
            : 0.5 * sensorHeight * params.relativeFocalLength
          : null

        const rmsDeg =
          state.solverResult.vpResiduals && state.solverResult.vpResiduals.length > 0
            ? state.solverResult.vpResiduals.reduce((a, r) => a + r.rmsAngleDeg, 0) /
              state.solverResult.vpResiduals.length
            : null

        const slotLetters = ['A', 'B', 'C', 'D']
        const snapshot: CalibrationSnapshot = {
          slotIndex,
          label: `Slot ${slotLetters[slotIndex]}`,
          hfovDeg,
          focalMm,
          rmsDeg,
          globalSettings: structuredClone(state.globalSettings),
          calibrationSettingsBase: structuredClone(state.calibrationSettingsBase),
          calibrationSettings1VP: structuredClone(state.calibrationSettings1VP),
          calibrationSettings2VP: structuredClone(state.calibrationSettings2VP),
          controlPointsStateBase: structuredClone(state.controlPointsStateBase),
          controlPointsState1VP: structuredClone(state.controlPointsState1VP),
          controlPointsState2VP: structuredClone(state.controlPointsState2VP),
          multiLineSolverEnabled: state.multiLineSolverEnabled,
          lensDistortionEnabled: state.lensDistortionEnabled,
          lensK1: state.lensK1,
          lensK2: state.lensK2
        }

        const nextSnapshots = [...state.snapshots] as [
          CalibrationSnapshot | null,
          CalibrationSnapshot | null,
          CalibrationSnapshot | null,
          CalibrationSnapshot | null
        ]
        nextSnapshots[slotIndex] = snapshot
        set({
          snapshots: nextSnapshots,
          activeSnapshotSlot: slotIndex,
          toastMessage: `Captured calibration to ${snapshot.label}`
        })
      },

      restoreSnapshotSlot: (slotIndex) => {
        const state = get()
        const snap = state.snapshots[slotIndex]
        if (!snap) return

        const nextState = {
          globalSettings: structuredClone(snap.globalSettings),
          calibrationSettingsBase: structuredClone(snap.calibrationSettingsBase),
          calibrationSettings1VP: structuredClone(snap.calibrationSettings1VP),
          calibrationSettings2VP: structuredClone(snap.calibrationSettings2VP),
          controlPointsStateBase: structuredClone(snap.controlPointsStateBase),
          controlPointsState1VP: structuredClone(snap.controlPointsState1VP),
          controlPointsState2VP: structuredClone(snap.controlPointsState2VP),
          multiLineSolverEnabled: snap.multiLineSolverEnabled,
          lensDistortionEnabled: snap.lensDistortionEnabled,
          lensK1: snap.lensK1,
          lensK2: snap.lensK2
        }
        set({
          ...nextState,
          activeSnapshotSlot: slotIndex,
          solverResult: computeSolverResult({
            ...nextState,
            image: state.image
          }),
          toastMessage: `Restored ${snap.label}`
        })
      },

      clearSnapshotSlot: (slotIndex) => {
        const state = get()
        const nextSnapshots = [...state.snapshots] as [
          CalibrationSnapshot | null,
          CalibrationSnapshot | null,
          CalibrationSnapshot | null,
          CalibrationSnapshot | null
        ]
        nextSnapshots[slotIndex] = null
        set({
          snapshots: nextSnapshots,
          activeSnapshotSlot:
            state.activeSnapshotSlot === slotIndex ? null : state.activeSnapshotSlot
        })
      },

      setAutoSaveEnabled: (autoSaveEnabled) => {
        setAutoSaveOptInPreference(autoSaveEnabled)
        if (!autoSaveEnabled) {
          void clearWorkspaceIndexedDB()
        }
        set({
          autoSaveEnabled,
          toastMessage: autoSaveEnabled
            ? 'Opt-in browser auto-save enabled (IndexedDB)'
            : 'Cleared local browser auto-save'
        })
      },

      setFirstVanishingPointAxis: (firstVanishingPointAxis) => {
        const state = get()
        const calibrationSettingsBase = {
          ...state.calibrationSettingsBase,
          firstVanishingPointAxis
        }
        set({
          calibrationSettingsBase,
          uiState: { ...state.uiState, projectHasUnsavedChanges: true },
          solverResult: computeSolverResult({ ...state, calibrationSettingsBase })
        })
      },

      setSecondVanishingPointAxis: (secondVanishingPointAxis) => {
        const state = get()
        const calibrationSettingsBase = {
          ...state.calibrationSettingsBase,
          secondVanishingPointAxis
        }
        set({
          calibrationSettingsBase,
          uiState: { ...state.uiState, projectHasUnsavedChanges: true },
          solverResult: computeSolverResult({ ...state, calibrationSettingsBase })
        })
      },

      setReferenceDistanceAxis: (referenceDistanceAxis) => {
        const state = get()
        const calibrationSettingsBase = {
          ...state.calibrationSettingsBase,
          referenceDistanceAxis
        }
        set({
          calibrationSettingsBase,
          uiState: { ...state.uiState, projectHasUnsavedChanges: true },
          solverResult: computeSolverResult({ ...state, calibrationSettingsBase })
        })
      },

      setReferenceDistance: (referenceDistance) => {
        const state = get()
        const calibrationSettingsBase = {
          ...state.calibrationSettingsBase,
          referenceDistance
        }
        set({
          calibrationSettingsBase,
          uiState: { ...state.uiState, projectHasUnsavedChanges: true },
          solverResult: computeSolverResult({ ...state, calibrationSettingsBase })
        })
      },

      setReferenceDistanceUnit: (referenceDistanceUnit) => {
        const state = get()
        const calibrationSettingsBase = {
          ...state.calibrationSettingsBase,
          referenceDistanceUnit
        }
        set({
          calibrationSettingsBase,
          uiState: { ...state.uiState, projectHasUnsavedChanges: true },
          solverResult: computeSolverResult({ ...state, calibrationSettingsBase })
        })
      },

      setCameraPreset: (presetId) => {
        const state = get()
        const presetData = presetId ? cameraPresets[presetId] ?? null : null
        const calibrationSettingsBase: CalibrationSettingsBase = {
          ...state.calibrationSettingsBase,
          cameraData: {
            ...state.calibrationSettingsBase.cameraData,
            presetId,
            presetData,
            customSensorWidth: presetData
              ? presetData.sensorWidth
              : state.calibrationSettingsBase.cameraData.customSensorWidth,
            customSensorHeight: presetData
              ? presetData.sensorHeight
              : state.calibrationSettingsBase.cameraData.customSensorHeight
          }
        }
        const calibrationSettings1VP = { ...state.calibrationSettings1VP }
        if (presetData?.focalLength !== undefined) {
          calibrationSettings1VP.absoluteFocalLength = presetData.focalLength
        }
        set({
          calibrationSettingsBase,
          calibrationSettings1VP,
          uiState: { ...state.uiState, projectHasUnsavedChanges: true },
          solverResult: computeSolverResult({
            ...state,
            calibrationSettingsBase,
            calibrationSettings1VP
          })
        })
      },

      setCustomSensorSize: (width, height) => {
        const state = get()
        const calibrationSettingsBase: CalibrationSettingsBase = {
          ...state.calibrationSettingsBase,
          cameraData: {
            ...state.calibrationSettingsBase.cameraData,
            customSensorWidth:
              width !== undefined ? width : state.calibrationSettingsBase.cameraData.customSensorWidth,
            customSensorHeight:
              height !== undefined ? height : state.calibrationSettingsBase.cameraData.customSensorHeight
          }
        }
        set({
          calibrationSettingsBase,
          uiState: { ...state.uiState, projectHasUnsavedChanges: true },
          solverResult: computeSolverResult({ ...state, calibrationSettingsBase })
        })
      },

      setPrincipalPointMode1VP: (principalPointMode) => {
        const state = get()
        const calibrationSettings1VP = { ...state.calibrationSettings1VP, principalPointMode }
        set({
          calibrationSettings1VP,
          uiState: { ...state.uiState, projectHasUnsavedChanges: true },
          solverResult: computeSolverResult({ ...state, calibrationSettings1VP })
        })
      },

      setAbsoluteFocalLength1VP: (absoluteFocalLength) => {
        const state = get()
        if (isNaN(absoluteFocalLength) || absoluteFocalLength <= 0) return
        const calibrationSettings1VP = { ...state.calibrationSettings1VP, absoluteFocalLength }
        set({
          calibrationSettings1VP,
          uiState: { ...state.uiState, projectHasUnsavedChanges: true },
          solverResult: computeSolverResult({ ...state, calibrationSettings1VP })
        })
      },

      setPrincipalPointMode2VP: (principalPointMode) => {
        const state = get()
        const calibrationSettings2VP = { ...state.calibrationSettings2VP, principalPointMode }
        set({
          calibrationSettings2VP,
          uiState: { ...state.uiState, projectHasUnsavedChanges: true },
          solverResult: computeSolverResult({ ...state, calibrationSettings2VP })
        })
      },

      setQuadModeEnabled: (quadModeEnabled) => {
        const state = get()
        const calibrationSettings2VP = { ...state.calibrationSettings2VP, quadModeEnabled }
        set({
          calibrationSettings2VP,
          uiState: { ...state.uiState, projectHasUnsavedChanges: true },
          solverResult: computeSolverResult({ ...state, calibrationSettings2VP })
        })
      },

      setOriginPosition: (origin) => {
        const state = get()
        const controlPointsStateBase = { ...state.controlPointsStateBase, origin }
        set({
          controlPointsStateBase,
          uiState: { ...state.uiState, projectHasUnsavedChanges: true },
          solverResult: computeSolverResult({ ...state, controlPointsStateBase })
        })
      },

      setPrincipalPointPosition: (principalPoint) => {
        const state = get()
        const controlPointsStateBase = { ...state.controlPointsStateBase, principalPoint }
        set({
          controlPointsStateBase,
          uiState: { ...state.uiState, projectHasUnsavedChanges: true },
          solverResult: computeSolverResult({ ...state, controlPointsStateBase })
        })
      },

      setReferenceDistanceAnchor: (referenceDistanceAnchor) => {
        const state = get()
        const controlPointsStateBase = { ...state.controlPointsStateBase, referenceDistanceAnchor }
        set({
          controlPointsStateBase,
          uiState: { ...state.uiState, projectHasUnsavedChanges: true },
          solverResult: computeSolverResult({ ...state, controlPointsStateBase })
        })
      },

      setReferenceDistanceHandleOffset: (handleIndex, offset) => {
        const state = get()
        const offsets: [number, number] = [
          state.controlPointsStateBase.referenceDistanceHandleOffsets[0],
          state.controlPointsStateBase.referenceDistanceHandleOffsets[1]
        ]
        offsets[handleIndex] = offset
        const controlPointsStateBase = {
          ...state.controlPointsStateBase,
          referenceDistanceHandleOffsets: offsets
        }
        set({
          controlPointsStateBase,
          uiState: { ...state.uiState, projectHasUnsavedChanges: true },
          solverResult: computeSolverResult({ ...state, controlPointsStateBase })
        })
      },

      setHorizonControlPointPosition: (pointIndex, pos) => {
        const state = get()
        const horizon: ControlPointPairState = [
          { ...state.controlPointsState1VP.horizon[0] },
          { ...state.controlPointsState1VP.horizon[1] }
        ]
        horizon[pointIndex] = { x: pos.x, y: pos.y }
        const controlPointsState1VP = { ...state.controlPointsState1VP, horizon }
        set({
          controlPointsState1VP,
          uiState: { ...state.uiState, projectHasUnsavedChanges: true },
          solverResult: computeSolverResult({ ...state, controlPointsState1VP })
        })
      },

      setFirstVPControlPoint: (lineSegmentIndex, pointIndex, pos) => {
        const state = get()
        const controlPointsStateBase: ControlPointsStateBase = {
          ...state.controlPointsStateBase,
          firstVanishingPoint: {
            lineSegments: updateLineSegmentPoint(
              state.controlPointsStateBase.firstVanishingPoint.lineSegments,
              lineSegmentIndex,
              pointIndex,
              pos
            )
          }
        }
        set({
          controlPointsStateBase,
          uiState: { ...state.uiState, projectHasUnsavedChanges: true },
          solverResult: computeSolverResult({ ...state, controlPointsStateBase })
        })
      },

      setSecondVPControlPoint: (lineSegmentIndex, pointIndex, pos) => {
        const state = get()
        const controlPointsState2VP: ControlPointsState2VP = {
          ...state.controlPointsState2VP,
          secondVanishingPoint: {
            lineSegments: updateLineSegmentPoint(
              state.controlPointsState2VP.secondVanishingPoint.lineSegments,
              lineSegmentIndex,
              pointIndex,
              pos
            )
          }
        }
        set({
          controlPointsState2VP,
          uiState: { ...state.uiState, projectHasUnsavedChanges: true },
          solverResult: computeSolverResult({ ...state, controlPointsState2VP })
        })
      },

      setThirdVPControlPoint: (lineSegmentIndex, pointIndex, pos) => {
        const state = get()
        const controlPointsState2VP: ControlPointsState2VP = {
          ...state.controlPointsState2VP,
          thirdVanishingPoint: {
            lineSegments: updateLineSegmentPoint(
              state.controlPointsState2VP.thirdVanishingPoint.lineSegments,
              lineSegmentIndex,
              pointIndex,
              pos
            )
          }
        }
        set({
          controlPointsState2VP,
          uiState: { ...state.uiState, projectHasUnsavedChanges: true },
          solverResult: computeSolverResult({ ...state, controlPointsState2VP })
        })
      },

      resetControlPoints: () => {
        const state = get()
        const controlPointsStateBase = { ...defaultControlPointsStateBase }
        const controlPointsState1VP = { ...defaultControlPointsState1VP }
        const controlPointsState2VP = { ...defaultControlPointsState2VP }
        set({
          controlPointsStateBase,
          controlPointsState1VP,
          controlPointsState2VP,
          uiState: { ...state.uiState, projectHasUnsavedChanges: true },
          solverResult: computeSolverResult({
            ...state,
            controlPointsStateBase,
            controlPointsState1VP,
            controlPointsState2VP
          })
        })
      },

      setFieldOfViewFormat: (fieldOfViewFormat) => {
        set({
          resultDisplaySettings: { ...get().resultDisplaySettings, fieldOfViewFormat }
        })
      },

      setOrientationFormat: (orientationFormat) => {
        set({
          resultDisplaySettings: { ...get().resultDisplaySettings, orientationFormat }
        })
      },

      setPrincipalPointFormat: (principalPointFormat) => {
        set({
          resultDisplaySettings: { ...get().resultDisplaySettings, principalPointFormat }
        })
      },

      setDisplayAbsoluteFocalLength: (displayAbsoluteFocalLength) => {
        set({
          resultDisplaySettings: { ...get().resultDisplaySettings, displayAbsoluteFocalLength }
        })
      },

      setViewport: (partial) => {
        set({
          viewport: { ...get().viewport, ...partial }
        })
      },

      resetViewport: () => {
        set({
          viewport: { zoom: 1, panX: 0, panY: 0 }
        })
      },

      showToast: (toastMessage) => {
        set({ toastMessage })
      },

      setActiveModal: (activeModal) => {
        set({ activeModal })
      },

      markProjectSaved: (projectName) => {
        const state = get()
        set({
          uiState: {
            ...state.uiState,
            projectName: projectName ?? state.uiState.projectName,
            projectHasUnsavedChanges: false
          }
        })
      },

      setSceneBlockout: (partial) => {
        const prev = get().sceneBlockout
        const next = { ...prev, ...partial }
        // If disabling sceneBlockout, also exit freeOrbitMode and interactiveDrawMode
        if (partial.enabled === false) {
          next.freeOrbitMode = false
          next.interactiveDrawMode = false
        }
        set({ sceneBlockout: next })
      },

      addBlockoutVolume: (partial) => {
        const prev = get().sceneBlockout
        const nextIndex = prev.volumes.length + 1
        const newVol: BlockoutVolume = {
          id: `vol-${Date.now()}-${nextIndex}`,
          name: partial?.name ?? `Blockout Box ${nextIndex}`,
          widthX: partial?.widthX ?? 1.0,
          depthY: partial?.depthY ?? 1.0,
          heightZ: partial?.heightZ ?? 1.2,
          offsetX: partial?.offsetX ?? 0.5,
          offsetY: partial?.offsetY ?? 0.5,
          offsetZ: partial?.offsetZ ?? 0,
          rotationZ: partial?.rotationZ ?? 0
        }
        set({
          sceneBlockout: {
            ...prev,
            volumes: [...prev.volumes, newVol],
            selectedVolumeId: newVol.id
          }
        })
      },

      updateBlockoutVolume: (id, partial) => {
        const prev = get().sceneBlockout
        set({
          sceneBlockout: {
            ...prev,
            volumes: prev.volumes.map((v) =>
              v.id === id ? { ...v, ...partial } : v
            )
          }
        })
      },

      removeBlockoutVolume: (id) => {
        const prev = get().sceneBlockout
        const filtered = prev.volumes.filter((v) => v.id !== id)
        set({
          sceneBlockout: {
            ...prev,
            volumes: filtered,
            selectedVolumeId:
              prev.selectedVolumeId === id
                ? (filtered[0]?.id ?? null)
                : prev.selectedVolumeId
          }
        })
      },

      addBillboardCutout: () => {
        const state = get()
        const prev = state.sceneBlockout
        const nextIndex = prev.billboards.length + 1
        const newBb = createDefaultBillboardCutout(
          `cutout-${Date.now()}-${nextIndex}`,
          `Cutout Standee ${nextIndex}`
        )
        if (state.solverResult.cameraParameters && newBb.autoFitFromPolygon) {
          const fitted = fitBillboard3DFromPolygon(
            newBb.polygonRel,
            newBb.baseZ,
            state.solverResult.cameraParameters
          )
          if (fitted) {
            newBb.baseX = fitted.baseX
            newBb.baseY = fitted.baseY
            newBb.width = fitted.width
            newBb.height = fitted.height
          }
        }
        set({
          sceneBlockout: {
            ...prev,
            billboardsEnabled: true,
            billboards: [...prev.billboards, newBb],
            selectedBillboardId: newBb.id
          }
        })
      },

      updateBillboardCutout: (id, partial) => {
        const state = get()
        const prev = state.sceneBlockout
        set({
          sceneBlockout: {
            ...prev,
            billboards: prev.billboards.map((bb) => {
              if (bb.id !== id) return bb
              const updated = { ...bb, ...partial }
              if (
                partial.autoFitFromPolygon === true &&
                state.solverResult.cameraParameters
              ) {
                const fitted = fitBillboard3DFromPolygon(
                  updated.polygonRel,
                  updated.baseZ,
                  state.solverResult.cameraParameters
                )
                if (fitted) {
                  updated.baseX = fitted.baseX
                  updated.baseY = fitted.baseY
                  updated.width = fitted.width
                  updated.height = fitted.height
                }
              }
              return updated
            })
          }
        })
      },

      removeBillboardCutout: (id) => {
        const prev = get().sceneBlockout
        const filtered = prev.billboards.filter((bb) => bb.id !== id)
        set({
          sceneBlockout: {
            ...prev,
            billboards: filtered,
            selectedBillboardId:
              prev.selectedBillboardId === id
                ? (filtered[0]?.id ?? null)
                : prev.selectedBillboardId
          }
        })
      },

      setBillboardPolygonVertex: (id, vertexIndex, pos) => {
        const state = get()
        const prev = state.sceneBlockout
        set({
          sceneBlockout: {
            ...prev,
            billboards: prev.billboards.map((bb) => {
              if (bb.id !== id) return bb
              const nextPoly = bb.polygonRel.map((pt, idx) =>
                idx === vertexIndex
                  ? {
                      x: Math.max(0.01, Math.min(0.99, pos.x)),
                      y: Math.max(0.01, Math.min(0.99, pos.y))
                    }
                  : pt
              )
              const updated: BillboardCutout = {
                ...bb,
                polygonRel: nextPoly
              }
              if (
                updated.autoFitFromPolygon &&
                state.solverResult.cameraParameters
              ) {
                const fitted = fitBillboard3DFromPolygon(
                  nextPoly,
                  updated.baseZ,
                  state.solverResult.cameraParameters
                )
                if (fitted) {
                  updated.baseX = fitted.baseX
                  updated.baseY = fitted.baseY
                  updated.width = fitted.width
                  updated.height = fitted.height
                }
              }
              return updated
            })
          }
        })
      },

      addBillboardPolygonVertex: (id) => {
        const prev = get().sceneBlockout
        set({
          sceneBlockout: {
            ...prev,
            billboards: prev.billboards.map((bb) => {
              if (bb.id !== id || bb.polygonRel.length >= 12) return bb
              const n = bb.polygonRel.length
              const last = bb.polygonRel[n - 1]
              const first = bb.polygonRel[0]
              const mid = {
                x: 0.5 * (last.x + first.x),
                y: 0.5 * (last.y + first.y)
              }
              return {
                ...bb,
                polygonRel: [...bb.polygonRel, mid]
              }
            })
          }
        })
      },

      removeBillboardPolygonVertex: (id) => {
        const prev = get().sceneBlockout
        set({
          sceneBlockout: {
            ...prev,
            billboards: prev.billboards.map((bb) => {
              if (bb.id !== id || bb.polygonRel.length <= 4) return bb
              return {
                ...bb,
                polygonRel: bb.polygonRel.slice(0, -1)
              }
            })
          }
        })
      },

      // Option 1 (Optional): 2-Click 3D Swept Rail & Pipe Actions
      addSweptWallRail: () => {
        const prev = get().sceneBlockout
        const nextIndex = prev.sweptRails.length + 1
        const newRail = createDefaultSweptWallRail(
          `rail-${Date.now()}-${nextIndex}`,
          `Hallway Handrail ${nextIndex}`
        )
        set({
          sceneBlockout: {
            ...prev,
            sweptRailsEnabled: true,
            sweptRails: [...prev.sweptRails, newRail],
            selectedSweptRailId: newRail.id
          }
        })
      },

      updateSweptWallRail: (id, partial) => {
        const prev = get().sceneBlockout
        set({
          sceneBlockout: {
            ...prev,
            sweptRails: prev.sweptRails.map((r) =>
              r.id === id ? { ...r, ...partial } : r
            )
          }
        })
      },

      removeSweptWallRail: (id) => {
        const prev = get().sceneBlockout
        const filtered = prev.sweptRails.filter((r) => r.id !== id)
        set({
          sceneBlockout: {
            ...prev,
            sweptRails: filtered,
            selectedSweptRailId:
              prev.selectedSweptRailId === id
                ? (filtered[0]?.id ?? null)
                : prev.selectedSweptRailId
          }
        })
      },

      addSweptRailWaypoint: (id) => {
        const prev = get().sceneBlockout
        set({
          sceneBlockout: {
            ...prev,
            sweptRails: prev.sweptRails.map((r) => {
              if (r.id !== id) return r
              const existing = r.waypointsRel ?? []
              if (existing.length >= 6) return r
              const lastPt =
                existing.length > 0
                  ? existing[existing.length - 1]
                  : r.p1Rel
              const midPt: Point2D = {
                x: Number((0.5 * (lastPt.x + r.p2Rel.x)).toFixed(3)),
                y: Number((0.5 * (lastPt.y + r.p2Rel.y)).toFixed(3))
              }
              return {
                ...r,
                waypointsRel: [...existing, midPt]
              }
            })
          }
        })
      },

      removeSweptRailWaypoint: (id) => {
        const prev = get().sceneBlockout
        set({
          sceneBlockout: {
            ...prev,
            sweptRails: prev.sweptRails.map((r) => {
              if (r.id !== id) return r
              const existing = r.waypointsRel ?? []
              if (existing.length === 0) return r
              return {
                ...r,
                waypointsRel: existing.slice(0, -1)
              }
            })
          }
        })
      },

      setSweptRailWaypoint: (id, waypointIndex, pos) => {
        const prev = get().sceneBlockout
        set({
          sceneBlockout: {
            ...prev,
            sweptRails: prev.sweptRails.map((r) => {
              if (r.id !== id) return r
              const existing = [...(r.waypointsRel ?? [])]
              if (waypointIndex < 0 || waypointIndex >= existing.length) return r
              existing[waypointIndex] = {
                x: Math.max(0.01, Math.min(0.99, pos.x)),
                y: Math.max(0.01, Math.min(0.99, pos.y))
              }
              return {
                ...r,
                waypointsRel: existing
              }
            })
          }
        })
      },

      // Option 2 (Optional): Wall-Parallel Offset Cutout Layer Actions
      addWallParallelCutout: () => {
        const prev = get().sceneBlockout
        const nextIndex = prev.wallCutouts.length + 1
        const newCutout = createDefaultWallParallelCutout(
          `wall-cutout-${Date.now()}-${nextIndex}`,
          `Ornate Railing / Cutout ${nextIndex}`
        )
        set({
          sceneBlockout: {
            ...prev,
            wallCutoutsEnabled: true,
            wallCutouts: [...prev.wallCutouts, newCutout],
            selectedWallCutoutId: newCutout.id
          }
        })
      },

      updateWallParallelCutout: (id, partial) => {
        const prev = get().sceneBlockout
        set({
          sceneBlockout: {
            ...prev,
            wallCutouts: prev.wallCutouts.map((wc) =>
              wc.id === id ? { ...wc, ...partial } : wc
            )
          }
        })
      },

      removeWallParallelCutout: (id) => {
        const prev = get().sceneBlockout
        const filtered = prev.wallCutouts.filter((wc) => wc.id !== id)
        set({
          sceneBlockout: {
            ...prev,
            wallCutouts: filtered,
            selectedWallCutoutId:
              prev.selectedWallCutoutId === id
                ? (filtered[0]?.id ?? null)
                : prev.selectedWallCutoutId
          }
        })
      },

      setWallCutoutCorner: (id, cornerIndex, pos) => {
        const prev = get().sceneBlockout
        set({
          sceneBlockout: {
            ...prev,
            wallCutouts: prev.wallCutouts.map((wc) => {
              if (wc.id !== id) return wc
              const nextQuad: [Point2D, Point2D, Point2D, Point2D] = [
                { ...wc.quadRel[0] },
                { ...wc.quadRel[1] },
                { ...wc.quadRel[2] },
                { ...wc.quadRel[3] }
              ]
              nextQuad[cornerIndex] = {
                x: Math.max(0.01, Math.min(0.99, pos.x)),
                y: Math.max(0.01, Math.min(0.99, pos.y))
              }
              return { ...wc, quadRel: nextQuad }
            })
          }
        })
      },

      // Option 3 (Optional): Wall Relief & Recessed Alcove Extruder Actions
      addWallReliefExtrusion: () => {
        const prev = get().sceneBlockout
        const nextIndex = prev.wallReliefs.length + 1
        const newRelief = createDefaultWallReliefExtrusion(
          `relief-${Date.now()}-${nextIndex}`,
          `Wall Relief / Alcove ${nextIndex}`
        )
        set({
          sceneBlockout: {
            ...prev,
            wallReliefsEnabled: true,
            wallReliefs: [...prev.wallReliefs, newRelief],
            selectedWallReliefId: newRelief.id
          }
        })
      },

      updateWallReliefExtrusion: (id, partial) => {
        const prev = get().sceneBlockout
        set({
          sceneBlockout: {
            ...prev,
            wallReliefs: prev.wallReliefs.map((rel) =>
              rel.id === id ? { ...rel, ...partial } : rel
            )
          }
        })
      },

      removeWallReliefExtrusion: (id) => {
        const prev = get().sceneBlockout
        const filtered = prev.wallReliefs.filter((rel) => rel.id !== id)
        set({
          sceneBlockout: {
            ...prev,
            wallReliefs: filtered,
            selectedWallReliefId:
              prev.selectedWallReliefId === id
                ? (filtered[0]?.id ?? null)
                : prev.selectedWallReliefId
          }
        })
      },

      setWallReliefCorner: (id, cornerIndex, pos) => {
        const prev = get().sceneBlockout
        set({
          sceneBlockout: {
            ...prev,
            wallReliefs: prev.wallReliefs.map((rel) => {
              if (rel.id !== id) return rel
              const nextQuad: [Point2D, Point2D, Point2D, Point2D] = [
                { ...rel.quadRel[0] },
                { ...rel.quadRel[1] },
                { ...rel.quadRel[2] },
                { ...rel.quadRel[3] }
              ]
              nextQuad[cornerIndex] = {
                x: Math.max(0.01, Math.min(0.99, pos.x)),
                y: Math.max(0.01, Math.min(0.99, pos.y))
              }
              return { ...rel, quadRel: nextQuad }
            })
          }
        })
      },

      // Option 4 (Optional): "3-Sweep" Cylinder & Pillar Snapper Actions
      addSweptCylinderColumn: () => {
        const prev = get().sceneBlockout
        const nextIndex = prev.sweptColumns.length + 1
        const newCol = createDefaultSweptCylinderColumn(
          `column-${Date.now()}-${nextIndex}`,
          `Vertical Pillar ${nextIndex}`
        )
        set({
          sceneBlockout: {
            ...prev,
            sweptColumnsEnabled: true,
            sweptColumns: [...prev.sweptColumns, newCol],
            selectedSweptColumnId: newCol.id
          }
        })
      },

      updateSweptCylinderColumn: (id, partial) => {
        const prev = get().sceneBlockout
        set({
          sceneBlockout: {
            ...prev,
            sweptColumns: prev.sweptColumns.map((col) =>
              col.id === id ? { ...col, ...partial } : col
            )
          }
        })
      },

      removeSweptCylinderColumn: (id) => {
        const prev = get().sceneBlockout
        const filtered = prev.sweptColumns.filter((col) => col.id !== id)
        set({
          sceneBlockout: {
            ...prev,
            sweptColumns: filtered,
            selectedSweptColumnId:
              prev.selectedSweptColumnId === id
                ? (filtered[0]?.id ?? null)
                : prev.selectedSweptColumnId
          }
        })
      },

      // Option 5 (Optional): Parametric 3D Staircase & Sloped Ramp Actions
      addStaircaseExtrusion: () => {
        const prev = get().sceneBlockout
        const nextIndex = prev.staircases.length + 1
        const newStairs = createDefaultStaircaseExtrusion(
          `stairs-${Date.now()}-${nextIndex}`,
          `Hallway Staircase ${nextIndex}`
        )
        set({
          sceneBlockout: {
            ...prev,
            staircasesEnabled: true,
            staircases: [...prev.staircases, newStairs],
            selectedStaircaseId: newStairs.id
          }
        })
      },

      updateStaircaseExtrusion: (id, partial) => {
        const prev = get().sceneBlockout
        set({
          sceneBlockout: {
            ...prev,
            staircases: prev.staircases.map((st) =>
              st.id === id ? { ...st, ...partial } : st
            )
          }
        })
      },

      removeStaircaseExtrusion: (id) => {
        const prev = get().sceneBlockout
        const filtered = prev.staircases.filter((st) => st.id !== id)
        set({
          sceneBlockout: {
            ...prev,
            staircases: filtered,
            selectedStaircaseId:
              prev.selectedStaircaseId === id
                ? (filtered[0]?.id ?? null)
                : prev.selectedStaircaseId
          }
        })
      },

      // Option 6 (Optional): Arbitrary N-Point 3D Floor Polygon Prism Actions
      addFloorPolygonPrism: () => {
        const prev = get().sceneBlockout
        const nextIndex = prev.floorPrisms.length + 1
        const newPrism = createDefaultFloorPolygonPrism(
          `prism-${Date.now()}-${nextIndex}`,
          `Floor Polygon Prism ${nextIndex}`
        )
        set({
          sceneBlockout: {
            ...prev,
            floorPrismsEnabled: true,
            floorPrisms: [...prev.floorPrisms, newPrism],
            selectedFloorPrismId: newPrism.id
          }
        })
      },

      updateFloorPolygonPrism: (id, partial) => {
        const prev = get().sceneBlockout
        set({
          sceneBlockout: {
            ...prev,
            floorPrisms: prev.floorPrisms.map((p) =>
              p.id === id ? { ...p, ...partial } : p
            )
          }
        })
      },

      removeFloorPolygonPrism: (id) => {
        const prev = get().sceneBlockout
        const filtered = prev.floorPrisms.filter((p) => p.id !== id)
        set({
          sceneBlockout: {
            ...prev,
            floorPrisms: filtered,
            selectedFloorPrismId:
              prev.selectedFloorPrismId === id
                ? (filtered[0]?.id ?? null)
                : prev.selectedFloorPrismId
          }
        })
      },

      setFloorPrismVertex: (id, vertexIndex, pos) => {
        const prev = get().sceneBlockout
        set({
          sceneBlockout: {
            ...prev,
            floorPrisms: prev.floorPrisms.map((p) => {
              if (p.id !== id) return p
              const nextPoly = p.polygonRel.map((pt, idx) =>
                idx === vertexIndex
                  ? {
                      x: Math.max(0.01, Math.min(0.99, pos.x)),
                      y: Math.max(0.01, Math.min(0.99, pos.y))
                    }
                  : pt
              )
              return { ...p, polygonRel: nextPoly }
            })
          }
        })
      },

      addFloorPrismVertex: (id) => {
        const prev = get().sceneBlockout
        set({
          sceneBlockout: {
            ...prev,
            floorPrisms: prev.floorPrisms.map((p) => {
              if (p.id !== id || p.polygonRel.length >= 12) return p
              const n = p.polygonRel.length
              const last = p.polygonRel[n - 1]
              const first = p.polygonRel[0]
              return {
                ...p,
                polygonRel: [
                  ...p.polygonRel,
                  {
                    x: 0.5 * (last.x + first.x),
                    y: 0.5 * (last.y + first.y)
                  }
                ]
              }
            })
          }
        })
      },

      removeFloorPrismVertex: (id) => {
        const prev = get().sceneBlockout
        set({
          sceneBlockout: {
            ...prev,
            floorPrisms: prev.floorPrisms.map((p) => {
              if (p.id !== id || p.polygonRel.length <= 3) return p
              return {
                ...p,
                polygonRel: p.polygonRel.slice(0, -1)
              }
            })
          }
        })
      },

      // Option 7 (Optional): Axis-Symmetric 3D Revolved Lathe Object Actions
      addRevolvedLatheObject: () => {
        const prev = get().sceneBlockout
        const nextIndex = prev.latheObjects.length + 1
        const newLathe = createDefaultRevolvedLatheObject(
          `lathe-${Date.now()}-${nextIndex}`,
          `Revolved Lathe ${nextIndex}`
        )
        set({
          sceneBlockout: {
            ...prev,
            latheObjectsEnabled: true,
            latheObjects: [...prev.latheObjects, newLathe],
            selectedLatheObjectId: newLathe.id
          }
        })
      },

      updateRevolvedLatheObject: (id, partial) => {
        const prev = get().sceneBlockout
        set({
          sceneBlockout: {
            ...prev,
            latheObjects: prev.latheObjects.map((l) =>
              l.id === id ? { ...l, ...partial } : l
            )
          }
        })
      },

      removeRevolvedLatheObject: (id) => {
        const prev = get().sceneBlockout
        const filtered = prev.latheObjects.filter((l) => l.id !== id)
        set({
          sceneBlockout: {
            ...prev,
            latheObjects: filtered,
            selectedLatheObjectId:
              prev.selectedLatheObjectId === id
                ? (filtered[0]?.id ?? null)
                : prev.selectedLatheObjectId
          }
        })
      },

      // Option 8 (Optional): Parametric 3D Coffered Ceiling Grid & Repeating Wall Panel Array Actions
      addCofferedPanelArray: () => {
        const prev = get().sceneBlockout
        const existing = prev.cofferedArrays ?? []
        const nextIndex = existing.length + 1
        const newArr = createDefaultCofferedPanelArray(
          `coffer-${Date.now()}-${nextIndex}`,
          `Coffered / Panel Grid ${nextIndex}`
        )
        set({
          sceneBlockout: {
            ...prev,
            cofferedArraysEnabled: true,
            cofferedArrays: [...existing, newArr],
            selectedCofferedArrayId: newArr.id
          }
        })
      },

      updateCofferedPanelArray: (id, partial) => {
        const prev = get().sceneBlockout
        set({
          sceneBlockout: {
            ...prev,
            cofferedArrays: (prev.cofferedArrays ?? []).map((arr) =>
              arr.id === id ? { ...arr, ...partial } : arr
            )
          }
        })
      },

      removeCofferedPanelArray: (id) => {
        const prev = get().sceneBlockout
        const filtered = (prev.cofferedArrays ?? []).filter((a) => a.id !== id)
        set({
          sceneBlockout: {
            ...prev,
            cofferedArrays: filtered,
            selectedCofferedArrayId:
              prev.selectedCofferedArrayId === id
                ? (filtered[0]?.id ?? null)
                : prev.selectedCofferedArrayId
          }
        })
      },

      setCofferedArrayCorner: (id, cornerIndex, pos) => {
        const prev = get().sceneBlockout
        set({
          sceneBlockout: {
            ...prev,
            cofferedArrays: (prev.cofferedArrays ?? []).map((arr) => {
              if (arr.id !== id) return arr
              const nextQuad: [Point2D, Point2D, Point2D, Point2D] = [
                { ...arr.quadRel[0] },
                { ...arr.quadRel[1] },
                { ...arr.quadRel[2] },
                { ...arr.quadRel[3] }
              ]
              nextQuad[cornerIndex] = {
                x: Math.max(0.01, Math.min(0.99, pos.x)),
                y: Math.max(0.01, Math.min(0.99, pos.y))
              }
              return { ...arr, quadRel: nextQuad }
            })
          }
        })
      },

      // Option 9 (Optional): 3-Point Curved Arc Wall & Bow-Window Bay Extruder Actions
      addCurvedArcWall: () => {
        const prev = get().sceneBlockout
        const existing = prev.curvedWalls ?? []
        const nextIndex = existing.length + 1
        const newCW = createDefaultCurvedArcWall(
          `arc-wall-${Date.now()}-${nextIndex}`,
          `Curved Arc Wall ${nextIndex}`
        )
        set({
          sceneBlockout: {
            ...prev,
            curvedWallsEnabled: true,
            curvedWalls: [...existing, newCW],
            selectedCurvedWallId: newCW.id
          }
        })
      },

      updateCurvedArcWall: (id, partial) => {
        const prev = get().sceneBlockout
        set({
          sceneBlockout: {
            ...prev,
            curvedWalls: (prev.curvedWalls ?? []).map((cw) =>
              cw.id === id ? { ...cw, ...partial } : cw
            )
          }
        })
      },

      removeCurvedArcWall: (id) => {
        const prev = get().sceneBlockout
        const filtered = (prev.curvedWalls ?? []).filter((cw) => cw.id !== id)
        set({
          sceneBlockout: {
            ...prev,
            curvedWalls: filtered,
            selectedCurvedWallId:
              prev.selectedCurvedWallId === id
                ? (filtered[0]?.id ?? null)
                : prev.selectedCurvedWallId
          }
        })
      },

      setTextureUnwarp: (partial) => {
        const prev = get().textureUnwarp
        set({
          textureUnwarp: { ...prev, ...partial }
        })
      },

      setTextureUnwarpCorner: (cornerIndex, pos) => {
        const prev = get().textureUnwarp
        const nextQuad: [Point2D, Point2D, Point2D, Point2D] = [
          { ...prev.quad[0] },
          { ...prev.quad[1] },
          { ...prev.quad[2] },
          { ...prev.quad[3] }
        ]
        nextQuad[cornerIndex] = { x: pos.x, y: pos.y }
        set({
          textureUnwarp: {
            ...prev,
            quad: nextQuad
          }
        })
      },

      setPBRMaterialConfig: (partial) => {
        const prev = get().pbrMaterialConfig
        set({
          pbrMaterialConfig: { ...prev, ...partial }
        })
      },

      setParallaxAnimator: (partial) => {
        const prev = get().parallaxAnimator
        const next = { ...prev, ...partial }
        // When Parallax Animator is enabled, automatically ensure 3D Scene Blockout & Photo Projection are active
        if (partial.enabled === true && !get().sceneBlockout.enabled) {
          set({
            parallaxAnimator: next,
            sceneBlockout: {
              ...get().sceneBlockout,
              enabled: true,
              projectPhotoTexture: true,
              freeOrbitMode: false
            }
          })
          return
        }
        set({ parallaxAnimator: next })
      },

      setActiveSidebarTab: (activeSidebarTab) => {
        set({
          activeSidebarTab,
          uiState: { ...get().uiState, sidePanelsAreVisible: true }
        })
      },

      setActiveSceneTool: (activeSceneTool) => {
        set({ activeSceneTool })
      },

      activateSceneToolAndEnable: (tool) => {
        const state = get()
        const sb = {
          ...state.sceneBlockout,
          enabled: true,
          freeOrbitMode: false,
          showViewportHandles: true
        }
        if (tool === 'billboards') sb.billboardsEnabled = true
        if (tool === 'rails') sb.sweptRailsEnabled = true
        if (tool === 'wall-cutouts') sb.wallCutoutsEnabled = true
        if (tool === 'reliefs') sb.wallReliefsEnabled = true
        if (tool === 'columns') sb.sweptColumnsEnabled = true
        if (tool === 'stairs') sb.staircasesEnabled = true
        if (tool === 'prisms') sb.floorPrismsEnabled = true
        if (tool === 'lathe') sb.latheObjectsEnabled = true
        if (tool === 'coffers') sb.cofferedArraysEnabled = true
        if (tool === 'curved-walls') sb.curvedWallsEnabled = true

        set({
          activeSidebarTab: 'scene',
          activeSceneTool: tool,
          sceneBlockout: sb,
          activeModal: null,
          uiState: { ...state.uiState, sidePanelsAreVisible: true }
        })
      }
    }),
    {
      partialize: (state) => ({
        globalSettings: state.globalSettings,
        calibrationSettingsBase: state.calibrationSettingsBase,
        calibrationSettings1VP: state.calibrationSettings1VP,
        calibrationSettings2VP: state.calibrationSettings2VP,
        controlPointsStateBase: state.controlPointsStateBase,
        controlPointsState1VP: state.controlPointsState1VP,
        controlPointsState2VP: state.controlPointsState2VP
      }),
      limit: 60
    }
  )
)

/**
 * Helper to export a ready-to-run Blender Python script (.py)
 * that creates a calibrated camera with exact sensor size, FOV, and transform.
 */
export function exportBlenderPythonScript(state: FSpyStoreState) {
  const params = state.solverResult.cameraParameters
  if (!params) return

  const m = params.cameraTransform.matrix
  const cameraData = state.calibrationSettingsBase.cameraData
  let sensorWidth = cameraData.customSensorWidth
  let sensorHeight = cameraData.customSensorHeight
  if (cameraData.presetId && cameraPresets[cameraData.presetId]) {
    sensorWidth = cameraPresets[cameraData.presetId].sensorWidth
    sensorHeight = cameraPresets[cameraData.presetId].sensorHeight
  }

  const projectName = state.uiState.projectName || 'fSpy_Camera'
  const safeName = projectName.replace(/[^a-zA-Z0-9_-]/g, '_')

  const pyScript = `# fSpy Studio - Calibrated Blender Camera Import Script
# Run inside Blender's Scripting workspace (Text Editor -> Run Script)
import bpy
import mathutils

scene = bpy.context.scene
scene.render.resolution_x = ${params.imageWidth}
scene.render.resolution_y = ${params.imageHeight}
scene.render.resolution_percentage = 100

cam_data = bpy.data.cameras.new(name="${safeName}")
cam_obj = bpy.data.objects.new(name="${safeName}", object_data=cam_data)
bpy.context.collection.objects.link(cam_obj)

# Set exact sensor dimensions & FOV from fSpy solver
cam_data.sensor_fit = 'HORIZONTAL'
cam_data.sensor_width = ${sensorWidth.toFixed(4)}
cam_data.sensor_height = ${sensorHeight.toFixed(4)}
cam_data.lens_unit = 'FOV'
cam_data.angle = ${params.horizontalFieldOfView.toFixed(8)}

# Principal point shift
cam_data.shift_x = ${(-0.5 * params.principalPoint.x).toFixed(8)}
cam_data.shift_y = ${(-0.5 * params.principalPoint.y).toFixed(8)}

# Apply 4x4 camera transformation matrix
matrix = mathutils.Matrix((
    (${m[0][0].toFixed(8)}, ${m[0][1].toFixed(8)}, ${m[0][2].toFixed(8)}, ${m[0][3].toFixed(8)}),
    (${m[1][0].toFixed(8)}, ${m[1][1].toFixed(8)}, ${m[1][2].toFixed(8)}, ${m[1][3].toFixed(8)}),
    (${m[2][0].toFixed(8)}, ${m[2][1].toFixed(8)}, ${m[2][2].toFixed(8)}, ${m[2][3].toFixed(8)}),
    (0.0, 0.0, 0.0, 1.0)
))
cam_obj.matrix_world = matrix
scene.camera = cam_obj
print("fSpy camera '${safeName}' created and set as active scene camera.")
`

  const blob = new Blob([pyScript], { type: 'text/x-python;charset=utf-8' })
  saveAs(blob, `${safeName}_blender.py`)
}
