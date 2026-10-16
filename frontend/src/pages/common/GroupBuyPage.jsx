import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  addGroupBuyEvent,
  createGroupBuy,
  decideGroupBuy,
  deleteGroupBuyEvent,
  getGroupBuys,
  getGroupBuySchedule,
  getGroupBuySettings,
  saveGroupBuySetting,
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

// ===== 공동구매 운영 시트(엑셀)와 같은 도구: 견적 계산기 · 업무 절차 · 확정 필요 항목 =====
// 기본값은 데이터 Raw '오프라인 공급가' 탭(국내 오프라인 파트너 위탁 / 대량) 기준. 공급가 수정은 모든 직원 화면에 같이 반영된다.
const DEFAULT_PRICES = [
  { name: '단백깡 새우갈릭', retail: 3500, consignRate: 20, buyRate: 30 },
  { name: '단백깡 알싸고추', retail: 2500, consignRate: 23, buyRate: 35 },
  { name: '단백깡 야채포테이토', retail: 2500, consignRate: 23, buyRate: 35 },
]
const CARTON = 32
const DEFAULT_PROCEDURE = {
  consign: [
    { task: '셀러가 제품, 희망 일정, 예상 수량을 전달합니다.', owner: '', done: false },
    { task: '공급가 기준표와 소비자가 준수 사항을 안내하고 동의를 받습니다.', owner: '', done: false },
    { task: '카톤(32봉) 단위로 출고합니다.', owner: '', done: false },
    { task: '셀러가 공구를 진행합니다. 공구 진행 관리에 판매수량을 기록합니다.', owner: '', done: false },
    { task: '판매수량 × 공급가로 정산합니다. (정산 시점, 미판매 재고 반품 여부는 확정 필요)', owner: '', done: false },
  ],
  buy: [
    { task: '판매 실적을 확인하고 사입형 전환 조건을 안내합니다.', owner: '', done: false },
    { task: '수량과 단가를 확정하고 발주서를 받습니다.', owner: '', done: false },
    { task: '결제를 확인합니다. (선결제 또는 출고 후 결제는 확정 필요)', owner: '', done: false },
    { task: '확정 수량을 출고합니다.', owner: '', done: false },
    { task: '사후 관리를 합니다. (사입 물량 반품 가능 여부는 확정 필요)', owner: '', done: false },
  ],
}
const DEFAULT_CONFIRM = [
  '사입형 전환 기준 수량', '사입형 최소 주문 단위 (파레트 1,536봉은 공구에 비현실적일 수 있음)', '정산 시점과 방식',
  '위탁 미판매 재고의 반품 가능 여부', '사입 결제 조건', '공구 최저 판매가 기준', '당근효소, 프리하닭 공급가 적용 여부',
  '대량 새우갈릭 단가 재검토 (영업이익률 5% 미만 경고)', '알싸고추, 야채포테이토 원가 통일 (810원 vs 820원)',
  '수수료형(인플루언서) 공구 수수료율 기준',
].map((item) => ({ item, content: '', status: '미확정' }))

const parse = (s, fallback) => { try { const v = JSON.parse(s); return v ?? fallback } catch { return fallback } }
const supply = (p, type) => Math.round(p.retail * (1 - (type === '위탁' ? p.consignRate : p.buyRate) / 100))
const n0 = (v) => Number(v || 0).toLocaleString('ko-KR')
const cell = 'px-2 py-1.5 text-[12.5px]'

function useSettings() {
  const [s, setS] = useState({})
  const [err, setErr] = useState('')
  const load = useCallback(async () => { try { setS(await getGroupBuySettings()); setErr('') } catch (e) { setErr(errMsg(e)) } }, [])
  useEffect(() => { load() }, [load])
  const save = async (key, value) => { try { setS(await saveGroupBuySetting(key, value)); setErr('') } catch (e) { setErr(errMsg(e)) } }
  return { s, save, err }
}

function QuoteCalculator({ prices, onEditPrices }) {
  const [seller, setSeller] = useState('')
  const [type, setType] = useState('위탁')
  const [qty, setQty] = useState({})
  const [copied, setCopied] = useState(false)
  const rows = prices.map((p) => {
    const q = Number(qty[p.name] || 0)
    const unit = supply(p, type)
    const other = supply(p, type === '위탁' ? '사입' : '위탁')
    return { p, q, unit, amount: unit * q, cartons: q ? Math.ceil(q / CARTON) : 0, ok: !q || q % CARTON === 0,
      margin: (p.retail - unit) * q, saving: type === '위탁' ? (unit - other) * q : 0 }
  })
  const used = rows.filter((r) => r.q > 0)
  const sum = (k) => used.reduce((a, r) => a + r[k], 0)
  const msg = used.length === 0 ? '' : [
    `안녕하세요 ${seller || '셀러'}님, 하이프리 단백깡 공동구매 공급 조건 안내드립니다.`, '',
    `[거래 방식] ${type === '위탁' ? '위탁 — 판매된 수량만큼만 정산합니다.' : '사입 — 주문 수량 기준으로 결제 후 출고합니다.'}`,
    '[주문 내역]', ...used.map((r) => `- ${r.p.name} ${n0(r.q)}봉(${r.cartons}카톤) × ${n0(r.unit)}원 = ${n0(r.amount)}원`),
    `합계 ${n0(sum('q'))}봉 / ${n0(sum('amount'))}원`, '',
    `[출고] ${CARTON}봉 1카톤 단위로 출고합니다.`,
    `[판매가] 소비자가(${prices.map((p) => `${p.name.replace('단백깡 ', '')} ${n0(p.retail)}원`).join(', ')}) 기준으로 판매해 주세요.`,
    '[게시물] #광고 또는 #공동구매 표기를 부탁드리며, 효능 표현(체중 감량·혈당 등)은 쓰지 않습니다.', '',
    '가능하신 공구 일정과 수량을 알려 주시면 바로 준비하겠습니다. 감사합니다.',
  ].join('\n')
  const copy = async () => { try { await navigator.clipboard.writeText(msg); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* 무시 */ } }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="셀러명"><input value={seller} onChange={(e) => setSeller(e.target.value)} className={inputCls} style={{ ...C.input, background: '#FFFBEB' }} placeholder="예: 지구쀼" /></Field>
        <Field label="거래 유형">
          <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls} style={{ ...C.input, background: '#FFFBEB' }}>
            <option>위탁</option><option>사입</option>
          </select>
        </Field>
        <button type="button" onClick={onEditPrices} className="rounded-lg px-3 py-1.5 text-[12px] font-black" style={C.ghost}>공급가 기준 수정</button>
      </div>
      <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid #E2E8F0' }}>
        <table className="w-full min-w-[820px] text-right">
          <thead>
            <tr>{['제품', '주문수량(봉)', '적용 공급가(원)', '공급금액(원)', '카톤수', '수량 점검', '셀러 예상마진(원)\n소비자가 판매 시', '사입 전환 시 절감액(원)\n위탁일 때 참고'].map((h, i) => (
              <th key={h} className={`${cell} whitespace-pre-line font-black ${i === 0 ? 'text-left' : 'text-center'}`} style={{ background: '#1E3A5F', color: '#FFFFFF' }}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.p.name}>
                <td className={`${cell} text-left font-bold`} style={C.td}>{r.p.name}</td>
                <td className={cell} style={{ ...C.td, background: '#FFFBEB' }}>
                  <input type="number" min="0" step={CARTON} value={qty[r.p.name] ?? ''} onChange={(e) => setQty((p) => ({ ...p, [r.p.name]: e.target.value }))}
                    className="w-24 rounded px-2 py-1 text-right text-[12.5px]" style={{ ...C.input, color: '#1D4ED8' }} placeholder="0" />
                </td>
                <td className={cell} style={{ ...C.td, background: '#F8FAFC' }}>{n0(r.unit)}</td>
                <td className={cell} style={{ ...C.td, background: '#F8FAFC' }}>{r.q ? n0(r.amount) : ''}</td>
                <td className={`${cell} text-center`} style={{ ...C.td, background: '#F8FAFC' }}>{r.q ? r.cartons : ''}</td>
                <td className={`${cell} text-center font-bold`} style={{ ...C.td, background: '#F8FAFC', color: r.ok ? '#047857' : '#DC2626' }}>{r.q ? (r.ok ? 'OK' : `${CARTON}봉 단위로`) : ''}</td>
                <td className={cell} style={{ ...C.td, background: '#F8FAFC' }}>{r.q ? n0(r.margin) : ''}</td>
                <td className={cell} style={{ ...C.td, background: '#F8FAFC' }}>{r.q && type === '위탁' ? n0(r.saving) : ''}</td>
              </tr>
            ))}
            <tr className="font-black">
              <td className={`${cell} text-left`} style={C.td}>합계</td>
              <td className={cell} style={C.td}>{n0(sum('q'))}</td>
              <td className={cell} style={C.td} />
              <td className={cell} style={C.td}>{n0(sum('amount'))}</td>
              <td className={`${cell} text-center`} style={C.td}>{n0(sum('cartons'))}</td>
              <td className={cell} style={C.td} />
              <td className={cell} style={C.td}>{n0(sum('margin'))}</td>
              <td className={cell} style={C.td}>{type === '위탁' ? n0(sum('saving')) : ''}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-[11.5px]" style={C.muted}>위탁은 판매 수량 기준으로 최종 정산하므로 공급금액은 주문 기준 예상치입니다. 노란 칸만 입력하세요.</p>
      {msg && (
        <div className="rounded-xl p-3" style={{ background: '#ECFDF5', border: '1px solid #A7F3D0' }}>
          <div className="mb-1 flex items-center justify-between">
            <p className="text-[12.5px] font-black" style={{ color: '#065F46' }}>셀러 안내 문구</p>
            <button type="button" onClick={copy} className="rounded-lg px-3 py-1 text-[12px] font-black" style={C.primary}>{copied ? '복사됨' : '복사'}</button>
          </div>
          <pre className="whitespace-pre-wrap text-[12.5px] leading-relaxed" style={{ color: '#064E3B', fontFamily: 'inherit' }}>{msg}</pre>
        </div>
      )}
    </div>
  )
}

function PriceEditor({ prices, meta, onSave, onClose }) {
  const [rows, setRows] = useState(prices.map((p) => ({ ...p })))
  const set = (i, k, v) => setRows((p) => p.map((r, j) => (j === i ? { ...r, [k]: k === 'name' ? v : Number(v) } : r)))
  return (
    <div className="space-y-3">
      <p className="text-[12px]" style={C.muted}>여기서 바꾸면 모든 직원의 견적 계산기에 바로 반영됩니다. 원가·이익률은 이 화면에 두지 않습니다(데이터 Raw '오프라인 공급가' 탭 참고).{meta?.updated_by ? ` 마지막 수정: ${meta.updated_by} ${meta.updated_at}` : ''}</p>
      <table className="w-full text-[12.5px]">
        <thead><tr>{['제품명', '소비자가(원)', '위탁 할인율(%)', '사입 할인율(%)', '위탁 공급가', '사입 공급가', ''].map((h) => <th key={h} className={`${cell} font-black`} style={C.th}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td className={cell} style={C.td}><input value={r.name} onChange={(e) => set(i, 'name', e.target.value)} className="w-full rounded px-2 py-1" style={C.input} /></td>
              {['retail', 'consignRate', 'buyRate'].map((k) => (
                <td key={k} className={cell} style={C.td}><input type="number" value={r[k]} onChange={(e) => set(i, k, e.target.value)} className="w-24 rounded px-2 py-1 text-right" style={C.input} /></td>
              ))}
              <td className={`${cell} text-right`} style={C.td}>{n0(supply(r, '위탁'))}</td>
              <td className={`${cell} text-right`} style={C.td}>{n0(supply(r, '사입'))}</td>
              <td className={cell} style={C.td}><button type="button" onClick={() => setRows((p) => p.filter((_, j) => j !== i))} className="text-[11.5px]" style={{ color: '#BE123C' }}>삭제</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex justify-between">
        <button type="button" onClick={() => setRows((p) => [...p, { name: '', retail: 0, consignRate: 0, buyRate: 0 }])} className="rounded-lg px-3 py-1.5 text-[12.5px] font-black" style={C.ghost}>+ 제품 추가</button>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-1.5 text-[12.5px] font-black" style={C.ghost}>취소</button>
          <button type="button" onClick={async () => { await onSave(rows.filter((r) => r.name)); onClose() }} className="rounded-lg px-4 py-1.5 text-[12.5px] font-black" style={C.primary}>저장</button>
        </div>
      </div>
    </div>
  )
}

function Procedure({ value, meta, onSave }) {
  const [v, setV] = useState(value)
  useEffect(() => setV(value), [value])
  const update = (group, i, patch) => {
    const next = { ...v, [group]: v[group].map((r, j) => (j === i ? { ...r, ...patch } : r)) }
    setV(next); onSave(next)
  }
  const Block = ({ title, group }) => (
    <div className="overflow-hidden rounded-xl" style={{ border: '1px solid #E2E8F0' }}>
      <p className="px-3 py-2 text-[13px] font-black" style={{ background: '#1E3A5F', color: '#FFFFFF' }}>{title}</p>
      <table className="w-full text-[12.5px]">
        <thead><tr>{['순서', '할 일', '담당자', '완료'].map((h) => <th key={h} className={`${cell} font-black`} style={C.th}>{h}</th>)}</tr></thead>
        <tbody>
          {v[group].map((r, i) => (
            <tr key={i}>
              <td className={`${cell} text-center`} style={C.td}>{i + 1}</td>
              <td className={cell} style={{ ...C.td, textDecoration: r.done ? 'line-through' : 'none', color: r.done ? '#94A3B8' : '#0F172A' }}>{r.task}</td>
              <td className={cell} style={{ ...C.td, background: '#FFFBEB', width: 120 }}>
                <select value={r.owner} onChange={(e) => update(group, i, { owner: e.target.value })} className="w-full rounded px-1.5 py-1" style={C.input}>
                  <option value="">선택</option>{OWNERS.map((o) => <option key={o}>{o}</option>)}
                </select>
              </td>
              <td className={`${cell} text-center`} style={{ ...C.td, background: '#FFFBEB', width: 60 }}>
                <input type="checkbox" checked={!!r.done} onChange={() => update(group, i, { done: !r.done })} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
  return (
    <div className="space-y-3">
      <div className="grid gap-3 xl:grid-cols-2">
        <Block title="위탁형 진행 (일반 셀러)" group="consign" />
        <Block title="사입형 진행 (판매 수량이 높은 셀러)" group="buy" />
      </div>
      {meta?.updated_by && <p className="text-[11.5px]" style={C.muted}>마지막 수정: {meta.updated_by} {meta.updated_at}</p>}
    </div>
  )
}

function ConfirmItems({ value, meta, onSave }) {
  const [v, setV] = useState(value)
  useEffect(() => setV(value), [value])
  const edit = (i, patch, persist) => { const next = v.map((r, j) => (j === i ? { ...r, ...patch } : r)); setV(next); if (persist) onSave(next) }
  const open = v.filter((r) => r.status !== '확정').length
  return (
    <div className="space-y-2">
      <p className="text-[12px]" style={C.muted}>대표 확정이 필요한 항목입니다. 확정되면 내용을 적고 상태를 '확정'으로 바꾸세요. 미확정 {open}건.</p>
      <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid #E2E8F0' }}>
        <table className="w-full min-w-[760px] text-[12.5px]">
          <thead><tr>{['번호', '항목', '확정 내용', '상태'].map((h) => <th key={h} className={`${cell} font-black`} style={{ background: '#1E3A5F', color: '#FFFFFF' }}>{h}</th>)}</tr></thead>
          <tbody>
            {v.map((r, i) => (
              <tr key={i}>
                <td className={`${cell} text-center`} style={C.td}>{i + 1}</td>
                <td className={cell} style={C.td}>{r.item}</td>
                <td className={cell} style={{ ...C.td, background: '#FFFBEB' }}>
                  <input value={r.content} onChange={(e) => edit(i, { content: e.target.value }, false)} onBlur={() => onSave(v)}
                    className="w-full rounded px-2 py-1" style={C.input} placeholder="확정 내용 입력" />
                </td>
                <td className={`${cell} text-center`} style={{ ...C.td, background: '#FFFBEB', width: 110 }}>
                  <select value={r.status} onChange={(e) => edit(i, { status: e.target.value }, true)} className="rounded px-1.5 py-1 font-bold"
                    style={{ ...C.input, color: r.status === '확정' ? '#047857' : '#1D4ED8' }}>
                    <option>미확정</option><option>확정</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {meta?.updated_by && <p className="text-[11.5px]" style={C.muted}>마지막 수정: {meta.updated_by} {meta.updated_at}</p>}
    </div>
  )
}

function GroupBuyTools() {
  const [tab, setTab] = useState(() => { try { return localStorage.getItem('gb-tool') || 'quote' } catch { return 'quote' } })
  const [editPrices, setEditPrices] = useState(false)
  const { s, save, err } = useSettings()
  const prices = parse(s.prices?.value, DEFAULT_PRICES)
  const procedure = parse(s.procedure?.value, DEFAULT_PROCEDURE)
  const confirm = parse(s.confirm?.value, DEFAULT_CONFIRM)
  const pick = (k) => { setTab(k); try { localStorage.setItem('gb-tool', k) } catch { /* 무시 */ } }
  const tabs = [['quote', '견적 계산기'], ['procedure', '업무 절차'], ['confirm', `확정 필요 항목 (${confirm.filter((r) => r.status !== '확정').length})`], ['manual', '운영 매뉴얼'], ['', '접기']]
  return (
    <section className="rounded-2xl p-4" style={{ background: '#FFFFFF', border: '1px solid #BAE6FD' }}>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {tabs.map(([k, l]) => (
          <button key={l} type="button" onClick={() => pick(k)} className="rounded-full px-3.5 py-1.5 text-[12.5px] font-black"
            style={tab === k ? C.primary : C.ghost}>{l}</button>
        ))}
      </div>
      {err && <p className="mb-2 rounded-lg px-3 py-2 text-[12.5px] font-bold" style={C.error}>{err}</p>}
      {tab === 'quote' && <QuoteCalculator prices={prices} onEditPrices={() => setEditPrices(true)} />}
      {tab === 'procedure' && <Procedure value={procedure} meta={s.procedure} onSave={(v) => save('procedure', v)} />}
      {tab === 'confirm' && <ConfirmItems value={confirm} meta={s.confirm} onSave={(v) => save('confirm', v)} />}
      {tab === 'manual' && <Manual />}
      {editPrices && <Modal title="공급가 기준 수정" onClose={() => setEditPrices(false)}><PriceEditor prices={prices} meta={s.prices} onSave={(v) => save('prices', v)} onClose={() => setEditPrices(false)} /></Modal>}
    </section>
  )
}

// 페이지 상단 운영 매뉴얼 — 접고 펼친 상태는 이 브라우저에만 기억
const MANUAL_FLOW = [
  ['AI', '후보 발굴', '댓글 참여가 높은 셀러를 찾음'],
  ['AI', '제안 메일', '수수료형 공동구매 제안'],
  ['AI', '회신 접수', '판단 대기로 등록 · 이수현 배정'],
  ['실무진', '조건 판단', '승인 / 보류 / 거절 입력'],
  ['자동', '일정 생성', '승인 시 담당자 이름으로'],
  ['실무진', 'D-14 샘플', '3종 1세트 발송 · 송장 전달'],
  ['실무진', 'D-3 검수', '광고 표기 · 효능 표현 확인'],
  ['실무진', 'D-2 준비', '판매 링크 · 할인코드 · 재고'],
  ['실무진', '오픈 → 마감', '문의 응대 · 품절 공유'],
  ['실무진', '+1 판매수량', '셀러에게 최종 수량 받기'],
  ['실무진', '+7 정산', '정산서 발송 · 지급 · 결과 리뷰'],
]

function Manual() {
  const [open, setOpen] = useState(() => { try { return localStorage.getItem('gb-manual') !== 'closed' } catch { return true } })
  const toggle = () => setOpen((v) => { try { localStorage.setItem('gb-manual', v ? 'closed' : 'open') } catch { /* 무시 */ } return !v })
  const box = 'rounded-xl p-3'
  const h = 'mb-1.5 text-[13px] font-black'
  const li = 'text-[12.5px] leading-relaxed'
  return (
    <section className="rounded-2xl p-4" style={{ background: '#FFFFFF', border: '1px solid #BAE6FD' }}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[15px] font-black" style={{ color: '#075985' }}>AI 공동구매 운영 매뉴얼</h2>
        <button type="button" onClick={toggle} className="rounded-lg px-3 py-1 text-[12px] font-black" style={C.ghost}>{open ? '접기' : '펼치기'}</button>
      </div>
      {open && (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-stretch gap-1.5">
            {MANUAL_FLOW.map(([who, title, desc], i) => (
              <div key={title} className="flex items-center gap-1.5">
                <div className="min-w-[118px] rounded-lg px-2.5 py-1.5" style={{ background: who === 'AI' ? '#EEF2FF' : who === '자동' ? '#ECFDF5' : '#FFF7ED', border: '1px solid #E2E8F0' }}>
                  <p className="text-[10.5px] font-black" style={{ color: who === 'AI' ? '#4338CA' : who === '자동' ? '#047857' : '#C2410C' }}>{who}</p>
                  <p className="text-[12.5px] font-black" style={C.text}>{title}</p>
                  <p className="text-[11px]" style={C.muted}>{desc}</p>
                </div>
                {i < MANUAL_FLOW.length - 1 && <span style={C.muted}>›</span>}
              </div>
            ))}
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            <div className={box} style={C.soft}>
              <p className={h} style={C.text}>누가 무엇을</p>
              <p className={li} style={C.text}><b>AI 에이전트</b> — 셀러 발굴, 제안 메일, 회신 접수·배정, 일정 알림</p>
              <p className={li} style={C.text}><b>이수현 매니저 (공구 전담)</b> — 회신 응대, 조건 판단 입력, 일정 실행·완료 체크</p>
              <p className={li} style={C.text}><b>대표</b> — 수수료율·판매가·정산 조건 확정, 비용이 드는 제안 결정</p>
              <p className={li} style={C.text}><b>CS</b> — 출고·배송·구매자 문의 (셀러에게 배송·CS 부담 없음)</p>
            </div>
            <div className={box} style={C.soft}>
              <p className={h} style={C.text}>셀러 고르는 기준 (팔로워 수 아님)</p>
              <p className={li} style={C.text}>① 본인이 댓글에 <b>답글을 자주</b> 다는지</p>
              <p className={li} style={C.text}>② 게시물마다 <b>댓글이 많이</b> 달리는지</p>
              <p className={li} style={C.text}>③ 지난 공구 글에 <b>구매 문의 댓글</b>("어디서 사요", "링크")이 있는지</p>
              <p className={li} style={C.muted}>제외: 경쟁 단백질 스낵 공구 진행 중, 자체 다이어트 스낵 판매, 원고료·제작비만 받는 곳</p>
            </div>
            <div className={box} style={C.soft}>
              <p className={h} style={C.text}>판단 기준 (모두 상담·미팅 기록에 자동 기재)</p>
              <p className={li} style={C.text}><b style={{ color: '#047857' }}>승인</b> — 수수료형(선금 없음) 동의 + 일정 협의 가능. 수수료율·기간 입력 → 일정 자동 생성</p>
              <p className={li} style={C.text}><b style={{ color: '#B45309' }}>보류</b> — 조건 추가 확인, 장기·수익배분 등 별도 협의 필요. <b>사유 필수</b></p>
              <p className={li} style={C.text}><b style={{ color: '#BE123C' }}>거절</b> — 유료 광고·원고료만 가능, 경쟁 공구 중, 표현 가이드 거부. <b>사유 필수</b></p>
            </div>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <div className={box} style={C.soft}>
              <p className={h} style={C.text}>표준 조건</p>
              <p className={li} style={C.text}>· 수수료형 공동구매 — 선금·고정 광고비 없음</p>
              <p className={li} style={C.text}>· 수수료율·공구 판매가: <b style={{ color: '#B45309' }}>대표 확정 후 안내</b> (확정 전에는 "내부 확인 후 안내")</p>
              <p className={li} style={C.text}>· 구성: 단백깡 3종 혼합 · 샘플 3종 1세트 무상 · 기간 3~5일 권장</p>
              <p className={li} style={C.text}>· 배송·CS 하이프리 담당 · 정산은 마감 후 반품 반영해 진행</p>
              <p className={li} style={C.text}>· 게시물 첫머리에 <b>#광고 또는 #공동구매</b> 표기 필수</p>
            </div>
            <div className={box} style={C.soft}>
              <p className={h} style={C.text}>게시물 표현 (식품이라 효능 표현 금지)</p>
              <p className={li} style={C.text}><b style={{ color: '#047857' }}>가능</b> — 밀가루 없이 · 설탕 무첨가 · 튀기지 않은 · 한 봉지 단백질 OOg · 식단 관리 중 간식</p>
              <p className={li} style={C.text}><b style={{ color: '#BE123C' }}>금지</b> — 살 빠지는 · 혈당 안 올리는 · 당뇨에 좋은 · 근손실 막는 · 최고/1위(근거 없는 최상급)</p>
              <p className={li} style={C.muted}>안내문구 T1~T7·견적 계산·정산 계산: 공동구매 운영 시트(바탕화면 AI에이전트_자료 · 하이프리_단백깡_공동구매_운영시트.xlsx)</p>
            </div>
          </div>
        </div>
      )}
    </section>
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

        <GroupBuyTools />

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
