/**
 * fSpy
 * Copyright (c) 2020 - Per Gantelius
 */

import TableRow from './table-row'
import BulletList, { BulletListType } from './bullet-list'
import CameraPresetForm from '../common/camera-preset-form'
import { CameraData, ReferenceDistanceUnit } from '../../types/calibration-settings'
import { cameraPresets } from '../../solver/camera-presets'
import { CalibrationMode } from '../../types/global-settings'
import Dropdown from '../common/dropdown'
import {
  FieldOfViewFormat,
  OrientationFormat,
  PrincipalPointFormat
} from '../../types/result-display-settings'
import MathUtil from '../../solver/math-util'
import CoordinatesUtil, { ImageCoordinateFrame } from '../../solver/coordinates-util'
import {
  computeWorldRulerDistance,
  undistortRelativePoint
} from '../../solver/lens-distortion'
import Checkbox from '../settings-panel/checkbox'
import Solver from '../../solver/solver'
import strings from '../../strings/strings'
import { useFSpyStore } from '../../store/use-fspy-store'
import { Download, FileCode2, Share2 } from 'lucide-react'

interface ResultPanelProps {
  onExportJson(): void
  onExportBlenderScript(): void
}

export default function ResultPanel(props: ResultPanelProps) {
  const globalSettings = useFSpyStore((s) => s.globalSettings)
  const calibrationSettings = useFSpyStore((s) => s.calibrationSettingsBase)
  const solverResult = useFSpyStore((s) => s.solverResult)
  const resultDisplaySettings = useFSpyStore((s) => s.resultDisplaySettings)
  const image = useFSpyStore((s) => s.image)
  const multiLineSolverEnabled = useFSpyStore((s) => s.multiLineSolverEnabled)
  const showResidualErrorHUD = useFSpyStore((s) => s.showResidualErrorHUD)

  const lensDistortionEnabled = useFSpyStore((s) => s.lensDistortionEnabled)
  const lensK1 = useFSpyStore((s) => s.lensK1)
  const lensK2 = useFSpyStore((s) => s.lensK2)
  const worldRulerEnabled = useFSpyStore((s) => s.worldRulerEnabled)
  const worldRulerPlane = useFSpyStore((s) => s.worldRulerPlane)
  const worldRulerPoints = useFSpyStore((s) => s.worldRulerPoints)

  const setCameraPreset = useFSpyStore((s) => s.setCameraPreset)
  const setCustomSensorSize = useFSpyStore((s) => s.setCustomSensorSize)
  const setFieldOfViewFormat = useFSpyStore((s) => s.setFieldOfViewFormat)
  const setOrientationFormat = useFSpyStore((s) => s.setOrientationFormat)
  const setDisplayAbsoluteFocalLength = useFSpyStore((s) => s.setDisplayAbsoluteFocalLength)
  const setPrincipalPointFormat = useFSpyStore((s) => s.setPrincipalPointFormat)
  const setActiveModal = useFSpyStore((s) => s.setActiveModal)

  const cameraParameters = solverResult.cameraParameters

  const renderFieldOfViewSection = () => {
    if (!cameraParameters) return null
    const displayDegrees = resultDisplaySettings.fieldOfViewFormat === FieldOfViewFormat.Degrees
    const fovFactor = displayDegrees ? 180 / Math.PI : 1
    return (
      <div className='p-3.5 border-b border-zinc-800/80 space-y-2'>
        <div className='text-[11px] font-semibold uppercase tracking-wider text-zinc-400'>
          Field of View
        </div>
        <Dropdown
          options={[
            { id: FieldOfViewFormat.Degrees, title: 'Degrees (°)', value: FieldOfViewFormat.Degrees },
            { id: FieldOfViewFormat.Radians, title: 'Radians (rad)', value: FieldOfViewFormat.Radians }
          ]}
          selectedOptionId={resultDisplaySettings.fieldOfViewFormat}
          onOptionSelected={setFieldOfViewFormat}
        />
        <div className='pt-1'>
          <TableRow
            isFirstRow={true}
            title='Horizontal'
            value={fovFactor * cameraParameters.horizontalFieldOfView}
          />
          <TableRow
            isLastRow={true}
            title='Vertical'
            value={fovFactor * cameraParameters.verticalFieldOfView}
          />
        </div>
      </div>
    )
  }

  const renderOrientationSection = () => {
    if (!cameraParameters) return null
    const displayFormat = resultDisplaySettings.orientationFormat
    const displayAxisAngle = displayFormat !== OrientationFormat.Quaterion
    const cameraTransform = cameraParameters.cameraTransform
    const components = displayAxisAngle
      ? MathUtil.matrixToAxisAngle(cameraTransform)
      : MathUtil.matrixToQuaternion(cameraTransform)
    if (displayFormat === OrientationFormat.AxisAngleDegrees) {
      components[3] = (180 * components[3]) / Math.PI
    }

    return (
      <div className='p-3.5 border-b border-zinc-800/80 space-y-2'>
        <div className='text-[11px] font-semibold uppercase tracking-wider text-zinc-400'>
          Camera Orientation
        </div>
        <Dropdown
          options={[
            {
              id: OrientationFormat.AxisAngleDegrees,
              title: 'Axis angle (degrees)',
              value: OrientationFormat.AxisAngleDegrees
            },
            {
              id: OrientationFormat.AxisAngleRadians,
              title: 'Axis angle (radians)',
              value: OrientationFormat.AxisAngleRadians
            },
            { id: OrientationFormat.Quaterion, title: 'Quaternion', value: OrientationFormat.Quaterion }
          ]}
          selectedOptionId={resultDisplaySettings.orientationFormat}
          onOptionSelected={setOrientationFormat}
        />
        <div className='pt-1'>
          <TableRow isFirstRow={true} title='x' value={components[0]} />
          <TableRow title='y' value={components[1]} />
          <TableRow title='z' value={components[2]} />
          <TableRow
            isLastRow={true}
            title={displayAxisAngle ? 'Angle' : 'w'}
            value={components[3]}
          />
        </div>
      </div>
    )
  }

  const renderPrincipalPointSection = () => {
    if (!cameraParameters) return null
    let displayPosition = cameraParameters.principalPoint
    switch (resultDisplaySettings.principalPointFormat) {
      case PrincipalPointFormat.Absolute:
        displayPosition = CoordinatesUtil.convert(
          displayPosition,
          ImageCoordinateFrame.ImagePlane,
          ImageCoordinateFrame.Absolute,
          cameraParameters.imageWidth,
          cameraParameters.imageHeight
        )
        break
      case PrincipalPointFormat.Relative:
        displayPosition = CoordinatesUtil.convert(
          displayPosition,
          ImageCoordinateFrame.ImagePlane,
          ImageCoordinateFrame.Relative,
          cameraParameters.imageWidth,
          cameraParameters.imageHeight
        )
        break
    }

    return (
      <div className='p-3.5 border-b border-zinc-800/80 space-y-2'>
        <div className='text-[11px] font-semibold uppercase tracking-wider text-zinc-400'>
          Principal Point
        </div>
        <Dropdown
          options={[
            { id: PrincipalPointFormat.Absolute, title: 'Absolute (px)', value: PrincipalPointFormat.Absolute },
            { id: PrincipalPointFormat.Relative, title: 'Relative (0–1)', value: PrincipalPointFormat.Relative }
          ]}
          selectedOptionId={resultDisplaySettings.principalPointFormat}
          onOptionSelected={setPrincipalPointFormat}
        />
        <div className='pt-1'>
          <TableRow isFirstRow={true} title='x' value={displayPosition.x} />
          <TableRow isLastRow={true} title='y' value={displayPosition.y} />
        </div>
      </div>
    )
  }

  const renderFocalLengthSection = () => {
    if (!cameraParameters) return null
    if (globalSettings.calibrationMode === CalibrationMode.OneVanishingPoint) {
      return null
    }

    const cameraData: CameraData = calibrationSettings.cameraData
    let sensorWidth = cameraData.customSensorWidth
    let sensorHeight = cameraData.customSensorHeight
    if (cameraData.presetId && cameraPresets[cameraData.presetId]) {
      const preset = cameraPresets[cameraData.presetId]
      sensorWidth = preset.sensorWidth
      sensorHeight = preset.sensorHeight
    }
    const sensorAspectRatio = sensorHeight > 0 ? sensorWidth / sensorHeight : 1
    const absoluteFocalLength =
      sensorAspectRatio > 1
        ? 0.5 * sensorWidth * cameraParameters.relativeFocalLength
        : 0.5 * sensorHeight * cameraParameters.relativeFocalLength

    const displayFocalLength = resultDisplaySettings.displayAbsoluteFocalLength
    const proportionsMatch = Solver.imageProportionsMatchSensor(
      cameraParameters.imageWidth,
      cameraParameters.imageHeight,
      sensorWidth,
      sensorHeight
    )

    return (
      <div className='p-3.5 border-b border-zinc-800/80 space-y-2.5'>
        <Checkbox
          title='Solved Focal Length'
          isSelected={displayFocalLength}
          onChange={(enabled: boolean) => setDisplayAbsoluteFocalLength(enabled)}
        />
        {displayFocalLength && (
          <div className='space-y-2'>
            <CameraPresetForm
              absoluteFocalLength={absoluteFocalLength}
              cameraData={cameraData}
              onCameraPresetChange={setCameraPreset}
              onSensorSizeChange={setCustomSensorSize}
            >
              <TableRow value={absoluteFocalLength} title='Focal length (mm)' />
            </CameraPresetForm>
          </div>
        )}
        {!proportionsMatch && displayFocalLength && (
          <BulletList
            messages={[strings.imageSensorProportionsMismatch]}
            type={BulletListType.Warnings}
          />
        )}
      </div>
    )
  }

  const renderResidualsSection = () => {
    if (
      (!multiLineSolverEnabled && !showResidualErrorHUD) ||
      !solverResult.vpResiduals ||
      solverResult.vpResiduals.length === 0
    ) {
      return null
    }

    return (
      <div className='p-3.5 border-b border-zinc-800/80 space-y-1.5'>
        <div className='text-[11px] font-semibold uppercase tracking-wider text-amber-400/90'>
          VP Convergence Error (RMS °)
        </div>
        {solverResult.vpResiduals.map((res) => (
          <TableRow
            key={res.vpIndex}
            title={`VP ${res.vpIndex + 1} (${res.segmentAnglesDeg.length}L)`}
            value={Number(res.rmsAngleDeg.toFixed(4))}
          />
        ))}
      </div>
    )
  }

  const renderOptInTelemetrySection = () => {
    if (!cameraParameters || (!worldRulerEnabled && !lensDistortionEnabled)) {
      return null
    }

    let rulerDistance: number | null = null
    if (worldRulerEnabled) {
      const aspect =
        image.width && image.height ? image.width / image.height : 1.5
      const p1 =
        lensDistortionEnabled && (Math.abs(lensK1) > 1e-6 || Math.abs(lensK2) > 1e-6)
          ? undistortRelativePoint(worldRulerPoints[0], lensK1, lensK2, aspect)
          : worldRulerPoints[0]
      const p2 =
        lensDistortionEnabled && (Math.abs(lensK1) > 1e-6 || Math.abs(lensK2) > 1e-6)
          ? undistortRelativePoint(worldRulerPoints[1], lensK1, lensK2, aspect)
          : worldRulerPoints[1]

      rulerDistance = computeWorldRulerDistance(
        p1,
        p2,
        worldRulerPlane,
        cameraParameters
      )
    }

    const unitSuffix =
      calibrationSettings.referenceDistanceUnit === ReferenceDistanceUnit.None
        ? 'u'
        : calibrationSettings.referenceDistanceUnit

    return (
      <div className='p-3.5 border-b border-zinc-800/80 space-y-1.5'>
        <div className='text-[11px] font-semibold uppercase tracking-wider text-emerald-400/90'>
          Studio Measurement &amp; Lens
        </div>
        {worldRulerEnabled && (
          <TableRow
            title={`3D Ruler (${unitSuffix})`}
            value={
              rulerDistance !== null ? Number(rulerDistance.toFixed(4)) : null
            }
          />
        )}
        {lensDistortionEnabled && (
          <>
            <TableRow title='Radial k1' value={Number(lensK1.toFixed(4))} />
            <TableRow
              isLastRow={true}
              title='Radial k2'
              value={Number(lensK2.toFixed(4))}
            />
          </>
        )}
      </div>
    )
  }

  return (
    <aside className='w-72 shrink-0 bg-[#141418] border-l border-zinc-800/80 flex flex-col h-full overflow-y-auto select-none'>
      <div className='px-3.5 py-2.5 border-b border-zinc-800/80 flex items-center justify-between'>
        <span className='text-[11px] font-semibold uppercase tracking-wider text-zinc-400'>
          Solved Camera Telemetry
        </span>
        <span
          className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
            cameraParameters
              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
              : 'bg-red-500/15 text-red-300 border border-red-500/30'
          }`}
        >
          {cameraParameters ? 'SOLVED' : 'INVALID'}
        </span>
      </div>

      {solverResult.errors.length > 0 && (
        <div className='p-3.5 border-b border-zinc-800/80'>
          <BulletList messages={solverResult.errors} type={BulletListType.Errors} />
        </div>
      )}

      {cameraParameters && (
        <>
          <div className='p-3.5 border-b border-zinc-800/80 space-y-1'>
            <div className='text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5'>
              Image Dimensions
            </div>
            <TableRow title='Width (px)' value={image.width} />
            <TableRow isLastRow={true} title='Height (px)' value={image.height} />
          </div>

          {renderFieldOfViewSection()}

          <div className='p-3.5 border-b border-zinc-800/80 space-y-1'>
            <div className='text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5'>
              Camera Position (World)
            </div>
            <TableRow title='x' value={cameraParameters.cameraTransform.matrix[0][3]} />
            <TableRow title='y' value={cameraParameters.cameraTransform.matrix[1][3]} />
            <TableRow
              isLastRow={true}
              title='z'
              value={cameraParameters.cameraTransform.matrix[2][3]}
            />
          </div>

          {renderOrientationSection()}
          {renderPrincipalPointSection()}
          {renderFocalLengthSection()}
          {renderResidualsSection()}
          {renderOptInTelemetrySection()}

          {/* Quick Export Actions */}
          <div className='p-3.5 border-b border-zinc-800/80 space-y-2'>
            <div className='text-[11px] font-semibold uppercase tracking-wider text-zinc-400'>
              Export &amp; DCC Integration
            </div>
            <div className='grid grid-cols-2 gap-1.5'>
              <button
                type='button'
                onClick={props.onExportBlenderScript}
                className='flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-xs transition-colors cursor-pointer'
              >
                <FileCode2 className='w-3.5 h-3.5' />
                <span>Blender .py</span>
              </button>
              <button
                type='button'
                onClick={props.onExportJson}
                className='flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/80 font-medium text-xs transition-colors cursor-pointer'
              >
                <Download className='w-3.5 h-3.5' />
                <span>Camera JSON</span>
              </button>
            </div>
            <button
              type='button'
              onClick={() => setActiveModal('export-hub')}
              className='w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700/80 font-medium text-xs transition-colors cursor-pointer'
            >
              <Share2 className='w-3.5 h-3.5 text-amber-400' />
              <span>Export Hub (Unreal, Maya, C4D, PNG)…</span>
            </button>
          </div>
        </>
      )}

      {solverResult.warnings.length > 0 && (
        <div className='p-3.5'>
          <BulletList messages={solverResult.warnings} type={BulletListType.Warnings} />
        </div>
      )}
    </aside>
  )
}
