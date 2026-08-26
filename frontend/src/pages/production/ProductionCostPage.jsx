import { useCallback, useEffect, useState } from 'react'
import { getCostTrend, saveProductionConfig } from '../../api/productionApi'

const num = (v) => { const x = Number(String(v ?? 0).replace(/,/g, '')); return Number.isFinite(x) ? x : 0 }
const comma = (v) => Math.round(num(v)).toLocaleString('ko-KR')

export default function ProductionCostPage() {
  const [data, setData] = useState(null)
  const [pct, setPct] = useState('')
  const [openItem, setOpenItem] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    getCostTrend().then((d) => { setData(d); setPct(String(d.alertPct ?? 10)) }).catch(() => setData({ items: [] }))
  }, [])
  useEffect(() => {
    const t = setTimeout(load, 0)
    return () => clearTimeout(t)
  }, [load])

  const savePct = async () => {
    setSaving(true)
    try { await saveProductionConfig({ priceAlertPct: num(pct) }); load() } finally { setSaving(false) }
  }

  const items = data?.items || []
  const alerts = items.filter((i) => i.alert)

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-black text-slate-900">원가 추적</h1>
          <p className="mt-0.5 text-[12px] text-slate-400">발주할 때마다 단가가 이력으로 쌓입니다. 직전 발주 대비 상승률이 기준을 넘으면 "개선 필요" — 재협상·대체 공급처 검토 대상.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-bold text-slate-500">경고 기준: 직전 대비</span>
          <input className="h-9 w-16 rounded-lg border border-slate-200 bg-white px-2 text-right text-sm font-black text-slate-800 focus:border-blue-400 focus:outline-none"
            value={pct} onChange={(e) => setPct(e.target.value.replace(/[^0-9.]/g, ''))} />
          <span className="text-[12px] font-bold text-slate-500">% 이상</span>
          <button type="button" disabled={saving} onClick={savePct}
            className="rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-black text-white disabled:opacity-50">저장</button>
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-[13px] font-bold text-amber-800">
          개선 필요 {alerts.length}개 품목: {alerts.map((a) => a.itemName).join(', ')} — 단가 재협상 또는 대체 공급처 검토가 필요합니다.
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        {data == null ? <p className="py-8 text-center text-sm text-slate-400">불러오는 중…</p> : items.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-slate-400">아직 발주 이력이 없습니다. [발주 관리]에서 발주를 등록하면 단가 추이가 자동으로 쌓입니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead><tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400">
                <th className="px-2 py-2 text-left">품목</th>
                <th className="px-2 py-2 text-right">최근 단가</th>
                <th className="px-2 py-2 text-right">직전 단가</th>
                <th className="px-2 py-2 text-right">변동</th>
                <th className="px-2 py-2 text-right">역대 최저</th>
                <th className="px-2 py-2 text-right">발주</th>
                <th className="px-2 py-2 text-left">최근 발주</th>
                <th className="px-2 py-2 text-left">상태</th>
              </tr></thead>
              <tbody>
                {items.map((it) => (
                  <>
                    <tr key={it.itemName} className="cursor-pointer border-b border-slate-50 last:border-b-0 hover:bg-slate-50/60"
                      onClick={() => setOpenItem(openItem === it.itemName ? '' : it.itemName)}>
                      <td className="px-2 py-2 text-[13px] font-black text-slate-800">{it.itemName}</td>
                      <td className="px-2 py-2 text-right text-[13px] font-black text-slate-900">{comma(it.lastPrice)}원</td>
                      <td className="px-2 py-2 text-right text-[12px] text-slate-500">{it.prevPrice == null ? '-' : `${comma(it.prevPrice)}원`}</td>
                      <td className="px-2 py-2 text-right">
                        {it.changePct == null ? <span className="text-[11px] text-slate-300">첫 발주</span> : (
                          <span className={`text-[12px] font-black ${it.changePct > 0 ? 'text-rose-600' : it.changePct < 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
                            {it.changePct > 0 ? '▲' : it.changePct < 0 ? '▼' : ''} {Math.abs(it.changePct)}%
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-right text-[12px] text-slate-500">{comma(it.minPrice)}원</td>
                      <td className="px-2 py-2 text-right text-[12px] text-slate-500">{it.orderCount}회</td>
                      <td className="px-2 py-2 text-[12px] text-slate-500">{String(it.lastDate).slice(5)}{it.lastSupplier ? ` · ${it.lastSupplier}` : ''}</td>
                      <td className="px-2 py-2">
                        {it.alert
                          ? <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[11px] font-black text-rose-600">개선 필요</span>
                          : <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-black text-emerald-600">정상</span>}
                      </td>
                    </tr>
                    {openItem === it.itemName && (
                      <tr key={`${it.itemName}-hist`} className="border-b border-slate-50">
                        <td colSpan={8} className="bg-slate-50/60 px-4 py-2">
                          <p className="text-[11px] font-black text-slate-500">단가 이력</p>
                          <div className="mt-1 flex flex-wrap gap-2">
                            {(it.history || []).map((h, i) => (
                              <span key={i} className="rounded-lg bg-white px-2 py-1 text-[11px] font-bold text-slate-600 shadow-sm">
                                {String(h.date).slice(5)} · {comma(h.price)}원{h.supplier ? ` · ${h.supplier}` : ''}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
