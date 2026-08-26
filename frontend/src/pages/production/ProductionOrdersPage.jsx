import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getSuppliers, saveSupplier, getProductionOrders, createProductionOrder,
  receiveProductionOrder, cancelProductionOrder, getProductionSummary,
} from '../../api/productionApi'
import { getControlTowerOverview } from '../../api/controlTowerApi'

const num = (v) => { const x = Number(String(v ?? 0).replace(/,/g, '')); return Number.isFinite(x) ? x : 0 }
const comma = (v) => Math.round(num(v)).toLocaleString('ko-KR')
const todayText = () => new Date().toISOString().slice(0, 10)

const inputCls = 'h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 focus:border-blue-400 focus:outline-none'

const STATUS_META = {
  ORDERED: ['입고 대기', 'bg-blue-100 text-blue-600'],
  RECEIVED: ['입고 완료', 'bg-emerald-100 text-emerald-600'],
  CANCELED: ['취소', 'bg-slate-100 text-slate-400'],
}

function emptyItem() {
  return { itemName: '', qty: '', unitPrice: '' }
}

/* ───────── 공급처 관리 모달 ───────── */
function SupplierModal({ onClose }) {
  const [rows, setRows] = useState(null)
  const [saving, setSaving] = useState(false)
  const load = () => getSuppliers().then(setRows).catch(() => setRows([]))
  useEffect(() => { load() }, [])
  const set = (idx, patch) => setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  const saveRow = async (r) => {
    setSaving(true)
    try {
      await saveSupplier({
        id: r.id, supplierName: r.supplier_name, contact: r.contact, paymentTerms: r.payment_terms,
        leadDays: num(r.lead_days), memo: r.memo, isActive: r.is_active !== false,
      })
      load()
    } finally { setSaving(false) }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="flex max-h-[80vh] w-full max-w-3xl flex-col rounded-2xl bg-white p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-black text-slate-800">공급처 관리</p>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600"><span className="material-symbols-outlined text-[20px]">close</span></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-slate-100">
          {rows == null ? <p className="p-6 text-center text-sm text-slate-400">불러오는 중…</p> : (
            <table className="w-full min-w-[640px]">
              <thead><tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400">
                <th className="px-2 py-2 text-left">공급처</th><th className="px-2 py-2 text-left">담당·연락처</th>
                <th className="px-2 py-2 text-left">결제 조건</th><th className="px-2 py-2 text-right">리드타임</th>
                <th className="px-2 py-2 text-right">발주 수</th><th className="px-2 py-2" />
              </tr></thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr key={r.id} className="border-b border-slate-50 last:border-b-0">
                    <td className="px-2 py-1.5"><input className={`${inputCls} h-8 w-32 text-xs`} value={r.supplier_name || ''} onChange={(e) => set(idx, { supplier_name: e.target.value })} /></td>
                    <td className="px-2 py-1.5"><input className={`${inputCls} h-8 w-36 text-xs`} value={r.contact || ''} onChange={(e) => set(idx, { contact: e.target.value })} /></td>
                    <td className="px-2 py-1.5"><input className={`${inputCls} h-8 w-28 text-xs`} value={r.payment_terms || ''} onChange={(e) => set(idx, { payment_terms: e.target.value })} /></td>
                    <td className="px-2 py-1.5 text-right"><input className={`${inputCls} h-8 w-16 text-right text-xs`} value={r.lead_days ?? 14} onChange={(e) => set(idx, { lead_days: e.target.value })} /></td>
                    <td className="px-2 py-1.5 text-right text-[12px] text-slate-500">{r.order_count || 0}건</td>
                    <td className="px-2 py-1.5 text-right">
                      <button type="button" disabled={saving} onClick={() => saveRow(r)} className="rounded bg-blue-500 px-2 py-1 text-[11px] font-black text-white disabled:opacity-50">저장</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <p className="mt-2 text-[11px] text-slate-400">새 공급처는 발주서 작성 시 이름만 입력하면 자동 등록됩니다. 여기서 연락처·결제조건·리드타임을 보완하세요.</p>
      </div>
    </div>
  )
}

/* ───────── 메인 ───────── */
export default function ProductionOrdersPage() {
  const [orders, setOrders] = useState(null)
  const [suppliers, setSuppliers] = useState([])
  const [summary, setSummary] = useState({})
  const [reorder, setReorder] = useState([])
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [modal, setModal] = useState('')
  const [notice, setNotice] = useState('')

  const [form, setForm] = useState({
    orderType: 'PRODUCTION', supplierName: '', orderDate: todayText(), expectedDate: '', memo: '',
    items: [emptyItem()],
  })
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    getProductionOrders(statusFilter === 'ALL' ? null : statusFilter).then(setOrders).catch(() => setOrders([]))
    getProductionSummary().then(setSummary).catch(() => {})
  }, [statusFilter])

  useEffect(() => {
    const t = setTimeout(load, 0)
    return () => clearTimeout(t)
  }, [load])
  useEffect(() => {
    const t = setTimeout(() => {
      getSuppliers().then(setSuppliers).catch(() => {})
      getControlTowerOverview()
        .then((ov) => setReorder((ov.reorder || []).filter((r) => ['OUT', 'ORDER_NOW', 'ORDER_SOON'].includes(r.reorder_status)).slice(0, 8)))
        .catch(() => {})
    }, 0)
    return () => clearTimeout(t)
  }, [])

  const setItem = (idx, patch) =>
    setForm((prev) => ({ ...prev, items: prev.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) }))

  const totalAmount = useMemo(
    () => form.items.reduce((s, it) => s + num(it.qty) * num(it.unitPrice), 0), [form.items])

  const submit = async () => {
    setSaving(true)
    setNotice('')
    try {
      const res = await createProductionOrder({
        ...form,
        items: form.items.filter((it) => it.itemName.trim() && num(it.qty) > 0)
          .map((it) => ({ itemName: it.itemName.trim(), qty: num(it.qty), unitPrice: num(it.unitPrice) })),
      })
      if (res.success === false) setNotice(res.message || '등록 실패')
      else {
        setNotice('발주 등록 완료')
        setForm({ orderType: 'PRODUCTION', supplierName: '', orderDate: todayText(), expectedDate: '', memo: '', items: [emptyItem()] })
        load()
      }
    } catch {
      setNotice('등록 실패')
    } finally { setSaving(false) }
  }

  const prefillFromReorder = (r) => {
    setForm((prev) => ({
      ...prev,
      items: [{ itemName: r.product_name, qty: '', unitPrice: '' }, ...prev.items.filter((it) => it.itemName.trim())],
    }))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-black text-slate-900">발주 관리</h1>
          <p className="mt-0.5 text-[12px] text-slate-400">생산·사입 발주 → 입고 대기 → 입고 처리(재고 자동 반영). 발주 시점은 종합 상황판 데드라인과 연동.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setModal('supplier')} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-600 hover:bg-slate-50">공급처 관리</button>
          {notice && <span className="text-[12px] font-bold text-blue-600">{notice}</span>}
        </div>
      </div>

      {/* 요약 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-[11px] font-bold text-slate-400">입고 대기</p>
          <p className="mt-1 text-xl font-black text-slate-900">{summary.waiting ?? 0}건</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-[11px] font-bold text-slate-400">입고 지연</p>
          <p className={`mt-1 text-xl font-black ${Number(summary.delayed) > 0 ? 'text-rose-600' : 'text-slate-900'}`}>{summary.delayed ?? 0}건</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-[11px] font-bold text-slate-400">원가 경고 (개선 필요)</p>
          <p className={`mt-1 text-xl font-black ${Number(summary.alertCount) > 0 ? 'text-amber-600' : 'text-slate-900'}`}>{summary.alertCount ?? 0}개</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[400px_minmax(0,1fr)]">
        {/* 새 발주 */}
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-black text-slate-800">새 발주</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <select className={inputCls} value={form.orderType} onChange={(e) => setForm({ ...form, orderType: e.target.value })}>
                <option value="PRODUCTION">생산 발주 (자체 제조)</option>
                <option value="PURCHASE">사입 발주 (매입)</option>
              </select>
              <input className={inputCls} placeholder="공급처" list="supplier-options" value={form.supplierName}
                onChange={(e) => setForm({ ...form, supplierName: e.target.value })} />
              <datalist id="supplier-options">{suppliers.map((s) => <option key={s.id} value={s.supplier_name} />)}</datalist>
              <label className="text-[11px] font-bold text-slate-400">발주일
                <input type="date" className={`${inputCls} mt-1 w-full`} value={form.orderDate} onChange={(e) => setForm({ ...form, orderDate: e.target.value })} />
              </label>
              <label className="text-[11px] font-bold text-slate-400">입고 예정일
                <input type="date" className={`${inputCls} mt-1 w-full`} value={form.expectedDate} onChange={(e) => setForm({ ...form, expectedDate: e.target.value })} />
              </label>
            </div>
            <div className="mt-3 space-y-1.5">
              {form.items.map((it, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <input className={`${inputCls} h-8 flex-1 text-xs`} placeholder="품목명" value={it.itemName}
                    onChange={(e) => setItem(idx, { itemName: e.target.value })} />
                  <input className={`${inputCls} h-8 w-16 text-right text-xs`} placeholder="수량" value={it.qty}
                    onChange={(e) => setItem(idx, { qty: e.target.value.replace(/[^0-9]/g, '') })} />
                  <input className={`${inputCls} h-8 w-24 text-right text-xs`} placeholder="단가" value={it.unitPrice ? comma(it.unitPrice) : ''}
                    onChange={(e) => setItem(idx, { unitPrice: num(e.target.value) })} />
                  <button type="button" onClick={() => setForm((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }))}
                    className="text-slate-300 hover:text-rose-500"><span className="material-symbols-outlined text-[16px]">close</span></button>
                </div>
              ))}
              <button type="button" onClick={() => setForm((prev) => ({ ...prev, items: [...prev.items, emptyItem()] }))}
                className="rounded-lg border border-dashed border-slate-300 px-3 py-1 text-[11px] font-black text-slate-500 hover:bg-slate-50">+ 품목 추가</button>
            </div>
            <input className={`${inputCls} mt-2 w-full text-xs`} placeholder="메모 (선택)" value={form.memo}
              onChange={(e) => setForm({ ...form, memo: e.target.value })} />
            <div className="mt-3 flex items-center justify-between">
              <p className="text-[12px] font-black text-slate-600">합계 {comma(totalAmount)}원</p>
              <button type="button" disabled={saving} onClick={submit}
                className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-black text-white disabled:opacity-50">
                {saving ? '등록 중…' : '발주 등록'}
              </button>
            </div>
          </div>

          {/* 발주 필요 (재발주 데드라인 연동) */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
            <p className="text-sm font-black text-amber-800">지금 발주 필요 <span className="text-[11px] font-bold text-amber-600">종합 상황판 데드라인 기준</span></p>
            {reorder.length === 0 ? (
              <p className="mt-2 text-[12px] text-slate-500">발주가 급한 상품이 없습니다.</p>
            ) : (
              <div className="mt-2 space-y-1.5">
                {reorder.map((r) => (
                  <div key={r.product_id} className="flex items-center justify-between gap-2 rounded-lg bg-white px-2.5 py-1.5">
                    <p className="truncate text-[12px] font-bold text-slate-700" title={r.product_name}>{r.product_name}
                      <span className="ml-1.5 text-[11px] text-slate-400">재고 {comma(r.real_stock)}{r.order_deadline ? ` · ${String(r.order_deadline).slice(5)}까지` : ''}</span>
                    </p>
                    <button type="button" onClick={() => prefillFromReorder(r)}
                      className="shrink-0 rounded bg-amber-500 px-2 py-1 text-[11px] font-black text-white">발주서로</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 발주서 목록 */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-black text-slate-800">발주서 목록</p>
            <div className="flex gap-1.5">
              {[['ALL', '전체'], ['ORDERED', '입고 대기'], ['RECEIVED', '입고 완료']].map(([k, label]) => (
                <button key={k} type="button" onClick={() => setStatusFilter(k)}
                  className={`rounded-lg border px-2.5 py-1 text-[11px] font-black ${statusFilter === k ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-slate-200 bg-white text-slate-500'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          {orders == null ? <p className="py-8 text-center text-sm text-slate-400">불러오는 중…</p> : orders.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-slate-400">발주서가 없습니다. 왼쪽에서 첫 발주를 등록하세요.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {orders.map((o) => {
                const [label, cls] = STATUS_META[o.status] || ['-', 'bg-slate-100 text-slate-400']
                return (
                  <div key={o.id} className={`rounded-lg border p-3 ${o.delayed ? 'border-rose-200 bg-rose-50/40' : 'border-slate-100'}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded px-1.5 py-0.5 text-[11px] font-black ${cls}`}>{label}</span>
                        {o.delayed && <span className="rounded bg-rose-500 px-1.5 py-0.5 text-[11px] font-black text-white">지연</span>}
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">{o.order_type === 'PURCHASE' ? '사입' : '생산'}</span>
                        <p className="text-[13px] font-black text-slate-800">#{o.id} {o.supplier_name || '공급처 미지정'}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] font-black text-slate-700">{comma(o.total_amount)}원</span>
                        {o.status === 'ORDERED' && (
                          <>
                            <button type="button" onClick={async () => { await receiveProductionOrder(o.id, todayText()).catch(() => {}); load() }}
                              className="rounded-lg bg-emerald-500 px-2.5 py-1 text-[11px] font-black text-white hover:bg-emerald-600">입고 처리</button>
                            <button type="button" onClick={async () => { await cancelProductionOrder(o.id).catch(() => {}); load() }}
                              className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-bold text-slate-400 hover:text-rose-500">취소</button>
                          </>
                        )}
                      </div>
                    </div>
                    <p className="mt-1.5 text-[12px] text-slate-600">{o.item_summary}</p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      발주 {String(o.order_date).slice(5)}
                      {o.expected_date && <> · 입고 예정 <span className={o.delayed ? 'font-black text-rose-600' : 'font-bold text-slate-600'}>{String(o.expected_date).slice(5)}</span></>}
                      {o.received_date && <> · 입고 완료 {String(o.received_date).slice(5)}</>}
                      {o.created_by && <> · {o.created_by}</>}
                      {o.memo && <> · {o.memo}</>}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {modal === 'supplier' && <SupplierModal onClose={() => { setModal(''); getSuppliers().then(setSuppliers).catch(() => {}) }} />}
    </div>
  )
}
