/**
 * fSpy
 * Copyright (c) 2020 - Per Gantelius
 */

/**
 * The state of a single control point
 */
export interface ControlPointState {
  /** Relative image coordinates [0, 1] */
  x: number
  /** Relative image coordinates [0, 1] */
  y: number
}

export type ControlPointPairState = [ControlPointState, ControlPointState]

export enum ControlPointPairIndex {
  First = 0,
  Second = 1
}

export interface VanishingPointControlState {
  /**
   * Defaults to 2 line segments for classic fSpy compatibility.
   * When the opt-in Multi-Line Least-Squares Solver is enabled,
   * may contain 2 to 6 line segments per vanishing point.
   */
  lineSegments: ControlPointPairState[]
}

export interface ControlPointsStateBase {
  principalPoint: ControlPointState
  origin: ControlPointState
  referenceDistanceAnchor: ControlPointState
  firstVanishingPoint: VanishingPointControlState
  referenceDistanceHandleOffsets: [number, number]
}

export interface ControlPointsState1VP {
  horizon: ControlPointPairState
}

export interface ControlPointsState2VP {
  secondVanishingPoint: VanishingPointControlState
  thirdVanishingPoint: VanishingPointControlState
}
