import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  createContactLog,
  deleteContactLog,
  getContactLogs,
  setContactLogStatus,
  updateContactLog,
} from '../../api/contactLogApi'

// 상담·미팅 기록: 거래처와의 전화 상담 · 줌 · 대면 미팅 내용, 합의 사항, 다음 할 일.
// 앱의 라이트/다크 테마 덮어쓰기(.app-light .text-* / .bg-* !important)에 영향받지 않도록 색은 인라인 스타일로 고정한다.

const TYPES = {
  PHONE: { label: '전화', bg: '#DBEAFE', fg: '#1E40AF' },
  ZOOM: { label: '줌', bg: '#EDE9FE', fg: '#5B21B6' },
  MEETING: { label: '대면', bg: '#D1FAE5', fg: '#065F46' },
  OTHER: { label: '기타', bg: '#F3F4F6', fg: '#374151' },
}

const C = {
  page: { color: '#0F172A' },
  title: { color: '#0F172A' },
  muted: { color: '#64748B' },
  panel: { background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A' },
  th: { background: '#F1F5F9', color: '#334155', borderBottom: '1px solid #E2E8F0' },
  td: { color: '#0F172A', borderBottom: '1px solid #F1F5F9' },
  input: { background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A' },
  primary: { background: '#0284C7', color: '#FFFFFF', border: '1px solid #0284C7' },
  ghost: { background: '#FFFFFF', color: '#334155', border: '1px solid #CBD5E1' },
  danger: { background: '#FFFFFF', color: '#BE123C', border: '1px solid #FDA4AF' },
  overdue: { color: '#DC2626', fontWeight: 800 },
  open: { background: '#FEF3C7', color: '#92400E', border: '1px solid #FCD34D' },
  done: { background: '#E2E8F0', color: '#334155', border: '1px solid #CBD5E1' },
  error: { background: '#FFE4E6', color: '#9F1239' },
  overlay: { background: 'rgba(15, 23, 42, 0.45)' },
  section: { background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#1F2937' },
}

const SUMMARY_GUIDE = '누가·언제·무엇을·왜 — 상대 요청, 우리 제안, 가격·수량·일정 논의'

const pad = (n) => String(n).padStart(2, '0')
const nowLocal = () => {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
const todayStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
// 서버는 '2026-10-16T14:30:00+09:00' 형식(서울 시각)으로 준다
const fmtDateTime = (v) => (v ? String(v).slice(0, 16).replace('T', ' ') : '-')
const oneLine = (v) => (v ? String(v).replace(/\s+/g, ' ').trim() : '')

const emptyForm = (staffName) => ({
  partnerName: '',
  contactType: 'PHONE',
  occurredAt: nowLocal(),
  staffName: staffName || '',
  attendees: '',
  summary: '',
  agreements: '',
  nextAction: '',
  nextDue: '',
  createTask: false,
})

const formFromRow = (row) => ({
  partnerName: row.partner_name || '',
  contactType: row.contact_type || 'OTHER',
  occurredAt: row.occurred_at ? String(row.occurred_at).slice(0, 16) : nowLocal(),
  staffName: row.staff_name || '',
  attendees: row.attendees || '',
  summary: row.summary || '',
  agreements: row.agreements || '',
  nextAction: row.next_action || '',
  nextDue: row.next_due || '',
  createTask: false,
})

function TypeBadge({ type }) {
  const t = TYPES[type] || TYPES.OTHER
  return (
    <span className="inline-block rounded-full px-2 py-0.5 text-[11px] font-black" style={{ background: t.bg, color: t.fg }}>
      {t.label}
    </span>
  )
}

function Field({ label, required, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-black" style={{ color: '#334155' }}>
        {label}{required && <span style={{ color: '#DC2626' }}> *</span>}
      </span>
      {children}
    </label>
  )
}

function ContactForm({ initial, editing, onCancel, onSaved }) {
  const [form, setForm] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    if (busy) return
    if (!form.partnerName.trim() || !form.summary.trim() || !form.occurredAt) {
      setError('거래처, 일시, 논의 내용은 꼭 적어 주세요.')
      return
    }
    if (form.createTask && (!form.nextAction.trim() || !form.staffName.trim())) {
      setError('업무로 등록하려면 우리 담당자와 다음 할 일이 필요합니다.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const body = { ...form, nextDue: form.nextDue || null }
      const saved = editing ? await updateContactLog(editing.id, body) : await createContactLog(body)
      onSaved(saved)
    } catch (err) {
      setError(err?.response?.data?.message || '저장하지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const inputCls = 'w-full rounded-lg px-3 py-2 text-[13px] outline-none'
  const alreadyTask = editing?.related_task_id != null

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="거래처" required>
          <input className={inputCls} style={C.input} value={form.partnerName} onChange={set('partnerName')} placeholder="예: OO마트 구매팀" maxLength={200} />
        </Field>
        <Field label="일시" required>
          <input type="datetime-local" className={inputCls} style={C.input} value={form.occurredAt} onChange={set('occurredAt')} />
        </Field>
      </div>
      <Field label="방식" required>
        <div className="flex flex-wrap gap-2">
          {Object.entries(TYPES).map(([key, t]) => (
            <label key={key} className="flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-bold"
              style={form.contactType === key ? { background: t.bg, color: t.fg, border: `1px solid ${t.fg}` } : C.ghost}>
              <input type="radio" name="contactType" value={key} checked={form.contactType === key} onChange={set('contactType')} />
              {t.label}
            </label>
          ))}
        </div>
      </Field>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="우리 담당자">
          <input className={inputCls} style={C.input} value={form.staffName} onChange={set('staffName')} maxLength={100} />
        </Field>
        <Field label="상대 참석자">
          <input className={inputCls} style={C.input} value={form.attendees} onChange={set('attendees')} placeholder="이름 · 직함 (예: 김OO 바이어, 박OO 팀장)" />
        </Field>
      </div>
      <Field label="논의 내용" required>
        <textarea className={inputCls} style={C.input} rows={5} value={form.summary} onChange={set('summary')} placeholder={SUMMARY_GUIDE} />
      </Field>
      <Field label="합의 사항">
        <textarea className={inputCls} style={C.input} rows={3} value={form.agreements} onChange={set('agreements')} placeholder="양측이 확정한 내용 (가격·수량·납기·조건 등)" />
      </Field>
      <div className="grid gap-3 md:grid-cols-[1fr_180px]">
        <Field label="다음 할 일">
          <textarea className={inputCls} style={C.input} rows={2} value={form.nextAction} onChange={set('nextAction')} placeholder="예: 견적서 수정본 발송, 샘플 5박스 출고" />
        </Field>
        <Field label="기한">
          <input type="date" className={inputCls} style={C.input} value={form.nextDue} onChange={set('nextDue')} />
        </Field>
      </div>
      {alreadyTask ? (
        <p className="text-[12px] font-bold" style={C.muted}>이 기록은 이미 업무(#{editing.related_task_id})로 등록되어 있습니다.</p>
      ) : (
        <label className="flex cursor-pointer items-center gap-2 text-[13px] font-bold" style={{ color: '#0F172A' }}>
          <input type="checkbox" checked={form.createTask} onChange={set('createTask')} />
          다음 할 일을 담당자 업무로 등록
        </label>
      )}
      {error && <p className="rounded-lg px-3 py-2 text-[12.5px] font-bold" style={C.error}>{error}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} className="rounded-lg px-4 py-2 text-[13px] font-black" style={C.ghost}>취소</button>
        <button type="submit" disabled={busy} className="rounded-lg px-4 py-2 text-[13px] font-black" style={{ ...C.primary, opacity: busy ? 0.6 : 1 }}>
          {busy ? '저장 중…' : editing ? '수정 저장' : '기록 저장'}
        </button>
      </div>
    </form>
  )
}

function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4" style={C.overlay} onMouseDown={onClose}>
      <div className="my-8 w-full max-w-2xl rounded-2xl p-5 shadow-xl" style={C.panel} onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[17px] font-black" style={C.title}>{title}</h2>
          <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-[13px] font-black" style={C.ghost} aria-label="닫기">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function DetailSection({ title, body }) {
  if (!body) return null
  return (
    <div className="rounded-lg p-3" style={C.section}>
      <p className="mb-1 text-[11.5px] font-black" style={C.muted}>{title}</p>
      <p className="whitespace-pre-wrap text-[13px] leading-relaxed" style={{ color: '#1F2937' }}>{body}</p>
    </div>
  )
}

function Detail({ row, onEdit, onDelete, onToggle }) {
  const overdue = row.status === 'OPEN' && row.next_due && row.next_due < todayStr()
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-[12.5px]" style={C.muted}>
        <TypeBadge type={row.contact_type} />
        <span>{fmtDateTime(row.occurred_at)}</span>
        <span>· 우리 담당자 {row.staff_name || '-'}</span>
        <span>· 작성 {row.created_by || '-'}{row.source === 'AGENT' ? ' (AI)' : ''}</span>
        {row.related_task_id != null && <span>· 업무 #{row.related_task_id}</span>}
      </div>
      <DetailSection title="상대 참석자" body={row.attendees} />
      <DetailSection title="논의 내용" body={row.summary} />
      <DetailSection title="합의 사항" body={row.agreements} />
      <DetailSection title="다음 할 일" body={row.next_action} />
      {row.next_due && (
        <p className="text-[13px]" style={overdue ? C.overdue : { color: '#334155' }}>기한 {row.next_due}{overdue ? ' (지남)' : ''}</p>
      )}
      <div className="flex flex-wrap justify-end gap-2 pt-1">
        <button type="button" onClick={onDelete} className="rounded-lg px-4 py-2 text-[13px] font-black" style={C.danger}>삭제</button>
        <button type="button" onClick={onToggle} className="rounded-lg px-4 py-2 text-[13px] font-black" style={C.ghost}>
          {row.status === 'DONE' ? '진행으로 되돌리기' : '완료 처리'}
        </button>
        <button type="button" onClick={onEdit} className="rounded-lg px-4 py-2 text-[13px] font-black" style={C.primary}>수정</button>
      </div>
    </div>
  )
}

export default function ContactLogPage({ displayName, username }) {
  const me = displayName || username || ''
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [q, setQ] = useState('')
  const [type, setType] = useState('')
  const [staff, setStaff] = useState('')
  const [status, setStatus] = useState('')
  const [selected, setSelected] = useState(null)
  const [formState, setFormState] = useState(null) // { editing: row|null, initial }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getContactLogs({ q: q.trim() || undefined, status: status || undefined, limit: 500 })
      setRows(Array.isArray(data) ? data : [])
      setError('')
    } catch (e) {
      setError(e?.response?.data?.message || '기록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [q, status])

  useEffect(() => {
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
  }, [load])

  const staffOptions = useMemo(() => {
    const names = new Set(rows.map((r) => r.staff_name).filter(Boolean))
    if (me) names.add(me)
    return [...names].sort((a, b) => a.localeCompare(b, 'ko'))
  }, [rows, me])

  const visible = rows.filter((r) => (!type || r.contact_type === type) && (!staff || r.staff_name === staff))
  const today = todayStr()

  const toggleStatus = async (row) => {
    try {
      const updated = await setContactLogStatus(row.id, row.status === 'DONE' ? 'OPEN' : 'DONE')
      setRows((list) => list.map((r) => (r.id === row.id ? updated : r)))
      if (selected?.id === row.id) setSelected(updated)
    } catch (e) {
      setError(e?.response?.data?.message || '상태를 바꾸지 못했습니다.')
    }
  }

  const remove = async (row) => {
    if (!window.confirm(`'${row.partner_name}' 기록을 삭제할까요? 되돌릴 수 없습니다.`)) return
    try {
      await deleteContactLog(row.id)
      setSelected(null)
      load()
    } catch (e) {
      setError(e?.response?.data?.message || '삭제하지 못했습니다.')
    }
  }

  const onSaved = (saved) => {
    setFormState(null)
    setSelected(null)
    if (saved?.taskCreated) setNotice(`저장했습니다. 담당자 ${saved.staff_name}님에게 업무(#${saved.related_task_id})를 등록했습니다.`)
    else if (saved?.taskNote) setNotice(`저장했습니다. (${saved.taskNote})`)
    else setNotice('저장했습니다.')
    load()
  }

  const selectCls = 'h-9 rounded-lg px-2 text-[13px] outline-none'

  return (
    <div className="space-y-4" style={C.page}>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-black" style={C.title}>상담·미팅 기록</h1>
          <p className="text-[12.5px]" style={C.muted}>거래처와의 전화 상담 · 줌 · 대면 미팅 내용과 합의 사항, 다음 할 일을 남깁니다. AI 운영 에이전트도 이 기록을 보고 후속 업무를 챙깁니다.</p>
        </div>
        <button type="button" onClick={() => { setNotice(''); setFormState({ editing: null, initial: emptyForm(me) }) }}
          className="flex h-10 items-center gap-1 rounded-lg px-4 text-[13px] font-black" style={C.primary}>
          <span className="material-symbols-outlined text-[18px]">add</span>새 기록
        </button>
      </header>

      <div className="flex flex-wrap items-center gap-2 rounded-xl p-3" style={C.panel}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="거래처 검색"
          className="h-9 w-56 rounded-lg px-3 text-[13px] outline-none" style={C.input} />
        <select value={type} onChange={(e) => setType(e.target.value)} className={selectCls} style={C.input} aria-label="방식">
          <option value="">방식 전체</option>
          {Object.entries(TYPES).map(([key, t]) => <option key={key} value={key}>{t.label}</option>)}
        </select>
        <select value={staff} onChange={(e) => setStaff(e.target.value)} className={selectCls} style={C.input} aria-label="담당자">
          <option value="">담당자 전체</option>
          {staffOptions.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectCls} style={C.input} aria-label="상태">
          <option value="">상태 전체</option>
          <option value="OPEN">진행</option>
          <option value="DONE">완료</option>
        </select>
        <span className="ml-auto text-[12px]" style={C.muted}>{loading ? '불러오는 중…' : `${visible.length}건`}</span>
      </div>

      {error && <p className="rounded-lg px-3 py-2 text-[12.5px] font-bold" style={C.error}>{error}</p>}
      {notice && <p className="rounded-lg px-3 py-2 text-[12.5px] font-bold" style={{ background: '#DCFCE7', color: '#166534' }}>{notice}</p>}

      <div className="overflow-x-auto rounded-xl" style={C.panel}>
        <table className="w-full min-w-[960px] text-left text-[13px]">
          <thead>
            <tr>
              {['일시', '방식', '거래처', '우리 담당자', '논의 요약', '다음 할 일', '기한', '상태'].map((h) => (
                <th key={h} className="whitespace-nowrap px-3 py-2 text-[12px] font-black" style={C.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const overdue = r.status === 'OPEN' && r.next_due && r.next_due < today
              return (
                <tr key={r.id} className="cursor-pointer" onClick={() => setSelected(r)} style={{ background: '#FFFFFF' }}>
                  <td className="whitespace-nowrap px-3 py-2" style={C.td}>{fmtDateTime(r.occurred_at)}</td>
                  <td className="px-3 py-2" style={C.td}><TypeBadge type={r.contact_type} /></td>
                  <td className="max-w-[180px] truncate px-3 py-2 font-bold" style={C.td} title={r.partner_name}>{r.partner_name}</td>
                  <td className="whitespace-nowrap px-3 py-2" style={C.td}>{r.staff_name || '-'}</td>
                  <td className="max-w-[320px] truncate px-3 py-2" style={C.td} title={oneLine(r.summary)}>{oneLine(r.summary)}</td>
                  <td className="max-w-[220px] truncate px-3 py-2" style={C.td} title={oneLine(r.next_action)}>{oneLine(r.next_action) || '-'}</td>
                  <td className="whitespace-nowrap px-3 py-2" style={{ ...C.td, ...(overdue ? C.overdue : {}) }}>{r.next_due || '-'}</td>
                  <td className="px-3 py-2" style={C.td}>
                    <button type="button" onClick={(e) => { e.stopPropagation(); toggleStatus(r) }}
                      className="whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11.5px] font-black"
                      style={r.status === 'DONE' ? C.done : C.open} title="눌러서 진행/완료 전환">
                      {r.status === 'DONE' ? '완료' : '진행'}
                    </button>
                  </td>
                </tr>
              )
            })}
            {!loading && visible.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center" style={{ ...C.td, color: '#64748B' }}>기록이 없습니다. '새 기록'으로 상담·미팅 내용을 남겨 주세요.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && !formState && (
        <Modal title={selected.partner_name} onClose={() => setSelected(null)}>
          <Detail
            row={selected}
            onEdit={() => setFormState({ editing: selected, initial: formFromRow(selected) })}
            onDelete={() => remove(selected)}
            onToggle={() => toggleStatus(selected)}
          />
        </Modal>
      )}

      {formState && (
        <Modal title={formState.editing ? '상담·미팅 기록 수정' : '새 상담·미팅 기록'} onClose={() => setFormState(null)}>
          <ContactForm
            initial={formState.initial}
            editing={formState.editing}
            onCancel={() => setFormState(null)}
            onSaved={onSaved}
          />
        </Modal>
      )}
    </div>
  )
}
