/**
 * fSpy Studio — Quick-Start Visual Guide Modal
 * Explains how to use every calibration, 3D reconstruction, architectural detail,
 * AI Scene Bridge, PBR material, and 2.5D camera animation tool in seconds.
 */

import { useState } from 'react'
import { useFSpyStore } from '../../store/use-fspy-store'
import {
  BookOpen,
  Box,
  CheckCircle2,
  Compass,
  Layers,
  Sparkles,
  Video,
  Wand2,
  X
} from 'lucide-react'

type GuideTabId =
  | 'quickstart'
  | 'blockout'
  | 'hallway-tools'
  | 'ai-bridge'
  | 'pbr-export'

interface ToolCardProps {
  badge: string
  badgeColor: string
  title: string
  bestFor: string
  steps: string[]
  tip?: string
}

function GuideToolCard({
  badge,
  badgeColor,
  title,
  bestFor,
  steps,
  tip
}: ToolCardProps) {
  return (
    <div className='rounded-lg border border-zinc-800/90 bg-zinc-900/60 p-3.5 space-y-2'>
      <div className='flex items-center justify-between gap-2'>
        <h4 className='text-xs font-semibold text-zinc-100'>{title}</h4>
        <span
          className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border ${badgeColor}`}
        >
          {badge}
        </span>
      </div>
      <p className='text-[11px] text-zinc-300 leading-relaxed'>
        <strong className='text-zinc-100'>What it does:</strong> {bestFor}
      </p>
      <ol className='space-y-1 text-[11px] text-zinc-400 list-decimal list-inside'>
        {steps.map((step, i) => (
          <li key={i} className='leading-relaxed'>
            <span className='text-zinc-300'>{step}</span>
          </li>
        ))}
      </ol>
      {tip && (
        <div className='text-[10.5px] text-emerald-300/90 bg-emerald-950/30 border border-emerald-500/25 rounded px-2.5 py-1.5'>
          <strong>Pro Tip:</strong> {tip}
        </div>
      )}
    </div>
  )
}

export default function GuideModal() {
  const activeModal = useFSpyStore((s) => s.activeModal)
  const setActiveModal = useFSpyStore((s) => s.setActiveModal)
  const [activeTab, setActiveTab] = useState<GuideTabId>('quickstart')

  if (activeModal !== 'guide') return null

  const tabs: { id: GuideTabId; label: string; icon: typeof Compass }[] = [
    { id: 'quickstart', label: '1. Camera Calibration', icon: Compass },
    { id: 'blockout', label: '2. 3D Room, Vaults, Trim & Cutouts', icon: Box },
    { id: 'hallway-tools', label: '3. Hallway & Geometry Tools (9)', icon: Layers },
    { id: 'ai-bridge', label: '4. AI Scene Bridge', icon: Wand2 },
    { id: 'pbr-export', label: '5. PBR, 2.5D Video & Export', icon: Video }
  ]

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4'
      onClick={() => setActiveModal(null)}
    >
      <div
        className='w-full max-w-4xl max-h-[88vh] flex flex-col rounded-xl bg-[#121217] border border-emerald-500/35 shadow-2xl overflow-hidden'
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className='px-5 py-3.5 border-b border-zinc-800/90 flex items-center justify-between bg-gradient-to-r from-emerald-950/40 via-zinc-900 to-zinc-900'>
          <div className='flex items-center gap-2.5'>
            <div className='w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shadow-[0_0_12px_rgba(16,185,129,0.35)]'>
              <BookOpen className='w-4 h-4 text-emerald-300' />
            </div>
            <div>
              <div className='flex items-center gap-2'>
                <h2 className='text-sm font-semibold text-zinc-100'>
                  fSpy Studio — Interactive Tool Guide
                </h2>
                <span className='text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'>
                  All Enhancements Optional
                </span>
              </div>
              <p className='text-[11px] text-zinc-400'>
                Understand every tool in 30 seconds — from classic camera matching to full Photo-to-3D reconstruction.
              </p>
            </div>
          </div>

          <button
            type='button'
            onClick={() => setActiveModal(null)}
            className='p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors cursor-pointer'
            title='Close Guide'
          >
            <X className='w-4 h-4' />
          </button>
        </div>

        {/* Category Tabs */}
        <div className='px-4 pt-2.5 pb-2 border-b border-zinc-800/80 bg-[#0e0e12] flex flex-wrap gap-1.5'>
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isSelected = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type='button'
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-500 text-zinc-950 font-semibold shadow-[0_0_14px_rgba(16,185,129,0.35)]'
                    : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800'
                }`}
              >
                <Icon className='w-3.5 h-3.5' />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>

        {/* Body Content */}
        <div className='flex-1 overflow-y-auto p-5 space-y-4'>
          {activeTab === 'quickstart' && (
            <div className='space-y-3.5'>
              <div className='rounded-lg bg-emerald-950/25 border border-emerald-500/30 p-3 flex items-start gap-2.5'>
                <CheckCircle2 className='w-4 h-4 text-emerald-400 shrink-0 mt-0.5' />
                <div className='text-xs text-zinc-200 leading-relaxed'>
                  <strong>The 60-Second Core Workflow:</strong> Load any photo (or click{' '}
                  <span className='text-amber-300 font-medium'>Example</span> in the top bar), align the colored vanishing-point lines along parallel architectural edges, and place the 3D origin crosshair on the floor. Every 3D tool in fSpy uses this solved camera automatically.
                </div>
              </div>

              <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
                <GuideToolCard
                  badge='Core fSpy'
                  badgeColor='bg-amber-500/15 text-amber-300 border-amber-500/30'
                  title='Vanishing Point Lines & 3D Origin'
                  bestFor='Solves exact camera focal length (FOV), 3D rotation, and horizon tilt from parallel lines in your photo.'
                  steps={[
                    'Drag the two Red lines (X axis) along two parallel edges on the floor/wall (e.g. left & right hallway floorboards).',
                    'Drag the two Green lines (Y axis) along edges perpendicular to the Red lines (or vertical Blue Z edges).',
                    'Drag the yellow/RGB 3D Origin crosshair to a corner on the floor to anchor (0, 0, 0) in 3D space.'
                  ]}
                  tip='Hold Shift while dragging any point to activate the high-zoom precision loupe.'
                />

                <GuideToolCard
                  badge='Opt-In Solver'
                  badgeColor='bg-sky-500/15 text-sky-300 border-sky-500/30'
                  title='Multi-Line SVD Solver & Edge Snapping'
                  bestFor='Lets you add 3 to 8+ lines per vanishing point with sub-pixel Canny edge snapping and per-line error degrees.'
                  steps={[
                    'Enable "Multi-line least-squares solver" in the left panel to unlock [+ Line] buttons for VP1, VP2, and VP3.',
                    'Enable "Sub-pixel edge snapping" (or click "Auto-Align VP Lines") so handles magnetically snap to real edges in the photo.',
                    'Turn on "Show residual error HUD" to see which line has the highest angular error.'
                  ]}
                />

                <GuideToolCard
                  badge='Opt-In Optics'
                  badgeColor='bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                  title='Radial Lens Distortion (k1, k2)'
                  bestFor='Removes wide-angle GoPro/smartphone barrel or pincushion curvature before solving the camera.'
                  steps={[
                    'Enable "Undistort lens (k1, k2)" in the left panel.',
                    'Click "Auto-Estimate k1 from VP Lines" or adjust the k1/k2 sliders until bowed architectural edges look straight.',
                    'Export the undistorted high-res PNG reference plate if needed for Blender.'
                  ]}
                />

                <GuideToolCard
                  badge='Opt-In Measure'
                  badgeColor='bg-teal-500/15 text-teal-300 border-teal-500/30'
                  title='Reference Distance & 3D World Tape Measure'
                  bestFor='Locks the scene to real-world metric scale (meters/feet) and measures any distance on the floor or walls.'
                  steps={[
                    'Set "Reference distance" along X, Y, or Z (e.g., set a doorway height to 2.1m or floor width to 3.0m).',
                    'Enable "3D World Tape Measure", pick Floor XY or Wall XZ/YZ, and drag R1 -> R2 on the photo to verify real-world measurements.'
                  ]}
                />
              </div>
            </div>
          )}

          {activeTab === 'blockout' && (
            <div className='space-y-3.5'>
              <div className='rounded-lg bg-sky-950/25 border border-sky-500/30 p-3 text-xs text-zinc-200 leading-relaxed'>
                <strong>How Photo-to-3D Scene Reconstruction Works:</strong> Once your camera is calibrated, enable{' '}
                <span className='text-sky-300 font-semibold'>3D Scene Blockout & Photo Projection</span> in the left sidebar. fSpy projects your photograph directly onto the 3D geometry like a slide projector from the solved camera position.
              </div>

              <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
                <GuideToolCard
                  badge='Room + Vaults + Trim'
                  badgeColor='bg-sky-500/15 text-sky-300 border-sky-500/30'
                  title='Room Shell, Vaulted Ceiling & 45° Mitered Trim'
                  bestFor='Encloses the background floor, walls, flat/barrel-vault/pitched-gable ceiling, and optional 45°-mitered 3D baseboards & crown moldings.'
                  steps={[
                    'Choose "Corner Stage (Floor + 2 Walls)" or "5-Wall Interior Room Shell" and adjust Width X, Depth Y, and Height Z.',
                    'Check "Close Ceiling Plane (Optional)" and pick Flat Horizontal, 3D Barrel Vault, or Pitched Gable + overhead ribs.',
                    'Check "3D Baseboard & Crown Trim (Optional)" to sweep stepped skirting boards, chair rails, and ogee crown cornices with 45° corner miters and automatic doorway gap clipping.'
                  ]}
                />

                <GuideToolCard
                  badge='SketchUp Style'
                  badgeColor='bg-amber-500/15 text-amber-300 border-amber-500/30'
                  title='3D Boxes with On-Photo Push/Pull Handles'
                  bestFor='Reconstructing boxy objects on the floor (desks, counters, cabinets, crates, beds, buildings).'
                  steps={[
                    'Click "Draw" to drag a new box footprint directly on the floor, or click "+ Add".',
                    'Drag the on-photo handles directly on your image: "XY" moves the box across the floor, "W" & "D" resize width/depth, "Z↑" pulls the 3D roof height up/down, and "Yaw" rotates it.',
                    'Click "Inspect 3D Orbit" at any time to freely orbit around your textured 3D scene.'
                  ]}
                />

                <GuideToolCard
                  badge='2.5D Standees'
                  badgeColor='bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  title='3D Cutout Billboards (Polygon Silhouette)'
                  bestFor='Curved or organic foreground objects that aren’t boxes (people, trees, statues, chairs, streetlamps).'
                  steps={[
                    'Enable "Enable 3D cutout standees" and click "+ Cutout".',
                    'Drag the green polygon points (P1..P6) around the object’s silhouette on the photo (use "+ Pt" for up to 12 vertices).',
                    'With "Auto-Place on 3D Floor" checked, fSpy raycasts the bottom of your mask onto the floor and stands the alpha-masked cutout upright in 3D!'
                  ]}
                />

                <GuideToolCard
                  badge='De-Ghosting'
                  badgeColor='bg-purple-500/15 text-purple-300 border-purple-500/30'
                  title='Auto-Heal Wall Behind Cutouts & Boxes'
                  bestFor='Stops foreground cutouts, boxes, handrails, and pillars from appearing "double-printed" on the background wall when the camera moves.'
                  steps={[
                    'Check "Auto-Heal Wall Behind Cutouts & Boxes" inside the 3D Scene Blockout panel.',
                    'fSpy automatically masks the 2D silhouettes of your foreground objects and inpaints the room shell walls/floor behind them using boundary-extrapolated harmonic healing.'
                  ]}
                />
              </div>
            </div>
          )}

          {activeTab === 'hallway-tools' && (
            <div className='space-y-3.5'>
              <div className='rounded-lg bg-zinc-900 border border-zinc-700/80 p-3 text-xs text-zinc-200 leading-relaxed'>
                <strong>Which Hallway / Architectural Geometry Tool Should I Enable?</strong> All 9 tools below are{' '}
                <span className='text-emerald-300 font-semibold'>strictly optional</span>. Pick only the tool that matches the specific feature you want to pop into 3D without manual 3D modeling:
              </div>

              <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
                <GuideToolCard
                  badge='Tool 1 · Rose'
                  badgeColor='bg-rose-500/20 text-rose-300 border-rose-500/35'
                  title='1. 3D Swept Rail, 90° Elbows & Catenary Cable'
                  bestFor='Solid hallway handrails, multi-bend conduits with 90° filleted elbows, and gravity-sagging hanging cables or string lights.'
                  steps={[
                    'Enable "2-click 3D wall rails" and select the Host Wall and Path Mode (Straight / 90° Elbows, Smooth Spline, or Gravity Catenary Sag).',
                    'Drag "A" (Start) and "B" (End) along the rail, or click "+ Bend" to add draggable intermediate elbow waypoints (B1, B2…).',
                    'Adjust "Stand-Off", "Thickness", "Cable Sag", and "Brackets" (0–6 3D wall mounts).'
                  ]}
                />

                <GuideToolCard
                  badge='Tool 2 · Purple'
                  badgeColor='bg-purple-500/20 text-purple-300 border-purple-500/35'
                  title='2. Wall-Parallel Offset Cutout Layer'
                  bestFor='Ornate wrought-iron railings, balusters, radiators, grilles, or wall signs where you want see-through gaps between bars.'
                  steps={[
                    'Enable "wall-parallel cutouts" and pick the Host Wall.',
                    'Drag the 4 purple corners (TL, TR, BR, BL) around the railing or fixture.',
                    'Pick a "Gap Alpha Key" mode (e.g. Auto Contrast Bars or Keep Dark Iron Bars) and adjust "Stand-Off" so the railing floats in 3D in front of the wall.'
                  ]}
                />

                <GuideToolCard
                  badge='Tool 3 · Cyan'
                  badgeColor='bg-cyan-500/20 text-cyan-300 border-cyan-500/35'
                  title='3. Wall Relief, Arched Alcove & Open Portal Annex'
                  bestFor='Protruding sills (+Depth), recessed arched doorways (-Depth), OR true pass-through portals that punch a hole in the wall into a connected 3D annex corridor.'
                  steps={[
                    'Enable "wall relief / alcoves", choose the Host Wall, and select a Top Arch Profile (Rectangular, Roman Arch, Segmental Arch, or Gothic Arch).',
                    'Drag the 4 cyan corners (TL, TR, BR, BL) around the doorway, window, or arched opening.',
                    'Check "Punch Open Portal + 3D Annex Room" to cut a real hole straight through the host wall and extrude a connected 3D side hallway or room behind it!'
                  ]}
                />

                <GuideToolCard
                  badge='Tool 4 · Amber'
                  badgeColor='bg-yellow-500/20 text-yellow-300 border-yellow-500/35'
                  title='4. "3-Sweep" Pillar & Column Snapper'
                  bestFor='Freestanding or wall-engaged cylindrical columns, octagonal pillars, square columns, and vertical pipes.'
                  steps={[
                    'Enable "3-Sweep 3D columns" and choose Round Cylinder, Octagonal Pillar, or Square Column.',
                    'Drag "Base L" and "Base R" across the bottom of the column on the floor to solve its 3D position and diameter (Ø).',
                    'Drag "T↑" to the top center of the column to solve its exact 3D height (H).'
                  ]}
                />

                <GuideToolCard
                  badge='Tool 5 · Emerald'
                  badgeColor='bg-emerald-500/20 text-emerald-300 border-emerald-500/35'
                  title='5. Straight, L-Landing, U-Switchback & Spiral Stairs'
                  bestFor='Straight flights of stairs, sloped ramps, 90° L-landing stairs, 180° U-switchback stairs, and helical/spiral staircases.'
                  steps={[
                    'Enable "3D stairs / ramps" and pick Straight Stepped, Smooth Ramp, 90° L-Landing, 180° U-Switchback, or Helical Spiral.',
                    'Drag "Stair Base XY" on the photo to place the bottom step, "Run" & "W" to match the footprint, and "Top H↑" to match the top height.',
                    'Adjust "Steps" (2–28), "Turn Direction (Left/Right)", or "Sweep Arc °" & "Core Radius" for spiral stairs.'
                  ]}
                />

                <GuideToolCard
                  badge='Tool 6 · Orange'
                  badgeColor='bg-orange-500/20 text-orange-300 border-orange-500/35'
                  title='6. N-Point 3D Floor Polygon Prism Extruder'
                  bestFor='L-shaped reception counters, angled bay windows, hexagonal kitchen islands, sidewalk curbs, and polygonal platforms.'
                  steps={[
                    'Enable "3D floor polygon prisms" and click "+ Add Prism".',
                    'Drag the orange floor vertices (F1..FN) around any non-rectangular footprint on the floor (use "+ Corner" for up to 12 vertices).',
                    'Drag the "Z↑" height handle on the photo (or adjust Height Z & Top Bevel) to ear-clip triangulate and extrude the 3D prism.'
                  ]}
                />

                <GuideToolCard
                  badge='Tool 7 · Pink'
                  badgeColor='bg-pink-500/20 text-pink-300 border-pink-500/35'
                  title='7. Axis-Symmetric 3D Revolved "Lathe" Object'
                  bestFor='Turned classical columns (molded base + shaft + capital), round pedestal café tables, curved planters/urns, and domed bollards.'
                  steps={[
                    'Enable "360° 3D lathe objects" and pick a Turned Profile preset (Classical Column, Round Pedestal Table, Curved Urn/Planter, Domed Bollard, or Custom 4-Band Radii).',
                    'Drag "Lathe Center" to the bottom center on the floor, "R" to the outer base edge, and "Top H↑" to the top of the object.',
                    'fSpy revolves a 360° 3D mesh around the vertical axis with camera-projected photo textures.'
                  ]}
                />

                <GuideToolCard
                  badge='Tool 8 · Indigo'
                  badgeColor='bg-indigo-500/20 text-indigo-300 border-indigo-500/35'
                  title='8. 3D Coffered Ceiling & Wall Panel Grid'
                  bestFor='Coffered ceiling grids, acoustic drop-ceiling tiles, repeating wainscot wall paneling, and multi-pane window mullions.'
                  steps={[
                    'Enable "3D coffered / panel grids" and choose the Host Surface (Ceiling Plane, Back/Left/Right Wall, or Floor).',
                    'Drag the 4 indigo corners (TL, TR, BR, BL) around the entire grid region on the photo.',
                    'Set "Rows × Cols" (up to 8×8), "Frame Width", "Bevel Slope", and "Depth ±" (negative for recessed coffers, positive for raised panels).'
                  ]}
                />

                <div className='md:col-span-2'>
                  <GuideToolCard
                    badge='Tool 9 · Teal'
                    badgeColor='bg-teal-500/20 text-teal-300 border-teal-500/35'
                    title='9. 3-Point Curved Arc Wall & Bow-Window Bay'
                    bestFor='Sweeping curved hallway walls, rounded reception desks, semi-circular apses, rotundas, and curved bow-window bays.'
                    steps={[
                      'Enable "3-point curved arc walls" and click "+ Add Arc Wall".',
                      'Drag "Arc Start", "Arc Apex" (mid-curve bend), and "Arc End" on the floor to fit a smooth quadratic Bezier curve.',
                      'Drag the "Z↑" height handle on the photo (or adjust Height Z & Thickness) to extrude a watertight 3D curved wall.'
                    ]}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'ai-bridge' && (
            <div className='space-y-3.5'>
              <div className='rounded-lg bg-indigo-950/30 border border-indigo-500/35 p-3.5 space-y-1.5'>
                <div className='flex items-center gap-2 text-xs font-semibold text-indigo-200'>
                  <Sparkles className='w-4 h-4 text-indigo-400' />
                  <span>Zero-API "AI Scene Architect Bridge" (Bring Your Own Free Vision AI)</span>
                </div>
                <p className='text-[11px] text-zinc-300 leading-relaxed'>
                  Instead of adding 10+ hallway rails, doors, pillars, and stairs manually from scratch, let any Vision AI (ChatGPT, Claude, Gemini) spot them in your photo and return a single JSON block that fSpy turns into interactive 3D geometry in one click.
                </p>
              </div>

              <div className='grid grid-cols-1 md:grid-cols-3 gap-3'>
                <GuideToolCard
                  badge='Step 1'
                  badgeColor='bg-indigo-500/20 text-indigo-300 border-indigo-500/35'
                  title='Copy Calibrated Prompt'
                  bestFor='Generates a tailored prompt containing your image resolution, solved fSpy camera FOV, and our 3D JSON schema.'
                  steps={[
                    'Open "3D Scene Blockout & Photo Projection" in the left panel.',
                    'Scroll to "AI Scene Architect Bridge" and check "Open AI Prompt & JSON Scene Importer".',
                    'Click "1. Copy AI Prompt" to copy the prompt to your clipboard.'
                  ]}
                />

                <GuideToolCard
                  badge='Step 2'
                  badgeColor='bg-indigo-500/20 text-indigo-300 border-indigo-500/35'
                  title='Give Photo + Prompt to AI'
                  bestFor='Uses any multimodal LLM you already use (zero API keys or backend fees inside fSpy).'
                  steps={[
                    'Open ChatGPT, Claude, or Gemini in your browser.',
                    'Attach your reference photo and paste the copied fSpy prompt.',
                    'Copy the JSON code block the AI replies with.'
                  ]}
                />

                <GuideToolCard
                  badge='Step 3'
                  badgeColor='bg-emerald-500/20 text-emerald-300 border-emerald-500/35'
                  title='Paste JSON & Fine-Tune'
                  bestFor='Auto-populates your Room Shell, Ceiling, Handrails, Alcoves, Pillars, and Stairs in 1 second.'
                  steps={[
                    'Paste the AI response into the JSON box in fSpy (or click "Load Demo JSON" to test immediately).',
                    'Click "3. Parse & Build 3D Scene from AI JSON".',
                    'Nudge any on-photo handles by a few pixels for 100% sub-pixel perfection!'
                  ]}
                />
              </div>
            </div>
          )}

          {activeTab === 'pbr-export' && (
            <div className='space-y-3.5'>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
                <GuideToolCard
                  badge='Texture Unwarp'
                  badgeColor='bg-rose-500/20 text-rose-300 border-rose-500/35'
                  title='Flat Texture Extractor (Homography Unwarper)'
                  bestFor='Turning a perspective-foreshortened floor tile, rug, painting, or brick wall into a flat, orthographic 2K PNG texture.'
                  steps={[
                    'Enable "Flat Texture Extractor (Unwarp)" in the left panel.',
                    'Drag the 4 rose corners (TL, TR, BR, BL) onto any rectangular surface in the photo.',
                    'fSpy computes the true 3D physical aspect ratio and unwarps the surface into a flat texture.'
                  ]}
                />

                <GuideToolCard
                  badge='Multi-Scale PBR'
                  badgeColor='bg-amber-500/20 text-amber-300 border-amber-500/35'
                  title='Multi-Scale PBR Material Builder'
                  bestFor='Converting your unwarped surface into 5 production PBR maps (Delighted Albedo, Normal, Height, Roughness, Cavity AO).'
                  steps={[
                    'Inside Flat Texture Extractor, enable "Synthesize PBR Maps + Live Relighting".',
                    'Move your mouse over the interactive 60fps 3D Point-Light Preview canvas to inspect specular & normal relief.',
                    'Adjust Delighting, Seamless Tile Edge Blend, Normal Strength, and Micro/Macro relief, then download all 5 PNG maps.'
                  ]}
                />

                <GuideToolCard
                  badge='2.5D Cinema'
                  badgeColor='bg-purple-500/20 text-purple-300 border-purple-500/35'
                  title='2.5D Parallax Camera Animator (.webm & .py)'
                  bestFor='Turning a single still photograph into a moving 3D camera shot (Dolly Push-In, Orbit Arc, Crane Rise, Figure-8).'
                  steps={[
                    'Enable "2.5D Parallax Camera Shot" in the left panel and pick a motion preset.',
                    'Click "Play" to preview the live 3D camera move through your reconstructed hallway/room.',
                    'Click "Record .WebM" to save a video file or "Blender .py" to export an animated Blender camera.'
                  ]}
                />

                <GuideToolCard
                  badge='.GLB & DCC Hub'
                  badgeColor='bg-emerald-500/20 text-emerald-300 border-emerald-500/35'
                  title='One-Click Textured .GLB & Multi-DCC Export Hub'
                  bestFor='Bringing your calibrated camera and textured 3D scene into Blender, Unreal, Unity, Maya, Cinema 4D, or Three.js.'
                  steps={[
                    'Click "Download Textured 3D Scene (.glb)" inside the 3D Scene Blockout panel to export a binary .glb with baked camera-projected textures.',
                    'Or click "Export Hub…" in the top bar for one-click scripts for Blender, Maya, Cinema 4D, Houdini, Unreal, and Composite Calibration PNGs.'
                  ]}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className='px-5 py-3 border-t border-zinc-800/90 bg-[#0e0e12] flex items-center justify-between text-[11px] text-zinc-400'>
          <span>
            Shortcuts: <kbd className='px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-200 font-mono'>Shift</kbd> Precision Loupe ·{' '}
            <kbd className='px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-200 font-mono'>Tab</kbd> Toggle Sidebars ·{' '}
            <kbd className='px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-200 font-mono'>Ctrl+Z</kbd> Undo
          </span>
          <button
            type='button'
            onClick={() => setActiveModal(null)}
            className='px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-xs transition-colors cursor-pointer'
          >
            Got It — Back to Studio
          </button>
        </div>
      </div>
    </div>
  )
}
