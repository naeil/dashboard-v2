import { useCallback, useEffect, useState } from 'react'
import { approveAgentActivity, getAgentOverview, rejectAgentActivity } from '../../api/agentActivityApi'

const REFRESH_MS = 10000

const KIND_LABEL = { TASK: '작업', APPROVAL: '승인 요청', ALERT: '알림', REPORT: '보고' }
const STATUS_STYLE = {
  RUNNING: { label: '진행 중', cls: 'bg-sky-50 text-sky-700' },
  DONE: { label: '완료', cls: 'bg-emerald-50 text-emerald-700' },
  FAILED: { label: '실패', cls: 'bg-rose-50 text-rose-700' },
  PENDING_APPROVAL: { label: '승인 대기', cls: 'bg-amber-50 text-amber-700' },
  APPROVED: { label: '승인됨', cls: 'bg-emerald-50 text-emerald-700' },
  REJECTED: { label: '반려됨', cls: 'bg-slate-100 text-slate-600' },
}

const ago = (value) => {
  if (!value) return '-'
  const sec = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000))
  if (sec < 60) return `${sec}초 전`
  if (sec < 3600) return `${Math.floor(sec / 60)}분 전`
  if (sec < 86400) return `${Math.floor(sec / 3600)}시간 전`
  return `${Math.floor(sec / 86400)}일 전`
}

function StatusBadge({ status }) {
  const s = STATUS_STYLE[status] || { label: status, cls: 'bg-slate-100 text-slate-600' }
  return <span className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-black ${s.cls}`}>{s.label}</span>
}

function Stat({ label, value, tone = 'text-slate-900' }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-[12px] font-bold text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-black ${tone}`}>{value}</p>
    </div>
  )
}

function ActivityRow({ item }) {
  return (
    <div className="flex items-start gap-3 border-b border-slate-100 px-1 py-2.5 last:border-b-0">
      <StatusBadge status={item.status} />
      <div className="min-w-0 flex-1">
        <p className="break-words text-[13px] font-bold text-slate-800">
          {item.kind === 'ALERT' && <span className="material-symbols-outlined mr-1 align-[-3px] text-[15px] text-rose-500">warning</span>}
          {item.title}
        </p>
        {(item.result || item.detail) && (
          <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap text-[12px] text-slate-500">{item.result || item.detail}</p>
        )}
        {item.decided_by && (
          <p className="mt-0.5 text-[11px] text-slate-400">
            {item.decided_by} · {ago(item.decided_at)}{item.decision_comment ? ` · "${item.decision_comment}"` : ''}
          </p>
        )}
      </div>
      <div className="shrink-0 text-right">
        <p className="text-[11px] font-bold text-slate-400">{item.agent_name}</p>
        <p className="text-[11px] text-slate-400">{ago(item.updated_at)}</p>
      </div>
    </div>
  )
}

function PendingCard({ item, canDecide, onDecided }) {
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const decide = async (approve) => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await (approve ? approveAgentActivity : rejectAgentActivity)(item.id, comment.trim() || undefined)
      onDecided()
    } catch (e) {
      setError(e?.response?.data?.message || '처리하지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-black text-amber-700">{KIND_LABEL[item.kind] || item.kind} · {item.agent_name} · {ago(item.created_at)}</p>
          <p className="mt-1 break-words text-[14px] font-black text-slate-900">{item.title}</p>
        </div>
        {item.link_url && (
          <a href={item.link_url} target="_blank" rel="noreferrer"
            className="shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-black text-slate-600 hover:text-sky-600">
            자세히
          </a>
        )}
      </div>
      {item.detail && (
        <p className="mt-2 max-h-60 overflow-y-auto whitespace-pre-wrap rounded-lg bg-white px-3 py-2 text-[12.5px] leading-5 text-slate-700">{item.detail}</p>
      )}
      {canDecide ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="메모 (선택)"
            className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-[12.5px] outline-none focus:border-sky-400" />
          <button type="button" disabled={busy} onClick={() => decide(false)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[12.5px] font-black text-slate-600 hover:text-rose-600">
            반려
          </button>
          <button type="button" disabled={busy} onClick={() => decide(true)}
            className="h-9 rounded-lg bg-slate-900 px-4 text-[12.5px] font-black text-white hover:bg-slate-700">
            승인
          </button>
        </div>
      ) : (
        <p className="mt-3 text-[12px] text-slate-500">승인은 매니저 이상만 할 수 있습니다.</p>
      )}
      {error && <p className="mt-2 text-[12px] font-bold text-rose-600">{error}</p>}
    </div>
  )
}

export default function AgentActivityPage({ role }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [lastLoaded, setLastLoaded] = useState(null)
  const [, setTick] = useState(0)
  const canDecide = role === 'EXECUTIVE' || role === 'MANAGER'

  const load = useCallback(async () => {
    try {
      setData(await getAgentOverview(50))
      setLastLoaded(new Date())
      setError('')
    } catch (e) {
      setError(e?.response?.data?.message || '에이전트 현황을 불러오지 못했습니다.')
    }
  }, [])

  useEffect(() => {
    load()
    const refresh = setInterval(load, REFRESH_MS)
    const clock = setInterval(() => setTick((t) => t + 1), 1000)
    return () => { clearInterval(refresh); clearInterval(clock) }
  }, [load])

  const agents = data?.agents || []
  const pending = data?.pending || []
  const running = data?.running || []
  const recent = data?.recent || []
  const counts = data?.todayCounts || {}

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900">AI 에이전트 활동</h1>
          <p className="mt-1 text-[12.5px] text-slate-500">회사 PC에서 24시간 일하는 에이전트가 지금 무엇을 하는지, 무엇을 승인받아야 하는지 보여 줍니다.</p>
        </div>
        <p className="text-[11px] font-bold text-slate-400">
          10초마다 자동 갱신 · 마지막 갱신 {lastLoaded ? ago(lastLoaded) : '-'}
        </p>
      </div>

      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] font-bold text-rose-700">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {agents.length === 0 && data && (
          <p className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-[12.5px] text-slate-500">
            아직 연결된 에이전트가 없습니다. 에이전트가 처음 신호를 보내면 여기에 표시됩니다.
          </p>
        )}
        {agents.map((a) => (
          <div key={a.agent_name} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
            <span className={`h-2.5 w-2.5 rounded-full ${a.online ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            <div>
              <p className="text-[12.5px] font-black text-slate-800">{a.agent_name} <span className={`font-bold ${a.online ? 'text-emerald-600' : 'text-rose-600'}`}>{a.online ? '정상' : '응답 없음'}</span></p>
              <p className="text-[11px] text-slate-500">{a.status_text || '대기 중'} · 마지막 신호 {ago(a.last_seen_at)}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="승인 대기" value={pending.length} tone={pending.length ? 'text-amber-600' : 'text-slate-900'} />
        <Stat label="진행 중" value={running.length} tone="text-sky-600" />
        <Stat label="오늘 완료" value={counts.done ?? 0} />
        <Stat label="오늘 실패 · 알림" value={`${counts.failed ?? 0} · ${counts.alerts ?? 0}`} tone={(counts.failed || counts.alerts) ? 'text-rose-600' : 'text-slate-900'} />
      </div>

      {pending.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-[14px] font-black text-slate-800">승인이 필요한 일 ({pending.length})</h2>
          {pending.map((item) => <PendingCard key={item.id} item={item} canDecide={canDecide} onDecided={load} />)}
        </section>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-1 text-[14px] font-black text-slate-800">지금 하고 있는 일</h2>
        {running.length === 0
          ? <p className="py-2 text-[12.5px] text-slate-400">진행 중인 작업이 없습니다.</p>
          : running.map((item) => <ActivityRow key={item.id} item={item} />)}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-1 text-[14px] font-black text-slate-800">최근 활동</h2>
        {recent.length === 0
          ? <p className="py-2 text-[12.5px] text-slate-400">아직 기록이 없습니다.</p>
          : recent.map((item) => <ActivityRow key={item.id} item={item} />)}
      </section>
    </div>
  )
}
