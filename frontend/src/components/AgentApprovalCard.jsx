import { useState } from 'react'
import { approveAgentActivity, handleAgentActivity, rejectAgentActivity } from '../api/agentActivityApi'

// 에이전트가 올린 승인 요청 카드. detail은 '## 제목' 줄로 구역을 나눠 쓰면
// (무엇을 결정하나요 / 받은 메일 / 보낼 답장 / 승인하면 / 반려하면) 구역별로 보여 준다.
const SECTION_STYLE = {
  '무엇을 결정하나요': 'font-bold',
  '보낼 답장': 'font-mono text-[12px]',
  '승인하면': 'text-emerald-600',
  '반려하면': 'text-rose-600',
}

export function parseSections(detail = '') {
  const parts = []
  let current = null
  for (const line of String(detail).split(/\r?\n/)) {
    const m = /^##\s+(.+)$/.exec(line.trim())
    if (m) {
      current = { title: m[1].trim(), lines: [] }
      parts.push(current)
    } else if (current) {
      current.lines.push(line)
    } else {
      if (!parts.length || parts[0].title) parts.unshift({ title: '', lines: [] })
      parts[0].lines.push(line)
    }
  }
  return parts.map((p) => ({ title: p.title, body: p.lines.join('\n').trim() })).filter((p) => p.title || p.body)
}

const ago = (value) => {
  if (!value) return '-'
  const sec = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000))
  if (sec < 60) return `${sec}초 전`
  if (sec < 3600) return `${Math.floor(sec / 60)}분 전`
  if (sec < 86400) return `${Math.floor(sec / 3600)}시간 전`
  return `${Math.floor(sec / 86400)}일 전`
}

export default function AgentApprovalCard({ item, onDecided, dark = false }) {
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(null)
  const sections = parseSections(item.detail)

  // approve: AI가 그대로 실행 / reject: 실행하지 않음 / handle: 담당자가 직접 처리(AI는 손 뗌)
  const ACTIONS = {
    approve: { fn: approveAgentActivity, ask: '승인하면 AI가 그대로 실행합니다. 진행할까요?', cls: 'bg-emerald-600 hover:bg-emerald-500' },
    reject: { fn: rejectAgentActivity, ask: '반려하면 실행하지 않습니다. 진행할까요?', cls: 'bg-rose-600 hover:bg-rose-500' },
    handle: { fn: handleAgentActivity, ask: '직접 처리로 넘기면 AI는 이 건을 실행하지 않습니다. 진행할까요?', cls: 'bg-sky-600 hover:bg-sky-500' },
  }

  const decide = async (action) => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await ACTIONS[action].fn(item.id, comment.trim() || undefined)
      onDecided?.()
    } catch (e) {
      setError(e?.response?.data?.message || '처리하지 못했습니다.')
    } finally {
      setBusy(false)
      setConfirming(null)
    }
  }

  const box = dark ? 'border-amber-500/40 bg-amber-500/5 text-slate-100' : 'border-amber-200 bg-amber-50/40 text-slate-900'
  const panel = dark ? 'bg-slate-950/60 text-slate-200' : 'bg-white text-slate-700'
  const muted = dark ? 'text-slate-400' : 'text-slate-500'

  return (
    <div className={`rounded-2xl border p-4 ${box}`}>
      <p className={`text-[11px] font-black ${dark ? 'text-amber-300' : 'text-amber-700'}`}>결정 필요 · {item.agent_name} · {ago(item.created_at)}</p>
      <p className="mt-1 break-words text-[14px] font-black">{item.title}</p>

      {sections.length === 0 ? (
        <p className={`mt-2 text-[12.5px] ${muted}`}>상세 내용이 없습니다. 에이전트에게 내용을 다시 올려 달라고 요청하세요.</p>
      ) : (
        <div className="mt-2 space-y-2">
          {sections.map((s, i) => (
            <div key={i} className={`rounded-lg px-3 py-2 ${panel}`}>
              {s.title && <p className={`mb-1 text-[11px] font-black ${muted}`}>{s.title}</p>}
              <p className={`max-h-64 overflow-y-auto whitespace-pre-wrap text-[12.5px] leading-5 ${SECTION_STYLE[s.title] || ''}`}>{s.body}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="메모 (선택) — 반려 이유·수정 요청 또는 직접 처리 담당자"
          className={`h-9 min-w-0 flex-1 rounded-lg border px-3 text-[12.5px] outline-none ${dark ? 'border-slate-700 bg-slate-900 text-slate-100' : 'border-slate-200 bg-white'}`} />
        {confirming ? (
          <>
            <span className="text-[12px] font-bold text-amber-500">{ACTIONS[confirming].ask}</span>
            <button type="button" disabled={busy} onClick={() => decide(confirming)}
              className={`h-9 rounded-lg px-4 text-[12.5px] font-black text-white ${ACTIONS[confirming].cls}`}>
              예
            </button>
            <button type="button" disabled={busy} onClick={() => setConfirming(null)}
              className={`h-9 rounded-lg border px-3 text-[12.5px] font-black ${dark ? 'border-slate-700 text-slate-300' : 'border-slate-200 text-slate-600'}`}>
              취소
            </button>
          </>
        ) : (
          <>
            <button type="button" disabled={busy} onClick={() => setConfirming('reject')}
              className={`h-9 rounded-lg border px-3 text-[12.5px] font-black ${dark ? 'border-slate-700 text-slate-300 hover:text-rose-400' : 'border-slate-200 bg-white text-slate-600 hover:text-rose-600'}`}>
              반려
            </button>
            <button type="button" disabled={busy} onClick={() => setConfirming('handle')}
              className={`h-9 rounded-lg border px-3 text-[12.5px] font-black ${dark ? 'border-sky-500/50 text-sky-300 hover:bg-sky-500/10' : 'border-sky-200 bg-white text-sky-700 hover:bg-sky-50'}`}>
              직접 처리
            </button>
            <button type="button" disabled={busy} onClick={() => setConfirming('approve')}
              className="h-9 rounded-lg bg-emerald-600 px-4 text-[12.5px] font-black text-white hover:bg-emerald-500">
              승인
            </button>
          </>
        )}
      </div>
      <p className={`mt-2 text-[11px] ${muted}`}>승인 = AI가 그대로 실행 · 반려 = 실행 안 함(메모로 수정 요청) · 직접 처리 = 담당자가 맡고 AI는 손 뗌(메모에 담당자 이름). 누가 언제 결정했는지 기록이 남습니다.</p>
      {error && <p className="mt-2 text-[12px] font-bold text-rose-500">{error}</p>}
    </div>
  )
}
