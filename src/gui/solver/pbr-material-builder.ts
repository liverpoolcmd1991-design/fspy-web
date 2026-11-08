/**
 * fSpy Studio — Multi-Scale PBR Material Builder (Delighting, Seamless Tiling,
 * 3-Band Micro/Meso/Macro Height Pyramid, 5x5 Scharr Normal Map, Cavity AO,
 * Specular Roughness & Real-Time 3D Point-Light Relighting Preview)
 */

import { saveAs } from 'file-saver'

export interface PBRMaterialConfig {
  enabled: boolean
  seamlessTiling: boolean
  seamlessBlend: number
  delightStrength: number
  normalStrength: number
  microWeight: number
  mesoWeight: number
  macroWeight: number
  invertHeight: boolean
  roughnessBase: number
  roughnessContrast: number
  aoStrength: number
  previewRepeat: 1 | 2
}

export interface PBRGeneratedMaps {
  width: number
  height: number
  albedoRgba: Uint8ClampedArray
  normalRgba: Uint8ClampedArray
  roughnessGray: Uint8ClampedArray
  aoGray: Uint8ClampedArray
  heightGray: Uint8ClampedArray
  albedoDataUrl: string
  normalDataUrl: string
  roughnessDataUrl: string
  aoDataUrl: string
  heightDataUrl: string
}

export function createDefaultPBRMaterialConfig(): PBRMaterialConfig {
  return {
    enabled: false,
    seamlessTiling: true,
    seamlessBlend: 0.22,
    delightStrength: 0.72,
    normalStrength: 3.0,
    microWeight: 1.0,
    mesoWeight: 1.15,
    macroWeight: 0.85,
    invertHeight: false,
    roughnessBase: 0.55,
    roughnessContrast: 0.45,
    aoStrength: 0.75,
    previewRepeat: 2
  }
}

/**
 * Toroidal wrap index helper so all blurs and derivatives are 100% seamless across borders.
 */
function wrapIdx(i: number, max: number): number {
  const m = i % max
  return m < 0 ? m + max : m
}

/**
 * Multi-pass separable toroidal box blur (3 passes approximate a true Gaussian filter in O(N) time).
 */
function gaussianBlurToroidal(
  src: Float32Array,
  w: number,
  h: number,
  radius: number,
  passes = 3
): Float32Array {
  if (radius <= 0) return new Float32Array(src)
  const r = Math.max(1, Math.round(radius))
  let curr = new Float32Array(src)
  let temp = new Float32Array(w * h)
  const invWindow = 1 / (2 * r + 1)

  for (let p = 0; p < passes; p++) {
    // Horizontal pass with toroidal wrap
    for (let y = 0; y < h; y++) {
      const rowOffset = y * w
      let sum = 0
      for (let k = -r; k <= r; k++) {
        sum += curr[rowOffset + wrapIdx(k, w)]
      }
      temp[rowOffset] = sum * invWindow
      for (let x = 1; x < w; x++) {
        const removeX = wrapIdx(x - r - 1, w)
        const addX = wrapIdx(x + r, w)
        sum += curr[rowOffset + addX] - curr[rowOffset + removeX]
        temp[rowOffset + x] = sum * invWindow
      }
    }

    // Vertical pass with toroidal wrap
    for (let x = 0; x < w; x++) {
      let sum = 0
      for (let k = -r; k <= r; k++) {
        sum += temp[wrapIdx(k, h) * w + x]
      }
      curr[x] = sum * invWindow
      for (let y = 1; y < h; y++) {
        const removeY = wrapIdx(y - r - 1, h)
        const addY = wrapIdx(y + r, h)
        sum += temp[addY * w + x] - temp[removeY * w + x]
        curr[y * w + x] = sum * invWindow
      }
    }
  }

  return curr
}

/**
 * Applies smooth raised-cosine toroidal quilting so opposite borders blend without visible seams.
 */
function makeSeamlessRGB(
  rCh: Float32Array,
  gCh: Float32Array,
  bCh: Float32Array,
  w: number,
  h: number,
  blendRatio: number
): void {
  const bw = Math.max(4, Math.min(Math.floor(w * 0.48), Math.round(w * blendRatio)))
  const bh = Math.max(4, Math.min(Math.floor(h * 0.48), Math.round(h * blendRatio)))

  // Offset copy by (w/2, h/2) and blend near seams using smooth cosine weight
  const rOrig = new Float32Array(rCh)
  const gOrig = new Float32Array(gCh)
  const bOrig = new Float32Array(bCh)
  const halfW = Math.floor(w / 2)
  const halfH = Math.floor(h / 2)

  for (let y = 0; y < h; y++) {
    const distY = Math.min(y, h - 1 - y)
    const wy =
      distY >= bh ? 1 : 0.5 - 0.5 * Math.cos((Math.PI * distY) / bh)

    for (let x = 0; x < w; x++) {
      const distX = Math.min(x, w - 1 - x)
      const wx =
        distX >= bw ? 1 : 0.5 - 0.5 * Math.cos((Math.PI * distX) / bw)

      // Weight of original pixel (1 in interior, 0 at border seams)
      const wOrig = wx * wy
      if (wOrig >= 0.999) continue

      const ox = (x + halfW) % w
      const oy = (y + halfH) % h
      const idx = y * w + x
      const oIdx = oy * w + ox

      rCh[idx] = wOrig * rOrig[idx] + (1 - wOrig) * rOrig[oIdx]
      gCh[idx] = wOrig * gOrig[idx] + (1 - wOrig) * gOrig[oIdx]
      bCh[idx] = wOrig * bOrig[idx] + (1 - wOrig) * bOrig[oIdx]
    }
  }
}

function rgbaBufferToDataUrl(
  rgba: Uint8ClampedArray,
  w: number,
  h: number
): string {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')
  if (!ctx) return ''
  const imgData = new ImageData(new Uint8ClampedArray(rgba), w, h)
  ctx.putImageData(imgData, 0, 0)
  return c.toDataURL('image/png')
}

function grayBufferToDataUrl(
  gray: Uint8ClampedArray,
  w: number,
  h: number
): string {
  const rgba = new Uint8ClampedArray(w * h * 4)
  for (let i = 0; i < w * h; i++) {
    const v = gray[i]
    rgba[i * 4] = v
    rgba[i * 4 + 1] = v
    rgba[i * 4 + 2] = v
    rgba[i * 4 + 3] = 255
  }
  return rgbaBufferToDataUrl(rgba, w, h)
}

/**
 * Full 4-Stage Multi-Scale PBR Material Synthesis Pipeline.
 */
export async function generatePBRMapsFromUnwarpedUrl(
  sourceUrl: string,
  config: PBRMaterialConfig,
  maxSide = 384
): Promise<PBRGeneratedMaps | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const aspect =
        img.naturalHeight > 0 ? img.naturalWidth / img.naturalHeight : 1
      const w =
        aspect >= 1
          ? maxSide
          : Math.max(64, Math.round(maxSide * aspect))
      const h =
        aspect >= 1
          ? Math.max(64, Math.round(maxSide / aspect))
          : maxSide

      const srcCanvas = document.createElement('canvas')
      srcCanvas.width = w
      srcCanvas.height = h
      const ctx = srcCanvas.getContext('2d')
      if (!ctx) {
        resolve(null)
        return
      }
      ctx.drawImage(img, 0, 0, w, h)
      const srcPixels = ctx.getImageData(0, 0, w, h).data
      const count = w * h

      const rCh = new Float32Array(count)
      const gCh = new Float32Array(count)
      const bCh = new Float32Array(count)
      const lum = new Float32Array(count)

      let meanLum = 0
      for (let i = 0; i < count; i++) {
        const r = srcPixels[i * 4] / 255
        const g = srcPixels[i * 4 + 1] / 255
        const b = srcPixels[i * 4 + 2] / 255
        rCh[i] = r
        gCh[i] = g
        bCh[i] = b
        const l = 0.299 * r + 0.587 * g + 0.114 * b
        lum[i] = l
        meanLum += l
      }
      meanLum = Math.max(0.05, meanLum / count)

      // STAGE 1: High-Pass Albedo Delighting (removes uneven room lighting gradient)
      if (config.delightStrength > 0.01) {
        const delightRadius = Math.max(8, Math.round(Math.min(w, h) * 0.18))
        const lowFreqIllum = gaussianBlurToroidal(lum, w, h, delightRadius, 2)
        const s = config.delightStrength
        for (let i = 0; i < count; i++) {
          const localIllum = Math.max(0.08, lowFreqIllum[i])
          const ratio = meanLum / localIllum
          const factor = 1 + s * (ratio - 1)
          rCh[i] = Math.max(0, Math.min(1, rCh[i] * factor))
          gCh[i] = Math.max(0, Math.min(1, gCh[i] * factor))
          bCh[i] = Math.max(0, Math.min(1, bCh[i] * factor))
        }
      }

      // STAGE 2: Smooth Raised-Cosine Toroidal Seamless Tiling
      if (config.seamlessTiling && config.seamlessBlend > 0.01) {
        makeSeamlessRGB(rCh, gCh, bCh, w, h, config.seamlessBlend)
      }

      // Recompute clean delit/seamless luminance for multi-scale height pyramid
      const cleanLum = new Float32Array(count)
      const albedoRgba = new Uint8ClampedArray(count * 4)
      for (let i = 0; i < count; i++) {
        const r = rCh[i]
        const g = gCh[i]
        const b = bCh[i]
        cleanLum[i] = 0.299 * r + 0.587 * g + 0.114 * b
        albedoRgba[i * 4] = Math.round(r * 255)
        albedoRgba[i * 4 + 1] = Math.round(g * 255)
        albedoRgba[i * 4 + 2] = Math.round(b * 255)
        albedoRgba[i * 4 + 3] = 255
      }

      // STAGE 3: 3-Band Multi-Scale Height Pyramid (Micro + Meso + Macro Volume)
      const blurFine = gaussianBlurToroidal(cleanLum, w, h, 2, 2)
      const blurMeso = gaussianBlurToroidal(cleanLum, w, h, 6, 3)
      const blurMacro = gaussianBlurToroidal(cleanLum, w, h, 20, 3)

      const heightField = new Float32Array(count)
      const cavityField = new Float32Array(count)
      const sign = config.invertHeight ? -1 : 1

      let hMin = Infinity
      let hMax = -Infinity
      for (let i = 0; i < count; i++) {
        const micro = cleanLum[i] - blurFine[i]
        const meso = blurFine[i] - blurMeso[i]
        const macro = blurMeso[i] - blurMacro[i]

        const hVal =
          sign *
          (config.microWeight * micro * 1.1 +
            config.mesoWeight * meso * 1.6 +
            config.macroWeight * macro * 2.2)

        heightField[i] = hVal
        if (hVal < hMin) hMin = hVal
        if (hVal > hMax) hMax = hVal

        // Cavity / Ambient Occlusion responds strongly to micro + meso crevices
        const crevice = sign * (micro * 1.4 + meso * 2.2)
        cavityField[i] = crevice
      }

      const hSpan = Math.max(1e-4, hMax - hMin)
      const heightGray = new Uint8ClampedArray(count)
      for (let i = 0; i < count; i++) {
        const normH = (heightField[i] - hMin) / hSpan
        heightField[i] = normH
        heightGray[i] = Math.round(normH * 255)
      }

      // STAGE 4: 5x5 Rotationally-Symmetric Scharr Tangent-Space Normal Map + Roughness + AO
      const normalRgba = new Uint8ClampedArray(count * 4)
      const roughnessGray = new Uint8ClampedArray(count)
      const aoGray = new Uint8ClampedArray(count)
      const strength = config.normalStrength * 5.5

      for (let y = 0; y < h; y++) {
        const ym2 = wrapIdx(y - 2, h) * w
        const ym1 = wrapIdx(y - 1, h) * w
        const y0 = y * w
        const yp1 = wrapIdx(y + 1, h) * w
        const yp2 = wrapIdx(y + 2, h) * w

        for (let x = 0; x < w; x++) {
          const xm2 = wrapIdx(x - 2, w)
          const xm1 = wrapIdx(x - 1, w)
          const xp1 = wrapIdx(x + 1, w)
          const xp2 = wrapIdx(x + 2, w)

          // 5x5 smooth Scharr horizontal & vertical gradients
          const gx =
            (heightField[ym2 + xp2] - heightField[ym2 + xm2]) * 1 +
            (heightField[ym1 + xp2] - heightField[ym1 + xm2]) * 2 +
            (heightField[y0 + xp2] - heightField[y0 + xm2]) * 3 +
            (heightField[yp1 + xp2] - heightField[yp1 + xm2]) * 2 +
            (heightField[yp2 + xp2] - heightField[yp2 + xm2]) * 1 +
            (heightField[ym1 + xp1] - heightField[ym1 + xm1]) * 6 +
            (heightField[y0 + xp1] - heightField[y0 + xm1]) * 10 +
            (heightField[yp1 + xp1] - heightField[yp1 + xm1]) * 6

          const gy =
            (heightField[yp2 + xm2] - heightField[ym2 + xm2]) * 1 +
            (heightField[yp2 + xm1] - heightField[ym2 + xm1]) * 2 +
            (heightField[yp2 + x] - heightField[ym2 + x]) * 3 +
            (heightField[yp2 + xp1] - heightField[ym2 + xp1]) * 2 +
            (heightField[yp2 + xp2] - heightField[ym2 + xp2]) * 1 +
            (heightField[yp1 + xm1] - heightField[ym1 + xm1]) * 6 +
            (heightField[yp1 + x] - heightField[ym1 + x]) * 10 +
            (heightField[yp1 + xp1] - heightField[ym1 + xp1]) * 6

          const nxRaw = (-gx / 48) * strength
          // OpenGL convention: +Y points up
          const nyRaw = (gy / 48) * strength
          const nzRaw = 1.0
          const invLen = 1 / Math.hypot(nxRaw, nyRaw, nzRaw)

          const nx = nxRaw * invLen
          const ny = nyRaw * invLen
          const nz = nzRaw * invLen

          const idx = y0 + x
          normalRgba[idx * 4] = Math.round((nx * 0.5 + 0.5) * 255)
          normalRgba[idx * 4 + 1] = Math.round((ny * 0.5 + 0.5) * 255)
          normalRgba[idx * 4 + 2] = Math.round((nz * 0.5 + 0.5) * 255)
          normalRgba[idx * 4 + 3] = 255

          // Ambient Occlusion (Cavity darkening in recessed mortar/cracks)
          const cav = cavityField[idx]
          const aoVal = Math.max(
            0,
            Math.min(1, 1 + Math.min(0, cav) * 3.8 * config.aoStrength)
          )
          aoGray[idx] = Math.round(aoVal * 255)

          // Roughness Map (recessed grooves are rougher/matte; raised surfaces smoother)
          const hCentered = heightField[idx] - 0.5
          const roughVal = Math.max(
            0.04,
            Math.min(
              0.98,
              config.roughnessBase - hCentered * config.roughnessContrast * 0.85
            )
          )
          roughnessGray[idx] = Math.round(roughVal * 255)
        }
      }

      resolve({
        width: w,
        height: h,
        albedoRgba,
        normalRgba,
        roughnessGray,
        aoGray,
        heightGray,
        albedoDataUrl: rgbaBufferToDataUrl(albedoRgba, w, h),
        normalDataUrl: rgbaBufferToDataUrl(normalRgba, w, h),
        roughnessDataUrl: grayBufferToDataUrl(roughnessGray, w, h),
        aoDataUrl: grayBufferToDataUrl(aoGray, w, h),
        heightDataUrl: grayBufferToDataUrl(heightGray, w, h)
      })
    }
    img.onerror = () => resolve(null)
    img.src = sourceUrl
  })
}

/**
 * Renders a real-time 3D Point-Light relighted preview of the generated PBR maps
 * (Albedo + Tangent-Space Normal + Specular Roughness + Cavity AO + Seamless Repeat)
 * onto an interactive HTML5 canvas.
 */
export function renderPBRLitPreviewToCanvas(
  canvas: HTMLCanvasElement,
  maps: PBRGeneratedMaps,
  lightNormPos: { x: number; y: number; z: number },
  repeat: 1 | 2
): void {
  const cw = canvas.width
  const ch = canvas.height
  const ctx = canvas.getContext('2d')
  if (!ctx || cw <= 0 || ch <= 0) return

  const outImg = ctx.createImageData(cw, ch)
  const out = outImg.data
  const mw = maps.width
  const mh = maps.height
  const { albedoRgba, normalRgba, roughnessGray, aoGray } = maps

  const lx = lightNormPos.x
  const ly = lightNormPos.y
  const lz = lightNormPos.z

  for (let py = 0; py < ch; py++) {
    const vNorm = py / ch
    const ty = Math.floor((vNorm * repeat * mh) % mh)
    const rowOff = ty * mw

    // Pixel position in normalized [-0.5, 0.5] surface coordinates (with +Y up for OpenGL normal match)
    const surfY = 0.5 - vNorm

    for (let px = 0; px < cw; px++) {
      const uNorm = px / cw
      const tx = Math.floor((uNorm * repeat * mw) % mw)
      const mIdx = rowOff + tx

      const surfX = uNorm - 0.5

      // Light vector from surface point to 3D point light
      let dx = lx - surfX
      let dy = ly - surfY
      let dz = lz
      const distSq = dx * dx + dy * dy + dz * dz
      const invDist = 1 / Math.sqrt(distSq)
      dx *= invDist
      dy *= invDist
      dz *= invDist

      // Unpack tangent-space normal
      const nx = (normalRgba[mIdx * 4] / 255) * 2 - 1
      const ny = (normalRgba[mIdx * 4 + 1] / 255) * 2 - 1
      const nz = (normalRgba[mIdx * 4 + 2] / 255) * 2 - 1

      // Diffuse N dot L
      const nDotL = Math.max(0, nx * dx + ny * dy + nz * dz)

      // Halfway vector H = normalize(L + V), where V = (0, 0, 1)
      let hx = dx
      let hy = dy
      let hz = dz + 1.0
      const invH = 1 / Math.hypot(hx, hy, hz)
      hx *= invH
      hy *= invH
      hz *= invH

      const nDotH = Math.max(0, nx * hx + ny * hy + nz * hz)

      const rough = roughnessGray[mIdx] / 255
      const gloss = 1 - rough
      const shininess = 6 + gloss * gloss * 96
      const specStrength = (0.08 + gloss * 0.75) * Math.pow(nDotH, shininess)

      const ao = aoGray[mIdx] / 255
      const attenuation = 1 / (0.65 + 0.55 * distSq)
      const diffuseTerm = (0.18 + 1.05 * nDotL * attenuation) * ao

      const ar = albedoRgba[mIdx * 4]
      const ag = albedoRgba[mIdx * 4 + 1]
      const ab = albedoRgba[mIdx * 4 + 2]

      // Warm key light + specular highlight
      const specAdd = specStrength * 255 * attenuation * ao
      const outIdx = (py * cw + px) * 4
      out[outIdx] = Math.min(255, Math.round(ar * diffuseTerm + specAdd * 1.04))
      out[outIdx + 1] = Math.min(255, Math.round(ag * diffuseTerm + specAdd * 0.98))
      out[outIdx + 2] = Math.min(255, Math.round(ab * diffuseTerm + specAdd * 0.90))
      out[outIdx + 3] = 255
    }
  }

  ctx.putImageData(outImg, 0, 0)
}

/**
 * Downloads an individual PBR texture map or a 2x2 Contact Sheet containing all 4 maps.
 */
export function downloadPBRMap(dataUrl: string, baseName: string, suffix: string): void {
  if (!dataUrl) return
  saveAs(dataUrl, `${baseName}_${suffix}.png`)
}

export function downloadAllPBRMapsBundle(maps: PBRGeneratedMaps, baseName: string): void {
  const safe = baseName.replace(/[^a-zA-Z0-9_-]/g, '_') || 'fSpy_Material'
  downloadPBRMap(maps.albedoDataUrl, safe, 'Albedo_BaseColor')
  setTimeout(() => downloadPBRMap(maps.normalDataUrl, safe, 'Normal_OpenGL'), 120)
  setTimeout(() => downloadPBRMap(maps.roughnessDataUrl, safe, 'Roughness'), 240)
  setTimeout(() => downloadPBRMap(maps.aoDataUrl, safe, 'AmbientOcclusion'), 360)
  setTimeout(() => downloadPBRMap(maps.heightDataUrl, safe, 'Height_Displacement'), 480)
}
