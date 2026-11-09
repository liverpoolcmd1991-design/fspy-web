/**
 * fSpy Studio — 3D Scene Blockout, Camera-Projected Texture Mapping,
 * Perspective Homography Unwarping, and Binary .GLB Scene Exporter
 */

import { saveAs } from 'file-saver'
import * as THREE from 'three'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'
import CoordinatesUtil, { ImageCoordinateFrame } from './coordinates-util'
import MathUtil from './math-util'
import Point2D from './point-2d'
import { CameraParameters } from './solver-result'
import Vector3D from './vector-3d'

export type RoomShellType = 'none' | 'corner-stage' | 'interior-room'

export type RepeatAxis3D = 'x' | 'y' | 'z'

export interface BlockoutVolume {
  id: string
  name: string
  widthX: number
  depthY: number
  heightZ: number
  offsetX: number
  offsetY: number
  offsetZ: number
  rotationZ: number
  /** Upgrade #4: Clone Along Vanishing Line (1-Click Repeating Hallway Array) */
  repeatCount?: number
  repeatSpacing?: number
  repeatAxis?: RepeatAxis3D
}

export interface BillboardCutout {
  id: string
  name: string
  baseX: number
  baseY: number
  baseZ: number
  width: number
  height: number
  yawDeg: number
  faceCamera: boolean
  autoFitFromPolygon: boolean
  featherPx: number
  polygonRel: Point2D[]
}

export type HostWallType =
  | 'left-wall-yz'
  | 'right-wall-yz'
  | 'back-wall-xz'
  | 'floor-xy'
  | 'ceiling-xy'

export type SweptRailProfile = 'round-pipe' | 'square-bar' | 'molding-bevel'

export type SweptRailPathMode =
  | 'straight-or-elbows'
  | 'smooth-spline'
  | 'catenary-sag'

/**
 * Option 1 (Optional): 3D Swept Rail, Multi-Bend Pipe & Catenary Cable Tool
 * Best for: Hallway handrails, multi-bend conduits/pipes, curved moldings & hanging catenary cables.
 */
export interface SweptWallRail {
  id: string
  name: string
  hostWall: HostWallType
  p1Rel: Point2D
  p2Rel: Point2D
  /** Optional intermediate bend waypoints between p1Rel and p2Rel */
  waypointsRel?: Point2D[]
  pathMode?: SweptRailPathMode
  catenarySag?: number
  standOff: number
  radius: number
  profile: SweptRailProfile
  bracketCount: number
  /** Upgrade #4: Parallel multi-rail / multi-conduit repeat array */
  repeatCount?: number
  repeatSpacing?: number
}

export type WallCutoutAlphaMode =
  | 'dark-bars'
  | 'bright-bars'
  | 'edge-contrast'
  | 'full-strip'

/**
 * Option 2 (Optional): Wall-Parallel Offset Cutout Layer
 * Best for: Ornate wrought-iron railings, balusters, radiators & wall signage floating parallel to a wall.
 */
export interface WallParallelCutout {
  id: string
  name: string
  hostWall: HostWallType
  quadRel: [Point2D, Point2D, Point2D, Point2D]
  standOff: number
  alphaMode: WallCutoutAlphaMode
  threshold: number
  featherPx: number
}

export type WallReliefArchType =
  | 'rectangular'
  | 'roman-arch'
  | 'segmental-arch'
  | 'gothic-arch'

/**
 * Option 3 (Optional): Wall Relief, Arched Portal, Pass-Through Hole Cutter & Annex Corridor Extruder
 * Best for: Window sills (+Depth), recessed doorways/alcoves (-Depth), and open pass-through portals into adjacent rooms/corridors.
 */
export interface WallReliefExtrusion {
  id: string
  name: string
  hostWall: HostWallType
  quadRel: [Point2D, Point2D, Point2D, Point2D]
  extrudeDepth: number
  archType?: WallReliefArchType
  archRiseRatio?: number
  /** When true, punches a topological hole through the host Room Shell wall and extrudes a 3D annex corridor behind it */
  passThroughPortal?: boolean
  annexLength?: number
  annexWidthExpand?: number
  annexOpenEnd?: boolean
  /** Upgrade #4: Clone Along Vanishing Line (Repeating Hallway Doors / Windows / Arches) */
  repeatCount?: number
  repeatSpacing?: number
}

export type SweptColumnProfile =
  | 'round-column'
  | 'octagonal-pillar'
  | 'square-pillar'

/**
 * Option 4 (Optional): "3-Sweep" Cylinder & Pillar Snapper
 * Best for: Vertical columns, cylindrical pillars, bollards, lamp posts & vertical pipes.
 */
export interface SweptCylinderColumn {
  id: string
  name: string
  baseLeftRel: Point2D
  baseRightRel: Point2D
  topCenterRel: Point2D
  baseZ: number
  profile: SweptColumnProfile
  /** Upgrade #4: Clone Along Vanishing Line (Repeating Colonnade Pillars) */
  repeatCount?: number
  repeatSpacing?: number
  repeatAxis?: 'x' | 'y'
}

export type StaircaseMode =
  | 'stepped-stairs'
  | 'smooth-ramp'
  | 'l-landing-90'
  | 'u-switchback-180'
  | 'helical-spiral'

export type StairTurnDirection = 'left-ccw' | 'right-cw'

/**
 * Option 5 (Optional): Parametric 3D Staircase (Straight, L-Landing, U-Switchback, Helical) & Sloped Ramp Generator
 * Best for: Flights of stairs, L/U landings, spiral stairs, stoops & sloped wheelchair/loading ramps.
 */
export interface StaircaseExtrusion {
  id: string
  name: string
  mode: StaircaseMode
  stepCount: number
  widthX: number
  runDepthY: number
  totalHeightZ: number
  offsetX: number
  offsetY: number
  offsetZ: number
  yawDeg: number
  closedStringers: boolean
  turnDirection?: StairTurnDirection
  spiralArcDeg?: number
  innerRadius?: number
}

/**
 * Option 6 (Optional): Arbitrary N-Point 3D Floor Polygon Prism Extruder
 * Best for: L-shaped kitchen counters, angled bay windows, sidewalk curbs, polygonal stages & irregular buildings.
 */
export interface FloorPolygonPrism {
  id: string
  name: string
  polygonRel: Point2D[]
  baseZ: number
  heightZ: number
  bevelTop: number
}

export type LathePresetType =
  | 'classical-column'
  | 'pedestal-table'
  | 'vase-planter'
  | 'tapered-bollard'
  | 'custom-profile'

/**
 * Option 7 (Optional): Axis-Symmetric 3D Revolved "Lathe" Object
 * Best for: Classical columns with base/capital, pedestal café tables, vases/planters, bollards & streetlamps.
 */
export interface RevolvedLatheObject {
  id: string
  name: string
  preset: LathePresetType
  baseCenterRel: Point2D
  baseEdgeRel: Point2D
  topCenterRel: Point2D
  baseZ: number
  radialSegments: number
  /** 4 profile radius multipliers: [bottomFoot, lowerWaist, upperNeck, topCapital] */
  profileRadii: [number, number, number, number]
}

/**
 * Option 8 (Optional): Parametric 3D Coffered Ceiling Grid & Repeating Wall Panel / Wainscot Array
 * Best for: Coffered ceilings, skylight wells, recessed wood wainscot wall panels & repeating window bays.
 */
export interface CofferedPanelArray {
  id: string
  name: string
  hostWall: HostWallType
  quadRel: [Point2D, Point2D, Point2D, Point2D]
  rows: number
  cols: number
  stileWidthRatio: number
  recessDepth: number
  bevelMarginRatio: number
}

/**
 * Option 9 (Optional): 3-Point Curved Arc Wall & Bow-Window Bay Extruder
 * Best for: Curved rotunda walls, bow windows, semicircular apses & curved reception desks.
 */
export interface CurvedArcWall {
  id: string
  name: string
  startRel: Point2D
  apexRel: Point2D
  endRel: Point2D
  baseZ: number
  heightZ: number
  thickness: number
  segments: number
}

export type CeilingProfileType = 'flat' | 'barrel-vault' | 'pitched-gable'

export type BaseboardProfileType =
  | 'stepped-skirting'
  | 'beveled-plinth'
  | 'tall-wainscot'

export type CrownMoldingProfileType =
  | 'ogee-cornice'
  | 'stepped-coving'
  | 'led-cove-tray'

export interface SceneBlockoutConfig {
  enabled: boolean
  projectPhotoTexture: boolean
  freeOrbitMode: boolean
  wireframeOverlay: boolean
  showViewportHandles: boolean
  surfaceOpacity: number
  roomShellType: RoomShellType
  roomWidthX: number
  roomDepthY: number
  roomHeightZ: number
  roomOffsetX: number
  roomOffsetY: number
  // Optional Ceiling Closure, Barrel Vault / Gable Roof & Overhead Cross-Beams
  ceilingClosureEnabled: boolean
  ceilingProfile: CeilingProfileType
  ceilingVaultRise: number
  ceilingBeamCount: number
  ceilingBeamDrop: number
  // Optional 1-Click Mitered 3D Room Perimeter Baseboard, Chair-Rail & Crown Molding Sweeper
  perimeterMoldingsEnabled: boolean
  baseboardEnabled: boolean
  baseboardProfile: BaseboardProfileType
  baseboardHeight: number
  baseboardDepth: number
  chairRailEnabled: boolean
  chairRailHeightZ: number
  chairRailDepth: number
  crownMoldingEnabled: boolean
  crownProfile: CrownMoldingProfileType
  crownDropHeight: number
  crownProjection: number
  clipMoldingsAtPortals: boolean
  volumes: BlockoutVolume[]
  selectedVolumeId: string | null
  interactiveDrawMode: boolean
  // Opt-In #2: 3D Alpha-Masked Cutout Billboards (Standees for People, Trees, Curved Props)
  billboardsEnabled: boolean
  billboards: BillboardCutout[]
  selectedBillboardId: string | null
  // Opt-In #3: Automatic Foreground Occlusion Inpainting (Background De-Ghosting)
  inpaintOccludedBackground: boolean
  inpaintDilationPx: number
  // Architectural & Hallway Wall Detail Option 1 (Optional): 3D Swept Rail, Multi-Bend Pipe & Catenary Cable
  sweptRailsEnabled: boolean
  sweptRails: SweptWallRail[]
  selectedSweptRailId: string | null
  // Architectural & Hallway Wall Detail Option 2 (Optional): Wall-Parallel Offset Cutout Layer
  wallCutoutsEnabled: boolean
  wallCutouts: WallParallelCutout[]
  selectedWallCutoutId: string | null
  // Architectural & Hallway Wall Detail Option 3 (Optional): Wall Relief, Arched Portal & Recessed Alcove
  wallReliefsEnabled: boolean
  wallReliefs: WallReliefExtrusion[]
  selectedWallReliefId: string | null
  // Architectural & Hallway Wall Detail Option 4 (Optional): 3-Sweep Cylinder & Pillar Snapper
  sweptColumnsEnabled: boolean
  sweptColumns: SweptCylinderColumn[]
  selectedSweptColumnId: string | null
  // Architectural & Hallway Wall Detail Option 5 (Optional): Parametric 3D Staircase & Ramp
  staircasesEnabled: boolean
  staircases: StaircaseExtrusion[]
  selectedStaircaseId: string | null
  // Architectural & Hallway Wall Detail Option 6 (Optional): N-Point 3D Floor Polygon Prism Extruder
  floorPrismsEnabled: boolean
  floorPrisms: FloorPolygonPrism[]
  selectedFloorPrismId: string | null
  // Architectural & Hallway Wall Detail Option 7 (Optional): 3D Revolved Lathe Object
  latheObjectsEnabled: boolean
  latheObjects: RevolvedLatheObject[]
  selectedLatheObjectId: string | null
  // Architectural & Hallway Wall Detail Option 8 (Optional): 3D Coffered Ceiling Grid & Repeating Wall Panel Array
  cofferedArraysEnabled: boolean
  cofferedArrays: CofferedPanelArray[]
  selectedCofferedArrayId: string | null
  // Architectural & Hallway Wall Detail Option 9 (Optional): 3-Point Curved Arc Wall & Bow-Window Bay Extruder
  curvedWallsEnabled: boolean
  curvedWalls: CurvedArcWall[]
  selectedCurvedWallId: string | null
}

export type ParallaxMotionPreset =
  | 'dolly-in'
  | 'orbit-arc'
  | 'crane-rise'
  | 'figure-eight'
  | 'truck-pan'

export interface ParallaxAnimatorConfig {
  enabled: boolean
  isPlaying: boolean
  preset: ParallaxMotionPreset
  amplitude: number
  durationSec: number
  pingPong: boolean
  lookAtHeightZ: number
  manualPhase: number
}

export function createDefaultParallaxAnimatorConfig(): ParallaxAnimatorConfig {
  return {
    enabled: false,
    isPlaying: false,
    preset: 'orbit-arc',
    amplitude: 0.65,
    durationSec: 4.5,
    pingPong: true,
    lookAtHeightZ: 0.7,
    manualPhase: 0
  }
}

export type UnwarpAspectPreset = 'auto-3d' | '1:1' | '4:3' | '16:9'

export interface TextureUnwarpConfig {
  enabled: boolean
  /** 4 corners in relative [0, 1] image coordinates: [TopLeft, TopRight, BottomRight, BottomLeft] */
  quad: [Point2D, Point2D, Point2D, Point2D]
  aspectPreset: UnwarpAspectPreset
  previewDataUrl: string | null
  estimatedAspect: number
}

export function createDefaultBillboardCutout(
  id = 'cutout-1',
  name = 'Foreground Cutout 1'
): BillboardCutout {
  return {
    id,
    name,
    baseX: 1.1,
    baseY: 1.0,
    baseZ: 0,
    width: 1.15,
    height: 1.55,
    yawDeg: 0,
    faceCamera: true,
    autoFitFromPolygon: true,
    featherPx: 2,
    polygonRel: [
      { x: 0.44, y: 0.34 },
      { x: 0.56, y: 0.34 },
      { x: 0.59, y: 0.52 },
      { x: 0.57, y: 0.74 },
      { x: 0.43, y: 0.74 },
      { x: 0.41, y: 0.52 }
    ]
  }
}

export function createDefaultSweptWallRail(
  id = 'rail-1',
  name = 'Hallway Handrail 1'
): SweptWallRail {
  return {
    id,
    name,
    hostWall: 'left-wall-yz',
    p1Rel: { x: 0.16, y: 0.62 },
    p2Rel: { x: 0.44, y: 0.51 },
    waypointsRel: [],
    pathMode: 'straight-or-elbows',
    catenarySag: 0.22,
    standOff: 0.08,
    radius: 0.035,
    profile: 'round-pipe',
    bracketCount: 3
  }
}

export function createDefaultWallParallelCutout(
  id = 'wall-cutout-1',
  name = 'Ornate Railing / Balustrade 1'
): WallParallelCutout {
  return {
    id,
    name,
    hostWall: 'left-wall-yz',
    quadRel: [
      { x: 0.15, y: 0.46 },
      { x: 0.42, y: 0.40 },
      { x: 0.42, y: 0.72 },
      { x: 0.15, y: 0.82 }
    ],
    standOff: 0.09,
    alphaMode: 'edge-contrast',
    threshold: 0.28,
    featherPx: 1.5
  }
}

export function createDefaultWallReliefExtrusion(
  id = 'relief-1',
  name = 'Recessed Window / Ledge 1'
): WallReliefExtrusion {
  return {
    id,
    name,
    hostWall: 'back-wall-xz',
    quadRel: [
      { x: 0.38, y: 0.26 },
      { x: 0.62, y: 0.26 },
      { x: 0.62, y: 0.58 },
      { x: 0.38, y: 0.58 }
    ],
    extrudeDepth: -0.18,
    archType: 'rectangular',
    archRiseRatio: 0.35,
    passThroughPortal: false,
    annexLength: 2.2,
    annexWidthExpand: 0.4,
    annexOpenEnd: false
  }
}

export function createDefaultSweptCylinderColumn(
  id = 'column-1',
  name = 'Vertical Pillar 1'
): SweptCylinderColumn {
  return {
    id,
    name,
    baseLeftRel: { x: 0.64, y: 0.74 },
    baseRightRel: { x: 0.72, y: 0.74 },
    topCenterRel: { x: 0.68, y: 0.25 },
    baseZ: 0,
    profile: 'round-column'
  }
}

export function createDefaultStaircaseExtrusion(
  id = 'stairs-1',
  name = 'Hallway Staircase 1'
): StaircaseExtrusion {
  return {
    id,
    name,
    mode: 'stepped-stairs',
    stepCount: 8,
    widthX: 1.8,
    runDepthY: 2.1,
    totalHeightZ: 1.35,
    offsetX: 0,
    offsetY: 1.5,
    offsetZ: 0,
    yawDeg: 0,
    closedStringers: true,
    turnDirection: 'left-ccw',
    spiralArcDeg: 180,
    innerRadius: 0.45
  }
}

export function createDefaultFloorPolygonPrism(
  id = 'prism-1',
  name = 'L-Counter / Floor Prism 1'
): FloorPolygonPrism {
  return {
    id,
    name,
    // Default 6-point L-shaped floor footprint in relative image coordinates
    polygonRel: [
      { x: 0.26, y: 0.68 },
      { x: 0.54, y: 0.68 },
      { x: 0.54, y: 0.76 },
      { x: 0.37, y: 0.76 },
      { x: 0.37, y: 0.87 },
      { x: 0.26, y: 0.87 }
    ],
    baseZ: 0,
    heightZ: 0.95,
    bevelTop: 0.02
  }
}

export function createDefaultRevolvedLatheObject(
  id = 'lathe-1',
  name = 'Revolved Lathe Object 1'
): RevolvedLatheObject {
  return {
    id,
    name,
    preset: 'classical-column',
    baseCenterRel: { x: 0.32, y: 0.76 },
    baseEdgeRel: { x: 0.37, y: 0.76 },
    topCenterRel: { x: 0.32, y: 0.32 },
    baseZ: 0,
    radialSegments: 24,
    profileRadii: [1.35, 0.95, 0.85, 1.3]
  }
}

export function createDefaultCofferedPanelArray(
  id = 'coffer-1',
  name = 'Coffered Grid / Wall Panels 1'
): CofferedPanelArray {
  return {
    id,
    name,
    hostWall: 'left-wall-yz',
    quadRel: [
      { x: 0.12, y: 0.28 },
      { x: 0.42, y: 0.34 },
      { x: 0.42, y: 0.76 },
      { x: 0.12, y: 0.86 }
    ],
    rows: 2,
    cols: 3,
    stileWidthRatio: 0.16,
    recessDepth: -0.1,
    bevelMarginRatio: 0.05
  }
}

export function createDefaultCurvedArcWall(
  id = 'arc-wall-1',
  name = 'Curved Arc Wall / Bay 1'
): CurvedArcWall {
  return {
    id,
    name,
    startRel: { x: 0.24, y: 0.74 },
    apexRel: { x: 0.48, y: 0.62 },
    endRel: { x: 0.72, y: 0.74 },
    baseZ: 0,
    heightZ: 2.4,
    thickness: 0.18,
    segments: 20
  }
}

export function createDefaultSceneBlockoutConfig(): SceneBlockoutConfig {
  return {
    enabled: false,
    projectPhotoTexture: true,
    freeOrbitMode: false,
    wireframeOverlay: true,
    showViewportHandles: true,
    surfaceOpacity: 0.92,
    roomShellType: 'corner-stage',
    roomWidthX: 4.2,
    roomDepthY: 4.2,
    roomHeightZ: 2.7,
    roomOffsetX: 0,
    roomOffsetY: 0,
    ceilingClosureEnabled: false,
    ceilingProfile: 'flat',
    ceilingVaultRise: 0.65,
    ceilingBeamCount: 0,
    ceilingBeamDrop: 0.18,
    perimeterMoldingsEnabled: false,
    baseboardEnabled: true,
    baseboardProfile: 'stepped-skirting',
    baseboardHeight: 0.15,
    baseboardDepth: 0.035,
    chairRailEnabled: false,
    chairRailHeightZ: 0.95,
    chairRailDepth: 0.04,
    crownMoldingEnabled: true,
    crownProfile: 'ogee-cornice',
    crownDropHeight: 0.16,
    crownProjection: 0.12,
    clipMoldingsAtPortals: true,
    volumes: [
      {
        id: 'vol-1',
        name: 'Primary Blockout Box',
        widthX: 1.2,
        depthY: 1.0,
        heightZ: 1.1,
        offsetX: 0.8,
        offsetY: 0.8,
        offsetZ: 0,
        rotationZ: 0
      }
    ],
    selectedVolumeId: 'vol-1',
    interactiveDrawMode: false,
    billboardsEnabled: false,
    billboards: [createDefaultBillboardCutout()],
    selectedBillboardId: 'cutout-1',
    inpaintOccludedBackground: false,
    inpaintDilationPx: 7,
    sweptRailsEnabled: false,
    sweptRails: [createDefaultSweptWallRail()],
    selectedSweptRailId: 'rail-1',
    wallCutoutsEnabled: false,
    wallCutouts: [createDefaultWallParallelCutout()],
    selectedWallCutoutId: 'wall-cutout-1',
    wallReliefsEnabled: false,
    wallReliefs: [createDefaultWallReliefExtrusion()],
    selectedWallReliefId: 'relief-1',
    sweptColumnsEnabled: false,
    sweptColumns: [createDefaultSweptCylinderColumn()],
    selectedSweptColumnId: 'column-1',
    staircasesEnabled: false,
    staircases: [createDefaultStaircaseExtrusion()],
    selectedStaircaseId: 'stairs-1',
    floorPrismsEnabled: false,
    floorPrisms: [createDefaultFloorPolygonPrism()],
    selectedFloorPrismId: 'prism-1',
    latheObjectsEnabled: false,
    latheObjects: [createDefaultRevolvedLatheObject()],
    selectedLatheObjectId: 'lathe-1',
    cofferedArraysEnabled: false,
    cofferedArrays: [createDefaultCofferedPanelArray()],
    selectedCofferedArrayId: 'coffer-1',
    curvedWallsEnabled: false,
    curvedWalls: [createDefaultCurvedArcWall()],
    selectedCurvedWallId: 'arc-wall-1'
  }
}

export function createDefaultTextureUnwarpConfig(): TextureUnwarpConfig {
  return {
    enabled: false,
    quad: [
      { x: 0.32, y: 0.28 },
      { x: 0.68, y: 0.28 },
      { x: 0.68, y: 0.72 },
      { x: 0.32, y: 0.72 }
    ],
    aspectPreset: 'auto-3d',
    previewDataUrl: null,
    estimatedAspect: 1.333
  }
}

/**
 * Computes the base normalization scale factor used by fSpy's 3D overlay
 * so that 1 unit in blockout space matches the visual scale of the scene.
 */
export function computeSceneBaseScale(cameraParameters: CameraParameters): number {
  const vt = cameraParameters.viewTransform.matrix
  const translation = new Vector3D(vt[0][3], vt[1][3], vt[2][3])
  const normFactor =
    translation.length * Math.atan(0.5 * cameraParameters.horizontalFieldOfView)
  return Math.max(0.01, 0.28 * normFactor)
}

/**
 * Raycasts a relative image point [0, 1] onto the Z = planeZ horizontal plane in normalized blockout units.
 */
export function unprojectRelativePointToPlaneZ(
  relPoint: Point2D,
  planeZ: number,
  cameraParameters: CameraParameters
): { x: number; y: number } | null {
  const {
    imageWidth,
    imageHeight,
    viewTransform,
    principalPoint,
    horizontalFieldOfView
  } = cameraParameters
  if (imageWidth <= 0 || imageHeight <= 0) return null

  const planePt = CoordinatesUtil.convert(
    relPoint,
    ImageCoordinateFrame.Relative,
    ImageCoordinateFrame.ImagePlane,
    imageWidth,
    imageHeight
  )
  const rStart = MathUtil.perspectiveUnproject(
    new Vector3D(planePt.x, planePt.y, 1),
    viewTransform,
    principalPoint,
    horizontalFieldOfView
  )
  const rEnd = MathUtil.perspectiveUnproject(
    new Vector3D(planePt.x, planePt.y, 2),
    viewTransform,
    principalPoint,
    horizontalFieldOfView
  )
  const baseScale = computeSceneBaseScale(cameraParameters)
  const worldZ = planeZ * baseScale
  const hit = MathUtil.linePlaneIntersection(
    new Vector3D(0, 0, worldZ),
    new Vector3D(1, 0, worldZ),
    new Vector3D(0, 1, worldZ),
    rStart,
    rEnd
  )
  if (!Number.isFinite(hit.x) || !Number.isFinite(hit.y)) return null
  return {
    x: Math.max(-14, Math.min(14, hit.x / baseScale)),
    y: Math.max(-14, Math.min(14, hit.y / baseScale))
  }
}

/**
 * Raycasts a relative image point [0, 1] onto the Z = 0 ground plane in normalized blockout units.
 */
export function unprojectRelativePointToGroundXY(
  relPoint: Point2D,
  cameraParameters: CameraParameters
): { x: number; y: number } | null {
  return unprojectRelativePointToPlaneZ(relPoint, 0, cameraParameters)
}

/**
 * Resolves the 3D origin, two in-plane basis vectors (axisU, axisV), and inward-facing normal
 * (in normalized blockout units) for any chosen HostWallType.
 */
export function resolveHostWallPlaneBlockout(
  hostWall: HostWallType,
  config: SceneBlockoutConfig
): {
  origin: Vector3D
  axisU: Vector3D
  axisV: Vector3D
  normal: Vector3D
} {
  const ox = config.roomOffsetX
  const oy = config.roomOffsetY
  const wx = config.roomWidthX
  const dy = config.roomDepthY
  const isInterior = config.roomShellType === 'interior-room'

  switch (hostWall) {
    case 'left-wall-yz': {
      const wallX = isInterior ? ox - 0.5 * wx : ox
      return {
        origin: new Vector3D(wallX, oy, 0),
        axisU: new Vector3D(0, 1, 0),
        axisV: new Vector3D(0, 0, 1),
        normal: new Vector3D(1, 0, 0)
      }
    }
    case 'right-wall-yz': {
      const wallX = isInterior ? ox + 0.5 * wx : ox + wx
      return {
        origin: new Vector3D(wallX, oy, 0),
        axisU: new Vector3D(0, -1, 0),
        axisV: new Vector3D(0, 0, 1),
        normal: new Vector3D(-1, 0, 0)
      }
    }
    case 'back-wall-xz': {
      const wallY = isInterior ? oy + dy : oy
      const normalY = isInterior ? -1 : 1
      return {
        origin: new Vector3D(ox, wallY, 0),
        axisU: new Vector3D(1, 0, 0),
        axisV: new Vector3D(0, 0, 1),
        normal: new Vector3D(0, normalY, 0)
      }
    }
    case 'ceiling-xy':
      return {
        origin: new Vector3D(ox, oy, config.roomHeightZ),
        axisU: new Vector3D(1, 0, 0),
        axisV: new Vector3D(0, 1, 0),
        normal: new Vector3D(0, 0, -1)
      }
    case 'floor-xy':
    default:
      return {
        origin: new Vector3D(ox, oy, 0),
        axisU: new Vector3D(1, 0, 0),
        axisV: new Vector3D(0, 1, 0),
        normal: new Vector3D(0, 0, 1)
      }
  }
}

/**
 * Raycasts a relative image point [0, 1] onto the specified HostWallType plane
 * shifted outward along the wall normal by `standOffOffset` (in normalized blockout units).
 */
export function unprojectRelativePointToHostWall(
  relPoint: Point2D,
  hostWall: HostWallType,
  standOffOffset: number,
  config: SceneBlockoutConfig,
  cameraParameters: CameraParameters
): { x: number; y: number; z: number; normal: Vector3D } | null {
  const {
    imageWidth,
    imageHeight,
    viewTransform,
    principalPoint,
    horizontalFieldOfView
  } = cameraParameters
  if (imageWidth <= 0 || imageHeight <= 0) return null

  const planePt = CoordinatesUtil.convert(
    relPoint,
    ImageCoordinateFrame.Relative,
    ImageCoordinateFrame.ImagePlane,
    imageWidth,
    imageHeight
  )
  const rStart = MathUtil.perspectiveUnproject(
    new Vector3D(planePt.x, planePt.y, 1),
    viewTransform,
    principalPoint,
    horizontalFieldOfView
  )
  const rEnd = MathUtil.perspectiveUnproject(
    new Vector3D(planePt.x, planePt.y, 2),
    viewTransform,
    principalPoint,
    horizontalFieldOfView
  )

  const baseScale = computeSceneBaseScale(cameraParameters)
  const { origin, axisU, axisV, normal } = resolveHostWallPlaneBlockout(
    hostWall,
    config
  )

  const p0 = new Vector3D(
    (origin.x + normal.x * standOffOffset) * baseScale,
    (origin.y + normal.y * standOffOffset) * baseScale,
    (origin.z + normal.z * standOffOffset) * baseScale
  )
  const p1 = new Vector3D(
    p0.x + axisU.x * baseScale,
    p0.y + axisU.y * baseScale,
    p0.z + axisU.z * baseScale
  )
  const p2 = new Vector3D(
    p0.x + axisV.x * baseScale,
    p0.y + axisV.y * baseScale,
    p0.z + axisV.z * baseScale
  )

  const hit = MathUtil.linePlaneIntersection(p0, p1, p2, rStart, rEnd)
  if (
    !Number.isFinite(hit.x) ||
    !Number.isFinite(hit.y) ||
    !Number.isFinite(hit.z)
  ) {
    return null
  }

  const clampVal = (v: number, lo: number, hi: number) =>
    Math.max(lo, Math.min(hi, v))

  return {
    x: clampVal(hit.x / baseScale, -16, 16),
    y: clampVal(hit.y / baseScale, -16, 16),
    z: clampVal(hit.z / baseScale, -4, 12),
    normal
  }
}

/**
 * Solves a 3-Sweep Cylinder / Pillar's 3D floor center (centerX, centerY), 3D radius, and 3D height
 * from its 3 image handles (`baseLeftRel`, `baseRightRel`, `topCenterRel`).
 */
export function solveSweptColumn3D(
  col: SweptCylinderColumn,
  cameraParameters: CameraParameters
): {
  centerX: number
  centerY: number
  radius: number
  height: number
} | null {
  const hitL = unprojectRelativePointToPlaneZ(
    col.baseLeftRel,
    col.baseZ,
    cameraParameters
  )
  const hitR = unprojectRelativePointToPlaneZ(
    col.baseRightRel,
    col.baseZ,
    cameraParameters
  )
  if (!hitL || !hitR) return null

  const centerX = 0.5 * (hitL.x + hitR.x)
  const centerY = 0.5 * (hitL.y + hitR.y)
  const dist = Math.hypot(hitR.x - hitL.x, hitR.y - hitL.y)
  const radius = Math.max(0.03, Math.min(4.0, 0.5 * dist))
  const solvedH =
    solveExtrudedHeightZFromRelativePoint(
      col.topCenterRel,
      { x: centerX, y: centerY },
      col.baseZ,
      cameraParameters
    ) ?? 1.8

  return {
    centerX: Number(centerX.toFixed(2)),
    centerY: Number(centerY.toFixed(2)),
    radius: Number(radius.toFixed(3)),
    height: Math.max(0.15, Math.min(10.0, Number(solvedH.toFixed(2))))
  }
}

/**
 * Solves the 3D floor center, base reference radius, and vertical height of a RevolvedLatheObject.
 */
export function solveRevolvedLathe3D(
  lathe: RevolvedLatheObject,
  cameraParameters: CameraParameters
): {
  centerX: number
  centerY: number
  baseRadius: number
  height: number
} | null {
  const hitCenter = unprojectRelativePointToPlaneZ(
    lathe.baseCenterRel,
    lathe.baseZ,
    cameraParameters
  )
  const hitEdge = unprojectRelativePointToPlaneZ(
    lathe.baseEdgeRel,
    lathe.baseZ,
    cameraParameters
  )
  if (!hitCenter || !hitEdge) return null

  const baseRadius = Math.max(
    0.04,
    Math.min(4.0, Math.hypot(hitEdge.x - hitCenter.x, hitEdge.y - hitCenter.y))
  )
  const solvedH =
    solveExtrudedHeightZFromRelativePoint(
      lathe.topCenterRel,
      { x: hitCenter.x, y: hitCenter.y },
      lathe.baseZ,
      cameraParameters
    ) ?? 1.4

  return {
    centerX: Number(hitCenter.x.toFixed(2)),
    centerY: Number(hitCenter.y.toFixed(2)),
    baseRadius: Number(baseRadius.toFixed(3)),
    height: Math.max(0.15, Math.min(10.0, Number(solvedH.toFixed(2))))
  }
}

/**
 * Evaluates the normalized radial multiplier r(v) at vertical fraction v in [0, 1]
 * for a RevolvedLatheObject preset or custom 4-band profile.
 */
export function evaluateLatheRadiusMultiplier(
  v: number,
  preset: LathePresetType,
  profileRadii: [number, number, number, number]
): number {
  const t = Math.max(0, Math.min(1, v))
  if (preset === 'classical-column') {
    // Plinth & torus base (0..0.14), entasis shaft (0.14..0.84), echinus & abacus capital (0.84..1.0)
    if (t < 0.12) return 1.38 - (t / 0.12) * 0.32
    if (t < 0.85) {
      const s = (t - 0.12) / 0.73
      return 1.0 - 0.14 * s + 0.04 * Math.sin(s * Math.PI)
    }
    const c = (t - 0.85) / 0.15
    return 0.86 + c * 0.48
  }
  if (preset === 'pedestal-table') {
    // Wide foot (0..0.1), narrow stem (0.1..0.88), wide tabletop (0.88..1.0)
    if (t < 0.1) return 1.15 - (t / 0.1) * 0.82
    if (t < 0.88) return 0.28
    return 1.65
  }
  if (preset === 'vase-planter') {
    // Foot -> wide belly -> narrow neck -> flared rim
    const [r0, r1, r2, r3] = [0.75, 1.35, 0.68, 1.12]
    const u = 1 - t
    return (
      u * u * u * r0 +
      3 * u * u * t * r1 +
      3 * u * t * t * r2 +
      t * t * t * r3
    )
  }
  if (preset === 'tapered-bollard') {
    // Domed / tapered bollard or streetlamp base
    if (t > 0.88) {
      const d = (t - 0.88) / 0.12
      return Math.max(0.08, 0.72 * Math.sqrt(Math.max(0, 1 - d * d)))
    }
    return 1.15 - 0.43 * (t / 0.88)
  }
  // 'custom-profile': smooth cubic Bernstein interpolation across the 4 user sliders
  const [r0, r1, r2, r3] = profileRadii
  const u = 1 - t
  return Math.max(
    0.05,
    u * u * u * r0 +
      3 * u * u * t * r1 +
      3 * u * t * t * r2 +
      t * t * t * r3
  )
}

/**
 * Projects a 3D point in normalized blockout units into relative [0, 1] image coordinates.
 */
export function projectBlockoutPointToRelative(
  pt: { x: number; y: number; z: number },
  cameraParameters: CameraParameters
): Point2D {
  const baseScale = computeSceneBaseScale(cameraParameters)
  const worldPt = new Vector3D(
    pt.x * baseScale,
    pt.y * baseScale,
    pt.z * baseScale
  )
  const projectedPlane = MathUtil.perspectiveProject(
    worldPt,
    cameraParameters.viewTransform,
    cameraParameters.principalPoint,
    cameraParameters.horizontalFieldOfView
  )
  return CoordinatesUtil.convert(
    projectedPlane,
    ImageCoordinateFrame.ImagePlane,
    ImageCoordinateFrame.Relative,
    cameraParameters.imageWidth,
    cameraParameters.imageHeight
  )
}

/**
 * Solves the exact 3D vertical extrusion heightZ (in normalized blockout units)
 * by finding the closest point on the vertical 3D axis (baseX, baseY, z) to the camera ray through relPoint.
 */
export function solveExtrudedHeightZFromRelativePoint(
  relPoint: Point2D,
  baseXY: { x: number; y: number },
  baseZ: number,
  cameraParameters: CameraParameters
): number | null {
  const {
    imageWidth,
    imageHeight,
    viewTransform,
    principalPoint,
    horizontalFieldOfView
  } = cameraParameters
  if (imageWidth <= 0 || imageHeight <= 0) return null

  const planePt = CoordinatesUtil.convert(
    relPoint,
    ImageCoordinateFrame.Relative,
    ImageCoordinateFrame.ImagePlane,
    imageWidth,
    imageHeight
  )
  const r1 = MathUtil.perspectiveUnproject(
    new Vector3D(planePt.x, planePt.y, 1),
    viewTransform,
    principalPoint,
    horizontalFieldOfView
  )
  const r2 = MathUtil.perspectiveUnproject(
    new Vector3D(planePt.x, planePt.y, 2),
    viewTransform,
    principalPoint,
    horizontalFieldOfView
  )

  const vxRaw = r2.x - r1.x
  const vyRaw = r2.y - r1.y
  const vzRaw = r2.z - r1.z
  const vLen = Math.hypot(vxRaw, vyRaw, vzRaw)
  if (vLen < 1e-8) return null
  const vx = vxRaw / vLen
  const vy = vyRaw / vLen
  const vz = vzRaw / vLen

  const baseScale = computeSceneBaseScale(cameraParameters)
  const p0x = baseXY.x * baseScale
  const p0y = baseXY.y * baseScale
  const p0z = baseZ * baseScale

  // Closest point on vertical line P(s) = P0 + s*(0,0,1) to ray R(t) = R1 + t*V
  const w0x = p0x - r1.x
  const w0y = p0y - r1.y
  const w0z = p0z - r1.z

  const b = vz // dot(u, v) where u = (0, 0, 1)
  const d = w0z // dot(u, w0)
  const e = vx * w0x + vy * w0y + vz * w0z // dot(v, w0)
  const denom = 1 - b * b
  if (Math.abs(denom) < 1e-5) return null

  const sWorld = (b * e - d) / denom
  const heightNorm = sWorld / baseScale
  return Math.max(0.08, Math.min(12.0, Number(heightNorm.toFixed(2))))
}

export interface ProjectedVolumeHandles {
  volumeId: string
  name: string
  bottomCorners: [Point2D, Point2D, Point2D, Point2D]
  topCorners: [Point2D, Point2D, Point2D, Point2D]
  floorCenter: Point2D
  roofCenter: Point2D
  widthPlusEdge: Point2D
  depthPlusEdge: Point2D
  yawHandle: Point2D
}

/**
 * Computes the 2D relative projections of a 3D BlockoutVolume's 8 corners and 5 interactive push/pull handles.
 */
export function computeProjectedBlockoutVolumeHandles(
  vol: BlockoutVolume,
  cameraParameters: CameraParameters
): ProjectedVolumeHandles {
  const rad = (vol.rotationZ * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const hx = 0.5 * vol.widthX
  const hy = 0.5 * vol.depthY

  const toWorldBlockout = (lx: number, ly: number, lz: number) => ({
    x: vol.offsetX + lx * cos - ly * sin,
    y: vol.offsetY + lx * sin + ly * cos,
    z: vol.offsetZ + lz
  })

  const localCorners: [number, number][] = [
    [-hx, -hy],
    [hx, -hy],
    [hx, hy],
    [-hx, hy]
  ]

  const bottomCorners = localCorners.map(([lx, ly]) =>
    projectBlockoutPointToRelative(toWorldBlockout(lx, ly, 0), cameraParameters)
  ) as [Point2D, Point2D, Point2D, Point2D]

  const topCorners = localCorners.map(([lx, ly]) =>
    projectBlockoutPointToRelative(
      toWorldBlockout(lx, ly, vol.heightZ),
      cameraParameters
    )
  ) as [Point2D, Point2D, Point2D, Point2D]

  const floorCenter = projectBlockoutPointToRelative(
    toWorldBlockout(0, 0, 0),
    cameraParameters
  )
  const roofCenter = projectBlockoutPointToRelative(
    toWorldBlockout(0, 0, vol.heightZ),
    cameraParameters
  )
  const widthPlusEdge = projectBlockoutPointToRelative(
    toWorldBlockout(hx, 0, 0.25 * vol.heightZ),
    cameraParameters
  )
  const depthPlusEdge = projectBlockoutPointToRelative(
    toWorldBlockout(0, hy, 0.25 * vol.heightZ),
    cameraParameters
  )
  const yawHandle = projectBlockoutPointToRelative(
    toWorldBlockout(hx + 0.38, 0, 0),
    cameraParameters
  )

  return {
    volumeId: vol.id,
    name: vol.name,
    bottomCorners,
    topCorners,
    floorCenter,
    roofCenter,
    widthPlusEdge,
    depthPlusEdge,
    yawHandle
  }
}

export interface ProjectedCloneWireframe {
  id: string
  label: string
  color: string
  polylinesRel: Point2D[][]
  badgeAnchorRel: Point2D
}

/**
 * Upgrade #4: Computes 2D perspective-projected ghost wireframes for all repeated array clones
 * (`repeatCount > 1`) across 3D Boxes, 3-Sweep Pillars, Wall Reliefs/Doors, and Swept Rails
 * so the user sees repeating elements marching down the hallway in real time on the 2D photo.
 */
export function computeRepeatedCloneWireframesSVG(
  config: SceneBlockoutConfig,
  cameraParameters: CameraParameters
): ProjectedCloneWireframe[] {
  const results: ProjectedCloneWireframe[] = []

  // 1. Repeated 3D Boxes
  for (const vol of config.volumes) {
    const count = Math.max(1, Math.min(10, Math.round(vol.repeatCount ?? 1)))
    const spacing = vol.repeatSpacing ?? 1.8
    const axis = vol.repeatAxis ?? 'y'
    if (count <= 1 || Math.abs(spacing) < 1e-3) continue

    for (let k = 1; k < count; k++) {
      const shift = k * spacing
      const cloneVol: BlockoutVolume = {
        ...vol,
        offsetX: vol.offsetX + (axis === 'x' ? shift : 0),
        offsetY: vol.offsetY + (axis === 'y' ? shift : 0),
        offsetZ: vol.offsetZ + (axis === 'z' ? shift : 0)
      }
      const proj = computeProjectedBlockoutVolumeHandles(cloneVol, cameraParameters)
      const b = proj.bottomCorners
      const t = proj.topCorners
      results.push({
        id: `${vol.id}-clone-${k}`,
        label: `${vol.name} #${k + 1}`,
        color: '#38bdf8',
        polylinesRel: [
          [b[0], b[1], b[2], b[3], b[0]],
          [t[0], t[1], t[2], t[3], t[0]],
          [b[0], t[0]],
          [b[1], t[1]],
          [b[2], t[2]],
          [b[3], t[3]]
        ],
        badgeAnchorRel: proj.roofCenter
      })
    }
  }

  // 2. Repeated 3-Sweep Pillars / Colonnades
  if (config.sweptColumnsEnabled) {
    for (const col of config.sweptColumns) {
      const count = Math.max(1, Math.min(10, Math.round(col.repeatCount ?? 1)))
      const spacing = col.repeatSpacing ?? 2.0
      const axis = col.repeatAxis ?? 'y'
      if (count <= 1 || Math.abs(spacing) < 1e-3) continue

      const solved = solveSweptColumn3D(col, cameraParameters)
      if (!solved) continue

      for (let k = 1; k < count; k++) {
        const cx = solved.centerX + (axis === 'x' ? k * spacing : 0)
        const cy = solved.centerY + (axis === 'y' ? k * spacing : 0)
        const r = solved.radius
        const z0 = col.baseZ
        const z1 = col.baseZ + solved.height
        const ringBot: Point2D[] = []
        const ringTop: Point2D[] = []
        const segs = 12
        for (let s = 0; s <= segs; s++) {
          const ang = (s / segs) * Math.PI * 2
          const px = cx + r * Math.cos(ang)
          const py = cy + r * Math.sin(ang)
          ringBot.push(projectBlockoutPointToRelative({ x: px, y: py, z: z0 }, cameraParameters))
          ringTop.push(projectBlockoutPointToRelative({ x: px, y: py, z: z1 }, cameraParameters))
        }
        const topCenter = projectBlockoutPointToRelative({ x: cx, y: cy, z: z1 }, cameraParameters)
        results.push({
          id: `${col.id}-clone-${k}`,
          label: `${col.name} #${k + 1}`,
          color: '#facc15',
          polylinesRel: [
            ringBot,
            ringTop,
            [ringBot[0], ringTop[0]],
            [ringBot[3], ringTop[3]],
            [ringBot[6], ringTop[6]],
            [ringBot[9], ringTop[9]]
          ],
          badgeAnchorRel: topCenter
        })
      }
    }
  }

  // 3. Repeated Doors, Windows & Arched Portals along Host Wall
  if (config.wallReliefsEnabled) {
    for (const rel of config.wallReliefs) {
      const count = Math.max(1, Math.min(10, Math.round(rel.repeatCount ?? 1)))
      const spacing = rel.repeatSpacing ?? 1.8
      if (count <= 1 || Math.abs(spacing) < 1e-3) continue

      const hits = rel.quadRel.map((pt) =>
        unprojectRelativePointToHostWall(pt, rel.hostWall, 0, config, cameraParameters)
      )
      if (hits.some((h) => !h)) continue
      const [h0, h1, h2, h3] = hits as NonNullable<(typeof hits)[0]>[]
      const dx = h2.x - h3.x
      const dy = h2.y - h3.y
      const dz = h2.z - h3.z
      const len = Math.hypot(dx, dy, dz)
      if (len < 1e-4) continue
      const ux = dx / len
      const uy = dy / len
      const uz = dz / len

      for (let k = 1; k < count; k++) {
        const shift = k * spacing
        const corners = [h0, h1, h2, h3].map((h) =>
          projectBlockoutPointToRelative(
            {
              x: h.x + ux * shift,
              y: h.y + uy * shift,
              z: h.z + uz * shift
            },
            cameraParameters
          )
        )
        results.push({
          id: `${rel.id}-clone-${k}`,
          label: `${rel.name} #${k + 1}`,
          color: '#22d3ee',
          polylinesRel: [[corners[0], corners[1], corners[2], corners[3], corners[0]]],
          badgeAnchorRel: {
            x: 0.5 * (corners[0].x + corners[1].x),
            y: 0.5 * (corners[0].y + corners[1].y)
          }
        })
      }
    }
  }

  // 4. Repeated Parallel Swept Rails / Ceiling Conduits
  if (config.sweptRailsEnabled) {
    for (const rail of config.sweptRails) {
      const count = Math.max(1, Math.min(10, Math.round(rail.repeatCount ?? 1)))
      const spacing = rail.repeatSpacing ?? 0.35
      if (count <= 1 || Math.abs(spacing) < 1e-3) continue

      const allRelNodes = [rail.p1Rel, ...(rail.waypointsRel ?? []), rail.p2Rel]
      const hits = allRelNodes
        .map((pt) =>
          unprojectRelativePointToHostWall(pt, rail.hostWall, rail.standOff, config, cameraParameters)
        )
        .filter((h): h is NonNullable<typeof h> => h !== null)
      if (hits.length < 2) continue

      const { axisV } = resolveHostWallPlaneBlockout(rail.hostWall, config)
      for (let k = 1; k < count; k++) {
        const shift = k * spacing
        const poly = hits.map((h) =>
          projectBlockoutPointToRelative(
            {
              x: h.x + axisV.x * shift,
              y: h.y + axisV.y * shift,
              z: h.z + axisV.z * shift
            },
            cameraParameters
          )
        )
        results.push({
          id: `${rail.id}-clone-${k}`,
          label: `${rail.name} #${k + 1}`,
          color: '#fb7185',
          polylinesRel: [poly],
          badgeAnchorRel: poly[0]
        })
      }
    }
  }

  return results
}

/**
 * Evaluates a smooth 3D camera transform at normalized time phase01 in [0, 1]
 * for the Cinematic 2.5D Parallax Camera Animator.
 */
export function evaluateParallaxCameraPose(
  config: ParallaxAnimatorConfig,
  phase01: number,
  cameraParameters: CameraParameters
): { position: THREE.Vector3; quaternion: THREE.Quaternion; target: THREE.Vector3 } {
  const m = cameraParameters.cameraTransform.matrix
  const baseCamMat = new THREE.Matrix4().set(
    m[0][0], m[0][1], m[0][2], m[0][3],
    m[1][0], m[1][1], m[1][2], m[1][3],
    m[2][0], m[2][1], m[2][2], m[2][3],
    0, 0, 0, 1
  )

  const basePos = new THREE.Vector3()
  const baseQuat = new THREE.Quaternion()
  const baseScaleVec = new THREE.Vector3()
  baseCamMat.decompose(basePos, baseQuat, baseScaleVec)

  // Extract camera local basis vectors (Right = +X, Up = +Y, Forward = -Z in Three.js camera space)
  const rightVec = new THREE.Vector3(1, 0, 0).applyQuaternion(baseQuat).normalize()
  const upVec = new THREE.Vector3(0, 1, 0).applyQuaternion(baseQuat).normalize()
  const forwardVec = new THREE.Vector3(0, 0, -1).applyQuaternion(baseQuat).normalize()

  const sceneScale = computeSceneBaseScale(cameraParameters)
  const ampWorld = config.amplitude * sceneScale

  // Smooth sinusoidal / ease-in-out curve
  const t = config.pingPong
    ? Math.sin(phase01 * Math.PI * 2)
    : (phase01 - 0.5) * 2

  const offset = new THREE.Vector3()
  switch (config.preset) {
    case 'dolly-in': {
      // Smooth push-in along the camera optical axis with subtle horizontal breath
      const push = 0.5 * (1 - Math.cos(phase01 * Math.PI * 2))
      offset
        .addScaledVector(forwardVec, push * ampWorld * 1.45)
        .addScaledVector(rightVec, Math.sin(phase01 * Math.PI * 2) * ampWorld * 0.18)
      break
    }
    case 'orbit-arc': {
      // Horizontal parallax arc with slight vertical rise
      offset
        .addScaledVector(rightVec, t * ampWorld * 1.25)
        .addScaledVector(upVec, Math.sin(phase01 * Math.PI * 4) * ampWorld * 0.22)
        .addScaledVector(forwardVec, (1 - Math.cos(t * 0.6)) * ampWorld * 0.4)
      break
    }
    case 'crane-rise': {
      // Vertical crane elevation + subtle push in
      const craneT = 0.5 * (1 - Math.cos(phase01 * Math.PI * 2))
      offset
        .addScaledVector(upVec, (craneT - 0.3) * ampWorld * 1.2)
        .addScaledVector(forwardVec, craneT * ampWorld * 0.65)
      break
    }
    case 'truck-pan': {
      // Pure lateral tracking shot
      offset.addScaledVector(rightVec, t * ampWorld * 1.4)
      break
    }
    case 'figure-eight': {
      // Handheld organic floating Lissajous drift
      const ang = phase01 * Math.PI * 2
      offset
        .addScaledVector(rightVec, Math.sin(ang) * ampWorld * 0.85)
        .addScaledVector(upVec, Math.sin(ang * 2) * ampWorld * 0.45)
        .addScaledVector(forwardVec, (0.5 - 0.5 * Math.cos(ang)) * ampWorld * 0.5)
      break
    }
  }

  const newPos = basePos.clone().add(offset)
  const target = new THREE.Vector3(0, 0, config.lookAtHeightZ * sceneScale)

  // Compute rotation that locks onto the 3D focal target while preserving natural Z-up roll
  const lookMat = new THREE.Matrix4().lookAt(
    newPos,
    target,
    new THREE.Vector3(0, 0, 1)
  )
  const targetQuat = new THREE.Quaternion().setFromRotationMatrix(lookMat)
  // Blend 75% target lock with 25% original camera orientation for ultra-smooth framing
  const finalQuat = baseQuat.clone().slerp(targetQuat, 0.78)

  return { position: newPos, quaternion: finalQuat, target }
}

/**
 * Projects every vertex of a BufferGeometry (given its mesh world matrix) through the solved
 * fSpy camera frustum and writes the resulting [u, v] texture coordinates into `geometry.attributes.uv`.
 */
export function applyCameraProjectedUVsToGeometry(
  geometry: THREE.BufferGeometry,
  meshWorldMatrix: THREE.Matrix4,
  cameraParameters: CameraParameters
): void {
  const posAttr = geometry.attributes.position
  if (!posAttr) return

  const count = posAttr.count
  const uvArray = new Float32Array(count * 2)
  const tempVec = new THREE.Vector3()

  const {
    viewTransform,
    principalPoint,
    horizontalFieldOfView,
    imageWidth,
    imageHeight
  } = cameraParameters

  for (let i = 0; i < count; i++) {
    tempVec.fromBufferAttribute(posAttr, i)
    tempVec.applyMatrix4(meshWorldMatrix)

    const projectedPlane = MathUtil.perspectiveProject(
      new Vector3D(tempVec.x, tempVec.y, tempVec.z),
      viewTransform,
      principalPoint,
      horizontalFieldOfView
    )
    const rel = CoordinatesUtil.convert(
      projectedPlane,
      ImageCoordinateFrame.ImagePlane,
      ImageCoordinateFrame.Relative,
      imageWidth,
      imageHeight
    )

    uvArray[i * 2] = rel.x
    // Three.js textures have v=0 at bottom and v=1 at top
    uvArray[i * 2 + 1] = 1 - rel.y
  }

  geometry.setAttribute('uv', new THREE.BufferAttribute(uvArray, 2))
  geometry.attributes.uv.needsUpdate = true
}

/**
 * Automatically computes a 3D Billboard Cutout's floor anchor (baseX, baseY), 3D width, and 3D height
 * from its 2D traced polygon silhouette on the photo.
 */
export function fitBillboard3DFromPolygon(
  polygonRel: Point2D[],
  baseZ: number,
  cameraParameters: CameraParameters
): { baseX: number; baseY: number; width: number; height: number } | null {
  if (polygonRel.length < 3) return null
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const pt of polygonRel) {
    if (pt.x < minX) minX = pt.x
    if (pt.x > maxX) maxX = pt.x
    if (pt.y < minY) minY = pt.y
    if (pt.y > maxY) maxY = pt.y
  }

  const footCenterRel = { x: 0.5 * (minX + maxX), y: maxY }
  const hitFoot = unprojectRelativePointToPlaneZ(
    footCenterRel,
    baseZ,
    cameraParameters
  )
  if (!hitFoot) return null

  const headCenterRel = { x: 0.5 * (minX + maxX), y: minY }
  const solvedH =
    solveExtrudedHeightZFromRelativePoint(
      headCenterRel,
      hitFoot,
      baseZ,
      cameraParameters
    ) ?? 1.5

  const hitLeft = unprojectRelativePointToPlaneZ(
    { x: minX, y: maxY },
    baseZ,
    cameraParameters
  )
  const hitRight = unprojectRelativePointToPlaneZ(
    { x: maxX, y: maxY },
    baseZ,
    cameraParameters
  )
  let solvedW = 1.2
  if (hitLeft && hitRight) {
    solvedW = Math.hypot(hitRight.x - hitLeft.x, hitRight.y - hitLeft.y) * 1.28
  }

  return {
    baseX: Number(hitFoot.x.toFixed(2)),
    baseY: Number(hitFoot.y.toFixed(2)),
    width: Math.max(0.25, Math.min(10, Number(solvedW.toFixed(2)))),
    height: Math.max(0.25, Math.min(10, Number((solvedH * 1.08).toFixed(2))))
  }
}

/**
 * Generates an alpha-masked THREE.CanvasTexture for a 3D Cutout Billboard where only pixels
 * inside `polygonRel` are opaque (with soft edge feathering) and outside pixels have alpha = 0.
 */
function createBillboardAlphaMaskedTexture(
  sourceImg: HTMLImageElement | HTMLCanvasElement,
  polygonRel: Point2D[],
  featherPx: number,
  maxSide = 768
): THREE.CanvasTexture | null {
  const srcW =
    'naturalWidth' in sourceImg
      ? sourceImg.naturalWidth || sourceImg.width
      : sourceImg.width
  const srcH =
    'naturalHeight' in sourceImg
      ? sourceImg.naturalHeight || sourceImg.height
      : sourceImg.height
  if (srcW <= 0 || srcH <= 0 || polygonRel.length < 3) return null

  const aspect = srcW / srcH
  const w = aspect >= 1 ? maxSide : Math.max(64, Math.round(maxSide * aspect))
  const h = aspect >= 1 ? Math.max(64, Math.round(maxSide / aspect)) : maxSide

  const maskCanvas = document.createElement('canvas')
  maskCanvas.width = w
  maskCanvas.height = h
  const mCtx = maskCanvas.getContext('2d')
  if (!mCtx) return null

  if (featherPx > 0.2) {
    mCtx.filter = `blur(${featherPx.toFixed(1)}px)`
  }
  mCtx.fillStyle = '#ffffff'
  mCtx.beginPath()
  polygonRel.forEach((pt, idx) => {
    const px = pt.x * w
    const py = pt.y * h
    if (idx === 0) mCtx.moveTo(px, py)
    else mCtx.lineTo(px, py)
  })
  mCtx.closePath()
  mCtx.fill()
  mCtx.filter = 'none'

  // Composite photo through the feathered polygon alpha mask
  mCtx.globalCompositeOperation = 'source-in'
  mCtx.drawImage(sourceImg, 0, 0, w, h)

  const tex = new THREE.CanvasTexture(maskCanvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  return tex
}

/**
 * Synthesizes an Occlusion-Inpainted Background Texture for the 3D Room Shell (Floor + Walls)
 * by masking out all foreground 3D Blockout Volumes and 3D Cutout Billboards and healing the
 * occluded region via 4-way scanline boundary extrapolation + multi-pass harmonic relaxation.
 */
function createOcclusionInpaintedBackgroundTexture(
  sourceImg: HTMLImageElement | HTMLCanvasElement,
  config: SceneBlockoutConfig,
  cameraParameters: CameraParameters,
  maxSide = 512
): THREE.CanvasTexture | null {
  const srcW =
    'naturalWidth' in sourceImg
      ? sourceImg.naturalWidth || sourceImg.width
      : sourceImg.width
  const srcH =
    'naturalHeight' in sourceImg
      ? sourceImg.naturalHeight || sourceImg.height
      : sourceImg.height
  if (srcW <= 0 || srcH <= 0) return null

  const aspect = srcW / srcH
  const w = aspect >= 1 ? maxSide : Math.max(64, Math.round(maxSide * aspect))
  const h = aspect >= 1 ? Math.max(64, Math.round(maxSide / aspect)) : maxSide

  // 1. Rasterize projected foreground 3D Boxes & 3D Billboards into a 2D mask canvas
  const maskCanvas = document.createElement('canvas')
  maskCanvas.width = w
  maskCanvas.height = h
  const mCtx = maskCanvas.getContext('2d')
  if (!mCtx) return null

  mCtx.fillStyle = '#000000'
  mCtx.fillRect(0, 0, w, h)
  mCtx.fillStyle = '#ffffff'

  const fillQuad = (pts: Point2D[]) => {
    if (pts.length < 3) return
    mCtx.beginPath()
    pts.forEach((p, idx) => {
      const px = p.x * w
      const py = p.y * h
      if (idx === 0) mCtx.moveTo(px, py)
      else mCtx.lineTo(px, py)
    })
    mCtx.closePath()
    mCtx.fill()
  }

  // Mask all 6 faces of each 3D Blockout Volume
  config.volumes.forEach((vol) => {
    const proj = computeProjectedBlockoutVolumeHandles(vol, cameraParameters)
    const b = proj.bottomCorners
    const t = proj.topCorners
    fillQuad(b)
    fillQuad(t)
    fillQuad([b[0], b[1], t[1], t[0]])
    fillQuad([b[1], b[2], t[2], t[1]])
    fillQuad([b[2], b[3], t[3], t[2]])
    fillQuad([b[3], b[0], t[0], t[3]])
  })

  // Mask all active 3D Cutout Billboards
  if (config.billboardsEnabled) {
    config.billboards.forEach((bb) => {
      fillQuad(bb.polygonRel)
    })
  }

  // Mask active Option 1: 2-Click 3D Swept Rails & Pipes
  if (config.sweptRailsEnabled) {
    mCtx.strokeStyle = '#ffffff'
    mCtx.lineCap = 'round'
    config.sweptRails.forEach((rail) => {
      const strokeW = Math.max(6, Math.round(rail.radius * 260 * (w / 600)))
      mCtx.lineWidth = strokeW
      mCtx.beginPath()
      mCtx.moveTo(rail.p1Rel.x * w, rail.p1Rel.y * h)
      mCtx.lineTo(rail.p2Rel.x * w, rail.p2Rel.y * h)
      mCtx.stroke()
    })
  }

  // Mask active Option 2: Wall-Parallel Offset Cutout Layers
  if (config.wallCutoutsEnabled) {
    config.wallCutouts.forEach((wc) => {
      fillQuad(wc.quadRel)
    })
  }

  // Mask active Option 4: 3-Sweep Columns / Pillars
  if (config.sweptColumnsEnabled) {
    config.sweptColumns.forEach((col) => {
      const halfSpanX = Math.max(
        0.015,
        0.55 * Math.abs(col.baseRightRel.x - col.baseLeftRel.x)
      )
      const midBaseX = 0.5 * (col.baseLeftRel.x + col.baseRightRel.x)
      const baseY = 0.5 * (col.baseLeftRel.y + col.baseRightRel.y)
      fillQuad([
        { x: col.topCenterRel.x - halfSpanX, y: col.topCenterRel.y },
        { x: col.topCenterRel.x + halfSpanX, y: col.topCenterRel.y },
        { x: midBaseX + halfSpanX, y: baseY },
        { x: midBaseX - halfSpanX, y: baseY }
      ])
    })
  }

  const maskData = mCtx.getImageData(0, 0, w, h).data
  const rawMask = new Uint8Array(w * h)
  let hasAnyMasked = false
  for (let i = 0; i < w * h; i++) {
    if (maskData[i * 4] > 64) {
      rawMask[i] = 1
      hasAnyMasked = true
    }
  }
  if (!hasAnyMasked) return null

  // 2. Separable morphological dilation by config.inpaintDilationPx (scaled to canvas size)
  const dilateR = Math.max(
    1,
    Math.min(18, Math.round((config.inpaintDilationPx * w) / 900))
  )
  const horizMask = new Uint8Array(w * h)
  const mask = new Uint8Array(w * h)

  for (let y = 0; y < h; y++) {
    const row = y * w
    for (let x = 0; x < w; x++) {
      let on = 0
      const x0 = Math.max(0, x - dilateR)
      const x1 = Math.min(w - 1, x + dilateR)
      for (let kx = x0; kx <= x1; kx++) {
        if (rawMask[row + kx]) {
          on = 1
          break
        }
      }
      horizMask[row + x] = on
    }
  }

  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - dilateR)
    const y1 = Math.min(h - 1, y + dilateR)
    for (let x = 0; x < w; x++) {
      let on = 0
      for (let ky = y0; ky <= y1; ky++) {
        if (horizMask[ky * w + x]) {
          on = 1
          break
        }
      }
      mask[y * w + x] = on
    }
  }

  // 3. Draw original image and perform 4-way directional scanline boundary interpolation
  const imgCanvas = document.createElement('canvas')
  imgCanvas.width = w
  imgCanvas.height = h
  const ctx = imgCanvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(sourceImg, 0, 0, w, h)
  const imgData = ctx.getImageData(0, 0, w, h)
  const data = imgData.data

  // Precompute nearest unmasked left/right per row and top/bottom per col
  const leftBoundX = new Int16Array(w * h).fill(-1)
  const rightBoundX = new Int16Array(w * h).fill(-1)
  const topBoundY = new Int16Array(w * h).fill(-1)
  const botBoundY = new Int16Array(w * h).fill(-1)

  for (let y = 0; y < h; y++) {
    const row = y * w
    let lastValidX = -1
    for (let x = 0; x < w; x++) {
      if (!mask[row + x]) lastValidX = x
      else leftBoundX[row + x] = lastValidX
    }
    lastValidX = -1
    for (let x = w - 1; x >= 0; x--) {
      if (!mask[row + x]) lastValidX = x
      else rightBoundX[row + x] = lastValidX
    }
  }

  for (let x = 0; x < w; x++) {
    let lastValidY = -1
    for (let y = 0; y < h; y++) {
      const idx = y * w + x
      if (!mask[idx]) lastValidY = y
      else topBoundY[idx] = lastValidY
    }
    lastValidY = -1
    for (let y = h - 1; y >= 0; y--) {
      const idx = y * w + x
      if (!mask[idx]) lastValidY = y
      else botBoundY[idx] = lastValidY
    }
  }

  // Initialize masked pixels with inverse-distance weighted boundary colors
  for (let y = 0; y < h; y++) {
    const row = y * w
    for (let x = 0; x < w; x++) {
      const idx = row + x
      if (!mask[idx]) continue

      let rSum = 0
      let gSum = 0
      let bSum = 0
      let wSum = 0

      const lx = leftBoundX[idx]
      if (lx >= 0) {
        const d = x - lx
        const wt = 1 / Math.pow(d + 1, 1.75)
        const pIdx = (row + lx) * 4
        rSum += data[pIdx] * wt
        gSum += data[pIdx + 1] * wt
        bSum += data[pIdx + 2] * wt
        wSum += wt
      }

      const rx = rightBoundX[idx]
      if (rx >= 0) {
        const d = rx - x
        const wt = 1 / Math.pow(d + 1, 1.75)
        const pIdx = (row + rx) * 4
        rSum += data[pIdx] * wt
        gSum += data[pIdx + 1] * wt
        bSum += data[pIdx + 2] * wt
        wSum += wt
      }

      const ty = topBoundY[idx]
      if (ty >= 0) {
        const d = y - ty
        const wt = 1 / Math.pow(d + 1, 1.75)
        const pIdx = (ty * w + x) * 4
        rSum += data[pIdx] * wt
        gSum += data[pIdx + 1] * wt
        bSum += data[pIdx + 2] * wt
        wSum += wt
      }

      const by = botBoundY[idx]
      if (by >= 0) {
        const d = by - y
        const wt = 1 / Math.pow(d + 1, 1.75)
        const pIdx = (by * w + x) * 4
        rSum += data[pIdx] * wt
        gSum += data[pIdx + 1] * wt
        bSum += data[pIdx + 2] * wt
        wSum += wt
      }

      if (wSum > 0) {
        data[idx * 4] = Math.round(rSum / wSum)
        data[idx * 4 + 1] = Math.round(gSum / wSum)
        data[idx * 4 + 2] = Math.round(bSum / wSum)
      }
    }
  }

  // 4. Multi-scale Gauss-Seidel harmonic relaxation inside the masked region
  const steps = [4, 2, 1, 1]
  for (const step of steps) {
    for (let pass = 0; pass < 3; pass++) {
      for (let y = step; y < h - step; y++) {
        const row = y * w
        for (let x = step; x < w - step; x++) {
          const idx = row + x
          if (!mask[idx]) continue
          const iL = (row + (x - step)) * 4
          const iR = (row + (x + step)) * 4
          const iT = ((y - step) * w + x) * 4
          const iB = ((y + step) * w + x) * 4
          const p = idx * 4
          data[p] = (data[iL] + data[iR] + data[iT] + data[iB]) >> 2
          data[p + 1] =
            (data[iL + 1] + data[iR + 1] + data[iT + 1] + data[iB + 1]) >> 2
          data[p + 2] =
            (data[iL + 2] + data[iR + 2] + data[iT + 2] + data[iB + 2]) >> 2
        }
      }
    }
  }

  ctx.putImageData(imgData, 0, 0)
  const tex = new THREE.CanvasTexture(imgCanvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  return tex
}

/**
 * Builds the subdivided 3D Room Shell + Extruded 3D Volumes + 3D Cutout Billboards
 * with baked camera-projected UVs and optional Background Occlusion Inpainting.
 */
export function buildReconstructedSceneGroup(
  rawConfig: SceneBlockoutConfig,
  cameraParameters: CameraParameters,
  photoTexture: THREE.Texture | null
): THREE.Group {
  const rootGroup = new THREE.Group()
  rootGroup.name = 'fSpy_Reconstructed_Scene'

  // Upgrade #4: Expand any repeated 3D Boxes (`repeatCount > 1`) and Wall Reliefs/Portals (`repeatCount > 1`)
  // into virtual instances so Room Shell portal hole-punching, baseboard doorway clipping, and 3D meshes all include repeated clones
  const expandedVolumes: BlockoutVolume[] = []
  for (const vol of rawConfig.volumes) {
    expandedVolumes.push(vol)
    const count = Math.max(1, Math.min(10, Math.round(vol.repeatCount ?? 1)))
    const spacing = vol.repeatSpacing ?? 1.8
    const axis = vol.repeatAxis ?? 'y'
    if (count > 1 && Math.abs(spacing) >= 1e-3) {
      for (let k = 1; k < count; k++) {
        const shift = k * spacing
        expandedVolumes.push({
          ...vol,
          id: `${vol.id}_clone_${k}`,
          name: `${vol.name} Copy ${k + 1}`,
          offsetX: vol.offsetX + (axis === 'x' ? shift : 0),
          offsetY: vol.offsetY + (axis === 'y' ? shift : 0),
          offsetZ: vol.offsetZ + (axis === 'z' ? shift : 0),
          repeatCount: 1
        })
      }
    }
  }

  const expandedWallReliefs: WallReliefExtrusion[] = []
  if (rawConfig.wallReliefsEnabled) {
    for (const rel of rawConfig.wallReliefs) {
      expandedWallReliefs.push(rel)
      const count = Math.max(1, Math.min(10, Math.round(rel.repeatCount ?? 1)))
      const spacing = rel.repeatSpacing ?? 1.8
      if (count > 1 && Math.abs(spacing) >= 1e-3) {
        const hits = rel.quadRel.map((pt) =>
          unprojectRelativePointToHostWall(pt, rel.hostWall, 0, rawConfig, cameraParameters)
        )
        if (!hits.some((h) => !h)) {
          const [h0, h1, h2, h3] = hits as NonNullable<(typeof hits)[0]>[]
          const dx = h2.x - h3.x
          const dy = h2.y - h3.y
          const dz = h2.z - h3.z
          const len = Math.hypot(dx, dy, dz)
          if (len > 1e-4) {
            const ux = dx / len
            const uy = dy / len
            const uz = dz / len
            for (let k = 1; k < count; k++) {
              const shift = k * spacing
              const shiftedQuad = [h0, h1, h2, h3].map((h) =>
                projectBlockoutPointToRelative(
                  {
                    x: h.x + ux * shift,
                    y: h.y + uy * shift,
                    z: h.z + uz * shift
                  },
                  cameraParameters
                )
              ) as [Point2D, Point2D, Point2D, Point2D]
              expandedWallReliefs.push({
                ...rel,
                id: `${rel.id}_clone_${k}`,
                name: `${rel.name} Copy ${k + 1}`,
                quadRel: shiftedQuad,
                repeatCount: 1
              })
            }
          }
        }
      }
    }
  }

  const config: SceneBlockoutConfig = {
    ...rawConfig,
    volumes: expandedVolumes,
    wallReliefs: rawConfig.wallReliefsEnabled ? expandedWallReliefs : rawConfig.wallReliefs
  }

  const baseScale = computeSceneBaseScale(cameraParameters)
  const sourceImageEl =
    photoTexture?.image &&
    (photoTexture.image instanceof HTMLImageElement ||
      photoTexture.image instanceof HTMLCanvasElement)
      ? photoTexture.image
      : null

  // Optional Background De-Ghosting (Inpainted texture for Room Shell walls & floor)
  const inpaintedRoomTex =
    config.projectPhotoTexture &&
    config.inpaintOccludedBackground &&
    sourceImageEl
      ? createOcclusionInpaintedBackgroundTexture(
          sourceImageEl,
          config,
          cameraParameters
        )
      : null

  const fgSurfaceMat =
    config.projectPhotoTexture && photoTexture
      ? new THREE.MeshBasicMaterial({
          map: photoTexture,
          side: THREE.DoubleSide,
          transparent: config.surfaceOpacity < 0.99,
          opacity: config.surfaceOpacity
        })
      : new THREE.MeshStandardMaterial({
          color: 0x94a3b8,
          roughness: 0.55,
          metalness: 0.15,
          side: THREE.DoubleSide,
          transparent: config.surfaceOpacity < 0.99,
          opacity: config.surfaceOpacity
        })

  const roomSurfaceMat =
    config.projectPhotoTexture && (inpaintedRoomTex || photoTexture)
      ? new THREE.MeshBasicMaterial({
          map: inpaintedRoomTex ?? photoTexture,
          side: THREE.DoubleSide,
          transparent: config.surfaceOpacity < 0.99,
          opacity: config.surfaceOpacity
        })
      : fgSurfaceMat

  const wireMat = new THREE.LineBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.65
  })

  const selectedWireMat = new THREE.LineBasicMaterial({
    color: 0xf59e0b,
    transparent: true,
    opacity: 0.95
  })

  const billboardWireMat = new THREE.LineBasicMaterial({
    color: 0x34d399,
    transparent: true,
    opacity: 0.85
  })

  const addSubdividedPlane = (
    name: string,
    width: number,
    height: number,
    configureTransform: (mesh: THREE.Mesh) => void
  ) => {
    const geo = new THREE.PlaneGeometry(width, height, 24, 24)
    const mesh = new THREE.Mesh(geo, roomSurfaceMat)
    mesh.name = name
    mesh.castShadow = true
    mesh.receiveShadow = true
    configureTransform(mesh)
    mesh.updateMatrixWorld(true)

    // Bake world matrix into world-scaled geometry so UVs and GLB export are in world coordinates
    const worldMat = mesh.matrixWorld.clone()
    applyCameraProjectedUVsToGeometry(geo, worldMat, cameraParameters)

    if (config.wireframeOverlay) {
      const borderGeo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(width, height, 2, 2))
      const borderLines = new THREE.LineSegments(borderGeo, wireMat)
      borderLines.name = `${name}_Wireframe`
      mesh.add(borderLines)
    }

    return mesh
  }

  // 1. Room Shell (Floor Z=0 + Walls — uses inpainted de-ghosted texture when enabled)
  if (config.roomShellType !== 'none') {
    const roomGroup = new THREE.Group()
    roomGroup.name = 'Room_Shell'
    const wx = config.roomWidthX * baseScale
    const dy = config.roomDepthY * baseScale
    const hz = config.roomHeightZ * baseScale
    const ox = config.roomOffsetX * baseScale
    const oy = config.roomOffsetY * baseScale

    const buildCeilingMeshForRoom = (centerX: number) => {
      const profile = config.ceilingProfile ?? 'flat'
      const vaultRise = Math.max(0.1, config.ceilingVaultRise ?? 0.65) * baseScale

      if (profile === 'flat') {
        const ceiling = addSubdividedPlane('Room_Ceiling_Flat', wx, dy, (m) => {
          m.position.set(centerX, oy + dy * 0.5, hz)
        })
        roomGroup.add(ceiling)
      } else {
        // Build subdivided 3D Barrel-Vault or Pitched-Gable Roof surface
        const segsX = 24
        const segsY = 20
        const pos: number[] = []
        const idx: number[] = []
        const wirePts: THREE.Vector3[] = []

        const evalCeilingZ = (u: number) => {
          // u in [-1, 1] across width X
          if (profile === 'barrel-vault') {
            return hz + vaultRise * Math.sqrt(Math.max(0, 1 - u * u))
          }
          // 'pitched-gable'
          return hz + vaultRise * (1 - Math.abs(u))
        }

        for (let iy = 0; iy <= segsY; iy++) {
          const vy = iy / segsY
          const yCoord = oy + vy * dy
          for (let ix = 0; ix <= segsX; ix++) {
            const u = (ix / segsX) * 2 - 1
            const xCoord = centerX + u * (wx * 0.5)
            const zCoord = evalCeilingZ(u)
            pos.push(xCoord, yCoord, zCoord)
          }
        }

        const stride = segsX + 1
        for (let iy = 0; iy < segsY; iy++) {
          for (let ix = 0; ix < segsX; ix++) {
            const a = iy * stride + ix
            const b = a + 1
            const c = a + stride
            const d = c + 1
            idx.push(a, b, d, a, d, c)
          }
        }

        // Front & back arch wireframe profiles + ridge line
        for (const endY of [oy, oy + dy]) {
          for (let ix = 0; ix < segsX; ix++) {
            const u0 = (ix / segsX) * 2 - 1
            const u1 = ((ix + 1) / segsX) * 2 - 1
            wirePts.push(
              new THREE.Vector3(centerX + u0 * wx * 0.5, endY, evalCeilingZ(u0)),
              new THREE.Vector3(centerX + u1 * wx * 0.5, endY, evalCeilingZ(u1))
            )
          }
        }
        wirePts.push(
          new THREE.Vector3(centerX, oy, evalCeilingZ(0)),
          new THREE.Vector3(centerX, oy + dy, evalCeilingZ(0))
        )

        const vaultGeo = new THREE.BufferGeometry()
        vaultGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
        vaultGeo.setIndex(idx)
        vaultGeo.computeVertexNormals()

        const vaultMesh = new THREE.Mesh(vaultGeo, roomSurfaceMat)
        vaultMesh.name =
          profile === 'barrel-vault'
            ? 'Room_Ceiling_Barrel_Vault'
            : 'Room_Ceiling_Pitched_Gable'
        vaultMesh.updateMatrixWorld(true)
        applyCameraProjectedUVsToGeometry(
          vaultGeo,
          vaultMesh.matrixWorld,
          cameraParameters
        )

        if (config.wireframeOverlay && wirePts.length >= 2) {
          const wGeo = new THREE.BufferGeometry().setFromPoints(wirePts)
          vaultMesh.add(new THREE.LineSegments(wGeo, wireMat))
        }
        roomGroup.add(vaultMesh)
      }
    }

    // Helper: Builds a Room Shell wall plane, punching topological holes (THREE.ShapeUtils.triangulateShape)
    // for any WallReliefExtrusion on `hostWall` with `passThroughPortal === true`.
    const buildWallWithOptionalPortals = (
      name: string,
      hostWall: HostWallType,
      width: number,
      height: number,
      configureTransform: (mesh: THREE.Mesh) => void
    ) => {
      const portals = config.wallReliefsEnabled
        ? config.wallReliefs.filter(
            (r) => r.hostWall === hostWall && (r.passThroughPortal ?? false)
          )
        : []

      if (portals.length === 0) {
        return addSubdividedPlane(name, width, height, configureTransform)
      }

      // Create dummy mesh to obtain world-to-local transform of the wall plane
      const dummy = new THREE.Mesh(new THREE.BufferGeometry(), roomSurfaceMat)
      configureTransform(dummy)
      dummy.updateMatrixWorld(true)
      const invMat = dummy.matrixWorld.clone().invert()

      const halfW = width * 0.5
      const halfH = height * 0.5
      const outer2D: THREE.Vector2[] = [
        new THREE.Vector2(-halfW, -halfH),
        new THREE.Vector2(halfW, -halfH),
        new THREE.Vector2(halfW, halfH),
        new THREE.Vector2(-halfW, halfH)
      ]

      const holes2D: THREE.Vector2[][] = []
      const holeWireSegs: THREE.Vector3[] = []

      for (const rel of portals) {
        const hits = rel.quadRel.map((pt) =>
          unprojectRelativePointToHostWall(
            pt,
            rel.hostWall,
            0,
            config,
            cameraParameters
          )
        )
        if (hits.some((h) => !h)) continue
        const [h0, h1, h2, h3] = hits as NonNullable<(typeof hits)[0]>[]
        const wPts = [h0, h1, h2, h3].map((h) =>
          new THREE.Vector3(
            h.x * baseScale,
            h.y * baseScale,
            h.z * baseScale
          ).applyMatrix4(invMat)
        )

        const archType = rel.archType ?? 'rectangular'
        const archRiseRatio = Math.max(
          0.12,
          Math.min(0.65, rel.archRiseRatio ?? 0.35)
        )
        const clampU = (u: number) =>
          Math.max(-halfW * 0.97, Math.min(halfW * 0.97, u))
        const clampV = (v: number) =>
          Math.max(-halfH * 0.98, Math.min(halfH * 0.97, v))

        const contourLocal: THREE.Vector2[] = []
        if (archType === 'rectangular') {
          // wPts: [0=TL, 1=TR, 2=BR, 3=BL]
          for (const wp of [wPts[3], wPts[2], wPts[1], wPts[0]]) {
            contourLocal.push(new THREE.Vector2(clampU(wp.x), clampV(wp.y)))
          }
        } else {
          // Arched portal contour: BL -> BR -> Right Spring -> 12 Arch steps -> Left Spring
          const springLeft = wPts[3].clone().lerp(wPts[0], 1 - archRiseRatio)
          const springRight = wPts[2].clone().lerp(wPts[1], 1 - archRiseRatio)
          const upVec = wPts[0]
            .clone()
            .sub(springLeft)
            .add(wPts[1].clone().sub(springRight))
            .multiplyScalar(0.5)

          contourLocal.push(
            new THREE.Vector2(clampU(wPts[3].x), clampV(wPts[3].y)),
            new THREE.Vector2(clampU(wPts[2].x), clampV(wPts[2].y))
          )
          const archSteps = 12
          for (let s = archSteps; s >= 0; s--) {
            const u = s / archSteps
            const x = u * 2 - 1
            const riseFactor =
              archType === 'roman-arch'
                ? Math.sqrt(Math.max(0, 1 - x * x))
                : archType === 'segmental-arch'
                  ? Math.max(0, 1 - x * x) * 0.78
                  : Math.max(0, Math.pow(1 - Math.abs(x), 0.72))
            const p = springLeft
              .clone()
              .lerp(springRight, u)
              .addScaledVector(upVec, riseFactor)
            contourLocal.push(new THREE.Vector2(clampU(p.x), clampV(p.y)))
          }
        }

        if (contourLocal.length >= 3) {
          holes2D.push(contourLocal)
          for (let k = 0; k < contourLocal.length; k++) {
            const nk = (k + 1) % contourLocal.length
            holeWireSegs.push(
              new THREE.Vector3(contourLocal[k].x, contourLocal[k].y, 0),
              new THREE.Vector3(contourLocal[nk].x, contourLocal[nk].y, 0)
            )
          }
        }
      }

      if (holes2D.length === 0) {
        return addSubdividedPlane(name, width, height, configureTransform)
      }

      const allPts2D: THREE.Vector2[] = [...outer2D]
      for (const h of holes2D) {
        allPts2D.push(...h)
      }
      const tris = THREE.ShapeUtils.triangulateShape(outer2D, holes2D)
      const pos: number[] = []
      const idx: number[] = []
      const subSteps = 6

      for (const [i0, i1, i2] of tris) {
        const v0 = allPts2D[i0]
        const v1 = allPts2D[i1]
        const v2 = allPts2D[i2]
        if (!v0 || !v1 || !v2) continue

        const gridIdx: number[][] = []
        for (let r = 0; r <= subSteps; r++) {
          const row: number[] = []
          for (let c = 0; c <= subSteps - r; c++) {
            const w1 = r / subSteps
            const w2 = c / subSteps
            const w0 = 1 - w1 - w2
            const px = v0.x * w0 + v1.x * w1 + v2.x * w2
            const py = v0.y * w0 + v1.y * w1 + v2.y * w2
            row.push(pos.length / 3)
            pos.push(px, py, 0)
          }
          gridIdx.push(row)
        }
        for (let r = 0; r < subSteps; r++) {
          for (let c = 0; c < subSteps - r; c++) {
            idx.push(gridIdx[r][c], gridIdx[r + 1][c], gridIdx[r][c + 1])
            if (c + 1 < subSteps - r) {
              idx.push(
                gridIdx[r + 1][c],
                gridIdx[r + 1][c + 1],
                gridIdx[r][c + 1]
              )
            }
          }
        }
      }

      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
      geo.setIndex(idx)
      geo.computeVertexNormals()

      const mesh = new THREE.Mesh(geo, roomSurfaceMat)
      mesh.name = name
      mesh.castShadow = true
      mesh.receiveShadow = true
      configureTransform(mesh)
      mesh.updateMatrixWorld(true)

      applyCameraProjectedUVsToGeometry(
        geo,
        mesh.matrixWorld.clone(),
        cameraParameters
      )

      if (config.wireframeOverlay) {
        const borderGeo = new THREE.EdgesGeometry(
          new THREE.PlaneGeometry(width, height, 2, 2)
        )
        mesh.add(new THREE.LineSegments(borderGeo, wireMat))
        if (holeWireSegs.length >= 2) {
          const hGeo = new THREE.BufferGeometry().setFromPoints(holeWireSegs)
          mesh.add(new THREE.LineSegments(hGeo, wireMat))
        }
      }

      return mesh
    }

    if (config.roomShellType === 'corner-stage') {
      const floor = addSubdividedPlane('Stage_Floor_XY', wx, dy, (m) => {
        m.position.set(ox + wx * 0.5, oy + dy * 0.5, 0)
      })
      const wallXZ = buildWallWithOptionalPortals(
        'Stage_Wall_XZ',
        'back-wall-xz',
        wx,
        hz,
        (m) => {
          m.rotation.x = Math.PI / 2
          m.position.set(ox + wx * 0.5, oy, hz * 0.5)
        }
      )
      const wallYZ = buildWallWithOptionalPortals(
        'Stage_Wall_YZ',
        'left-wall-yz',
        dy,
        hz,
        (m) => {
          m.rotation.x = Math.PI / 2
          m.rotation.y = Math.PI / 2
          m.position.set(ox, oy + dy * 0.5, hz * 0.5)
        }
      )
      roomGroup.add(floor, wallXZ, wallYZ)

      if (config.ceilingClosureEnabled) {
        buildCeilingMeshForRoom(ox + wx * 0.5)
      }
    } else if (config.roomShellType === 'interior-room') {
      const floor = addSubdividedPlane('Room_Floor', wx, dy, (m) => {
        m.position.set(ox, oy + dy * 0.5, 0)
      })
      const backWall = buildWallWithOptionalPortals(
        'Room_Back_Wall',
        'back-wall-xz',
        wx,
        hz,
        (m) => {
          m.rotation.x = Math.PI / 2
          m.position.set(ox, oy + dy, hz * 0.5)
        }
      )
      const leftWall = buildWallWithOptionalPortals(
        'Room_Left_Wall',
        'left-wall-yz',
        dy,
        hz,
        (m) => {
          m.rotation.x = Math.PI / 2
          m.rotation.y = Math.PI / 2
          m.position.set(ox - wx * 0.5, oy + dy * 0.5, hz * 0.5)
        }
      )
      const rightWall = buildWallWithOptionalPortals(
        'Room_Right_Wall',
        'right-wall-yz',
        dy,
        hz,
        (m) => {
          m.rotation.x = Math.PI / 2
          m.rotation.y = Math.PI / 2
          m.position.set(ox + wx * 0.5, oy + dy * 0.5, hz * 0.5)
        }
      )
      roomGroup.add(floor, backWall, leftWall, rightWall)

      if (config.ceilingClosureEnabled) {
        buildCeilingMeshForRoom(ox)
      }
    }

    // Optional 1-Click Mitered 3D Room Perimeter Baseboard, Chair-Rail & Crown Molding Sweeper
    if (config.perimeterMoldingsEnabled) {
      const moldingWireMat = new THREE.LineBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.75
      })

      interface WallPerimeterSpan {
        name: string
        hostWall: HostWallType
        pStart: THREE.Vector3
        pEnd: THREE.Vector3
        inwardNormal: THREE.Vector3
        miterStart: boolean
        miterEnd: boolean
      }

      const wallSpans: WallPerimeterSpan[] =
        config.roomShellType === 'corner-stage'
          ? [
              {
                name: 'LeftWall',
                hostWall: 'left-wall-yz',
                pStart: new THREE.Vector3(ox, oy + dy, 0),
                pEnd: new THREE.Vector3(ox, oy, 0),
                inwardNormal: new THREE.Vector3(1, 0, 0),
                miterStart: false,
                miterEnd: true
              },
              {
                name: 'BackWall',
                hostWall: 'back-wall-xz',
                pStart: new THREE.Vector3(ox, oy, 0),
                pEnd: new THREE.Vector3(ox + wx, oy, 0),
                inwardNormal: new THREE.Vector3(0, 1, 0),
                miterStart: true,
                miterEnd: false
              }
            ]
          : [
              {
                name: 'LeftWall',
                hostWall: 'left-wall-yz',
                pStart: new THREE.Vector3(ox - wx * 0.5, oy, 0),
                pEnd: new THREE.Vector3(ox - wx * 0.5, oy + dy, 0),
                inwardNormal: new THREE.Vector3(1, 0, 0),
                miterStart: false,
                miterEnd: true
              },
              {
                name: 'BackWall',
                hostWall: 'back-wall-xz',
                pStart: new THREE.Vector3(ox - wx * 0.5, oy + dy, 0),
                pEnd: new THREE.Vector3(ox + wx * 0.5, oy + dy, 0),
                inwardNormal: new THREE.Vector3(0, -1, 0),
                miterStart: true,
                miterEnd: true
              },
              {
                name: 'RightWall',
                hostWall: 'right-wall-yz',
                pStart: new THREE.Vector3(ox + wx * 0.5, oy + dy, 0),
                pEnd: new THREE.Vector3(ox + wx * 0.5, oy, 0),
                inwardNormal: new THREE.Vector3(-1, 0, 0),
                miterStart: true,
                miterEnd: false
              }
            ]

      // Compute doorway/portal intervals [t0, t1] along a wall span so baseboards/chair rails pause at doors
      const getClippedIntervalsForWall = (
        span: WallPerimeterSpan,
        bandZMin: number,
        bandZMax: number
      ): { t0: number; t1: number; m0: boolean; m1: boolean }[] => {
        if (!config.clipMoldingsAtPortals || !config.wallReliefsEnabled) {
          return [
            {
              t0: 0,
              t1: 1,
              m0: span.miterStart,
              m1: span.miterEnd
            }
          ]
        }

        const spanVec = span.pEnd.clone().sub(span.pStart)
        const spanLen = spanVec.length()
        if (spanLen < 1e-4) return []
        const spanDir = spanVec.clone().divideScalar(spanLen)

        const cuts: [number, number][] = []
        for (const rel of config.wallReliefs) {
          if (rel.hostWall !== span.hostWall) continue
          if (!(rel.passThroughPortal ?? false) && rel.extrudeDepth >= -0.02) {
            continue
          }
          const hits = rel.quadRel.map((pt) =>
            unprojectRelativePointToHostWall(
              pt,
              rel.hostWall,
              0,
              config,
              cameraParameters
            )
          )
          if (hits.some((h) => !h)) continue
          const validHits = hits as NonNullable<(typeof hits)[0]>[]
          const zVals = validHits.map((h) => h.z * baseScale)
          const rZMin = Math.min(...zVals)
          const rZMax = Math.max(...zVals)
          if (rZMax < bandZMin || rZMin > bandZMax) continue

          const tVals = validHits.map((h) => {
            const wp = new THREE.Vector3(
              h.x * baseScale,
              h.y * baseScale,
              0
            ).sub(span.pStart)
            return wp.dot(spanDir) / spanLen
          })
          const c0 = Math.max(0, Math.min(...tVals))
          const c1 = Math.min(1, Math.max(...tVals))
          if (c1 - c0 > 0.02) {
            cuts.push([c0, c1])
          }
        }

        if (cuts.length === 0) {
          return [
            {
              t0: 0,
              t1: 1,
              m0: span.miterStart,
              m1: span.miterEnd
            }
          ]
        }

        cuts.sort((a, b) => a[0] - b[0])
        const intervals: {
          t0: number
          t1: number
          m0: boolean
          m1: boolean
        }[] = []
        let cursor = 0
        for (const [c0, c1] of cuts) {
          if (c0 - cursor > 0.03) {
            intervals.push({
              t0: cursor,
              t1: c0,
              m0: cursor === 0 && span.miterStart,
              m1: false
            })
          }
          cursor = Math.max(cursor, c1)
        }
        if (1 - cursor > 0.03) {
          intervals.push({
            t0: cursor,
            t1: 1,
            m0: cursor === 0 && span.miterStart,
            m1: span.miterEnd
          })
        }
        return intervals
      }

      // Sweeps a 2D cross-section profile (array of [zOffset, normalProjection]) along a wall interval with 45-deg miters
      const buildMiteredProfileSweep = (
        meshName: string,
        span: WallPerimeterSpan,
        t0: number,
        t1: number,
        miter0: boolean,
        miter1: boolean,
        profilePts: [number, number][]
      ) => {
        const pA = span.pStart.clone().lerp(span.pEnd, t0)
        const pB = span.pStart.clone().lerp(span.pEnd, t1)
        const tangent = pB.clone().sub(pA).normalize()
        const nVec = span.inwardNormal.clone().normalize()

        const segsAlong = 14
        const numProf = profilePts.length
        const pos: number[] = []
        const idx: number[] = []
        const wirePts: THREE.Vector3[] = []

        for (let ia = 0; ia <= segsAlong; ia++) {
          const u = ia / segsAlong
          for (let ip = 0; ip < numProf; ip++) {
            const [zWorld, dWorld] = profilePts[ip]
            // At a 90-degree inside room corner, shifting the start endpoint by +dWorld along tangent
            // and the end endpoint by -dWorld along tangent produces an exact 45-degree miter joint!
            const startA = pA
              .clone()
              .addScaledVector(nVec, dWorld)
              .addScaledVector(tangent, miter0 ? dWorld : 0)
            startA.z = zWorld

            const endB = pB
              .clone()
              .addScaledVector(nVec, dWorld)
              .addScaledVector(tangent, miter1 ? -dWorld : 0)
            endB.z = zWorld

            const vtx = startA.lerp(endB, u)
            pos.push(vtx.x, vtx.y, vtx.z)
          }
        }

        for (let ia = 0; ia < segsAlong; ia++) {
          for (let ip = 0; ip < numProf - 1; ip++) {
            const a = ia * numProf + ip
            const b = (ia + 1) * numProf + ip
            const c = a + 1
            const d = b + 1
            idx.push(a, b, d, a, d, c)
          }
        }

        // Key longitudinal wireframe lines
        for (let ip = 0; ip < numProf; ip++) {
          const [zWorld, dWorld] = profilePts[ip]
          const sPt = pA
            .clone()
            .addScaledVector(nVec, dWorld)
            .addScaledVector(tangent, miter0 ? dWorld : 0)
          sPt.z = zWorld
          const ePt = pB
            .clone()
            .addScaledVector(nVec, dWorld)
            .addScaledVector(tangent, miter1 ? -dWorld : 0)
          ePt.z = zWorld
          wirePts.push(sPt, ePt)
        }

        const geo = new THREE.BufferGeometry()
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
        geo.setIndex(idx)
        geo.computeVertexNormals()

        const mMesh = new THREE.Mesh(geo, roomSurfaceMat)
        mMesh.name = meshName
        mMesh.updateMatrixWorld(true)
        applyCameraProjectedUVsToGeometry(
          geo,
          mMesh.matrixWorld,
          cameraParameters
        )
        if (config.wireframeOverlay && wirePts.length >= 2) {
          const wGeo = new THREE.BufferGeometry().setFromPoints(wirePts)
          mMesh.add(new THREE.LineSegments(wGeo, moldingWireMat))
        }
        roomGroup.add(mMesh)
      }

      for (const span of wallSpans) {
        // 1) Baseboard / Skirting / Tall Wainscot
        if (config.baseboardEnabled) {
          const bh = Math.max(0.04, config.baseboardHeight ?? 0.15) * baseScale
          const bd = Math.max(0.01, config.baseboardDepth ?? 0.035) * baseScale
          const bProf: [number, number][] =
            config.baseboardProfile === 'beveled-plinth'
              ? [
                  [0, 0],
                  [0, bd],
                  [bh * 0.78, bd],
                  [bh, 0]
                ]
              : config.baseboardProfile === 'tall-wainscot'
                ? [
                    [0, 0],
                    [0, bd * 1.15],
                    [bh * 0.22, bd * 1.15],
                    [bh * 0.25, bd * 0.65],
                    [bh * 0.88, bd * 0.65],
                    [bh * 0.92, bd * 1.25],
                    [bh, bd * 1.25],
                    [bh, 0]
                  ]
                : [
                    // stepped-skirting
                    [0, 0],
                    [0, bd],
                    [bh * 0.68, bd],
                    [bh * 0.72, bd * 0.55],
                    [bh, bd * 0.55],
                    [bh, 0]
                  ]

          const intervals = getClippedIntervalsForWall(span, 0, bh)
          intervals.forEach((iv, idxIv) => {
            buildMiteredProfileSweep(
              `Baseboard_${span.name}_${idxIv + 1}`,
              span,
              iv.t0,
              iv.t1,
              iv.m0,
              iv.m1,
              bProf
            )
          })
        }

        // 2) Waist-Height Chair Rail Molding
        if (config.chairRailEnabled) {
          const cz =
            Math.max(0.3, Math.min(config.roomHeightZ - 0.2, config.chairRailHeightZ ?? 0.95)) *
            baseScale
          const cd = Math.max(0.015, config.chairRailDepth ?? 0.04) * baseScale
          const ch = 0.075 * baseScale
          const cProf: [number, number][] = [
            [cz - ch * 0.5, 0],
            [cz - ch * 0.3, cd * 0.7],
            [cz, cd],
            [cz + ch * 0.3, cd * 0.85],
            [cz + ch * 0.5, 0]
          ]
          const intervals = getClippedIntervalsForWall(
            span,
            cz - ch * 0.5,
            cz + ch * 0.5
          )
          intervals.forEach((iv, idxIv) => {
            buildMiteredProfileSweep(
              `ChairRail_${span.name}_${idxIv + 1}`,
              span,
              iv.t0,
              iv.t1,
              iv.m0,
              iv.m1,
              cProf
            )
          })
        }

        // 3) Ceiling Crown Molding / Cornice / LED Cove Tray
        if (config.crownMoldingEnabled) {
          const dropH =
            Math.max(0.05, config.crownDropHeight ?? 0.16) * baseScale
          const projD =
            Math.max(0.03, config.crownProjection ?? 0.12) * baseScale
          const crownProf: [number, number][] =
            config.crownProfile === 'stepped-coving'
              ? [
                  [hz - dropH, 0],
                  [hz - dropH, projD * 0.35],
                  [hz - dropH * 0.5, projD * 0.35],
                  [hz - dropH * 0.5, projD * 0.7],
                  [hz, projD],
                  [hz, 0]
                ]
              : config.crownProfile === 'led-cove-tray'
                ? [
                    [hz - dropH, 0],
                    [hz - dropH, projD],
                    [hz - dropH * 0.65, projD],
                    [hz - dropH * 0.65, projD * 0.35],
                    [hz, projD * 0.35],
                    [hz, 0]
                  ]
                : [
                    // ogee-cornice
                    [hz - dropH, 0],
                    [hz - dropH * 0.85, projD * 0.28],
                    [hz - dropH * 0.55, projD * 0.42],
                    [hz - dropH * 0.25, projD * 0.78],
                    [hz, projD],
                    [hz, 0]
                  ]

          buildMiteredProfileSweep(
            `CrownMolding_${span.name}`,
            span,
            0,
            1,
            span.miterStart,
            span.miterEnd,
            crownProf
          )
        }
      }
    }

    // Optional 3D Overhead Ceiling Cross-Beams / Vault Ribs
    if (
      config.ceilingClosureEnabled &&
      config.ceilingBeamCount > 0 &&
      config.ceilingBeamDrop > 0.01
    ) {
      const beamCount = Math.min(10, Math.max(1, Math.round(config.ceilingBeamCount)))
      const beamDrop = Math.max(0.03, config.ceilingBeamDrop) * baseScale
      const beamThickY = Math.max(0.08, Math.min(0.32, config.ceilingBeamDrop * 0.9)) * baseScale
      const centerX =
        config.roomShellType === 'corner-stage' ? ox + wx * 0.5 : ox
      const profile = config.ceilingProfile ?? 'flat'
      const vaultRise = Math.max(0.1, config.ceilingVaultRise ?? 0.65) * baseScale

      for (let bIdx = 0; bIdx < beamCount; bIdx++) {
        const fracY = (bIdx + 1) / (beamCount + 1)
        const beamY = oy + dy * fracY

        if (profile === 'flat') {
          const beamGeo = new THREE.BoxGeometry(wx, beamThickY, beamDrop, 16, 4, 6)
          const beamMesh = new THREE.Mesh(beamGeo, roomSurfaceMat)
          beamMesh.name = `Ceiling_Soffit_Beam_${bIdx + 1}`
          beamMesh.position.set(centerX, beamY, hz - beamDrop * 0.5)
          beamMesh.updateMatrixWorld(true)
          applyCameraProjectedUVsToGeometry(
            beamGeo,
            beamMesh.matrixWorld,
            cameraParameters
          )

          if (config.wireframeOverlay) {
            const outGeo = new THREE.BoxGeometry(wx, beamThickY, beamDrop)
            const edges = new THREE.EdgesGeometry(outGeo)
            beamMesh.add(new THREE.LineSegments(edges, wireMat))
          }
          roomGroup.add(beamMesh)
        } else {
          // Swept 3D Curved Vault Rib or Gable Rafter Rib
          const ribPts: THREE.Vector3[] = []
          const ribSteps = 18
          for (let rs = 0; rs <= ribSteps; rs++) {
            const u = (rs / ribSteps) * 2 - 1
            const rx = centerX + u * (wx * 0.5)
            const rz =
              profile === 'barrel-vault'
                ? hz + vaultRise * Math.sqrt(Math.max(0, 1 - u * u)) - beamDrop * 0.45
                : hz + vaultRise * (1 - Math.abs(u)) - beamDrop * 0.45
            ribPts.push(new THREE.Vector3(rx, beamY, rz))
          }
          const ribCurve = new THREE.CatmullRomCurve3(ribPts)
          const ribGeo = new THREE.TubeGeometry(
            ribCurve,
            24,
            beamDrop * 0.5,
            6,
            false
          )
          const ribMesh = new THREE.Mesh(ribGeo, roomSurfaceMat)
          ribMesh.name = `Ceiling_Vault_Rib_${bIdx + 1}`
          ribMesh.updateMatrixWorld(true)
          applyCameraProjectedUVsToGeometry(
            ribGeo,
            ribMesh.matrixWorld,
            cameraParameters
          )
          roomGroup.add(ribMesh)
        }
      }
    }

    rootGroup.add(roomGroup)
  }

  // 2. Extruded 3D Blockout Volumes (Boxes)
  config.volumes.forEach((vol) => {
    const vx = Math.max(0.05, vol.widthX) * baseScale
    const vy = Math.max(0.05, vol.depthY) * baseScale
    const vz = Math.max(0.05, vol.heightZ) * baseScale

    // Subdivided BoxGeometry so projective UVs interpolate smoothly across faces
    const boxGeo = new THREE.BoxGeometry(vx, vy, vz, 14, 14, 14)
    // Shift geometry so z=0 is at the bottom of the box
    boxGeo.translate(0, 0, vz * 0.5)

    const mesh = new THREE.Mesh(boxGeo, fgSurfaceMat)
    mesh.name = vol.name.replace(/\s+/g, '_')
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.position.set(
      vol.offsetX * baseScale,
      vol.offsetY * baseScale,
      vol.offsetZ * baseScale
    )
    mesh.rotation.set(0, 0, (vol.rotationZ * Math.PI) / 180)
    mesh.updateMatrixWorld(true)

    applyCameraProjectedUVsToGeometry(boxGeo, mesh.matrixWorld, cameraParameters)

    if (config.wireframeOverlay) {
      const outlineGeo = new THREE.BoxGeometry(vx, vy, vz)
      outlineGeo.translate(0, 0, vz * 0.5)
      const edges = new THREE.EdgesGeometry(outlineGeo)
      const isSelected = vol.id === config.selectedVolumeId
      const lineSegs = new THREE.LineSegments(
        edges,
        isSelected ? selectedWireMat : wireMat
      )
      lineSegs.name = `${mesh.name}_Edges`
      mesh.add(lineSegs)
    }

    rootGroup.add(mesh)
  })

  // 3. Opt-In 3D Alpha-Masked Cutout Billboards (Standees for People, Trees, Curved Props)
  if (config.billboardsEnabled && config.billboards.length > 0) {
    const camMat = cameraParameters.cameraTransform.matrix
    const camPosX = camMat[0][3]
    const camPosY = camMat[1][3]

    config.billboards.forEach((bb) => {
      const bw = Math.max(0.1, bb.width) * baseScale
      const bh = Math.max(0.1, bb.height) * baseScale

      // Create vertical plane in XZ local space (standing upright along +Z, bottom at z=0)
      const cardGeo = new THREE.PlaneGeometry(bw, bh, 20, 20)
      cardGeo.rotateX(Math.PI / 2)
      cardGeo.translate(0, 0, bh * 0.5)

      const posX = bb.baseX * baseScale
      const posY = bb.baseY * baseScale
      const posZ = bb.baseZ * baseScale

      let cardYawRad = (bb.yawDeg * Math.PI) / 180
      if (bb.faceCamera) {
        // Rotate around vertical Z so the local normal (which points along -Y after rotateX(PI/2)) faces the camera
        const dx = camPosX - posX
        const dy = camPosY - posY
        cardYawRad = Math.atan2(dy, dx) + Math.PI / 2
      }

      const maskedTex =
        config.projectPhotoTexture && sourceImageEl
          ? createBillboardAlphaMaskedTexture(
              sourceImageEl,
              bb.polygonRel,
              bb.featherPx
            )
          : null

      const cardMat = maskedTex
        ? new THREE.MeshBasicMaterial({
            map: maskedTex,
            side: THREE.DoubleSide,
            transparent: true,
            alphaTest: 0.03
          })
        : new THREE.MeshStandardMaterial({
            color: 0x34d399,
            roughness: 0.5,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.75
          })

      const cardMesh = new THREE.Mesh(cardGeo, cardMat)
      cardMesh.name = bb.name.replace(/\s+/g, '_')
      cardMesh.position.set(posX, posY, posZ)
      cardMesh.rotation.set(0, 0, cardYawRad)
      cardMesh.updateMatrixWorld(true)

      applyCameraProjectedUVsToGeometry(
        cardGeo,
        cardMesh.matrixWorld,
        cameraParameters
      )

      if (config.wireframeOverlay) {
        const frameGeo = new THREE.PlaneGeometry(bw, bh)
        frameGeo.rotateX(Math.PI / 2)
        frameGeo.translate(0, 0, bh * 0.5)
        const edges = new THREE.EdgesGeometry(frameGeo)
        const isSelected = bb.id === config.selectedBillboardId
        const lineSegs = new THREE.LineSegments(
          edges,
          isSelected ? selectedWireMat : billboardWireMat
        )
        lineSegs.name = `${cardMesh.name}_CardFrame`
        cardMesh.add(lineSegs)
      }

      rootGroup.add(cardMesh)
    })
  }

  // 4. Architectural Option 1 (Optional): 2-Click 3D Swept Rail & Pipe Tool
  if (config.sweptRailsEnabled && config.sweptRails.length > 0) {
    const railWireMat = new THREE.LineBasicMaterial({
      color: 0xf43f5e,
      transparent: true,
      opacity: 0.85
    })

    config.sweptRails.forEach((rail) => {
      const allRelNodes = [
        rail.p1Rel,
        ...(rail.waypointsRel ?? []),
        rail.p2Rel
      ]
      const hits = allRelNodes
        .map((pt) =>
          unprojectRelativePointToHostWall(
            pt,
            rail.hostWall,
            rail.standOff,
            config,
            cameraParameters
          )
        )
        .filter((h): h is NonNullable<typeof h> => h !== null)
      if (hits.length < 2) return

      const { axisV } = resolveHostWallPlaneBlockout(rail.hostWall, config)
      const shiftDir = new THREE.Vector3(axisV.x, axisV.y, axisV.z).normalize()
      const repeatCount = Math.max(1, Math.min(10, Math.round(rail.repeatCount ?? 1)))
      const repeatSpacing = rail.repeatSpacing ?? 0.35

      for (let copyIdx = 0; copyIdx < repeatCount; copyIdx++) {
        const copyOffset = shiftDir
          .clone()
          .multiplyScalar(copyIdx * repeatSpacing * baseScale)
        const worldNodes = hits.map((h) =>
          new THREE.Vector3(
            h.x * baseScale,
            h.y * baseScale,
            h.z * baseScale
          ).add(copyOffset)
        )
        const pathMode = rail.pathMode ?? 'straight-or-elbows'
        const rWorld = Math.max(0.008, rail.radius) * baseScale
        const radialSegs =
          rail.profile === 'square-bar'
            ? 4
            : rail.profile === 'molding-bevel'
              ? 6
              : 18

        // Build 3D curve samples according to pathMode (Straight/Elbows, Smooth Spline, or Gravity Catenary Sag)
        let curve3D: THREE.Curve<THREE.Vector3>
        if (pathMode === 'catenary-sag') {
          const sagWorld = Math.max(0.02, rail.catenarySag ?? 0.22) * baseScale
          const pStart = worldNodes[0]
          const pEnd = worldNodes[worldNodes.length - 1]
          const catPts: THREE.Vector3[] = []
          const numSamples = 20
          for (let i = 0; i <= numSamples; i++) {
            const t = i / numSamples
            const pt = pStart.clone().lerp(pEnd, t)
            // Parabolic/cosh catenary sag downward along -Z
            pt.z -= sagWorld * 4 * t * (1 - t)
            catPts.push(pt)
          }
          curve3D = new THREE.CatmullRomCurve3(catPts)
        } else if (pathMode === 'smooth-spline' && worldNodes.length >= 3) {
          curve3D = new THREE.CatmullRomCurve3(worldNodes, false, 'centripetal')
        } else if (worldNodes.length === 2) {
          curve3D = new THREE.LineCurve3(worldNodes[0], worldNodes[1])
        } else {
          // Multi-segment polyline with filleted 90-degree pipe elbows at interior corners
          const filletedPts: THREE.Vector3[] = [worldNodes[0]]
          for (let i = 1; i < worldNodes.length - 1; i++) {
            const prev = worldNodes[i - 1]
            const curr = worldNodes[i]
            const next = worldNodes[i + 1]
            const dPrev = prev.distanceTo(curr)
            const dNext = next.distanceTo(curr)
            const filletDist = Math.min(rWorld * 2.5, dPrev * 0.28, dNext * 0.28)
            if (filletDist > 1e-4) {
              const pIn = curr
                .clone()
                .lerp(prev, filletDist / Math.max(1e-4, dPrev))
              const pOut = curr
                .clone()
                .lerp(next, filletDist / Math.max(1e-4, dNext))
              const pMid = pIn
                .clone()
                .add(pOut)
                .multiplyScalar(0.5)
                .lerp(curr, 0.45)
              filletedPts.push(pIn, pMid, pOut)
            } else {
              filletedPts.push(curr)
            }
          }
          filletedPts.push(worldNodes[worldNodes.length - 1])
          curve3D = new THREE.CatmullRomCurve3(filletedPts, false, 'chordal', 0.15)
        }

        const tubularSegs = Math.max(24, worldNodes.length * 18)
        const tubeGeo = new THREE.TubeGeometry(
          curve3D,
          tubularSegs,
          rWorld,
          radialSegs,
          false
        )

        const railGroup = new THREE.Group()
        railGroup.name =
          copyIdx === 0
            ? rail.name.replace(/\s+/g, '_')
            : `${rail.name.replace(/\s+/g, '_')}_Copy_${copyIdx + 1}`

        const tubeMesh = new THREE.Mesh(tubeGeo, fgSurfaceMat)
        tubeMesh.name = `${railGroup.name}_Sweep`
        tubeMesh.castShadow = true
        tubeMesh.receiveShadow = true
        tubeMesh.updateMatrixWorld(true)

        applyCameraProjectedUVsToGeometry(
          tubeGeo,
          tubeMesh.matrixWorld,
          cameraParameters
        )

        if (config.wireframeOverlay) {
          const isSel = rail.id === config.selectedSweptRailId
          const wireCurvePts = curve3D.getPoints(32)
          const wireLineGeo = new THREE.BufferGeometry().setFromPoints(
            wireCurvePts
          )
          tubeMesh.add(
            new THREE.Line(wireLineGeo, isSel ? selectedWireMat : railWireMat)
          )
        }
        railGroup.add(tubeMesh)

        // Optional 3D Wall Mount Brackets connecting the swept rail back to the host wall
        const nVec = new THREE.Vector3(
          hits[0].normal.x,
          hits[0].normal.y,
          hits[0].normal.z
        ).normalize()
        const standOffWorld = Math.max(0, rail.standOff) * baseScale
        const bCount = Math.max(0, Math.min(8, Math.round(rail.bracketCount)))

        if (bCount > 0 && standOffWorld > 1e-3) {
          for (let bi = 0; bi < bCount; bi++) {
            const t = bCount === 1 ? 0.5 : 0.08 + (0.84 * bi) / (bCount - 1)
            const railPt = curve3D.getPoint(t)
            const wallPt = railPt.clone().addScaledVector(nVec, -standOffWorld)
            const bMid = railPt.clone().add(wallPt).multiplyScalar(0.5)
            const bGeo = new THREE.CylinderGeometry(
              rWorld * 0.55,
              rWorld * 0.65,
              standOffWorld,
              8,
              4
            )
            const bMesh = new THREE.Mesh(bGeo, fgSurfaceMat)
            bMesh.name = `${railGroup.name}_Bracket_${bi + 1}`
            bMesh.position.copy(bMid)
            bMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), nVec)
            bMesh.updateMatrixWorld(true)
            applyCameraProjectedUVsToGeometry(
              bGeo,
              bMesh.matrixWorld,
              cameraParameters
            )
            railGroup.add(bMesh)
          }
        }

        rootGroup.add(railGroup)
      }
    })
  }

  // 5. Architectural Option 2 (Optional): Wall-Parallel Offset Cutout Layer (Wrought-Iron Railings / Balusters)
  if (config.wallCutoutsEnabled && config.wallCutouts.length > 0) {
    const wallCutoutWireMat = new THREE.LineBasicMaterial({
      color: 0xa855f7,
      transparent: true,
      opacity: 0.85
    })

    config.wallCutouts.forEach((wc) => {
      const hits = wc.quadRel.map((pt) =>
        unprojectRelativePointToHostWall(
          pt,
          wc.hostWall,
          wc.standOff,
          config,
          cameraParameters
        )
      )
      if (hits.some((h) => !h)) return
      const [c0, c1, c2, c3] = hits as NonNullable<(typeof hits)[0]>[]

      const gridSegs = 20
      const geo = new THREE.BufferGeometry()
      const positions: number[] = []
      const indices: number[] = []

      for (let iy = 0; iy <= gridSegs; iy++) {
        const v = iy / gridSegs
        for (let ix = 0; ix <= gridSegs; ix++) {
          const u = ix / gridSegs
          // Bilinear interpolation across [TL=c0, TR=c1, BR=c2, BL=c3]
          const topX = c0.x * (1 - u) + c1.x * u
          const topY = c0.y * (1 - u) + c1.y * u
          const topZ = c0.z * (1 - u) + c1.z * u

          const botX = c3.x * (1 - u) + c2.x * u
          const botY = c3.y * (1 - u) + c2.y * u
          const botZ = c3.z * (1 - u) + c2.z * u

          positions.push(
            (topX * (1 - v) + botX * v) * baseScale,
            (topY * (1 - v) + botY * v) * baseScale,
            (topZ * (1 - v) + botZ * v) * baseScale
          )
        }
      }

      const stride = gridSegs + 1
      for (let iy = 0; iy < gridSegs; iy++) {
        for (let ix = 0; ix < gridSegs; ix++) {
          const a = iy * stride + ix
          const b = a + 1
          const c = a + stride
          const d = c + 1
          indices.push(a, b, d, a, d, c)
        }
      }

      geo.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(positions, 3)
      )
      geo.setIndex(indices)
      geo.computeVertexNormals()

      // Create auto-keyed alpha texture so gaps between wrought-iron bars are transparent
      let cutoutTex: THREE.CanvasTexture | null = null
      if (config.projectPhotoTexture && sourceImageEl) {
        const srcW =
          'naturalWidth' in sourceImageEl
            ? sourceImageEl.naturalWidth || sourceImageEl.width
            : sourceImageEl.width
        const srcH =
          'naturalHeight' in sourceImageEl
            ? sourceImageEl.naturalHeight || sourceImageEl.height
            : sourceImageEl.height
        if (srcW > 0 && srcH > 0) {
          const maxSide = 768
          const aspect = srcW / srcH
          const tw =
            aspect >= 1 ? maxSide : Math.max(64, Math.round(maxSide * aspect))
          const th =
            aspect >= 1 ? Math.max(64, Math.round(maxSide / aspect)) : maxSide
          const cnv = document.createElement('canvas')
          cnv.width = tw
          cnv.height = th
          const ctx = cnv.getContext('2d')
          if (ctx) {
            if (wc.featherPx > 0.2) {
              ctx.filter = `blur(${wc.featherPx.toFixed(1)}px)`
            }
            ctx.fillStyle = '#ffffff'
            ctx.beginPath()
            wc.quadRel.forEach((pt, idx) => {
              if (idx === 0) ctx.moveTo(pt.x * tw, pt.y * th)
              else ctx.lineTo(pt.x * tw, pt.y * th)
            })
            ctx.closePath()
            ctx.fill()
            ctx.filter = 'none'
            ctx.globalCompositeOperation = 'source-in'
            ctx.drawImage(sourceImageEl, 0, 0, tw, th)

            if (wc.alphaMode !== 'full-strip') {
              const imgData = ctx.getImageData(0, 0, tw, th)
              const d = imgData.data
              const luma = new Float32Array(tw * th)
              for (let i = 0; i < tw * th; i++) {
                luma[i] =
                  (0.299 * d[i * 4] +
                    0.587 * d[i * 4 + 1] +
                    0.114 * d[i * 4 + 2]) /
                  255
              }
              const thresh = wc.threshold
              for (let y = 2; y < th - 2; y++) {
                for (let x = 2; x < tw - 2; x++) {
                  const idx = y * tw + x
                  const p = idx * 4
                  if (d[p + 3] < 8) continue
                  const L = luma[idx]
                  let keepAlpha = 1
                  if (wc.alphaMode === 'dark-bars') {
                    // Keep pixels darker than threshold opaque
                    keepAlpha = L <= thresh ? 1 : Math.max(0, 1 - (L - thresh) * 6)
                  } else if (wc.alphaMode === 'bright-bars') {
                    // Keep pixels brighter than threshold opaque
                    keepAlpha = L >= thresh ? 1 : Math.max(0, 1 - (thresh - L) * 6)
                  } else if (wc.alphaMode === 'edge-contrast') {
                    // Compare against 5x5 local neighborhood + gradient magnitude
                    const localMean =
                      0.25 *
                      (luma[(y - 2) * tw + x] +
                        luma[(y + 2) * tw + x] +
                        luma[y * tw + (x - 2)] +
                        luma[y * tw + (x + 2)])
                    const diff = Math.abs(L - localMean)
                    const gx = Math.abs(luma[y * tw + (x + 1)] - luma[y * tw + (x - 1)])
                    const gy = Math.abs(luma[(y + 1) * tw + x] - luma[(y - 1) * tw + x])
                    const score = diff * 2.2 + (gx + gy) * 1.4
                    const cutoff = Math.max(0.03, (1 - thresh) * 0.28)
                    keepAlpha =
                      score >= cutoff
                        ? 1
                        : Math.max(0, score / Math.max(0.01, cutoff))
                  }
                  d[p + 3] = Math.round(d[p + 3] * keepAlpha)
                }
              }
              ctx.putImageData(imgData, 0, 0)
            }

            cutoutTex = new THREE.CanvasTexture(cnv)
            cutoutTex.colorSpace = THREE.SRGBColorSpace
            cutoutTex.needsUpdate = true
          }
        }
      }

      const wcMat = cutoutTex
        ? new THREE.MeshBasicMaterial({
            map: cutoutTex,
            side: THREE.DoubleSide,
            transparent: true,
            alphaTest: 0.04
          })
        : fgSurfaceMat

      const wcMesh = new THREE.Mesh(geo, wcMat)
      wcMesh.name = wc.name.replace(/\s+/g, '_')
      wcMesh.updateMatrixWorld(true)
      applyCameraProjectedUVsToGeometry(
        geo,
        wcMesh.matrixWorld,
        cameraParameters
      )

      if (config.wireframeOverlay) {
        const isSel = wc.id === config.selectedWallCutoutId
        const borderPts = [c0, c1, c2, c3, c0].map(
          (c) =>
            new THREE.Vector3(
              c.x * baseScale,
              c.y * baseScale,
              c.z * baseScale
            )
        )
        const lineGeo = new THREE.BufferGeometry().setFromPoints(borderPts)
        wcMesh.add(
          new THREE.Line(lineGeo, isSel ? selectedWireMat : wallCutoutWireMat)
        )
      }

      rootGroup.add(wcMesh)
    })
  }

  // 6. Architectural Option 3 (Optional): Wall Relief & Recessed Alcove Extruder (+Pop-Out Ledge / -Recessed Window)
  if (config.wallReliefsEnabled && config.wallReliefs.length > 0) {
    const reliefWireMat = new THREE.LineBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.9
    })

    const buildSubdividedQuadFace = (
      p0: THREE.Vector3,
      p1: THREE.Vector3,
      p2: THREE.Vector3,
      p3: THREE.Vector3,
      segs = 12
    ): THREE.BufferGeometry => {
      const g = new THREE.BufferGeometry()
      const pos: number[] = []
      const idx: number[] = []
      for (let iy = 0; iy <= segs; iy++) {
        const v = iy / segs
        for (let ix = 0; ix <= segs; ix++) {
          const u = ix / segs
          const tx = p0.x * (1 - u) + p1.x * u
          const ty = p0.y * (1 - u) + p1.y * u
          const tz = p0.z * (1 - u) + p1.z * u
          const bx = p3.x * (1 - u) + p2.x * u
          const by = p3.y * (1 - u) + p2.y * u
          const bz = p3.z * (1 - u) + p2.z * u
          pos.push(
            tx * (1 - v) + bx * v,
            ty * (1 - v) + by * v,
            tz * (1 - v) + bz * v
          )
        }
      }
      const stride = segs + 1
      for (let iy = 0; iy < segs; iy++) {
        for (let ix = 0; ix < segs; ix++) {
          const a = iy * stride + ix
          const b = a + 1
          const c = a + stride
          const d = c + 1
          idx.push(a, b, d, a, d, c)
        }
      }
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
      g.setIndex(idx)
      g.computeVertexNormals()
      return g
    }

    config.wallReliefs.forEach((rel) => {
      const wallHits = rel.quadRel.map((pt) =>
        unprojectRelativePointToHostWall(
          pt,
          rel.hostWall,
          0,
          config,
          cameraParameters
        )
      )
      if (wallHits.some((h) => !h)) return
      const [h0, h1, h2, h3] = wallHits as NonNullable<(typeof wallHits)[0]>[]
      const nVec = new THREE.Vector3(
        h0.normal.x,
        h0.normal.y,
        h0.normal.z
      ).normalize()
      const dWorld = rel.extrudeDepth * baseScale

      const wPts = [h0, h1, h2, h3].map(
        (h) =>
          new THREE.Vector3(h.x * baseScale, h.y * baseScale, h.z * baseScale)
      )

      const reliefGroup = new THREE.Group()
      reliefGroup.name = rel.name.replace(/\s+/g, '_')

      const archType = rel.archType ?? 'rectangular'
      const archRiseRatio = Math.max(0.12, Math.min(0.65, rel.archRiseRatio ?? 0.35))
      const isPassThrough = rel.passThroughPortal ?? false
      // When pass-through portal is enabled, jambs extrude inward through the wall thickness
      const portalWallDepth = isPassThrough
        ? -Math.max(0.15, Math.abs(rel.extrudeDepth)) * baseScale
        : dWorld
      const ePortalPts = wPts.map((wp) =>
        wp.clone().addScaledVector(nVec, portalWallDepth)
      )

      if (archType === 'rectangular') {
        const faces: [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3][] =
          [
            // Omit cap face when passThroughPortal is true so you can look straight into the annex corridor
            ...(!isPassThrough
              ? ([
                  [
                    ePortalPts[0],
                    ePortalPts[1],
                    ePortalPts[2],
                    ePortalPts[3]
                  ]
                ] as [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3][])
              : []),
            [wPts[0], wPts[1], ePortalPts[1], ePortalPts[0]],
            [ePortalPts[3], ePortalPts[2], wPts[2], wPts[3]],
            [wPts[3], wPts[0], ePortalPts[0], ePortalPts[3]],
            [wPts[1], wPts[2], ePortalPts[2], ePortalPts[1]]
          ]

        faces.forEach((fPts, fIdx) => {
          const fGeo = buildSubdividedQuadFace(
            fPts[0],
            fPts[1],
            fPts[2],
            fPts[3],
            10
          )
          const fMesh = new THREE.Mesh(fGeo, fgSurfaceMat)
          fMesh.name = `${reliefGroup.name}_Face_${fIdx + 1}`
          fMesh.updateMatrixWorld(true)
          applyCameraProjectedUVsToGeometry(
            fGeo,
            fMesh.matrixWorld,
            cameraParameters
          )
          reliefGroup.add(fMesh)
        })

        if (config.wireframeOverlay) {
          const isSel = rel.id === config.selectedWallReliefId
          const segPts: THREE.Vector3[] = [
            wPts[0], wPts[1], wPts[1], wPts[2], wPts[2], wPts[3], wPts[3], wPts[0],
            ePortalPts[0], ePortalPts[1], ePortalPts[1], ePortalPts[2], ePortalPts[2], ePortalPts[3], ePortalPts[3], ePortalPts[0],
            wPts[0], ePortalPts[0], wPts[1], ePortalPts[1], wPts[2], ePortalPts[2], wPts[3], ePortalPts[3]
          ]
          const edgeGeo = new THREE.BufferGeometry().setFromPoints(segPts)
          reliefGroup.add(
            new THREE.LineSegments(
              edgeGeo,
              isSel ? selectedWireMat : reliefWireMat
            )
          )
        }
      } else {
        // Curved 3D Arched Portal / Alcove (Roman Arch, Segmental Arch, or Pointed Gothic Arch)
        const archSegs = 16
        const springLeftW = wPts[3].clone().lerp(wPts[0], 1 - archRiseRatio)
        const springRightW = wPts[2].clone().lerp(wPts[1], 1 - archRiseRatio)
        const springLeftE = springLeftW
          .clone()
          .addScaledVector(nVec, portalWallDepth)
        const springRightE = springRightW
          .clone()
          .addScaledVector(nVec, portalWallDepth)

        const upVec = wPts[0]
          .clone()
          .sub(springLeftW)
          .add(wPts[1].clone().sub(springRightW))
          .multiplyScalar(0.5)

        const evalArchCurveFactor = (u: number): number => {
          const x = u * 2 - 1
          if (archType === 'roman-arch') {
            return Math.sqrt(Math.max(0, 1 - x * x))
          }
          if (archType === 'segmental-arch') {
            return Math.max(0, 1 - x * x) * 0.78
          }
          const absX = Math.abs(x)
          return Math.max(0, Math.pow(1 - absX, 0.72))
        }

        const archWallPts: THREE.Vector3[] = []
        const archExtrudePts: THREE.Vector3[] = []
        const wireSegPts: THREE.Vector3[] = []

        for (let i = 0; i <= archSegs; i++) {
          const u = i / archSegs
          const baseW = springLeftW.clone().lerp(springRightW, u)
          const riseFactor = evalArchCurveFactor(u)
          const ptW = baseW.addScaledVector(upVec, riseFactor)
          const ptE = ptW.clone().addScaledVector(nVec, portalWallDepth)
          archWallPts.push(ptW)
          archExtrudePts.push(ptE)
        }

        for (let i = 0; i < archSegs; i++) {
          const u0 = i / archSegs
          const u1 = (i + 1) / archSegs
          if (!isPassThrough) {
            const botE0 = ePortalPts[3].clone().lerp(ePortalPts[2], u0)
            const botE1 = ePortalPts[3].clone().lerp(ePortalPts[2], u1)
            const capStrip = buildSubdividedQuadFace(
              archExtrudePts[i],
              archExtrudePts[i + 1],
              botE1,
              botE0,
              2
            )
            const capMesh = new THREE.Mesh(capStrip, fgSurfaceMat)
            capMesh.updateMatrixWorld(true)
            applyCameraProjectedUVsToGeometry(
              capStrip,
              capMesh.matrixWorld,
              cameraParameters
            )
            reliefGroup.add(capMesh)
          }

          // Curved arch intrados/soffit strip connecting wall arch to extruded arch
          const soffitStrip = buildSubdividedQuadFace(
            archWallPts[i],
            archWallPts[i + 1],
            archExtrudePts[i + 1],
            archExtrudePts[i],
            2
          )
          const soffitMesh = new THREE.Mesh(soffitStrip, fgSurfaceMat)
          soffitMesh.updateMatrixWorld(true)
          applyCameraProjectedUVsToGeometry(
            soffitStrip,
            soffitMesh.matrixWorld,
            cameraParameters
          )
          reliefGroup.add(soffitMesh)

          wireSegPts.push(
            archWallPts[i],
            archWallPts[i + 1],
            archExtrudePts[i],
            archExtrudePts[i + 1]
          )
        }

        const jambAndSillFaces: [
          THREE.Vector3,
          THREE.Vector3,
          THREE.Vector3,
          THREE.Vector3
        ][] = [
          [ePortalPts[3], ePortalPts[2], wPts[2], wPts[3]],
          [wPts[3], springLeftW, springLeftE, ePortalPts[3]],
          [springRightW, wPts[2], ePortalPts[2], springRightE]
        ]
        jambAndSillFaces.forEach((fPts) => {
          const fGeo = buildSubdividedQuadFace(
            fPts[0],
            fPts[1],
            fPts[2],
            fPts[3],
            8
          )
          const fMesh = new THREE.Mesh(fGeo, fgSurfaceMat)
          fMesh.updateMatrixWorld(true)
          applyCameraProjectedUVsToGeometry(
            fGeo,
            fMesh.matrixWorld,
            cameraParameters
          )
          reliefGroup.add(fMesh)
        })

        if (config.wireframeOverlay) {
          const isSel = rel.id === config.selectedWallReliefId
          wireSegPts.push(
            wPts[3], springLeftW, wPts[2], springRightW, wPts[3], wPts[2],
            ePortalPts[3], springLeftE, ePortalPts[2], springRightE, ePortalPts[3], ePortalPts[2],
            wPts[3], ePortalPts[3], wPts[2], ePortalPts[2], springLeftW, springLeftE, springRightW, springRightE
          )
          const edgeGeo = new THREE.BufferGeometry().setFromPoints(wireSegPts)
          reliefGroup.add(
            new THREE.LineSegments(
              edgeGeo,
              isSel ? selectedWireMat : reliefWireMat
            )
          )
        }
      }

      // Secondary 3D Annex Room / T-Junction Corridor behind pass-through portals
      if (isPassThrough) {
        const annexLen = Math.max(0.4, rel.annexLength ?? 2.2) * baseScale
        const expandW = Math.max(0, rel.annexWidthExpand ?? 0.4) * baseScale
        const openEnd = rel.annexOpenEnd ?? false

        const horizDir = ePortalPts[2]
          .clone()
          .sub(ePortalPts[3])
          .normalize()
        const annexDepthVec = nVec.clone().multiplyScalar(-annexLen)

        const nearBL = ePortalPts[3]
          .clone()
          .addScaledVector(horizDir, -expandW)
        const nearBR = ePortalPts[2]
          .clone()
          .addScaledVector(horizDir, expandW)
        const nearTL = ePortalPts[0]
          .clone()
          .addScaledVector(horizDir, -expandW)
        const nearTR = ePortalPts[1]
          .clone()
          .addScaledVector(horizDir, expandW)

        const farBL = nearBL.clone().add(annexDepthVec)
        const farBR = nearBR.clone().add(annexDepthVec)
        const farTL = nearTL.clone().add(annexDepthVec)
        const farTR = nearTR.clone().add(annexDepthVec)

        const annexFaces: [
          THREE.Vector3,
          THREE.Vector3,
          THREE.Vector3,
          THREE.Vector3
        ][] = [
          // Annex Floor
          [nearBL, nearBR, farBR, farBL],
          // Annex Ceiling
          [nearTL, farTL, farTR, nearTR],
          // Annex Left Wall
          [nearTL, nearBL, farBL, farTL],
          // Annex Right Wall
          [nearBR, nearTR, farTR, farBR]
        ]

        // If the annex room expands wider than the doorway, seal the inner left/right step shoulders
        if (expandW > 1e-3) {
          annexFaces.push(
            [nearTL, ePortalPts[0], ePortalPts[3], nearBL],
            [ePortalPts[1], nearTR, nearBR, ePortalPts[2]]
          )
        }

        if (!openEnd) {
          annexFaces.push([farTL, farTR, farBR, farBL])
        }

        annexFaces.forEach((afPts, afIdx) => {
          const afGeo = buildSubdividedQuadFace(
            afPts[0],
            afPts[1],
            afPts[2],
            afPts[3],
            12
          )
          const afMesh = new THREE.Mesh(afGeo, roomSurfaceMat)
          afMesh.name = `${reliefGroup.name}_Annex_${afIdx + 1}`
          afMesh.updateMatrixWorld(true)
          applyCameraProjectedUVsToGeometry(
            afGeo,
            afMesh.matrixWorld,
            cameraParameters
          )
          reliefGroup.add(afMesh)
        })

        if (config.wireframeOverlay) {
          const isSel = rel.id === config.selectedWallReliefId
          const annexWirePts = [
            nearBL, nearBR, nearBR, nearTR, nearTR, nearTL, nearTL, nearBL,
            farBL, farBR, farBR, farTR, farTR, farTL, farTL, farBL,
            nearBL, farBL, nearBR, farBR, nearTL, farTL, nearTR, farTR
          ]
          const annexEdgeGeo = new THREE.BufferGeometry().setFromPoints(
            annexWirePts
          )
          reliefGroup.add(
            new THREE.LineSegments(
              annexEdgeGeo,
              isSel ? selectedWireMat : reliefWireMat
            )
          )
        }
      }

      rootGroup.add(reliefGroup)
    })
  }

  // 7. Architectural Option 4 (Optional): "3-Sweep" Cylinder & Pillar Snapper
  if (config.sweptColumnsEnabled && config.sweptColumns.length > 0) {
    const colWireMat = new THREE.LineBasicMaterial({
      color: 0xeab308,
      transparent: true,
      opacity: 0.9
    })

    config.sweptColumns.forEach((col) => {
      const solved = solveSweptColumn3D(col, cameraParameters)
      if (!solved) return

      const rWorld = solved.radius * baseScale
      const hWorld = solved.height * baseScale
      const radialSegs =
        col.profile === 'square-pillar'
          ? 4
          : col.profile === 'octagonal-pillar'
            ? 8
            : 24

      const cylGeo = new THREE.CylinderGeometry(
        rWorld,
        rWorld,
        hWorld,
        radialSegs,
        20
      )
      if (col.profile === 'square-pillar') {
        cylGeo.rotateY(Math.PI / 4)
      }
      // Rotate Y-up cylinder to Z-up fSpy world space and place base at z=0
      cylGeo.rotateX(Math.PI / 2)
      cylGeo.translate(0, 0, hWorld * 0.5)

      const colMesh = new THREE.Mesh(cylGeo, fgSurfaceMat)
      colMesh.name = col.name.replace(/\s+/g, '_')
      colMesh.position.set(
        solved.centerX * baseScale,
        solved.centerY * baseScale,
        col.baseZ * baseScale
      )
      colMesh.castShadow = true
      colMesh.receiveShadow = true
      colMesh.updateMatrixWorld(true)

      applyCameraProjectedUVsToGeometry(
        cylGeo,
        colMesh.matrixWorld,
        cameraParameters
      )

      if (config.wireframeOverlay) {
        const isSel = col.id === config.selectedSweptColumnId
        const outGeo = new THREE.CylinderGeometry(
          rWorld,
          rWorld,
          hWorld,
          radialSegs,
          2
        )
        outGeo.rotateX(Math.PI / 2)
        outGeo.translate(0, 0, hWorld * 0.5)
        const edges = new THREE.EdgesGeometry(outGeo)
        colMesh.add(
          new THREE.LineSegments(edges, isSel ? selectedWireMat : colWireMat)
        )
      }

      rootGroup.add(colMesh)
    })
  }

  // 8. Architectural Option 5 (Optional): Parametric 3D Staircase & Sloped Ramp Generator
  if (config.staircasesEnabled && config.staircases.length > 0) {
    const stairWireMat = new THREE.LineBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.9
    })

    const appendSubdividedQuad = (
      positions: number[],
      indices: number[],
      p0: THREE.Vector3,
      p1: THREE.Vector3,
      p2: THREE.Vector3,
      p3: THREE.Vector3,
      segsU = 8,
      segsV = 4
    ) => {
      const baseVertex = positions.length / 3
      for (let iv = 0; iv <= segsV; iv++) {
        const v = iv / segsV
        for (let iu = 0; iu <= segsU; iu++) {
          const u = iu / segsU
          const tx = p0.x * (1 - u) + p1.x * u
          const ty = p0.y * (1 - u) + p1.y * u
          const tz = p0.z * (1 - u) + p1.z * u
          const bx = p3.x * (1 - u) + p2.x * u
          const by = p3.y * (1 - u) + p2.y * u
          const bz = p3.z * (1 - u) + p2.z * u
          positions.push(
            tx * (1 - v) + bx * v,
            ty * (1 - v) + by * v,
            tz * (1 - v) + bz * v
          )
        }
      }
      const stride = segsU + 1
      for (let iv = 0; iv < segsV; iv++) {
        for (let iu = 0; iu < segsU; iu++) {
          const a = baseVertex + iv * stride + iu
          const b = a + 1
          const c = a + stride
          const d = c + 1
          indices.push(a, b, d, a, d, c)
        }
      }
    }

    config.staircases.forEach((st) => {
      const wx = Math.max(0.2, st.widthX) * baseScale
      const dy = Math.max(0.2, st.runDepthY) * baseScale
      const hz = Math.max(0.1, st.totalHeightZ) * baseScale
      const halfW = wx * 0.5
      const steps =
        st.mode === 'smooth-ramp'
          ? 1
          : Math.max(2, Math.min(28, Math.round(st.stepCount)))

      const positions: number[] = []
      const indices: number[] = []
      const wirePts: THREE.Vector3[] = []

      const pushWireQuad = (
        a: THREE.Vector3,
        b: THREE.Vector3,
        c: THREE.Vector3,
        d: THREE.Vector3
      ) => {
        wirePts.push(a, b, b, c, c, d, d, a)
      }

      if (st.mode === 'smooth-ramp') {
        const bL = new THREE.Vector3(-halfW, 0, 0)
        const bR = new THREE.Vector3(halfW, 0, 0)
        const tR = new THREE.Vector3(halfW, dy, hz)
        const tL = new THREE.Vector3(-halfW, dy, hz)
        const backBL = new THREE.Vector3(-halfW, dy, 0)
        const backBR = new THREE.Vector3(halfW, dy, 0)

        appendSubdividedQuad(positions, indices, tL, tR, bR, bL, 14, 14)
        pushWireQuad(tL, tR, bR, bL)

        if (st.closedStringers) {
          appendSubdividedQuad(positions, indices, tL, tL, backBL, bL, 8, 6)
          appendSubdividedQuad(positions, indices, tR, tR, bR, backBR, 8, 6)
          appendSubdividedQuad(positions, indices, tL, tR, backBR, backBL, 10, 6)
          wirePts.push(bL, backBL, backBL, tL, bR, backBR, backBR, tR, backBL, backBR)
        }
      } else if (st.mode === 'helical-spiral') {
        // Curved Helical / Spiral Arc Staircase
        const turnSign = (st.turnDirection ?? 'left-ccw') === 'left-ccw' ? 1 : -1
        const totalArcRad =
          ((Math.max(45, Math.min(360, st.spiralArcDeg ?? 180)) * Math.PI) /
            180) *
          turnSign
        const rIn = Math.max(0.15, st.innerRadius ?? 0.45) * baseScale
        const rOut = rIn + wx
        const centerOffsetX = turnSign > 0 ? -(rIn + halfW) : rIn + halfW
        const stepRise = hz / steps

        for (let i = 0; i < steps; i++) {
          const a0 = (i / steps) * totalArcRad
          const a1 = ((i + 1) / steps) * totalArcRad
          const z0 = i * stepRise
          const z1 = (i + 1) * stepRise

          const ptOnCircle = (r: number, ang: number, z: number) =>
            new THREE.Vector3(
              centerOffsetX + turnSign * r * Math.cos(ang),
              r * Math.sin(Math.abs(ang)),
              z
            )

          const in0Bot = ptOnCircle(rIn, a0, z0)
          const out0Bot = ptOnCircle(rOut, a0, z0)
          const in0Top = ptOnCircle(rIn, a0, z1)
          const out0Top = ptOnCircle(rOut, a0, z1)
          const in1Top = ptOnCircle(rIn, a1, z1)
          const out1Top = ptOnCircle(rOut, a1, z1)

          // Riser face at angle a0
          appendSubdividedQuad(
            positions,
            indices,
            in0Top,
            out0Top,
            out0Bot,
            in0Bot,
            10,
            3
          )
          pushWireQuad(in0Top, out0Top, out0Bot, in0Bot)

          // Wedge tread from a0 to a1 at z1
          appendSubdividedQuad(
            positions,
            indices,
            in1Top,
            out1Top,
            out0Top,
            in0Top,
            10,
            4
          )
          pushWireQuad(in1Top, out1Top, out0Top, in0Top)

          if (st.closedStringers) {
            const in0Floor = ptOnCircle(rIn, a0, 0)
            const in1Floor = ptOnCircle(rIn, a1, 0)
            const out0Floor = ptOnCircle(rOut, a0, 0)
            const out1Floor = ptOnCircle(rOut, a1, 0)
            appendSubdividedQuad(
              positions,
              indices,
              in0Top,
              in1Top,
              in1Floor,
              in0Floor,
              3,
              4
            )
            appendSubdividedQuad(
              positions,
              indices,
              out1Top,
              out0Top,
              out0Floor,
              out1Floor,
              3,
              4
            )
          }
        }
      } else if (st.mode === 'l-landing-90' || st.mode === 'u-switchback-180') {
        // Multi-Flight Staircase with Mid-Height 3D Landing Platform
        const lowerSteps = Math.max(1, Math.floor(steps * 0.5))
        const upperSteps = Math.max(1, steps - lowerSteps)
        const stepRise = hz / steps
        const landingZ = lowerSteps * stepRise
        const turnSign = (st.turnDirection ?? 'left-ccw') === 'left-ccw' ? -1 : 1

        // Helper to emit a straight flight from a local origin + forward/right basis
        const emitFlightSteps = (
          origin: THREE.Vector3,
          fwdDir: THREE.Vector3,
          rightDir: THREE.Vector3,
          numSteps: number,
          flightRun: number,
          zStart: number
        ) => {
          const sRun = flightRun / numSteps
          for (let i = 0; i < numSteps; i++) {
            const d0 = i * sRun
            const d1 = (i + 1) * sRun
            const z0 = zStart + i * stepRise
            const z1 = zStart + (i + 1) * stepRise

            const makePt = (r: number, f: number, z: number) =>
              origin
                .clone()
                .addScaledVector(rightDir, r)
                .addScaledVector(fwdDir, f)
                .setZ(z)

            const rTL = makePt(-halfW, d0, z1)
            const rTR = makePt(halfW, d0, z1)
            const rBR = makePt(halfW, d0, z0)
            const rBL = makePt(-halfW, d0, z0)
            appendSubdividedQuad(positions, indices, rTL, rTR, rBR, rBL, 10, 3)
            pushWireQuad(rTL, rTR, rBR, rBL)

            const tFL = makePt(-halfW, d1, z1)
            const tFR = makePt(halfW, d1, z1)
            appendSubdividedQuad(positions, indices, tFL, tFR, rTR, rTL, 10, 4)
            pushWireQuad(tFL, tFR, rTR, rTL)

            if (st.closedStringers) {
              const sLBot0 = makePt(-halfW, d0, 0)
              const sLBot1 = makePt(-halfW, d1, 0)
              appendSubdividedQuad(
                positions,
                indices,
                rTL,
                tFL,
                sLBot1,
                sLBot0,
                3,
                4
              )
              const sRBot0 = makePt(halfW, d0, 0)
              const sRBot1 = makePt(halfW, d1, 0)
              appendSubdividedQuad(
                positions,
                indices,
                tFR,
                rTR,
                sRBot0,
                sRBot1,
                3,
                4
              )
            }
          }
        }

        const lowerRun = dy * 0.55
        const landingDepth = Math.max(wx * 0.85, dy * 0.35)
        // Lower flight along +Y
        emitFlightSteps(
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(0, 1, 0),
          new THREE.Vector3(1, 0, 0),
          lowerSteps,
          lowerRun,
          0
        )

        if (st.mode === 'l-landing-90') {
          // Mid-flight square landing platform at y = [lowerRun .. lowerRun + wx]
          const lFL = new THREE.Vector3(-halfW, lowerRun + landingDepth, landingZ)
          const lFR = new THREE.Vector3(halfW, lowerRun + landingDepth, landingZ)
          const lBR = new THREE.Vector3(halfW, lowerRun, landingZ)
          const lBL = new THREE.Vector3(-halfW, lowerRun, landingZ)
          appendSubdividedQuad(positions, indices, lFL, lFR, lBR, lBL, 10, 10)
          pushWireQuad(lFL, lFR, lBR, lBL)

          // Upper flight turns 90 degrees along turnSign * X
          const upperOrigin = new THREE.Vector3(
            turnSign * halfW,
            lowerRun + landingDepth * 0.5,
            landingZ
          )
          const upperFwd = new THREE.Vector3(turnSign, 0, 0)
          const upperRight = new THREE.Vector3(0, -turnSign, 0)
          emitFlightSteps(
            upperOrigin,
            upperFwd,
            upperRight,
            upperSteps,
            lowerRun,
            landingZ
          )
        } else {
          // U-Switchback (180-degree turnaround landing spanning both flights)
          const xMin = turnSign < 0 ? -wx * 1.5 : -halfW
          const xMax = turnSign < 0 ? halfW : wx * 1.5
          const lFL = new THREE.Vector3(xMin, lowerRun + landingDepth, landingZ)
          const lFR = new THREE.Vector3(xMax, lowerRun + landingDepth, landingZ)
          const lBR = new THREE.Vector3(xMax, lowerRun, landingZ)
          const lBL = new THREE.Vector3(xMin, lowerRun, landingZ)
          appendSubdividedQuad(positions, indices, lFL, lFR, lBR, lBL, 12, 8)
          pushWireQuad(lFL, lFR, lBR, lBL)

          // Upper flight returns along -Y adjacent to lower flight
          const upperOrigin = new THREE.Vector3(
            turnSign * wx,
            lowerRun,
            landingZ
          )
          emitFlightSteps(
            upperOrigin,
            new THREE.Vector3(0, -1, 0),
            new THREE.Vector3(-1, 0, 0),
            upperSteps,
            lowerRun,
            landingZ
          )
        }
      } else {
        const stepRun = dy / steps
        const stepRise = hz / steps

        for (let i = 0; i < steps; i++) {
          const y0 = i * stepRun
          const y1 = (i + 1) * stepRun
          const z0 = i * stepRise
          const z1 = (i + 1) * stepRise

          // Vertical Riser at y = y0, from z0 to z1
          const rTL = new THREE.Vector3(-halfW, y0, z1)
          const rTR = new THREE.Vector3(halfW, y0, z1)
          const rBR = new THREE.Vector3(halfW, y0, z0)
          const rBL = new THREE.Vector3(-halfW, y0, z0)
          appendSubdividedQuad(positions, indices, rTL, rTR, rBR, rBL, 12, 3)
          pushWireQuad(rTL, rTR, rBR, rBL)

          // Horizontal Tread at z = z1, from y0 to y1
          const tFL = new THREE.Vector3(-halfW, y1, z1)
          const tFR = new THREE.Vector3(halfW, y1, z1)
          appendSubdividedQuad(positions, indices, tFL, tFR, rTR, rTL, 12, 4)
          pushWireQuad(tFL, tFR, rTR, rTL)

          if (st.closedStringers) {
            // Left & right side stringer slices under step i (from z=0 to z1)
            const sLTop0 = new THREE.Vector3(-halfW, y0, z1)
            const sLTop1 = new THREE.Vector3(-halfW, y1, z1)
            const sLBot1 = new THREE.Vector3(-halfW, y1, 0)
            const sLBot0 = new THREE.Vector3(-halfW, y0, 0)
            appendSubdividedQuad(
              positions,
              indices,
              sLTop0,
              sLTop1,
              sLBot1,
              sLBot0,
              3,
              4
            )

            const sRTop0 = new THREE.Vector3(halfW, y0, z1)
            const sRTop1 = new THREE.Vector3(halfW, y1, z1)
            const sRBot1 = new THREE.Vector3(halfW, y1, 0)
            const sRBot0 = new THREE.Vector3(halfW, y0, 0)
            appendSubdividedQuad(
              positions,
              indices,
              sRTop1,
              sRTop0,
              sRBot0,
              sRBot1,
              3,
              4
            )
          }
        }
      }

      const stairGeo = new THREE.BufferGeometry()
      stairGeo.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(positions, 3)
      )
      stairGeo.setIndex(indices)
      stairGeo.computeVertexNormals()

      const stairMesh = new THREE.Mesh(stairGeo, fgSurfaceMat)
      stairMesh.name = st.name.replace(/\s+/g, '_')
      stairMesh.position.set(
        st.offsetX * baseScale,
        st.offsetY * baseScale,
        st.offsetZ * baseScale
      )
      stairMesh.rotation.set(0, 0, (st.yawDeg * Math.PI) / 180)
      stairMesh.castShadow = true
      stairMesh.receiveShadow = true
      stairMesh.updateMatrixWorld(true)

      applyCameraProjectedUVsToGeometry(
        stairGeo,
        stairMesh.matrixWorld,
        cameraParameters
      )

      if (config.wireframeOverlay && wirePts.length >= 2) {
        const isSel = st.id === config.selectedStaircaseId
        const edgeGeo = new THREE.BufferGeometry().setFromPoints(wirePts)
        stairMesh.add(
          new THREE.LineSegments(edgeGeo, isSel ? selectedWireMat : stairWireMat)
        )
      }

      rootGroup.add(stairMesh)
    })
  }

  // 9. Architectural Option 6 (Optional): Arbitrary N-Point 3D Floor Polygon Prism Extruder
  if (config.floorPrismsEnabled && config.floorPrisms.length > 0) {
    const prismWireMat = new THREE.LineBasicMaterial({
      color: 0xf97316,
      transparent: true,
      opacity: 0.9
    })

    config.floorPrisms.forEach((prism) => {
      if (prism.polygonRel.length < 3) return
      const floorPts = prism.polygonRel
        .map((rel) =>
          unprojectRelativePointToPlaneZ(rel, prism.baseZ, cameraParameters)
        )
        .filter((h): h is NonNullable<typeof h> => h !== null)
      if (floorPts.length < 3) return

      const zBot = prism.baseZ * baseScale
      const zTop = (prism.baseZ + Math.max(0.08, prism.heightZ)) * baseScale
      const bevelInset = Math.max(0, Math.min(0.25, prism.bevelTop))

      // Centroid for optional top bevel inset
      const cx =
        floorPts.reduce((acc, p) => acc + p.x, 0) / floorPts.length
      const cy =
        floorPts.reduce((acc, p) => acc + p.y, 0) / floorPts.length

      const bot3D = floorPts.map(
        (p) => new THREE.Vector3(p.x * baseScale, p.y * baseScale, zBot)
      )
      const top3D = floorPts.map((p) => {
        const bx = p.x * (1 - bevelInset) + cx * bevelInset
        const by = p.y * (1 - bevelInset) + cy * bevelInset
        return new THREE.Vector3(bx * baseScale, by * baseScale, zTop)
      })

      const pos: number[] = []
      const idx: number[] = []
      const wirePts: THREE.Vector3[] = []

      // 1) Subdivided vertical side walls around all N edges
      const n = floorPts.length
      const segsU = 10
      const segsV = 8
      for (let e = 0; e < n; e++) {
        const next = (e + 1) % n
        const pTL = top3D[e]
        const pTR = top3D[next]
        const pBR = bot3D[next]
        const pBL = bot3D[e]

        const baseVtx = pos.length / 3
        for (let iv = 0; iv <= segsV; iv++) {
          const v = iv / segsV
          for (let iu = 0; iu <= segsU; iu++) {
            const u = iu / segsU
            const tx = pTL.x * (1 - u) + pTR.x * u
            const ty = pTL.y * (1 - u) + pTR.y * u
            const tz = pTL.z * (1 - u) + pTR.z * u
            const bx = pBL.x * (1 - u) + pBR.x * u
            const by = pBL.y * (1 - u) + pBR.y * u
            const bz = pBL.z * (1 - u) + pBR.z * u
            pos.push(
              tx * (1 - v) + bx * v,
              ty * (1 - v) + by * v,
              tz * (1 - v) + bz * v
            )
          }
        }
        const stride = segsU + 1
        for (let iv = 0; iv < segsV; iv++) {
          for (let iu = 0; iu < segsU; iu++) {
            const a = baseVtx + iv * stride + iu
            const b = a + 1
            const c = a + stride
            const d = c + 1
            idx.push(a, b, d, a, d, c)
          }
        }

        wirePts.push(pBL, pBR, pTL, pTR, pBL, pTL)
      }

      // 2) Ear-clip triangulate the arbitrary N-gon top cap (with internal subdivision for crisp projective UVs)
      const contour2D = top3D.map((v) => new THREE.Vector2(v.x, v.y))
      const tris = THREE.ShapeUtils.triangulateShape(contour2D, [])
      const capSub = 6
      for (const [i0, i1, i2] of tris) {
        const v0 = top3D[i0]
        const v1 = top3D[i1]
        const v2 = top3D[i2]
        // Subdivide triangle into capSub^2 sub-triangles via barycentric grid
        const gridIdx: number[][] = []
        for (let r = 0; r <= capSub; r++) {
          const row: number[] = []
          for (let c = 0; c <= capSub - r; c++) {
            const w1 = r / capSub
            const w2 = c / capSub
            const w0 = 1 - w1 - w2
            const px = v0.x * w0 + v1.x * w1 + v2.x * w2
            const py = v0.y * w0 + v1.y * w1 + v2.y * w2
            const pz = v0.z * w0 + v1.z * w1 + v2.z * w2
            row.push(pos.length / 3)
            pos.push(px, py, pz)
          }
          gridIdx.push(row)
        }
        for (let r = 0; r < capSub; r++) {
          for (let c = 0; c < capSub - r; c++) {
            idx.push(gridIdx[r][c], gridIdx[r + 1][c], gridIdx[r][c + 1])
            if (c + 1 < capSub - r) {
              idx.push(
                gridIdx[r + 1][c],
                gridIdx[r + 1][c + 1],
                gridIdx[r][c + 1]
              )
            }
          }
        }
      }

      const prismGeo = new THREE.BufferGeometry()
      prismGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
      prismGeo.setIndex(idx)
      prismGeo.computeVertexNormals()

      const prismMesh = new THREE.Mesh(prismGeo, fgSurfaceMat)
      prismMesh.name = prism.name.replace(/\s+/g, '_')
      prismMesh.castShadow = true
      prismMesh.receiveShadow = true
      prismMesh.updateMatrixWorld(true)

      applyCameraProjectedUVsToGeometry(
        prismGeo,
        prismMesh.matrixWorld,
        cameraParameters
      )

      if (config.wireframeOverlay && wirePts.length >= 2) {
        const isSel = prism.id === config.selectedFloorPrismId
        const edgeGeo = new THREE.BufferGeometry().setFromPoints(wirePts)
        prismMesh.add(
          new THREE.LineSegments(edgeGeo, isSel ? selectedWireMat : prismWireMat)
        )
      }

      rootGroup.add(prismMesh)
    })
  }

  // 10. Architectural Option 7 (Optional): Axis-Symmetric 3D Revolved "Lathe" Object
  if (config.latheObjectsEnabled && config.latheObjects.length > 0) {
    const latheWireMat = new THREE.LineBasicMaterial({
      color: 0xec4899,
      transparent: true,
      opacity: 0.9
    })

    config.latheObjects.forEach((lathe) => {
      const solved = solveRevolvedLathe3D(lathe, cameraParameters)
      if (!solved) return

      const baseR = solved.baseRadius * baseScale
      const totalH = solved.height * baseScale
      const radialSegs = Math.max(6, Math.min(36, Math.round(lathe.radialSegments)))
      const heightSegs = 28

      const pos: number[] = []
      const idx: number[] = []
      const wirePts: THREE.Vector3[] = []

      for (let iv = 0; iv <= heightSegs; iv++) {
        const v = iv / heightSegs
        const z = v * totalH
        const r =
          baseR *
          evaluateLatheRadiusMultiplier(v, lathe.preset, lathe.profileRadii)
        for (let ir = 0; ir <= radialSegs; ir++) {
          const theta = (ir / radialSegs) * Math.PI * 2
          pos.push(r * Math.cos(theta), r * Math.sin(theta), z)
        }
      }

      const stride = radialSegs + 1
      for (let iv = 0; iv < heightSegs; iv++) {
        for (let ir = 0; ir < radialSegs; ir++) {
          const a = iv * stride + ir
          const b = a + 1
          const c = a + stride
          const d = c + 1
          idx.push(a, b, d, a, d, c)
        }
      }

      // Top & bottom circular caps
      for (const capV of [0, 1]) {
        const zCap = capV * totalH
        const rCap =
          baseR *
          evaluateLatheRadiusMultiplier(capV, lathe.preset, lathe.profileRadii)
        const centerIdx = pos.length / 3
        pos.push(0, 0, zCap)
        const ringStart = pos.length / 3
        for (let ir = 0; ir <= radialSegs; ir++) {
          const theta = (ir / radialSegs) * Math.PI * 2
          pos.push(rCap * Math.cos(theta), rCap * Math.sin(theta), zCap)
        }
        for (let ir = 0; ir < radialSegs; ir++) {
          if (capV === 1) {
            idx.push(centerIdx, ringStart + ir, ringStart + ir + 1)
          } else {
            idx.push(centerIdx, ringStart + ir + 1, ringStart + ir)
          }
        }
      }

      // Wireframe rings at key profile heights + 4 vertical meridians
      for (const ringV of [0, 0.15, 0.5, 0.85, 1]) {
        const zR = ringV * totalH
        const rR =
          baseR *
          evaluateLatheRadiusMultiplier(ringV, lathe.preset, lathe.profileRadii)
        for (let ir = 0; ir < radialSegs; ir++) {
          const t0 = (ir / radialSegs) * Math.PI * 2
          const t1 = ((ir + 1) / radialSegs) * Math.PI * 2
          wirePts.push(
            new THREE.Vector3(rR * Math.cos(t0), rR * Math.sin(t0), zR),
            new THREE.Vector3(rR * Math.cos(t1), rR * Math.sin(t1), zR)
          )
        }
      }

      const latheGeo = new THREE.BufferGeometry()
      latheGeo.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(pos, 3)
      )
      latheGeo.setIndex(idx)
      latheGeo.computeVertexNormals()

      const latheMesh = new THREE.Mesh(latheGeo, fgSurfaceMat)
      latheMesh.name = lathe.name.replace(/\s+/g, '_')
      latheMesh.position.set(
        solved.centerX * baseScale,
        solved.centerY * baseScale,
        lathe.baseZ * baseScale
      )
      latheMesh.castShadow = true
      latheMesh.receiveShadow = true
      latheMesh.updateMatrixWorld(true)

      applyCameraProjectedUVsToGeometry(
        latheGeo,
        latheMesh.matrixWorld,
        cameraParameters
      )

      if (config.wireframeOverlay && wirePts.length >= 2) {
        const isSel = lathe.id === config.selectedLatheObjectId
        const edgeGeo = new THREE.BufferGeometry().setFromPoints(wirePts)
        latheMesh.add(
          new THREE.LineSegments(edgeGeo, isSel ? selectedWireMat : latheWireMat)
        )
      }

      rootGroup.add(latheMesh)
    })
  }

  // 11. Architectural Option 8 (Optional): Parametric 3D Coffered Ceiling Grid & Repeating Wall Panel Array
  if ((config.cofferedArraysEnabled ?? false) && (config.cofferedArrays ?? []).length > 0) {
    const cofferWireMat = new THREE.LineBasicMaterial({
      color: 0x818cf8,
      transparent: true,
      opacity: 0.9
    })

    const pushSubQuad = (
      pos: number[],
      idx: number[],
      p0: THREE.Vector3,
      p1: THREE.Vector3,
      p2: THREE.Vector3,
      p3: THREE.Vector3,
      segs = 3
    ) => {
      const baseV = pos.length / 3
      for (let iy = 0; iy <= segs; iy++) {
        const v = iy / segs
        for (let ix = 0; ix <= segs; ix++) {
          const u = ix / segs
          const tx = p0.x * (1 - u) + p1.x * u
          const ty = p0.y * (1 - u) + p1.y * u
          const tz = p0.z * (1 - u) + p1.z * u
          const bx = p3.x * (1 - u) + p2.x * u
          const by = p3.y * (1 - u) + p2.y * u
          const bz = p3.z * (1 - u) + p2.z * u
          pos.push(
            tx * (1 - v) + bx * v,
            ty * (1 - v) + by * v,
            tz * (1 - v) + bz * v
          )
        }
      }
      const stride = segs + 1
      for (let iy = 0; iy < segs; iy++) {
        for (let ix = 0; ix < segs; ix++) {
          const a = baseV + iy * stride + ix
          const b = a + 1
          const c = a + stride
          const d = c + 1
          idx.push(a, b, d, a, d, c)
        }
      }
    }

    ;(config.cofferedArrays ?? []).forEach((arr) => {
      const hits = arr.quadRel.map((pt) =>
        unprojectRelativePointToHostWall(
          pt,
          arr.hostWall,
          0,
          config,
          cameraParameters
        )
      )
      if (hits.some((h) => !h)) return
      const [h0, h1, h2, h3] = hits as NonNullable<(typeof hits)[0]>[]
      const nVec = new THREE.Vector3(
        h0.normal.x,
        h0.normal.y,
        h0.normal.z
      ).normalize()

      const cPts = [h0, h1, h2, h3].map(
        (h) =>
          new THREE.Vector3(h.x * baseScale, h.y * baseScale, h.z * baseScale)
      )
      const evalBilinear = (u: number, v: number): THREE.Vector3 => {
        const top = cPts[0].clone().lerp(cPts[1], u)
        const bot = cPts[3].clone().lerp(cPts[2], u)
        return top.lerp(bot, v)
      }

      const rows = Math.max(1, Math.min(8, Math.round(arr.rows)))
      const cols = Math.max(1, Math.min(8, Math.round(arr.cols)))
      const stileFrac = Math.max(0.04, Math.min(0.38, arr.stileWidthRatio)) * 0.5
      const bevelFrac = Math.max(0, Math.min(0.16, arr.bevelMarginRatio))
      const dWorld = arr.recessDepth * baseScale

      const pos: number[] = []
      const idx: number[] = []
      const wirePts: THREE.Vector3[] = []

      for (let r = 0; r < rows; r++) {
        const vCell0 = r / rows
        const vCell1 = (r + 1) / rows
        const dv = vCell1 - vCell0

        for (let c = 0; c < cols; c++) {
          const uCell0 = c / cols
          const uCell1 = (c + 1) / cols
          const du = uCell1 - uCell0

          // Outer cell corners (on host wall plane)
          const oTL = evalBilinear(uCell0, vCell0)
          const oTR = evalBilinear(uCell1, vCell0)
          const oBR = evalBilinear(uCell1, vCell1)
          const oBL = evalBilinear(uCell0, vCell1)

          // Stile inner opening corners (on host wall plane)
          const sU0 = uCell0 + du * stileFrac
          const sU1 = uCell1 - du * stileFrac
          const sV0 = vCell0 + dv * stileFrac
          const sV1 = vCell1 - dv * stileFrac

          const sTL = evalBilinear(sU0, sV0)
          const sTR = evalBilinear(sU1, sV0)
          const sBR = evalBilinear(sU1, sV1)
          const sBL = evalBilinear(sU0, sV1)

          // Inner recessed/raised coffer bottom corners
          const bU0 = Math.min(0.48, stileFrac + bevelFrac)
          const iU0 = uCell0 + du * bU0
          const iU1 = uCell1 - du * bU0
          const iV0 = vCell0 + dv * bU0
          const iV1 = vCell1 - dv * bU0

          const iTL = evalBilinear(iU0, iV0).addScaledVector(nVec, dWorld)
          const iTR = evalBilinear(iU1, iV0).addScaledVector(nVec, dWorld)
          const iBR = evalBilinear(iU1, iV1).addScaledVector(nVec, dWorld)
          const iBL = evalBilinear(iU0, iV1).addScaledVector(nVec, dWorld)

          // 4 flush stile border strips around the cell
          pushSubQuad(pos, idx, oTL, oTR, sTR, sTL, 3)
          pushSubQuad(pos, idx, sBL, sBR, oBR, oBL, 3)
          pushSubQuad(pos, idx, oTL, sTL, sBL, oBL, 3)
          pushSubQuad(pos, idx, sTR, oTR, oBR, sBR, 3)

          // 4 sloped/recessed coffer side walls connecting stile edge to recessed panel
          pushSubQuad(pos, idx, sTL, sTR, iTR, iTL, 3)
          pushSubQuad(pos, idx, iBL, iBR, sBR, sBL, 3)
          pushSubQuad(pos, idx, sTL, iTL, iBL, sBL, 3)
          pushSubQuad(pos, idx, iTR, sTR, sBR, iBR, 3)

          // Inner recessed/raised panel floor
          pushSubQuad(pos, idx, iTL, iTR, iBR, iBL, 5)

          wirePts.push(
            sTL, sTR, sTR, sBR, sBR, sBL, sBL, sTL,
            iTL, iTR, iTR, iBR, iBR, iBL, iBL, iTL,
            sTL, iTL, sTR, iTR, sBR, iBR, sBL, iBL
          )
        }
      }

      // Outer master perimeter wireframe
      wirePts.push(
        cPts[0], cPts[1], cPts[1], cPts[2], cPts[2], cPts[3], cPts[3], cPts[0]
      )

      const cofferGeo = new THREE.BufferGeometry()
      cofferGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
      cofferGeo.setIndex(idx)
      cofferGeo.computeVertexNormals()

      const cofferMesh = new THREE.Mesh(cofferGeo, fgSurfaceMat)
      cofferMesh.name = arr.name.replace(/\s+/g, '_')
      cofferMesh.castShadow = true
      cofferMesh.receiveShadow = true
      cofferMesh.updateMatrixWorld(true)

      applyCameraProjectedUVsToGeometry(
        cofferGeo,
        cofferMesh.matrixWorld,
        cameraParameters
      )

      if (config.wireframeOverlay && wirePts.length >= 2) {
        const isSel = arr.id === config.selectedCofferedArrayId
        const edgeGeo = new THREE.BufferGeometry().setFromPoints(wirePts)
        cofferMesh.add(
          new THREE.LineSegments(
            edgeGeo,
            isSel ? selectedWireMat : cofferWireMat
          )
        )
      }

      rootGroup.add(cofferMesh)
    })
  }

  // 12. Architectural Option 9 (Optional): 3-Point Curved Arc Wall & Bow-Window Bay Extruder
  if ((config.curvedWallsEnabled ?? false) && (config.curvedWalls ?? []).length > 0) {
    const arcWallWireMat = new THREE.LineBasicMaterial({
      color: 0x14b8a6,
      transparent: true,
      opacity: 0.9
    })

    ;(config.curvedWalls ?? []).forEach((cw) => {
      const hitStart = unprojectRelativePointToPlaneZ(
        cw.startRel,
        cw.baseZ,
        cameraParameters
      )
      const hitApex = unprojectRelativePointToPlaneZ(
        cw.apexRel,
        cw.baseZ,
        cameraParameters
      )
      const hitEnd = unprojectRelativePointToPlaneZ(
        cw.endRel,
        cw.baseZ,
        cameraParameters
      )
      if (!hitStart || !hitApex || !hitEnd) return

      const zBot = cw.baseZ * baseScale
      const zTop = (cw.baseZ + Math.max(0.15, cw.heightZ)) * baseScale
      const halfThick = Math.max(0.03, cw.thickness * 0.5) * baseScale
      const arcSegs = Math.max(8, Math.min(40, Math.round(cw.segments)))

      // Construct quadratic Bezier control point so the curve passes through hitApex at t = 0.5:
      // B(0.5) = 0.25*P0 + 0.5*Pc + 0.25*P2 = Papex => Pc = 2*Papex - 0.5*(P0 + P2)
      const p0 = new THREE.Vector2(hitStart.x * baseScale, hitStart.y * baseScale)
      const pApex = new THREE.Vector2(hitApex.x * baseScale, hitApex.y * baseScale)
      const p2 = new THREE.Vector2(hitEnd.x * baseScale, hitEnd.y * baseScale)
      const pCtrl = pApex
        .clone()
        .multiplyScalar(2)
        .sub(p0.clone().add(p2).multiplyScalar(0.5))

      const curve2D = new THREE.QuadraticBezierCurve(p0, pCtrl, p2)
      const outerBot: THREE.Vector3[] = []
      const innerBot: THREE.Vector3[] = []
      const outerTop: THREE.Vector3[] = []
      const innerTop: THREE.Vector3[] = []

      for (let i = 0; i <= arcSegs; i++) {
        const t = i / arcSegs
        const pt = curve2D.getPoint(t)
        const tan = curve2D.getTangent(t).normalize()
        const norm2D = new THREE.Vector2(-tan.y, tan.x)

        const oX = pt.x + norm2D.x * halfThick
        const oY = pt.y + norm2D.y * halfThick
        const iX = pt.x - norm2D.x * halfThick
        const iY = pt.y - norm2D.y * halfThick

        outerBot.push(new THREE.Vector3(oX, oY, zBot))
        innerBot.push(new THREE.Vector3(iX, iY, zBot))
        outerTop.push(new THREE.Vector3(oX, oY, zTop))
        innerTop.push(new THREE.Vector3(iX, iY, zTop))
      }

      const pos: number[] = []
      const idx: number[] = []
      const wirePts: THREE.Vector3[] = []

      const appendWallQuad = (
        a: THREE.Vector3,
        b: THREE.Vector3,
        c: THREE.Vector3,
        d: THREE.Vector3,
        segsU = 2,
        segsV = 10
      ) => {
        const baseV = pos.length / 3
        for (let iv = 0; iv <= segsV; iv++) {
          const v = iv / segsV
          for (let iu = 0; iu <= segsU; iu++) {
            const u = iu / segsU
            const tx = a.x * (1 - u) + b.x * u
            const ty = a.y * (1 - u) + b.y * u
            const tz = a.z * (1 - u) + b.z * u
            const bx = d.x * (1 - u) + c.x * u
            const by = d.y * (1 - u) + c.y * u
            const bz = d.z * (1 - u) + c.z * u
            pos.push(
              tx * (1 - v) + bx * v,
              ty * (1 - v) + by * v,
              tz * (1 - v) + bz * v
            )
          }
        }
        const stride = segsU + 1
        for (let iv = 0; iv < segsV; iv++) {
          for (let iu = 0; iu < segsU; iu++) {
            const i0 = baseV + iv * stride + iu
            const i1 = i0 + 1
            const i2 = i0 + stride
            const i3 = i2 + 1
            idx.push(i0, i1, i3, i0, i3, i2)
          }
        }
      }

      for (let i = 0; i < arcSegs; i++) {
        // Outer curved wall face
        appendWallQuad(
          outerTop[i],
          outerTop[i + 1],
          outerBot[i + 1],
          outerBot[i],
          2,
          10
        )
        // Inner curved wall face
        appendWallQuad(
          innerTop[i + 1],
          innerTop[i],
          innerBot[i],
          innerBot[i + 1],
          2,
          10
        )
        // Top cap strip
        appendWallQuad(
          innerTop[i],
          innerTop[i + 1],
          outerTop[i + 1],
          outerTop[i],
          2,
          2
        )

        wirePts.push(
          outerBot[i],
          outerBot[i + 1],
          innerBot[i],
          innerBot[i + 1],
          outerTop[i],
          outerTop[i + 1],
          innerTop[i],
          innerTop[i + 1]
        )
      }

      // Start & End jamb caps
      appendWallQuad(outerTop[0], innerTop[0], innerBot[0], outerBot[0], 2, 8)
      appendWallQuad(
        innerTop[arcSegs],
        outerTop[arcSegs],
        outerBot[arcSegs],
        innerBot[arcSegs],
        2,
        8
      )
      wirePts.push(
        outerBot[0], outerTop[0], innerBot[0], innerTop[0],
        outerBot[arcSegs], outerTop[arcSegs], innerBot[arcSegs], innerTop[arcSegs]
      )

      const cwGeo = new THREE.BufferGeometry()
      cwGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
      cwGeo.setIndex(idx)
      cwGeo.computeVertexNormals()

      const cwMesh = new THREE.Mesh(cwGeo, fgSurfaceMat)
      cwMesh.name = cw.name.replace(/\s+/g, '_')
      cwMesh.castShadow = true
      cwMesh.receiveShadow = true
      cwMesh.updateMatrixWorld(true)

      applyCameraProjectedUVsToGeometry(
        cwGeo,
        cwMesh.matrixWorld,
        cameraParameters
      )

      if (config.wireframeOverlay && wirePts.length >= 2) {
        const isSel = cw.id === config.selectedCurvedWallId
        const edgeGeo = new THREE.BufferGeometry().setFromPoints(wirePts)
        cwMesh.add(
          new THREE.LineSegments(
            edgeGeo,
            isSel ? selectedWireMat : arcWallWireMat
          )
        )
      }

      rootGroup.add(cwMesh)
    })
  }

  return rootGroup
}

/**
 * Solves an 8x8 linear system by Gaussian elimination with partial pivoting
 * to find the 3x3 perspective homography matrix H mapping destination (u, v) in [0,1]^2
 * to source relative image coordinates (x, y) of the 4 quad corners.
 */
function computeQuadHomography(
  quad: [Point2D, Point2D, Point2D, Point2D]
): number[] | null {
  const srcU = [0, 1, 1, 0]
  const srcV = [0, 0, 1, 1]

  const A: number[][] = []
  const b: number[] = []

  for (let i = 0; i < 4; i++) {
    const u = srcU[i]
    const v = srcV[i]
    const x = quad[i].x
    const y = quad[i].y

    A.push([u, v, 1, 0, 0, 0, -u * x, -v * x])
    b.push(x)
    A.push([0, 0, 0, u, v, 1, -u * y, -v * y])
    b.push(y)
  }

  const n = 8
  for (let col = 0; col < n; col++) {
    let pivotRow = col
    let maxVal = Math.abs(A[col][col])
    for (let row = col + 1; row < n; row++) {
      const val = Math.abs(A[row][col])
      if (val > maxVal) {
        maxVal = val
        pivotRow = row
      }
    }
    if (maxVal < 1e-11) return null

    if (pivotRow !== col) {
      const tmpRow = A[col]
      A[col] = A[pivotRow]
      A[pivotRow] = tmpRow
      const tmpB = b[col]
      b[col] = b[pivotRow]
      b[pivotRow] = tmpB
    }

    const pivot = A[col][col]
    for (let j = col; j < n; j++) {
      A[col][j] /= pivot
    }
    b[col] /= pivot

    for (let row = 0; row < n; row++) {
      if (row === col) continue
      const factor = A[row][col]
      if (Math.abs(factor) < 1e-12) continue
      for (let j = col; j < n; j++) {
        A[row][j] -= factor * A[col][j]
      }
      b[row] -= factor * b[col]
    }
  }

  return [b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7], 1]
}

/**
 * Estimates the physical 3D width-to-height aspect ratio of a 4-corner perspective quad
 * using the solved camera rays and the cross-product normal of the quad's diagonals.
 */
export function estimateQuadPhysicalAspect(
  quad: [Point2D, Point2D, Point2D, Point2D],
  cameraParameters: CameraParameters | null
): number {
  if (!cameraParameters) {
    const topW = Math.hypot(quad[1].x - quad[0].x, quad[1].y - quad[0].y)
    const botW = Math.hypot(quad[2].x - quad[3].x, quad[2].y - quad[3].y)
    const leftH = Math.hypot(quad[3].x - quad[0].x, quad[3].y - quad[0].y)
    const rightH = Math.hypot(quad[2].x - quad[1].x, quad[2].y - quad[1].y)
    const avgW = 0.5 * (topW + botW)
    const avgH = Math.max(0.01, 0.5 * (leftH + rightH))
    return Math.max(0.25, Math.min(4.0, avgW / avgH))
  }

  const { imageWidth, imageHeight, horizontalFieldOfView, principalPoint } =
    cameraParameters
  const f = 1 / Math.tan(0.5 * horizontalFieldOfView)

  // Convert 4 corners to normalized camera-space rays (x, y, -f)
  const rays = quad.map((rel) => {
    const plane = CoordinatesUtil.convert(
      rel,
      ImageCoordinateFrame.Relative,
      ImageCoordinateFrame.ImagePlane,
      imageWidth,
      imageHeight
    )
    return new THREE.Vector3(
      plane.x - principalPoint.x,
      plane.y - principalPoint.y,
      -f
    )
  })

  // Use Robert Collins' projective rectangle aspect ratio formula from the 4 homogeneous rays
  const p0 = rays[0]
  const p1 = rays[1]
  const p2 = rays[2]
  const p3 = rays[3]

  // Solve lambdas so lambda0*p0 + lambda2*p2 = lambda1*p1 + lambda3*p3 (parallelogram in 3D)
  const m = new THREE.Matrix3().set(
    p0.x, -p1.x, p2.x,
    p0.y, -p1.y, p2.y,
    p0.z, -p1.z, p2.z
  )
  const det = m.determinant()
  if (Math.abs(det) > 1e-7) {
    const inv = m.clone().invert()
    const rhs = p3.clone()
    rhs.applyMatrix3(inv)
    const l0 = rhs.x
    const l1 = rhs.y
    const v0 = p0.clone().multiplyScalar(l0)
    const v1 = p1.clone().multiplyScalar(l1)
    const v3 = p3.clone()
    const width3D = v1.distanceTo(v0)
    const height3D = v3.distanceTo(v0)
    if (height3D > 1e-4 && Number.isFinite(width3D / height3D)) {
      return Math.max(0.25, Math.min(4.0, width3D / height3D))
    }
  }

  return 1.333
}

/**
 * Unwarps a 4-corner perspective quad from the source image into a flat, orthographic
 * rectangular PNG texture using bilinear homography sampling.
 */
export async function renderUnwarpedQuadTexture(
  sourceUrl: string,
  quad: [Point2D, Point2D, Point2D, Point2D],
  aspectRatio: number,
  maxSide = 1024
): Promise<{ url: string; blob: Blob; width: number; height: number } | null> {
  const H = computeQuadHomography(quad)
  if (!H) return null

  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const srcW = img.naturalWidth || img.width
        const srcH = img.naturalHeight || img.height
        if (srcW < 4 || srcH < 4) {
          resolve(null)
          return
        }

        const srcCanvas = document.createElement('canvas')
        srcCanvas.width = srcW
        srcCanvas.height = srcH
        const srcCtx = srcCanvas.getContext('2d')
        if (!srcCtx) {
          resolve(null)
          return
        }
        srcCtx.drawImage(img, 0, 0)
        const srcData = srcCtx.getImageData(0, 0, srcW, srcH).data

        const clampedAspect = Math.max(0.25, Math.min(4.0, aspectRatio))
        const dstW =
          clampedAspect >= 1
            ? maxSide
            : Math.max(64, Math.round(maxSide * clampedAspect))
        const dstH =
          clampedAspect >= 1
            ? Math.max(64, Math.round(maxSide / clampedAspect))
            : maxSide

        const dstCanvas = document.createElement('canvas')
        dstCanvas.width = dstW
        dstCanvas.height = dstH
        const dstCtx = dstCanvas.getContext('2d')
        if (!dstCtx) {
          resolve(null)
          return
        }

        const dstImgData = dstCtx.createImageData(dstW, dstH)
        const dstData = dstImgData.data

        for (let y = 0; y < dstH; y++) {
          const v = y / Math.max(1, dstH - 1)
          for (let x = 0; x < dstW; x++) {
            const u = x / Math.max(1, dstW - 1)
            const denom = H[6] * u + H[7] * v + H[8]
            const dstIdx = (y * dstW + x) * 4
            if (Math.abs(denom) < 1e-8) continue

            const relX = (H[0] * u + H[1] * v + H[2]) / denom
            const relY = (H[3] * u + H[4] * v + H[5]) / denom

            const sx = relX * (srcW - 1)
            const sy = relY * (srcH - 1)

            if (sx >= 0 && sx < srcW - 1 && sy >= 0 && sy < srcH - 1) {
              const x0 = Math.floor(sx)
              const y0 = Math.floor(sy)
              const fx = sx - x0
              const fy = sy - y0
              const w00 = (1 - fx) * (1 - fy)
              const w10 = fx * (1 - fy)
              const w01 = (1 - fx) * fy
              const w11 = fx * fy

              const idx00 = (y0 * srcW + x0) * 4
              const idx10 = idx00 + 4
              const idx01 = idx00 + srcW * 4
              const idx11 = idx01 + 4

              dstData[dstIdx] =
                srcData[idx00] * w00 +
                srcData[idx10] * w10 +
                srcData[idx01] * w01 +
                srcData[idx11] * w11
              dstData[dstIdx + 1] =
                srcData[idx00 + 1] * w00 +
                srcData[idx10 + 1] * w10 +
                srcData[idx01 + 1] * w01 +
                srcData[idx11 + 1] * w11
              dstData[dstIdx + 2] =
                srcData[idx00 + 2] * w00 +
                srcData[idx10 + 2] * w10 +
                srcData[idx01 + 2] * w01 +
                srcData[idx11 + 2] * w11
              dstData[dstIdx + 3] = 255
            } else {
              dstData[dstIdx + 3] = 255
            }
          }
        }

        dstCtx.putImageData(dstImgData, 0, 0)
        dstCanvas.toBlob((blob) => {
          if (!blob) {
            resolve(null)
            return
          }
          const url = URL.createObjectURL(blob)
          resolve({ url, blob, width: dstW, height: dstH })
        }, 'image/png')
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = sourceUrl
  })
}

/**
 * Exports the reconstructed 3D scene (Room Shell + Blockout Volumes + Baked Camera-Projected Photo Texture)
 * as a binary .GLB 3D model ready for Blender, Unreal, Unity, or Three.js.
 */
export async function exportReconstructedSceneGLB(
  imageUrl: string,
  config: SceneBlockoutConfig,
  cameraParameters: CameraParameters,
  projectName: string | null
): Promise<boolean> {
  return new Promise((resolve) => {
    const loader = new THREE.TextureLoader()
    loader.load(
      imageUrl,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace

        // Build clean export scene without wireframe LineSegments so GLB contains pure textured meshes
        const cleanConfig: SceneBlockoutConfig = {
          ...config,
          wireframeOverlay: false,
          projectPhotoTexture: true,
          surfaceOpacity: 1.0
        }
        const exportGroup = buildReconstructedSceneGroup(
          cleanConfig,
          cameraParameters,
          texture
        )

        // Convert Z-up fSpy world to standard Y-up GLTF convention
        const gltfRoot = new THREE.Scene()
        gltfRoot.name = 'fSpy_Studio_3D_Scene'
        exportGroup.rotation.x = -Math.PI / 2
        exportGroup.updateMatrixWorld(true)
        gltfRoot.add(exportGroup)

        const exporter = new GLTFExporter()
        exporter.parse(
          gltfRoot,
          (result) => {
            if (result instanceof ArrayBuffer) {
              const safeName =
                (projectName || 'fSpy_Scene')
                  .replace(/\.fspy$/i, '')
                  .replace(/[^a-zA-Z0-9_-]/g, '_') || 'fSpy_Scene'
              const blob = new Blob([result], { type: 'model/gltf-binary' })
              saveAs(blob, `${safeName}_3D_Scene.glb`)
              resolve(true)
            } else {
              resolve(false)
            }
          },
          () => {
            resolve(false)
          },
          { binary: true }
        )
      },
      undefined,
      () => resolve(false)
    )
  })
}
