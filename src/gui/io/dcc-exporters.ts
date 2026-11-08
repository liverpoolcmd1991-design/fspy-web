/**
 * fSpy Studio — Multi-DCC Camera Exporters & Composite Calibration Sheet Renderer
 * Supports Blender, Unreal Engine 5, Autodesk Maya, Maxon Cinema 4D, SideFX Houdini,
 * Three.js / React Three Fiber, Camera JSON, and Composite Calibration Proof PNG.
 */

import { saveAs } from 'file-saver'
import { cameraPresets } from '../solver/camera-presets'
import CoordinatesUtil, { ImageCoordinateFrame } from '../solver/coordinates-util'
import MathUtil from '../solver/math-util'
import { evaluateParallaxCameraPose } from '../solver/scene-reconstruction'
import type { FSpyStoreState } from '../store/use-fspy-store'
import { CalibrationMode } from '../types/global-settings'
import { Palette } from '../style/palette'

export type DCCExportFormat =
  | 'blender-py'
  | 'unreal-py'
  | 'maya-py'
  | 'c4d-py'
  | 'houdini-py'
  | 'threejs-ts'
  | 'camera-json'

export interface DCCExportDescriptor {
  id: DCCExportFormat
  title: string
  subtitle: string
  extension: string
  mimeType: string
}

export const DCC_EXPORT_FORMATS: DCCExportDescriptor[] = [
  {
    id: 'blender-py',
    title: 'Blender (Python .py)',
    subtitle: 'Creates calibrated Blender camera with sensor, FOV, shift & matrix_world',
    extension: 'py',
    mimeType: 'text/x-python;charset=utf-8'
  },
  {
    id: 'unreal-py',
    title: 'Unreal Engine 5 (Python .py)',
    subtitle: 'Spawns a CineCameraActor with solved filmback, focal length & UE transform',
    extension: 'py',
    mimeType: 'text/x-python;charset=utf-8'
  },
  {
    id: 'maya-py',
    title: 'Autodesk Maya (Python .py)',
    subtitle: 'Creates a Maya camera with film aperture, focal length, film offset & xform',
    extension: 'py',
    mimeType: 'text/x-python;charset=utf-8'
  },
  {
    id: 'c4d-py',
    title: 'Maxon Cinema 4D (Python .py)',
    subtitle: 'Creates a C4D CameraObject with sensor width, focal length & global matrix',
    extension: 'py',
    mimeType: 'text/x-python;charset=utf-8'
  },
  {
    id: 'houdini-py',
    title: 'SideFX Houdini (Python .py)',
    subtitle: 'Creates /obj/fspy_cam with aperture, focal length, window shift & world matrix',
    extension: 'py',
    mimeType: 'text/x-python;charset=utf-8'
  },
  {
    id: 'threejs-ts',
    title: 'Three.js / R3F (TypeScript .ts)',
    subtitle: 'Ready-to-paste Three.js PerspectiveCamera matrix & off-axis projection code',
    extension: 'ts',
    mimeType: 'text/typescript;charset=utf-8'
  },
  {
    id: 'camera-json',
    title: 'Raw Camera Parameters (.json)',
    subtitle: 'Standard fSpy JSON telemetry (FOV, principal point, 4×4 view & camera matrices)',
    extension: 'json',
    mimeType: 'application/json;charset=utf-8'
  }
]

function resolveSensorAndFocal(state: FSpyStoreState) {
  const params = state.solverResult.cameraParameters!
  const cameraData = state.calibrationSettingsBase.cameraData
  let sensorWidth = cameraData.customSensorWidth
  let sensorHeight = cameraData.customSensorHeight
  if (cameraData.presetId && cameraPresets[cameraData.presetId]) {
    sensorWidth = cameraPresets[cameraData.presetId].sensorWidth
    sensorHeight = cameraPresets[cameraData.presetId].sensorHeight
  }
  const sensorAspect = sensorHeight > 0 ? sensorWidth / sensorHeight : 1
  const focalLengthMm =
    sensorAspect >= 1
      ? 0.5 * sensorWidth * params.relativeFocalLength
      : 0.5 * sensorHeight * params.relativeFocalLength

  const projectName = state.uiState.projectName || 'fSpy_Camera'
  const safeName = projectName.replace(/\.fspy$/i, '').replace(/[^a-zA-Z0-9_-]/g, '_') || 'fSpy_Camera'
  return { params, sensorWidth, sensorHeight, focalLengthMm, safeName }
}

export function generateDCCExportCode(state: FSpyStoreState, format: DCCExportFormat): string {
  if (!state.solverResult.cameraParameters) {
    return '// Camera parameters are not currently solved.'
  }

  const { params, sensorWidth, sensorHeight, focalLengthMm, safeName } = resolveSensorAndFocal(state)
  const m = params.cameraTransform.matrix
  const hfovDeg = (params.horizontalFieldOfView * 180) / Math.PI
  const vfovDeg = (params.verticalFieldOfView * 180) / Math.PI

  const sunCfg = state.sunShadowConfig
  const azRad = (sunCfg.azimuthDeg * Math.PI) / 180
  const elRad = (sunCfg.elevationDeg * Math.PI) / 180
  const sunVecX = Math.cos(elRad) * Math.cos(azRad)
  const sunVecY = Math.cos(elRad) * Math.sin(azRad)
  const sunVecZ = Math.sin(elRad)

  switch (format) {
    case 'blender-py': {
      const sunBlock = sunCfg.enabled
        ? `
# Opt-In Matched Sun Directional Light (Azimuth ${sunCfg.azimuthDeg}°, Elevation ${sunCfg.elevationDeg}°)
sun_data = bpy.data.lights.new(name="${safeName}_Sun", type='SUN')
sun_data.energy = 3.0
sun_obj = bpy.data.objects.new(name="${safeName}_Sun", object_data=sun_data)
bpy.context.collection.objects.link(sun_obj)
sun_dir = mathutils.Vector((${sunVecX.toFixed(6)}, ${sunVecY.toFixed(6)}, ${sunVecZ.toFixed(6)}))
sun_obj.location = sun_dir * 8.0
sun_obj.rotation_euler = sun_dir.to_track_quat('Z', 'Y').to_euler()
`
        : ''

      const blockoutCfg = state.sceneBlockout
      const blockoutVolumesPy =
        blockoutCfg.enabled && blockoutCfg.volumes.length > 0
          ? `
# Opt-In Reconstructed 3D Blockout Volumes with Camera UV_PROJECT Modifier
for vol_spec in [
${blockoutCfg.volumes
  .map(
    (v) =>
      `    {"name": "${v.name.replace(/"/g, '')}", "cx": ${v.offsetX.toFixed(4)}, "cy": ${v.offsetY.toFixed(4)}, "z0": ${v.offsetZ.toFixed(4)}, "wx": ${v.widthX.toFixed(4)}, "dy": ${v.depthY.toFixed(4)}, "hz": ${v.heightZ.toFixed(4)}, "yaw": ${((v.rotationZ * Math.PI) / 180).toFixed(6)}}`
  )
  .join(',\n')}
]:
    bpy.ops.mesh.primitive_cube_add(
        size=1.0,
        location=(vol_spec["cx"], vol_spec["cy"], vol_spec["z0"] + 0.5 * vol_spec["hz"]),
        rotation=(0.0, 0.0, vol_spec["yaw"])
    )
    box_obj = bpy.context.active_object
    box_obj.name = f"${safeName}_{vol_spec['name']}"
    box_obj.scale = (vol_spec["wx"], vol_spec["dy"], vol_spec["hz"])
    subsurf = box_obj.modifiers.new(name="SubdivideForProjection", type='SUBSURF')
    subsurf.subdivision_type = 'SIMPLE'
    subsurf.levels = 3
    subsurf.render_levels = 3
    uv_proj = box_obj.modifiers.new(name="CameraProjection", type='UV_PROJECT')
    uv_proj.projector_count = 1
    uv_proj.projectors[0].object = cam_obj
    uv_proj.aspect_x = ${params.imageWidth}
    uv_proj.aspect_y = ${params.imageHeight}
`
          : ''

      const parallaxCfg = state.parallaxAnimator
      let parallaxAnimPy = ''
      if (parallaxCfg.enabled) {
        const totalFrames = Math.max(48, Math.round(parallaxCfg.durationSec * 24))
        const sampleCount = 16
        const keyframes: string[] = []
        for (let i = 0; i <= sampleCount; i++) {
          const phase = i / sampleCount
          const frameNum = Math.round(1 + phase * (totalFrames - 1))
          const pose = evaluateParallaxCameraPose(parallaxCfg, phase, params)
          const p = pose.position
          const q = pose.quaternion
          // Blender Quaternion is (w, x, y, z)
          keyframes.push(
            `    (${frameNum}, (${p.x.toFixed(5)}, ${p.y.toFixed(5)}, ${p.z.toFixed(5)}), (${q.w.toFixed(6)}, ${q.x.toFixed(6)}, ${q.y.toFixed(6)}, ${q.z.toFixed(6)}))`
          )
        }
        parallaxAnimPy = `
# Opt-In 2.5D Parallax Animated Render Camera (${parallaxCfg.preset}, ${totalFrames} frames)
anim_cam_data = cam_data.copy()
anim_cam_data.name = "${safeName}_ParallaxShot"
anim_cam_obj = bpy.data.objects.new(name="${safeName}_ParallaxShot", object_data=anim_cam_data)
bpy.context.collection.objects.link(anim_cam_obj)
anim_cam_obj.rotation_mode = 'QUATERNION'
scene.frame_start = 1
scene.frame_end = ${totalFrames}
for frame_no, loc_xyz, quat_wxyz in [
${keyframes.join(',\n')}
]:
    anim_cam_obj.location = loc_xyz
    anim_cam_obj.rotation_quaternion = quat_wxyz
    anim_cam_obj.keyframe_insert(data_path="location", frame=frame_no)
    anim_cam_obj.keyframe_insert(data_path="rotation_quaternion", frame=frame_no)
scene.camera = anim_cam_obj
`
      }

      return `# fSpy Studio — Blender Camera & 3D Scene Setup Script
# Usage: Open Blender -> Scripting workspace -> New Text -> Paste & Run Script
import bpy
import mathutils

scene = bpy.context.scene
scene.render.resolution_x = ${params.imageWidth}
scene.render.resolution_y = ${params.imageHeight}
scene.render.resolution_percentage = 100

cam_data = bpy.data.cameras.new(name="${safeName}")
cam_obj = bpy.data.objects.new(name="${safeName}", object_data=cam_data)
bpy.context.collection.objects.link(cam_obj)

cam_data.sensor_fit = 'HORIZONTAL'
cam_data.sensor_width = ${sensorWidth.toFixed(4)}
cam_data.sensor_height = ${sensorHeight.toFixed(4)}
cam_data.lens_unit = 'FOV'
cam_data.angle = ${params.horizontalFieldOfView.toFixed(8)}

# Off-axis principal point lens shift
cam_data.shift_x = ${(-0.5 * params.principalPoint.x).toFixed(8)}
cam_data.shift_y = ${(-0.5 * params.principalPoint.y).toFixed(8)}

matrix = mathutils.Matrix((
    (${m[0][0].toFixed(8)}, ${m[0][1].toFixed(8)}, ${m[0][2].toFixed(8)}, ${m[0][3].toFixed(8)}),
    (${m[1][0].toFixed(8)}, ${m[1][1].toFixed(8)}, ${m[1][2].toFixed(8)}, ${m[1][3].toFixed(8)}),
    (${m[2][0].toFixed(8)}, ${m[2][1].toFixed(8)}, ${m[2][2].toFixed(8)}, ${m[2][3].toFixed(8)}),
    (0.0, 0.0, 0.0, 1.0)
))
cam_obj.matrix_world = matrix
scene.camera = cam_obj
${sunBlock}${blockoutVolumesPy}${parallaxAnimPy}print("Created calibrated Blender camera: ${safeName}")
`
    }

    case 'unreal-py': {
      const q = MathUtil.matrixToQuaternion(params.cameraTransform)
      return `# fSpy Studio — Unreal Engine 5 CineCameraActor Script
# Usage: Execute in Unreal Editor Output Log (Python) with Python Editor Script Plugin enabled
import unreal
import math

editor_subsystem = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
# Convert fSpy meters (Right-Handed Z-up) to Unreal cm
loc = unreal.Vector(${(m[0][3] * 100).toFixed(4)}, ${(-m[1][3] * 100).toFixed(4)}, ${(m[2][3] * 100).toFixed(4)})
quat = unreal.Quat(${q[0].toFixed(7)}, ${(-q[1]).toFixed(7)}, ${q[2].toFixed(7)}, ${q[3].toFixed(7)})
rot = quat.rotator()

cam_actor = editor_subsystem.spawn_actor_from_class(unreal.CineCameraActor, loc, rot)
cam_actor.set_actor_label("${safeName}")

cam_comp = cam_actor.get_cine_camera_component()
filmback = unreal.CameraFilmbackSettings()
filmback.sensor_width = ${sensorWidth.toFixed(4)}
filmback.sensor_height = ${sensorHeight.toFixed(4)}
cam_comp.set_editor_property("filmback", filmback)
cam_comp.set_editor_property("current_focal_length", ${focalLengthMm.toFixed(4)})

print("Spawned calibrated Unreal CineCameraActor: ${safeName} (HFOV ${hfovDeg.toFixed(2)} deg)")
`
    }

    case 'maya-py':
      return `# fSpy Studio — Autodesk Maya Camera Setup Script
# Usage: Run inside Maya Script Editor (Python tab)
import maya.cmds as cmds

cam_transform, cam_shape = cmds.camera(name="${safeName}")
cmds.setAttr(cam_shape + ".horizontalFilmAperture", ${(sensorWidth / 25.4).toFixed(6)})
cmds.setAttr(cam_shape + ".verticalFilmAperture", ${(sensorHeight / 25.4).toFixed(6)})
cmds.setAttr(cam_shape + ".focalLength", ${focalLengthMm.toFixed(4)})
cmds.setAttr(cam_shape + ".horizontalFilmOffset", ${((-0.5 * params.principalPoint.x * sensorWidth) / 25.4).toFixed(6)})
cmds.setAttr(cam_shape + ".verticalFilmOffset", ${((-0.5 * params.principalPoint.y * sensorHeight) / 25.4).toFixed(6)})

# 4x4 column-major matrix for Maya xform
matrix_flat = [
    ${m[0][0].toFixed(8)}, ${m[1][0].toFixed(8)}, ${m[2][0].toFixed(8)}, 0.0,
    ${m[0][1].toFixed(8)}, ${m[1][1].toFixed(8)}, ${m[2][1].toFixed(8)}, 0.0,
    ${m[0][2].toFixed(8)}, ${m[1][2].toFixed(8)}, ${m[2][2].toFixed(8)}, 0.0,
    ${m[0][3].toFixed(8)}, ${m[1][3].toFixed(8)}, ${m[2][3].toFixed(8)}, 1.0
]
cmds.xform(cam_transform, worldSpace=True, matrix=matrix_flat)
cmds.setAttr("defaultResolution.width", ${params.imageWidth})
cmds.setAttr("defaultResolution.height", ${params.imageHeight})
print("Created calibrated Maya camera:", cam_transform)
`

    case 'c4d-py':
      return `# fSpy Studio — Maxon Cinema 4D Camera Setup Script
# Usage: Cinema 4D -> Extensions -> Script Manager -> Paste & Execute
import c4d

def main():
    cam = c4d.CameraObject()
    cam.SetName("${safeName}")
    cam[c4d.CAMERAOBJECT_APERTURE] = ${sensorWidth.toFixed(4)}
    cam[c4d.CAMERA_FOCUS] = ${focalLengthMm.toFixed(4)}
    cam[c4d.CAMERAOBJECT_FILM_OFFSET_X] = ${(-0.5 * params.principalPoint.x).toFixed(6)}
    cam[c4d.CAMERAOBJECT_FILM_OFFSET_Y] = ${(-0.5 * params.principalPoint.y).toFixed(6)}

    v1 = c4d.Vector(${m[0][0].toFixed(6)}, ${m[2][0].toFixed(6)}, ${m[1][0].toFixed(6)})
    v2 = c4d.Vector(${m[0][2].toFixed(6)}, ${m[2][2].toFixed(6)}, ${m[1][2].toFixed(6)})
    v3 = c4d.Vector(${(-m[0][1]).toFixed(6)}, ${(-m[2][1]).toFixed(6)}, ${(-m[1][1]).toFixed(6)})
    off = c4d.Vector(${(m[0][3] * 100).toFixed(4)}, ${(m[2][3] * 100).toFixed(4)}, ${(m[1][3] * 100).toFixed(4)})

    cam.SetMg(c4d.Matrix(off, v1, v2, v3))
    doc.InsertObject(cam)
    rd = doc.GetActiveRenderData()
    rd[c4d.RDATA_XRES] = ${params.imageWidth}
    rd[c4d.RDATA_YRES] = ${params.imageHeight}
    c4d.EventAdd()

if __name__ == '__main__':
    main()
`

    case 'houdini-py':
      return `# fSpy Studio — SideFX Houdini Camera Setup Script
# Usage: Run in Houdini Python Shell or Shelf Tool
import hou

obj = hou.node("/obj")
cam = obj.createNode("cam", "${safeName}")
cam.parm("resx").set(${params.imageWidth})
cam.parm("resy").set(${params.imageHeight})
cam.parm("aperture").set(${sensorWidth.toFixed(4)})
cam.parm("focal").set(${focalLengthMm.toFixed(4)})
cam.parm("winx").set(${(-0.5 * params.principalPoint.x).toFixed(6)})
cam.parm("winy").set(${(-0.5 * params.principalPoint.y).toFixed(6)})

xform = hou.Matrix4((
    (${m[0][0].toFixed(8)}, ${m[1][0].toFixed(8)}, ${m[2][0].toFixed(8)}, 0.0),
    (${m[0][1].toFixed(8)}, ${m[1][1].toFixed(8)}, ${m[2][1].toFixed(8)}, 0.0),
    (${m[0][2].toFixed(8)}, ${m[1][2].toFixed(8)}, ${m[2][2].toFixed(8)}, 0.0),
    (${m[0][3].toFixed(8)}, ${m[1][3].toFixed(8)}, ${m[2][3].toFixed(8)}, 1.0)
))
cam.setWorldTransform(xform)
print("Created calibrated Houdini camera:", cam.path())
`

    case 'threejs-ts':
      return `// fSpy Studio — Three.js Calibrated PerspectiveCamera Setup
// Image: ${params.imageWidth}x${params.imageHeight} | HFOV: ${hfovDeg.toFixed(3)}° | VFOV: ${vfovDeg.toFixed(3)}° | Focal: ${focalLengthMm.toFixed(2)}mm
import * as THREE from 'three'

export function createCalibratedFSpyCamera(viewportWidth = ${params.imageWidth}, viewportHeight = ${params.imageHeight}) {
  const camera = new THREE.PerspectiveCamera(${vfovDeg.toFixed(6)}, viewportWidth / viewportHeight, 0.05, 500)
  camera.matrixAutoUpdate = false

  const camMatrix = new THREE.Matrix4().set(
    ${m[0][0].toFixed(8)}, ${m[0][1].toFixed(8)}, ${m[0][2].toFixed(8)}, ${m[0][3].toFixed(8)},
    ${m[1][0].toFixed(8)}, ${m[1][1].toFixed(8)}, ${m[1][2].toFixed(8)}, ${m[1][3].toFixed(8)},
    ${m[2][0].toFixed(8)}, ${m[2][1].toFixed(8)}, ${m[2][2].toFixed(8)}, ${m[2][3].toFixed(8)},
    0, 0, 0, 1
  )
  camera.matrix.copy(camMatrix)
  camera.matrixWorld.copy(camMatrix)
  camera.matrixWorldInverse.copy(camMatrix).invert()

  // Off-axis principal point projection matching fSpy solver
  const aspect = viewportWidth / viewportHeight
  const s = 1 / Math.tan(0.5 * ${params.horizontalFieldOfView.toFixed(8)})
  const sx = aspect >= 1 ? s : s / aspect
  const sy = aspect >= 1 ? s * aspect : s
  const px = ${params.principalPoint.x.toFixed(8)} * (aspect >= 1 ? 1 : 1 / aspect)
  const py = ${params.principalPoint.y.toFixed(8)} * (aspect >= 1 ? aspect : 1)
  const n = 0.05
  const f = 500

  camera.projectionMatrix.set(
    sx, 0, -px, 0,
    0, sy, -py, 0,
    0, 0, -(f + n) / (f - n), (-2 * f * n) / (f - n),
    0, 0, -1, 0
  )
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert()
  return camera
}
`

    case 'camera-json': {
      const payload = state.lensDistortionEnabled
        ? {
            ...params,
            lensDistortion: { k1: state.lensK1, k2: state.lensK2 }
          }
        : params
      return JSON.stringify(payload, null, 2)
    }
  }
}

export function downloadDCCExport(state: FSpyStoreState, format: DCCExportFormat) {
  const descriptor = DCC_EXPORT_FORMATS.find((d) => d.id === format)
  if (!descriptor) return
  const code = generateDCCExportCode(state, format)
  const { safeName } = resolveSensorAndFocal(state)
  const blob = new Blob([code], { type: descriptor.mimeType })
  saveAs(blob, `${safeName}_${format}.${descriptor.extension}`)
}

/**
 * Renders a high-resolution Composite Calibration Sheet (.png)
 * baking the reference image, vanishing point lines, convergence rays,
 * origin marker, and solved camera telemetry bar onto an offscreen canvas.
 */
export async function exportCompositeCalibrationPNG(state: FSpyStoreState): Promise<void> {
  const imageUrl =
    state.lensDistortionEnabled && state.undistortedImageUrl
      ? state.undistortedImageUrl
      : state.image.url
  const params = state.solverResult.cameraParameters
  if (!imageUrl || !params) return

  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const w = img.naturalWidth || params.imageWidth
      const h = img.naturalHeight || params.imageHeight
      const footerH = Math.max(54, Math.round(h * 0.06))

      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h + footerH
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve()
        return
      }

      // 1. Background & dimmed reference photo
      ctx.fillStyle = '#0b0b0e'
      ctx.fillRect(0, 0, w, h + footerH)
      ctx.save()
      ctx.globalAlpha = Math.max(0.35, state.globalSettings.imageOpacity)
      ctx.drawImage(img, 0, 0, w, h)
      ctx.restore()

      const lineScale = Math.max(1.5, Math.min(w, h) / 600)
      const axisColor = (axis: string) =>
        axis.endsWith('X') ? Palette.red : axis.endsWith('Y') ? Palette.green : Palette.blue

      const drawVPGroup = (
        segments: [ { x: number; y: number }, { x: number; y: number } ][],
        vpPlane: { x: number; y: number },
        color: string
      ) => {
        const vpPx = CoordinatesUtil.convert(
          vpPlane,
          ImageCoordinateFrame.ImagePlane,
          ImageCoordinateFrame.Absolute,
          w,
          h
        )
        segments.forEach((seg) => {
          const p1 = { x: seg[0].x * w, y: seg[0].y * h }
          const p2 = { x: seg[1].x * w, y: seg[1].y * h }
          const mid = { x: 0.5 * (p1.x + p2.x), y: 0.5 * (p1.y + p2.y) }

          // Dashed convergence ray to VP
          ctx.save()
          ctx.strokeStyle = color
          ctx.globalAlpha = 0.55
          ctx.lineWidth = lineScale * 1.1
          ctx.setLineDash([lineScale * 5, lineScale * 4])
          ctx.beginPath()
          ctx.moveTo(mid.x, mid.y)
          ctx.lineTo(vpPx.x, vpPx.y)
          ctx.stroke()
          ctx.restore()

          // Solid user control segment
          ctx.save()
          ctx.strokeStyle = color
          ctx.lineWidth = lineScale * 2.2
          ctx.beginPath()
          ctx.moveTo(p1.x, p1.y)
          ctx.lineTo(p2.x, p2.y)
          ctx.stroke()

          // Endpoint circles
          ;[p1, p2].forEach((pt) => {
            ctx.fillStyle = color
            ctx.beginPath()
            ctx.arc(pt.x, pt.y, lineScale * 4.2, 0, Math.PI * 2)
            ctx.fill()
          })
          ctx.restore()
        })
      }

      // Draw VP1 and VP2 lines
      drawVPGroup(
        state.controlPointsStateBase.firstVanishingPoint.lineSegments,
        params.vanishingPoints[0],
        axisColor(params.vanishingPointAxes[0])
      )
      if (state.globalSettings.calibrationMode === CalibrationMode.TwoVanishingPoints) {
        drawVPGroup(
          state.controlPointsState2VP.secondVanishingPoint.lineSegments,
          params.vanishingPoints[1],
          axisColor(params.vanishingPointAxes[1])
        )
      }

      // Draw Origin crosshair
      const originPx = {
        x: state.controlPointsStateBase.origin.x * w,
        y: state.controlPointsStateBase.origin.y * h
      }
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(originPx.x, originPx.y, lineScale * 5, 0, Math.PI * 2)
      ctx.fill()

      // Telemetry Footer Bar
      const { focalLengthMm, safeName } = resolveSensorAndFocal(state)
      const hfovDeg = ((params.horizontalFieldOfView * 180) / Math.PI).toFixed(2)
      const vfovDeg = ((params.verticalFieldOfView * 180) / Math.PI).toFixed(2)
      const pos = params.cameraTransform.matrix
      ctx.fillStyle = '#121216'
      ctx.fillRect(0, h, w, footerH)
      ctx.fillStyle = '#f59e0b'
      ctx.fillRect(0, h, w, 2)

      const fontSize = Math.max(12, Math.round(footerH * 0.34))
      ctx.font = `600 ${fontSize}px "JetBrains Mono", monospace`
      ctx.fillStyle = '#f4f4f5'
      ctx.textBaseline = 'middle'
      const summary = `fSpy STUDIO  |  ${w}×${h}px  |  Focal: ${focalLengthMm.toFixed(2)}mm  |  HFOV: ${hfovDeg}°  VFOV: ${vfovDeg}°  |  Cam Pos: [${pos[0][3].toFixed(2)}, ${pos[1][3].toFixed(2)}, ${pos[2][3].toFixed(2)}]`
      ctx.fillText(summary, Math.round(footerH * 0.4), h + footerH / 2)

      canvas.toBlob((blob) => {
        if (blob) {
          saveAs(blob, `${safeName}_calibration_proof.png`)
        }
        resolve()
      }, 'image/png')
    }
    img.onerror = () => resolve()
    img.src = imageUrl
  })
}
