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

import exifr from 'exifr'

export interface ExtractedExifData {
  make?: string
  model?: string
  focalLength?: number
  focalLength35mm?: number
}

export function loadImage(
  imageBuffer: Uint8Array,
  onLoad: (width: number, height: number, url: string) => void,
  onError: () => void
) {
  const safeArrayBuffer = new Uint8Array(imageBuffer).buffer
  const blob = new Blob([safeArrayBuffer])
  const url = URL.createObjectURL(blob)
  const image = new Image()
  image.src = url
  image.onload = () => {
    onLoad(image.width, image.height, url)
  }
  image.onerror = () => {
    URL.revokeObjectURL(url)
    onError()
  }
}

export async function extractExifFromBuffer(imageBuffer: Uint8Array): Promise<ExtractedExifData | null> {
  try {
    const safeArrayBuffer = new Uint8Array(imageBuffer).buffer
    const parsed = await exifr.parse(safeArrayBuffer, [
      'Make',
      'Model',
      'FocalLength',
      'FocalLengthIn35mmFormat',
      'FocalLengthIn35mmFilm',
    ])
    if (!parsed) {
      return null
    }
    const focalLength35mm =
      typeof parsed.FocalLengthIn35mmFormat === 'number'
        ? parsed.FocalLengthIn35mmFormat
        : typeof parsed.FocalLengthIn35mmFilm === 'number'
          ? parsed.FocalLengthIn35mmFilm
          : undefined

    const focalLength = typeof parsed.FocalLength === 'number' ? parsed.FocalLength : undefined
    const make = typeof parsed.Make === 'string' ? parsed.Make.trim() : undefined
    const model = typeof parsed.Model === 'string' ? parsed.Model.trim() : undefined

    if (!focalLength && !focalLength35mm && !make && !model) {
      return null
    }

    return {
      make,
      model,
      focalLength,
      focalLength35mm,
    }
  } catch (_err) {
    return null
  }
}

export function resourceURL(fileName: string): string {
  return fileName
}

export function resourcePath(fileName: string): string {
  return fileName
}

export async function fetchBytesAsync(url: string): Promise<Uint8Array> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.statusText}`)
  }
  const arrayBuffer = await response.arrayBuffer()
  return new Uint8Array(arrayBuffer)
}

export function removeExtension(fileName: string, extension: string): string {
  if (fileName.endsWith('.' + extension)) {
    return fileName.slice(0, -extension.length - 1)
  } else {
    return fileName
  }
}

export function removeAllExtensions(fileName: string): string {
  const end = fileName.indexOf('.')
  return end < 0 ? fileName : fileName.slice(0, end)
}

