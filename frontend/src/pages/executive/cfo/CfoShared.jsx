export function InfoTip({ text }) {
  if (!text) return null
  return (
    <span className="material-symbols-outlined cursor-help align-middle text-sm text-slate-400" title={text}>
      info
    </span>
  )
}

export function StatCard({ label, value, sub, tone = 'sky', tooltip }) {
  const toneText = { sky: 'text-sky-700', emerald: 'text-emerald-700', amber: 'text-amber-700', rose: 'text-rose-700' }
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm" title={tooltip || undefined}>
      <p className="text-xs font-bold text-slate-500">
        {label} {tooltip && <InfoTip text={tooltip} />}
      </p>
      <p className={`mt-2 text-xl font-black tracking-tight ${toneText[tone] || 'text-slate-950'}`}>{value}</p>
      {sub && <p className="mt-1 text-xs font-bold text-slate-400">{sub}</p>}
    </article>
  )
}

export function LoadingBox() {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 py-12 text-center text-sm font-bold text-slate-400">
      불러오는 중...
    </div>
  )
}

export function ErrorBox({ message }) {
  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 py-6 px-4 text-center text-sm font-bold text-rose-700">
      {message || '데이터를 불러오지 못했습니다.'}
    </div>
  )
}
