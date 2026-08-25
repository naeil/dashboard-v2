import { useCallback, useEffect, useState } from 'react'
import {
  getKpiConfig, saveKpiConfig, getKpiAssignments, saveKpiAssignments,
  getKpiTargets, saveKpiTargets, getKpiPerformance,
  getKpiTeams, saveKpiTeams, getKpiScores, saveKpiScores,
  kpiClose, kpiConfirm, kpiReopen, adjustKpiPayout, getKpiHistory,
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

const TEAM_OPTIONS = ['온라인', '오프라인 영업', '운영/물류', '마케팅', '미배정']

const thisMonth = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const toPeriodKey = (periodType, anchor) => {
  if (periodType === 'month') return anchor
  if (periodType === 'half') {
    const [y, m] = anchor.split('-').map(Number)
    return `${y}-H${m <= 6 ? 1 : 2}`
  }
  return null
}

const inputCls = 'h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 focus:border-blue-400 focus:outline-none'
const btnCls = 'rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-600 hover:bg-slate-50'

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

function StatusBadge({ status, confirmedAt }) {
  if (status === 'CONFIRMED') {
    return <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-black text-emerald-700">확정됨{confirmedAt ? ` · ${String(confirmedAt).slice(0, 10)}` : ''}</span>
  }
  if (status === 'DRAFT') {
    return <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-black text-amber-700">마감안 검토중</span>
  }
  return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-500">집계중</span>
}

function ModalShell({ title, onClose, children, footer, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className={`flex max-h-[80vh] w-full ${wide ? 'max-w-2xl' : 'max-w-xl'} flex-col rounded-2xl bg-white p-4 shadow-2xl`} onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-black text-slate-800">{title}</p>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600"><span className="material-symbols-outlined text-[20px]">close</span></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-slate-100">{children}</div>
        <div className="mt-3 flex justify-end gap-2">{footer}</div>
      </div>
    </div>
  )
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
    <ModalShell title="채널 → 팀·담당자 매핑" onClose={onClose} wide footer={(
      <>
        <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-500">취소</button>
        <button type="button" disabled={saving || rows == null} onClick={save} className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-black text-white disabled:opacity-50">{saving ? '저장 중…' : '저장'}</button>
      </>
    )}>
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
                    {TEAM_OPTIONS.map((t) => <option key={t}>{t}</option>)}
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
    </ModalShell>
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
    <ModalShell title="월별 매출 목표 입력" onClose={onClose} footer={(
      <>
        <input type="month" className={`${inputCls} mr-auto h-8 text-xs`} value={targetMonth} onChange={(e) => setTargetMonth(e.target.value)} />
        <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-500">취소</button>
        <button type="button" disabled={saving} onClick={save} className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-black text-white disabled:opacity-50">{saving ? '저장 중…' : '저장'}</button>
      </>
    )}>
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
    </ModalShell>
  )
}

/* ───────── 팀 가중치 설정 모달 ───────── */
function TeamConfigModal({ onClose, onSaved }) {
  const [rows, setRows] = useState(null)
  const [saving, setSaving] = useState(false)
  useEffect(() => { getKpiTeams().then(setRows).catch(() => setRows([])) }, [])
  const set = (idx, patch) => setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  const totalWeight = (rows || []).reduce((s, r) => s + num(r.weight), 0)
  const save = async () => {
    setSaving(true)
    try {
      await saveKpiTeams(rows.map((r, i) => ({
        teamName: r.team_name, weight: num(r.weight), autoRatio: num(r.auto_ratio), sortOrder: i + 1,
      })))
      onSaved()
    } finally { setSaving(false) }
  }
  return (
    <ModalShell title="팀 가중치·평가 방식 설정" onClose={onClose} footer={(
      <>
        <span className={`mr-auto text-[12px] font-bold ${totalWeight === 100 ? 'text-slate-400' : 'text-amber-600'}`}>가중치 합 {totalWeight}%{totalWeight !== 100 ? ' (100% 권장)' : ''}</span>
        <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-500">취소</button>
        <button type="button" disabled={saving || rows == null} onClick={save} className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-black text-white disabled:opacity-50">{saving ? '저장 중…' : '저장'}</button>
      </>
    )}>
      {rows == null ? <p className="p-6 text-center text-sm text-slate-400">불러오는 중…</p> : (
        <table className="w-full">
          <thead><tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400">
            <th className="px-3 py-2 text-left">팀</th>
            <th className="px-3 py-2 text-right">풀 배분 가중치 (%)</th>
            <th className="px-3 py-2 text-right">자동점수 비중 (%)</th>
          </tr></thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={r.team_name} className="border-b border-slate-50 last:border-b-0">
                <td className="px-3 py-1.5 text-[13px] font-bold text-slate-800">{r.team_name}</td>
                <td className="px-3 py-1.5 text-right">
                  <input className={`${inputCls} h-8 w-20 text-right text-xs`} value={r.weight}
                    onChange={(e) => set(idx, { weight: e.target.value })} />
                </td>
                <td className="px-3 py-1.5 text-right">
                  <input className={`${inputCls} h-8 w-20 text-right text-xs`} value={r.auto_ratio}
                    onChange={(e) => set(idx, { auto_ratio: e.target.value })} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="px-3 py-2 text-[11px] text-slate-400">자동점수 = 목표 달성률(상한 120). 나머지 비중은 정성 점수. 정성 미입력 시 100점(감점제).</p>
    </ModalShell>
  )
}

/* ───────── 정성 평가 모달 ───────── */
function ScoreModal({ periodKey, teams, onClose, onSaved }) {
  const [rows, setRows] = useState([])
  const [newNames, setNewNames] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getKpiScores(periodKey).then((existing) => {
      const map = new Map(existing.map((s) => [`${s.team_name}|${s.assignee_name || ''}`, s]))
      const base = []
      teams.filter((t) => t.teamName !== '미배정').forEach((team) => {
        const tKey = `${team.teamName}|`
        base.push({ teamName: team.teamName, assigneeName: '', score: map.get(tKey)?.score ?? 100, memo: map.get(tKey)?.memo ?? '' })
        ;(team.members || []).forEach((mem) => {
          const k = `${team.teamName}|${mem.assigneeName}`
          base.push({ teamName: team.teamName, assigneeName: mem.assigneeName, score: map.get(k)?.score ?? 100, memo: map.get(k)?.memo ?? '' })
        })
      })
      map.forEach((s, k) => {
        const [t, a] = k.split('|')
        if (!base.some((b) => b.teamName === t && b.assigneeName === a)) {
          base.push({ teamName: t, assigneeName: a, score: s.score, memo: s.memo ?? '' })
        }
      })
      setRows(base)
    }).catch(() => setRows([]))
  }, [periodKey, teams])

  const set = (idx, patch) => setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  const addPerson = (teamName) => {
    const name = (newNames[teamName] || '').trim()
    if (!name) return
    setRows((prev) => [...prev, { teamName, assigneeName: name, score: 100, memo: '' }])
    setNewNames((prev) => ({ ...prev, [teamName]: '' }))
  }
  const save = async () => {
    setSaving(true)
    try {
      const res = await saveKpiScores(periodKey, rows.map((r) => ({
        teamName: r.teamName, assigneeName: r.assigneeName, score: num(r.score), memo: r.memo,
      })))
      if (res && res.success === false) {
        setSaving(false)
        return
      }
      onSaved()
    } finally { setSaving(false) }
  }

  const teamNames = [...new Set(rows.map((r) => r.teamName))]
  return (
    <ModalShell title={`정성 평가 점수 — ${periodKey}`} onClose={onClose} wide footer={(
      <>
        <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-500">취소</button>
        <button type="button" disabled={saving} onClick={save} className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-black text-white disabled:opacity-50">{saving ? '저장 중…' : '저장'}</button>
      </>
    )}>
      {teamNames.map((teamName) => (
        <div key={teamName} className="border-b border-slate-100 last:border-b-0">
          <div className="flex items-center justify-between bg-slate-50 px-3 py-1.5">
            <p className="text-[12px] font-black text-slate-700">{teamName}</p>
            <div className="flex items-center gap-1.5">
              <input className={`${inputCls} h-7 w-24 text-xs`} placeholder="인원 추가"
                value={newNames[teamName] || ''} onChange={(e) => setNewNames((prev) => ({ ...prev, [teamName]: e.target.value }))} />
              <button type="button" onClick={() => addPerson(teamName)} className="rounded bg-slate-200 px-2 py-1 text-[11px] font-black text-slate-600">+</button>
            </div>
          </div>
          <table className="w-full">
            <tbody>
              {rows.map((r, idx) => r.teamName === teamName && (
                <tr key={`${r.teamName}|${r.assigneeName}`} className="border-b border-slate-50 last:border-b-0">
                  <td className="w-32 px-3 py-1.5 text-[13px] text-slate-700">{r.assigneeName || <span className="font-black text-slate-900">팀 전체</span>}</td>
                  <td className="w-24 px-2 py-1.5">
                    <input className={`${inputCls} h-8 w-20 text-right text-xs`} value={r.score}
                      onChange={(e) => set(idx, { score: e.target.value })} />
                  </td>
                  <td className="px-2 py-1.5">
                    <input className={`${inputCls} h-8 w-full text-xs`} placeholder="평가 메모" value={r.memo || ''}
                      onChange={(e) => set(idx, { memo: e.target.value })} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      <p className="px-3 py-2 text-[11px] text-slate-400">0~120점. 비매출 팀(운영/물류·마케팅) 인원은 여기서 추가하면 성과·배분에 포함됩니다. 확정된 기간은 수정 불가.</p>
    </ModalShell>
  )
}

/* ───────── 지급안 행 (조정 입력) ───────── */
function PayoutRow({ p, editable, onSaved }) {
  const [adjust, setAdjust] = useState(p.adjust_amount ?? 0)
  const [reason, setReason] = useState(p.reason ?? '')
  const [dirty, setDirty] = useState(false)
  const save = async () => {
    await adjustKpiPayout(p.id, num(adjust), reason).catch(() => {})
    setDirty(false)
    onSaved()
  }
  return (
    <tr className="border-b border-slate-50 last:border-b-0">
      <td className="px-3 py-1.5 text-[13px] text-slate-600">{p.team_name}</td>
      <td className="px-3 py-1.5 text-[13px] font-bold text-slate-800">{p.assignee_name}</td>
      <td className="px-3 py-1.5 text-right text-[13px] text-slate-600">{comma(p.base_amount)}</td>
      <td className="px-3 py-1.5 text-right">
        {editable ? (
          <input className={`${inputCls} h-8 w-24 text-right text-xs`} value={comma(adjust)}
            onChange={(e) => { setAdjust(String(e.target.value).startsWith('-') ? -num(e.target.value) : num(e.target.value)); setDirty(true) }} />
        ) : <span className="text-[13px] text-slate-600">{comma(p.adjust_amount)}</span>}
      </td>
      <td className="px-3 py-1.5">
        {editable ? (
          <input className={`${inputCls} h-8 w-full text-xs`} placeholder="조정 사유" value={reason}
            onChange={(e) => { setReason(e.target.value); setDirty(true) }} />
        ) : <span className="text-[12px] text-slate-500">{p.reason || '-'}</span>}
      </td>
      <td className="px-3 py-1.5 text-right text-[13px] font-black text-blue-600">{won(num(p.base_amount) + num(editable ? adjust : p.adjust_amount))}</td>
      {editable && (
        <td className="px-2 py-1.5 text-right">
          <button type="button" disabled={!dirty} onClick={save}
            className={`rounded px-2 py-1 text-[11px] font-black ${dirty ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-300'}`}>저장</button>
        </td>
      )}
    </tr>
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
  const [history, setHistory] = useState(null)
  const [showHistory, setShowHistory] = useState(false)
  const [working, setWorking] = useState(false)
  const [notice, setNotice] = useState('')

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

  const loadHistory = useCallback(() => {
    getKpiHistory().then(setHistory).catch(() => setHistory({ snapshots: [], payouts: [] }))
  }, [])
  useEffect(() => {
    if (!showHistory) return undefined
    const t = setTimeout(loadHistory, 0)
    return () => clearTimeout(t)
  }, [showHistory, loadHistory])

  const incentive = data.incentive || {}
  const teams = data.teams || []
  const periodKey = data.periodKey || toPeriodKey(periodType, anchor)
  const closable = periodType === 'month' || periodType === 'half'
  const status = data.snapshotStatus || null
  const confirmed = status === 'CONFIRMED'
  const payouts = data.payouts || []

  const runWorkflow = async (fn, label) => {
    setWorking(true)
    setNotice('')
    try {
      const res = await fn()
      if (res && res.success === false) setNotice(res.message || `${label} 실패`)
      else setNotice(`${label} 완료`)
    } catch {
      setNotice(`${label} 실패`)
    } finally {
      setWorking(false)
      load()
      if (showHistory) loadHistory()
    }
  }

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
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-black text-slate-900">KPI 성과급</h1>
            {closable && <StatusBadge status={status} confirmedAt={data.confirmedAt} />}
          </div>
          <p className="mt-0.5 text-[12px] text-slate-400">
            팀·개인 성과(온라인 + 오프라인 거래처) → 마감안 → 대표 확정 → 지급 대장 · {periodLabel(data)}
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
        </div>
      </div>

      {/* 액션 바 */}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setModal('assignment')} className={btnCls}>담당 매핑</button>
        <button type="button" onClick={() => setModal('target')} className={btnCls}>목표 입력</button>
        <button type="button" onClick={() => setModal('team')} className={btnCls}>팀 가중치</button>
        {closable && !confirmed && <button type="button" onClick={() => setModal('score')} className={btnCls}>정성 평가</button>}
        <span className="mx-1 h-5 w-px bg-slate-200" />
        {closable && !confirmed && (
          <button type="button" disabled={working} onClick={() => runWorkflow(() => kpiClose(periodType, anchor), '마감안 생성')}
            className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-700 hover:bg-amber-100 disabled:opacity-50">
            {status === 'DRAFT' ? '마감안 재생성' : '마감안 생성'}
          </button>
        )}
        {closable && status === 'DRAFT' && (
          <button type="button" disabled={working} onClick={() => runWorkflow(() => kpiConfirm(periodType, anchor, null), '최종 확정')}
            className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-black text-white hover:bg-emerald-600 disabled:opacity-50">
            최종 확정
          </button>
        )}
        {closable && confirmed && (
          <button type="button" disabled={working} onClick={() => runWorkflow(() => kpiReopen(periodType, anchor), '재오픈')}
            className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-black text-rose-600 hover:bg-rose-100 disabled:opacity-50">
            재오픈 (확정 해제)
          </button>
        )}
        <button type="button" onClick={() => setShowHistory((v) => !v)} className={btnCls}>{showHistory ? '이력 닫기' : '확정 이력'}</button>
        {notice && <span className="text-[12px] font-bold text-blue-600">{notice}</span>}
      </div>

      {confirmed && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[12px] font-bold text-emerald-700">
          이 기간은 확정되어 스냅샷 기준으로 표시됩니다. 원본 데이터가 바뀌어도 지급 근거는 변하지 않습니다.
        </div>
      )}

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
          <p className="text-[11px] font-bold text-slate-400">성과급 풀 {periodType === 'half' ? '(반기 지급 기준)' : '(기간 환산)'}</p>
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
              팀몫 {Number(config.team_ratio)}% : 개인몫 {100 - Number(config.team_ratio)}%<br />
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

      {/* 확정 이력 (지급 대장) */}
      {showHistory && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-black text-slate-800">확정 이력 · 지급 대장</p>
          {history == null ? <p className="py-6 text-center text-sm text-slate-400">불러오는 중…</p> : (
            <>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[560px]">
                  <thead><tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400">
                    <th className="px-3 py-2 text-left">기간</th><th className="px-3 py-2 text-left">유형</th><th className="px-3 py-2 text-left">상태</th>
                    <th className="px-3 py-2 text-right">매출</th><th className="px-3 py-2 text-right">추정 이익</th><th className="px-3 py-2 text-right">풀</th>
                    <th className="px-3 py-2 text-left">확정일</th>
                  </tr></thead>
                  <tbody>
                    {(history.snapshots || []).length === 0 && (
                      <tr><td colSpan={7} className="px-3 py-4 text-center text-[12px] text-slate-400">마감·확정 이력이 없습니다.</td></tr>
                    )}
                    {(history.snapshots || []).map((s) => (
                      <tr key={s.id} className="border-b border-slate-50 last:border-b-0">
                        <td className="px-3 py-1.5 text-[13px] font-bold text-slate-800">{s.period_key}</td>
                        <td className="px-3 py-1.5 text-[12px] text-slate-500">{s.period_type === 'half' ? '반기' : '월간'}</td>
                        <td className="px-3 py-1.5"><StatusBadge status={s.status} confirmedAt={s.confirmed_date} /></td>
                        <td className="px-3 py-1.5 text-right text-[13px] text-slate-700">{comma(s.total_sales)}</td>
                        <td className="px-3 py-1.5 text-right text-[13px] text-slate-700">{comma(s.total_profit)}</td>
                        <td className="px-3 py-1.5 text-right text-[13px] font-black text-blue-600">{comma(s.pool)}</td>
                        <td className="px-3 py-1.5 text-[12px] text-slate-500">{s.confirmed_date || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {(history.payouts || []).filter((p) => p.status === 'CONFIRMED').length > 0 && (
                <div className="mt-4 overflow-x-auto">
                  <p className="text-[12px] font-black text-slate-600">확정 지급 내역 (개인별)</p>
                  <table className="mt-2 w-full min-w-[560px]">
                    <thead><tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400">
                      <th className="px-3 py-2 text-left">기간</th><th className="px-3 py-2 text-left">팀</th><th className="px-3 py-2 text-left">담당자</th>
                      <th className="px-3 py-2 text-right">계산액</th><th className="px-3 py-2 text-right">조정</th><th className="px-3 py-2 text-right">확정 지급액</th>
                      <th className="px-3 py-2 text-left">사유</th>
                    </tr></thead>
                    <tbody>
                      {(history.payouts || []).filter((p) => p.status === 'CONFIRMED').map((p) => (
                        <tr key={p.id} className="border-b border-slate-50 last:border-b-0">
                          <td className="px-3 py-1.5 text-[12px] text-slate-500">{p.period_key}</td>
                          <td className="px-3 py-1.5 text-[13px] text-slate-600">{p.team_name}</td>
                          <td className="px-3 py-1.5 text-[13px] font-bold text-slate-800">{p.assignee_name}</td>
                          <td className="px-3 py-1.5 text-right text-[13px] text-slate-600">{comma(p.base_amount)}</td>
                          <td className="px-3 py-1.5 text-right text-[13px] text-slate-600">{comma(p.adjust_amount)}</td>
                          <td className="px-3 py-1.5 text-right text-[13px] font-black text-emerald-600">{won(p.final_amount)}</td>
                          <td className="px-3 py-1.5 text-[12px] text-slate-500">{p.reason || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {loading ? <p className="py-12 text-center text-sm text-slate-400">불러오는 중…</p> : (
        <>
          {/* 팀 카드 */}
          <div className="space-y-4">
            {teams.map((team) => (
              <div key={team.teamName} className="rounded-xl border border-slate-200 bg-white">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-black text-slate-900">{team.teamName}</p>
                    {team.weight != null && Number(team.weight) > 0 && (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-black text-slate-500">가중치 {Number(team.weight)}%</span>
                    )}
                    {team.score != null && (
                      <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-black text-indigo-600">팀 점수 {Number(team.score)}</span>
                    )}
                    <span className="text-[12px] font-bold text-slate-500">{won(team.sales)} · {comma(team.orders)}건</span>
                    <Yoy value={team.yoy} />
                  </div>
                  <div className="flex items-center gap-3">
                    {team.targetSales != null && <span className="text-[11px] text-slate-400">목표 {won(team.targetSales)}</span>}
                    <AchieveBar value={team.achievement} />
                  </div>
                </div>
                {(team.metrics || []).length > 0 && (
                  <div className="flex flex-wrap gap-4 border-b border-slate-100 bg-slate-50/60 px-4 py-2">
                    {team.metrics.map((m) => (
                      <span key={m.name} className="text-[12px] font-bold text-slate-600">
                        {m.name} <span className="font-black text-slate-900">{comma(m.value)}{m.unit}</span>
                        {m.yoy != null && <span className="ml-1"><Yoy value={m.yoy} /></span>}
                      </span>
                    ))}
                    <span className="text-[10px] text-slate-400">자동 지표 (참고)</span>
                  </div>
                )}
                <div className="grid grid-cols-1 gap-0 lg:grid-cols-2">
                  <div className="overflow-x-auto border-b border-slate-100 lg:border-b-0 lg:border-r">
                    <p className="px-4 pt-3 text-[11px] font-bold text-slate-400">채널별</p>
                    {(team.channels || []).length ? (
                      <table className="w-full min-w-[380px]">
                        <tbody>
                          {[...team.channels].sort((a, b) => b.sales - a.sales).map((ch) => (
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
                    ) : (
                      <p className="px-4 py-4 text-[12px] text-slate-400">매출 채널 없음 — 지표·정성 평가 기반 팀입니다.</p>
                    )}
                  </div>
                  <div className="overflow-x-auto">
                    <p className="px-4 pt-3 text-[11px] font-bold text-slate-400">개인별</p>
                    {(team.members || []).length ? (
                      <table className="w-full min-w-[380px]">
                        <tbody>
                          {team.members.map((mem) => (
                            <tr key={mem.assigneeName} className="border-b border-slate-50 last:border-b-0">
                              <td className="px-4 py-1.5 text-[13px] font-bold text-slate-800">{mem.assigneeName}
                                {mem.score != null && <span className="ml-1.5 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-black text-indigo-600">{Number(mem.score)}점</span>}
                              </td>
                              <td className="px-2 py-1.5 text-right text-[13px] font-black text-slate-900">{comma(mem.sales)}</td>
                              <td className="px-4 py-1.5 text-right"><AchieveBar value={mem.achievement} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p className="px-4 py-4 text-[12px] text-slate-400">인원 없음 — [담당 매핑]에서 담당자를 지정하거나 [정성 평가]에서 인원을 추가하세요.</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 성과급 배분 */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-black text-slate-800">
              성과급 배분 {payouts.length > 0 ? (confirmed ? '(확정)' : '(마감안 — 조정 가능)') : '시뮬레이션'}
              <span className="ml-2 text-[11px] font-bold text-slate-400">팀 가중치 × 팀 점수 → 팀 풀 → 팀몫 {incentive.teamRatio}% 균등 + 개인몫 {100 - Number(incentive.teamRatio || 0)}% 점수 비례</span>
            </p>

            {(incentive.teamPools || []).length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {incentive.teamPools.map((tp) => (
                  <span key={tp.teamName} className={`rounded-lg px-2.5 py-1.5 text-[12px] font-bold ${tp.allocated ? 'bg-slate-100 text-slate-700' : 'bg-amber-50 text-amber-700'}`}>
                    {tp.teamName} <span className="font-black">{won(tp.teamPool)}</span>{!tp.allocated && ' · 인원 미등록'}
                  </span>
                ))}
              </div>
            )}

            {payouts.length > 0 ? (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[640px]">
                  <thead><tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400">
                    <th className="px-3 py-2 text-left">팀</th><th className="px-3 py-2 text-left">담당자</th>
                    <th className="px-3 py-2 text-right">계산액</th><th className="px-3 py-2 text-right">조정</th>
                    <th className="px-3 py-2 text-left">사유</th><th className="px-3 py-2 text-right">지급액</th>
                    {!confirmed && <th className="px-2 py-2" />}
                  </tr></thead>
                  <tbody>
                    {payouts.map((p) => (
                      <PayoutRow key={p.id} p={p} editable={!confirmed} onSaved={load} />
                    ))}
                  </tbody>
                </table>
                {!confirmed && <p className="mt-2 text-[11px] text-slate-400">조정 후 [최종 확정]을 누르면 지급액이 잠기고 지급 대장에 기록됩니다.</p>}
              </div>
            ) : num(incentive.pool) <= 0 ? (
              <p className="mt-3 text-[13px] text-slate-400">기간 추정 영업이익 {won(data.totalProfit)} — 기준액 {won(incentive.scaledThreshold)} 이하라 성과급 풀이 없습니다.</p>
            ) : (incentive.payout || []).length === 0 ? (
              <p className="mt-3 text-[13px] text-amber-600">풀 {won(incentive.pool)} 발생 — 배분 대상 인원이 없습니다. [담당 매핑] 또는 [정성 평가]에서 인원을 등록하세요.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[520px]">
                  <thead><tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400">
                    <th className="px-3 py-2 text-left">팀</th><th className="px-3 py-2 text-left">담당자</th>
                    <th className="px-3 py-2 text-right">개인 점수</th><th className="px-3 py-2 text-right">예상 성과급</th>
                  </tr></thead>
                  <tbody>
                    {incentive.payout.map((p) => (
                      <tr key={`${p.teamName}|${p.assigneeName}`} className="border-b border-slate-50 last:border-b-0">
                        <td className="px-3 py-1.5 text-[13px] text-slate-600">{p.teamName}</td>
                        <td className="px-3 py-1.5 text-[13px] font-bold text-slate-800">{p.assigneeName}</td>
                        <td className="px-3 py-1.5 text-right text-[13px] text-slate-600">{Number(p.score)}</td>
                        <td className="px-3 py-1.5 text-right text-[13px] font-black text-blue-600">{won(p.incentive)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {periodType === 'half' && <p className="mt-2 text-[11px] text-slate-400">[마감안 생성]을 누르면 이 계산이 지급안으로 저장되고 개인별 조정이 가능해집니다.</p>}
              </div>
            )}
          </div>
        </>
      )}

      {modal === 'assignment' && <AssignmentModal onClose={() => setModal('')} onSaved={() => { setModal(''); load() }} />}
      {modal === 'target' && <TargetModal month={anchor} teams={teams} onClose={() => setModal('')} onSaved={() => { setModal(''); load() }} />}
      {modal === 'team' && <TeamConfigModal onClose={() => setModal('')} onSaved={() => { setModal(''); load() }} />}
      {modal === 'score' && periodKey && <ScoreModal periodKey={periodKey} teams={teams} onClose={() => setModal('')} onSaved={() => { setModal(''); load() }} />}
    </div>
  )
}
