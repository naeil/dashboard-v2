import { useEffect, useMemo, useState, useCallback } from 'react'
import { getUsers } from '../../api/authApi'
import {
  getExecutiveWorkTasks,
  getEmployeeDetail,
  analyzeEmployee,
  getEmployeeAnalysisHistory,
  saveEmployeeFeedback,
} from '../../api/executiveApi'
import { isTaskDelayed, taskProgress } from './workTaskUtils'

// ── 점수 계산 ─────────────────────────────────────────────────────────────
function scoreEmployee(row) {
  const completionScore = row.completionRate * 0.35
  const progressScore   = row.avgProgress * 0.35
  const riskPenalty     = Math.min(35, row.delayed * 10 + row.blocked * 12)
  const reviewBonus     = Math.min(10, row.review * 3)
  return Math.max(0, Math.min(100, Math.round(completionScore + progressScore + reviewBonus - riskPenalty + 20)))
}

// ── 등급 설정 ─────────────────────────────────────────────────────────────
function gradeInfo(score) {
  if (score >= 85) return { label: '우수', bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300', bar: 'bg-emerald-500', ring: 'ring-emerald-200' }
  if (score >= 70) return { label: '양호', bg: 'bg-sky-100',     text: 'text-sky-700',     border: 'border-sky-300',     bar: 'bg-sky-500',     ring: 'ring-sky-200'     }
  if (score >= 55) return { label: '주의', bg: 'bg-amber-100',   text: 'text-amber-700',   border: 'border-amber-300',   bar: 'bg-amber-500',   ring: 'ring-amber-200'   }
  return              { label: '위험', bg: 'bg-rose-100',   text: 'text-rose-700',   border: 'border-rose-300',   bar: 'bg-rose-500',    ring: 'ring-rose-200'    }
}

// ── 도넛 차트 (SVG) ──────────────────────────────────────────────────────
const CHART_COLORS = ['#0ea5e9','#10b981','#f59e0b','#ef4444','#8b5cf6','#f97316','#06b6d4','#ec4899','#84cc16','#6366f1']

function DonutChart({ data, size = 160 }) {
  const entries = Object.entries(data || {})
  const total   = entries.reduce((s, [, v]) => s + v, 0)
  if (!entries.length || !total) return null

  const cx = size / 2, cy = size / 2, r = size * 0.38, inner = r * 0.58
  let cumAngle = -Math.PI / 2
  const slices = entries.map(([label, value], i) => {
    const angle = (value / total) * 2 * Math.PI
    const x1 = cx + r * Math.cos(cumAngle), y1 = cy + r * Math.sin(cumAngle)
    cumAngle += angle
    const x2 = cx + r * Math.cos(cumAngle), y2 = cy + r * Math.sin(cumAngle)
    const largeArc = angle > Math.PI ? 1 : 0
    const ix1 = cx + inner * Math.cos(cumAngle - angle), iy1 = cy + inner * Math.sin(cumAngle - angle)
    const ix2 = cx + inner * Math.cos(cumAngle), iy2 = cy + inner * Math.sin(cumAngle)
    return {
      label, value, color: CHART_COLORS[i % CHART_COLORS.length], pct: Math.round((value / total) * 100),
      d: [`M ${x1} ${y1}`, `A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`, `L ${ix2} ${iy2}`, `A ${inner} ${inner} 0 ${largeArc} 0 ${ix1} ${iy1}`, 'Z'].join(' '),
    }
  })

  return (
    <div className="flex flex-col items-center gap-3">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {slices.map((s, i) => <path key={i} d={s.d} fill={s.color} />)}
        <text x={cx} y={cy - 7} textAnchor="middle" fill="#0f172a" fontSize="20" fontWeight="800">{total}</text>
        <text x={cx} y={cy + 11} textAnchor="middle" fill="#64748b" fontSize="11">업무</text>
      </svg>
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5">
        {slices.map((s, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
            <span className="font-medium">{s.label}</span>
            <span className="text-slate-400">{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── 상태 뱃지 ─────────────────────────────────────────────────────────────
function StatusBadge({ status, isDelayed }) {
  if (isDelayed || status === 'BLOCKED') {
    return <span className="inline-flex items-center rounded-md bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-600 ring-1 ring-rose-200">
      {isDelayed ? '⏱ 지연' : '🚧 막힘'}
    </span>
  }
  if (status === 'DONE')        return <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600 ring-1 ring-emerald-200">완료</span>
  if (status === 'IN_PROGRESS') return <span className="inline-flex items-center rounded-md bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-600 ring-1 ring-sky-200">진행</span>
  if (status === 'REVIEW')      return <span className="inline-flex items-center rounded-md bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-600 ring-1 ring-violet-200">검토</span>
  return <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500 ring-1 ring-slate-200">{status}</span>
}

// ── AI 분석 카드 ──────────────────────────────────────────────────────────
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
    } catch (e) { alert('피드백 저장 실패: ' + (e?.response?.data?.message || e.message)) }
    finally { setSaving(false) }
  }

  const sections = [
    { icon: '✅', label: '강점',      key: 'strengths',    bg: 'bg-emerald-50',  border: 'border-emerald-200', title: 'text-emerald-700' },
    { icon: '⚠️', label: '약점',      key: 'weaknesses',   bg: 'bg-amber-50',    border: 'border-amber-200',   title: 'text-amber-700'   },
    { icon: '🔴', label: '문제점',    key: 'issues',       bg: 'bg-rose-50',     border: 'border-rose-200',    title: 'text-rose-700'    },
    { icon: '💡', label: '개선 방향', key: 'improvements', bg: 'bg-sky-50',      border: 'border-sky-200',     title: 'text-sky-700'     },
  ]

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-slate-100 bg-slate-50 px-5 py-3 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500">
          분석일시: {analysis.analyzed_at ? new Date(analysis.analyzed_at).toLocaleString('ko-KR') : '-'}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4">
        {sections.map(({ icon, label, key, bg, border, title }) => (
          <div key={key} className={`rounded-xl border ${border} ${bg} p-3.5`}>
            <div className={`text-xs font-bold mb-1.5 ${title}`}>{icon} {label}</div>
            <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">{analysis[key] || '데이터 없음'}</p>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-100 bg-slate-50 px-5 py-4">
        <div className="text-xs font-bold text-slate-600 mb-2">📝 대표 피드백</div>
        {editing ? (
          <div className="space-y-2">
            <textarea
              className="w-full rounded-xl border border-slate-300 bg-white text-xs text-slate-800 p-3 resize-none focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-400"
              rows={3}
              placeholder="직원에 대한 피드백을 입력하세요..."
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
            />
            <div className="flex gap-2">
              <button onClick={handleSave} disabled={saving}
                className="rounded-lg bg-sky-600 hover:bg-sky-700 px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50 transition-colors">
                {saving ? '저장 중...' : '저장'}
              </button>
              {analysis.ceo_feedback && (
                <button onClick={() => { setFeedback(analysis.ceo_feedback); setEditing(false) }}
                  className="rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-4 py-1.5 text-xs font-medium text-slate-600 transition-colors">
                  취소
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-3">
            <p className="text-xs text-slate-700 whitespace-pre-line flex-1 leading-relaxed">{analysis.ceo_feedback}</p>
            <button onClick={() => setEditing(true)}
              className="flex-shrink-0 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-3 py-1 text-[10px] font-medium text-slate-500 transition-colors">
              수정
            </button>
          </div>
        )}
        {analysis.feedback_by && (
          <p className="text-[10px] text-slate-400 mt-1.5">
            ✍️ {analysis.feedback_by} · {analysis.feedback_at ? new Date(analysis.feedback_at).toLocaleString('ko-KR') : ''}
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
  const [tab,       setTab]       = useState('tasks')
  const g = gradeInfo(employee.score)

  const loadDetail = useCallback(async () => {
    try { const r = await getEmployeeDetail(employee.username); setDetail(r.data) }
    catch (e) { console.error(e) }
  }, [employee.username])

  const loadAnalyses = useCallback(async () => {
    try { const r = await getEmployeeAnalysisHistory(employee.username); setAnalyses(r.data || []) }
    catch (e) { console.error(e) }
  }, [employee.username])

  useEffect(() => { loadDetail(); loadAnalyses() }, [loadDetail, loadAnalyses])

  const handleAnalyze = async () => {
    setAnalyzing(true)
    try {
      await analyzeEmployee(employee.username, employee.displayName)
      await loadAnalyses()
      setTab('ai')
    } catch (e) { alert('AI 분석 실패: ' + (e?.response?.data?.message || e.message)) }
    finally { setAnalyzing(false) }
  }

  const tasks   = detail?.tasks   || []
  const reports = detail?.reports || []
  const catData = detail?.categoryBreakdown || {}
  const stats   = detail?.stats || {}

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end"
         style={{ background: 'rgba(15,23,42,0.4)' }}
         onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="relative h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl flex flex-col">

        {/* 헤더 */}
        <div className={`sticky top-0 z-10 border-b border-slate-200 bg-white px-6 py-4 `}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-black ${g.bg} ${g.text}`}>
                {employee.displayName.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-black text-slate-900">{employee.displayName}</h2>
                  <span className={`rounded-full border ${g.border} ${g.bg} ${g.text} px-2.5 py-0.5 text-[11px] font-black`}>{g.label}</span>
                </div>
                <p className="text-xs text-slate-500">{employee.department} · {employee.positionName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleAnalyze} disabled={analyzing}
                className="flex items-center gap-1.5 rounded-xl bg-violet-600 hover:bg-violet-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50 shadow-sm transition-colors">
                {analyzing ? <><span className="animate-spin inline-block">⟳</span> 분석 중...</> : <>✨ AI 분석</>}
              </button>
              <button onClick={onClose}
                className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 p-2 text-slate-500 transition-colors">
                ✕
              </button>
            </div>
          </div>
        </div>

        {/* 통계 4칸 */}
        <div className="grid grid-cols-4 gap-2 px-6 pt-5">
          {[
            { label: '전체 업무', value: stats.total  ?? 0, color: 'text-slate-900', sub: 'text-slate-500', bg: 'bg-slate-50',    border: 'border-slate-200'   },
            { label: '진행 중',   value: stats.active ?? 0, color: 'text-sky-700',   sub: 'text-sky-500',   bg: 'bg-sky-50',      border: 'border-sky-200'     },
            { label: '지연',      value: stats.delayed ?? 0, color: stats.delayed > 0 ? 'text-rose-700' : 'text-slate-400', sub: 'text-rose-400', bg: stats.delayed > 0 ? 'bg-rose-50' : 'bg-slate-50', border: stats.delayed > 0 ? 'border-rose-200' : 'border-slate-200' },
            { label: '막힘',      value: stats.blocked ?? 0, color: stats.blocked > 0 ? 'text-rose-700' : 'text-slate-400', sub: 'text-rose-400', bg: stats.blocked > 0 ? 'bg-rose-50' : 'bg-slate-50', border: stats.blocked > 0 ? 'border-rose-200' : 'border-slate-200' },
          ].map(({ label, value, color, bg, border }) => (
            <div key={label} className={`rounded-xl border ${border} ${bg} p-3 text-center`}>
              <div className={`text-2xl font-black ${color}`}>{value}</div>
              <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">{label}</div>
            </div>
          ))}
        </div>

        {/* 탭 */}
        <div className="flex gap-0 px-6 pt-4 border-b border-slate-200 mt-2">
          {[
            { id: 'tasks',   label: `업무 현황 (${tasks.length})` },
            { id: 'reports', label: `업무보고 (${reports.length})` },
            { id: 'ai',      label: `AI 분석 (${analyses.length})` },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`pb-3 px-4 text-xs font-bold transition-colors border-b-2 -mb-px ${
                tab === t.id ? 'border-violet-500 text-violet-700' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* 콘텐츠 */}
        <div className="flex-1 px-6 py-5 space-y-4">

          {/* 업무 현황 */}
          {tab === 'tasks' && (
            <>
              {Object.keys(catData).length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
                  <div className="text-xs font-bold text-slate-600 mb-4">업무 카테고리 분포</div>
                  <DonutChart data={catData} size={160} />
                </div>
              )}
              <div className="space-y-2">
                {tasks.length === 0 && <p className="text-center text-sm text-slate-400 py-8">업무 데이터가 없습니다.</p>}
                {tasks.map(task => (
                  <div key={task.id} className={`rounded-xl border p-3.5 transition-colors ${
                    task.is_delayed || task.status === 'BLOCKED'
                      ? 'border-rose-200 bg-rose-50/60'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap mb-1">
                          <StatusBadge status={task.status} isDelayed={task.is_delayed} />
                          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">{task.work_category}</span>
                        </div>
                        <p className="text-xs font-bold text-slate-800 truncate">{task.task_name}</p>
                        <p className="text-[10px] text-slate-500 truncate">{task.project_name}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-sm font-black text-slate-700">{task.progress_rate}%</div>
                        {task.due_date && <div className="text-[10px] text-slate-400">~{task.due_date}</div>}
                      </div>
                    </div>
                    <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full rounded-full transition-all ${
                        task.is_delayed ? 'bg-rose-500' : task.status === 'DONE' ? 'bg-emerald-500' : 'bg-sky-500'
                      }`} style={{ width: `${Math.max(2, Math.min(100, task.progress_rate))}%` }} />
                    </div>
                    {task.blocker_text && (
                      <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-rose-50 border border-rose-200 px-2.5 py-1.5">
                        <span className="text-rose-500 text-xs">🚧</span>
                        <p className="text-[10px] text-rose-700 leading-relaxed">{task.blocker_text}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* 업무보고 */}
          {tab === 'reports' && (
            <div className="space-y-2">
              {reports.length === 0 && <p className="text-center text-sm text-slate-400 py-8">업무보고 내역이 없습니다.</p>}
              {reports.map(r => (
                <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-800">{r.title}</span>
                    <span className="text-[10px] text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">{r.report_date}</span>
                  </div>
                  {r.completed_work && <p className="text-[11px] text-slate-600 leading-relaxed"><span className="font-bold text-emerald-600">완료 </span>{r.completed_work}</p>}
                  {r.planned_work   && <p className="text-[11px] text-slate-600 leading-relaxed mt-1"><span className="font-bold text-sky-600">계획 </span>{r.planned_work}</p>}
                  {r.blockers       && <p className="text-[11px] text-rose-600 leading-relaxed mt-1"><span className="font-bold">블로커 </span>{r.blockers}</p>}
                </div>
              ))}
            </div>
          )}

          {/* AI 분석 */}
          {tab === 'ai' && (
            <div className="space-y-4">
              {analyses.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-center py-12 space-y-2">
                  <div className="text-4xl">✨</div>
                  <p className="text-sm font-semibold text-slate-600">아직 AI 분석이 없습니다</p>
                  <p className="text-xs text-slate-400">상단의 "AI 분석" 버튼을 클릭하세요</p>
                </div>
              ) : analyses.map(a => (
                <AiAnalysisCard key={a.id} analysis={a} onFeedbackSaved={loadAnalyses} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── 메인 페이지 ──────────────────────────────────────────────────────────
export default function EmployeePerformancePage() {
  const [users,      setUsers]      = useState([])
  const [tasks,      setTasks]      = useState([])
  const [selected,   setSelected]   = useState('전체')
  const [detailUser, setDetailUser] = useState(null)

  useEffect(() => {
    Promise.all([getUsers(), getExecutiveWorkTasks()]).then(([u, t]) => {
      setUsers(u.data || [])
      setTasks(t.data || [])
    })
  }, [])

  const employeeRows = useMemo(() => {
    const grouped = new Map()
    users.filter(u => ['EMPLOYEE', 'MANAGER'].includes(u.role)).forEach(user => {
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
      const un  = task.assignee_name || '미지정'
      const row = grouped.get(un) || {
        username: un, displayName: un, department: task.department || '-',
        positionName: '-', role: 'EMPLOYEE',
        total: 0, active: 0, done: 0, delayed: 0, blocked: 0, review: 0,
        progressSum: 0, categories: new Map(),
      }
      row.total += 1
      row.progressSum += taskProgress(task)
      if (task.status === 'DONE') row.done += 1; else row.active += 1
      if (isTaskDelayed(task))   row.delayed += 1
      if (task.status === 'BLOCKED') row.blocked += 1
      if (task.status === 'REVIEW' || task.approval_required) row.review += 1
      const cat = task.work_category || '기타'
      row.categories.set(cat, (row.categories.get(cat) || 0) + 1)
      grouped.set(un, row)
    })

    return Array.from(grouped.values()).map(row => {
      const topCategory    = Array.from(row.categories.entries()).sort((a, b) => b[1] - a[1])[0]?.[0]
      const avgProgress    = row.total > 0 ? Math.round(row.progressSum / row.total) : 0
      const completionRate = row.total > 0 ? Math.round((row.done / row.total) * 100) : 0
      const r = { ...row, topCategory, avgProgress, completionRate }
      return { ...r, score: scoreEmployee(r) }
    }).sort((a, b) => b.score - a.score)
  }, [users, tasks])

  const departments = useMemo(() => ['전체', ...new Set(employeeRows.map(r => r.department).filter(d => d && d !== '-'))], [employeeRows])
  const filtered    = useMemo(() => selected === '전체' ? employeeRows : employeeRows.filter(r => r.department === selected), [employeeRows, selected])

  return (
    <div>
      {/* 페이지 헤더 */}
      <div className="mb-6">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-sky-600">Naeil Business Platform</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">직원 성과 분석</h1>
        <p className="mt-1.5 text-sm text-slate-500">직원 카드를 클릭하면 업무 현황 상세 · AI 분석 · 대표 피드백을 확인할 수 있습니다.</p>
      </div>

      {/* 부서 필터 */}
      <div className="flex flex-wrap gap-2 mb-6">
        {departments.map(dept => (
          <button key={dept} onClick={() => setSelected(dept)}
            className={`rounded-full border px-4 py-1.5 text-xs font-bold transition-all shadow-sm ${
              selected === dept
                ? 'border-violet-400 bg-violet-600 text-white shadow-violet-200'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
            }`}>
            {dept}
          </button>
        ))}
      </div>

      {/* 직원 카드 그리드 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map(row => {
          const g = gradeInfo(row.score)
          return (
            <button key={row.username} onClick={() => setDetailUser(row)} type="button"
              className="group rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm hover:shadow-md hover:border-violet-300 hover:-translate-y-0.5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-violet-300">

              {/* 상단: 이름 + 점수 */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-xl text-sm font-black ${g.bg} ${g.text}`}>
                    {row.displayName.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-black text-slate-900 truncate">{row.displayName}</span>
                      <span className={`flex-shrink-0 rounded-full border ${g.border} ${g.bg} ${g.text} px-2 py-0.5 text-[10px] font-black`}>{g.label}</span>
                    </div>
                    <p className="text-[10px] text-slate-500 truncate">{row.department} · {row.positionName}</p>
                  </div>
                </div>
                <div className="flex-shrink-0 text-right ml-2">
                  <div className="text-2xl font-black text-slate-900">{row.score}</div>
                  <div className="text-[9px] text-slate-400 -mt-0.5">성과점수</div>
                </div>
              </div>

              {/* 진행률 바 */}
              <div className="mb-3.5">
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="text-slate-500 font-medium">평균 진행률</span>
                  <span className="font-bold text-slate-700">{row.avgProgress}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full transition-all ${g.bar}`}
                    style={{ width: `${Math.max(2, row.avgProgress)}%` }} />
                </div>
              </div>

              {/* 통계 4칸 */}
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { label: '전체', value: row.total,   color: 'text-slate-700', bg: 'bg-slate-50' },
                  { label: '진행', value: row.active,  color: 'text-sky-700',   bg: 'bg-sky-50'   },
                  { label: '완료', value: row.done,    color: 'text-emerald-700', bg: 'bg-emerald-50' },
                  { label: '지연', value: row.delayed, color: row.delayed > 0 ? 'text-rose-700' : 'text-slate-400', bg: row.delayed > 0 ? 'bg-rose-50' : 'bg-slate-50' },
                ].map(({ label, value, color, bg }) => (
                  <div key={label} className={`rounded-lg ${bg} py-2 text-center`}>
                    <div className={`text-sm font-black ${color}`}>{value}</div>
                    <div className="text-[9px] text-slate-400 mt-0.5">{label}</div>
                  </div>
                ))}
              </div>

              {/* 경고 태그 */}
              {(row.delayed > 0 || row.blocked > 0) && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {row.delayed > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 border border-rose-200 px-2 py-0.5 text-[10px] font-bold text-rose-600">
                      ⏱ 지연 {row.delayed}건
                    </span>
                  )}
                  {row.blocked > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 border border-orange-200 px-2 py-0.5 text-[10px] font-bold text-orange-600">
                      🚧 막힘 {row.blocked}건
                    </span>
                  )}
                </div>
              )}

              {/* 하단 힌트 */}
              <p className="mt-3 text-[10px] text-slate-400 group-hover:text-violet-500 transition-colors text-right font-medium">
                클릭하여 상세 보기 →
              </p>
            </button>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-center py-16">
          <p className="text-slate-400 text-sm">해당 조건의 직원이 없습니다.</p>
        </div>
      )}

      {/* 직원 상세 슬라이드 패널 */}
      {detailUser && (
        <EmployeeDetailPanel employee={detailUser} onClose={() => setDetailUser(null)} />
      )}
    </div>
  )
}
