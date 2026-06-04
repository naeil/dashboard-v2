import { useEffect, useState } from 'react'
import { getExecutiveSummary } from '../api/executiveApi'

const normalizeRisk = (value) => {
  if (['위험', '주의', '정상', '확인중'].includes(value)) return value
  if (value === 'RISK' || value === 'DANGER') return '위험'
  if (value === 'WARNING') return '주의'
  if (value === 'NORMAL' || value === 'OK') return '정상'
  return '확인중'
}

const isProbablyBrokenText = (value) => {
  const text = String(value || '')
  return !text || text.includes('占') || /[^\x00-\x7F가-힣\s().,·/-]/.test(text)
}

function HeaderStatusCard({ label, value, tone = 'slate', icon }) {
  const tones = {
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
    sky: 'border-sky-200 bg-sky-50 text-sky-700',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    rose: 'border-rose-200 bg-rose-50 text-rose-700',
  }

  return (
    <div className={`min-w-[104px] rounded-lg border px-4 py-2 ${tones[tone] || tones.slate}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold opacity-80">{label}</p>
        {icon && <span className="material-symbols-outlined text-sm opacity-80">{icon}</span>}
      </div>
      <p className="mt-1 text-sm font-black">{value}</p>
    </div>
  )
}

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

  const risk = normalizeRisk(summary?.cashRiskStatus)
  const riskTone = risk === '위험' ? 'rose' : risk === '주의' ? 'amber' : risk === '확인중' ? 'slate' : 'emerald'
  const urgentIssueCount = Number(summary?.urgentIssueCount || 0)

  // 상담톡 API 연결 전에는 업무 홈의 상담 샘플과 같은 기준으로 미답변 1건을 보여준다.
  const customerInquiryCount = Number(summary?.customerInquiryCount ?? summary?.unansweredCustomerInquiryCount ?? 1)
  const customerInquiryTone = customerInquiryCount > 0 ? 'rose' : 'emerald'

  const companyName = summary?.companyName && !isProbablyBrokenText(summary.companyName)
    ? summary.companyName
    : '주식회사 내일그룹'

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 px-8 py-4 shadow-sm backdrop-blur">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-xs font-bold text-slate-500">{today}</p>
          <h2 className="mt-1 text-lg font-black text-slate-950">
            {companyName} · {username || '관리자'}님, 오늘의 업무와 경영 현황입니다.
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <HeaderStatusCard label="알림" value={`${urgentIssueCount}건`} tone={urgentIssueCount > 0 ? 'amber' : 'slate'} icon="notifications" />
          <HeaderStatusCard label="현금 위험 상태" value={risk} tone={riskTone} icon="account_balance_wallet" />
          <HeaderStatusCard label="긴급 이슈" value={urgentIssueCount ? '확인 필요' : '없음'} tone={urgentIssueCount > 0 ? 'rose' : 'emerald'} icon="priority_high" />
          <HeaderStatusCard label="고객 문의" value={customerInquiryCount > 0 ? `${customerInquiryCount}건 미답변` : '없음'} tone={customerInquiryTone} icon="forum" />
        </div>
      </div>
    </header>
  )
}
