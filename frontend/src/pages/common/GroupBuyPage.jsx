import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  addGroupBuyEvent,
  createGroupBuy,
  decideGroupBuy,
  deleteGroupBuyEvent,
  getGroupBuys,
  getGroupBuySchedule,
  setGroupBuyEventDone,
  setGroupBuyStatus,
} from '../../api/groupBuyApi'

// AI 공동구매: 운영 에이전트가 올린 공구 회신을 실무진이 판단(승인·수수료·일정)하고, 일정별로 누가 무엇을 하는지 본다.
// 앱의 라이트/다크 테마 덮어쓰기에 영향받지 않도록 색은 인라인 스타일로 고정한다(상담·미팅 기록과 같은 방식).

export const OWNERS = ['이수현', '한은엽', '대표']
export const DEAL_TYPES = {
  COMMISSION: '수수료형',
  CONSIGN: '위탁',
  BUY: '사입',
}
export const STATUS = {
  PENDING: { label: '판단 대기', bg: '#FEF3C7', fg: '#92400E' },
  APPROVED: { label: '승인', bg: '#D1FAE5', fg: '#065F46' },
  RUNNING: { label: '진행 중', bg: '#DBEAFE', fg: '#1E40AF' },
  HOLD: { label: '보류', bg: '#F3F4F6', fg: '#374151' },
  REJECTED: { label: '거절', bg: '#FFE4E6', fg: '#9F1239' },
  DONE: { label: '종료', bg: '#E2E8F0', fg: '#334155' },
  CANCELLED: { label: '취소', bg: '#F1F5F9', fg: '#64748B' },
}

export const C = {
  text: { color: '#0F172A' },
  muted: { color: '#64748B' },
  panel: { background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A' },
  soft: { background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#1F2937' },
  input: { background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A' },
  primary: { background: '#0284C7', color: '#FFFFFF', border: '1px solid #0284C7' },
  ghost: { background: '#FFFFFF', color: '#334155', border: '1px solid #CBD5E1' },
  error: { background: '#FFE4E6', color: '#9F1239' },
  th: { background: '#F1F5F9', color: '#334155', borderBottom: '1px solid #E2E8F0' },
  td: { color: '#0F172A', borderBottom: '1px solid #F1F5F9' },
  today: { background: '#E0F2FE', color: '#075985' },
  overlay: { background: 'rgba(15, 23, 42, 0.45)' },
}

const todayStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const errMsg = (e) => e?.response?.data?.message || e?.message || '저장하지 못했습니다.'
const won = (v) => (v === null || v === undefined || v === '' ? '-' : `${Number(v).toLocaleString('ko-KR')}원`)
const weekday = (s) => ['일', '월', '화', '수', '목', '금', '토'][new Date(`${s}T00:00:00`).getDay()]

export function StatusBadge({ status }) {
  const s = STATUS[status] || STATUS.PENDING
  return <span className="inline-block rounded-full px-2 py-0.5 text-[11px] font-black" style={{ background: s.bg, color: s.fg }}>{s.label}</span>
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-black" style={{ color: '#334155' }}>{label}</span>
      {children}
    </label>
  )
}

const inputCls = 'w-full rounded-lg px-2.5 py-1.5 text-[13px]'

/** 조건 판단 입력: 승인/보류/거절 + 거래 방식·수수료율·판매가·일정·담당자. 관제실에서도 그대로 쓴다. */
export function DecisionForm({ deal, onSaved, compact = false }) {
  const [f, setF] = useState({
    decision: 'APPROVE',
    dealType: deal.deal_type || 'COMMISSION',
    commissionRate: deal.commission_rate ?? '',
    salePrice: deal.sale_price ?? '',
    startDate: deal.start_date || '',
    endDate: deal.end_date || '',
    ownerName: deal.owner_name || '이수현',
    memo: '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }))
  const approve = f.decision === 'APPROVE'

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      const body = approve ? f : { decision: f.decision, ownerName: f.ownerName, memo: f.memo }
      const saved = await decideGroupBuy(deal.id, body)
      onSaved?.(saved)
    } catch (err) {
      setError(errMsg(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2.5">
      <div className="flex flex-wrap gap-1.5">
        {[['APPROVE', '승인'], ['HOLD', '보류'], ['REJECT', '거절']].map(([k, label]) => (
          <button key={k} type="button" onClick={() => setF((p) => ({ ...p, decision: k }))}
            className="rounded-lg px-3 py-1.5 text-[12.5px] font-black"
            style={f.decision === k ? C.primary : C.ghost}>{label}</button>
        ))}
      </div>
      {approve && (
        <div className={`grid gap-2 ${compact ? 'grid-cols-2' : 'md:grid-cols-3'}`}>
          <Field label="거래 방식">
            <select value={f.dealType} onChange={set('dealType')} className={inputCls} style={C.input}>
              {Object.entries(DEAL_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label={f.dealType === 'COMMISSION' ? '수수료율(%)' : '수수료율(%) · 선택'}>
            <input type="number" step="0.5" min="0" max="100" value={f.commissionRate} onChange={set('commissionRate')}
              placeholder="예: 15" className={inputCls} style={C.input} />
          </Field>
          <Field label="공구 판매가(원)">
            <input type="number" min="0" value={f.salePrice} onChange={set('salePrice')} placeholder="예: 23900" className={inputCls} style={C.input} />
          </Field>
          <Field label="공구 시작일">
            <input type="date" value={f.startDate} onChange={set('startDate')} className={inputCls} style={C.input} />
          </Field>
          <Field label="공구 마감일">
            <input type="date" value={f.endDate} onChange={set('endDate')} className={inputCls} style={C.input} />
          </Field>
          <Field label="담당자">
            <select value={f.ownerName} onChange={set('ownerName')} className={inputCls} style={C.input}>
              {OWNERS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </Field>
        </div>
      )}
      {!approve && (
        <Field label="담당자">
          <select value={f.ownerName} onChange={set('ownerName')} className={inputCls} style={C.input}>
            {OWNERS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </Field>
      )}
      <Field label={approve ? '메모 (판단 이유·셀러에게 안내할 내용)' : `${f.decision === 'HOLD' ? '보류' : '거절'} 사유 (필수) — 상담·미팅 기록에 남습니다`}>
        <input value={f.memo} onChange={set('memo')} className={inputCls} style={C.input}
          placeholder={approve ? '예: 샘플 먼저 발송, 게시물 검수 후 오픈' : '예: 유료 포스팅만 가능해 보류'} />
      </Field>
      {approve && <p className="text-[11.5px]" style={C.muted}>승인하면 샘플 발송(D-14)·게시물 검수(D-3)·판매 준비(D-2)·오픈·마감·판매수량 확인(+1)·정산(+7) 일정이 담당자 이름으로 자동 등록됩니다.</p>}
      {error && <p className="rounded-lg px-3 py-2 text-[12.5px] font-bold" style={C.error}>{error}</p>}
      <div className="flex justify-end">
        <button type="submit" disabled={busy} className="rounded-lg px-4 py-1.5 text-[13px] font-black" style={{ ...C.primary, opacity: busy ? 0.6 : 1 }}>
          {busy ? '저장 중…' : '판단 저장'}
        </button>
      </div>
    </form>
  )
}

export function DealHead({ deal }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="text-[14px] font-black" style={C.text}>{deal.seller_name}</p>
        <p className="text-[11.5px]" style={C.muted}>
          {[deal.channel, deal.contact_email, deal.owner_name && `담당 ${deal.owner_name}`].filter(Boolean).join(' · ')}
        </p>
      </div>
      <StatusBadge status={deal.status} />
    </div>
  )
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4" style={C.overlay} onMouseDown={onClose}>
      <div className="my-8 w-full max-w-2xl rounded-2xl p-5 shadow-xl" style={C.panel} onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[17px] font-black" style={C.text}>{title}</h2>
          <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-[13px] font-black" style={C.ghost} aria-label="닫기">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function NewDealForm({ onSaved, onCancel }) {
  const [f, setF] = useState({ sellerName: '', channel: '인스타그램', contactEmail: '', ownerName: '이수현', requestSummary: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }))
  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setError('')
    try { onSaved(await createGroupBuy(f)) } catch (err) { setError(errMsg(err)) } finally { setBusy(false) }
  }
  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="셀러·채널명 *"><input required value={f.sellerName} onChange={set('sellerName')} className={inputCls} style={C.input} /></Field>
        <Field label="플랫폼">
          <select value={f.channel} onChange={set('channel')} className={inputCls} style={C.input}>
            {['인스타그램', '유튜브', '블로그', '카페·커뮤니티', '라이브커머스', '기타'].map((x) => <option key={x}>{x}</option>)}
          </select>
        </Field>
        <Field label="업무용 연락처(메일)"><input value={f.contactEmail} onChange={set('contactEmail')} className={inputCls} style={C.input} /></Field>
        <Field label="담당자">
          <select value={f.ownerName} onChange={set('ownerName')} className={inputCls} style={C.input}>{OWNERS.map((o) => <option key={o}>{o}</option>)}</select>
        </Field>
      </div>
      <Field label="셀러 요청 내용">
        <textarea rows={3} value={f.requestSummary} onChange={set('requestSummary')} className={inputCls} style={C.input} />
      </Field>
      {error && <p className="rounded-lg px-3 py-2 text-[12.5px] font-bold" style={C.error}>{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-lg px-4 py-2 text-[13px] font-black" style={C.ghost}>취소</button>
        <button type="submit" disabled={busy} className="rounded-lg px-4 py-2 text-[13px] font-black" style={C.primary}>등록</button>
      </div>
    </form>
  )
}

function DealDetail({ deal, onChanged }) {
  const [ev, setEv] = useState({ eventDate: todayStr(), title: '', ownerName: deal.owner_name || '이수현' })
  const [error, setError] = useState('')
  const run = async (fn) => { setError(''); try { onChanged(await fn()) } catch (e) { setError(errMsg(e)) } }
  return (
    <div className="space-y-3">
      <DealHead deal={deal} />
      <div className="grid gap-2 rounded-lg p-3 text-[12.5px] md:grid-cols-3" style={C.soft}>
        <p><b>거래 방식</b> {DEAL_TYPES[deal.deal_type] || '-'}</p>
        <p><b>수수료율</b> {deal.commission_rate != null ? `${Number(deal.commission_rate)}%` : '-'}</p>
        <p><b>공구 판매가</b> {won(deal.sale_price)}</p>
        <p><b>기간</b> {deal.start_date ? `${deal.start_date} ~ ${deal.end_date}` : '-'}</p>
        <p><b>판단</b> {deal.decided_by ? `${deal.decided_by} (${String(deal.decided_at).slice(0, 10)})` : '-'}</p>
        <p><b>등록</b> {deal.source === 'AGENT' ? 'AI 에이전트' : '직접 등록'}</p>
      </div>
      {deal.request_summary && <p className="whitespace-pre-wrap rounded-lg p-3 text-[12.5px]" style={C.soft}>{deal.request_summary}</p>}
      {deal.memo && <p className="text-[12.5px]" style={C.text}><b>메모</b> {deal.memo}</p>}
      <div className="flex flex-wrap gap-1.5">
        {['RUNNING', 'DONE', 'HOLD', 'CANCELLED'].map((s) => (
          <button key={s} type="button" onClick={() => run(() => setGroupBuyStatus(deal.id, s))}
            className="rounded-lg px-3 py-1 text-[12px] font-black" style={C.ghost}>{STATUS[s].label}로 변경</button>
        ))}
      </div>
      {deal.status === 'PENDING' || deal.status === 'HOLD'
        ? <div className="rounded-xl p-3" style={C.soft}><DecisionForm deal={deal} onSaved={onChanged} /></div>
        : null}
      <div>
        <p className="mb-1 text-[12.5px] font-black" style={C.text}>일정</p>
        <ul className="space-y-1">
          {(deal.events || []).map((e) => (
            <li key={e.id} className="flex items-center gap-2 text-[12.5px]" style={C.text}>
              <input type="checkbox" checked={!!e.done} onChange={() => run(() => setGroupBuyEventDone(e.id, !e.done))} />
              <span className="w-24 tabular-nums" style={C.muted}>{e.event_date}</span>
              <span style={{ textDecoration: e.done ? 'line-through' : 'none' }}>{e.title}</span>
              <span style={C.muted}>· {e.owner_name || deal.owner_name}</span>
              {!e.auto && <button type="button" onClick={() => run(() => deleteGroupBuyEvent(e.id))} className="ml-auto text-[11px]" style={{ color: '#BE123C' }}>삭제</button>}
            </li>
          ))}
          {!(deal.events || []).length && <li className="text-[12px]" style={C.muted}>승인하면 일정이 자동으로 생깁니다.</li>}
        </ul>
        <div className="mt-2 grid gap-2 md:grid-cols-[140px_1fr_110px_auto]">
          <input type="date" value={ev.eventDate} onChange={(e) => setEv((p) => ({ ...p, eventDate: e.target.value }))} className={inputCls} style={C.input} />
          <input value={ev.title} onChange={(e) => setEv((p) => ({ ...p, title: e.target.value }))} placeholder="할 일 추가 (예: 라이브 리허설)" className={inputCls} style={C.input} />
          <select value={ev.ownerName} onChange={(e) => setEv((p) => ({ ...p, ownerName: e.target.value }))} className={inputCls} style={C.input}>{OWNERS.map((o) => <option key={o}>{o}</option>)}</select>
          <button type="button" disabled={!ev.title} onClick={() => run(async () => { const r = await addGroupBuyEvent(deal.id, ev); setEv((p) => ({ ...p, title: '' })); return r })}
            className="rounded-lg px-3 py-1.5 text-[12.5px] font-black" style={C.primary}>추가</button>
        </div>
      </div>
      {error && <p className="rounded-lg px-3 py-2 text-[12.5px] font-bold" style={C.error}>{error}</p>}
    </div>
  )
}

export default function GroupBuyPage() {
  const [tab, setTab] = useState('pending')
  const [deals, setDeals] = useState([])
  const [schedule, setSchedule] = useState([])
  const [owner, setOwner] = useState('')
  const [error, setError] = useState('')
  const [openId, setOpenId] = useState(null)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    try {
      const [d, s] = await Promise.all([getGroupBuys(), getGroupBuySchedule()])
      setDeals(Array.isArray(d) ? d : []); setSchedule(Array.isArray(s) ? s : []); setError('')
    } catch (e) { setError(errMsg(e)) }
  }, [])
  useEffect(() => {
    load()
    const t = setInterval(load, 30000)   // 다른 직원·AI가 바꾼 내용을 30초마다 반영
    return () => clearInterval(t)
  }, [load])

  const pending = deals.filter((d) => d.status === 'PENDING')
  const running = deals.filter((d) => ['APPROVED', 'RUNNING'].includes(d.status))
  const today = todayStr()
  const sched = schedule.filter((e) => !owner || e.owner_name === owner)
  const todayOpen = schedule.filter((e) => e.event_date <= today && !e.done).length
  const byDate = useMemo(() => {
    const m = new Map()
    for (const e of sched) { if (!m.has(e.event_date)) m.set(e.event_date, []); m.get(e.event_date).push(e) }
    return [...m.entries()]
  }, [sched])
  const openDeal = deals.find((d) => d.id === openId)
  const replace = (saved) => { setDeals((p) => p.map((d) => (d.id === saved.id ? saved : d))); load() }

  return (
    <div className="min-h-full p-4 md:p-6" style={{ background: '#F8FAFC' }}>
      <div className="mx-auto max-w-[1400px] space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-[22px] font-black" style={C.text}>AI 공동구매</h1>
            <p className="text-[12.5px]" style={C.muted}>AI가 받은 공구 회신을 판단(승인·수수료·일정)하고, 일정별로 누가 무엇을 하는지 실시간으로 봅니다. 30초마다 자동 갱신.</p>
          </div>
          <button type="button" onClick={() => setCreating(true)} className="rounded-lg px-4 py-2 text-[13px] font-black" style={C.primary}>+ 직접 등록</button>
        </header>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {[['판단 대기', pending.length, '#B45309'], ['진행 중', running.length, '#1D4ED8'], ['오늘까지 할 일', todayOpen, '#BE123C'], ['전체', deals.length, '#0F172A']].map(([l, v, c]) => (
            <div key={l} className="rounded-xl px-4 py-3" style={C.panel}>
              <p className="text-[11.5px] font-bold" style={C.muted}>{l}</p>
              <p className="text-[24px] font-black tabular-nums" style={{ color: c }}>{v}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {[['pending', `판단 대기 (${pending.length})`], ['schedule', '일정'], ['all', '전체 목록']].map(([k, l]) => (
            <button key={k} type="button" onClick={() => setTab(k)} className="rounded-full px-4 py-1.5 text-[13px] font-black"
              style={tab === k ? C.primary : C.ghost}>{l}</button>
          ))}
        </div>
        {error && <p className="rounded-lg px-3 py-2 text-[12.5px] font-bold" style={C.error}>{error}</p>}

        {tab === 'pending' && (
          pending.length === 0
            ? <p className="rounded-xl p-6 text-center text-[13px]" style={{ ...C.panel, ...C.muted }}>판단할 공동구매가 없습니다.</p>
            : (
              <div className="grid gap-3 xl:grid-cols-2">
                {pending.map((d) => (
                  <div key={d.id} className="space-y-3 rounded-2xl p-4" style={C.panel}>
                    <DealHead deal={d} />
                    {d.request_summary && <p className="max-h-28 overflow-y-auto whitespace-pre-wrap rounded-lg p-2.5 text-[12.5px]" style={C.soft}>{d.request_summary}</p>}
                    <DecisionForm deal={d} onSaved={replace} />
                  </div>
                ))}
              </div>
            )
        )}

        {tab === 'schedule' && (
          <div className="space-y-3 rounded-2xl p-4" style={C.panel}>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[12px] font-black" style={C.muted}>담당자</span>
              {['', ...OWNERS].map((o) => (
                <button key={o || 'all'} type="button" onClick={() => setOwner(o)} className="rounded-full px-3 py-1 text-[12px] font-black"
                  style={owner === o ? C.primary : C.ghost}>{o || '전체'}</button>
              ))}
            </div>
            {byDate.length === 0 && <p className="text-[13px]" style={C.muted}>예정된 일정이 없습니다. 판단 대기 건을 승인하면 일정이 생깁니다.</p>}
            {byDate.map(([date, items]) => (
              <div key={date}>
                <p className="mb-1 inline-block rounded px-2 py-0.5 text-[12.5px] font-black" style={date === today ? C.today : { color: date < today ? '#94A3B8' : '#0F172A' }}>
                  {date} ({weekday(date)}){date === today ? ' · 오늘' : ''}
                </p>
                <ul className="divide-y" style={{ borderColor: '#F1F5F9' }}>
                  {items.map((e) => {
                    const late = !e.done && e.event_date < today
                    return (
                      <li key={e.id} className="flex flex-wrap items-center gap-2 py-1.5 text-[13px]" style={C.text}>
                        <input type="checkbox" checked={!!e.done} onChange={async () => { try { await setGroupBuyEventDone(e.id, !e.done); load() } catch (er) { setError(errMsg(er)) } }} />
                        <button type="button" onClick={() => setOpenId(e.deal_id)} className="font-black underline-offset-2 hover:underline" style={C.text}>{e.seller_name}</button>
                        <span style={{ textDecoration: e.done ? 'line-through' : 'none', color: late ? '#DC2626' : '#0F172A', fontWeight: late ? 800 : 400 }}>{e.title}{late ? ' (지남)' : ''}</span>
                        <span className="ml-auto rounded-full px-2 py-0.5 text-[11.5px] font-black" style={{ background: '#EEF2FF', color: '#3730A3' }}>{e.owner_name || '-'}</span>
                        {e.done && e.done_by && <span className="text-[11px]" style={C.muted}>완료 {e.done_by}</span>}
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}

        {tab === 'all' && (
          <div className="overflow-x-auto rounded-2xl" style={C.panel}>
            <table className="w-full min-w-[860px] text-left text-[13px]">
              <thead>
                <tr>{['셀러', '상태', '거래 방식', '수수료율', '판매가', '기간', '담당', '판단'].map((h) => <th key={h} className="px-3 py-2 font-black" style={C.th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {deals.map((d) => (
                  <tr key={d.id} className="cursor-pointer" onClick={() => setOpenId(d.id)}>
                    <td className="px-3 py-2 font-bold" style={C.td}>{d.seller_name}</td>
                    <td className="px-3 py-2" style={C.td}><StatusBadge status={d.status} /></td>
                    <td className="px-3 py-2" style={C.td}>{DEAL_TYPES[d.deal_type] || '-'}</td>
                    <td className="px-3 py-2" style={C.td}>{d.commission_rate != null ? `${Number(d.commission_rate)}%` : '-'}</td>
                    <td className="px-3 py-2" style={C.td}>{won(d.sale_price)}</td>
                    <td className="px-3 py-2" style={C.td}>{d.start_date ? `${d.start_date} ~ ${d.end_date}` : '-'}</td>
                    <td className="px-3 py-2" style={C.td}>{d.owner_name || '-'}</td>
                    <td className="px-3 py-2" style={C.td}>{d.decided_by || '-'}</td>
                  </tr>
                ))}
                {deals.length === 0 && <tr><td colSpan={8} className="px-3 py-6 text-center" style={{ ...C.td, ...C.muted }}>등록된 공동구매가 없습니다.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {openDeal && <Modal title="공동구매 상세" onClose={() => setOpenId(null)}><DealDetail deal={openDeal} onChanged={replace} /></Modal>}
      {creating && <Modal title="공동구매 직접 등록" onClose={() => setCreating(false)}><NewDealForm onCancel={() => setCreating(false)} onSaved={(d) => { setCreating(false); setDeals((p) => [d, ...p]); setTab('pending') }} /></Modal>}
    </div>
  )
}
