/**
 * fSpy Studio — Zero-API "AI Scene Architect Bridge"
 * Generates a calibrated Vision-LLM prompt (embedding solved fSpy camera parameters & coordinate rules)
 * and parses the returned JSON blueprint into native interactive fSpy 3D primitives.
 */

import Point2D from './point-2d'
import {
  BillboardCutout,
  BlockoutVolume,
  CofferedPanelArray,
  CurvedArcWall,
  FloorPolygonPrism,
  HostWallType,
  LathePresetType,
  RevolvedLatheObject,
  RoomShellType,
  SceneBlockoutConfig,
  StaircaseExtrusion,
  StaircaseMode,
  StairTurnDirection,
  SweptColumnProfile,
  SweptCylinderColumn,
  SweptRailPathMode,
  SweptRailProfile,
  SweptWallRail,
  WallCutoutAlphaMode,
  WallParallelCutout,
  WallReliefArchType,
  WallReliefExtrusion
} from './scene-reconstruction'
import { CameraParameters } from './solver-result'

function clampNum(val: unknown, min: number, max: number, fallback: number): number {
  const n = typeof val === 'number' ? val : Number(val)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, n))
}

function clampPointRel(pt: unknown, fallback: Point2D): Point2D {
  if (!pt || typeof pt !== 'object') return fallback
  const rec = pt as Record<string, unknown>
  return {
    x: clampNum(rec.x, 0.01, 0.99, fallback.x),
    y: clampNum(rec.y, 0.01, 0.99, fallback.y)
  }
}

function parseHostWall(val: unknown, fallback: HostWallType): HostWallType {
  if (
    val === 'left-wall-yz' ||
    val === 'right-wall-yz' ||
    val === 'back-wall-xz' ||
    val === 'floor-xy' ||
    val === 'ceiling-xy'
  ) {
    return val
  }
  return fallback
}

/**
 * Generates a complete, copy-pasteable prompt for any Vision LLM (ChatGPT, Claude, Gemini)
 * pre-populated with the user's image dimensions and solved fSpy camera parameters.
 */
export function generateAISceneArchitectPrompt(
  imageWidth: number,
  imageHeight: number,
  cameraParameters: CameraParameters | null,
  currentConfig: SceneBlockoutConfig
): string {
  const hfovDeg = cameraParameters
    ? ((cameraParameters.horizontalFieldOfView * 180) / Math.PI).toFixed(1)
    : 'Unknown (unsolved)'
  const vfovDeg = cameraParameters
    ? ((cameraParameters.verticalFieldOfView * 180) / Math.PI).toFixed(1)
    : 'Unknown'
  const focal35mm = cameraParameters
    ? (18 / Math.tan(0.5 * cameraParameters.horizontalFieldOfView)).toFixed(1)
    : 'Unknown'

  return `You are an expert 3D Architectural Scene Reconstruction AI for fSpy Studio.
Analyze the attached photograph and output ONLY a single valid JSON object (no extra explanation needed) that reconstructs the 3D room shell and architectural features so fSpy Studio can build a camera-projected 3D scene.

### 1. CALIBRATED CAMERA & IMAGE CONTEXT (SOLVED BY FSPY)
- Image Resolution: ${imageWidth || 1920} x ${imageHeight || 1080} px (Aspect Ratio: ${imageWidth && imageHeight ? (imageWidth / imageHeight).toFixed(3) : '1.778'})
- Solved Horizontal FOV: ${hfovDeg}° (Vertical FOV: ${vfovDeg}°, ~${focal35mm}mm 35mm eq.)
- Current Room Estimate: ${currentConfig.roomWidthX.toFixed(1)}m (W) × ${currentConfig.roomDepthY.toFixed(1)}m (D) × ${currentConfig.roomHeightZ.toFixed(1)}m (H)

### 2. COORDINATE CONVENTIONS
1. **2D Relative Image Coordinates (\`rel\`)**:
   - \`x\`: \`0.0\` is left edge of photo, \`1.0\` is right edge of photo.
   - \`y\`: \`0.0\` is top edge of photo, \`1.0\` is bottom edge of photo.
   - Quad corners (\`quadRel\`) MUST be ordered clockwise starting from Top-Left: \`[TopLeft, TopRight, BottomRight, BottomLeft]\`.
2. **3D Metric Blockout Coordinates (meters)**:
   - Floor plane is \`Z = 0\`. \`+Z\` is vertical height upward.
   - \`X\` is horizontal left/right (\`-X\` left, \`+X\` right, \`0\` room center).
   - \`Y\` is depth forward into the hallway/room away from the camera (\`0\` near camera/origin, \`+Y\` toward back wall).

### 3. AVAILABLE 3D PRIMITIVES (Include ONLY primitives actually visible in the photo)
- \`roomShell\`: Main room/hallway enclosure + optional flat/barrel-vault/pitched-gable ceiling, overhead beams, and 45°-mitered 3D baseboards & crown moldings.
- \`sweptRails\`: Solid tubular handrails, multi-bend conduits with 90° elbows, or gravity-sagging cables mounted along a wall (\`left-wall-yz\`, \`right-wall-yz\`, or \`back-wall-xz\`) from \`p1Rel\` to \`p2Rel\`.
- \`wallCutouts\`: Ornate wrought-iron railings, balusters, radiators, or grilles floating parallel to a wall with transparent gaps between bars.
- \`wallReliefs\`: Wall features with optional arches (\`"rectangular" | "roman-arch" | "segmental-arch" | "gothic-arch"\`) and optional \`passThroughPortal: true\` to punch a real hole into a connected 3D annex corridor.
- \`sweptColumns\`: Vertical round/octagonal/square columns or pillars defined by 3 points on the photo (\`baseLeftRel\`, \`baseRightRel\` at the floor base, and \`topCenterRel\` at the top center).
- \`staircases\`: Straight stepped stairs (\`"stepped-stairs"\`), sloped ramps (\`"smooth-ramp"\`), \`"l-landing-90"\`, \`"u-switchback-180"\`, or \`"helical-spiral"\`.
- \`floorPrisms\`: N-point polygonal floor extrusions (L-shaped counters, hexagonal islands, angled bays).
- \`latheObjects\`: 360° revolved objects (\`"classical-column" | "pedestal-table" | "vase-planter" | "tapered-bollard"\`).
- \`cofferedArrays\`: \`rows × cols\` 3D coffered ceiling or wall panel grids on \`ceiling-xy\`, \`back-wall-xz\`, \`left-wall-yz\`, or \`right-wall-yz\`.
- \`curvedWalls\`: 3-point curved arc walls or bow-window bays defined by \`startRel\`, \`apexRel\`, \`endRel\`, and \`topApexRel\`.
- \`volumes\`: Cuboid 3D furniture, counters, crates, or island blocks on the floor.
- \`billboards\`: 2.5D polygon cutout standees for complex foreground silhouettes (people, plants, statues).

### 4. REQUIRED JSON OUTPUT SCHEMA
Respond with ONLY a JSON code block matching this exact structure (omit arrays that have 0 items in the photo):

\`\`\`json
{
  "roomShell": {
    "roomShellType": "interior-room",
    "roomWidthX": 3.2,
    "roomDepthY": 6.0,
    "roomHeightZ": 2.9,
    "ceilingClosureEnabled": true,
    "ceilingProfile": "flat",
    "ceilingBeamCount": 2,
    "ceilingBeamDrop": 0.18,
    "perimeterMoldingsEnabled": true,
    "baseboardProfile": "stepped-skirting",
    "crownProfile": "ogee-cornice"
  },
  "sweptRails": [
    {
      "name": "Left Wall Handrail",
      "hostWall": "left-wall-yz",
      "p1Rel": { "x": 0.14, "y": 0.64 },
      "p2Rel": { "x": 0.39, "y": 0.52 },
      "standOff": 0.08,
      "radius": 0.035,
      "profile": "round-pipe",
      "pathMode": "straight-elbows",
      "bracketCount": 3
    }
  ],
  "wallReliefs": [
    {
      "name": "Right Wall Arched Doorway Portal",
      "hostWall": "right-wall-yz",
      "quadRel": [
        { "x": 0.68, "y": 0.24 },
        { "x": 0.84, "y": 0.18 },
        { "x": 0.84, "y": 0.82 },
        { "x": 0.68, "y": 0.72 }
      ],
      "extrudeDepth": -0.20,
      "archType": "roman-arch",
      "passThroughPortal": true,
      "annexLength": 1.8
    }
  ],
  "wallCutouts": [],
  "sweptColumns": [],
  "staircases": [
    {
      "name": "Far Hallway Steps",
      "mode": "stepped-stairs",
      "stepCount": 6,
      "widthX": 1.8,
      "runDepthY": 1.8,
      "totalHeightZ": 1.05,
      "offsetX": 0.0,
      "offsetY": 2.4,
      "yawDeg": 0,
      "closedStringers": true
    }
  ],
  "cofferedArrays": [],
  "curvedWalls": [],
  "floorPrisms": [],
  "latheObjects": [],
  "volumes": [],
  "billboards": []
}
\`\`\``
}

/**
 * Returns a ready-to-test sample JSON blueprint for an architectural hallway
 * so users can test the AI Scene Architect parser immediately in one click.
 */
export function getSampleAIHallwayBlueprintJSON(): string {
  return JSON.stringify(
    {
      roomShell: {
        roomShellType: 'interior-room',
        roomWidthX: 3.6,
        roomDepthY: 5.4,
        roomHeightZ: 2.8,
        ceilingClosureEnabled: true,
        ceilingProfile: 'barrel-vault',
        ceilingVaultRise: 0.55,
        ceilingBeamCount: 3,
        ceilingBeamDrop: 0.18,
        perimeterMoldingsEnabled: true,
        baseboardProfile: 'stepped-skirting',
        crownProfile: 'ogee-cornice'
      },
      sweptRails: [
        {
          name: 'Left Corridor Handrail',
          hostWall: 'left-wall-yz',
          p1Rel: { x: 0.14, y: 0.63 },
          p2Rel: { x: 0.41, y: 0.51 },
          standOff: 0.08,
          radius: 0.035,
          profile: 'round-pipe',
          bracketCount: 3
        }
      ],
      wallReliefs: [
        {
          name: 'Back Arched Pass-Through Portal',
          hostWall: 'back-wall-xz',
          quadRel: [
            { x: 0.42, y: 0.27 },
            { x: 0.58, y: 0.27 },
            { x: 0.58, y: 0.66 },
            { x: 0.42, y: 0.66 }
          ],
          extrudeDepth: -0.22,
          archType: 'roman-arch',
          archRiseRatio: 0.35,
          passThroughPortal: true,
          annexLength: 1.8,
          annexWidthExpand: 0.35
        },
        {
          name: 'Right Wall Window Frame Ledge',
          hostWall: 'right-wall-yz',
          quadRel: [
            { x: 0.72, y: 0.28 },
            { x: 0.88, y: 0.22 },
            { x: 0.88, y: 0.56 },
            { x: 0.72, y: 0.52 }
          ],
          extrudeDepth: 0.1
        }
      ],
      sweptColumns: [
        {
          name: 'Right Corridor Pillar',
          baseLeftRel: { x: 0.64, y: 0.75 },
          baseRightRel: { x: 0.71, y: 0.75 },
          topCenterRel: { x: 0.675, y: 0.24 },
          profile: 'round-column'
        }
      ],
      staircases: [
        {
          name: 'Entryway 6-Step Flight',
          mode: 'stepped-stairs',
          stepCount: 6,
          widthX: 1.7,
          runDepthY: 1.8,
          totalHeightZ: 1.0,
          offsetX: 0,
          offsetY: 1.9,
          yawDeg: 0,
          closedStringers: true
        }
      ]
    },
    null,
    2
  )
}

/**
 * Extracts, validates, and converts an LLM's JSON response into a partial SceneBlockoutConfig.
 */
export function parseAndApplyAISceneJSON(
  rawText: string,
  currentConfig: SceneBlockoutConfig
): {
  ok: boolean
  updatedConfig?: Partial<SceneBlockoutConfig>
  summary: string
  error?: string
} {
  const trimmed = rawText.trim()
  if (!trimmed) {
    return {
      ok: false,
      summary: '',
      error: 'Paste the JSON response from your Vision AI first.'
    }
  }

  // Extract JSON object if wrapped in ```json ... ``` or surrounding prose
  let jsonCandidate = trimmed
  const fenceMatch = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed)
  if (fenceMatch?.[1]) {
    jsonCandidate = fenceMatch[1].trim()
  } else {
    const firstBrace = trimmed.indexOf('{')
    const lastBrace = trimmed.lastIndexOf('}')
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      jsonCandidate = trimmed.slice(firstBrace, lastBrace + 1)
    }
  }

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(jsonCandidate) as Record<string, unknown>
  } catch (e) {
    return {
      ok: false,
      summary: '',
      error: `Invalid JSON syntax: ${e instanceof Error ? e.message : 'Could not parse JSON'}`
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    return {
      ok: false,
      summary: '',
      error: 'JSON root must be an object.'
    }
  }

  const patch: Partial<SceneBlockoutConfig> = {
    enabled: true,
    showViewportHandles: true
  }
  const summaryParts: string[] = []

  // 1. Room Shell + Ceiling Closure, Vaults & Perimeter Moldings
  if (parsed.roomShell && typeof parsed.roomShell === 'object') {
    const rs = parsed.roomShell as Record<string, unknown>
    const shellType: RoomShellType =
      rs.roomShellType === 'interior-room' ||
      rs.roomShellType === 'corner-stage' ||
      rs.roomShellType === 'none'
        ? rs.roomShellType
        : currentConfig.roomShellType
    patch.roomShellType = shellType
    patch.roomWidthX = clampNum(rs.roomWidthX, 1.0, 20.0, currentConfig.roomWidthX)
    patch.roomDepthY = clampNum(rs.roomDepthY, 1.0, 20.0, currentConfig.roomDepthY)
    patch.roomHeightZ = clampNum(
      rs.roomHeightZ,
      1.2,
      12.0,
      currentConfig.roomHeightZ
    )
    if (typeof rs.ceilingClosureEnabled === 'boolean') {
      patch.ceilingClosureEnabled = rs.ceilingClosureEnabled
    }
    if (
      rs.ceilingProfile === 'flat' ||
      rs.ceilingProfile === 'barrel-vault' ||
      rs.ceilingProfile === 'pitched-gable'
    ) {
      patch.ceilingProfile = rs.ceilingProfile
    }
    if (rs.ceilingVaultRise !== undefined) {
      patch.ceilingVaultRise = clampNum(
        rs.ceilingVaultRise,
        0.15,
        2.5,
        currentConfig.ceilingVaultRise ?? 0.65
      )
    }
    if (rs.ceilingBeamCount !== undefined) {
      patch.ceilingBeamCount = Math.round(
        clampNum(rs.ceilingBeamCount, 0, 8, currentConfig.ceilingBeamCount)
      )
    }
    if (rs.ceilingBeamDrop !== undefined) {
      patch.ceilingBeamDrop = clampNum(
        rs.ceilingBeamDrop,
        0.04,
        0.6,
        currentConfig.ceilingBeamDrop
      )
    }
    if (typeof rs.perimeterMoldingsEnabled === 'boolean') {
      patch.perimeterMoldingsEnabled = rs.perimeterMoldingsEnabled
    }
    if (
      rs.baseboardProfile === 'stepped-skirting' ||
      rs.baseboardProfile === 'beveled-plinth' ||
      rs.baseboardProfile === 'tall-wainscot'
    ) {
      patch.baseboardProfile = rs.baseboardProfile
    }
    if (
      rs.crownProfile === 'ogee-cornice' ||
      rs.crownProfile === 'stepped-coving' ||
      rs.crownProfile === 'led-cove-tray'
    ) {
      patch.crownProfile = rs.crownProfile
    }
    summaryParts.push(
      `Room (${patch.roomWidthX.toFixed(1)}×${patch.roomDepthY.toFixed(1)}×${patch.roomHeightZ.toFixed(1)}m${patch.ceilingClosureEnabled ? ' + Ceiling' : ''}${patch.perimeterMoldingsEnabled ? ' + Trim' : ''})`
    )
  }

  // 2. 3D Blockout Volumes (Boxes)
  if (Array.isArray(parsed.volumes) && parsed.volumes.length > 0) {
    const volumes: BlockoutVolume[] = parsed.volumes
      .slice(0, 12)
      .map((item, idx) => {
        const v = (item && typeof item === 'object' ? item : {}) as Record<
          string,
          unknown
        >
        return {
          id: `ai-vol-${idx + 1}`,
          name:
            typeof v.name === 'string' && v.name.trim()
              ? v.name.trim()
              : `AI Box ${idx + 1}`,
          widthX: clampNum(v.widthX, 0.15, 10, 1.0),
          depthY: clampNum(v.depthY, 0.15, 10, 1.0),
          heightZ: clampNum(v.heightZ, 0.15, 8, 1.0),
          offsetX: clampNum(v.offsetX, -10, 10, 0),
          offsetY: clampNum(v.offsetY, -10, 10, 1.0),
          offsetZ: clampNum(v.offsetZ, 0, 6, 0),
          rotationZ: clampNum(v.rotationZ, -180, 180, 0)
        }
      })
    patch.volumes = volumes
    patch.selectedVolumeId = volumes[0]?.id ?? null
    summaryParts.push(`${volumes.length} Box${volumes.length > 1 ? 'es' : ''}`)
  }

  // 3. Option 1: 3D Swept Handrails, Multi-Bend Conduits & Catenary Cables
  if (Array.isArray(parsed.sweptRails) && parsed.sweptRails.length > 0) {
    const rails: SweptWallRail[] = parsed.sweptRails
      .slice(0, 10)
      .map((item, idx) => {
        const r = (item && typeof item === 'object' ? item : {}) as Record<
          string,
          unknown
        >
        const profile: SweptRailProfile =
          r.profile === 'round-pipe' ||
          r.profile === 'square-bar' ||
          r.profile === 'molding-bevel'
            ? r.profile
            : 'round-pipe'
        const pathMode: SweptRailPathMode =
          r.pathMode === 'smooth-spline' ||
          r.pathMode === 'catenary-sag' ||
          r.pathMode === 'straight-or-elbows'
            ? r.pathMode
            : 'straight-or-elbows'
        return {
          id: `ai-rail-${idx + 1}`,
          name:
            typeof r.name === 'string' && r.name.trim()
              ? r.name.trim()
              : `AI Handrail ${idx + 1}`,
          hostWall: parseHostWall(r.hostWall, 'left-wall-yz'),
          p1Rel: clampPointRel(r.p1Rel, { x: 0.16, y: 0.62 }),
          p2Rel: clampPointRel(r.p2Rel, { x: 0.44, y: 0.51 }),
          waypointsRel: Array.isArray(r.waypointsRel)
            ? r.waypointsRel
                .slice(0, 6)
                .map((wp) => clampPointRel(wp, { x: 0.3, y: 0.56 }))
            : [],
          pathMode,
          elbowRadius: clampNum(r.elbowRadius, 0, 0.35, 0.08),
          catenarySag: clampNum(r.catenarySag, -0.8, 0.8, 0.22),
          standOff: clampNum(r.standOff, 0.01, 0.45, 0.08),
          radius: clampNum(r.radius, 0.01, 0.18, 0.035),
          profile,
          bracketCount: Math.round(clampNum(r.bracketCount, 0, 6, 3))
        }
      })
    patch.sweptRailsEnabled = true
    patch.sweptRails = rails
    patch.selectedSweptRailId = rails[0]?.id ?? null
    summaryParts.push(`${rails.length} Handrail${rails.length > 1 ? 's' : ''}`)
  }

  // 4. Option 2: Wall-Parallel Cutout Layers
  if (Array.isArray(parsed.wallCutouts) && parsed.wallCutouts.length > 0) {
    const cutouts: WallParallelCutout[] = parsed.wallCutouts
      .slice(0, 8)
      .map((item, idx) => {
        const wc = (item && typeof item === 'object' ? item : {}) as Record<
          string,
          unknown
        >
        const rawQuad = Array.isArray(wc.quadRel) ? wc.quadRel : []
        const quadRel: [Point2D, Point2D, Point2D, Point2D] = [
          clampPointRel(rawQuad[0], { x: 0.15, y: 0.46 }),
          clampPointRel(rawQuad[1], { x: 0.42, y: 0.4 }),
          clampPointRel(rawQuad[2], { x: 0.42, y: 0.72 }),
          clampPointRel(rawQuad[3], { x: 0.15, y: 0.82 })
        ]
        const alphaMode: WallCutoutAlphaMode =
          wc.alphaMode === 'dark-bars' ||
          wc.alphaMode === 'bright-bars' ||
          wc.alphaMode === 'edge-contrast' ||
          wc.alphaMode === 'full-strip'
            ? wc.alphaMode
            : 'edge-contrast'
        return {
          id: `ai-wc-${idx + 1}`,
          name:
            typeof wc.name === 'string' && wc.name.trim()
              ? wc.name.trim()
              : `AI Wall Cutout ${idx + 1}`,
          hostWall: parseHostWall(wc.hostWall, 'left-wall-yz'),
          quadRel,
          standOff: clampNum(wc.standOff, 0.02, 0.5, 0.09),
          alphaMode,
          threshold: clampNum(wc.threshold, 0.08, 0.85, 0.28),
          featherPx: clampNum(wc.featherPx, 0, 8, 1.5)
        }
      })
    patch.wallCutoutsEnabled = true
    patch.wallCutouts = cutouts
    patch.selectedWallCutoutId = cutouts[0]?.id ?? null
    summaryParts.push(
      `${cutouts.length} Wall Cutout${cutouts.length > 1 ? 's' : ''}`
    )
  }

  // 5. Option 3: Wall Relief, Arched Portals & Pass-Through Annexes
  if (Array.isArray(parsed.wallReliefs) && parsed.wallReliefs.length > 0) {
    const reliefs: WallReliefExtrusion[] = parsed.wallReliefs
      .slice(0, 10)
      .map((item, idx) => {
        const rel = (item && typeof item === 'object' ? item : {}) as Record<
          string,
          unknown
        >
        const rawQuad = Array.isArray(rel.quadRel) ? rel.quadRel : []
        const quadRel: [Point2D, Point2D, Point2D, Point2D] = [
          clampPointRel(rawQuad[0], { x: 0.38, y: 0.26 }),
          clampPointRel(rawQuad[1], { x: 0.62, y: 0.26 }),
          clampPointRel(rawQuad[2], { x: 0.62, y: 0.58 }),
          clampPointRel(rawQuad[3], { x: 0.38, y: 0.58 })
        ]
        const archType: WallReliefArchType =
          rel.archType === 'roman-arch' ||
          rel.archType === 'segmental-arch' ||
          rel.archType === 'gothic-arch'
            ? rel.archType
            : 'rectangular'
        return {
          id: `ai-relief-${idx + 1}`,
          name:
            typeof rel.name === 'string' && rel.name.trim()
              ? rel.name.trim()
              : `AI Wall Relief ${idx + 1}`,
          hostWall: parseHostWall(rel.hostWall, 'back-wall-xz'),
          quadRel,
          extrudeDepth: clampNum(rel.extrudeDepth, -0.6, 0.6, -0.18),
          archType,
          archRiseRatio: clampNum(rel.archRiseRatio, 0.15, 0.6, 0.35),
          passThroughPortal:
            typeof rel.passThroughPortal === 'boolean'
              ? rel.passThroughPortal
              : false,
          annexLength: clampNum(rel.annexLength, 0.4, 6.0, 1.8),
          annexWidthExpand: clampNum(rel.annexWidthExpand, 0, 2.0, 0.35),
          annexOpenEnd:
            typeof rel.annexOpenEnd === 'boolean' ? rel.annexOpenEnd : false
        }
      })
    patch.wallReliefsEnabled = true
    patch.wallReliefs = reliefs
    patch.selectedWallReliefId = reliefs[0]?.id ?? null
    summaryParts.push(
      `${reliefs.length} Wall Relief/Portal${reliefs.length > 1 ? 's' : ''}`
    )
  }

  // 6. Option 4: 3-Sweep Columns & Pillars
  if (Array.isArray(parsed.sweptColumns) && parsed.sweptColumns.length > 0) {
    const cols: SweptCylinderColumn[] = parsed.sweptColumns
      .slice(0, 8)
      .map((item, idx) => {
        const c = (item && typeof item === 'object' ? item : {}) as Record<
          string,
          unknown
        >
        const profile: SweptColumnProfile =
          c.profile === 'round-column' ||
          c.profile === 'octagonal-pillar' ||
          c.profile === 'square-pillar'
            ? c.profile
            : 'round-column'
        return {
          id: `ai-col-${idx + 1}`,
          name:
            typeof c.name === 'string' && c.name.trim()
              ? c.name.trim()
              : `AI Pillar ${idx + 1}`,
          baseLeftRel: clampPointRel(c.baseLeftRel, { x: 0.64, y: 0.74 }),
          baseRightRel: clampPointRel(c.baseRightRel, { x: 0.72, y: 0.74 }),
          topCenterRel: clampPointRel(c.topCenterRel, { x: 0.68, y: 0.25 }),
          baseZ: clampNum(c.baseZ, 0, 3, 0),
          profile
        }
      })
    patch.sweptColumnsEnabled = true
    patch.sweptColumns = cols
    patch.selectedSweptColumnId = cols[0]?.id ?? null
    summaryParts.push(`${cols.length} Pillar${cols.length > 1 ? 's' : ''}`)
  }

  // 7. Option 5: Parametric 3D Staircases (Straight, L-Landing, U-Switchback, Helical) & Ramps
  if (Array.isArray(parsed.staircases) && parsed.staircases.length > 0) {
    const stairs: StaircaseExtrusion[] = parsed.staircases
      .slice(0, 6)
      .map((item, idx) => {
        const st = (item && typeof item === 'object' ? item : {}) as Record<
          string,
          unknown
        >
        const mode: StaircaseMode =
          st.mode === 'smooth-ramp' ||
          st.mode === 'l-landing-90' ||
          st.mode === 'u-switchback-180' ||
          st.mode === 'helical-spiral'
            ? st.mode
            : 'stepped-stairs'
        const turnDirection: StairTurnDirection =
          st.turnDirection === 'right-cw' ? 'right-cw' : 'left-ccw'
        return {
          id: `ai-stairs-${idx + 1}`,
          name:
            typeof st.name === 'string' && st.name.trim()
              ? st.name.trim()
              : `AI Staircase ${idx + 1}`,
          mode,
          stepCount: Math.round(clampNum(st.stepCount, 2, 28, 8)),
          widthX: clampNum(st.widthX, 0.4, 8.0, 1.8),
          runDepthY: clampNum(st.runDepthY, 0.4, 10.0, 2.0),
          totalHeightZ: clampNum(st.totalHeightZ, 0.2, 6.0, 1.2),
          offsetX: clampNum(st.offsetX, -8, 8, 0),
          offsetY: clampNum(st.offsetY, -6, 10, 1.5),
          offsetZ: clampNum(st.offsetZ, 0, 4, 0),
          yawDeg: clampNum(st.yawDeg, -180, 180, 0),
          closedStringers:
            typeof st.closedStringers === 'boolean' ? st.closedStringers : true,
          turnDirection,
          spiralArcDeg: clampNum(st.spiralArcDeg, 60, 360, 180),
          innerRadius: clampNum(st.innerRadius, 0.05, 1.5, 0.25)
        }
      })
    patch.staircasesEnabled = true
    patch.staircases = stairs
    patch.selectedStaircaseId = stairs[0]?.id ?? null
    summaryParts.push(`${stairs.length} Staircase${stairs.length > 1 ? 's' : ''}`)
  }

  // 8. Option 6: N-Point Floor Polygon Prisms
  if (Array.isArray(parsed.floorPrisms) && parsed.floorPrisms.length > 0) {
    const prisms: FloorPolygonPrism[] = parsed.floorPrisms
      .slice(0, 8)
      .map((item, idx) => {
        const fp = (item && typeof item === 'object' ? item : {}) as Record<
          string,
          unknown
        >
        const rawPoly = Array.isArray(fp.polygonRel) ? fp.polygonRel : []
        const polygonRel: Point2D[] =
          rawPoly.length >= 3
            ? rawPoly
                .slice(0, 12)
                .map((pt) => clampPointRel(pt, { x: 0.5, y: 0.7 }))
            : [
                { x: 0.32, y: 0.68 },
                { x: 0.52, y: 0.65 },
                { x: 0.56, y: 0.82 },
                { x: 0.28, y: 0.85 }
              ]
        return {
          id: `ai-prism-${idx + 1}`,
          name:
            typeof fp.name === 'string' && fp.name.trim()
              ? fp.name.trim()
              : `AI Floor Prism ${idx + 1}`,
          polygonRel,
          baseZ: clampNum(fp.baseZ, 0, 3, 0),
          heightZ: clampNum(fp.heightZ, 0.05, 5, 0.9),
          bevelTop: clampNum(fp.bevelTop, 0, 0.25, 0.03)
        }
      })
    patch.floorPrismsEnabled = true
    patch.floorPrisms = prisms
    patch.selectedFloorPrismId = prisms[0]?.id ?? null
    summaryParts.push(`${prisms.length} Floor Prism${prisms.length > 1 ? 's' : ''}`)
  }

  // 9. Option 7: 360° Revolved Lathe Objects
  if (Array.isArray(parsed.latheObjects) && parsed.latheObjects.length > 0) {
    const lathes: RevolvedLatheObject[] = parsed.latheObjects
      .slice(0, 8)
      .map((item, idx) => {
        const lo = (item && typeof item === 'object' ? item : {}) as Record<
          string,
          unknown
        >
        const preset: LathePresetType =
          lo.preset === 'classical-column' ||
          lo.preset === 'pedestal-table' ||
          lo.preset === 'vase-planter' ||
          lo.preset === 'tapered-bollard' ||
          lo.preset === 'custom-profile'
            ? lo.preset
            : 'classical-column'
        return {
          id: `ai-lathe-${idx + 1}`,
          name:
            typeof lo.name === 'string' && lo.name.trim()
              ? lo.name.trim()
              : `AI Lathe Object ${idx + 1}`,
          baseCenterRel: clampPointRel(lo.baseCenterRel, { x: 0.5, y: 0.78 }),
          baseEdgeRel: clampPointRel(lo.baseEdgeRel, { x: 0.56, y: 0.78 }),
          topCenterRel: clampPointRel(lo.topCenterRel, { x: 0.5, y: 0.42 }),
          baseZ: clampNum(lo.baseZ, 0, 3, 0),
          preset,
          profileRadii: [1.0, 0.45, 0.45, 1.15],
          radialSegments: 24
        }
      })
    patch.latheObjectsEnabled = true
    patch.latheObjects = lathes
    patch.selectedLatheObjectId = lathes[0]?.id ?? null
    summaryParts.push(`${lathes.length} Lathe Object${lathes.length > 1 ? 's' : ''}`)
  }

  // 10. Option 8: 3D Coffered Ceiling & Repeating Wall Panel Grids
  if (Array.isArray(parsed.cofferedArrays) && parsed.cofferedArrays.length > 0) {
    const grids: CofferedPanelArray[] = parsed.cofferedArrays
      .slice(0, 8)
      .map((item, idx) => {
        const ca = (item && typeof item === 'object' ? item : {}) as Record<
          string,
          unknown
        >
        const rawQuad = Array.isArray(ca.quadRel) ? ca.quadRel : []
        const quadRel: [Point2D, Point2D, Point2D, Point2D] = [
          clampPointRel(rawQuad[0], { x: 0.25, y: 0.08 }),
          clampPointRel(rawQuad[1], { x: 0.75, y: 0.08 }),
          clampPointRel(rawQuad[2], { x: 0.65, y: 0.28 }),
          clampPointRel(rawQuad[3], { x: 0.35, y: 0.28 })
        ]
        return {
          id: `ai-coffer-${idx + 1}`,
          name:
            typeof ca.name === 'string' && ca.name.trim()
              ? ca.name.trim()
              : `AI Coffered Grid ${idx + 1}`,
          hostWall: parseHostWall(ca.hostWall, 'ceiling-xy'),
          quadRel,
          rows: Math.round(clampNum(ca.rows, 1, 8, 3)),
          cols: Math.round(clampNum(ca.cols, 1, 8, 3)),
          stileWidthRatio: clampNum(ca.stileWidthRatio, 0.04, 0.35, 0.14),
          recessDepth: clampNum(ca.recessDepth, -0.45, 0.35, -0.14),
          bevelMarginRatio: clampNum(ca.bevelMarginRatio, 0.02, 0.35, 0.12)
        }
      })
    patch.cofferedArraysEnabled = true
    patch.cofferedArrays = grids
    patch.selectedCofferedArrayId = grids[0]?.id ?? null
    summaryParts.push(`${grids.length} Coffered Grid${grids.length > 1 ? 's' : ''}`)
  }

  // 11. Option 9: 3-Point Curved Arc Walls & Bow Bays
  if (Array.isArray(parsed.curvedWalls) && parsed.curvedWalls.length > 0) {
    const cWalls: CurvedArcWall[] = parsed.curvedWalls
      .slice(0, 6)
      .map((item, idx) => {
        const cw = (item && typeof item === 'object' ? item : {}) as Record<
          string,
          unknown
        >
        return {
          id: `ai-arcwall-${idx + 1}`,
          name:
            typeof cw.name === 'string' && cw.name.trim()
              ? cw.name.trim()
              : `AI Curved Wall ${idx + 1}`,
          startRel: clampPointRel(cw.startRel, { x: 0.24, y: 0.76 }),
          apexRel: clampPointRel(cw.apexRel, { x: 0.48, y: 0.64 }),
          endRel: clampPointRel(cw.endRel, { x: 0.72, y: 0.76 }),
          topApexRel: clampPointRel(cw.topApexRel, { x: 0.48, y: 0.28 }),
          baseZ: clampNum(cw.baseZ, 0, 3, 0),
          heightZ: clampNum(cw.heightZ, 0.2, 6.0, 2.4),
          thickness: clampNum(cw.thickness, 0.04, 1.0, 0.18),
          segments: Math.round(clampNum(cw.segments, 8, 48, 24))
        }
      })
    patch.curvedWallsEnabled = true
    patch.curvedWalls = cWalls
    patch.selectedCurvedWallId = cWalls[0]?.id ?? null
    summaryParts.push(`${cWalls.length} Curved Wall${cWalls.length > 1 ? 's' : ''}`)
  }

  // 12. Foreground Cutout Billboards
  if (Array.isArray(parsed.billboards) && parsed.billboards.length > 0) {
    const bbs: BillboardCutout[] = parsed.billboards
      .slice(0, 8)
      .map((item, idx) => {
        const b = (item && typeof item === 'object' ? item : {}) as Record<
          string,
          unknown
        >
        const rawPoly = Array.isArray(b.polygonRel) ? b.polygonRel : []
        const polygonRel: Point2D[] =
          rawPoly.length >= 3
            ? rawPoly
                .slice(0, 16)
                .map((pt) => clampPointRel(pt, { x: 0.5, y: 0.5 }))
            : [
                { x: 0.44, y: 0.34 },
                { x: 0.56, y: 0.34 },
                { x: 0.58, y: 0.74 },
                { x: 0.42, y: 0.74 }
              ]
        return {
          id: `ai-cutout-${idx + 1}`,
          name:
            typeof b.name === 'string' && b.name.trim()
              ? b.name.trim()
              : `AI Cutout ${idx + 1}`,
          baseX: clampNum(b.baseX, -6, 6, 0.8),
          baseY: clampNum(b.baseY, -6, 6, 1.0),
          baseZ: 0,
          width: clampNum(b.width, 0.2, 5, 1.1),
          height: clampNum(b.height, 0.3, 5, 1.6),
          yawDeg: 0,
          faceCamera: true,
          autoFitFromPolygon: true,
          featherPx: 2,
          polygonRel
        }
      })
    patch.billboardsEnabled = true
    patch.billboards = bbs
    patch.selectedBillboardId = bbs[0]?.id ?? null
    summaryParts.push(`${bbs.length} Cutout${bbs.length > 1 ? 's' : ''}`)
  }

  if (summaryParts.length === 0) {
    return {
      ok: false,
      summary: '',
      error:
        'JSON parsed, but no recognized fSpy scene keys (roomShell, sweptRails, wallReliefs, staircases, etc.) were found.'
    }
  }

  return {
    ok: true,
    updatedConfig: patch,
    summary: `AI Scene Applied: ${summaryParts.join(' + ')}`
  }
}
