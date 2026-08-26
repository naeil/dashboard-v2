import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createStaffWorkReport, deleteStaffWorkReport, getStaffWorkReports, updateStaffWorkReport, getWorkReportFeedback, createWorkReportFeedback, updateWorkReportFeedback, deleteWorkReportFeedback, patchWorkReportFeedbackStatus, getAiWeeklyReports, generateAiWeekly, getReportViewPermissions, saveReportViewPermissions } from '../../api/staffApi'
import { getExecutiveWorkTasks } from '../../api/executiveApi'
import { getUsers } from '../../api/authApi'

const todayText = () => new Date().toISOString().slice(0, 10)

function startOfWeekText(dateText) {
  const date = new Date(`${dateText}T00:00:00`)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  return date.toISOString().slice(0, 10)
}

const emptyForm = {
  report_type: 'DAILY',
  report_date: todayText(),
  week_start_date: startOfWeekText(todayText()),
  title: '',
  completed_work: '',
  planned_work: '',
  blockers: '',
  memo: '',
  status: 'SUBMITTED',
  linked_task_id: '',
  linked_project_name: '',
}

const reportTypeLabels = {
  DAILY: '일일 업무',
  WEEKLY: '주간 업무',
}

const FEEDBACK_TYPES = [
  { value: 'CHECK_REQUEST', label: '확인 요청', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'REVISION_REQUEST', label: '수정 요청', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { value: 'DECISION', label: '의사결정', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { value: 'PRAISE', label: '칭찬', color: 'bg-green-100 text-green-700 border-green-200' },
  { value: 'WARNING', label: '주의', color: 'bg-red-100 text-red-700 border-red-200' },
]

const FEEDBACK_STATUSES = [
  { value: 'PENDING', label: '대기', color: 'bg-gray-100 text-gray-600 border-gray-200' },
  { value: 'IN_PROGRESS', label: '진행중', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'DONE', label: '완료', color: 'bg-green-100 text-green-700 border-green-200' },
]

const FEEDBACK_TYPE_PLACEHOLDERS = {
  CHECK_REQUEST: '단백깡 포케스트 근거가 부족합니다.\n채널별 예상 판매수량, 광고비 산출 근거, 월별 목표 판매량을 정리 후 공유 바랍니다.',
  REVISION_REQUEST: '현재 포케스트는 광고비와 영업이익률이 12개월 동일하게 작성되어 있습니다.\n실제 사업 흐름에 맞춰 월별 광고 집행 계획, 채널 확장 일정, 재구매 반영 기준으로 재작성 바랍니다.',
  DECISION: '단백깡 유통 우선순위는 폐쇄몰, 온라인, 오프라인 순으로 진행합니다.\n트레이더스는 브랜딩 목적 채널로 판단합니다.',
  PRAISE: '판교 프로모션 진행은 좋았습니다.\n다음부터는 시식 인원, QR 참여율, 구매 전환율까지 함께 기록 바랍니다.',
  WARNING: '"되어 있을 것 같습니다"와 같은 추정 보고는 지양 바랍니다.\n확인 후 근거자료와 함께 보고 부탁드립니다.',
}

function getFeedbackTypeInfo(value) {
  return FEEDBACK_TYPES.find(t => t.value === value) || FEEDBACK_TYPES[0]
}

function getFeedbackStatusInfo(value) {
  return FEEDBACK_STATUSES.find(s => s.value === value) || FEEDBACK_STATUSES[0]
}

function isOverdue(fb) {
  if (!fb.due_date) return false
  if (fb.status === 'DONE') return false
  const due = new Date(fb.due_date)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return due < today
}

function statusBadge(status) {
  return status === 'DRAFT'
    ? 'border-amber-200 bg-amber-50 text-amber-700'
    : 'border-emerald-200 bg-emerald-50 text-emerald-700'
}

function formatTime(isoString) {
  if (!isoString) return ''
  try {
    return new Date(isoString).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  try {
    return new Date(dateStr).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })
  } catch {
    return dateStr
  }
   }

function FeedbackSection({ reportId, currentUser, allUsers }) {
  const [feedbacks, setFeedbacks] = useState([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [feedbackType, setFeedbackType] = useState('CHECK_REQUEST')
  const [assigneeName, setAssigneeName] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [feedbackStatus, setFeedbackStatus] = useState('PENDING')
  const [inputText, setInputText] = useState('')
  const [editingFeedbackId, setEditingFeedbackId] = useState(null)
  const [editingData, setEditingData] = useState({})
  const [mentionQuery, setMentionQuery] = useState(null)
  const [mentionIndex, setMentionIndex] = useState(0)
  const [cursorPos, setCursorPos] = useState(0)
  const textareaRef = useRef(null)

  const loadFeedbacks = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getWorkReportFeedback(reportId)
      setFeedbacks(res.data || [])
    } catch {} finally {
      setLoading(false)
    }
  }, [reportId])

  useEffect(() => { loadFeedbacks() }, [loadFeedbacks])

  const filteredUsers = useMemo(() => {
    if (mentionQuery === null) return []
    const q = mentionQuery.toLowerCase()
    return allUsers.filter(u =>
      (u.display_name || u.username || '').toLowerCase().includes(q) ||
      (u.username || '').toLowerCase().includes(q)
    ).slice(0, 6)
  }, [mentionQuery, allUsers])

  const handleInputChange = (e) => {
    const val = e.target.value
    const pos = e.target.selectionStart
    setInputText(val)
    setCursorPos(pos)
    const textBefore = val.slice(0, pos)
    const atMatch = textBefore.match(/@([w가-힣]*)$/)
    if (atMatch) {
      setMentionQuery(atMatch[1])
      setMentionIndex(0)
    } else {
      setMentionQuery(null)
    }
  }

  const insertMention = (user) => {
    const textBefore = inputText.slice(0, cursorPos)
    const atMatch = textBefore.match(/@([w가-힣]*)$/)
    if (!atMatch) return
    const start = cursorPos - atMatch[0].length
    const mention = '@' + (user.display_name || user.username)
    const newText = inputText.slice(0, start) + mention + ' ' + inputText.slice(cursorPos)
    setInputText(newText)
    setMentionQuery(null)
    setTimeout(() => {
      const newPos = start + mention.length + 1
      textareaRef.current?.setSelectionRange(newPos, newPos)
      textareaRef.current?.focus()
    }, 0)
  }

  const handleKeyDown = (e) => {
    if (mentionQuery !== null && filteredUsers.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex(i => Math.min(i + 1, filteredUsers.length - 1)); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIndex(i => Math.max(i - 1, 0)); return }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insertMention(filteredUsers[mentionIndex]); return }
      if (e.key === 'Escape') { setMentionQuery(null); return }
    }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      submitFeedback()
    }
  }

  const submitFeedback = async () => {
    if (!inputText.trim()) { setError('피드백 내용을 입력하세요.'); return }
    setError('')
    setSubmitting(true)
    try {
      await createWorkReportFeedback(reportId, {
        feedbackType,
        assigneeName: assigneeName.trim() || null,
        dueDate: dueDate || null,
        status: feedbackStatus,
        content: inputText.trim(),
      })
      setInputText('')
      setAssigneeName('')
      setDueDate('')
      setFeedbackType('CHECK_REQUEST')
      setFeedbackStatus('PENDING')
      setMentionQuery(null)
      await loadFeedbacks()
    } catch (e) {
      setError(e?.response?.data?.message || '저장에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  const startEdit = (fb) => {
    setEditingFeedbackId(fb.id)
    setEditingData({
      content: fb.content || '',
      feedbackType: fb.feedback_type || 'CHECK_REQUEST',
      assigneeName: fb.assignee_name || '',
      dueDate: fb.due_date ? String(fb.due_date).slice(0, 10) : '',
      status: fb.status || 'PENDING',
    })
  }

  const saveEdit = async (id) => {
    if (!editingData.content?.trim()) return
    try {
      await updateWorkReportFeedback(id, {
        feedbackType: editingData.feedbackType,
        assigneeName: editingData.assigneeName || null,
        dueDate: editingData.dueDate || null,
        status: editingData.status,
        content: editingData.content.trim(),
      })
      setEditingFeedbackId(null)
      await loadFeedbacks()
    } catch {}
  }

  const handleStatusChange = async (id, newStatus) => {
    try {
      await patchWorkReportFeedbackStatus(id, newStatus)
      await loadFeedbacks()
    } catch {}
  }

  const removeFeedback = async (id) => {
    try {
      await deleteWorkReportFeedback(id)
      await loadFeedbacks()
    } catch {}
  }

  const needsDueDate = ['CHECK_REQUEST', 'REVISION_REQUEST', 'WARNING'].includes(feedbackType)

  return (
    <div className="mt-4 border-t border-slate-100 pt-4">
      <p className="mb-3 text-xs font-black text-slate-500">업무 지시 / 피드백 ({feedbacks.length})</p>

      <div className="space-y-3 mb-4">
        {feedbacks.length === 0 && !loading && (
          <p className="text-xs font-bold text-slate-400 text-center py-3">아직 등록된 피드백이 없습니다.</p>
        )}
        {feedbacks.map(fb => {
          const typeInfo = getFeedbackTypeInfo(fb.feedback_type)
          const statusInfo = getFeedbackStatusInfo(fb.status)
          const overdue = isOverdue(fb)
          return (
            <div key={fb.id} className={`rounded-lg border px-3 py-2.5 ${overdue ? 'border-red-200 bg-red-50' : 'border-slate-100 bg-slate-50'}`}>
              {editingFeedbackId === fb.id ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[10px] font-black text-slate-500 mb-1">피드백 유형</p>
                      <select value={editingData.feedbackType} onChange={e => setEditingData(p => ({...p, feedbackType: e.target.value}))} className="w-full h-8 rounded border border-slate-200 px-2 text-xs font-bold outline-none">
                        {FEEDBACK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-500 mb-1">상태</p>
                      <select value={editingData.status} onChange={e => setEditingData(p => ({...p, status: e.target.value}))} className="w-full h-8 rounded border border-slate-200 px-2 text-xs font-bold outline-none">
                        {FEEDBACK_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[10px] font-black text-slate-500 mb-1">담당자</p>
                      <input value={editingData.assigneeName} onChange={e => setEditingData(p => ({...p, assigneeName: e.target.value}))} className="w-full h-8 rounded border border-slate-200 px-2 text-xs font-bold outline-none" placeholder="담당자 이름" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-500 mb-1">마감일</p>
                      <input type="date" value={editingData.dueDate} onChange={e => setEditingData(p => ({...p, dueDate: e.target.value}))} className="w-full h-8 rounded border border-slate-200 px-2 text-xs font-bold outline-none" />
                    </div>
                  </div>
                  <textarea value={editingData.content} onChange={e => setEditingData(p => ({...p, content: e.target.value}))} rows={3} className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm font-bold outline-none focus:border-sky-400 resize-none" />
                  <div className="flex gap-2 justify-end">
                    <button type="button" onClick={() => setEditingFeedbackId(null)} className="h-7 rounded border border-slate-300 px-3 text-[11px] font-black text-slate-600">취소</button>
                    <button type="button" onClick={() => saveEdit(fb.id)} className="h-7 rounded bg-sky-500 px-3 text-[11px] font-black text-white hover:bg-sky-600">저장</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-1.5 mb-2">
                    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-black ${typeInfo.color}`}>{typeInfo.label}</span>
                    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-black ${statusInfo.color}`}>{statusInfo.label}</span>
                    {overdue && <span className="inline-flex items-center rounded border border-red-300 bg-red-100 px-2 py-0.5 text-[11px] font-black text-red-700">⚠ 지연</span>}
                    {fb.assignee_name && <span className="text-[11px] font-bold text-slate-600">→ {fb.assignee_name}</span>}
                    {fb.due_date && <span className={`text-[11px] font-bold ${overdue ? 'text-red-600' : 'text-slate-500'}`}>마감: {formatDate(fb.due_date)}</span>}
                    <span className="ml-auto text-[11px] text-slate-400">{fb.author_display_name || fb.author_username} · {formatTime(fb.created_at)}</span>
                  </div>
                  <p className="text-sm font-bold text-slate-700 whitespace-pre-wrap leading-5 mb-2">{fb.content}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <select
                      value={fb.status}
                      onChange={e => handleStatusChange(fb.id, e.target.value)}
                      className="h-7 rounded border border-slate-200 px-2 text-[11px] font-black text-slate-600 outline-none hover:border-sky-300 bg-white"
                    >
                      {FEEDBACK_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                    {(currentUser === fb.author_username || currentUser === 'admin') && (
                      <>
                        <button type="button" onClick={() => startEdit(fb)} className="text-[11px] font-black text-slate-400 hover:text-sky-500">수정</button>
                        <button type="button" onClick={() => removeFeedback(fb.id)} className="text-[11px] font-black text-slate-400 hover:text-rose-500">삭제</button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2.5">
        <p className="text-xs font-black text-slate-600">업무 지시 작성</p>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-[10px] font-black text-slate-500 mb-1">피드백 유형 *</p>
            <select value={feedbackType} onChange={e => setFeedbackType(e.target.value)} className="w-full h-9 rounded border border-slate-200 px-2 text-xs font-bold outline-none focus:border-sky-400">
              {FEEDBACK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-500 mb-1">상태</p>
            <select value={feedbackStatus} onChange={e => setFeedbackStatus(e.target.value)} className="w-full h-9 rounded border border-slate-200 px-2 text-xs font-bold outline-none focus:border-sky-400">
              {FEEDBACK_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-[10px] font-black text-slate-500 mb-1">담당자</p>
            <input value={assigneeName} onChange={e => setAssigneeName(e.target.value)} placeholder="담당자 이름 입력" className="w-full h-9 rounded border border-slate-200 px-2 text-xs font-bold outline-none focus:border-sky-400" />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-500 mb-1">
              마감일 {needsDueDate && <span className="text-orange-500 font-black">(권장)</span>}
            </p>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full h-9 rounded border border-slate-200 px-2 text-xs font-bold outline-none focus:border-sky-400" />
          </div>
        </div>

        <div className="relative">
          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={FEEDBACK_TYPE_PLACEHOLDERS[feedbackType]}
            rows={3}
            className="w-full rounded border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-sky-400 resize-none"
          />
          {mentionQuery !== null && filteredUsers.length > 0 && (
            <div className="absolute bottom-full left-0 mb-1 w-56 rounded-lg border border-slate-200 bg-white shadow-lg z-50 overflow-hidden">
              {filteredUsers.map((u, i) => (
                <button key={u.id} type="button" onMouseDown={e => { e.preventDefault(); insertMention(u); }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-sm font-bold text-left hover:bg-sky-50 ${i === mentionIndex ? 'bg-sky-50 text-sky-700' : 'text-slate-700'}`}>
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-black">
                    {(u.display_name || u.username || '?')[0]}
                  </span>
                  <span>{u.display_name || u.username}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {error && <p className="text-xs font-black text-red-600">{error}</p>}

        <div className="flex justify-end">
          <button type="button" onClick={submitFeedback} disabled={submitting || !inputText.trim()}
            className="h-8 rounded bg-sky-500 px-4 text-xs font-black text-white hover:bg-sky-600 disabled:opacity-50">
            {submitting ? '전송 중...' : '피드백 전송'}
          </button>
        </div>
      </div>
    </div>
  )
}


/* ───────── AI 주간 정리 (육하원칙) + 열람 권한 ───────── */
function mondayOf(offsetWeeks) {
  const d = new Date()
  const day = d.getDay()
  const diff = (day === 0 ? -6 : 1 - day) - offsetWeeks * 7
  d.setDate(d.getDate() + diff)
  return d.toISOString().slice(0, 10)
}

function PermissionModal({ onClose }) {
  const [data, setData] = useState(null)
  const [rows, setRows] = useState([])
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    getReportViewPermissions().then((r) => {
      const d = r.data || {}
      setData(d)
      setRows((d.permissions || []).map((p) => ({ viewerUsername: p.viewer_username, targetUsername: p.target_username })))
    }).catch(() => setData({ permissions: [], users: [] }))
  }, [])
  const users = data?.users || []
  const save = async () => {
    setSaving(true)
    try { await saveReportViewPermissions(rows); onClose(true) } finally { setSaving(false) }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => onClose(false)}>
      <div className="flex max-h-[80vh] w-full max-w-xl flex-col rounded-2xl bg-white p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-black text-slate-800">일일 보고 열람 권한 <span className="text-[11px] font-bold text-slate-400">A가 B의 보고를 볼 수 있게</span></p>
          <button type="button" onClick={() => onClose(false)} className="text-slate-400 hover:text-slate-600"><span className="material-symbols-outlined text-[20px]">close</span></button>
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto rounded-lg border border-slate-100 p-3">
          {data == null ? <p className="py-4 text-center text-sm text-slate-400">불러오는 중…</p> : (
            <>
              {rows.length === 0 && <p className="py-2 text-center text-[12px] text-slate-400">설정된 권한이 없습니다. 아래에서 추가하세요.</p>}
              {rows.map((row, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <select className="h-9 flex-1 rounded-lg border border-slate-200 bg-white px-2 text-sm font-bold text-slate-700 focus:outline-none"
                    value={row.viewerUsername} onChange={(e) => setRows((prev) => prev.map((x, i) => (i === idx ? { ...x, viewerUsername: e.target.value } : x)))}>
                    <option value="">보는 사람</option>
                    {users.map((u) => <option key={u.username} value={u.username}>{u.display_name} ({u.role === 'MANAGER' ? '매니저' : u.role === 'EXECUTIVE' ? '임원' : '직원'})</option>)}
                  </select>
                  <span className="text-[12px] font-black text-slate-400">→</span>
                  <select className="h-9 flex-1 rounded-lg border border-slate-200 bg-white px-2 text-sm font-bold text-slate-700 focus:outline-none"
                    value={row.targetUsername} onChange={(e) => setRows((prev) => prev.map((x, i) => (i === idx ? { ...x, targetUsername: e.target.value } : x)))}>
                    <option value="">보고 대상</option>
                    {users.map((u) => <option key={u.username} value={u.username}>{u.display_name}</option>)}
                  </select>
                  <button type="button" onClick={() => setRows((prev) => prev.filter((_, i) => i !== idx))}
                    className="text-slate-300 hover:text-rose-500"><span className="material-symbols-outlined text-[18px]">delete</span></button>
                </div>
              ))}
              <button type="button" onClick={() => setRows((prev) => [...prev, { viewerUsername: '', targetUsername: '' }])}
                className="mt-1 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-[12px] font-black text-slate-500 hover:bg-slate-50">+ 권한 추가</button>
              <p className="text-[11px] text-slate-400">예: 팀장을 "보는 사람", 팀원을 "보고 대상"으로 추가하면 팀장이 팀원의 일일 보고와 AI 주간 정리를 볼 수 있습니다. 임원은 설정 없이 전체 열람.</p>
            </>
          )}
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <button type="button" onClick={() => onClose(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-500">취소</button>
          <button type="button" disabled={saving || data == null} onClick={save} className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-black text-white disabled:opacity-50">{saving ? '저장 중…' : '저장'}</button>
        </div>
      </div>
    </div>
  )
}

const AI_SECTION_STYLE = {
  '한 줄 요약': 'border-slate-200 bg-slate-50',
  '핵심 성과': 'border-emerald-100 bg-emerald-50/70',
  '진행중·막힘': 'border-amber-100 bg-amber-50/70',
  '다음 주 핵심': 'border-sky-100 bg-sky-50/70',
  '대표 확인 필요': 'border-rose-200 bg-rose-50',
}
const AI_LABEL_STYLE = {
  '한 줄 요약': 'text-slate-500',
  '핵심 성과': 'text-emerald-600',
  '진행중·막힘': 'text-amber-600',
  '다음 주 핵심': 'text-sky-600',
  '대표 확인 필요': 'text-rose-600',
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
    <div className="mt-3 space-y-2">
      {sections.map((sec) => (
        <div key={sec.title} className={`rounded-lg border p-2.5 ${AI_SECTION_STYLE[sec.title] || 'border-slate-100 bg-slate-50'}`}>
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

function AiWeeklySection({ role }) {
  const [weekStart, setWeekStart] = useState(mondayOf(1))
  const [items, setItems] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [msg, setMsg] = useState('')
  const [showPerm, setShowPerm] = useState(false)
  const [openUser, setOpenUser] = useState('')

  const load = useCallback(() => {
    getAiWeeklyReports(weekStart).then((r) => setItems(r.data || [])).catch(() => setItems([]))
  }, [weekStart])
  useEffect(() => {
    const t = setTimeout(load, 0)
    return () => clearTimeout(t)
  }, [load])

  const gen = async () => {
    setGenerating(true)
    setMsg('')
    try {
      const r = await generateAiWeekly(weekStart)
      const d = r.data || {}
      setMsg(d.success ? `${d.generated}명 정리 완료` : (d.message || '생성 실패'))
      load()
    } catch {
      setMsg('생성 실패 — AI 설정을 확인하세요.')
    } finally {
      setGenerating(false)
    }
  }

  const weekLabel = (w) => {
    const end = new Date(`${w}T00:00:00`)
    end.setDate(end.getDate() + 6)
    return `${w.slice(5)} ~ ${end.toISOString().slice(5, 10)}`
  }

  return (
    <section className="mb-6 rounded-lg border border-indigo-100 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-950">AI 주간 정리 <span className="text-[11px] font-bold text-indigo-500">육하원칙 자동 요약</span></h2>
          <p className="mt-0.5 text-[12px] text-slate-400">일일 보고 7일치를 AI가 사람별로 정리합니다. 매주 월요일 아침 자동 생성 · 필요 시 아래에서 즉시 생성</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm font-bold text-slate-700 focus:outline-none"
            value={weekStart} onChange={(e) => setWeekStart(e.target.value)}>
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
              const w = mondayOf(i)
              return <option key={w} value={w}>{i === 0 ? '이번 주 ' : i === 1 ? '지난주 ' : ''}{weekLabel(w)}</option>
            })}
          </select>
          <button type="button" disabled={generating} onClick={gen}
            className="rounded-lg bg-indigo-500 px-3 py-2 text-xs font-black text-white hover:bg-indigo-600 disabled:opacity-50">
            {generating ? 'AI 정리 중…' : 'AI 정리 생성'}
          </button>
          {role === 'EXECUTIVE' && (
            <button type="button" onClick={() => setShowPerm(true)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 hover:bg-slate-50">열람 권한</button>
          )}
          {msg && <span className="text-[12px] font-bold text-indigo-600">{msg}</span>}
        </div>
      </div>

      {items == null ? <p className="py-6 text-center text-sm text-slate-400">불러오는 중…</p> : items.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-slate-400">이 주의 AI 정리가 아직 없습니다. [AI 정리 생성]을 누르면 일일 보고 기반으로 만들어집니다.</p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
          {items.map((it) => (
            <article key={`${it.username}|${it.week_start}`} className="rounded-lg border border-slate-100 p-4">
              <button type="button" className="flex w-full items-center justify-between text-left"
                onClick={() => setOpenUser(openUser === it.username ? '' : it.username)}>
                <p className="text-sm font-black text-slate-900">{it.display_name || it.username}
                  <span className="ml-2 text-[11px] font-bold text-slate-400">일일 보고 {it.source_count}건 기반 · {String(it.generated_date || '').slice(5)} 생성</span>
                </p>
                <span className="material-symbols-outlined text-[20px] text-slate-400">{openUser === it.username ? 'expand_less' : 'expand_more'}</span>
              </button>
              {openUser === it.username ? (
                <AiContent content={it.content} />
              ) : (
                <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-[12px] text-slate-500">
                  {(parseAiContent(it.content)[0]?.body || String(it.content).slice(0, 140)).slice(0, 140)}
                </p>
              )}
            </article>
          ))}
        </div>
      )}
      {showPerm && <PermissionModal onClose={() => setShowPerm(false)} />}
    </section>
  )
}

export default function StaffWorkReportPage({ username, displayName, role, onNavigate }) {
  const [reports, setReports] = useState([])
  const [workTasks, setWorkTasks] = useState([])
  const [allUsers, setAllUsers] = useState([])
  const [filter, setFilter] = useState('ALL')
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [expandedFeedback, setExpandedFeedback] = useState(new Set())

  const ownerLabel = displayName || username || '실무진'

  const load = async () => {
    setLoading(true)
    try {
      const [response, taskResponse, usersResponse] = await Promise.all([
        getStaffWorkReports(filter === 'ALL' ? {} : { reportType: filter }),
        getExecutiveWorkTasks(),
        getUsers().catch(() => ({ data: [] })),
      ])
      setReports(response.data || [])
      setWorkTasks(taskResponse.data || [])
      setAllUsers(usersResponse.data || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [filter])

  const summary = useMemo(() => {
    const daily = reports.filter((report) => report.report_type === 'DAILY').length
    const weekly = reports.filter((report) => report.report_type === 'WEEKLY').length
    const blockers = reports.filter((report) => report.blockers).length
    return { daily, weekly, blockers }
  }, [reports])

  const projectNames = useMemo(() => (
    Array.from(new Set(workTasks.map((task) => task.project_name).filter(Boolean))).sort((a, b) => a.localeCompare(b))
  ), [workTasks])

  const linkedProjectTasks = useMemo(() => (
    workTasks
      .filter((task) => form.linked_project_name && task.project_name === form.linked_project_name)
      .sort((a, b) => String(a.due_date || '').localeCompare(String(b.due_date || '')))
  ), [form.linked_project_name, workTasks])

  const taskById = useMemo(() => {
    const map = new Map()
    workTasks.forEach((task) => map.set(String(task.id), task))
    return map
  }, [workTasks])

  const setField = (key, value) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value }
      if (key === 'report_date') {
        next.week_start_date = startOfWeekText(value)
      }
      return next
    })
  }

  const resetForm = () => {
    setEditingId(null)
    setForm(emptyForm)
    setMessage('')
  }

  const editReport = (report) => {
    setEditingId(report.id)
    setForm({
      report_type: report.report_type || 'DAILY',
      report_date: String(report.report_date || todayText()).slice(0, 10),
      week_start_date: String(report.week_start_date || report.report_date || todayText()).slice(0, 10),
      title: report.title || '',
      completed_work: report.completed_work || '',
      planned_work: report.planned_work || '',
      blockers: report.blockers || '',
      memo: report.memo || '',
      status: report.status || 'SUBMITTED',
      linked_task_id: report.linked_task_id || '',
      linked_project_name: report.linked_project_name || '',
    })
    setMessage('')
  }

  const submit = async (event) => {
    event.preventDefault()
    if (!form.title.trim()) {
      setMessage('보고 제목을 입력하세요.')
      return
    }

    const payload = {
      ...form,
      week_start_date: form.report_type === 'WEEKLY' ? form.week_start_date : null,
      linked_task_id: form.linked_task_id || null,
      linked_project_name: form.linked_project_name || null,
    }

    if (editingId) {
      await updateStaffWorkReport(editingId, payload)
      setMessage('업무 보고를 수정했습니다.')
    } else {
      await createStaffWorkReport(payload)
      setMessage('업무 보고를 저장했습니다.')
    }
    resetForm()
    await load()
  }

  const removeReport = async (report) => {
    await deleteStaffWorkReport(report.id)
    if (editingId === report.id) resetForm()
    await load()
  }

  const toggleFeedback = (reportId) => {
    setExpandedFeedback(prev => {
      const next = new Set(prev)
      if (next.has(reportId)) { next.delete(reportId) } else { next.add(reportId) }
      return next
    })
  }

  return (
    <main className="min-h-[calc(100vh-80px)] bg-slate-50">
      <section className="mb-6 border-b border-slate-200 pb-5">
        <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-950">업무 보고</h1>
            <p className="mt-2 text-sm font-bold text-slate-500">오늘 한 일, 다음 업무, 막힌 이슈를 누적해서 관리합니다.</p>
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex h-10 items-center justify-center gap-2 rounded border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <span className={`material-symbols-outlined text-base ${loading ? 'animate-spin' : ''}`}>sync</span>
            새로고침
          </button>
        </div>
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black text-slate-500">일일 보고</p>
          <p className="mt-3 text-2xl font-black text-slate-950">{summary.daily.toLocaleString('ko-KR')}건</p>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black text-slate-500">주간 보고</p>
          <p className="mt-3 text-2xl font-black text-slate-950">{summary.weekly.toLocaleString('ko-KR')}건</p>
        </article>
        <article className="rounded-lg border border-rose-200 bg-rose-50 p-5">
          <p className="text-xs font-black text-rose-700">막힌 이슈 포함</p>
          <p className="mt-3 text-2xl font-black text-rose-700">{summary.blockers.toLocaleString('ko-KR')}건</p>
        </article>
      </section>

      <AiWeeklySection role={role} />

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <form onSubmit={submit} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="text-lg font-black text-slate-950">{editingId ? '업무 보고 수정' : '업무 보고 작성'}</h2>
            {editingId && (
              <button type="button" onClick={resetForm} className="h-9 rounded border border-slate-300 px-3 text-xs font-black text-slate-600 hover:bg-slate-50">
                새 보고
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className="mb-1 block text-xs font-black text-slate-500">구분</span>
              <select value={form.report_type} onChange={(event) => setField('report_type', event.target.value)} className="h-11 w-full rounded border border-slate-200 px-3 text-sm font-bold outline-none focus:border-sky-400">
                <option value="DAILY">일일 업무</option>
                <option value="WEEKLY">주간 업무</option>
              </select>
            </label>
            <label>
              <span className="mb-1 block text-xs font-black text-slate-500">보고일</span>
              <input type="date" value={form.report_date} onChange={(event) => setField('report_date', event.target.value)} className="h-11 w-full rounded border border-slate-200 px-3 text-sm font-bold outline-none focus:border-sky-400" />
            </label>
          </div>

          {form.report_type === 'WEEKLY' && (
            <label className="mt-3 block">
              <span className="mb-1 block text-xs font-black text-slate-500">주간 시작일</span>
              <input type="date" value={form.week_start_date} onChange={(event) => setField('week_start_date', event.target.value)} className="h-11 w-full rounded border border-slate-200 px-3 text-sm font-bold outline-none focus:border-sky-400" />
            </label>
          )}

          <label className="mt-3 block">
            <span className="mb-1 block text-xs font-black text-slate-500">제목</span>
            <input value={form.title} onChange={(event) => setField('title', event.target.value)} placeholder="예: 쿠팡 상세페이지 수정 및 재고 점검" className="h-11 w-full rounded border border-slate-200 px-3 text-sm font-bold outline-none focus:border-sky-400" />
          </label>

          <div className="mt-3 rounded-lg border border-sky-100 bg-sky-50 p-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-xs font-black text-sky-700">기존 프로젝트 / 일정 연결</p>
              {form.linked_project_name && (
                <button type="button" onClick={() => setForm((prev) => ({ ...prev, linked_project_name: '', linked_task_id: '' }))} className="text-[11px] font-black text-slate-500">
                  연결 해제
                </button>
              )}
            </div>
            <label className="block">
              <span className="mb-1 block text-xs font-black text-slate-500">프로젝트명</span>
              <input
                list="staff-report-project-options"
                value={form.linked_project_name}
                onChange={(event) => setField('linked_project_name', event.target.value)}
                placeholder="기존 프로젝트명을 선택하거나 입력"
                className="h-11 w-full rounded border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-sky-400"
              />
              <datalist id="staff-report-project-options">
                {projectNames.map((project) => <option key={project} value={project} />)}
              </datalist>
            </label>
            {linkedProjectTasks.length > 0 && (
              <label className="mt-3 block">
                <span className="mb-1 block text-xs font-black text-slate-500">연관 일정</span>
                <select
                  value={form.linked_task_id}
                  onChange={(event) => {
                    const task = workTasks.find((item) => String(item.id) === event.target.value)
                    setForm((prev) => ({
                      ...prev,
                      linked_task_id: event.target.value,
                      linked_project_name: task?.project_name || prev.linked_project_name,
                      title: prev.title || task?.task_name || '',
                    }))
                  }}
                  className="h-11 w-full rounded border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-sky-400"
                >
                  <option value="">프로젝트만 연결</option>
                  {linkedProjectTasks.map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.task_name} · {String(task.due_date || '마감일 없음').slice(0, 10)}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          {[
            ['completed_work', '완료 / 진행한 업무'],
            ['planned_work', '다음 액션'],
            ['blockers', '막힌 이슈'],
            ['memo', '메모'],
          ].map(([key, label]) => (
            <label key={key} className="mt-3 block">
              <span className={`mb-1 block text-xs font-black ${key === 'blockers' ? 'text-rose-600' : 'text-slate-500'}`}>{label}</span>
              <textarea
                value={form[key]}
                onChange={(event) => setField(key, event.target.value)}
                rows="4"
                className={`w-full rounded border px-3 py-2 text-sm font-bold outline-none ${
                  key === 'blockers'
                    ? 'border-rose-200 bg-rose-50 text-rose-700 placeholder:text-rose-300 focus:border-rose-400'
                    : 'border-slate-200 focus:border-sky-400'
                }`}
              />
            </label>
          ))}

          <div className="mt-4 grid grid-cols-[1fr_120px] gap-3">
            <select value={form.status} onChange={(event) => setField('status', event.target.value)} className="h-11 rounded border border-slate-200 px-3 text-sm font-bold outline-none focus:border-sky-400">
              <option value="SUBMITTED">제출</option>
              <option value="DRAFT">임시저장</option>
            </select>
            <button type="submit" className="h-11 rounded bg-sky-500 px-4 text-sm font-black text-white hover:bg-sky-600">
              저장
            </button>
          </div>
          {message && <p className="mt-3 rounded border border-sky-100 bg-sky-50 px-3 py-2 text-xs font-black text-sky-700">{message}</p>}
        </form>

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 md:flex-row md:items-center md:justify-between">
            <h2 className="text-lg font-black text-slate-950">보고 내역</h2>
            <div className="flex gap-2">
              {[
                ['ALL', '전체'],
                ['DAILY', '일일'],
                ['WEEKLY', '주간'],
              ].map(([value, label]) => (
                <button key={value} type="button" onClick={() => setFilter(value)} className={`h-9 rounded border px-3 text-xs font-black ${filter === value ? 'border-sky-400 bg-sky-50 text-sky-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {reports.map((report) => (
              <article key={report.id} className="p-5 hover:bg-slate-50">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 w-full">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-black text-slate-600">{reportTypeLabels[report.report_type] || report.report_type}</span>
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${statusBadge(report.status)}`}>{report.status === 'DRAFT' ? '임시저장' : '제출'}</span>
                      <span className="text-xs font-bold text-slate-400">{String(report.report_date).slice(0, 10)}</span>
                      {report.display_name && report.display_name !== (displayName || username) && (
                        <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] font-black text-violet-700">{report.display_name}</span>
                      )}
                    </div>
                    <h3 className="mt-3 text-base font-black text-slate-950">{report.title}</h3>
                    {report.linked_project_name && (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-black text-sky-700">
                          <span className="material-symbols-outlined text-sm">link</span>
                          {report.linked_project_name}
                        </span>
                        {report.linked_task_id && taskById.get(String(report.linked_task_id)) && (
                          <span className="inline-flex max-w-full items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-black text-slate-600">
                            <span className="truncate">{taskById.get(String(report.linked_task_id)).task_name}</span>
                          </span>
                        )}
                        <button type="button" onClick={() => onNavigate?.('staff-project-status')} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-black text-slate-600 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700">
                          프로젝트 현황 열기
                        </button>
                      </div>
                    )}
                    <div className="mt-4 space-y-3">
                      {report.completed_work && (
                        <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-3">
                          <p className="text-[11px] font-black text-slate-500">완료 / 진행한 업무</p>
                          <p className="mt-2 whitespace-pre-line text-sm font-bold leading-6 text-slate-700">{report.completed_work}</p>
                        </div>
                      )}
                      {report.planned_work && (
                        <div className="rounded-lg border border-sky-100 bg-sky-50 px-3 py-3">
                          <p className="text-[11px] font-black text-sky-700">다음 액션</p>
                          <p className="mt-2 whitespace-pre-line text-sm font-bold leading-6 text-slate-700">{report.planned_work}</p>
                        </div>
                      )}
                      {report.blockers && (
                        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-3">
                          <p className="text-[11px] font-black text-rose-700">막힌 이슈</p>
                          <p className="mt-2 whitespace-pre-line text-sm font-black leading-6 text-rose-700">{report.blockers}</p>
                        </div>
                      )}
                      {!report.completed_work && !report.planned_work && !report.blockers && (
                        <p className="mt-2 text-sm font-bold text-slate-400">내용 없음</p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleFeedback(report.id)}
                      className="mt-3 inline-flex items-center gap-1 text-xs font-black text-slate-500 hover:text-sky-600"
                    >
                      <span className="material-symbols-outlined text-sm">{expandedFeedback.has(report.id) ? 'expand_less' : 'assignment'}</span>
                      {expandedFeedback.has(report.id) ? '업무지시 접기' : '업무지시 보기 / 작성'}
                    </button>

                    {expandedFeedback.has(report.id) && (
                      <FeedbackSection
                        reportId={report.id}
                        currentUser={username}
                        allUsers={allUsers}
                      />
                    )}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button type="button" onClick={() => editReport(report)} className="h-9 rounded border border-slate-300 px-3 text-xs font-black text-slate-600 hover:bg-white">
                      수정
                    </button>
                    <button type="button" onClick={() => removeReport(report)} className="h-9 rounded border border-rose-200 px-3 text-xs font-black text-rose-600 hover:bg-rose-50">
                      삭제
                    </button>
                  </div>
                </div>
              </article>
            ))}
            {reports.length === 0 && <p className="p-8 text-center text-sm font-bold text-slate-400">아직 작성된 업무 보고가 없습니다.</p>}
          </div>
        </section>
      </section>
    </main>
  )
                         }
