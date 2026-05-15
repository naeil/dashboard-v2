import { useEffect, useState } from 'react'

export default function RecordForm({
  title = '데이터 입력',
  fields,
  initialValues = {},
  onSubmit,
  computeValues,
  submitLabel = '저장',
  modeLabel,
}) {
  const [values, setValues] = useState(computeValues ? computeValues(initialValues) : initialValues)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const initialValuesKey = JSON.stringify(initialValues)

  useEffect(() => {
    setValues(computeValues ? computeValues(initialValues) : initialValues)
    setMessage('')
  }, [initialValuesKey])

  const updateValue = (name, value, type) => {
    setValues((prev) => {
      const next = {
        ...prev,
        [name]: type === 'checkbox' ? Boolean(value) : value,
      }
      return computeValues ? computeValues(next) : next
    })
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setMessage('')

    try {
      const payload = computeValues ? computeValues(values) : values
      await onSubmit(payload)
      setValues(computeValues ? computeValues(initialValues) : initialValues)
      setMessage('저장되었습니다.')
    } catch (error) {
      setMessage(error?.response?.data?.message || error.message || '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="mb-6 rounded-lg border border-white/10 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/20">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-black text-white">{title}</h2>
          {modeLabel && (
            <span className="rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-[11px] font-black text-sky-100">
              {modeLabel}
            </span>
          )}
        </div>
        {message && <span className="text-xs font-bold text-sky-200">{message}</span>}
      </div>

      <form className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4" onSubmit={handleSubmit}>
        {fields.map((field) => (
          <label key={field.name} className={field.wide ? 'xl:col-span-2' : ''}>
            <span className="mb-1 block text-xs font-bold text-slate-400">{field.label}</span>
            {field.type === 'select' ? (
              <select
                value={values[field.name] ?? field.defaultValue ?? ''}
                onChange={(event) => updateValue(field.name, event.target.value, field.type)}
                className="h-10 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-sm font-bold text-white outline-none focus:border-sky-400 disabled:bg-slate-900 disabled:text-slate-500"
                required={field.required}
                disabled={field.readOnly}
              >
                <option value="">선택</option>
                {field.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : field.type === 'checkbox' ? (
              <div className="flex h-10 items-center rounded-lg border border-white/10 bg-slate-950 px-3">
                <input
                  type="checkbox"
                  checked={Boolean(values[field.name])}
                  onChange={(event) => updateValue(field.name, event.target.checked, field.type)}
                  className="h-4 w-4 accent-sky-400"
                  disabled={field.readOnly}
                />
                <span className="ml-2 text-sm font-bold text-slate-300">필요</span>
              </div>
            ) : (
              <input
                type={field.type || 'text'}
                value={values[field.name] ?? field.defaultValue ?? ''}
                onChange={(event) => updateValue(field.name, event.target.value, field.type)}
                placeholder={field.placeholder}
                className="h-10 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-sm font-bold text-white outline-none focus:border-sky-400 disabled:bg-slate-900 disabled:text-slate-500"
                required={field.required}
                disabled={field.readOnly}
              />
            )}
          </label>
        ))}

        <div className="flex items-end">
          <button
            type="submit"
            disabled={saving}
            className="h-10 w-full rounded-lg bg-sky-400 px-4 text-sm font-black text-slate-950 transition-colors hover:bg-sky-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          >
            {saving ? '저장 중...' : submitLabel}
          </button>
        </div>
      </form>
    </section>
  )
}
