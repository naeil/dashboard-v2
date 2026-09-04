import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getApprovers, submitPaymentApproval, getApprovalInbox, getMyApprovals,
  getApprovalDetail, actOnApproval,
} from '../../api/paymentApprovalApi'

const THRESHOLD = 300000
const PAY_METHODS = ['계좌이체', '카드결제', '선결제', '기타']

const won = (v) => `${Math.round(Number(String(v ?? 0).replace(/,/g, '')) || 0).toLocaleString('ko-KR')}원`
const num = (v) => Number(String(v ?? 0).replace(/,/g, '')) || 0
const dayFull = (v) => (v ? String(v).slice(0, 10) : '-')
const todayStr = () => new Date().toISOString().slice(0, 10)

const STATUS = {
  SUBMITTED: { label: '1차 승인 대기', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  REVIEWING: { label: '2차 최종 승인 대기', cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  CASH_APPLIED: { label: '승인 완료 · 자금반영', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  REJECTED: { label: '반려', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
}
function StatusBadge({ status }) {
  const s = STATUS[status] || { label: status, cls: 'bg-slate-50 text-slate-600 border-slate-200' }
  return <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-black ${s.cls}`}>{s.label}</span>
}

const input = 'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:border-sky-400 focus:outline-none'
const cellLabel = 'bg-slate-50 px-3 py-2.5 text-[12px] font-black text-slate-500 align-middle w-32'
const cellField = 'px-2 py-2'

function Row({ label, children }) {
  return (
    <tr className="border-b border-slate-100">
      <td className={cellLabel}>{label}</td>
      <td className={cellField}>{children}</td>
    </tr>
  )
}

/* ─────────── 결의 작성 (다우오피스 지출결의서) ─────────── */
function WriteForm({ approvers, me, onSubmitted }) {
  const [f, setF] = useState({
    title: '', counterparty: '', amount: '', detailReason: '',
    expenseItem1: '', expenseItem2: '', scheduledDate: todayStr(),
    payMethod: '계좌이체', payBank: '', accountHolder: '', accountNumber: '',
    expenseCategory: '운영비', evidenceUrl: '', urgent: false,
    approver1Username: '', approver2Username: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (patch) => setF((prev) => ({ ...prev, ...patch }))
  const needTwo = num(f.amount) > THRESHOLD

  const submit = async () => {
    setError('')
    if (!f.title.trim()) { setError('제목을 입력하세요.'); return }
    if (num(f.amount) <= 0) { setError('금액을 입력하세요.'); return }
    if (!f.approver1Username) { setError('1차 승인자를 지정하세요.'); return }
    if (needTwo && !f.approver2Username) { setError(`${won(THRESHOLD)} 초과 결의는 2차 최종 승인자를 지정해야 합니다.`); return }
    setSaving(true)
    try {
      const res = await submitPaymentApproval({ ...f, amount: num(f.amount) })
      if (res.success === false) throw new Error(res.message)
      onSubmitted()
    } catch (e) {
      setError(e?.response?.data?.message || e.message || '제출에 실패했습니다.')
    } finally { setSaving(false) }
  }

  const approverOptions = approvers.filter((a) => a.username !== me)

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-3 rounded-lg border border-slate-200 bg-white overflow-hidden">
        <p className="border-b border-slate-100 bg-slate-50 px-4 py-3 text-center text-base font-black text-slate-900">지출결의서</p>
        <div className="grid grid-cols-2 gap-x-4 px-4 py-3 text-[12px]">
          <div className="flex justify-between border-b border-slate-100 py-1.5"><span className="font-black text-slate-500">작성일자</span><span className="text-slate-700">{todayStr()}</span></div>
          <div className="flex justify-between border-b border-slate-100 py-1.5"><span className="font-black text-slate-500">신청자</span><span className="text-slate-700">{me}</span></div>
        </div>
        <table className="w-full table-fixed">
          <tbody>
            <Row label="제목"><input className={input} value={f.title} onChange={(e) => set({ title: e.target.value })} placeholder="예) 9월 물류비 정산" /></Row>
            <Row label="지출처(기업명)"><input className={input} value={f.counterparty} onChange={(e) => set({ counterparty: e.target.value })} placeholder="거래처명" /></Row>
            <Row label="금액"><input className={input} inputMode="numeric" value={f.amount} onChange={(e) => set({ amount: e.target.value })} placeholder="0" />
              {num(f.amount) > 0 && <p className="mt-1 text-[11px] font-bold text-slate-500">{won(f.amount)} {needTwo ? '· 2차 최종 승인 필요' : `· ${won(THRESHOLD)} 이하 1차 전결`}</p>}
            </Row>
            <Row label="지출사유"><textarea className="min-h-[90px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-sky-400 focus:outline-none" value={f.detailReason} onChange={(e) => set({ detailReason: e.target.value })} placeholder="지출 사유를 입력하세요." /></Row>
            <Row label="지출항목1"><input className={input} value={f.expenseItem1} onChange={(e) => set({ expenseItem1: e.target.value })} /></Row>
            <Row label="지출항목2"><input className={input} value={f.expenseItem2} onChange={(e) => set({ expenseItem2: e.target.value })} /></Row>
            <Row label="지급요청일"><input type="date" className={input} value={f.scheduledDate} onChange={(e) => set({ scheduledDate: e.target.value })} /></Row>
            <Row label="지급방법">
              <div className="flex flex-wrap gap-3 py-1">
                {PAY_METHODS.map((m) => (
                  <label key={m} className="flex items-center gap-1.5 text-[13px] font-bold text-slate-600">
                    <input type="radio" name="payMethod" checked={f.payMethod === m} onChange={() => set({ payMethod: m })} className="accent-sky-500" /> {m}
                  </label>
                ))}
              </div>
            </Row>
            <Row label="지급은행"><input className={input} value={f.payBank} onChange={(e) => set({ payBank: e.target.value })} /></Row>
            <Row label="예금주"><input className={input} value={f.accountHolder} onChange={(e) => set({ accountHolder: e.target.value })} /></Row>
            <Row label="계좌번호"><input className={input} value={f.accountNumber} onChange={(e) => set({ accountNumber: e.target.value })} /></Row>
            <Row label="증빙 링크"><input className={input} value={f.evidenceUrl} onChange={(e) => set({ evidenceUrl: e.target.value })} placeholder="영수증·견적서 URL (선택)" /></Row>
          </tbody>
        </table>
      </div>

      {/* 결재선 */}
      <div className="mb-3 rounded-lg border border-slate-200 bg-white p-4">
        <p className="mb-3 text-sm font-black text-slate-800">결재선 지정</p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-[12px] font-black text-slate-500">1차 승인자 *</span>
            <select className={input} value={f.approver1Username} onChange={(e) => set({ approver1Username: e.target.value })}>
              <option value="">선택</option>
              {approverOptions.map((a) => <option key={a.username} value={a.username}>{a.display_name} ({a.role === 'EXECUTIVE' ? '대표' : '팀장'} · {a.department})</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[12px] font-black text-slate-500">2차 최종 승인자 {needTwo ? '*' : '(선택)'}</span>
            <select className={input} value={f.approver2Username} onChange={(e) => set({ approver2Username: e.target.value })}>
              <option value="">{needTwo ? '선택' : '없음 (1차 전결)'}</option>
              {approverOptions.map((a) => <option key={a.username} value={a.username}>{a.display_name} ({a.role === 'EXECUTIVE' ? '대표' : '팀장'} · {a.department})</option>)}
            </select>
          </label>
        </div>
        <p className="mt-2 text-[11px] font-bold text-slate-400">{won(THRESHOLD)} 이하는 1차 승인자 전결(1단계), 초과는 2차 최종 승인까지(2단계) 진행됩니다.</p>
      </div>

      {error && <div className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-[13px] font-bold text-rose-600">{error}</div>}
      <div className="flex items-center justify-end gap-2 pb-6">
        <label className="mr-auto flex items-center gap-1.5 text-[13px] font-bold text-slate-600">
          <input type="checkbox" checked={f.urgent} onChange={(e) => set({ urgent: e.target.checked })} className="accent-rose-500" /> 긴급
        </label>
        <button type="button" disabled={saving} onClick={submit}
          className="rounded-lg bg-sky-500 px-6 py-2.5 text-sm font-black text-white hover:bg-sky-600 disabled:opacity-50">
          {saving ? '제출 중…' : '결재 상신'}
        </button>
      </div>
    </div>
  )
}

/* ─────────── 상세 모달 (결재/이력) ─────────── */
function DetailModal({ id, onClose, onActed, canAct }) {
  const [d, setD] = useState(null)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  useEffect(() => { getApprovalDetail(id).then(setD).catch(() => {}) }, [id])

  const act = async (action) => {
    setError(''); setBusy(action)
    try {
      const res = await actOnApproval(id, action, comment)
      if (res.success === false) throw new Error(res.message)
      onActed(res.message)
    } catch (e) {
      setError(e?.response?.data?.message || e.message || '처리에 실패했습니다.')
    } finally { setBusy('') }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="my-8 w-full max-w-2xl rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <p className="text-sm font-black text-slate-900">지출결의서 상세</p>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700"><span className="material-symbols-outlined">close</span></button>
        </div>
        {!d ? <p className="py-16 text-center text-sm text-slate-400">불러오는 중…</p> : (
          <div className="px-5 py-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-lg font-black text-slate-900">{d.title || d.purpose}</p>
              <StatusBadge status={d.status} />
            </div>
            <table className="w-full table-fixed text-[13px]">
              <tbody>
                <Row label="지출처"><span className="text-slate-700">{d.counterparty || '-'}</span></Row>
                <Row label="금액"><span className="font-black text-rose-600">{won(d.amount)}</span></Row>
                <Row label="지출사유"><span className="whitespace-pre-wrap text-slate-700">{d.detail_reason || '-'}</span></Row>
                <Row label="지출항목"><span className="text-slate-700">{[d.expense_item1, d.expense_item2].filter(Boolean).join(' / ') || '-'}</span></Row>
                <Row label="지급요청일"><span className="text-slate-700">{dayFull(d.scheduled_date)}</span></Row>
                <Row label="지급방법"><span className="text-slate-700">{d.pay_method || '-'}</span></Row>
                <Row label="입금계좌"><span className="text-slate-700">{[d.pay_bank, d.account_holder, d.account_number].filter(Boolean).join(' · ') || '-'}</span></Row>
                <Row label="기안자"><span className="text-slate-700">{d.requester_name} · {dayFull(d.request_date)}</span></Row>
                <Row label="결재선"><span className="text-slate-700">1차 {d.approver1_name || '-'}{d.approver2_name ? ` → 2차 ${d.approver2_name}` : ' (1차 전결)'}</span></Row>
                {d.evidence_url && <Row label="증빙"><a href={d.evidence_url} target="_blank" rel="noreferrer" className="font-bold text-sky-600 hover:underline">첨부 보기</a></Row>}
              </tbody>
            </table>

            {/* 결재 이력 */}
            {(d.steps || []).length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-[12px] font-black text-slate-500">결재 이력</p>
                <div className="space-y-1.5">
                  {d.steps.map((s, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-[12px]">
                      <span className={`rounded px-1.5 py-0.5 font-black ${s.action === 'REJECT' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>{s.step_no}차 {s.action === 'REJECT' ? '반려' : '승인'}</span>
                      <span className="font-bold text-slate-700">{s.approver_name}</span>
                      {s.comment && <span className="text-slate-500">· {s.comment}</span>}
                      <span className="ml-auto text-slate-400">{dayFull(s.acted_at)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 결재 액션 */}
            {canAct && (d.status === 'SUBMITTED' || d.status === 'REVIEWING') && (
              <div className="mt-4 border-t border-slate-100 pt-4">
                <input className={`${input} mb-2`} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="의견 (선택)" />
                {error && <div className="mb-2 rounded-lg bg-rose-50 px-3 py-2 text-[12px] font-bold text-rose-600">{error}</div>}
                <div className="flex justify-end gap-2">
                  <button type="button" disabled={busy} onClick={() => act('REJECT')}
                    className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-black text-rose-600 hover:bg-rose-100 disabled:opacity-50">반려</button>
                  <button type="button" disabled={busy} onClick={() => act('APPROVE')}
                    className="rounded-lg bg-sky-500 px-5 py-2 text-sm font-black text-white hover:bg-sky-600 disabled:opacity-50">{busy === 'APPROVE' ? '처리 중…' : '승인'}</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─────────── 목록 행 ─────────── */
function ReqRow({ r, onOpen }) {
  return (
    <tr className="cursor-pointer border-b border-slate-50 last:border-0 hover:bg-sky-50/40" onClick={() => onOpen(r.id)}>
      <td className="px-3 py-2.5">
        <p className="text-[13px] font-black text-slate-800">{r.title || r.purpose}{r.urgent && <span className="ml-1 rounded bg-rose-50 px-1 text-[10px] font-black text-rose-600">긴급</span>}</p>
        <p className="text-[11px] text-slate-400">{r.counterparty || '-'} · 기안 {r.requester_name}</p>
      </td>
      <td className="px-3 py-2.5 text-right text-[13px] font-black text-rose-600">{won(r.amount)}</td>
      <td className="px-3 py-2.5 text-center text-[12px] text-slate-500">{dayFull(r.scheduled_date)}</td>
      <td className="px-3 py-2.5 text-center"><StatusBadge status={r.status} /></td>
    </tr>
  )
}

/* ─────────── 메인 ─────────── */
export default function EApprovalPage({ username = 'admin' }) {
  const [tab, setTab] = useState('inbox')
  const [approvers, setApprovers] = useState([])
  const [inbox, setInbox] = useState([])
  const [mine, setMine] = useState([])
  const [loading, setLoading] = useState(true)
  const [detailId, setDetailId] = useState(null)
  const [flash, setFlash] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([getApprovalInbox().catch(() => []), getMyApprovals().catch(() => [])])
      .then(([i, m]) => { setInbox(i || []); setMine(m || []) })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { getApprovers().then(setApprovers).catch(() => {}) }, [])
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t) }, [load])

  const tabs = useMemo(() => ([
    { id: 'inbox', label: `결재함${inbox.length ? ` (${inbox.length})` : ''}` },
    { id: 'write', label: '결의 작성' },
    { id: 'mine', label: '내가 올린 결의' },
  ]), [inbox.length])

  const openDetail = (id) => setDetailId(id)
  const onActed = (msg) => { setDetailId(null); setFlash(msg || '처리했습니다.'); load(); setTimeout(() => setFlash(''), 4000) }

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4">
        <h1 className="text-lg font-black text-slate-900">지출결의 · 전자결재</h1>
        <p className="mt-0.5 text-[12px] text-slate-400">결의를 올리면 결재선(1차 → 2차)에 따라 승인되고, 최종 승인 시 [자금 현황]에 자동 반영됩니다.</p>
      </div>

      {flash && <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[13px] font-bold text-emerald-700">{flash}</div>}

      <div className="mb-4 flex gap-1 border-b border-slate-200">
        {tabs.map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-black ${tab === t.id ? 'border-sky-500 text-sky-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'write' && <WriteForm approvers={approvers} me={username} onSubmitted={() => { setTab('mine'); load() }} />}

      {tab === 'inbox' && (
        <div className="rounded-xl border border-slate-200 bg-white">
          {loading ? <p className="py-12 text-center text-sm text-slate-400">불러오는 중…</p>
            : inbox.length === 0 ? <p className="py-12 text-center text-sm text-slate-400">지금 결재할 결의가 없습니다.</p>
            : (
              <table className="w-full">
                <thead><tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400">
                  <th className="px-3 py-2.5 text-left">결의</th><th className="px-3 py-2.5 text-right">금액</th><th className="px-3 py-2.5 text-center">지급요청일</th><th className="px-3 py-2.5 text-center">상태</th>
                </tr></thead>
                <tbody>{inbox.map((r) => <ReqRow key={r.id} r={r} onOpen={openDetail} />)}</tbody>
              </table>
            )}
        </div>
      )}

      {tab === 'mine' && (
        <div className="rounded-xl border border-slate-200 bg-white">
          {loading ? <p className="py-12 text-center text-sm text-slate-400">불러오는 중…</p>
            : mine.length === 0 ? <p className="py-12 text-center text-sm text-slate-400">올린 결의가 없습니다. [결의 작성]에서 시작하세요.</p>
            : (
              <table className="w-full">
                <thead><tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400">
                  <th className="px-3 py-2.5 text-left">결의</th><th className="px-3 py-2.5 text-right">금액</th><th className="px-3 py-2.5 text-center">지급요청일</th><th className="px-3 py-2.5 text-center">상태</th>
                </tr></thead>
                <tbody>{mine.map((r) => <ReqRow key={r.id} r={r} onOpen={openDetail} />)}</tbody>
              </table>
            )}
        </div>
      )}

      {detailId && <DetailModal id={detailId} canAct={tab === 'inbox'} onClose={() => setDetailId(null)} onActed={onActed} />}
    </div>
  )
}
