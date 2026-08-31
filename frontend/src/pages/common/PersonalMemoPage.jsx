import { useCallback, useEffect, useRef, useState } from 'react'
import { authApi as api } from '../../api/authApi'

const DOW = ['월', '화', '수', '목', '금', '토', '일']

const toDateStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const todayStr = () => toDateStr(new Date())
const mondayOf = (offsetWeeks = 0) => {
  const d = new Date()
  const day = d.getDay() === 0 ? 7 : d.getDay()
  d.setDate(d.getDate() - (day - 1) + offsetWeeks * 7)
  return toDateStr(d)
}
const addDays = (dateStr, n) => {
  const [y, m, d] = dateStr.split('-').map(Number)
  return toDateStr(new Date(y, m - 1, d + n))
}
const hhmm = (t) => (t ? String(t).slice(0, 5) : '')

/* ─────────────── 메모 한 줄 ─────────────── */

function MemoItem({ memo, onToggle, onDelete, onMoveTomorrow }) {
  const timeLabel = memo.start_time ? `${hhmm(memo.start_time)}${memo.end_time ? `–${hhmm(memo.end_time)}` : ''}` : null
  return (
    <div className={`group flex items-start gap-1.5 rounded-lg px-1.5 py-1 hover:bg-slate-50 ${memo.is_done ? 'opacity-50' : ''}`}>
      <button type="button" onClick={() => onToggle(memo)}
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
          memo.is_done ? 'border-emerald-400 bg-emerald-400 text-white' : 'border-slate-300 bg-white hover:border-sky-400'}`}>
        {memo.is_done && <span className="material-symbols-outlined text-[12px]">check</span>}
      </button>
      <div className="min-w-0 flex-1">
        {timeLabel && <p className="text-[10px] font-black text-sky-600">{timeLabel}</p>}
        <p className={`break-words text-[12.5px] leading-4.5 text-slate-800 ${memo.is_done ? 'line-through' : ''}`}>{memo.content}</p>
      </div>
      <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100">
        {!memo.is_done && onMoveTomorrow && (
          <button type="button" title="내일로 미루기" onClick={() => onMoveTomorrow(memo)}
            className="rounded p-0.5 text-slate-300 hover:text-sky-500">
            <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
          </button>
        )}
        <button type="button" title="삭제" onClick={() => onDelete(memo)}
          className="rounded p-0.5 text-slate-300 hover:text-rose-500">
          <span className="material-symbols-outlined text-[14px]">close</span>
        </button>
      </div>
    </div>
  )
}

/* ─────────────── 요일 컬럼 추가 입력 ─────────────── */

function DayAdd({ date, onAdd }) {
  const [text, setText] = useState('')
  const [showTime, setShowTime] = useState(false)
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')

  const submit = () => {
    if (!text.trim()) return
    onAdd({ date, content: text.trim(), startTime: start || null, endTime: end || null })
    setText('')
    setStart('')
    setEnd('')
    setShowTime(false)
  }

  return (
    <div className="mt-1 border-t border-slate-100 pt-1.5">
      <div className="flex items-center gap-1">
        <input value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) submit() }}
          placeholder="+ 할 일 추가"
          className="h-7 min-w-0 flex-1 rounded border border-transparent bg-transparent px-1.5 text-[12px] text-slate-700 placeholder:text-slate-300 hover:border-slate-200 focus:border-sky-400 focus:bg-white focus:outline-none" />
        <button type="button" title="시간 지정" onClick={() => setShowTime((v) => !v)}
          className={`rounded p-0.5 ${showTime ? 'text-sky-500' : 'text-slate-300 hover:text-slate-500'}`}>
          <span className="material-symbols-outlined text-[15px]">schedule</span>
        </button>
      </div>
      {showTime && (
        <div className="mt-1 flex items-center gap-1">
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)}
            className="h-7 min-w-0 flex-1 rounded border border-slate-200 px-1 text-[11px] text-slate-600 focus:border-sky-400 focus:outline-none" />
          <span className="text-[10px] text-slate-400">~</span>
          <input type="time" value={end} onChange={(e) => setEnd(e.target.value)}
            className="h-7 min-w-0 flex-1 rounded border border-slate-200 px-1 text-[11px] text-slate-600 focus:border-sky-400 focus:outline-none" />
        </div>
      )}
    </div>
  )
}

/* ─────────────── 자유 메모장 ─────────────── */

function FreeNote() {
  const [note, setNote] = useState('')
  const [status, setStatus] = useState('')
  const timer = useRef(null)
  const loaded = useRef(false)

  useEffect(() => {
    api.get('/personal-memo/note').then((res) => {
      setNote(res.data?.content || '')
      loaded.current = true
    }).catch(() => { loaded.current = true })
  }, [])

  const onChange = (value) => {
    setNote(value)
    if (!loaded.current) return
    setStatus('저장 중…')
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      api.put('/personal-memo/note', { content: value })
        .then(() => setStatus('저장됨'))
        .catch(() => setStatus('저장 실패 — 네트워크 확인'))
    }, 800)
  }

  return (
    <div className="flex h-full flex-col rounded-xl border border-amber-200 bg-amber-50/40 p-3">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="flex items-center gap-1 text-[13px] font-black text-amber-800">
          <span className="material-symbols-outlined text-[16px]">sticky_note_2</span> 메모장
        </p>
        <span className="text-[10px] font-bold text-amber-500">{status}</span>
      </div>
      <textarea value={note} onChange={(e) => onChange(e.target.value)}
        placeholder="자유롭게 적어두세요 — 자동 저장됩니다. (거래처 연락처, 아이디어, 오늘 통화 내용…)"
        className="min-h-[180px] flex-1 resize-none rounded-lg border border-amber-100 bg-white/70 p-2.5 text-[13px] leading-6 text-slate-800 placeholder:text-amber-300 focus:border-amber-300 focus:outline-none" />
    </div>
  )
}

/* ─────────────── 메인 페이지 ─────────────── */

export default function PersonalMemoPage({ displayName = '' }) {
  const [weekStart, setWeekStart] = useState(mondayOf(0))
  const [memos, setMemos] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback((ws) => {
    setLoading(true)
    api.get('/personal-memo', { params: { from: addDays(ws, -7), to: addDays(ws, 6) } })
      .then((res) => setMemos(res.data || []))
      .catch(() => setMemos([]))
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => {
    const t = setTimeout(() => load(weekStart), 0)
    return () => clearTimeout(t)
  }, [weekStart, load])

  const add = async (payload) => {
    await api.post('/personal-memo', payload).catch(() => {})
    load(weekStart)
  }
  const toggle = async (memo) => {
    await api.put(`/personal-memo/${memo.id}`, { isDone: !memo.is_done }).catch(() => {})
    load(weekStart)
  }
  const remove = async (memo) => {
    await api.delete(`/personal-memo/${memo.id}`).catch(() => {})
    load(weekStart)
  }
  const moveTo = async (memo, date) => {
    await api.put(`/personal-memo/${memo.id}`, { date }).catch(() => {})
    load(weekStart)
  }

  const byDate = memos.reduce((acc, m) => {
    const key = String(m.memo_date).slice(0, 10)
    ;(acc[key] = acc[key] || []).push(m)
    return acc
  }, {})
  const today = todayStr()
  const todayMemos = byDate[today] || []
  const yesterdayUndone = (byDate[addDays(today, -1)] || []).filter((m) => !m.is_done)
  const doneToday = todayMemos.filter((m) => m.is_done).length

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-black text-slate-900">내 업무 메모</h1>
          <p className="mt-0.5 text-[12px] text-slate-400">
            {displayName ? `${displayName}님의 ` : ''}개인 공간입니다 — 본인에게만 보입니다. 아침에 열고, 하나씩 체크하세요.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => setWeekStart(addDays(weekStart, -7))}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:text-slate-700">
            <span className="material-symbols-outlined text-[16px]">chevron_left</span>
          </button>
          <button type="button" onClick={() => setWeekStart(mondayOf(0))}
            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12px] font-black text-slate-500 hover:bg-slate-50">
            이번 주
          </button>
          <button type="button" onClick={() => setWeekStart(addDays(weekStart, 7))}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:text-slate-700">
            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
          </button>
        </div>
      </div>

      {/* 오늘 포커스 + 메모장 */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="rounded-xl border border-sky-200 bg-sky-50/40 p-3.5">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1 text-[13px] font-black text-sky-800">
              <span className="material-symbols-outlined text-[16px]">today</span>
              오늘 할 일 — {today.slice(5).replace('-', '/')} ({DOW[(new Date().getDay() + 6) % 7]})
            </p>
            <span className="text-[11px] font-bold text-sky-500">{doneToday}/{todayMemos.length} 완료</span>
          </div>
          <div className="mt-2 space-y-0.5">
            {todayMemos.length === 0 && (
              <p className="rounded-lg bg-white/60 px-2.5 py-2 text-[12px] font-bold text-slate-400">
                오늘 등록된 할 일이 없습니다. 아래 캘린더의 오늘 칸에서 추가하세요.
              </p>
            )}
            {todayMemos.map((m) => (
              <MemoItem key={m.id} memo={m} onToggle={toggle} onDelete={remove}
                onMoveTomorrow={(memo) => moveTo(memo, addDays(today, 1))} />
            ))}
          </div>
          {yesterdayUndone.length > 0 && (
            <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-black text-amber-700">어제 못 끝낸 일 {yesterdayUndone.length}건</p>
                <button type="button"
                  onClick={async () => { for (const m of yesterdayUndone) await api.put(`/personal-memo/${m.id}`, { date: today }).catch(() => {}); load(weekStart) }}
                  className="rounded bg-amber-500 px-2 py-0.5 text-[11px] font-black text-white hover:bg-amber-600">
                  전부 오늘로 가져오기
                </button>
              </div>
              <p className="mt-1 truncate text-[11.5px] text-amber-700">
                {yesterdayUndone.map((m) => m.content).join(' · ')}
              </p>
            </div>
          )}
        </div>
        <FreeNote />
      </div>

      {/* 주간 캘린더 */}
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <p className="mb-2 px-1 text-[12px] font-bold text-slate-400">
          {weekStart.slice(5).replace('-', '/')} ~ {addDays(weekStart, 6).slice(5).replace('-', '/')}
        </p>
        {loading ? (
          <p className="py-8 text-center text-sm font-bold text-slate-400">불러오는 중…</p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-7">
            {DOW.map((label, i) => {
              const date = addDays(weekStart, i)
              const isToday = date === today
              const dayMemos = byDate[date] || []
              return (
                <div key={label}
                  className={`flex min-h-[180px] flex-col rounded-lg border p-1.5 ${
                    isToday ? 'border-sky-300 bg-sky-50/50' : i >= 5 ? 'border-slate-100 bg-slate-50/50' : 'border-slate-100'}`}>
                  <p className={`px-1 pb-1 text-[11px] font-black ${
                    isToday ? 'text-sky-600' : i === 6 ? 'text-rose-400' : i === 5 ? 'text-sky-400' : 'text-slate-500'}`}>
                    {label} {Number(date.slice(8, 10))}{isToday ? ' · 오늘' : ''}
                  </p>
                  <div className="flex-1 space-y-0.5">
                    {dayMemos.map((m) => (
                      <MemoItem key={m.id} memo={m} onToggle={toggle} onDelete={remove}
                        onMoveTomorrow={(memo) => moveTo(memo, addDays(date, 1))} />
                    ))}
                  </div>
                  <DayAdd date={date} onAdd={add} />
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
