import { useRef, useState } from 'react'
import { postAiChat } from '../api/aiChatApi'

const EXEC_SUGGESTIONS = ['오늘 매출 어때?', '지연되고 있는 업무 알려줘', '이번 주 직원 보고 요약해줘', '최근 발주 현황 알려줘']
const STAFF_SUGGESTIONS = ['내가 이번 주 할 일 정리해줘', '진행중 업무 뭐가 있어?', '최근 발주 현황 알려줘']

export default function AiAssistantCard({ role = 'EMPLOYEE' }) {
  const isExecutive = role === 'EXECUTIVE'
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const listRef = useRef(null)

  const scrollDown = () => {
    setTimeout(() => {
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
    }, 60)
  }

  const send = async (text) => {
    const q = (text ?? input).trim()
    if (!q || loading) return
    const history = messages.slice(-8).map(({ role: r, content }) => ({ role: r, content }))
    setMessages((prev) => [...prev, { role: 'user', content: q }])
    setInput('')
    setLoading(true)
    scrollDown()
    try {
      const res = await postAiChat(q, history)
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: res?.success ? res.answer : (res?.message || 'AI 응답에 실패했습니다.'),
        error: !res?.success,
      }])
    } catch (e) {
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: e?.response?.data?.message || 'AI 응답에 실패했습니다. 잠시 후 다시 시도해 주세요.',
        error: true,
      }])
    } finally {
      setLoading(false)
      scrollDown()
    }
  }

  const suggestions = isExecutive ? EXEC_SUGGESTIONS : STAFF_SUGGESTIONS

  return (
    <section className="rounded-lg border border-sky-200 bg-gradient-to-r from-sky-50/80 via-white to-indigo-50/60 p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500 text-white">
            <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
          </span>
          <div>
            <p className="text-sm font-black text-slate-900">AI 비서</p>
            <p className="text-[11px] font-bold text-slate-400">
              {isExecutive ? '매출·업무·보고·발주 전체 데이터 기반 (대표 권한)' : '내 업무·열람 가능한 보고 기반 (직원 권한)'}
            </p>
          </div>
        </div>
        {messages.length > 0 && (
          <button type="button" onClick={() => setMessages([])}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-black text-slate-400 hover:text-slate-600">
            대화 지우기
          </button>
        )}
      </div>

      {messages.length > 0 && (
        <div ref={listRef} className="mt-3 max-h-72 space-y-2.5 overflow-y-auto rounded-lg border border-slate-100 bg-white/80 p-3">
          {messages.map((m, i) => (
            m.role === 'user' ? (
              <div key={i} className="flex justify-end">
                <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-sky-500 px-3.5 py-2 text-[13px] font-bold text-white">
                  {m.content}
                </p>
              </div>
            ) : (
              <div key={i} className="flex justify-start">
                <div className={`max-w-[90%] whitespace-pre-wrap rounded-2xl rounded-bl-sm px-3.5 py-2 text-[13px] leading-relaxed ${
                  m.error ? 'bg-rose-50 font-bold text-rose-600' : 'bg-slate-100 text-slate-800'}`}>
                  {m.content}
                </div>
              </div>
            )
          ))}
          {loading && (
            <div className="flex items-center gap-1.5 px-1 text-[12px] font-bold text-slate-400">
              <span className="material-symbols-outlined animate-spin text-[15px]">progress_activity</span>
              데이터 확인 중…
            </div>
          )}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) send() }}
          placeholder={isExecutive ? '예) 이번 달 매출이랑 지연 업무 알려줘' : '예) 내가 이번 주 할 일 정리해줘'}
          className="h-11 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-bold text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
        />
        <button type="button" onClick={() => send()} disabled={loading || !input.trim()}
          className="flex h-11 shrink-0 items-center gap-1 rounded-lg bg-sky-500 px-4 text-sm font-black text-white hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400">
          <span className="material-symbols-outlined text-[18px]">send</span>
          질문
        </button>
      </div>

      {messages.length === 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button key={s} type="button" onClick={() => send(s)} disabled={loading}
              className="rounded-full border border-sky-200 bg-white px-3 py-1.5 text-[12px] font-bold text-sky-700 hover:bg-sky-50 disabled:opacity-50">
              {s}
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
