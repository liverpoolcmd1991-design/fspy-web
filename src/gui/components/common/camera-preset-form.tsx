/**
 * fSpy
 * Copyright (c) 2020 - Per Gantelius
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import React from 'react'
import { cameraPresets } from '../../solver/camera-presets'
import strings from '../../strings/strings'
import { CameraData } from '../../types/calibration-settings'
import CameraPresetsDropdown from './camera-presets-dropdown'
import NumericInputField from './numeric-input-field'

export interface CameraPresetFormProps {
  absoluteFocalLength: number
  cameraData: CameraData
  onCameraPresetChange(cameraPreset: string | null): void
  onSensorSizeChange(
    width: number | undefined,
    height: number | undefined
  ): void
  children?: React.ReactNode
}

export default function CameraPresetForm(props: CameraPresetFormProps) {
  let sensorWidth = props.cameraData.customSensorWidth
  let sensorHeight = props.cameraData.customSensorHeight
  const presetId = props.cameraData.presetId
  if (presetId != null) {
    const preset = cameraPresets[presetId]
    if (preset) {
      sensorWidth = preset.sensorWidth
      sensorHeight = preset.sensorHeight
    }
  }

  return (
    <div className="space-y-2.5">
      <CameraPresetsDropdown
        cameraData={props.cameraData}
        onPresetChanged={props.onCameraPresetChange}
      />
      <div className="flex items-center justify-between gap-1.5 text-xs text-slate-300">
        <span className="text-slate-400">Sensor</span>
        <div className="flex items-center gap-1.5">
          <NumericInputField
            isDisabled={presetId !== null}
            value={sensorWidth}
            onSubmit={(value: number) => {
              props.onSensorSizeChange(value, undefined)
            }}
          />
          <span className="text-slate-500">×</span>
          <NumericInputField
            isDisabled={presetId !== null}
            value={sensorHeight}
            onSubmit={(value: number) => {
              props.onSensorSizeChange(undefined, value)
            }}
          />
          <span className="text-slate-500 text-[11px]">{strings.unitMm}</span>
        </div>
      </div>

      {props.children}
    </div>
  )
}

