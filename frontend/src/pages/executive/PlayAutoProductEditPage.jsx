import { useState } from 'react'
import { checkProductClaims, editPlayAutoProduct, getPlayAutoProduct, searchPlayAutoProducts } from '../../api/playautoProductApi'

const SALE_STATUSES = ['', '판매중', '일시품절', '판매중지', '판매대기', '수정대기']

/** 플레이오토 목록 응답은 판매자관리코드별로 묶여 오므로 평탄화한다. */
function flattenResults(data) {
  const results = data?.results ?? data
  if (!results) return []
  if (Array.isArray(results)) return results.flatMap((r) => (Array.isArray(r) ? r : (r && typeof r === 'object' && !r.ol_shop_no ? Object.values(r).flat() : [r])))
  return Object.values(results).flat()
}

function firstObject(data) {
  if (Array.isArray(data)) return data[0] || null
  if (data?.results) return Array.isArray(data.results) ? data.results[0] : data.results
  return data
}

const fieldClass = 'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] outline-none focus:border-sky-400'

export default function PlayAutoProductEditPage({ role }) {
  const isExecutive = role === 'EXECUTIVE'
  const [keyword, setKeyword] = useState('')
  const [saleStatus, setSaleStatus] = useState('판매중')
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [product, setProduct] = useState(null)
  const [form, setForm] = useState(null)
  const [warnings, setWarnings] = useState([])
  const [ackWarnings, setAckWarnings] = useState(false)
  const [confirmPrice, setConfirmPrice] = useState(false)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState(null)

  const search = async () => {
    setLoading(true); setError(''); setProduct(null)
    try {
      const data = await searchPlayAutoProducts({ keyword, saleStatus, length: 50 })
      const rows = flattenResults(data)
      const seen = new Set()
      setList(rows.filter((r) => { const k = r.c_sale_cd; if (seen.has(k)) return false; seen.add(k); return true }))
    } catch (e) {
      setError(e?.response?.data?.message || '플레이오토 상품을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const open = async (row) => {
    setError(''); setResult(null); setWarnings([]); setAckWarnings(false); setConfirmPrice(false)
    try {
      const d = firstObject(await getPlayAutoProduct(row.ol_shop_no)) || row
      const opts = d.opts || d.options || []
      setProduct({ ...row, ...d })
      setForm({
        shop_sale_name: d.shop_sale_name || row.shop_sale_name || '',
        keywords: Array.isArray(d.keywords) ? d.keywords.join(',') : (d.keywords || ''),
        sale_cnt_limit: d.sale_cnt_limit ?? '',
        sale_price: d.sale_price ?? '',
        detail_desc: d.detail_desc || '',
        opts: Array.isArray(opts) ? opts.map((o) => ({ ...o })) : [],
      })
    } catch (e) {
      setError(e?.response?.data?.message || '상품 상세를 불러오지 못했습니다.')
    }
  }

  const changedPayload = () => {
    const p = { c_sale_cd: product.c_sale_cd, edit_slave_all: true }
    if (form.shop_sale_name !== (product.shop_sale_name || '')) p.shop_sale_name = form.shop_sale_name
    const origKw = Array.isArray(product.keywords) ? product.keywords.join(',') : (product.keywords || '')
    if (form.keywords !== origKw) p.keywords = form.keywords
    if (String(form.sale_cnt_limit) !== String(product.sale_cnt_limit ?? '')) p.sale_cnt_limit = form.sale_cnt_limit
    if (form.detail_desc !== (product.detail_desc || '')) p.detail_desc = form.detail_desc
    if (isExecutive && String(form.sale_price) !== String(product.sale_price ?? '')) p.sale_price = form.sale_price
    const origOpts = JSON.stringify((product.opts || product.options || []).map((o) => [o.status, String(o.stock_cnt)]))
    const newOpts = JSON.stringify(form.opts.map((o) => [o.status, String(o.stock_cnt)]))
    if (form.opts.length && origOpts !== newOpts) p.opts = form.opts
    return p
  }

  const runCheck = async () => {
    const w = await checkProductClaims({ shop_sale_name: form.shop_sale_name, detail_desc: form.detail_desc, keywords: form.keywords })
    setWarnings(w || [])
    return w || []
  }

  const save = async () => {
    const payload = changedPayload()
    const fields = Object.keys(payload).filter((k) => !['c_sale_cd', 'edit_slave_all'].includes(k))
    if (!fields.length) { setError('변경한 항목이 없습니다.'); return }
    if (payload.sale_price !== undefined && !confirmPrice) { setError('판매가를 바꾸려면 아래 확인란에 체크하세요.'); return }
    setSaving(true); setError(''); setResult(null)
    try {
      const w = await runCheck()
      if (w.length && !ackWarnings) { setError('표시·광고 점검 경고가 있습니다. 내용을 확인하고 체크한 뒤 다시 저장하세요.'); return }
      const res = await editPlayAutoProduct({ ...payload, acknowledgeWarnings: ackWarnings, confirmPriceChange: confirmPrice })
      setResult(res)
      if (res.saved) setProduct({ ...product, ...payload })
    } catch (e) {
      setError(e?.response?.data?.message || '저장하지 못했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <h1 className="text-xl font-black text-slate-900">상품 정보 수정 (플레이오토)</h1>
        <p className="mt-1 text-[12.5px] text-slate-500">마스터 상품을 수정하면 연동된 쇼핑몰 상품에 함께 반영됩니다. 쿠팡은 옵션명 수정이 지원되지 않습니다. 카테고리·템플릿·배송비는 플레이오토 화면에서 바꿔 주세요.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input value={keyword} onChange={(e) => setKeyword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()}
          placeholder="상품명 검색 (예: 단백깡)" className={`${fieldClass} max-w-xs`} />
        <select value={saleStatus} onChange={(e) => setSaleStatus(e.target.value)} className={`${fieldClass} max-w-[140px]`}>
          {SALE_STATUSES.map((s) => <option key={s} value={s}>{s || '전체 상태'}</option>)}
        </select>
        <button type="button" onClick={search} disabled={loading}
          className="h-10 rounded-lg bg-slate-900 px-4 text-[13px] font-black text-white hover:bg-slate-700">{loading ? '불러오는 중…' : '검색'}</button>
      </div>

      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] font-bold text-rose-700">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <section className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="mb-2 text-[12px] font-bold text-slate-500">상품 {list.length}개</p>
          <div className="max-h-[640px] space-y-1 overflow-y-auto">
            {list.map((r) => (
              <button key={r.c_sale_cd + r.ol_shop_no} type="button" onClick={() => open(r)}
                className={`w-full rounded-lg px-3 py-2 text-left hover:bg-slate-50 ${product?.c_sale_cd === r.c_sale_cd ? 'bg-sky-50' : ''}`}>
                <p className="text-[13px] font-bold text-slate-800">{r.shop_sale_name}</p>
                <p className="text-[11px] text-slate-500">{r.c_sale_cd} · {r.sale_status} · {r.sale_price != null ? `${Number(r.sale_price).toLocaleString()}원` : ''}</p>
              </button>
            ))}
            {!list.length && <p className="px-2 py-6 text-center text-[12.5px] text-slate-400">검색해서 상품을 불러오세요.</p>}
          </div>
        </section>

        {product && form && (
          <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
            <div>
              <p className="text-[11px] font-bold text-slate-400">판매자관리코드 {product.c_sale_cd}</p>
              <p className="text-[14px] font-black text-slate-900">{product.shop_sale_name}</p>
            </div>
            <label className="block text-[12px] font-bold text-slate-600">상품명 (최대 100Byte, | # 불가)
              <input value={form.shop_sale_name} onChange={(e) => setForm({ ...form, shop_sale_name: e.target.value })} className={`${fieldClass} mt-1`} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-[12px] font-bold text-slate-600">판매수량
                <input value={form.sale_cnt_limit} onChange={(e) => setForm({ ...form, sale_cnt_limit: e.target.value })} className={`${fieldClass} mt-1`} />
              </label>
              <label className="block text-[12px] font-bold text-slate-600">판매가 {isExecutive ? '(대표만 변경 가능)' : '(대표만 변경)'}
                <input value={form.sale_price} disabled={!isExecutive} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} className={`${fieldClass} mt-1 disabled:bg-slate-50`} />
              </label>
            </div>
            <label className="block text-[12px] font-bold text-slate-600">검색 키워드 (쉼표로 구분)
              <input value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} className={`${fieldClass} mt-1`} />
            </label>

            {form.opts.length > 0 && (
              <div>
                <p className="mb-1 text-[12px] font-bold text-slate-600">옵션 (상태·판매수량)</p>
                <div className="space-y-1">
                  {form.opts.map((o, i) => (
                    <div key={i} className="flex items-center gap-2 text-[12.5px]">
                      <span className="min-w-0 flex-1 truncate">{o.opt_sort1_desc}{o.opt_sort2_desc ? ` / ${o.opt_sort2_desc}` : ''}</span>
                      <select value={o.status} onChange={(e) => { const opts = [...form.opts]; opts[i] = { ...o, status: e.target.value }; setForm({ ...form, opts }) }}
                        className="h-8 rounded border border-slate-200 px-2">
                        <option value="정상">정상</option><option value="품절">품절</option>
                      </select>
                      <input value={o.stock_cnt ?? ''} onChange={(e) => { const opts = [...form.opts]; opts[i] = { ...o, stock_cnt: e.target.value }; setForm({ ...form, opts }) }}
                        className="h-8 w-20 rounded border border-slate-200 px-2" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <label className="block text-[12px] font-bold text-slate-600">상세설명 (HTML)
              <textarea value={form.detail_desc} onChange={(e) => setForm({ ...form, detail_desc: e.target.value })}
                rows={6} className="mt-1 w-full rounded-lg border border-slate-200 p-2 font-mono text-[12px] outline-none focus:border-sky-400" />
            </label>

            {warnings.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-[12.5px] font-black text-amber-800">표시·광고 점검 경고 {warnings.length}건</p>
                <ul className="mt-1 list-disc pl-5 text-[12px] text-amber-800">
                  {warnings.map((w, i) => <li key={i}>"{w.match}" — {w.reason}</li>)}
                </ul>
                <label className="mt-2 flex items-center gap-2 text-[12px] font-bold text-amber-900">
                  <input type="checkbox" checked={ackWarnings} onChange={(e) => setAckWarnings(e.target.checked)} />
                  근거를 확인했고 이 표현을 그대로 쓰겠습니다
                </label>
              </div>
            )}

            {isExecutive && String(form.sale_price) !== String(product.sale_price ?? '') && (
              <label className="flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-[12.5px] font-bold text-rose-800">
                <input type="checkbox" checked={confirmPrice} onChange={(e) => setConfirmPrice(e.target.checked)} />
                판매가를 {Number(product.sale_price || 0).toLocaleString()}원 → {Number(form.sale_price || 0).toLocaleString()}원으로 바꾸고, 연동 쇼핑몰에도 반영합니다
              </label>
            )}

            <div className="flex gap-2">
              <button type="button" onClick={runCheck} className="h-10 rounded-lg border border-slate-200 px-4 text-[13px] font-black text-slate-700">표시·광고 점검</button>
              <button type="button" onClick={save} disabled={saving}
                className="h-10 rounded-lg bg-slate-900 px-4 text-[13px] font-black text-white hover:bg-slate-700">{saving ? '저장 중…' : '저장 → 전 채널 반영'}</button>
            </div>

            {result && (
              <p className={`rounded-lg px-3 py-2 text-[12.5px] font-bold ${result.saved ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                {result.saved ? `저장 완료: ${(result.changed || []).join(', ')} — 연동 쇼핑몰 반영까지 몇 분 걸릴 수 있습니다.` : (result.message || '저장 실패')}
              </p>
            )}
          </section>
        )}
      </div>
    </div>
  )
}
