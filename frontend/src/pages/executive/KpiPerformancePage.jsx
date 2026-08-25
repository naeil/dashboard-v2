import { useCallback, useEffect, useState } from 'react'
import {
  getKpiConfig, saveKpiConfig, getKpiAssignments, saveKpiAssignments,
  getKpiTargets, saveKpiTargets, getKpiPerformance,
} from '../../api/kpiApi'

const num = (v) => { const x = Number(String(v ?? 0).replace(/,/g, '')); return Number.isFinite(x) ? x : 0 }
const won = (v) => `${Math.round(num(v)).toLocaleString('ko-KR')}원`
const comma = (v) => Math.round(num(v)).toLocaleString('ko-KR')

const PERIODS = [
  { key: 'month', label: '월간' },
  { key: 'quarter', label: '분기' },
  { key: 'half', label: '반기' },
  { key: 'year', label: '연간' },
]

const thisMonth = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const inputCls = 'h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 focus:border-blue-400 focus:outline-none'

function periodLabel(data) {
  if (!data.startDate) return ''
  return `${data.startDate} ~ ${data.endDate}`
}

function AchieveBar({ value }) {
  if (value == null) return <span className="text-[11px] text-slate-400">목표 미설정</span>
  const pct = Math.min(150, Number(value))
  const color = value >= 100 ? 'bg-emerald-500' : value >= 70 ? 'bg-amber-400' : 'bg-rose-400'
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full ${color}`} style={{ width: `${Math.min(100, pct / 1.5)}%` }} />
      </div>
      <span className={`text-[12px] font-black ${value >= 100 ? 'text-emerald-600' : value >= 70 ? 'text-amber-600' : 'text-rose-500'}`}>{value}%</span>
    </div>
  )
}

function Yoy({ value }) {
  if (value == null) return <span className="text-[11px] text-slate-300">-</span>
  const up = Number(value) >= 0
  return <span className={`text-[12px] font-black ${up ? 'text-emerald-600' : 'text-rose-500'}`}>{up ? '▲' : '▼'} {Math.abs(value)}%</span>
}

/* ───────── 담당 매핑 모달 ───────── */
function AssignmentModal({ onClose, onSaved }) {
  const [rows, setRows] = useState(null)
  const [saving, setSaving] = useState(false)
  useEffect(() => { getKpiAssignments().then(setRows).catch(() => setRows([])) }, [])
  const set = (idx, patch) => setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  const save = async () => {
    setSaving(true)
    try {
      await saveKpiAssignments(rows.map((r) => ({
        channelName: r.channel_name, teamName: r.team_name, assigneeName: r.assignee_name,
      })))
      onSaved()
    } finally { setSaving(false) }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-2xl bg-white p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-black text-slate-800">채널 → 팀·담당자 매핑</p>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600"><span className="material-symbols-outlined text-[20px]">close</span></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-slate-100">
          {rows == null ? <p className="p-6 text-center text-sm text-slate-400">불러오는 중…</p> : (
            <table className="w-full">
              <thead><tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400">
                <th className="px-3 py-2 text-left">채널</th><th className="px-3 py-2 text-right">최근 90일 매출</th>
                <th className="px-3 py-2 text-left">팀</th><th className="px-3 py-2 text-left">담당자</th>
              </tr></thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr key={r.channel_name} className="border-b border-slate-50 last:border-b-0">
                    <td className="px-3 py-1.5 text-[13px] font-bold text-slate-800">{r.channel_name}</td>
                    <td className="px-3 py-1.5 text-right text-[12px] text-slate-500">{comma(r.recent_sales)}</td>
                    <td className="px-3 py-1.5">
                      <select className={`${inputCls} h-8 text-xs`} value={r.team_name || '미배정'} onChange={(e) => set(idx, { team_name: e.target.value })}>
                        {['온라인', '오프라인 영업', '운영/물류', '마케팅', '미배정'].map((t) => <option key={t}>{t}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-1.5">
                      <input className={`${inputCls} h-8 w-28 text-xs`} placeholder="이름" value={r.assignee_name || ''}
                        onChange={(e) => set(idx, { assignee_name: e.target.value })} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-500">취소</button>
          <button type="button" disabled={saving || rows == null} onClick={save} className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-black text-white disabled:opacity-50">{saving ? '저장 중…' : '저장'}</button>
        </div>
      </div>
    </div>
  )
}

/* ───────── 목표 입력 모달 ───────── */
function TargetModal({ month, teams, onClose, onSaved }) {
  const [targetMonth, setTargetMonth] = useState(month)
  const [rows, setRows] = useState([])
  const [saving, setSaving] = useState(false)

  const load = useCallback((m) => {
    getKpiTargets(m, m).then((existing) => {
      const map = new Map(existing.map((t) => [`${t.team_name}|${t.assignee_name || ''}`, t.target_sales]))
      const base = []
      teams.forEach((team) => {
        base.push({ teamName: team.teamName, assigneeName: '', targetSales: map.get(`${team.teamName}|`) || 0 })
        ;(team.members || []).forEach((mem) => {
          base.push({ teamName: team.teamName, assigneeName: mem.assigneeName, targetSales: map.get(`${team.teamName}|${mem.assigneeName}`) || 0 })
        })
      })
      map.forEach((v, k) => {
        const [t, a] = k.split('|')
        if (!base.some((b) => b.teamName === t && b.assigneeName === a)) base.push({ teamName: t, assigneeName: a, targetSales: v })
      })
      setRows(base)
    }).catch(() => setRows([]))
  }, [teams])

  useEffect(() => { load(targetMonth) }, [targetMonth, load])

  const save = async () => {
    setSaving(true)
    try {
      await saveKpiTargets(rows.filter((r) => num(r.targetSales) > 0).map((r) => ({
        periodMonth: targetMonth, teamName: r.teamName, assigneeName: r.assigneeName, targetSales: num(r.targetSales),
      })))
      onSaved()
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="flex max-h-[80vh] w-full max-w-xl flex-col rounded-2xl bg-white p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-black text-slate-800">월별 매출 목표 입력</p>
          <div className="flex items-center gap-2">
            <input type="month" className={`${inputCls} h-8 text-xs`} value={targetMonth} onChange={(e) => setTargetMonth(e.target.value)} />
            <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600"><span className="material-symbols-outlined text-[20px]">close</span></button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-slate-100">
          <table className="w-full">
            <thead><tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400">
              <th className="px-3 py-2 text-left">팀</th><th className="px-3 py-2 text-left">대상</th><th className="px-3 py-2 text-right">월 매출 목표 (원)</th>
            </tr></thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={`${r.teamName}|${r.assigneeName}`} className="border-b border-slate-50 last:border-b-0">
                  <td className="px-3 py-1.5 text-[13px] font-bold text-slate-700">{r.teamName}</td>
                  <td className="px-3 py-1.5 text-[13px] text-slate-600">{r.assigneeName || <span className="font-black text-slate-800">팀 전체</span>}</td>
                  <td className="px-3 py-1.5 text-right">
                    <input className={`${inputCls} h-8 w-36 text-right text-xs`} value={comma(r.targetSales)}
                      onChange={(e) => setRows((prev) => prev.map((x, i) => (i === idx ? { ...x, targetSales: num(e.target.value) } : x)))} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-500">취소</button>
          <button type="button" disabled={saving} onClick={save} className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-black text-white disabled:opacity-50">{saving ? '저장 중…' : '저장'}</button>
        </div>
      </div>
    </div>
  )
}

/* ───────── 메인 ───────── */
export default function KpiPerformancePage() {
  const [periodType, setPeriodType] = useState('month')
  const [anchor, setAnchor] = useState(thisMonth())
  const [data, setData] = useState({ teams: [], incentive: {} })
  const [loading, setLoading] = useState(true)
  const [config, setConfig] = useState(null)
  const [configEdit, setConfigEdit] = useState(false)
  const [modal, setModal] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    getKpiPerformance(periodType, anchor)
      .then((res) => setData(res || { teams: [], incentive: {} }))
      .catch(() => setData({ teams: [], incentive: {} }))
      .finally(() => setLoading(false))
  }, [periodType, anchor])

  useEffect(() => {
    const t = setTimeout(load, 0)
    return () => clearTimeout(t)
  }, [load])
  useEffect(() => { getKpiConfig().then(setConfig).catch(() => {}) }, [])

  const incentive = data.incentive || {}
  const teams = data.teams || []

  const saveCfg = async () => {
    const saved = await saveKpiConfig({
      halfThreshold: num(config.half_threshold), poolRate: config.pool_rate, teamRatio: config.team_ratio,
    })
    setConfig(saved)
    setConfigEdit(false)
    load()
  }

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-black text-slate-900">KPI 성과급</h1>
          <p className="mt-0.5 text-[12px] text-slate-400">
            팀·개인 성과(온라인 + 오프라인 거래처) → 반기 성과급 배분 · {periodLabel(data)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {PERIODS.map((p) => (
            <button key={p.key} type="button" onClick={() => setPeriodType(p.key)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-black ${periodType === p.key ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}>
              {p.label}
            </button>
          ))}
          <input type="month" className={inputCls} value={anchor} onChange={(e) => setAnchor(e.target.value)} />
          <button type="button" onClick={() => setModal('assignment')} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-600 hover:bg-slate-50">담당 매핑</button>
          <button type="button" onClick={() => setModal('target')} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-600 hover:bg-slate-50">목표 입력</button>
        </div>
      </div>

      {/* 요약 */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-[11px] font-bold text-slate-400">총 매출</p>
          <p className="mt-1 text-xl font-black text-slate-900">{won(data.totalSales)}</p>
          <p className="mt-1"><Yoy value={data.yoy} /> <span className="text-[10px] text-slate-400">전년 동기</span></p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-[11px] font-bold text-slate-400">추정 영업이익 (수수료 차감)</p>
          <p className="mt-1 text-xl font-black text-slate-900">{won(data.totalProfit)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-[11px] font-bold text-slate-400">성과급 풀 {periodType === 'half' ? '(반기 확정 기준)' : '(기간 환산)'}</p>
          <p className={`mt-1 text-xl font-black ${num(incentive.pool) > 0 ? 'text-blue-600' : 'text-slate-400'}`}>{won(incentive.pool)}</p>
          <p className="mt-1 text-[10px] text-slate-400">기준 {won(incentive.scaledThreshold)} 초과분의 {incentive.poolRate}%</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-slate-400">배분 규칙</p>
            <button type="button" onClick={() => setConfigEdit((v) => !v)} className="text-[11px] font-bold text-blue-500">{configEdit ? '닫기' : '수정'}</button>
          </div>
          {config && !configEdit && (
            <p className="mt-1 text-[13px] font-black text-slate-800">
              팀 {Number(config.team_ratio)}% : 개인 {100 - Number(config.team_ratio)}%<br />
              <span className="text-[11px] font-bold text-slate-500">반기 기준액 {won(config.half_threshold)} · 요율 {Number(config.pool_rate)}%</span>
            </p>
          )}
          {config && configEdit && (
            <div className="mt-2 space-y-1.5">
              <input className={`${inputCls} h-8 w-full text-xs`} value={comma(config.half_threshold)} onChange={(e) => setConfig({ ...config, half_threshold: num(e.target.value) })} placeholder="반기 기준액" />
              <div className="flex gap-1.5">
                <input className={`${inputCls} h-8 flex-1 text-xs`} value={config.pool_rate} onChange={(e) => setConfig({ ...config, pool_rate: e.target.value })} placeholder="요율%" />
                <input className={`${inputCls} h-8 flex-1 text-xs`} value={config.team_ratio} onChange={(e) => setConfig({ ...config, team_ratio: e.target.value })} placeholder="팀%" />
                <button type="button" onClick={saveCfg} className="rounded-lg bg-blue-500 px-3 text-xs font-black text-white">저장</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {loading ? <p className="py-12 text-center text-sm text-slate-400">불러오는 중…</p> : (
        <>
          {/* 팀 카드 */}
          <div className="space-y-4">
            {teams.map((team) => (
              <div key={team.teamName} className="rounded-xl border border-slate-200 bg-white">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-black text-slate-900">{team.teamName}</p>
                    <span className="text-[12px] font-bold text-slate-500">{won(team.sales)} · {comma(team.orders)}건</span>
                    <Yoy value={team.yoy} />
                  </div>
                  <div className="flex items-center gap-3">
                    {team.targetSales != null && <span className="text-[11px] text-slate-400">목표 {won(team.targetSales)}</span>}
                    <AchieveBar value={team.achievement} />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-0 lg:grid-cols-2">
                  <div className="overflow-x-auto border-b border-slate-100 lg:border-b-0 lg:border-r">
                    <p className="px-4 pt-3 text-[11px] font-bold text-slate-400">채널별</p>
                    <table className="w-full min-w-[380px]">
                      <tbody>
                        {(team.channels || []).sort((a, b) => b.sales - a.sales).map((ch) => (
                          <tr key={ch.channelName} className="border-b border-slate-50 last:border-b-0">
                            <td className="px-4 py-1.5 text-[13px] font-bold text-slate-700">{ch.channelName}
                              {ch.assigneeName && <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">{ch.assigneeName}</span>}
                            </td>
                            <td className="px-2 py-1.5 text-right text-[13px] font-black text-slate-900">{comma(ch.sales)}</td>
                            <td className="px-4 py-1.5 text-right"><Yoy value={ch.yoy} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="overflow-x-auto">
                    <p className="px-4 pt-3 text-[11px] font-bold text-slate-400">개인별</p>
                    {(team.members || []).length ? (
                      <table className="w-full min-w-[380px]">
                        <tbody>
                          {team.members.map((mem) => (
                            <tr key={mem.assigneeName} className="border-b border-slate-50 last:border-b-0">
                              <td className="px-4 py-1.5 text-[13px] font-bold text-slate-800">{mem.assigneeName}</td>
                              <td className="px-2 py-1.5 text-right text-[13px] font-black text-slate-900">{comma(mem.sales)}</td>
                              <td className="px-4 py-1.5 text-right"><AchieveBar value={mem.achievement} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p className="px-4 py-4 text-[12px] text-slate-400">담당자 미지정 — [담당 매핑]에서 채널별 담당자를 지정하면 개인 성과가 집계됩니다.</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 성과급 배분 */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-black text-slate-800">성과급 배분 시뮬레이션 <span className="text-[11px] font-bold text-slate-400">추정 영업이익 기여 기준 · 팀 {incentive.teamRatio}% + 개인 {100 - Number(incentive.teamRatio || 0)}%</span></p>
            {num(incentive.pool) <= 0 ? (
              <p className="mt-3 text-[13px] text-slate-400">기간 추정 영업이익 {won(data.totalProfit)} — 기준액 {won(incentive.scaledThreshold)} 이하라 성과급 풀이 없습니다.</p>
            ) : (incentive.payout || []).length === 0 ? (
              <p className="mt-3 text-[13px] text-amber-600">풀 {won(incentive.pool)} 발생 — 담당자가 지정된 채널이 없어 배분 대상이 없습니다. [담당 매핑]에서 지정하세요.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[520px]">
                  <thead><tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400">
                    <th className="px-3 py-2 text-left">팀</th><th className="px-3 py-2 text-left">담당자</th>
                    <th className="px-3 py-2 text-right">기여 영업이익</th><th className="px-3 py-2 text-right">예상 성과급</th>
                  </tr></thead>
                  <tbody>
                    {incentive.payout.map((p) => (
                      <tr key={`${p.teamName}|${p.assigneeName}`} className="border-b border-slate-50 last:border-b-0">
                        <td className="px-3 py-1.5 text-[13px] text-slate-600">{p.teamName}</td>
                        <td className="px-3 py-1.5 text-[13px] font-bold text-slate-800">{p.assigneeName}</td>
                        <td className="px-3 py-1.5 text-right text-[13px] text-slate-600">{comma(p.profit)}</td>
                        <td className="px-3 py-1.5 text-right text-[13px] font-black text-blue-600">{won(p.incentive)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {modal === 'assignment' && <AssignmentModal onClose={() => setModal('')} onSaved={() => { setModal(''); load() }} />}
      {modal === 'target' && <TargetModal month={anchor} teams={teams} onClose={() => setModal('')} onSaved={() => { setModal(''); load() }} />}
    </div>
  )
}
