import { useEffect, useMemo, useState } from 'react'
import {
  getExecutiveCashFlow,
  getExecutivePaymentRequests,
  getExecutiveProductForecasts,
  getExecutiveSummary,
  getExecutiveWorkTasks,
} from '../../api/executiveApi'
import { clockStaffAttendance, getStaffTodayAttendance } from '../../api/staffApi'
import { getWeekPlan } from '../../api/controlTowerApi'
import { PageHeader, Panel } from './ExecutiveComponents'
import { count, pct, won } from './formatters'
import { isTaskDelayed, taskProgress, taskStatusClass, taskStatusLabels } from './workTaskUtils'
import { paymentStatusClass, paymentStatusLabels } from './paymentUtils'
import IssueBriefingPanel from './IssueBriefingPanel'
import CustomerInquiryPanel from './CustomerInquiryPanel'
import MailWidget from './MailWidget'
import AiAssistantCard from '../../components/AiAssistantCard'

const dateTimeFormatter = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

const timeFormatter = new Intl.DateTimeFormat('ko-KR', {
  hour: '2-digit',
  minute: '2-digit',
})

function formatClockTime(value) {
  if (!value) return '-'
  return timeFormatter.format(new Date(value))
}



// ── 주간 업무 캘린더 + 담당자별 이번 주 할 일 ──────────────────────────
const WP_DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일']

function wpMonday(offsetWeeks = 0) {
  const d = new Date()
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day) + offsetWeeks * 7)
  return d.toISOString().slice(0, 10)
}

function wpAddDays(dateText, n) {
  const d = new Date(`${dateText}T00:00:00`)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

function wpPlanLines(text) {
  return String(text || '')
    .split('\n')
    .map((line) => line.replace(/^\s*(\d+[.)]|[-•·ㄴ└]|→)\s*/, '').trim())
    .filter((line) => line.length > 1)
    .slice(0, 6)
}

const wpTaskCls = (t) => {
  if (t.status === 'DONE') return 'bg-emerald-50 text-emerald-600 line-through'
  if (t.overdue || t.status === 'DELAYED' || t.status === 'BLOCKED') return 'bg-rose-100 text-rose-700'
  return 'bg-sky-50 text-sky-700'
}

function WeekPlanSection() {
  const [weekOffset, setWeekOffset] = useState(0)
  const [data, setData] = useState(null)

  useEffect(() => {
    const t = setTimeout(() => {
      getWeekPlan(wpMonday(weekOffset)).then(setData).catch(() => setData({ reports: [], tasks: [], carryOver: [], plans: [] }))
    }, 0)
    return () => clearTimeout(t)
  }, [weekOffset])

  const todayText = new Date().toISOString().slice(0, 10)
  const weekStart = data?.weekStart || wpMonday(weekOffset)
  const days = Array.from({ length: 7 }, (_, i) => wpAddDays(weekStart, i))
  const tasksByDate = {}
  ;(data?.tasks || []).forEach((t) => {
    const key = String(t.due_date).slice(0, 10)
    ;(tasksByDate[key] = tasksByDate[key] || []).push(t)
  })
  const reportsByDate = {}
  ;(data?.reports || []).forEach((r) => {
    const key = String(r.report_date).slice(0, 10)
    ;(reportsByDate[key] = reportsByDate[key] || []).push(r)
  })

  // 담당자별 이번 주 할 일: 이월(지연) + 이번 주 마감 + 최신 보고의 다음 액션
  const people = {}
  const ensure = (name) => {
    if (!name || name === '미지정') return null
    return (people[name] = people[name] || { name, carry: [], due: [], planLines: [], planDate: null, blockers: null })
  }
  ;(data?.carryOver || []).forEach((t) => { const p = ensure(t.assignee_name); if (p) p.carry.push(t) })
  ;(data?.tasks || []).forEach((t) => { if (t.status !== 'DONE') { const p = ensure(t.assignee_name); if (p) p.due.push(t) } })
  ;(data?.plans || []).forEach((pl) => {
    const p = ensure(pl.display_name)
    if (p) {
      p.planLines = wpPlanLines(pl.planned_work)
      p.planDate = String(pl.report_date).slice(5, 10)
      p.blockers = pl.blockers
    }
  })
  const peopleList = Object.values(people).sort((a, b) => (b.carry.length + b.due.length) - (a.carry.length + a.due.length))

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-base">📅</span>
          <h2 className="text-lg font-black text-slate-950">이번 주 업무 캘린더</h2>
          <span className="text-xs font-bold text-slate-400">일일보고 · 업무 마감 자동 반영</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => setWeekOffset((v) => v - 1)} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-black text-slate-500 hover:bg-slate-50">‹ 지난주</button>
          <button type="button" onClick={() => setWeekOffset(0)} className={`rounded-lg border px-2.5 py-1 text-xs font-black ${weekOffset === 0 ? 'border-sky-500 bg-sky-50 text-sky-600' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>이번 주</button>
          <button type="button" onClick={() => setWeekOffset((v) => v + 1)} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-black text-slate-500 hover:bg-slate-50">다음주 ›</button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="grid min-w-[860px] grid-cols-7 gap-1.5">
          {days.map((date, idx) => {
            const isToday = date === todayText
            const dayTasks = tasksByDate[date] || []
            const dayReports = reportsByDate[date] || []
            return (
              <div key={date} className={`rounded-lg border p-2 ${isToday ? 'border-sky-300 bg-sky-50/60' : 'border-slate-100 bg-slate-50/40'}`}>
                <p className={`text-[11px] font-black ${isToday ? 'text-sky-600' : idx >= 5 ? 'text-rose-400' : 'text-slate-500'}`}>
                  {WP_DAY_LABELS[idx]} <span className="font-bold">{date.slice(8)}</span>{isToday && ' · 오늘'}
                </p>
                <div className="mt-1.5 space-y-1">
                  {dayTasks.map((t) => (
                    <p key={t.id} className={`truncate rounded px-1.5 py-1 text-[11px] font-bold ${wpTaskCls(t)}`} title={`${t.task_name} · ${t.assignee_name || ''}`}>
                      {t.assignee_name && <span className="font-black">{t.assignee_name}</span>} {t.task_name}
                    </p>
                  ))}
                  {dayReports.map((r, i) => (
                    <p key={`r${i}`} className="truncate rounded bg-emerald-50 px-1.5 py-1 text-[11px] font-bold text-emerald-600" title={r.title}>
                      📝 {r.display_name} 보고
                    </p>
                  ))}
                  {dayTasks.length === 0 && dayReports.length === 0 && <p className="py-1 text-center text-[10px] text-slate-300">-</p>}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="mt-5 border-t border-slate-100 pt-4">
        <h3 className="text-sm font-black text-slate-950">담당자별 이번 주 할 일 <span className="text-[11px] font-bold text-slate-400">최신 일일보고 다음 액션 + 마감 업무 자동 구성</span></h3>
        {peopleList.length === 0 ? (
          <p className="mt-3 text-sm font-bold text-slate-400">이번 주 데이터가 없습니다. 일일보고가 올라오면 자동으로 채워집니다.</p>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {peopleList.map((p) => (
              <article key={p.name} className="rounded-lg border border-slate-100 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-black text-slate-900">{p.name}</p>
                  <span className="text-[11px] font-bold text-slate-400">
                    {p.carry.length > 0 && <span className="mr-1.5 font-black text-rose-600">지연 {p.carry.length}</span>}
                    마감 {p.due.length}건
                  </span>
                </div>
                {p.carry.slice(0, 3).map((t) => (
                  <p key={t.id} className="mt-1 truncate text-[12px] font-bold text-rose-600" title={t.task_name}>⚠ {t.task_name} <span className="text-[10px] text-rose-400">({String(t.due_date).slice(5)} 지남)</span></p>
                ))}
                {p.due.slice(0, 4).map((t) => (
                  <p key={t.id} className="mt-1 truncate text-[12px] font-bold text-slate-700" title={t.task_name}>☐ {t.task_name} <span className="text-[10px] text-slate-400">~{String(t.due_date).slice(5)}</span></p>
                ))}
                {p.planLines.length > 0 && (
                  <div className="mt-2 rounded-lg bg-slate-50 p-2">
                    <p className="text-[10px] font-black text-slate-400">일일보고 다음 액션 ({p.planDate})</p>
                    {p.planLines.map((line, i) => (
                      <p key={i} className="mt-0.5 truncate text-[12px] text-slate-600" title={line}>· {line}</p>
                    ))}
                  </div>
                )}
                {p.carry.length === 0 && p.due.length === 0 && p.planLines.length === 0 && (
                  <p className="mt-1 text-[12px] text-slate-400">등록된 할 일 없음</p>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
// ────────────────────────────────────────────────────────────

function StatCard({ label, value, helper, icon, tone = 'sky', onClick }) {
  const tones = {
    sky: 'border-sky-400/20 bg-sky-400/10 text-sky-100',
    emerald: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100',
    amber: 'border-amber-400/20 bg-amber-400/10 text-amber-100',
    rose: 'border-rose-400/20 bg-rose-400/10 text-rose-100',
    slate: 'border-white/10 bg-slate-900/70 text-slate-100',
  }
  const Tag = onClick ? 'button' : 'article'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`rounded-lg border p-5 text-left shadow-xl shadow-slate-950/20 transition-colors ${tones[tone]} ${onClick ? 'hover:border-sky-300/50 hover:bg-slate-800/80' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-black text-slate-400">{label}</p>
        <span className="material-symbols-outlined text-xl">{icon}</span>
      </div>
      <p className="mt-3 text-2xl font-black text-white">{value}</p>
      {helper && <p className="mt-2 text-xs font-bold text-slate-400">{helper}</p>}
    </Tag>
  )
}

function WorkflowStep({ index, title, body, icon, tone = 'sky' }) {
  const tones = {
    sky: 'border-sky-400/20 bg-sky-400/10 text-sky-100',
    emerald: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100',
    amber: 'border-amber-400/20 bg-amber-400/10 text-amber-100',
  }
  return (
    <article className={`rounded-lg border p-5 ${tones[tone]}`}>
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-950/60 text-sm font-black">{index}</span>
        <span className="material-symbols-outlined text-xl">{icon}</span>
      </div>
      <h3 className="mt-4 text-base font-black text-white">{title}</h3>
      <p className="mt-2 text-sm font-bold leading-6 text-slate-300">{body}</p>
    </article>
  )
}

function ProgressBar({ value, tone = 'sky' }) {
  const color = tone === 'rose' ? 'bg-rose-300' : tone === 'amber' ? 'bg-amber-300' : tone === 'emerald' ? 'bg-emerald-300' : 'bg-sky-300'
  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-800">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(2, Math.min(100, value))}%` }} />
    </div>
  )
}

function AccessRow({ role, can, blocked }) {
  return (
    <div className="grid gap-3 rounded-lg border border-white/10 bg-slate-950/45 p-4 lg:grid-cols-[160px_1fr_1fr]">
      <p className="text-sm font-black text-white">{role}</p>
      <p className="text-sm font-bold leading-6 text-emerald-100">{can}</p>
      <p className="text-sm font-bold leading-6 text-rose-100">{blocked}</p>
    </div>
  )
}

const kakaoConsultations = [
  {
    id: 1,
    customer: '하이프리 고객',
    type: '제품 문의',
    message: '섭취 방법과 구매 가능한 채널을 문의했습니다.',
    status: '미답변',
    owner: '마케팅팀',
    receivedAt: '방금 전',
    urgent: true,
  },
  {
    id: 2,
    customer: '공식몰 고객',
    type: '배송 문의',
    message: '주문 상품의 출고 일정 확인이 필요합니다.',
    status: '처리중',
    owner: '채널 운영',
    receivedAt: '12분 전',
    urgent: false,
  },
  {
    id: 3,
    customer: 'B2B 제휴 문의',
    type: '입점/제휴',
    message: '오프라인 판매 제안서와 공급가 자료를 요청했습니다.',
    status: '담당자 배정',
    owner: '영업팀',
    receivedAt: '34분 전',
    urgent: false,
  },
]

function ConsultationStatus({ status }) {
  const classes = {
    미답변: 'border-rose-200 bg-rose-50 text-rose-700',
    처리중: 'border-amber-200 bg-amber-50 text-amber-700',
    '담당자 배정': 'border-sky-200 bg-sky-50 text-sky-700',
    완료: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  }

  return (
    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${classes[status] || classes.처리중}`}>
      {status}
    </span>
  )
}

function KakaoConsultationPanel() {
  const unanswered = kakaoConsultations.filter((item) => item.status === '미답변').length
  const active = kakaoConsultations.filter((item) => item.status !== '완료').length
  const urgent = kakaoConsultations.filter((item) => item.urgent).length

  return (
    <section className="mb-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined rounded-lg border border-yellow-200 bg-yellow-50 p-2 text-yellow-700">forum</span>
            <h2 className="text-lg font-black text-slate-950">카카오 상담 현황</h2>
          </div>
          <p className="mt-2 text-sm font-medium text-slate-500">직원과 대표가 같이 보는 고객 문의 처리 현황입니다. 상담톡 API 연결 후 실시간 데이터로 전환됩니다.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black text-rose-700">미답변 {unanswered}건</span>
          <span className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-black text-sky-700">진행 {active}건</span>
          <span className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black text-amber-700">긴급 {urgent}건</span>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
          <p className="text-xs font-black text-slate-500">연동 상태</p>
          <p className="mt-3 text-2xl font-black text-slate-950">상담톡 API 준비</p>
          <p className="mt-3 text-sm font-bold leading-6 text-slate-600">
            카카오 공식 딜러사 또는 상담톡 API 권한을 받으면 고객명, 문의 내용, 담당자, 처리 상태를 이 영역에 실시간으로 표시합니다.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-black">
            <span className="rounded-md bg-white px-3 py-2 text-slate-600">고객 문의 수집</span>
            <span className="rounded-md bg-white px-3 py-2 text-slate-600">담당자 배정</span>
            <span className="rounded-md bg-white px-3 py-2 text-slate-600">미답변 알림</span>
            <span className="rounded-md bg-white px-3 py-2 text-slate-600">AI 유형 분류</span>
          </div>
        </div>

        <div className="space-y-3">
          {kakaoConsultations.map((item) => (
            <article key={item.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-black text-slate-950">{item.customer}</p>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-black text-slate-600">{item.type}</span>
                    {item.urgent && <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-black text-rose-700">긴급</span>}
                  </div>
                  <p className="mt-2 text-sm font-bold leading-6 text-slate-600">{item.message}</p>
                  <p className="mt-2 text-xs font-bold text-slate-400">{item.owner} · {item.receivedAt}</p>
                </div>
                <ConsultationStatus status={item.status} />
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

export default function PlatformOverviewPage({ onNavigate, username = 'admin', role = 'EXECUTIVE', mobile = false }) {
  const isExecutive = role === 'EXECUTIVE'
  const [summary, setSummary] = useState(null)
  const [cashFlow, setCashFlow] = useState(null)
  const [tasks, setTasks] = useState([])
  const [payments, setPayments] = useState([])
  const [forecasts, setForecasts] = useState([])
  const [loading, setLoading] = useState(true)
  const [attendance, setAttendance] = useState(null)
  const [attendanceSaving, setAttendanceSaving] = useState(false)
  const [clockNow, setClockNow] = useState(new Date())

  const load = () => {
    setLoading(true)
    return Promise.all([
      isExecutive ? getExecutiveSummary() : Promise.resolve({ data: {} }),
      isExecutive ? getExecutiveCashFlow() : Promise.resolve({ data: {} }),
      getExecutiveWorkTasks(),
      getExecutivePaymentRequests(),
      getExecutiveProductForecasts(),
    ])
      .then(([summaryRes, cashRes, taskRes, paymentRes, forecastRes]) => {
        setSummary(summaryRes.data || {})
        setCashFlow(cashRes.data || {})
        setTasks(taskRes.data || [])
        setPayments(paymentRes.data || [])
        setForecasts(forecastRes.data || [])
      })
      .finally(() => setLoading(false))
  }

  const loadAttendance = () => getStaffTodayAttendance()
    .then((res) => setAttendance(res.data || null))
    .catch(() => setAttendance(null))

  useEffect(() => {
    load()
    loadAttendance()
  }, [])

  useEffect(() => {
    const timer = setInterval(() => setClockNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  async function handleAttendance(action) {
    setAttendanceSaving(true)
    try {
      const res = await clockStaffAttendance(action)
      setAttendance(res.data || null)
    } finally {
      setAttendanceSaving(false)
    }
  }

  const activeTasks = tasks.filter((task) => task.status !== 'DONE')
  const delayedTasks = tasks.filter((task) => isTaskDelayed(task))
  const blockedTasks = tasks.filter((task) => task.status === 'BLOCKED')
  const reviewTasks = tasks.filter((task) => task.status === 'REVIEW' || task.approval_required)
  const avgProgress = activeTasks.length
    ? Math.round(activeTasks.reduce((sum, task) => sum + taskProgress(task), 0) / activeTasks.length)
    : 100
  const pendingPayments = payments.filter((payment) => ['SUBMITTED', 'REVIEWING'].includes(payment.status))
  const urgentPayments = pendingPayments.filter((payment) => payment.urgent)
  const pendingOutflow = pendingPayments
    .filter((payment) => payment.flow_type === 'OUTFLOW')
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
  const cashApplied = payments.filter((payment) => payment.status === 'CASH_APPLIED')

  const launchRisks = useMemo(() => (
    forecasts
      .map((product) => {
        const readiness = Number(product.launch_readiness_rate ?? product.launch_readiness ?? product.readiness_rate ?? 0)
        const riskScore = Number(product.risk_score ?? product.launch_risk_score ?? 100 - readiness)
        return {
          ...product,
          readiness,
          riskScore,
          productName: product.product_name || product.productName || '제품명 미정',
        }
      })
      .filter((product) => product.riskScore >= 40 || product.readiness < 70)
      .sort((a, b) => b.riskScore - a.riskScore || a.readiness - b.readiness)
      .slice(0, 5)
  ), [forecasts])

  const projectSummary = useMemo(() => {
    const grouped = new Map()
    tasks.forEach((task) => {
      const project = task.project_name || '미지정 프로젝트'
      const row = grouped.get(project) || { project, total: 0, delayed: 0, blocked: 0, review: 0, progressSum: 0 }
      row.total += 1
      row.progressSum += taskProgress(task)
      if (isTaskDelayed(task)) row.delayed += 1
      if (task.status === 'BLOCKED') row.blocked += 1
      if (task.status === 'REVIEW' || task.approval_required) row.review += 1
      grouped.set(project, row)
    })
    return Array.from(grouped.values())
      .map((row) => ({ ...row, progress: row.total ? Math.round(row.progressSum / row.total) : 0 }))
      .sort((a, b) => b.delayed - a.delayed || b.blocked - a.blocked || a.progress - b.progress)
      .slice(0, 6)
  }, [tasks])

  const currentCash = Number(summary?.cash_balance ?? cashFlow?.openingCash ?? 0)
  const monthOutflow = Number(summary?.today_outflow ?? 0)
  const todayLabel = new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }).format(new Date())
  const quickLinks = [
    ['channel-sales', '실시간 매출', '매출, 원가, 영업이익 확인', 'leaderboard'],
    ['product-cost', '제품 원가 관리', '채널별 원가표 수정', 'price_change'],
    ['work-management', '업무 진행 관리', '지연, 막힘, 검토 업무 확인', 'task_alt'],
    ['payment-approval', '결재 관리', '지출결의서 승인', 'approval'],
    ['cash-flow', '현금 흐름', '입출금과 위험 상태 확인', 'account_balance_wallet'],
    ['customer-db', '고객 정보', '고객 DB와 문의 확인', 'contacts'],
    ['issue-briefing', '이슈 브리핑', '오늘의 경영 이슈 확인', 'campaign'],
    ['resource-library', '자료실', '공유 문서와 파일 확인', 'folder_open'],
  ].filter(([page]) => role === 'EXECUTIVE' || !['cash-flow', 'payment-approval'].includes(page))
  const mobileQuickLinks = [
    ['staff-dashboard', '직원 대시보드', '매출, 업무, 출퇴근 확인', 'dashboard'],
    ['staff-work-report', '업무 보고', '일일·주간 업무 작성', 'assignment_add'],
    ['staff-project-status', '프로젝트 현황', '일정과 마감 관리', 'view_timeline'],
    ['account', '계정 관리', '로그인 보안 확인', 'account_circle'],
  ]
  const calendarItems = [
    ['10:00', '미팅 및 매출 현황 확인', '대표 / 관리'],
    ['10:30', '오프라인 공급가표 전달', '영업'],
    ['11:15', '단백깡 푸시메시지 작성', '마케팅'],
    ['12:15', '카카오톡스토어 추가 개설 점검', '채널'],
  ]
  const emailItems = [
    ['당근 비즈니스', '최신 전환 추적 기능 이용을 위한 확인 요청', '2026-06-01'],
    ['Claude Team', 'API 비용 최적화 안내', '2026-06-01'],
    ['채널 운영', '쿠팡 판매 실적 검토 요청', '2026-05-31'],
    ['고객 문의', '배송 일정 확인 요청', '2026-05-31'],
  ]

  return (
    <main className="space-y-6 bg-white text-slate-950">
      <AiAssistantCard role={role} />
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-xs font-black text-slate-500">{todayLabel}</p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950">대표 업무 홈</h1>
            <p className="mt-2 text-sm font-bold text-slate-500">주요 업무로 바로 이동하고, 일정과 메일을 한 화면에서 확인합니다.</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="flex w-full flex-wrap items-center gap-2 rounded border border-slate-200 bg-slate-50 px-3 py-2 sm:min-w-[320px] xl:w-auto">
              <span className="material-symbols-outlined text-base text-sky-600">schedule</span>
              <div className="mr-1">
                <p className="text-[11px] font-black text-slate-500">실시간 출퇴근</p>
                <p className="text-sm font-black text-slate-950">{dateTimeFormatter.format(clockNow)}</p>
                <p className="mt-0.5 text-[11px] font-bold text-slate-500">
                  출근 {formatClockTime(attendance?.clock_in_at)} · 퇴근 {formatClockTime(attendance?.clock_out_at)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleAttendance('IN')}
                disabled={attendanceSaving || Boolean(attendance?.clock_in_at)}
                className="inline-flex h-9 items-center gap-1 rounded bg-sky-600 px-3 text-xs font-black text-white transition-colors hover:bg-sky-700 disabled:bg-slate-300 disabled:text-slate-500"
              >
                <span className="material-symbols-outlined text-sm">login</span>
                출근
              </button>
              <button
                type="button"
                onClick={() => handleAttendance('OUT')}
                disabled={attendanceSaving || !attendance?.clock_in_at || Boolean(attendance?.clock_out_at)}
                className="inline-flex h-9 items-center gap-1 rounded bg-slate-800 px-3 text-xs font-black text-white transition-colors hover:bg-slate-950 disabled:bg-slate-300 disabled:text-slate-500"
              >
                <span className="material-symbols-outlined text-sm">logout</span>
                퇴근
              </button>
            </div>
            <button type="button" onClick={() => { load(); loadAttendance() }} disabled={loading} className="inline-flex h-10 items-center gap-2 rounded border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-50 disabled:opacity-60">
              <span className="material-symbols-outlined text-base">sync</span>
              {loading ? '갱신 중' : '새로고침'}
            </button>
            <a href="https://calendar.google.com/calendar/u/0/r" target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded border border-blue-200 bg-blue-50 px-4 text-sm font-black text-blue-700">
              <span className="material-symbols-outlined text-base">calendar_month</span>
              구글 캘린더
            </a>
            <a href="https://mail.google.com/mail/u/0/#inbox" target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded border border-emerald-200 bg-emerald-50 px-4 text-sm font-black text-emerald-700">
              <span className="material-symbols-outlined text-base">mail</span>
              Gmail
            </a>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
          {(mobile ? mobileQuickLinks : quickLinks).map(([page, title, body, icon]) => (
            <button key={page} type="button" onClick={() => onNavigate?.(page)} className="group min-h-[110px] rounded border border-slate-200 bg-slate-50 p-4 text-left hover:border-blue-300 hover:bg-blue-50">
              <span className="material-symbols-outlined text-xl text-slate-500 group-hover:text-blue-700">{icon}</span>
              <span className="mt-3 block text-sm font-black text-slate-950">{title}</span>
              <span className="mt-1 block text-xs font-bold leading-5 text-slate-500">{body}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        {[
          ['업무 진행률', `${avgProgress}%`, `진행중 ${count(activeTasks.length, '건')}`, 'assignment', 'work-management'],
          ['지연/막힘', count(delayedTasks.length + blockedTasks.length, '건'), '대표 우선 확인', 'warning', 'work-management'],
          ['결재 대기', count(pendingPayments.length, '건'), `대기 출금 ${won(pendingOutflow)}`, 'approval', 'payment-approval'],
          ['현재 현금', won(currentCash), `오늘 출금 ${won(monthOutflow)}`, 'account_balance_wallet', 'cash-flow'],
          ['런칭 리스크', count(launchRisks.length, '개'), '위험 제품 확인', 'rocket_launch', 'product-forecast'],
        ].map(([label, value, helper, icon, page]) => (
          <button key={label} type="button" onClick={() => onNavigate?.(page)} className="rounded border border-slate-200 bg-white p-5 text-left shadow-sm hover:border-blue-300">
            <div className="flex items-start justify-between gap-3">
              <p className="text-xs font-black text-slate-500">{label}</p>
              <span className="material-symbols-outlined text-lg text-slate-400">{icon}</span>
            </div>
            <p className="mt-3 text-2xl font-black text-slate-950">{value}</p>
            <p className="mt-2 text-xs font-bold text-slate-500">{helper}</p>
          </button>
        ))}
      </section>
      <WeekPlanSection />


      <MailWidget />

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1fr]">
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-slate-950">Gmail</h2>
              <p className="mt-1 text-xs font-bold text-slate-500">Google Workspace 연동 후 실제 메일로 전환</p>
            </div>
            <a href="https://mail.google.com/mail/u/0/#inbox" target="_blank" rel="noreferrer" className="rounded border border-slate-300 px-3 py-2 text-xs font-black text-slate-700">열기</a>
          </div>
          <div className="mt-5 divide-y divide-slate-100">
            {emailItems.map(([sender, subject, date]) => (
              <button key={`${sender}-${subject}`} type="button" className="flex w-full items-start gap-3 py-3 text-left">
                <span className="mt-1 h-2 w-2 rounded-full bg-rose-500" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-black text-slate-800">{sender}</span>
                  <span className="mt-1 block truncate text-sm font-bold text-slate-500">{subject}</span>
                </span>
                <span className="text-xs font-bold text-slate-400">{date}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-slate-950">구글 캘린더</h2>
              <p className="mt-1 text-xs font-bold text-slate-500">Calendar API 연동 후 실제 일정으로 전환</p>
            </div>
            <a href="https://calendar.google.com/calendar/u/0/r" target="_blank" rel="noreferrer" className="rounded border border-slate-300 px-3 py-2 text-xs font-black text-slate-700">열기</a>
          </div>
          <div className="mt-5 grid gap-5 md:grid-cols-[220px_1fr]">
            <div className="rounded border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-black text-slate-950">2026년 6월</p>
                <span className="material-symbols-outlined text-base text-slate-400">expand_more</span>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-xs font-black text-slate-400">
                {['일', '월', '화', '수', '목', '금', '토'].map((day) => <span key={day}>{day}</span>)}
                {Array.from({ length: 35 }, (_, idx) => {
                  const day = idx - 0
                  const label = day > 0 && day <= 30 ? day : ''
                  const active = label === 2
                  return <span key={idx} className={`rounded py-1.5 ${active ? 'bg-blue-600 text-white' : label ? 'text-slate-700' : 'text-slate-300'}`}>{label}</span>
                })}
              </div>
            </div>
            <div className="space-y-3">
              {calendarItems.map(([time, title, team]) => (
                <article key={`${time}-${title}`} className="border-l-4 border-blue-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-black text-slate-500">{time}</p>
                  <p className="mt-1 text-sm font-black text-slate-950">{title}</p>
                  <p className="mt-1 text-xs font-bold text-slate-500">{team}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1fr]">
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-950">대표 우선 확인</h2>
            <button type="button" onClick={() => onNavigate?.('work-management')} className="text-xs font-black text-blue-700">전체 보기</button>
          </div>
          <div className="space-y-3">
            {[...delayedTasks, ...blockedTasks, ...reviewTasks]
              .filter((task, index, array) => array.findIndex((candidate) => candidate.id === task.id) === index)
              .slice(0, 5)
              .map((task) => (
                <article key={task.id} className="rounded border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-950">{task.task_name}</p>
                      <p className="mt-1 text-xs font-bold text-slate-500">{task.project_name} · {task.assignee_name} · {task.due_date || '마감일 미정'}</p>
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${taskStatusClass(task.status)}`}>{taskStatusLabels[task.status] || task.status}</span>
                  </div>
                </article>
              ))}
            {delayedTasks.length + blockedTasks.length + reviewTasks.length === 0 && (
              <p className="rounded border border-dashed border-slate-200 bg-slate-50 p-5 text-sm font-bold text-slate-500">즉시 확인할 병목 업무가 없습니다.</p>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-950">결재 대기</h2>
            <button type="button" onClick={() => onNavigate?.('payment-approval')} className="text-xs font-black text-blue-700">전체 보기</button>
          </div>
          <div className="space-y-3">
            {pendingPayments.slice(0, 5).map((payment) => (
              <article key={payment.id} className="rounded border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-slate-950">{payment.purpose}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">{payment.requester_name} · {payment.counterparty} · {payment.scheduled_date}</p>
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${paymentStatusClass(payment.status)}`}>{paymentStatusLabels[payment.status] || payment.status}</span>
                </div>
                <p className="mt-3 text-lg font-black text-slate-950">{won(payment.amount)}</p>
              </article>
            ))}
            {pendingPayments.length === 0 && (
              <p className="rounded border border-dashed border-slate-200 bg-slate-50 p-5 text-sm font-bold text-slate-500">결재 대기 중인 요청이 없습니다.</p>
            )}
          </div>
        </section>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-950">Google 연동 준비</h2>
            <p className="mt-1 text-sm font-bold text-slate-500">OAuth 권한 연결 후 Gmail, Calendar 데이터를 이 홈 화면에 실시간으로 표시합니다.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" className="rounded border border-slate-300 px-4 py-2 text-sm font-black text-slate-700">Google API 설정</a>
            <button type="button" onClick={() => onNavigate?.('settings')} className="rounded border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-black text-blue-700">연동 설정 이동</button>
          </div>
        </div>
      </section>
    </main>
  )
}
