import { useCallback, useEffect, useState } from 'react'
import { authApi as api } from '../../api/authApi'

/* ─────────────── AI 분석 블록 렌더링 ─────────────── */

const AI_SECTION_STYLE = {
  '한 줄 총평': 'border-slate-200 bg-slate-50',
  '잘 되고 있는 것': 'border-emerald-100 bg-emerald-50/70',
  '리스크 · 막힘': 'border-amber-100 bg-amber-50/70',
  '의사결정 필요 — 경영진': 'border-rose-200 bg-rose-50',
  '이번 주 실행 — 실무진': 'border-sky-100 bg-sky-50/70',
  '지난주 대비 변화': 'border-indigo-100 bg-indigo-50/60',
}
const AI_LABEL_STYLE = {
  '한 줄 총평': 'text-slate-500',
  '잘 되고 있는 것': 'text-emerald-600',
  '리스크 · 막힘': 'text-amber-600',
  '의사결정 필요 — 경영진': 'text-rose-600',
  '이번 주 실행 — 실무진': 'text-sky-600',
  '지난주 대비 변화': 'text-indigo-600',
}

function parseAiContent(content) {
  const text = String(content || '')
  const re = /【([^】]+)】/g
  const parts = []
  let match
  let last = null
  while ((match = re.exec(text)) !== null) {
    if (last) parts.push({ title: last.title, body: text.slice(last.end, match.index).trim() })
    last = { title: match[1].trim(), end: re.lastIndex }
  }
  if (last) parts.push({ title: last.title, body: text.slice(last.end).trim() })
  return parts
}

function AiContent({ content }) {
  const sections = parseAiContent(content)
  if (!sections.length) {
    return <pre className="mt-3 whitespace-pre-wrap break-words font-sans text-[13px] leading-6 text-slate-700">{content}</pre>
  }
  return (
    <div className="mt-3 grid gap-2 lg:grid-cols-2">
      {sections.map((sec) => (
        <div key={sec.title}
          className={`rounded-lg border p-3 ${sec.title.includes('총평') ? 'lg:col-span-2' : ''} ${AI_SECTION_STYLE[sec.title] || 'border-slate-100 bg-slate-50'}`}>
          <p className={`text-[11px] font-black ${AI_LABEL_STYLE[sec.title] || 'text-slate-500'}`}>{sec.title}</p>
          <ul className="mt-1 space-y-0.5">
            {sec.body.split('\n').filter((line) => line.trim()).map((line, idx) => (
              <li key={idx} className="text-[13px] leading-5 text-slate-800">{line.replace(/^[-•]\s*/, '· ')}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

/* ─────────────── 유틸 ─────────────── */

const mondayOf = (offsetWeeks = 0) => {
  const d = new Date()
  const day = d.getDay() === 0 ? 7 : d.getDay()
  d.setDate(d.getDate() - (day - 1) + offsetWeeks * 7)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const fmtDate = (v) => String(v || '').slice(0, 10)
const fmtDateTime = (v) => {
  if (!v) return ''
  try { return new Date(v).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) } catch { return String(v) }
}

/* ─────────────── 메인 페이지 ─────────────── */

export default function WeeklyBizReportPage({ role = 'EMPLOYEE', username = '' }) {
  const isExecutive = role === 'EXECUTIVE'
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [weekStart, setWeekStart] = useState(mondayOf(0))
  const [title, setTitle] = useState('')
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState(null)
  const [openRaw, setOpenRaw] = useState(null)   // id → raw text
  const [analyzing, setAnalyzing] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    api.get('/weekly-biz').then((res) => setItems(res.data || [])).catch(() => setItems([])).finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  const upload = async (file) => {
    if (!file) return
    setUploading(true)
    setMessage(null)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('weekStart', weekStart)
      if (title.trim()) form.append('title', title.trim())
      const res = await api.post('/weekly-biz', form, { headers: { 'Content-Type': 'multipart/form-data' } })
      const d = res.data
      if (d?.success) {
        setMessage({ ok: true, text: `등록 완료 — ${d.weekStart} 주차${d.aiAnalyzed ? ` · AI 분석 완료${Number(d.registeredTasks) > 0 ? ` · 종합 상황판에 업무 ${d.registeredTasks}건 자동 등록` : ''}` : ` · AI 분석 대기 (${d.aiMessage || '아래 [AI 분석]으로 실행'})`}` })
        setTitle('')
        load()
      } else {
        setMessage({ ok: false, text: d?.message || '등록에 실패했습니다.' })
      }
    } catch (e) {
      setMessage({ ok: false, text: e?.response?.data?.message || '등록에 실패했습니다.' })
    } finally {
      setUploading(false)
    }
  }

  const runAnalyze = async (id) => {
    setAnalyzing(id)
    try {
      const res = await api.post(`/weekly-biz/${id}/analyze`)
      if (!res.data?.success) setMessage({ ok: false, text: res.data?.message || 'AI 분석에 실패했습니다.' })
      else if (Number(res.data?.registeredTasks) > 0) setMessage({ ok: true, text: `AI 분석 완료 · 종합 상황판에 업무 ${res.data.registeredTasks}건 자동 등록` })
      load()
    } catch (e) {
      setMessage({ ok: false, text: e?.response?.data?.message || 'AI 분석에 실패했습니다.' })
    } finally {
      setAnalyzing(null)
    }
  }

  const toggleRaw = async (id) => {
    if (openRaw?.id === id) { setOpenRaw(null); return }
    try {
      const res = await api.get(`/weekly-biz/${id}`)
      setOpenRaw({ id, text: res.data?.raw_text || '' })
    } catch {
      setOpenRaw(null)
    }
  }

  const remove = async (id) => {
    if (!window.confirm('이 주간 보고를 삭제할까요?')) return
    try {
      const res = await api.delete(`/weekly-biz/${id}`)
      if (!res.data?.success) setMessage({ ok: false, text: res.data?.message || '삭제 실패' })
      load()
    } catch (e) {
      setMessage({ ok: false, text: e?.response?.data?.message || '삭제 실패' })
    }
  }

  const canDelete = (row) => isExecutive || String(row.uploaded_by || '').toLowerCase() === String(username || '').toLowerCase()

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div>
        <h1 className="text-lg font-black text-slate-900">주간 업무 보고</h1>
        <p className="mt-0.5 text-[12px] text-slate-400">
          매주 월요일 회의 후 보고 파일(PPT·워드·텍스트)을 등록하면 AI가 경영진 의사결정 · 실무진 실행 관점으로 정리합니다.
        </p>
      </div>

      {/* 등록 카드 */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-black text-slate-800">이번 주 보고 등록</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-[12px] font-bold text-slate-500">
            주차 (월요일)
            <input type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)}
              className="h-10 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 focus:border-blue-400 focus:outline-none" />
          </label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="제목 (비우면 파일명 사용)"
            className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none" />
          <label className={`flex cursor-pointer items-center gap-1.5 rounded-lg bg-blue-500 px-4 py-2.5 text-sm font-black text-white hover:bg-blue-600 ${uploading ? 'pointer-events-none opacity-60' : ''}`}>
            <span className={`material-symbols-outlined text-[18px] ${uploading ? 'animate-spin' : ''}`}>{uploading ? 'sync' : 'upload_file'}</span>
            {uploading ? '등록·분석 중...' : '보고 파일 등록'}
            <input type="file" accept=".pptx,.docx,.txt,.md,.csv" className="hidden" disabled={uploading}
              onChange={(e) => { upload(e.target.files?.[0]); e.target.value = '' }} />
          </label>
        </div>
        <p className="mt-2 text-[11px] text-slate-400">
          지원 형식: PPTX · DOCX · TXT. 등록하면 본문이 자동 추출되고 AI 분석이 바로 실행됩니다. (지난주 보고가 있으면 주간 변화까지 비교)
        </p>
        {message && (
          <p className={`mt-2 rounded-lg px-3 py-2 text-[12px] font-bold ${message.ok ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'}`}>
            {message.text}
          </p>
        )}
      </div>

      {/* 주차별 목록 */}
      {loading ? (
        <p className="py-10 text-center text-sm font-bold text-slate-400">불러오는 중…</p>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-10 text-center text-sm text-slate-400">
          아직 등록된 주간 보고가 없습니다. 월요일 회의 자료를 첫 보고로 올려보세요.
        </div>
      ) : (
        items.map((row) => (
          <div key={row.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-slate-900 px-2 py-0.5 text-[11px] font-black text-white">{fmtDate(row.week_start)} 주차</span>
                  <p className="truncate text-[14px] font-black text-slate-900">{row.title}</p>
                </div>
                <p className="mt-1 text-[11px] font-bold text-slate-400">
                  {row.uploader_name || row.uploaded_by} 등록 · {fmtDateTime(row.created_at)}
                  {row.ai_analyzed_at ? ` · AI 분석 ${fmtDateTime(row.ai_analyzed_at)}` : ''}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button type="button" onClick={() => runAnalyze(row.id)} disabled={analyzing === row.id}
                  className="flex items-center gap-1 rounded-lg border border-sky-200 px-2.5 py-1.5 text-[12px] font-black text-sky-600 hover:bg-sky-50 disabled:opacity-50">
                  <span className={`material-symbols-outlined text-[15px] ${analyzing === row.id ? 'animate-spin' : ''}`}>
                    {analyzing === row.id ? 'sync' : 'auto_awesome'}
                  </span>
                  {row.ai_summary ? '재분석' : 'AI 분석'}
                </button>
                <button type="button" onClick={() => toggleRaw(row.id)}
                  className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12px] font-black text-slate-500 hover:bg-slate-50">
                  {openRaw?.id === row.id ? '원문 닫기' : '원문 보기'}
                </button>
                {canDelete(row) && (
                  <button type="button" onClick={() => remove(row.id)}
                    className="rounded-lg px-1.5 py-1.5 text-slate-300 hover:text-rose-500">
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                  </button>
                )}
              </div>
            </div>

            {row.ai_summary ? (
              <AiContent content={row.ai_summary} />
            ) : (
              <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2.5 text-[12px] font-bold text-slate-400">
                아직 AI 분석 전입니다. [AI 분석] 버튼을 누르면 경영진·실무진 관점 요약이 생성됩니다.
              </p>
            )}

            {openRaw?.id === row.id && (
              <pre className="mt-3 max-h-80 overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-slate-100 bg-slate-50 p-3 font-sans text-[12px] leading-5 text-slate-600">
                {openRaw.text}
              </pre>
            )}
          </div>
        ))
      )}
    </div>
  )
}
