import { useState } from 'react'
import { approveAgentActivity, handleAgentActivity, rejectAgentActivity } from '../api/agentActivityApi'

// 에이전트가 올린 승인 요청 카드. detail은 '## 제목' 줄로 구역을 나눠 쓰면
// (무엇을 결정하나요 / 받은 메일 / 보낼 답장 / 승인하면 / 반려하면) 구역별로 보여 준다.
const SECTION_TONE = {
  '무엇을 결정하나요': { bg: '#FEF3C7', fg: '#92400E' },
  '육하원칙 요약': { bg: '#E0E7FF', fg: '#3730A3' },
  '받은 메일': { bg: '#E0E7FF', fg: '#3730A3' },
  '우리 입장': { bg: '#DBEAFE', fg: '#1E40AF' },
  '상대 입장': { bg: '#F3E8FF', fg: '#6B21A8' },
  'AI 판단': { bg: '#CCFBF1', fg: '#115E59' },
  'AI 추천': { bg: '#CCFBF1', fg: '#115E59' },
  '보낼 답장': { bg: '#F3F4F6', fg: '#111827' },
  '승인하면': { bg: '#D1FAE5', fg: '#065F46' },
  '반려하면': { bg: '#FEE2E2', fg: '#991B1B' },
  '직접 처리하면': { bg: '#E0F2FE', fg: '#075985' },
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

export default function AgentApprovalCard({ item, onDecided }) {
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

  // 앱의 라이트/다크 테마 덮어쓰기(.app-light .text-slate-* !important)에 영향받지 않도록 색은 인라인 스타일로 고정한다
  const C = {
    card: { background: '#FFFBEB', border: '1px solid #FCD34D', color: '#111827' },
    meta: { color: '#B45309' },
    section: { background: '#FFFFFF', border: '1px solid #E5E7EB', color: '#1F2937' },
    muted: { color: '#4B5563' },
    input: { background: '#FFFFFF', border: '1px solid #D1D5DB', color: '#111827' },
  }
  const pill = (title) => {
    const tone = SECTION_TONE[title] || { bg: '#F3F4F6', fg: '#374151' }
    return { background: tone.bg, color: tone.fg }
  }
  const btn = {
    reject: { background: '#FFFFFF', border: '1px solid #FCA5A5', color: '#B91C1C' },
    handle: { background: '#FFFFFF', border: '1px solid #7DD3FC', color: '#0369A1' },
    approve: { background: '#059669', border: '1px solid #059669', color: '#FFFFFF' },
    yes: { approve: '#059669', reject: '#DC2626', handle: '#0284C7' },
    cancel: { background: '#FFFFFF', border: '1px solid #D1D5DB', color: '#374151' },
  }

  return (
    <div className="rounded-2xl p-4" style={C.card}>
      <p className="text-[11px] font-black" style={C.meta}>결정 필요 · {item.agent_name} · {ago(item.created_at)}</p>
      <p className="mt-1 break-words text-[15px] font-black" style={{ color: '#111827' }}>{item.title}</p>

      {sections.length === 0 ? (
        <p className="mt-2 text-[13px]" style={C.muted}>상세 내용이 없습니다. 에이전트에게 내용을 다시 올려 달라고 요청하세요.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {sections.map((s, i) => (
            <div key={i} className="rounded-xl px-3 py-2.5" style={C.section}>
              {s.title && (
                <span className="mb-1.5 inline-block rounded-md px-2 py-0.5 text-[12px] font-black" style={pill(s.title)}>{s.title}</span>
              )}
              <p className="max-h-72 overflow-y-auto whitespace-pre-wrap text-[13.5px] leading-6"
                style={{ color: '#1F2937', fontWeight: s.title === '무엇을 결정하나요' ? 700 : 400 }}>{s.body}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="메모 (선택) — 반려 이유·수정 요청 또는 직접 처리 담당자"
          className="h-10 min-w-0 flex-1 rounded-lg px-3 text-[13px] outline-none" style={C.input} />
        {confirming ? (
          <>
            <span className="text-[13px] font-bold" style={{ color: '#92400E' }}>{ACTIONS[confirming].ask}</span>
            <button type="button" disabled={busy} onClick={() => decide(confirming)}
              className="h-10 rounded-lg px-4 text-[13px] font-black" style={{ background: btn.yes[confirming], color: '#FFFFFF' }}>
              예
            </button>
            <button type="button" disabled={busy} onClick={() => setConfirming(null)}
              className="h-10 rounded-lg px-3 text-[13px] font-black" style={btn.cancel}>
              취소
            </button>
          </>
        ) : (
          <>
            <button type="button" disabled={busy} onClick={() => setConfirming('reject')}
              className="h-10 rounded-lg px-4 text-[13px] font-black" style={btn.reject}>반려</button>
            <button type="button" disabled={busy} onClick={() => setConfirming('handle')}
              className="h-10 rounded-lg px-4 text-[13px] font-black" style={btn.handle}>직접 처리</button>
            <button type="button" disabled={busy} onClick={() => setConfirming('approve')}
              className="h-10 rounded-lg px-5 text-[13px] font-black" style={btn.approve}>승인</button>
          </>
        )}
      </div>
      <div className="mt-2 grid gap-1 text-[12px] sm:grid-cols-3" style={C.muted}>
        <p><b style={{ color: '#047857' }}>승인</b> · AI가 카드 내용대로 실행</p>
        <p><b style={{ color: '#B91C1C' }}>반려</b> · 실행 안 함(메모로 수정 요청)</p>
        <p><b style={{ color: '#0369A1' }}>직접 처리</b> · 담당자가 맡고 AI는 손 뗌</p>
      </div>
      <p className="mt-1 text-[11.5px]" style={C.muted}>누가 언제 어떤 버튼을 눌렀는지 기록이 남습니다.</p>
      {error && <p className="mt-2 text-[12.5px] font-bold" style={{ color: '#DC2626' }}>{error}</p>}
    </div>
  )
}