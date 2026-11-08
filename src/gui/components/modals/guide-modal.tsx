/**
 * fSpy Studio — Interactive Visual Cheat-Sheet & Quick-Start Guide Modal
 * Features mini SVG handle diagrams, 1-sentence plain-English explanations,
 * and one-click "Open & Use Tool" buttons that jump directly to any tool.
 */

import React, { useState } from 'react'
import {
  SceneToolId,
  SidebarTabId,
  useFSpyStore
} from '../../store/use-fspy-store'
import {
  ArrowRight,
  BookOpen,
  Box,
  Compass,
  Layers,
  Magnet,
  Orbit,
  Video,
  X
} from 'lucide-react'

type GuideTabId =
  | 'quickstart'
  | 'scene-3d'
  | 'hallway-tools'
  | 'pbr-export'

interface VisualToolCardProps {
  badge: string
  badgeColor: string
  title: string
  whatItDoes: string
  dragHint: string
  diagram: React.ReactNode
  actionLabel: string
  onAction: () => void
}

function VisualToolCard({
  badge,
  badgeColor,
  title,
  whatItDoes,
  dragHint,
  diagram,
  actionLabel,
  onAction
}: VisualToolCardProps) {
  return (
    <div className='rounded-xl border border-zinc-800/90 bg-zinc-900/65 p-3.5 flex flex-col justify-between gap-3 hover:border-zinc-700 transition-colors'>
      <div className='space-y-2.5'>
        <div className='flex items-center justify-between gap-2'>
          <h4 className='text-xs font-semibold text-zinc-100'>{title}</h4>
          <span
            className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border shrink-0 ${badgeColor}`}
          >
            {badge}
          </span>
        </div>

        {/* Visual Mini-Diagram + Plain-English Explanation */}
        <div className='flex items-center gap-3'>
          <div className='w-24 h-16 rounded-lg bg-[#0b0d11] border border-zinc-800 flex items-center justify-center shrink-0 overflow-hidden'>
            {diagram}
          </div>
          <div className='space-y-1 text-[11px] leading-snug'>
            <p className='text-zinc-200'>{whatItDoes}</p>
            <p className='text-emerald-300/95 font-medium'>
              On Photo: <span className='text-zinc-300 font-normal'>{dragHint}</span>
            </p>
          </div>
        </div>
      </div>

      <button
        type='button'
        onClick={onAction}
        className='w-full py-1.5 px-3 rounded-lg bg-zinc-800/90 hover:bg-emerald-500 hover:text-zinc-950 text-zinc-200 border border-zinc-700/80 hover:border-emerald-400 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer'
      >
        <span>{actionLabel}</span>
        <ArrowRight className='w-3.5 h-3.5' />
      </button>
    </div>
  )
}

export default function GuideModal() {
  const activeModal = useFSpyStore((s) => s.activeModal)
  const setActiveModal = useFSpyStore((s) => s.setActiveModal)
  const setActiveSidebarTab = useFSpyStore((s) => s.setActiveSidebarTab)
  const activateSceneToolAndEnable = useFSpyStore(
    (s) => s.activateSceneToolAndEnable
  )
  const setEdgeSnappingEnabled = useFSpyStore((s) => s.setEdgeSnappingEnabled)
  const setMultiLineSolverEnabled = useFSpyStore(
    (s) => s.setMultiLineSolverEnabled
  )
  const setLensDistortionEnabled = useFSpyStore(
    (s) => s.setLensDistortionEnabled
  )
  const setWorldRulerEnabled = useFSpyStore((s) => s.setWorldRulerEnabled)
  const setTextureUnwarp = useFSpyStore((s) => s.setTextureUnwarp)
  const setPBRMaterialConfig = useFSpyStore((s) => s.setPBRMaterialConfig)
  const setParallaxAnimator = useFSpyStore((s) => s.setParallaxAnimator)
  const showToast = useFSpyStore((s) => s.showToast)

  const [activeTab, setActiveTab] = useState<GuideTabId>('quickstart')

  if (activeModal !== 'guide') return null

  const openTab = (tab: SidebarTabId, msg?: string) => {
    setActiveSidebarTab(tab)
    setActiveModal(null)
    if (msg) showToast(msg)
  }

  const openSceneTool = (tool: SceneToolId, msg: string) => {
    activateSceneToolAndEnable(tool)
    showToast(msg)
  }

  const tabs: { id: GuideTabId; label: string; icon: typeof Compass }[] = [
    { id: 'quickstart', label: '1. Camera & Smart Snap', icon: Compass },
    { id: 'scene-3d', label: '2. 3D Room, Boxes & AI', icon: Box },
    { id: 'hallway-tools', label: '3. Doors, Stairs & Details (9)', icon: Layers },
    { id: 'pbr-export', label: '4. Textures, 2.5D Video & Export', icon: Video }
  ]

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4'
      onClick={() => setActiveModal(null)}
    >
      <div
        className='w-full max-w-4xl max-h-[90vh] flex flex-col rounded-xl bg-[#111318] border border-emerald-500/35 shadow-2xl overflow-hidden'
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className='px-5 py-3.5 border-b border-zinc-800/90 flex items-center justify-between bg-[#14171f]'>
          <div className='flex items-center gap-2.5'>
            <div className='w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center'>
              <BookOpen className='w-4 h-4 text-emerald-300' />
            </div>
            <div>
              <div className='flex items-center gap-2'>
                <h2 className='text-sm font-semibold text-zinc-100'>
                  fSpy Studio — Visual Quick-Start Cheat-Sheet
                </h2>
                <span className='text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'>
                  Click Any Tool to Open It
                </span>
              </div>
              <p className='text-[11px] text-zinc-400'>
                Every tool works the same way: align handles on your photo, then inspect in 3D Orbit View.
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

        {/* Always-Visible 3-Step Core Workflow Strip */}
        <div className='px-5 py-2.5 bg-[#0c0e12] border-b border-zinc-800/80 grid grid-cols-1 md:grid-cols-3 gap-2.5'>
          <div className='flex items-center gap-2.5 rounded-lg bg-zinc-900/90 border border-zinc-800 px-3 py-2'>
            <span className='w-5 h-5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[11px] font-mono font-bold flex items-center justify-center shrink-0'>
              1
            </span>
            <div className='text-[11px] leading-tight'>
              <div className='font-semibold text-zinc-100'>Match Camera Lines</div>
              <div className='text-zinc-400'>
                Align Red & Green lines on floor/walls + place 3D Origin.
              </div>
            </div>
          </div>

          <div className='flex items-center gap-2.5 rounded-lg bg-zinc-900/90 border border-zinc-800 px-3 py-2'>
            <span className='w-5 h-5 rounded-full bg-sky-500/20 border border-sky-400/40 text-sky-300 text-[11px] font-mono font-bold flex items-center justify-center shrink-0'>
              2
            </span>
            <div className='text-[11px] leading-tight'>
              <div className='font-semibold text-zinc-100'>Pick a 3D Tool & Drag</div>
              <div className='text-zinc-400'>
                Open Tab 2 (3D Scene), pick any shape, and drag handles on photo.
              </div>
            </div>
          </div>

          <div className='flex items-center gap-2.5 rounded-lg bg-zinc-900/90 border border-zinc-800 px-3 py-2'>
            <span className='w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[11px] font-mono font-bold flex items-center justify-center shrink-0'>
              3
            </span>
            <div className='text-[11px] leading-tight'>
              <div className='font-semibold text-zinc-100'>Orbit 3D or Export</div>
              <div className='text-zinc-400'>
                Switch to 3D Orbit View to look around, or export .GLB / .fspy.
              </div>
            </div>
          </div>
        </div>

        {/* Category Tabs */}
        <div className='px-5 pt-2.5 pb-2 border-b border-zinc-800/80 bg-[#0f1116] flex flex-wrap gap-1.5'>
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
                    ? 'bg-emerald-500 text-zinc-950 font-semibold shadow-sm'
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
            <div className='grid grid-cols-1 md:grid-cols-2 gap-3.5'>
              <VisualToolCard
                badge='Step 1 · Core'
                badgeColor='bg-amber-500/15 text-amber-300 border-amber-500/30'
                title='Vanishing Point Lines & 3D Origin'
                whatItDoes='Solves exact camera focal length (FOV) and 3D orientation from parallel lines in your photo.'
                dragHint='Drag the 2 Red lines along one wall/floor direction, 2 Green lines along the other, and the crosshair to a floor corner.'
                diagram={
                  <svg width='88' height='56' viewBox='0 0 88 56'>
                    <line x1='8' y1='48' x2='44' y2='18' stroke='#ef4444' strokeWidth='2' />
                    <line x1='80' y1='48' x2='44' y2='18' stroke='#ef4444' strokeWidth='2' />
                    <line x1='10' y1='12' x2='10' y2='50' stroke='#22c55e' strokeWidth='2' />
                    <line x1='78' y1='12' x2='78' y2='50' stroke='#22c55e' strokeWidth='2' />
                    <circle cx='44' cy='38' r='4' fill='#fbbf24' />
                  </svg>
                }
                actionLabel='Go to Tab 1: Camera Calibration'
                onAction={() => openTab('calibrate')}
              />

              <VisualToolCard
                badge='Smart Snap'
                badgeColor='bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                title='Smart Edge & Corner Snapping'
                whatItDoes='Magnetically snaps any handle onto straight architectural lines, corners, and edges (or hold Alt while dragging).'
                dragHint='Turn on Magnetic Edge Snap or click "Auto-Find VP Lines" to snap lines automatically.'
                diagram={
                  <svg width='88' height='56' viewBox='0 0 88 56'>
                    <line
                      x1='12'
                      y1='44'
                      x2='76'
                      y2='14'
                      stroke='#22d3ee'
                      strokeWidth='2'
                      strokeDasharray='4 2'
                    />
                    <circle
                      cx='46'
                      cy='28'
                      r='8'
                      fill='rgba(34,211,238,0.18)'
                      stroke='#22d3ee'
                      strokeWidth='1.8'
                    />
                    <circle cx='46' cy='28' r='2.5' fill='#fbbf24' />
                  </svg>
                }
                actionLabel='Enable Smart Edge Snap Now'
                onAction={() => {
                  setEdgeSnappingEnabled(true)
                  openTab(
                    'calibrate',
                    'Smart Edge & Corner Snapping enabled! Drag any point near an edge.'
                  )
                }}
              />

              <VisualToolCard
                badge='Multi-Line SVD'
                badgeColor='bg-sky-500/15 text-sky-300 border-sky-500/30'
                title='Multi-Line Solver & Error Degrees'
                whatItDoes='Lets you add 3 to 6 lines per vanishing point and shows per-line angular error in degrees.'
                dragHint='Click [+ Line] to add extra lines along ceiling beams, tiles, and doorframes.'
                diagram={
                  <svg width='88' height='56' viewBox='0 0 88 56'>
                    <line x1='8' y1='50' x2='44' y2='14' stroke='#ef4444' strokeWidth='1.6' />
                    <line x1='24' y1='50' x2='44' y2='14' stroke='#ef4444' strokeWidth='1.6' />
                    <line x1='64' y1='50' x2='44' y2='14' stroke='#ef4444' strokeWidth='1.6' />
                    <line x1='80' y1='50' x2='44' y2='14' stroke='#ef4444' strokeWidth='1.6' />
                    <circle cx='44' cy='14' r='3' fill='#38bdf8' />
                  </svg>
                }
                actionLabel='Enable Multi-Line Solver'
                onAction={() => {
                  setMultiLineSolverEnabled(true)
                  openTab('calibrate', 'Multi-Line SVD Solver enabled.')
                }}
              />

              <VisualToolCard
                badge='Lens & Ruler'
                badgeColor='bg-teal-500/15 text-teal-300 border-teal-500/30'
                title='Lens Undistort & 3D World Tape Measure'
                whatItDoes='Straightens wide-angle GoPro/phone lens curvature (k1/k2) and measures real 3D distances on floors or walls.'
                dragHint='Drag the green R1—R2 tape measure handles across any floor or wall to read meters/feet.'
                diagram={
                  <svg width='88' height='56' viewBox='0 0 88 56'>
                    <line
                      x1='16'
                      y1='34'
                      x2='72'
                      y2='34'
                      stroke='#34d399'
                      strokeWidth='2.2'
                      strokeDasharray='4 2'
                    />
                    <circle cx='16' cy='34' r='4' fill='#34d399' />
                    <circle cx='72' cy='34' r='4' fill='#34d399' />
                    <rect x='28' y='14' width='32' height='12' rx='3' fill='#064e3b' stroke='#34d399' strokeWidth='1' />
                  </svg>
                }
                actionLabel='Enable 3D Tape Measure & Optics'
                onAction={() => {
                  setWorldRulerEnabled(true)
                  setLensDistortionEnabled(true)
                  openTab(
                    'calibrate',
                    '3D Tape Measure & Lens Undistortion enabled.'
                  )
                }}
              />
            </div>
          )}

          {activeTab === 'scene-3d' && (
            <div className='grid grid-cols-1 md:grid-cols-2 gap-3.5'>
              <VisualToolCard
                badge='Room Shell'
                badgeColor='bg-sky-500/15 text-sky-300 border-sky-500/30'
                title='Room Shell, Vaulted Ceiling & 45° Trim'
                whatItDoes='Projects your photo onto a 3D Floor, Walls, Flat/Barrel-Vault/Gable Ceiling, and optional 45° mitered Baseboards & Crown Moldings.'
                dragHint='Adjust Room Width X, Depth Y, and Height Z sliders until the 3D wireframe box matches your room corners.'
                diagram={
                  <svg width='88' height='56' viewBox='0 0 88 56'>
                    <rect x='26' y='16' width='36' height='24' fill='none' stroke='#38bdf8' strokeWidth='1.5' />
                    <line x1='6' y1='4' x2='26' y2='16' stroke='#38bdf8' strokeWidth='1.5' />
                    <line x1='82' y1='4' x2='62' y2='16' stroke='#38bdf8' strokeWidth='1.5' />
                    <line x1='6' y1='52' x2='26' y2='40' stroke='#38bdf8' strokeWidth='1.5' />
                    <line x1='82' y1='52' x2='62' y2='40' stroke='#38bdf8' strokeWidth='1.5' />
                  </svg>
                }
                actionLabel='Open Room Shell & Ceiling Setup'
                onAction={() =>
                  openSceneTool(
                    'room',
                    'Opened Room Shell & Ceiling setup in Tab 2 (3D Scene).'
                  )
                }
              />

              <VisualToolCard
                badge='SketchUp Style'
                badgeColor='bg-amber-500/15 text-amber-300 border-amber-500/30'
                title='3D Boxes (Push/Pull on Photo)'
                whatItDoes='Builds 3D boxy objects on the floor (desks, cabinets, counters, beds, buildings) with live photo textures.'
                dragHint='Drag "XY Move" on the floor, "W" & "D" to resize width/depth, and "Z↑" to pull the 3D height up.'
                diagram={
                  <svg width='88' height='56' viewBox='0 0 88 56'>
                    <polygon points='24,42 48,48 64,38 40,32' fill='rgba(56,189,248,0.15)' stroke='#38bdf8' strokeWidth='1.5' />
                    <polygon points='24,20 48,26 64,16 40,10' fill='rgba(56,189,248,0.25)' stroke='#38bdf8' strokeWidth='1.5' />
                    <line x1='24' y1='42' x2='24' y2='20' stroke='#38bdf8' strokeWidth='1.4' />
                    <line x1='48' y1='48' x2='48' y2='26' stroke='#38bdf8' strokeWidth='1.4' />
                    <line x1='64' y1='38' x2='64' y2='16' stroke='#38bdf8' strokeWidth='1.4' />
                    <circle cx='44' cy='18' r='3.5' fill='#38bdf8' />
                    <circle cx='44' cy='40' r='3.5' fill='#fbbf24' />
                  </svg>
                }
                actionLabel='Open 3D Boxes Tool'
                onAction={() =>
                  openSceneTool(
                    'boxes',
                    '3D Boxes active! Drag XY, W, D, and Z↑ handles directly on the photo.'
                  )
                }
              />

              <VisualToolCard
                badge='2.5D Standees'
                badgeColor='bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                title='3D Cutout Standees (Polygon Silhouette)'
                whatItDoes='Turns curved foreground objects (people, plants, chairs, statues) into upright alpha-masked 3D cutouts on the floor.'
                dragHint='Drag the green polygon points around the object silhouette; its bottom edge automatically stands on the 3D floor.'
                diagram={
                  <svg width='88' height='56' viewBox='0 0 88 56'>
                    <polygon
                      points='32,48 28,26 38,10 50,10 60,26 56,48'
                      fill='rgba(16,185,129,0.2)'
                      stroke='#34d399'
                      strokeWidth='1.6'
                      strokeDasharray='3 2'
                    />
                    <circle cx='32' cy='48' r='3' fill='#34d399' />
                    <circle cx='28' cy='26' r='3' fill='#34d399' />
                    <circle cx='44' cy='10' r='3' fill='#34d399' />
                    <circle cx='60' cy='26' r='3' fill='#34d399' />
                    <circle cx='56' cy='48' r='3' fill='#34d399' />
                  </svg>
                }
                actionLabel='Open 3D Cutout Standees Tool'
                onAction={() =>
                  openSceneTool(
                    'billboards',
                    '3D Cutout Standees active! Drag the green polygon points around any foreground object.'
                  )
                }
              />

              <VisualToolCard
                badge='AI Auto-Build'
                badgeColor='bg-indigo-500/20 text-indigo-300 border-indigo-500/35'
                title='AI Scene Architect Bridge (Zero API Key)'
                whatItDoes='Lets ChatGPT, Claude, or Gemini inspect your photo and generate the entire 3D room, doors, rails, and stairs in 1 click.'
                dragHint='Click "1. Copy AI Prompt", paste into any Vision AI with your photo, then paste the JSON reply back.'
                diagram={
                  <svg width='88' height='56' viewBox='0 0 88 56'>
                    <rect x='14' y='12' width='60' height='32' rx='6' fill='rgba(99,102,241,0.18)' stroke='#818cf8' strokeWidth='1.6' />
                    <path d='M32 28 L40 35 L56 20' fill='none' stroke='#a5b4fc' strokeWidth='2.2' strokeLinecap='round' />
                  </svg>
                }
                actionLabel='Open AI Scene Architect'
                onAction={() =>
                  openSceneTool(
                    'ai-bridge',
                    'AI Scene Architect opened! Click "Load Demo JSON" or copy the prompt.'
                  )
                }
              />
            </div>
          )}

          {activeTab === 'hallway-tools' && (
            <div className='grid grid-cols-1 md:grid-cols-2 gap-3.5'>
              <VisualToolCard
                badge='Doors & Arches'
                badgeColor='bg-cyan-500/20 text-cyan-300 border-cyan-500/35'
                title='Wall Reliefs, Arched Alcoves & Open Portals'
                whatItDoes='Recesses windows/doors (-Depth), pops out ledges (+Depth), or punches a real pass-through doorway into a 3D annex hallway.'
                dragHint='Drag the 4 cyan corners (TL, TR, BR, BL) around any doorway or window on the Left, Right, or Back wall.'
                diagram={
                  <svg width='88' height='56' viewBox='0 0 88 56'>
                    <path
                      d='M26,48 L26,22 A18,12 0 0,1 62,22 L62,48 Z'
                      fill='rgba(6,182,212,0.2)'
                      stroke='#06b6d4'
                      strokeWidth='1.8'
                    />
                    <circle cx='26' cy='22' r='3' fill='#06b6d4' />
                    <circle cx='62' cy='22' r='3' fill='#06b6d4' />
                    <circle cx='62' cy='48' r='3' fill='#06b6d4' />
                    <circle cx='26' cy='48' r='3' fill='#06b6d4' />
                  </svg>
                }
                actionLabel='Open Doors, Arches & Portals Tool'
                onAction={() =>
                  openSceneTool(
                    'reliefs',
                    'Wall Reliefs & Portals active! Drag the 4 cyan corners around a doorway or window.'
                  )
                }
              />

              <VisualToolCard
                badge='Stairs & Ramps'
                badgeColor='bg-emerald-500/20 text-emerald-300 border-emerald-500/35'
                title='3D Stairs (Straight, L-Turn, U-Turn & Spiral)'
                whatItDoes='Extrudes stepped staircases, sloped ramps, 90° L-landings, 180° U-switchbacks, and helical spiral stairs.'
                dragHint='Drag "Stair Base XY" to the bottom step, "Run" & "W" for size, and "Top H↑" to match the top step.'
                diagram={
                  <svg width='88' height='56' viewBox='0 0 88 56'>
                    <polyline
                      points='16,46 28,46 28,38 40,38 40,30 52,30 52,22 68,22 68,46 16,46'
                      fill='rgba(16,185,129,0.2)'
                      stroke='#10b981'
                      strokeWidth='1.8'
                    />
                    <circle cx='16' cy='46' r='3.2' fill='#10b981' />
                    <circle cx='68' cy='22' r='3.2' fill='#34d399' />
                  </svg>
                }
                actionLabel='Open 3D Stairs & Ramps Tool'
                onAction={() =>
                  openSceneTool(
                    'stairs',
                    '3D Staircase tool active! Drag Stair Base XY and Top H↑ on the photo.'
                  )
                }
              />

              <VisualToolCard
                badge='Rails & Cables'
                badgeColor='bg-rose-500/20 text-rose-300 border-rose-500/35'
                title='3D Swept Handrails, 90° Elbows & Cables'
                whatItDoes='Sweeps 3D handrails, multi-bend conduits with 90° elbows, or gravity-sagging hanging cables off any wall.'
                dragHint='Drag "Rail P1" and "Rail P2" along the rail on the photo (click "+ Bend" to add elbow corners).'
                diagram={
                  <svg width='88' height='56' viewBox='0 0 88 56'>
                    <polyline
                      points='14,42 44,24 74,24'
                      fill='none'
                      stroke='#f43f5e'
                      strokeWidth='2.5'
                    />
                    <circle cx='14' cy='42' r='3.5' fill='#f43f5e' />
                    <circle cx='44' cy='24' r='3.2' fill='#fb7185' />
                    <circle cx='74' cy='24' r='3.5' fill='#f43f5e' />
                  </svg>
                }
                actionLabel='Open Handrails & Cables Tool'
                onAction={() =>
                  openSceneTool(
                    'rails',
                    '3D Handrails & Cables active! Drag Rail P1 and P2 along the rail.'
                  )
                }
              />

              <VisualToolCard
                badge='3-Sweep Pillars'
                badgeColor='bg-yellow-500/20 text-yellow-300 border-yellow-500/35'
                title='3-Sweep Columns & Pillars'
                whatItDoes='Reconstructs round, octagonal, or square columns from 3 points on the photo.'
                dragHint='Drag "Base L" & "Base R" across the bottom of the pillar, and "T↑" to the top center.'
                diagram={
                  <svg width='88' height='56' viewBox='0 0 88 56'>
                    <rect x='34' y='12' width='20' height='36' rx='4' fill='rgba(234,179,8,0.18)' stroke='#eab308' strokeWidth='1.6' />
                    <circle cx='34' cy='48' r='3.2' fill='#eab308' />
                    <circle cx='54' cy='48' r='3.2' fill='#eab308' />
                    <circle cx='44' cy='12' r='3.2' fill='#fde047' />
                  </svg>
                }
                actionLabel='Open 3-Sweep Pillars Tool'
                onAction={() =>
                  openSceneTool(
                    'columns',
                    '3-Sweep Pillars active! Drag Base L, Base R, and Top T↑ on the photo.'
                  )
                }
              />

              <VisualToolCard
                badge='Iron Grilles'
                badgeColor='bg-purple-500/20 text-purple-300 border-purple-500/35'
                title='Wall-Parallel Cutout Grilles & Balusters'
                whatItDoes='Floats a see-through cutout plane parallel to a wall for wrought-iron railings, radiators, and signage.'
                dragHint='Drag the 4 purple corners (TL, TR, BR, BL) around the railing; background wall pixels become transparent.'
                diagram={
                  <svg width='88' height='56' viewBox='0 0 88 56'>
                    <rect x='20' y='16' width='48' height='26' fill='rgba(168,85,247,0.16)' stroke='#a855f7' strokeWidth='1.6' />
                    <line x1='32' y1='16' x2='32' y2='42' stroke='#c084fc' strokeWidth='1.4' />
                    <line x1='44' y1='16' x2='44' y2='42' stroke='#c084fc' strokeWidth='1.4' />
                    <line x1='56' y1='16' x2='56' y2='42' stroke='#c084fc' strokeWidth='1.4' />
                  </svg>
                }
                actionLabel='Open Wall Cutout Grilles Tool'
                onAction={() =>
                  openSceneTool(
                    'wall-cutouts',
                    'Wall Cutout Grilles active! Drag the 4 purple corners around the railing.'
                  )
                }
              />

              <VisualToolCard
                badge='Floor Polygons'
                badgeColor='bg-orange-500/20 text-orange-300 border-orange-500/35'
                title='N-Point Floor Polygon Prisms'
                whatItDoes='Extrudes L-shaped counters, angled bay windows, and hexagonal islands from 3–12 floor corners.'
                dragHint='Drag the orange floor corners (F1..FN) around the base footprint and pull "Z↑" for height.'
                diagram={
                  <svg width='88' height='56' viewBox='0 0 88 56'>
                    <polygon
                      points='18,44 44,48 68,38 56,22 28,24'
                      fill='rgba(249,115,22,0.2)'
                      stroke='#f97316'
                      strokeWidth='1.6'
                    />
                    <circle cx='44' cy='14' r='3.5' fill='#fb923c' />
                    <line x1='44' y1='36' x2='44' y2='14' stroke='#fb923c' strokeWidth='1.5' strokeDasharray='3 2' />
                  </svg>
                }
                actionLabel='Open Floor Polygon Prisms Tool'
                onAction={() =>
                  openSceneTool(
                    'prisms',
                    'Floor Polygon Prisms active! Drag F1..FN corners and pull Z↑.'
                  )
                }
              />

              <VisualToolCard
                badge='360° Lathe'
                badgeColor='bg-pink-500/20 text-pink-300 border-pink-500/35'
                title='Revolved 3D Lathe Objects (Tables, Urns)'
                whatItDoes='Spins a 360° symmetric 3D mesh for classical columns, round café tables, planters, and bollards.'
                dragHint='Drag "Center" to the bottom middle, "Radius R" to the outer edge, and "Top H↑" to the top.'
                diagram={
                  <svg width='88' height='56' viewBox='0 0 88 56'>
                    <ellipse cx='44' cy='16' rx='18' ry='5' fill='rgba(236,72,153,0.22)' stroke='#ec4899' strokeWidth='1.5' />
                    <line x1='44' y1='16' x2='44' y2='44' stroke='#ec4899' strokeWidth='2' />
                    <ellipse cx='44' cy='44' rx='12' ry='4' fill='rgba(236,72,153,0.22)' stroke='#ec4899' strokeWidth='1.5' />
                  </svg>
                }
                actionLabel='Open 3D Revolved Lathe Tool'
                onAction={() =>
                  openSceneTool(
                    'lathe',
                    '3D Lathe Objects active! Drag Center, Radius R, and Top H↑.'
                  )
                }
              />

              <VisualToolCard
                badge='Coffers & Curves'
                badgeColor='bg-teal-500/20 text-teal-300 border-teal-500/35'
                title='Coffered Grids & 3-Point Curved Walls'
                whatItDoes='Builds recessed ceiling/wall panel grids (Rows×Cols) or smooth 3-point Bezier curved walls.'
                dragHint='Drag the 4 indigo grid corners for coffers, or drag Arc Start, Apex, and End for curved walls.'
                diagram={
                  <svg width='88' height='56' viewBox='0 0 88 56'>
                    <path
                      d='M14,44 Q44,12 74,44'
                      fill='none'
                      stroke='#14b8a6'
                      strokeWidth='2.5'
                    />
                    <circle cx='14' cy='44' r='3.2' fill='#14b8a6' />
                    <circle cx='44' cy='28' r='3.2' fill='#2dd4bf' />
                    <circle cx='74' cy='44' r='3.2' fill='#14b8a6' />
                  </svg>
                }
                actionLabel='Open Curved Walls & Coffered Grids'
                onAction={() =>
                  openSceneTool(
                    'curved-walls',
                    'Curved Arc Wall tool active! Drag Arc Start, Arc Apex, and Arc End.'
                  )
                }
              />
            </div>
          )}

          {activeTab === 'pbr-export' && (
            <div className='grid grid-cols-1 md:grid-cols-2 gap-3.5'>
              <VisualToolCard
                badge='Unwarp + PBR'
                badgeColor='bg-rose-500/20 text-rose-300 border-rose-500/35'
                title='Flat Texture Unwarper & 5-Map PBR Builder'
                whatItDoes='Unwarps any perspective floor/wall quad into a flat 2K PNG and synthesizes Albedo, Normal, Height, Roughness & AO maps.'
                dragHint='Drag the 4 rose corners (TL, TR, BR, BL) onto any tile, rug, brick wall, or painting.'
                diagram={
                  <svg width='88' height='56' viewBox='0 0 88 56'>
                    <polygon points='16,44 30,16 58,16 72,44' fill='rgba(244,63,94,0.18)' stroke='#fb7185' strokeWidth='1.6' />
                    <circle cx='30' cy='16' r='3' fill='#fb7185' />
                    <circle cx='58' cy='16' r='3' fill='#fb7185' />
                    <circle cx='72' cy='44' r='3' fill='#fb7185' />
                    <circle cx='16' cy='44' r='3' fill='#fb7185' />
                  </svg>
                }
                actionLabel='Open Tab 3: Texture Unwarp & PBR'
                onAction={() => {
                  setTextureUnwarp({ enabled: true })
                  setPBRMaterialConfig({ enabled: true })
                  openTab(
                    'pbr',
                    'Texture Unwarper & PBR Builder enabled! Drag the 4 rose corners on the photo.'
                  )
                }}
              />

              <VisualToolCard
                badge='2.5D Video'
                badgeColor='bg-purple-500/20 text-purple-300 border-purple-500/35'
                title='2.5D Parallax Camera Animator (.WebM)'
                whatItDoes='Turns your single still photo into a moving 3D camera shot (Dolly Push-In, Orbit Arc, Crane Rise) and records .WebM video.'
                dragHint='Pick a camera motion preset and click Play to fly through your reconstructed 3D scene.'
                diagram={
                  <svg width='88' height='56' viewBox='0 0 88 56'>
                    <path d='M16,38 C32,16 56,16 72,38' fill='none' stroke='#a855f7' strokeWidth='2' strokeDasharray='4 2' />
                    <polygon points='38,22 54,28 38,34' fill='#c084fc' />
                  </svg>
                }
                actionLabel='Open Tab 4: 2.5D Camera Animator'
                onAction={() => {
                  setParallaxAnimator({ enabled: true, isPlaying: true })
                  openTab('animate', 'Playing 2.5D Parallax Camera Shot!')
                }}
              />

              <VisualToolCard
                badge='Blender 5.2+ & GLB'
                badgeColor='bg-emerald-500/20 text-emerald-300 border-emerald-500/35'
                title='Blender 5.2+ Add-On & Textured .GLB Export'
                whatItDoes='Downloads our custom Blender 5.2+ (.fspy) importer add-on or exports your entire textured 3D scene as a ready-to-render .GLB.'
                dragHint='Click "Export Hub…" in the top bar for Blender 5.2+ Add-on, Maya, C4D, Unreal, and Houdini scripts.'
                diagram={
                  <svg width='88' height='56' viewBox='0 0 88 56'>
                    <rect x='22' y='14' width='44' height='28' rx='5' fill='rgba(16,185,129,0.18)' stroke='#10b981' strokeWidth='1.6' />
                    <text x='44' y='32' textAnchor='middle' fill='#6ee7b7' fontSize='10' fontFamily='monospace' fontWeight='bold'>
                      .GLB/.PY
                    </text>
                  </svg>
                }
                actionLabel='Open Multi-DCC & Blender 5.2+ Export Hub'
                onAction={() => setActiveModal('export-hub')}
              />

              <VisualToolCard
                badge='3D Orbit'
                badgeColor='bg-sky-500/20 text-sky-300 border-sky-500/35'
                title='Interactive Free 3D Orbit View'
                whatItDoes='Lets you orbit, pan, and zoom freely around your camera-projected 3D room, furniture, stairs, and cutouts.'
                dragHint='Left-drag to orbit in 3D, right-drag to pan, scroll to zoom, and click "Edit on Photo" to adjust handles.'
                diagram={
                  <div className='flex items-center justify-center text-sky-400'>
                    <Orbit className='w-8 h-8' />
                  </div>
                }
                actionLabel='Enter 3D Orbit View Now'
                onAction={() => {
                  activateSceneToolAndEnable('boxes')
                  useFSpyStore
                    .getState()
                    .setSceneBlockout({ enabled: true, freeOrbitMode: true })
                  showToast('Entered Free 3D Orbit View! Left-drag to orbit.')
                }}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className='px-5 py-3 border-t border-zinc-800/90 bg-[#0d0f14] flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-400'>
          <div className='flex items-center gap-3'>
            <span className='inline-flex items-center gap-1 text-cyan-300'>
              <Magnet className='w-3.5 h-3.5' />
              <span>Hold</span>
              <kbd className='px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-200 font-mono'>
                Alt
              </kbd>
              <span>to Snap to Edges</span>
            </span>
            <span>·</span>
            <span>
              Hold{' '}
              <kbd className='px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-200 font-mono'>
                Shift
              </kbd>{' '}
              for Zoom Loupe
            </span>
            <span>·</span>
            <span>
              <kbd className='px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-200 font-mono'>
                Space + Drag
              </kbd>{' '}
              to Pan
            </span>
          </div>
          <button
            type='button'
            onClick={() => setActiveModal(null)}
            className='px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-xs transition-colors cursor-pointer'
          >
            Got It — Start Building
          </button>
        </div>
      </div>
    </div>
  )
}
