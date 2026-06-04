import { useCallback, useEffect, useState } from 'react'
import { getCeoDashboard, saveCeoFinancials } from '../../api/executiveApi'
import ExecutiveSummary from './ExecutiveSummary'

// ── 포맷 유틸 ──────────────────────────────────────────────────────────────
const won = (v) => {
  const n = Number(v || 0)
  if (Math.abs(n) >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`
  if (Math.abs(n) >= 10_000) return `${Math.round(n / 10_000).toLocaleString()}만`
  return n.toLocaleString() + '원'
}
const wonInput = (v) => Math.round(Number(v || 0) / 10_000)
const fromMan  = (v) => Math.round(Number(v || 0)) * 10_000
const pct = (a, b) => b > 0 ? Math.round((a / b) * 100) : 0
const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토']

// ── 생존 카드 ─────────────────────────────────────────────────────────────
function SurvivalCard({ cashDays, cash, dailyBurn }) {
  const level = cashDays >= 90 ? 'safe' : cashDays >= 45 ? 'watch' : 'danger'
  const cfg = {
    safe:   { border: 'border-emerald-200', bg: 'bg-emerald-50', num: 'text-emerald-600', tag: 'bg-emerald-100 text-emerald-700', tagText: '안정' },
    watch:  { border: 'border-amber-200',   bg: 'bg-amber-50',   num: 'text-amber-600',   tag: 'bg-amber-100 text-amber-700',   tagText: '주의' },
    danger: { border: 'border-rose-200',    bg: 'bg-rose-50',    num: 'text-rose-600',    tag: 'bg-rose-100 text-rose-700',    tagText: '위험' },
  }[level]
  return (
    <div className={`rounded-2xl border-2 p-5 ${cfg.border} ${cfg.bg}`}>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-black uppercase tracking-widest text-slate-500">현금 생존</p>
        <span className={`rounded-full px-2 py-0.5 text-xs font-black ${cfg.tag}`}>{cfg.tagText}</span>
      </div>
      <div className="flex items-end gap-1">
        <span className={`text-6xl font-black leading-none ${cfg.num}`}>{cashDays >= 999 ? '∞' : cashDays}</span>
        <span className={`mb-1.5 text-xl font-black ${cfg.num}`}>일</span>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        {won(cash)} 보유 &nbsp;·&nbsp; 일 {won(dailyBurn)} 소진
      </p>
    </div>
  )
}

// ── 페이스 카드 ───────────────────────────────────────────────────────────
function PaceCard({ daysPassed, daysInMonth, totalSales, totalGoal }) {
  const elapsed  = pct(daysPassed, daysInMonth)
  const achieved = pct(totalSales, totalGoal)
  const delta    = achieved - elapsed
  const ahead    = delta >= 0
  return (
    <div className="rounded-2xl border-2 border-sky-200 bg-sky-50 p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-black uppercase tracking-widest text-slate-500">이번달 매출 페이스</p>
        <span className={`rounded-full px-2 py-0.5 text-xs font-black ${ahead ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
          {ahead ? `▲ +${delta}%p 앞섬` : `▼ ${Math.abs(delta)}%p 뒤처짐`}
        </span>
      </div>
      <div className="flex items-end gap-2">
        <span className="text-6xl font-black leading-none text-sky-700">{achieved}%</span>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        {won(totalSales)} 달성 &nbsp;/&nbsp; 목표 {won(totalGoal)} &nbsp;·&nbsp; {daysPassed}일/{daysInMonth}일 경과 ({elapsed}%)
      </p>
    </div>
  )
}

// ── 현금 흐름 카드 ────────────────────────────────────────────────────────
function WeekCashCard({ weekNetCash, weekInflows, weekOutflows }) {
  const totalIn  = weekInflows.reduce((s, r) => s + Number(r.amount || 0), 0)
  const totalOut = weekOutflows.reduce((s, r) => s + Number(r.amount || 0), 0)
  const pos = weekNetCash >= 0
  return (
    <div className={`rounded-2xl border-2 p-5 ${pos ? 'border-slate-200 bg-white' : 'border-rose-200 bg-rose-50'}`}>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-black uppercase tracking-widest text-slate-500">7일 현금 흐름</p>
        <span className={`rounded-full px-2 py-0.5 text-xs font-black ${pos ? 'bg-sky-100 text-sky-700' : 'bg-rose-100 text-rose-700'}`}>
          {pos ? '입금 우세' : '출금 우세'}
        </span>
      </div>
      <div className="flex items-end gap-1">
        <span className={`text-6xl font-black leading-none ${pos ? 'text-sky-700' : 'text-rose-600'}`}>
          {pos ? '+' : ''}{won(weekNetCash)}
        </span>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        +{won(totalIn)} 입금 예정 &nbsp;·&nbsp; -{won(totalOut)} 출금 예정
      </p>
    </div>
  )
}

// ── 액션 아이템 ───────────────────────────────────────────────────────────
function ActionItem({ level, icon, title, sub, detail }) {
  const cfg = {
    RED:    'border-rose-200 bg-rose-50',
    YELLOW: 'border-amber-200 bg-amber-50',
    BLUE:   'border-sky-200 bg-sky-50',
  }
  const dot = { RED: 'bg-rose-500', YELLOW: 'bg-amber-500', BLUE: 'bg-sky-500' }
  return (
    <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${cfg[level] || cfg.YELLOW}`}>
      <div className={`mt-2 h-2 w-2 shrink-0 rounded-full ${dot[level] || dot.YELLOW}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-base text-slate-500">{icon}</span>
          <span className="text-sm font-black text-slate-900">{title}</span>
        </div>
        {sub    && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
        {detail && <p className="mt-0.5 text-xs font-bold text-slate-700">{detail}</p>}
      </div>
    </div>
  )
}

// ── 매출 행 ───────────────────────────────────────────────────────────────
function SalesRow({ label, current, goal, pace, prev }) {
  const rate     = pct(current, goal)
  const paceRate = pct(pace, goal)
  const prevDiff = prev > 0 ? Math.round(((current - prev) / prev) * 100) : null
  const ahead    = rate >= paceRate
  const barColor = rate >= 100 ? 'bg-emerald-500' : ahead ? 'bg-sky-500' : rate >= 50 ? 'bg-amber-500' : 'bg-rose-400'
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-black text-slate-900">{label}</span>
        <div className="flex items-center gap-3">
          {prevDiff !== null && (
            <span className={`font-bold ${prevDiff >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
              전월比 {prevDiff >= 0 ? '▲' : '▼'}{Math.abs(prevDiff)}%
            </span>
          )}
          <span className={`font-black ${ahead ? 'text-emerald-600' : 'text-amber-600'}`}>
            {rate}% &nbsp;{ahead ? '✓ ON PACE' : '↓ BEHIND'}
          </span>
          <span className="text-slate-500">{won(current)} / {won(goal)}</span>
        </div>
      </div>
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-slate-200">
        {/* 페이스 기준선 */}
        <div
          className="absolute top-0 h-full w-0.5 bg-slate-400"
          style={{ left: `${Math.min(100, paceRate)}%` }}
        />
        {/* 실제 달성 */}
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${Math.min(100, rate)}%` }}
        />
      </div>
      <p className="text-right text-[11px] text-slate-400">
        페이스 기준 {won(pace)} 필요 · 현재 {won(current - pace) >= 0 ? '+' : ''}{won(current - pace)}
      </p>
    </div>
  )
}

// ── 메인 ─────────────────────────────────────────────────────────────────
export default function CEOStrategicDashboard({ onNavigate }) {
  const [tab, setTab]         = useState('today')
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [form, setForm]       = useState({
    goal_online:     50_000_000,
    goal_export:     20_000_000,
    goal_consulting: 30_000_000,
  })

  const load = useCallback(() => {
    setLoading(true)
    getCeoDashboard()
      .then((res) => {
        const d = res.data || {}
        setData(d)
        if (d.goalOnline)     setForm((p) => ({ ...p, goal_online: d.goalOnline }))
        if (d.goalExport)     setForm((p) => ({ ...p, goal_export: d.goalExport }))
        if (d.goalConsulting) setForm((p) => ({ ...p, goal_consulting: d.goalConsulting }))
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const handleSave = async () => {
    setSaving(true)
    try {
      await saveCeoFinancials(form)
      await load()
      setSaveMsg('저장됨')
      setEditMode(false)
    } catch { setSaveMsg('저장 실패') }
    finally { setSaving(false) }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-slate-400">로딩 중...</p>
      </div>
    )
  }

  const d = data || {}
  const totalGoal  = (d.goalOnline || 0) + (d.goalExport || 0) + (d.goalConsulting || 0)
  const totalSales = (d.onlineSales || 0) + (d.exportSales || 0) + (d.consultingSales || 0)
  const todayDate  = d.today ? new Date(d.today + 'T00:00:00') : new Date()
  const todayLabel = `${todayDate.getMonth() + 1}월 ${todayDate.getDate()}일(${DAY_NAMES[todayDate.getDay()]})`

  // 긴급 액션 빌드
  const actions = []
  ;(d.overdueReceivables || []).forEach((r) => {
    const days = Number(r.overdue_days || 0)
    actions.push({
      level: r.risk_level === 'CRITICAL' || days > 30 ? 'RED' : 'YELLOW',
      icon: 'call',
      title: `${r.partner_name} 미수금 ${won(r.outstanding)}`,
      sub: `연체 ${days}일 · 위험등급 ${r.risk_level}`,
      detail: '→ 즉시 전화 필요',
    })
  })
  ;(d.lowStockProducts || []).forEach((p) => {
    actions.push({
      level: p.status === 'OUT_OF_STOCK' ? 'RED' : 'YELLOW',
      icon: 'inventory_2',
      title: `${p.product_name} 재고 부족`,
      sub: `현재 ${p.stock_quantity}개 / 안전재고 ${p.safe_stock}개`,
      detail: '→ 발주 일정 확인',
    })
  })
  ;(d.bigPayments || []).forEach((p) => {
    const dt = new Date(p.flow_date + 'T00:00:00')
    actions.push({
      level: 'YELLOW',
      icon: 'payments',
      title: `${p.counterparty || p.category} ${won(p.amount)} 출금 예정`,
      sub: `${dt.getMonth() + 1}/${dt.getDate()}(${DAY_NAMES[dt.getDay()]}) · ${p.category}`,
      detail: p.memo || '',
    })
  })

  return (
    <div className="space-y-6 pb-12">

      {/* 헤더 + 탭 */}
      <div>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-900">CEO 대시보드</h1>
            <p className="mt-1 text-sm text-slate-500">{todayLabel} 기준</p>
          </div>
          {tab === 'today' && (
            <button
              onClick={() => { setEditMode((v) => !v); setSaveMsg('') }}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm hover:bg-slate-50"
            >
              {editMode ? '✕ 닫기' : '🎯 목표 설정'}
            </button>
          )}
        </div>
        {/* 탭 */}
        <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 w-fit">
          {[
            { key: 'today',   label: '⚡ 오늘 판단' },
            { key: 'monthly', label: '📊 월간 현황' },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-lg px-5 py-2 text-sm font-black transition-all ${
                tab === t.key
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* 월간 현황 탭 — ExecutiveSummary 임베드 */}
      {tab === 'monthly' && <ExecutiveSummary onNavigate={onNavigate} />}

      {tab === 'today' && <>

      {/* ─── 생존 지표 3카드 ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SurvivalCard
          cashDays={d.cashDays || 0}
          cash={d.cash || 0}
          dailyBurn={d.dailyBurn || 0}
        />
        <PaceCard
          daysPassed={d.daysPassed || 1}
          daysInMonth={d.daysInMonth || 30}
          totalSales={totalSales}
          totalGoal={totalGoal}
        />
        <WeekCashCard
          weekNetCash={d.weekNetCash || 0}
          weekInflows={d.weekInflows || []}
          weekOutflows={d.weekOutflows || []}
        />
      </div>

      {/* ─── 긴급 액션 ───────────────────────────────────────────────────── */}
      {actions.length > 0 && (
        <div>
          <h2 className="mb-3 text-xs font-black uppercase tracking-widest text-slate-500">
            ⚡ 오늘 처리할 것 ({actions.length}건)
          </h2>
          <div className="space-y-2">
            {actions.map((a, i) => <ActionItem key={i} {...a} />)}
          </div>
        </div>
      )}

      {/* ─── 매출 페이스 상세 ─────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-5 text-xs font-black uppercase tracking-widest text-slate-500">
          이번달 매출 — {d.daysPassed}일/{d.daysInMonth}일 경과 ({d.paceRatio}% 진행)
        </h2>
        <div className="space-y-6">
          <SalesRow label="🥊 단백깡 (온라인)"
            current={d.onlineSales || 0} goal={d.goalOnline || 50_000_000}
            pace={d.onlinePaceTarget || 0} prev={d.prevOnlineSales || 0} />
          <SalesRow label="🌏 수출"
            current={d.exportSales || 0} goal={d.goalExport || 20_000_000}
            pace={d.exportPaceTarget || 0} prev={d.prevExportSales || 0} />
          <SalesRow label="🤝 컨설팅"
            current={d.consultingSales || 0} goal={d.goalConsulting || 30_000_000}
            pace={d.consultingPaceTarget || 0} prev={d.prevConsultingSales || 0} />
        </div>
      </div>

      {/* ─── 7일 현금 이벤트 ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <h2 className="mb-3 text-xs font-black uppercase tracking-widest text-emerald-700">7일 내 입금 예정</h2>
          {(d.weekInflows || []).length === 0
            ? <p className="text-sm text-slate-400">예정된 입금 없음</p>
            : (d.weekInflows || []).map((r, i) => {
              const dt = new Date(r.flow_date + 'T00:00:00')
              return (
                <div key={i} className="flex items-center justify-between border-b border-emerald-100 py-2 text-sm last:border-0">
                  <span className="text-slate-600">{dt.getMonth()+1}/{dt.getDate()} {r.counterparty || r.category}</span>
                  <span className="font-black text-emerald-700">+{won(r.amount)}</span>
                </div>
              )
            })
          }
        </div>
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
          <h2 className="mb-3 text-xs font-black uppercase tracking-widest text-rose-700">7일 내 출금 예정</h2>
          {(d.weekOutflows || []).length === 0
            ? <p className="text-sm text-slate-400">예정된 출금 없음</p>
            : (d.weekOutflows || []).map((r, i) => {
              const dt = new Date(r.flow_date + 'T00:00:00')
              return (
                <div key={i} className="flex items-center justify-between border-b border-rose-100 py-2 text-sm last:border-0">
                  <span className="text-slate-600">{dt.getMonth()+1}/{dt.getDate()} {r.counterparty || r.category}</span>
                  <span className="font-black text-rose-700">-{won(r.amount)}</span>
                </div>
              )
            })
          }
        </div>
      </div>

      {/* ─── 수출 파이프라인 ──────────────────────────────────────────────── */}
      {(d.exportActions || []).length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xs font-black uppercase tracking-widest text-slate-500">수출 파이프라인 — 다음 할 일</h2>
          <div className="space-y-3">
            {(d.exportActions || []).map((e, i) => (
              <div key={i} className="flex items-start justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                <div>
                  <p className="text-sm font-black text-slate-900">{e.country} · {e.buyer_name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{e.stage}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-black text-sky-600">→ {e.next_action}</p>
                  {e.expected_payment_date && (
                    <p className="mt-0.5 text-xs text-slate-400">목표 {e.expected_payment_date} · {won(e.expected_sales)}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── 운영비용 상세 ────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xs font-black uppercase tracking-widest text-slate-500">이번달 운영비용</h2>
          <span className="text-base font-black text-slate-900">{won(d.fixedTotal)}</span>
        </div>
        {(d.fixedBreakdown || []).length === 0
          ? <p className="text-sm text-slate-400">운영 비용 페이지에서 이번달 데이터를 입력하면 자동 표시됩니다</p>
          : (
            <div className="grid grid-cols-2 gap-x-10 gap-y-2 sm:grid-cols-3">
              {(d.fixedBreakdown || []).map((r) => (
                <div key={r.category} className="flex justify-between text-sm">
                  <span className="text-slate-500">{r.category}</span>
                  <span className="font-bold text-slate-800">{won(r.amount)}</span>
                </div>
              ))}
            </div>
          )
        }
        <div className="mt-4 flex gap-6 border-t border-slate-100 pt-4 text-xs text-slate-400">
          <span>총 부채 <strong className="text-slate-700">{won(d.totalDebt)}</strong></span>
          <span>법인 현금 <strong className="text-slate-700">{won(d.cash)}</strong></span>
        </div>
      </div>

      {/* ─── 목표 설정 패널 ───────────────────────────────────────────────── */}
      {editMode && (
        <div className="rounded-2xl border-2 border-sky-200 bg-sky-50 p-6">
          <h2 className="mb-1 text-sm font-black text-sky-800">월 목표 설정</h2>
          <p className="mb-5 text-xs text-slate-500">현금·부채·운영비용은 각 페이지 실제 데이터에서 자동 집계됩니다</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              ['goal_online', '단백깡 (온라인) 목표'],
              ['goal_export', '수출 목표'],
              ['goal_consulting', '컨설팅 목표'],
            ].map(([key, label]) => (
              <div key={key}>
                <label className="mb-1 block text-xs font-bold text-slate-600">{label}</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={wonInput(form[key])}
                    onChange={(e) => setForm((p) => ({ ...p, [key]: fromMan(e.target.value) }))}
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-right text-sm font-bold text-slate-900 outline-none focus:border-sky-400"
                    min="0"
                  />
                  <span className="text-xs text-slate-500">만원</span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-sky-600 px-6 py-2 text-sm font-black text-white hover:bg-sky-500 disabled:opacity-50"
            >
              {saving ? '저장 중...' : '저장'}
            </button>
            {saveMsg && <span className="text-sm font-black text-emerald-600">{saveMsg}</span>}
          </div>
        </div>
      )}

      </>}

    </div>
  )
}
