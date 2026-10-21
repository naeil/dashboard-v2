import { useCallback, useEffect, useRef, useState } from 'react'
import { authApi as api } from '../api/authApi'

// 로그인하자마자: 나에게 온 업무 지시·피드백(업무 보고)과 새로 배정된 업무 중 아직 확인 안 한 것을 띄운다.
// '확인했어요'를 누르면 다시 뜨지 않고, '나중에'는 다음 로그인(또는 새 알림이 올 때) 다시 뜬다. 5분마다 새 알림 확인.
const C = {
  overlay: { background: 'rgba(15, 23, 42, 0.5)' },
  panel: { background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A' },
  soft: { background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#0F172A' },
  muted: { color: '#64748B' },
  primary: { background: '#0284C7', color: '#FFFFFF', border: '1px solid #0284C7' },
  ghost: { background: '#FFFFFF', color: '#334155', border: '1px solid #CBD5E1' },
  tag: { background: '#FEF3C7', color: '#92400E' },
  late: { color: '#DC2626', fontWeight: 800 },
}
const TYPE_LABEL = { REQUEST: '수정 요청', REVISION: '수정 요청', FEEDBACK: '피드백', DIRECTIVE: '업무 지시', AI_DIRECTIVE: 'AI 업무 지시', QUESTION: '질문', PRAISE: '칭찬' }
const today = () => new Date().toISOString().slice(0, 10)

export default function MyNoticeModal({ onNavigate }) {
  const [data, setData] = useState(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const shown = useRef(new Set())

  const load = useCallback(async (first) => {
    try {
      const r = (await api.get('/my-notices')).data
      setData(r)
      const keys = [...(r.feedback || []).map((f) => `F${f.id}`), ...(r.tasks || []).map((t) => `T${t.id}`)]
      const fresh = keys.some((k) => !shown.current.has(k))
      if (keys.length && (first || fresh)) { keys.forEach((k) => shown.current.add(k)); setOpen(true) }
    } catch { /* 알림을 못 불러와도 화면 사용은 막지 않음 */ }
  }, [])

  useEffect(() => {
    load(true)
    const t = setInterval(() => load(false), 5 * 60 * 1000)
    return () => clearInterval(t)
  }, [load])

  if (!open || !data) return null
  const feedback = data.feedback || []
  const tasks = data.tasks || []
  const d = today()

  const confirmAll = async () => {
    setBusy(true)
    try {
      await api.post('/my-notices/seen', { items: [...feedback.map((f) => ({ type: 'FEEDBACK', id: f.id })), ...tasks.map((t) => ({ type: 'TASK', id: t.id }))] })
      setOpen(false)
    } catch { setOpen(false) } finally { setBusy(false) }
  }
  const go = (page) => { setOpen(false); onNavigate?.(page) }

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto p-4" style={C.overlay}>
      <div className="my-10 w-full max-w-2xl rounded-2xl p-5 shadow-2xl" style={C.panel}>
        <h2 className="text-[18px] font-black">나에게 온 요청 {feedback.length + tasks.length}건</h2>
        <p className="mt-1 text-[12.5px]" style={C.muted}>업무 보고에 남겨진 업무 지시·피드백과 새로 배정된 업무입니다. 확인하면 다시 뜨지 않습니다.</p>

        {feedback.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-[13.5px] font-black">업무 지시 · 피드백 ({feedback.length})</p>
            <ul className="space-y-2">
              {feedback.map((f) => (
                <li key={f.id} className="rounded-xl p-3" style={C.soft}>
                  <div className="flex flex-wrap items-center gap-2 text-[11.5px]">
                    <span className="rounded px-1.5 py-0.5 font-black" style={C.tag}>{TYPE_LABEL[String(f.feedback_type || '').toUpperCase()] || f.feedback_type || '피드백'}</span>
                    <span style={C.muted}>{f.author}님 · {f.created_at}</span>
                    {f.due_date && <span style={f.due_date < d ? C.late : C.muted}>마감 {f.due_date}{f.due_date < d ? ' (지남)' : ''}</span>}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-[13.5px] font-bold leading-relaxed">{f.content}</p>
                  {f.report_title && <p className="mt-1 text-[11.5px]" style={C.muted}>업무 보고: {f.report_date} {f.report_title}{f.report_owner ? ` (${f.report_owner})` : ''}</p>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {tasks.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-[13.5px] font-black">새로 배정된 업무 ({tasks.length})</p>
            <ul className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
              {tasks.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-[12.5px]" style={C.soft}>
                  <span className="font-black">#{t.id}</span>
                  <span className="min-w-0 flex-1 font-bold">{t.task_name}</span>
                  <span style={C.muted}>{t.project_name}</span>
                  {t.due_date && <span style={t.due_date < d ? C.late : C.muted}>{t.due_date}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-4 py-2 text-[13px] font-black" style={C.ghost}>나중에</button>
          {feedback.length > 0 && <button type="button" onClick={() => go('staff-work-report')} className="rounded-lg px-4 py-2 text-[13px] font-black" style={C.ghost}>업무 보고로 이동</button>}
          {tasks.length > 0 && <button type="button" onClick={() => go('staff-dashboard')} className="rounded-lg px-4 py-2 text-[13px] font-black" style={C.ghost}>내 업무 보기</button>}
          <button type="button" disabled={busy} onClick={confirmAll} className="rounded-lg px-4 py-2 text-[13px] font-black" style={C.primary}>{busy ? '처리 중…' : '확인했어요'}</button>
        </div>
      </div>
    </div>
  )
}
