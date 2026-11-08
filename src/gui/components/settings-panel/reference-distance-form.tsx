/**
 * fSpy
 * Copyright (c) 2020 - Per Gantelius
 */

import ReferenceDistanceAxisDropdown from './reference-distance-axis-dropdown'
import ReferenceDistanceUnitDropdown from './reference-distance-unit-dropdown'
import NumericInputField from './../common/numeric-input-field'
import { Axis, ReferenceDistanceUnit } from '../../types/calibration-settings'

interface ReferenceDistanceFormProps {
  referenceAxis: Axis | null
  referenceDistance: number
  referenceDistanceUnit: ReferenceDistanceUnit
  onReferenceAxisChange(axis: Axis | null): void
  onReferenceDistanceChange(distance: number): void
  onReferenceDistanceUnitChange(unit: ReferenceDistanceUnit): void
}

export default function ReferenceDistanceForm(props: ReferenceDistanceFormProps) {
  return (
    <div className='space-y-2'>
      <ReferenceDistanceAxisDropdown
        selectedAxis={props.referenceAxis}
        onChange={(axis: Axis | null) => {
          props.onReferenceAxisChange(axis)
        }}
      />
      {props.referenceAxis !== null && (
        <div className='grid grid-cols-2 gap-1.5'>
          <NumericInputField
            isDisabled={false}
            valueNotAvailable={false}
            value={props.referenceDistance}
            onSubmit={props.onReferenceDistanceChange}
          />
          <ReferenceDistanceUnitDropdown
            disabled={false}
            selectedUnit={props.referenceDistanceUnit}
            onChange={(unit: ReferenceDistanceUnit) => {
              props.onReferenceDistanceUnitChange(unit)
            }}
          />
        </div>
      )}
    </div>
  )
}
