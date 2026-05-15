import { useEffect, useState } from 'react'
import { getExecutiveSummary } from '../api/executiveApi'

export default function ExecutiveHeader({ username }) {
  const [summary, setSummary] = useState(null)
  const today = new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(new Date())

  useEffect(() => {
    getExecutiveSummary().then((res) => setSummary(res.data)).catch(() => setSummary(null))
  }, [])

  const risk = summary?.cashRiskStatus || '확인중'
  const riskClass = risk === '위험'
    ? 'border-rose-400/30 bg-rose-500/15 text-rose-100'
    : risk === '주의'
      ? 'border-amber-400/30 bg-amber-500/15 text-amber-100'
      : 'border-emerald-400/30 bg-emerald-500/15 text-emerald-100'

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/85 px-8 py-4 backdrop-blur">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-xs font-bold text-slate-500">{today}</p>
          <h2 className="mt-1 text-lg font-black text-white">
            {summary?.companyName || '주식회사 내일그룹'} · {username || '대표'}님, 오늘의 경영 현황입니다.
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2">
            <p className="text-[11px] font-bold text-slate-500">알림</p>
            <p className="text-sm font-black text-white">{summary?.urgentIssueCount ?? 0}건</p>
          </div>
          <div className={`rounded-lg border px-4 py-2 ${riskClass}`}>
            <p className="text-[11px] font-bold opacity-80">현금 위험 상태</p>
            <p className="text-sm font-black">{risk}</p>
          </div>
          <div className="rounded-lg border border-rose-400/30 bg-rose-500/15 px-4 py-2 text-rose-100">
            <p className="text-[11px] font-bold opacity-80">긴급 이슈</p>
            <p className="text-sm font-black">{summary?.urgentIssueCount ? '확인 필요' : '없음'}</p>
          </div>
        </div>
      </div>
    </header>
  )
}
