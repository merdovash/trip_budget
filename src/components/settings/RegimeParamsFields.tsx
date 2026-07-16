import type { ThailandDeductionSettings } from '../../types/budget'
import type { RegimeParamField } from '../../config/regimeParams'
import { Field, Input } from '../ui/FormControls'

interface RegimeParamsFieldsProps {
  fields: RegimeParamField[]
  values: ThailandDeductionSettings | undefined
  onChange: (key: keyof ThailandDeductionSettings, value: number) => void
}

export function RegimeParamsFields({ fields, values, onChange }: RegimeParamsFieldsProps) {
  if (fields.length === 0) return null

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {fields.map((field) => (
        <Field
          key={field.id}
          label={
            field.currency
              ? `${field.label} (${field.currency})`
              : field.label
          }
        >
          <Input
            type="number"
            min={field.min}
            max={field.max}
            step={field.step ?? 1}
            value={values?.[field.id] ?? 0}
            onChange={(e) => onChange(field.id, Number(e.target.value) || 0)}
          />
          {field.hint && <p className="mt-1 text-[11px] text-slate-400">{field.hint}</p>}
        </Field>
      ))}
    </div>
  )
}
