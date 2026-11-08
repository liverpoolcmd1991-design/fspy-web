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

import { saveAs } from 'file-saver'
import { defaultResultDisplaySettings } from '../defaults/result-display-settings'
import { cameraPresets } from '../solver/camera-presets'
import { useFSpyStore } from '../store/use-fspy-store'
import { ReferenceDistanceUnit } from '../types/calibration-settings'
import SavedState from './saved-state'
import { fetchBytesAsync, loadImage, resourcePath } from './util'

export default class ProjectFile {
  static readonly EXAMPLE_PROJECT_FILENAME = 'example.fspy'
  static readonly PROJECT_FILE_EXTENSION = 'fspy'
  static readonly PROJECT_FILE_ID = 'fspy'
  static readonly PROJECT_FILE_VERSION = 1
  static readonly DEFAULT_PROJECT_NAME = 'Untitled'

  static get exampleProjectPath() {
    return resourcePath(this.EXAMPLE_PROJECT_FILENAME)
  }

  static getStateToSave(): SavedState {
    const storeState = useFSpyStore.getState()
    return {
      globalSettings: storeState.globalSettings,
      calibrationSettingsBase: storeState.calibrationSettingsBase,
      calibrationSettings1VP: storeState.calibrationSettings1VP,
      calibrationSettings2VP: storeState.calibrationSettings2VP,
      controlPointsStateBase: storeState.controlPointsStateBase,
      controlPointsState1VP: storeState.controlPointsState1VP,
      controlPointsState2VP: storeState.controlPointsState2VP,
      cameraParameters: storeState.solverResult.cameraParameters,
      resultDisplaySettings: storeState.resultDisplaySettings,
    }
  }

  static save(projectName: string | null) {
    let fileName = projectName ?? this.DEFAULT_PROJECT_NAME

    if (!fileName.endsWith('.' + this.PROJECT_FILE_EXTENSION)) {
      fileName += '.' + this.PROJECT_FILE_EXTENSION
    }

    const storeState = useFSpyStore.getState()
    const imageData = storeState.image.data
    const stateToSave = this.getStateToSave()

    const stateJsonString = JSON.stringify(stateToSave)
    const encoder = new TextEncoder()
    const stateBytes = encoder.encode(stateJsonString)

    const headerBuffer = new ArrayBuffer(16)
    const headerView = new DataView(headerBuffer)

    headerView.setUint8(0, this.PROJECT_FILE_ID.charCodeAt(0))
    headerView.setUint8(1, this.PROJECT_FILE_ID.charCodeAt(1))
    headerView.setUint8(2, this.PROJECT_FILE_ID.charCodeAt(2))
    headerView.setUint8(3, this.PROJECT_FILE_ID.charCodeAt(3))
    headerView.setUint32(4, this.PROJECT_FILE_VERSION, true)
    headerView.setUint32(8, stateBytes.byteLength, true)
    headerView.setUint32(12, imageData ? imageData.byteLength : 0, true)

    const blobParts: BlobPart[] = [
      headerBuffer,
      new Uint8Array(stateBytes).buffer,
    ]
    if (imageData) {
      blobParts.push(new Uint8Array(imageData).buffer)
    }

    const blob = new Blob(blobParts, { type: 'application/octet-stream' })
    saveAs(blob, fileName)
    storeState.markProjectSaved(fileName.replace(/\.fspy$/i, ''))
    storeState.showToast(`Saved project "${fileName}"`)
  }

  static async loadExample() {
    try {
      const bytes = await fetchBytesAsync(this.exampleProjectPath)
      this.load(this.exampleProjectPath, bytes, true)
    } catch (error) {
      console.error('Failed to load example project:', error)
      useFSpyStore.getState().showToast('Could not load example project.')
    }
  }

  static load(path: string, buffer: Uint8Array, isExampleProject: boolean) {
    const store = useFSpyStore.getState()
    if (!this.isProjectFile(buffer)) {
      store.showToast('Invalid project file: header signature mismatch.')
      return
    }

    const headerSize = 16
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)
    const projectFileVersion = view.getUint32(4, true)
    if (projectFileVersion !== this.PROJECT_FILE_VERSION) {
      store.showToast(
        `Version ${projectFileVersion} project files are not compatible with this version of fSpy.`
      )
      return
    }

    const stateStringSize = view.getUint32(8, true)
    const imageBufferSize = view.getUint32(12, true)

    const stateBytes = buffer.subarray(headerSize, headerSize + stateStringSize)
    const decoder = new TextDecoder('utf-8')
    const stateString = decoder.decode(stateBytes)

    let imageBuffer: Uint8Array | null = null
    if (imageBufferSize > 0) {
      imageBuffer = buffer.slice(
        headerSize + stateStringSize,
        headerSize + stateStringSize + imageBufferSize
      )
    }

    const loadedState: SavedState = JSON.parse(stateString)
    if (loadedState.cameraParameters === undefined) {
      loadedState.cameraParameters = null
    }
    if (loadedState.resultDisplaySettings === undefined) {
      loadedState.resultDisplaySettings = defaultResultDisplaySettings
    }

    const distanceUnitString =
      loadedState.calibrationSettingsBase.referenceDistanceUnit.toString()
    if (distanceUnitString === 'Yards') {
      loadedState.calibrationSettingsBase.referenceDistanceUnit =
        ReferenceDistanceUnit.Feet
      loadedState.calibrationSettingsBase.referenceDistance *= 3.0
    }

    const cameraPresetId =
      loadedState.calibrationSettingsBase.cameraData.presetId
    if (cameraPresetId) {
      if (cameraPresets[cameraPresetId] === undefined) {
        loadedState.calibrationSettingsBase.cameraData.presetId = null
      }
    }

    if (
      loadedState.calibrationSettingsBase.cameraData.presetData === undefined
    ) {
      loadedState.calibrationSettingsBase.cameraData.presetData = null
      const presetId = loadedState.calibrationSettingsBase.cameraData.presetId
      if (presetId) {
        const preset = cameraPresets[presetId]
        if (preset) {
          loadedState.calibrationSettingsBase.cameraData.presetData = preset
        }
      }
    }

    if (imageBuffer) {
      const validImageBuffer = imageBuffer
      loadImage(
        validImageBuffer,
        (width: number, height: number, url: string) => {
          useFSpyStore.getState().loadProjectState(
            loadedState,
            {
              width,
              height,
              data: validImageBuffer,
              url,
            },
            path,
            isExampleProject
          )
          // Clear undo history on fresh project load
          useFSpyStore.temporal.getState().clear()
        },
        () => {
          useFSpyStore
            .getState()
            .showToast('Failed to decode image data contained in project file.')
        }
      )
    } else {
      store.loadProjectState(
        loadedState,
        {
          width: null,
          height: null,
          data: null,
          url: null,
        },
        path,
        isExampleProject
      )
      useFSpyStore.temporal.getState().clear()
    }
  }

  static isProjectFile(buffer: Uint8Array): boolean {
    if (buffer.byteLength < 16) {
      return false
    }

    for (let i = 0; i < this.PROJECT_FILE_ID.length; i++) {
      if (buffer[i] !== this.PROJECT_FILE_ID.charCodeAt(i)) {
        return false
      }
    }

    return true
  }
}

