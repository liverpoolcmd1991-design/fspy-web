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

export interface CameraPreset {
  displayName: string
  sensorWidth: number
  sensorHeight: number
  focalLength?: number
}

export const cameraPresets: { [id: string]: CameraPreset } = {
  'aps-c': {
    displayName: 'APS-C DSLR',
    sensorWidth: 22.3,
    sensorHeight: 14.9
  },
  'canon_1d': {
    displayName: 'Canon 1D',
    sensorWidth: 27.9,
    sensorHeight: 18.6
  },
  'canon_1ds': {
    displayName: 'Canon 1DS',
    sensorWidth: 36,
    sensorHeight: 24
  },
  'canon_5d': {
    displayName: 'Canon 5D',
    sensorWidth: 36,
    sensorHeight: 24
  },
  'canon_7d': {
    displayName: 'Canon 7D',
    sensorWidth: 22.3,
    sensorHeight: 14.9
  },
  'canon_60d': {
    displayName: 'Canon 60D',
    sensorWidth: 22.3,
    sensorHeight: 14.9
  },
  'canon_500d': {
    displayName: 'Canon 500D',
    sensorWidth: 22.3,
    sensorHeight: 14.9
  },
  'canon_550d': {
    displayName: 'Canon 550D',
    sensorWidth: 22.3,
    sensorHeight: 14.9
  },
  'canon_600d': {
    displayName: 'Canon 600D',
    sensorWidth: 22.3,
    sensorHeight: 14.9
  },
  'canon_1100d': {
    displayName: 'Canon 1100D',
    sensorWidth: 22.2,
    sensorHeight: 14.7
  },
  'canon_g7x_mk2': {
    displayName: 'Canon G7X Mark II',
    sensorWidth: 13.2,
    sensorHeight: 8.8
  },
  '35_mm_film': {
    displayName: '35 mm film',
    sensorWidth: 36,
    sensorHeight: 24
  },
  'micro_4_3rds': {
    displayName: 'Micro four thirds',
    sensorWidth: 17.3,
    sensorHeight: 14
  },
  'nikon_d3s': {
    displayName: 'Nikon D3S',
    sensorWidth: 36,
    sensorHeight: 23.9
  },
  'nikon_d90': {
    displayName: 'Nikon D90',
    sensorWidth: 23.6,
    sensorHeight: 15.8
  },
  'nikon_d300s': {
    displayName: 'Nikon D300S',
    sensorWidth: 23.6,
    sensorHeight: 15.8
  },
  'nikon_d3100': {
    displayName: 'Nikon D3100',
    sensorWidth: 23.1,
    sensorHeight: 15.4
  },
  'nikon_d5000': {
    displayName: 'Nikon D5000',
    sensorWidth: 23.6,
    sensorHeight: 15.8
  },
  'nikon_d5100': {
    displayName: 'Nikon D5100',
    sensorWidth: 23.6,
    sensorHeight: 15.6
  },
  'nikon_d7000': {
    displayName: 'Nikon D7000',
    sensorWidth: 23.6,
    sensorHeight: 15.6
  },
  'red_epic': {
    displayName: 'Red Epic',
    sensorWidth: 30,
    sensorHeight: 15
  },
  'red_epic_2k': {
    displayName: 'Red Epic 2k',
    sensorWidth: 11.1,
    sensorHeight: 6.24
  },
  'red_epic_3k': {
    displayName: 'Red Epic 3k',
    sensorWidth: 16.65,
    sensorHeight: 9.36
  },
  'red_epic_4k': {
    displayName: 'Red Epic 4k',
    sensorWidth: 22.2,
    sensorHeight: 12.6
  },
  'sony_a55': {
    displayName: 'Sony A55',
    sensorWidth: 23.4,
    sensorHeight: 15.6
  },
  'sony_a7_iv': {
    displayName: 'Sony Alpha A7 IV / A7R V (Full Frame)',
    sensorWidth: 35.9,
    sensorHeight: 24.0
  },
  'sony_fx3': {
    displayName: 'Sony FX3 / A7S III (Full Frame Cinema)',
    sensorWidth: 35.6,
    sensorHeight: 23.8
  },
  'canon_eos_r5': {
    displayName: 'Canon EOS R5 / R6 Mark II',
    sensorWidth: 36.0,
    sensorHeight: 24.0
  },
  'nikon_z8': {
    displayName: 'Nikon Z8 / Z9 (Full Frame)',
    sensorWidth: 35.9,
    sensorHeight: 23.9
  },
  'fujifilm_gfx_100': {
    displayName: 'Fujifilm GFX 100 II (Medium Format)',
    sensorWidth: 43.8,
    sensorHeight: 32.9
  },
  'arri_alexa_mini_lf': {
    displayName: 'ARRI Alexa Mini LF (Open Gate)',
    sensorWidth: 36.7,
    sensorHeight: 25.54
  },
  'arri_alexa_35': {
    displayName: 'ARRI Alexa 35 (Super 35 4.6K)',
    sensorWidth: 27.99,
    sensorHeight: 19.22
  },
  'red_v_raptor_vv': {
    displayName: 'RED V-Raptor 8K VV (VistaVision)',
    sensorWidth: 40.96,
    sensorHeight: 21.60
  },
  'blackmagic_ursa_12k': {
    displayName: 'Blackmagic URSA Mini Pro 12K',
    sensorWidth: 27.03,
    sensorHeight: 14.25
  },
  'dji_mavic_3_pro': {
    displayName: 'DJI Mavic 3 Pro (Hasselblad 4/3)',
    sensorWidth: 17.3,
    sensorHeight: 13.0,
    focalLength: 12.29
  },
  'iphone_16_pro_main': {
    displayName: 'iPhone 15 / 16 Pro (Main 24mm eq.)',
    sensorWidth: 9.8,
    sensorHeight: 7.3,
    focalLength: 6.765
  },
  'iphone_16_pro_uw': {
    displayName: 'iPhone 15 / 16 Pro (Ultra Wide 13mm eq.)',
    sensorWidth: 5.6,
    sensorHeight: 4.2,
    focalLength: 2.22
  },
  'iphone_6s': {
    displayName: 'iPhone 6S',
    sensorWidth: 4.8,
    sensorHeight: 3.6,
    focalLength: 4.15
  }
}

