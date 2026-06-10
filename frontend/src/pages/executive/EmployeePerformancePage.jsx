import { useEffect, useMemo, useState, useCallback } from 'react'
import { getUsers } from '../../api/authApi'
import {
  getExecutiveWorkTasks,
  getEmployeeDetail,
  analyzeEmployee,
  getEmployeeAnalysisHistory,
  saveEmployeeFeedback,
} from '../../api/executiveApi'
import { DataTable, PageHeader, Panel } from './ExecutiveComponents'
import { count } from './formatters'
import { isTaskDelayed, taskProgress, taskStatusClass, taskStatusLabels } from './workTaskUtils'

// ── 점수 계산 ─────────────────────────────────────────────────────────────
function scoreEmployee(row) {
  const completionScore = row.completionRate * 0.35
  const progressScore   = row.avgProgress * 0.35
  const riskPenalty     = Math.min(35, row.delayed * 10 + row.blocked * 12)
  const reviewBonus     = Math.min(10, row.review * 3)
  return Math.max(0, Math.min(100, Math.round(completionScore + progressScore + reviewBonus - riskPenalty + 20)))
}

function GradePill({ score }) {
  const grade = score >= 85 ? '우수' : score >= 70 ? '양호' : score >= 55 ? '주의' : '위험'
  const cls   = score >= 85
    ? 'border-emerald-400/30 bg-emerald-400/15 text-emerald-100'
    : score >= 70 ? 'border-sky-400/30 bg-sky-400/15 text-sky-100'
    : score >= 55 ? 'border-amber-400/30 bg-amber-400/15 text-amber-100'
    : 'border-rose-400/30 bg-rose-400/15 text-rose-100'
  return <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${cls}`}>{grade}</span>
}

function ProgressBar({ value }) {
  const color = value >= 80 ? 'bg-emerald-300' : value >= 60 ? 'bg-sky-300' : value >= 40 ? 'bg-amber-300' : 'bg-rose-300'
  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-800">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(2, Math.min(100, value))}%` }} />
    </div>
  )
}

// ── 도넛 차트 (SVG) ──────────────────────────────────────────────────────
const CHART_COLORS = [
  '#38bdf8','#34d399','#f59e0b','#f87171','#a78bfa',
  '#fb923c','#4ade80','#e879f9','#67e8f9','#fde68a',
]

function DonutChart({ data, size = 140 }) {
  if (!data || Object.keys(data).length === 0) return null
  const entries = Object.entries(data)
  const total   = entries.reduce((s, [, v]) => s + v, 0)
  if (total === 0) return null

  const cx = size / 2, cy = size / 2, r = size * 0.38, inner = r * 0.55
  let cumAngle = -Math.PI / 2
  const slices = entries.map(([label, value], i) => {
    const angle    = (value / total) * 2 * Math.PI
    const x1 = cx + r * Math.cos(cumAngle), y1 = cy + r * Math.sin(cumAngle)
    cumAngle += angle
    const x2 = cx + r * Math.cos(cumAngle), y2 = cy + r * Math.sin(cumAngle)
    const largeArc = angle > Math.PI ? 1 : 0
    const ix1 = cx + inner * Math.cos(cumAngle - angle), iy1 = cy + inner * Math.sin(cumAngle - angle)
    const ix2 = cx + inner * Math.cos(cumAngle), iy2 = cy + inner * Math.sin(cumAngle)
    const d = [
      `M ${x1} ${y1}`,
      `A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`,
      `L ${ix2} ${iy2}`,
      `A ${inner} ${inner} 0 ${largeArc} 0 ${ix1} ${iy1}`,
      'Z',
    ].join(' ')
    return { label, value, color: CHART_COLORS[i % CHART_COLORS.length], d, pct: Math.round((value / total) * 100) }
  })

  return (
    <div className="flex flex-col items-center gap-3">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {slices.map((s, i) => (
          <path key={i} d={s.d} fill={s.color} opacity={0.85} />
        ))}
        <text x={cx} y={cy - 6}  textAnchor="middle" fill="#e2e8f0" fontSize="18" fontWeight="bold">{total}</text>
        <text x={cx} y={cy + 12} textAnchor="middle" fill="#94a3b8" fontSize="10">업무</text>
      </svg>
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1">
        {slices.map((s, i) => (
          <div key={i} className="flex items-center gap-1 text-xs text-slate-300">
            <span className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
            {s.label} {s.pct}%
          </div>
        ))}
      </div>
    </div>
  )
}

// ── 업무 상태 뱃지 ────────────────────────────────────────────────────────
function StatusBadge({ status, isDelayed }) {
  if (isDelayed) return <span className="rounded px-1.5 py-0.5 text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">지연</span>
  if (status === 'BLOCKED')    return <span className="rounded px-1.5 py-0.5 text-[10px] font-bold bg-rose-400/20 text-rose-200 border border-rose-400/30">막힘</span>
  if (status === 'DONE')       return <span className="rounded px-1.5 py-0.5 text-[10px] font-bold bg-emerald-400/20 text-emerald-200 border border-emerald-400/30">완료</span>
  if (status === 'IN_PROGRESS') return <span className="rounded px-1.5 py-0.5 text-[10px] font-bold bg-sky-400/20 text-sky-200 border border-sky-400/30">진행</span>
  if (status === 'REVIEW')     return <span className="rounded px-1.5 py-0.5 text-[10px] font-bold bg-violet-400/20 text-violet-200 border border-violet-400/30">검토</span>
  return <span className="rounded px-1.5 py-0.5 text-[10px] font-bold bg-slate-700 text-slate-300 border border-slate-600">{status}</span>
}

// ── AI 분석 결과 카드 ─────────────────────────────────────────────────────
function AiAnalysisCard({ analysis, onFeedbackSaved }) {
  const [feedback, setFeedback] = useState(analysis.ceo_feedback || '')
  const [editing, setEditing]   = useState(!analysis.ceo_feedback)
  const [saving, setSaving]     = useState(false)

  const handleSave = async () => {
    if (!feedback.trim()) return
    setSaving(true)
    try {
      await saveEmployeeFeedback(analysis.id, feedback)
      setEditing(false)
      onFeedbackSaved?.()
    } catch (e) {
      alert('피드백 저장 실패: ' + (e?.response?.data?.message || e.message))
    } finally { setSaving(false) }
  }

  const sections = [
    { icon: '✅', label: '강점',      key: 'strengths',    bg: 'bg-emerald-900/20 border-emerald-500/20' },
    { icon: '⚠️', label: '약점',      key: 'weaknesses',   bg: 'bg-amber-900/20 border-amber-500/20'   },
    { icon: '🔴', label: '문제점',    key: 'issues',       bg: 'bg-rose-900/20 border-rose-500/20'     },
    { icon: '💡', label: '개선 방향', key: 'improvements', bg: 'bg-sky-900/20 border-sky-500/20'       },
  ]

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">
          분석일시: {analysis.analyzed_at ? new Date(analysis.analyzed_at).toLocaleString('ko-KR') : '-'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {sections.map(({ icon, label, key, bg }) => (
          <div key={key} className={`rounded-lg border p-3 ${bg}`}>
            <div className="text-xs font-bold text-slate-200 mb-1.5">{icon} {label}</div>
            <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">{analysis[key] || '-'}</p>
          </div>
        ))}
      </div>

      {/* 대표 피드백 */}
      <div className="border-t border-slate-700/50 pt-3">
        <div className="text-xs font-bold text-slate-300 mb-2">📝 대표 피드백</div>
        {editing ? (
          <div className="space-y-2">
            <textarea
              className="w-full rounded-lg bg-slate-900/60 border border-slate-600 text-xs text-slate-100 p-2.5 resize-none focus:outline-none focus:border-sky-500"
              rows={3}
              placeholder="직원에 대한 피드백을 입력하세요..."
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-sky-600 hover:bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                {saving ? '저장 중...' : '저장'}
              </button>
              {analysis.ceo_feedback && (
                <button onClick={() => { setFeedback(analysis.ceo_feedback); setEditing(false) }}
                  className="rounded-lg bg-slate-700 hover:bg-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-300">
                  취소
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs text-slate-300 whitespace-pre-line flex-1">{analysis.ceo_feedback}</p>
            <button onClick={() => setEditing(true)}
              className="flex-shrink-0 rounded px-2 py-1 text-[10px] bg-slate-700 hover:bg-slate-600 text-slate-300">
              수정
            </button>
          </div>
        )}
        {analysis.feedback_by && (
          <p className="text-[10px] text-slate-500 mt-1">
            {analysis.feedback_by} · {analysis.feedback_at ? new Date(analysis.feedback_at).toLocaleString('ko-KR') : ''}
          </p>
        )}
      </div>
    </div>
  )
}

// ── 직원 상세 패널 ────────────────────────────────────────────────────────
function EmployeeDetailPanel({ employee, onClose }) {
  const [detail,    setDetail]    = useState(null)
  const [analyses,  setAnalyses]  = useState([])
  const [analyzing, setAnalyzing] = useState(false)
  const [tab,       setTab]       = useState('tasks') // tasks | reports | ai

  const loadDetail = useCallback(async () => {
    try {
      const res = await getEmployeeDetail(employee.username)
      setDetail(res.data)
    } catch (e) { console.error(e) }
  }, [employee.username])

  const loadAnalyses = useCallback(async () => {
    try {
      const res = await getEmployeeAnalysisHistory(employee.username)
      setAnalyses(res.data || [])
    } catch (e) { console.error(e) }
  }, [employee.username])

  useEffect(() => {
    loadDetail()
    loadAnalyses()
  }, [loadDetail, loadAnalyses])

  const handleAnalyze = async () => {
    setAnalyzing(true)
    try {
      await analyzeEmployee(employee.username, employee.displayName)
      await loadAnalyses()
      setTab('ai')
    } catch (e) {
      alert('AI 분석 실패: ' + (e?.response?.data?.message || e.message))
    } finally { setAnalyzing(false) }
  }

  const tasks   = detail?.tasks   || []
  const reports = detail?.reports || []
  const catData = detail?.categoryBreakdown || {}
  const stats   = detail?.stats || {}

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/60 backdrop-blur-sm"
         onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="relative h-full w-full max-w-2xl overflow-y-auto bg-slate-900 border-l border-slate-700/50 shadow-2xl flex flex-col">
        {/* 헤더 */}
        <div className="sticky top-0 z-10 flex items-center justify-between bg-slate-900/95 backdrop-blur border-b border-slate-700/50 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-white">{employee.displayName}</h2>
            <p className="text-xs text-slate-400">{employee.department} · {employee.positionName}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleAnalyze}
              disabled={analyzing}
              className="flex items-center gap-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 transition-colors"
            >
              {analyzing ? (
                <><span className="animate-spin">⟳</span> AI 분석 중...</>
              ) : (
                <>✨ AI 분석</>
              )}
            </button>
            <button onClick={onClose}
              className="rounded-lg bg-slate-800 hover:bg-slate-700 p-2 text-slate-400 hover:text-white transition-colors">
              ✕
            </button>
          </div>
        </div>

        {/* 통계 요약 */}
        <div className="grid grid-cols-4 gap-2 px-5 pt-4">
          {[
            { label: '전체', value: stats.total ?? 0, color: 'text-slate-200' },
            { label: '진행',  value: stats.active ?? 0, color: 'text-sky-300' },
            { label: '지연',  value: stats.delayed ?? 0, color: stats.delayed > 0 ? 'text-rose-300' : 'text-slate-400' },
            { label: '막힘',  value: stats.blocked ?? 0, color: stats.blocked > 0 ? 'text-rose-400' : 'text-slate-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl bg-slate-800/50 border border-slate-700/40 p-3 text-center">
              <div className={`text-xl font-black ${color}`}>{value}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* 탭 */}
        <div className="flex gap-1 px-5 pt-4 border-b border-slate-700/40">
          {[
            { id: 'tasks',   label: `업무 현황 (${tasks.length})` },
            { id: 'reports', label: `업무보고 (${reports.length})` },
            { id: 'ai',      label: `AI 분석 (${analyses.length})` },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`pb-2 px-3 text-xs font-semibold transition-colors border-b-2 ${
                tab === t.id
                  ? 'border-violet-400 text-violet-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 px-5 py-4 space-y-4">
          {/* 업무 현황 탭 */}
          {tab === 'tasks' && (
            <>
              {Object.keys(catData).length > 0 && (
                <div className="rounded-xl bg-slate-800/40 border border-slate-700/40 p-4">
                  <div className="text-xs font-bold text-slate-300 mb-3">업무 카테고리 분포</div>
                  <DonutChart data={catData} size={160} />
                </div>
              )}

              <div className="space-y-2">
                {tasks.length === 0 && (
                  <p className="text-sm text-slate-500 text-center py-4">업무 데이터가 없습니다.</p>
                )}
                {tasks.map(task => (
                  <div key={task.id}
                    className={`rounded-xl border p-3 transition-colors ${
                      task.is_delayed || task.status === 'BLOCKED'
                        ? 'border-rose-500/30 bg-rose-900/10'
                        : 'border-slate-700/40 bg-slate-800/30 hover:bg-slate-800/60'
                    }`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <StatusBadge status={task.status} isDelayed={task.is_delayed} />
                          <span className="text-[10px] text-slate-400 bg-slate-700/50 px-1.5 rounded">{task.work_category}</span>
                        </div>
                        <p className="text-xs font-semibold text-slate-200 mt-1 truncate">{task.task_name}</p>
                        <p className="text-[10px] text-slate-400 truncate">{task.project_name}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-xs font-bold text-slate-300">{task.progress_rate}%</div>
                        {task.due_date && (
                          <div className="text-[10px] text-slate-500">~{task.due_date}</div>
                        )}
                      </div>
                    </div>
                    <div className="mt-2">
                      <ProgressBar value={task.progress_rate} />
                    </div>
                    {task.blocker_text && (
                      <p className="mt-1.5 text-[10px] text-rose-300 bg-rose-900/20 rounded px-2 py-1">
                        🚧 {task.blocker_text}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* 업무보고 탭 */}
          {tab === 'reports' && (
            <div className="space-y-2">
              {reports.length === 0 && (
                <p className="text-sm text-slate-500 text-center py-4">업무보고 내역이 없습니다.</p>
              )}
              {reports.map(r => (
                <div key={r.id} className="rounded-xl border border-slate-700/40 bg-slate-800/30 p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-slate-200">{r.title}</span>
                    <span className="text-[10px] text-slate-500">{r.report_date}</span>
                  </div>
                  {r.completed_work && (
                    <p className="text-[10px] text-slate-400"><span className="text-emerald-400">완료</span> {r.completed_work}</p>
                  )}
                  {r.planned_work && (
                    <p className="text-[10px] text-slate-400 mt-0.5"><span className="text-sky-400">계획</span> {r.planned_work}</p>
                  )}
                  {r.blockers && (
                    <p className="text-[10px] text-rose-300 mt-0.5"><span className="text-rose-400">블로커</span> {r.blockers}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* AI 분석 탭 */}
          {tab === 'ai' && (
            <div className="space-y-4">
              {analyses.length === 0 ? (
                <div className="text-center py-8 space-y-2">
                  <div className="text-3xl">✨</div>
                  <p className="text-sm text-slate-400">아직 AI 분석이 없습니다.</p>
                  <p className="text-xs text-slate-500">상단의 "AI 분석" 버튼을 클릭해 분석을 시작하세요.</p>
                </div>
              ) : (
                analyses.map(a => (
                  <AiAnalysisCard key={a.id} analysis={a} onFeedbackSaved={loadAnalyses} />
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── 메인 페이지 ──────────────────────────────────────────────────────────
export default function EmployeePerformancePage() {
  const [users,       setUsers]       = useState([])
  const [tasks,       setTasks]       = useState([])
  const [selected,    setSelected]    = useState('전체')
  const [detailUser,  setDetailUser]  = useState(null)

  const load = async () => {
    const [userRes, taskRes] = await Promise.all([getUsers(), getExecutiveWorkTasks()])
    setUsers(userRes.data || [])
    setTasks(taskRes.data || [])
  }

  useEffect(() => { load() }, [])

  const employeeRows = useMemo(() => {
    const grouped = new Map()
    const activeUsers = users.filter(u => ['EMPLOYEE', 'MANAGER'].includes(u.role))
    activeUsers.forEach(user => {
      grouped.set(user.username, {
        username: user.username,
        displayName: user.display_name || user.username,
        department:  user.department   || '-',
        positionName: user.position_name || '-',
        role: user.role,
        total: 0, active: 0, done: 0, delayed: 0, blocked: 0, review: 0,
        progressSum: 0, categories: new Map(),
      })
    })

    tasks.forEach(task => {
      const username = task.assignee_name || '미지정'
      const row = grouped.get(username) || {
        username, displayName: username,
        department: task.department || '-', positionName: '-', role: 'EMPLOYEE',
        total: 0, active: 0, done: 0, delayed: 0, blocked: 0, review: 0,
        progressSum: 0, categories: new Map(),
      }
      row.total += 1
      row.progressSum += taskProgress(task)
      if (task.status === 'DONE') row.done += 1
      else row.active += 1
      if (isTaskDelayed(task))            row.delayed += 1
      if (task.status === 'BLOCKED')      row.blocked += 1
      if (task.status === 'REVIEW' || task.approval_required) row.review += 1
      const cat = task.work_category || '기타'
      row.categories.set(cat, (row.categories.get(cat) || 0) + 1)
      grouped.set(username, row)
    })

    return Array.from(grouped.values()).map(row => {
      const topCategory = Array.from(row.categories.entries()).sort((a, b) => b[1] - a[1])[0]?.[0]
      const avgProgress = row.total > 0 ? Math.round(row.progressSum / row.total) : 0
      const completionRate = row.total > 0 ? Math.round((row.done / row.total) * 100) : 0
      const r = { ...row, topCategory, avgProgress, completionRate }
      return { ...r, score: scoreEmployee(r) }
    }).sort((a, b) => b.score - a.score)
  }, [users, tasks])

  const departments = useMemo(() => {
    const set = new Set(employeeRows.map(r => r.department).filter(Boolean))
    return ['전체', ...set]
  }, [employeeRows])

  const filtered = useMemo(() =>
    selected === '전체' ? employeeRows : employeeRows.filter(r => r.department === selected),
    [employeeRows, selected]
  )

  return (
    <div className="space-y-6">
      <PageHeader title="직원 성과 분석"
        subtitle="직원별 업무 현황과 AI 분석을 확인하세요. 직원 이름을 클릭하면 상세 패널이 열립니다." />

      {/* 부서 필터 */}
      <div className="flex flex-wrap gap-2">
        {departments.map(dept => (
          <button
            key={dept}
            onClick={() => setSelected(dept)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
              selected === dept
                ? 'border-violet-400/50 bg-violet-400/15 text-violet-200'
                : 'border-slate-600/50 bg-slate-800/40 text-slate-400 hover:text-slate-200'
            }`}
          >
            {dept}
          </button>
        ))}
      </div>

      {/* 직원 카드 목록 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(row => (
          <div
            key={row.username}
            onClick={() => setDetailUser(row)}
            className="group cursor-pointer rounded-2xl border border-slate-700/40 bg-slate-800/40 p-4 hover:bg-slate-800/70 hover:border-violet-500/30 transition-all duration-200"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white group-hover:text-violet-200 transition-colors">
                    {row.displayName}
                  </span>
                  <GradePill score={row.score} />
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">{row.department} · {row.positionName}</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black text-slate-100">{row.score}</div>
                <div className="text-[10px] text-slate-500">성과점수</div>
              </div>
            </div>

            <div className="mb-2">
              <ProgressBar value={row.avgProgress} />
              <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                <span>평균 진행률</span><span>{row.avgProgress}%</span>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-1 text-center">
              {[
                { label: '전체',  value: row.total,          color: 'text-slate-300' },
                { label: '진행',  value: row.active,         color: 'text-sky-300'   },
                { label: '지연',  value: row.delayed,        color: row.delayed > 0 ? 'text-rose-300' : 'text-slate-500' },
                { label: '막힘',  value: row.blocked,        color: row.blocked > 0 ? 'text-rose-400' : 'text-slate-500' },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-lg bg-slate-900/40 py-1.5">
                  <div className={`text-sm font-bold ${color}`}>{value}</div>
                  <div className="text-[9px] text-slate-500">{label}</div>
                </div>
              ))}
            </div>

            {(row.delayed > 0 || row.blocked > 0) && (
              <div className="mt-2 flex gap-1 flex-wrap">
                {row.delayed > 0 && (
                  <span className="rounded px-1.5 py-0.5 text-[9px] bg-rose-500/15 text-rose-300 border border-rose-500/20">
                    ⚠ 지연 {row.delayed}건
                  </span>
                )}
                {row.blocked > 0 && (
                  <span className="rounded px-1.5 py-0.5 text-[9px] bg-rose-400/15 text-rose-200 border border-rose-400/20">
                    🚧 막힘 {row.blocked}건
                  </span>
                )}
              </div>
            )}

            <div className="mt-2 text-[10px] text-slate-500 text-right">
              클릭하여 상세 보기 →
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-sm text-slate-500 py-10">해당 부서 직원이 없습니다.</p>
      )}

      {/* 직원 상세 패널 */}
      {detailUser && (
        <EmployeeDetailPanel
          employee={detailUser}
          onClose={() => setDetailUser(null)}
        />
      )}
    </div>
  )
}
