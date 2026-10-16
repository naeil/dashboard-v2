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

        <Manual />

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
