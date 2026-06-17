import { useState, useEffect, useCallback } from 'react'
import {
  getOnlinePerformances,
  createOnlinePerformance,
  updateOnlinePerformance,
  deleteOnlinePerformance,
  getClientPerformances,
  createClientPerformance,
  updateClientPerformance,
  deleteClientPerformance,
  getIncentiveSummary,
  patchIncentiveSummaryStatus,
  getIncentiveKpi,
} from '../../api/incentiveApi'

const CHANNELS = ['스마트스토어', '자사몰', '쿠팡', '카카오톡스토어', '11번가', '옥션', '지마켓', '기타']
const EMPLOYEES = ['이재연', '정아름']
const CLIENT_STATUSES = ['리드', '샘플발송', '견적발송', '협의중', '첫발주', '거래중', '종료']
const INCENTIVE_STATUSES = ['EXPECTED', 'REVIEWING', 'CONFIRMED', 'PAID']
const INCENTIVE_STATUS_LABELS = { EXPECTED: '예상', REVIEWING: '검토중', CONFIRMED: '확정', PAID: '지급완료' }
const INCENTIVE_STATUS_COLORS = {
  EXPECTED: 'bg-slate-100 text-slate-600',
  REVIEWING: 'bg-yellow-100 text-yellow-700',
  CONFIRMED: 'bg-blue-100 text-blue-700',
  PAID: 'bg-green-100 text-green-700',
}
const CLIENT_STATUS_COLORS = {
  '리드': 'bg-slate-100 text-slate-600',
  '샘플발송': 'bg-blue-100 text-blue-700',
  '견적발송': 'bg-purple-100 text-purple-700',
  '협의중': 'bg-yellow-100 text-yellow-700',
  '첫발주': 'bg-orange-100 text-orange-700',
  '거래중': 'bg-green-100 text-green-700',
  '종료': 'bg-red-100 text-red-700',
}

function fmt(n) {
  if (n == null) return '0'
  return Number(n).toLocaleString('ko-KR') + '원'
}

function fmtNum(n) {
  if (n == null) return '0'
  return Number(n).toLocaleString('ko-KR')
}

function currentMonth() {
  const now = new Date()
  return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0')
}

function KpiCard({ label, value, icon, color = 'text-sky-600' }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <span className={`material-symbols-outlined text-2xl ${color}`}>{icon}</span>
        <p className="text-xs font-bold text-slate-500">{label}</p>
      </div>
      <p className={`mt-2 text-xl font-black text-slate-900`}>{value}</p>
    </div>
  )
}

function Badge({ status, map, colorMap }) {
  const label = map ? map[status] || status : status
  const cls = colorMap ? colorMap[status] || 'bg-slate-100 text-slate-600' : 'bg-slate-100 text-slate-600'
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${cls}`}>{label}</span>
}

// ==================== 온라인 성과 탭 ====================
function OnlinePerformanceTab({ month }) {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState({
    channelName: '스마트스토어', assigneeName: '', salesAmount: '',
    manufacturingCost: '', advertisingCost: '', commissionCost: '',
    logisticsCost: '', otherCost: '', incentiveEligible: true, memo: '',
  })
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    getOnlinePerformances(month)
      .then(setList)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [month])

  useEffect(() => { load() }, [load])

  const operatingProfit = (() => {
    const s = Number(form.salesAmount) || 0
    const mc = Number(form.manufacturingCost) || 0
    const ac = Number(form.advertisingCost) || 0
    const cc = Number(form.commissionCost) || 0
    const lc = Number(form.logisticsCost) || 0
    const oc = Number(form.otherCost) || 0
    return s - mc - ac - cc - lc - oc
  })()

  function openCreate() {
    setEditItem(null)
    setForm({ channelName: '스마트스토어', assigneeName: '', salesAmount: '', manufacturingCost: '', advertisingCost: '', commissionCost: '', logisticsCost: '', otherCost: '', incentiveEligible: true, memo: '' })
    setShowForm(true)
  }

  function openEdit(item) {
    setEditItem(item)
    setForm({
      channelName: item.channelName, assigneeName: item.assigneeName || '',
      salesAmount: item.salesAmount || '', manufacturingCost: item.manufacturingCost || '',
      advertisingCost: item.advertisingCost || '', commissionCost: item.commissionCost || '',
      logisticsCost: item.logisticsCost || '', otherCost: item.otherCost || '',
      incentiveEligible: item.incentiveEligible !== false, memo: item.memo || '',
    })
    setShowForm(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const payload = {
        performanceMonth: month,
        channelName: form.channelName,
        assigneeName: form.assigneeName,
        salesAmount: Number(form.salesAmount) || 0,
        manufacturingCost: Number(form.manufacturingCost) || 0,
        advertisingCost: Number(form.advertisingCost) || 0,
        commissionCost: Number(form.commissionCost) || 0,
        logisticsCost: Number(form.logisticsCost) || 0,
        otherCost: Number(form.otherCost) || 0,
        incentiveEligible: form.incentiveEligible,
        memo: form.memo,
      }
      if (editItem) await updateOnlinePerformance(editItem.id, payload)
      else await createOnlinePerformance(payload)
      setShowForm(false)
      load()
    } catch (e) {
      alert('저장 실패: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    if (!confirm('삭제하시겠습니까?')) return
    await deleteOnlinePerformance(id)
    load()
  }

  // Pool calculation for display
  const totalEligibleProfit = list.filter(o => o.incentiveEligible).reduce((s, o) => s + (o.operatingProfit || 0), 0)
  const pool = totalEligibleProfit > 3000000 ? Math.round((totalEligibleProfit - 3000000) * 0.1) : 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-4 text-sm">
          <span className="font-bold text-slate-600">전체 영업이익: <span className="text-slate-900">{fmt(totalEligibleProfit)}</span></span>
          <span className="font-bold text-sky-600">온라인 인센티브 풀: <span className="text-sky-700">{fmt(pool)}</span></span>
        </div>
        <button onClick={openCreate} className="flex items-center gap-1.5 rounded-lg bg-sky-500 px-4 py-2 text-sm font-bold text-white hover:bg-sky-600">
          <span className="material-symbols-outlined text-sm">add</span>등록
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-5">
          <h3 className="mb-4 font-black text-slate-800">{editItem ? '수정' : '온라인 성과 등록'}</h3>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div>
              <label className="text-xs font-bold text-slate-600">채널</label>
              <select value={form.channelName} onChange={e => setForm(f => ({ ...f, channelName: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm">
                {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600">담당자</label>
              <select value={form.assigneeName} onChange={e => setForm(f => ({ ...f, assigneeName: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm">
                <option value="">선택</option>
                {EMPLOYEES.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            {[
              { key: 'salesAmount', label: '매출' },
              { key: 'manufacturingCost', label: '제조원가' },
              { key: 'advertisingCost', label: '광고비' },
              { key: 'commissionCost', label: '수수료' },
              { key: 'logisticsCost', label: '물류비' },
              { key: 'otherCost', label: '기타비용' },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="text-xs font-bold text-slate-600">{label}</label>
                <input type="number" value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm" placeholder="0" />
              </div>
            ))}
            <div>
              <label className="text-xs font-bold text-slate-600">영업이익 (자동)</label>
              <div className={`mt-1 rounded-lg border border-slate-200 bg-white p-2 text-sm font-bold ${operatingProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {fmtNum(operatingProfit)}원
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600">메모</label>
              <input value={form.memo} onChange={e => setForm(f => ({ ...f, memo: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm" />
            </div>
            <div className="flex items-end gap-2">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
                <input type="checkbox" checked={form.incentiveEligible} onChange={e => setForm(f => ({ ...f, incentiveEligible: e.target.checked }))} />
                인센티브 계산 대상
              </label>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={handleSave} disabled={saving} className="rounded-lg bg-sky-500 px-5 py-2 text-sm font-bold text-white hover:bg-sky-600 disabled:opacity-50">
              {saving ? '저장중...' : '저장'}
            </button>
            <button onClick={() => setShowForm(false)} className="rounded-lg border border-slate-200 px-5 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">취소</button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs font-bold text-slate-500">
            <tr>
              {['채널', '담당자', '매출', '제조원가', '광고비', '수수료', '물류비', '기타', '영업이익', '대상', '예상 인센티브', '메모', ''].map(h => (
                <th key={h} className="px-3 py-3 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={13} className="py-10 text-center text-slate-400">불러오는 중...</td></tr>
            ) : list.length === 0 ? (
              <tr><td colSpan={13} className="py-10 text-center text-slate-400">등록된 데이터가 없습니다.</td></tr>
            ) : list.map(item => (
              <tr key={item.id} className="hover:bg-slate-50">
                <td className="px-3 py-3 font-bold">{item.channelName}</td>
                <td className="px-3 py-3">{item.assigneeName || '-'}</td>
                <td className="px-3 py-3 text-right">{fmtNum(item.salesAmount)}</td>
                <td className="px-3 py-3 text-right">{fmtNum(item.manufacturingCost)}</td>
                <td className="px-3 py-3 text-right">{fmtNum(item.advertisingCost)}</td>
                <td className="px-3 py-3 text-right">{fmtNum(item.commissionCost)}</td>
                <td className="px-3 py-3 text-right">{fmtNum(item.logisticsCost)}</td>
                <td className="px-3 py-3 text-right">{fmtNum(item.otherCost)}</td>
                <td className={`px-3 py-3 text-right font-bold ${(item.operatingProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmtNum(item.operatingProfit)}</td>
                <td className="px-3 py-3 text-center">{item.incentiveEligible ? '✅' : '❌'}</td>
                <td className="px-3 py-3 text-right font-bold text-sky-600">{fmt(item.expectedIncentive)}</td>
                <td className="px-3 py-3 text-slate-500">{item.memo || '-'}</td>
                <td className="px-3 py-3">
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(item)} className="rounded px-2 py-1 text-xs font-bold text-slate-500 hover:bg-slate-100">수정</button>
                    <button onClick={() => handleDelete(item.id)} className="rounded px-2 py-1 text-xs font-bold text-red-400 hover:bg-red-50">삭제</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ==================== 거래처 성과 탭 ====================
function ClientPerformanceTab() {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState({
    clientName: '', assigneeName: '', firstRegisteredDate: '', firstOrderDate: '',
    firstOrderAmount: '', cumulativeSales: '', cumulativeOperatingProfit: '',
    status: '리드', memo: '',
  })
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    getClientPerformances().then(setList).catch(console.error).finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  function calcFirstOrderIncentive(amt) {
    const a = Number(amt) || 0
    if (a < 500000) return 0
    if (a < 3000000) return 50000
    if (a < 10000000) return 100000
    return 200000
  }

  function calcCumIncentive(sales) {
    const s = Number(sales) || 0
    if (s >= 100000000) return 500000
    if (s >= 50000000) return 300000
    if (s >= 30000000) return 200000
    if (s >= 10000000) return 100000
    return 0
  }

  const previewFOI = calcFirstOrderIncentive(form.firstOrderAmount)
  const previewCUI = calcCumIncentive(form.cumulativeSales)

  function openCreate() {
    setEditItem(null)
    setForm({ clientName: '', assigneeName: '', firstRegisteredDate: '', firstOrderDate: '', firstOrderAmount: '', cumulativeSales: '', cumulativeOperatingProfit: '', status: '리드', memo: '' })
    setShowForm(true)
  }

  function openEdit(item) {
    setEditItem(item)
    setForm({
      clientName: item.clientName, assigneeName: item.assigneeName || '',
      firstRegisteredDate: item.firstRegisteredDate || '', firstOrderDate: item.firstOrderDate || '',
      firstOrderAmount: item.firstOrderAmount || '', cumulativeSales: item.cumulativeSales || '',
      cumulativeOperatingProfit: item.cumulativeOperatingProfit || '',
      status: item.status || '리드', memo: item.memo || '',
    })
    setShowForm(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const payload = {
        clientName: form.clientName,
        assigneeName: form.assigneeName,
        firstRegisteredDate: form.firstRegisteredDate || null,
        firstOrderDate: form.firstOrderDate || null,
        firstOrderAmount: Number(form.firstOrderAmount) || 0,
        cumulativeSales: Number(form.cumulativeSales) || 0,
        cumulativeOperatingProfit: Number(form.cumulativeOperatingProfit) || 0,
        status: form.status,
        memo: form.memo,
      }
      if (editItem) await updateClientPerformance(editItem.id, payload)
      else await createClientPerformance(payload)
      setShowForm(false)
      load()
    } catch (e) {
      alert('저장 실패: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    if (!confirm('삭제하시겠습니까?')) return
    await deleteClientPerformance(id)
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-slate-600">총 거래처: {list.length}개</p>
        <button onClick={openCreate} className="flex items-center gap-1.5 rounded-lg bg-sky-500 px-4 py-2 text-sm font-bold text-white hover:bg-sky-600">
          <span className="material-symbols-outlined text-sm">add</span>거래처 등록
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-5">
          <h3 className="mb-4 font-black text-slate-800">{editItem ? '거래처 수정' : '거래처 등록'}</h3>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div>
              <label className="text-xs font-bold text-slate-600">거래처명 *</label>
              <input value={form.clientName} onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600">담당자</label>
              <select value={form.assigneeName} onChange={e => setForm(f => ({ ...f, assigneeName: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm">
                <option value="">선택</option>
                {EMPLOYEES.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600">최초 등록일</label>
              <input type="date" value={form.firstRegisteredDate} onChange={e => setForm(f => ({ ...f, firstRegisteredDate: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600">첫 발주일</label>
              <input type="date" value={form.firstOrderDate} onChange={e => setForm(f => ({ ...f, firstOrderDate: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600">첫 발주금액</label>
              <input type="number" value={form.firstOrderAmount} onChange={e => setForm(f => ({ ...f, firstOrderAmount: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm" placeholder="0" />
              <p className="mt-1 text-xs text-sky-600 font-bold">첫발주 인센티브: {fmt(previewFOI)}</p>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600">누적 매출</label>
              <input type="number" value={form.cumulativeSales} onChange={e => setForm(f => ({ ...f, cumulativeSales: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm" placeholder="0" />
              <p className="mt-1 text-xs text-purple-600 font-bold">누적매출 인센티브: {fmt(previewCUI)}</p>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600">누적 영업이익</label>
              <input type="number" value={form.cumulativeOperatingProfit} onChange={e => setForm(f => ({ ...f, cumulativeOperatingProfit: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm" placeholder="0" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600">상태</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm">
                {CLIENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600">메모</label>
              <input value={form.memo} onChange={e => setForm(f => ({ ...f, memo: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm" />
            </div>
            <div className="flex items-end">
              <div className="rounded-lg border border-orange-200 bg-orange-50 p-2 text-sm">
                <p className="text-xs font-bold text-orange-600">총 예상 인센티브</p>
                <p className="font-black text-orange-700">{fmt(previewFOI + previewCUI)}</p>
              </div>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={handleSave} disabled={saving} className="rounded-lg bg-sky-500 px-5 py-2 text-sm font-bold text-white hover:bg-sky-600 disabled:opacity-50">
              {saving ? '저장중...' : '저장'}
            </button>
            <button onClick={() => setShowForm(false)} className="rounded-lg border border-slate-200 px-5 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">취소</button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs font-bold text-slate-500">
            <tr>
              {['거래처명', '담당자', '최초 등록일', '첫 발주일', '첫 발주금액', '누적 매출', '누적 영업이익', '상태', '첫발주 인센티브', '누적매출 인센티브', '총 예상 인센티브', '메모', ''].map(h => (
                <th key={h} className="px-3 py-3 text-left whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={13} className="py-10 text-center text-slate-400">불러오는 중...</td></tr>
            ) : list.length === 0 ? (
              <tr><td colSpan={13} className="py-10 text-center text-slate-400">등록된 거래처가 없습니다.</td></tr>
            ) : list.map(item => (
              <tr key={item.id} className="hover:bg-slate-50">
                <td className="px-3 py-3 font-bold">{item.clientName}</td>
                <td className="px-3 py-3">{item.assigneeName || '-'}</td>
                <td className="px-3 py-3">{item.firstRegisteredDate || '-'}</td>
                <td className="px-3 py-3">{item.firstOrderDate || '-'}</td>
                <td className="px-3 py-3 text-right">{fmtNum(item.firstOrderAmount)}</td>
                <td className="px-3 py-3 text-right">{fmtNum(item.cumulativeSales)}</td>
                <td className="px-3 py-3 text-right">{fmtNum(item.cumulativeOperatingProfit)}</td>
                <td className="px-3 py-3"><Badge status={item.status} colorMap={CLIENT_STATUS_COLORS} /></td>
                <td className="px-3 py-3 text-right font-bold text-sky-600">{fmt(item.firstOrderIncentive)}</td>
                <td className="px-3 py-3 text-right font-bold text-purple-600">{fmt(item.cumulativeSalesIncentive)}</td>
                <td className="px-3 py-3 text-right font-black text-orange-600">{fmt(item.totalExpectedIncentive)}</td>
                <td className="px-3 py-3 text-slate-500">{item.memo || '-'}</td>
                <td className="px-3 py-3">
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(item)} className="rounded px-2 py-1 text-xs font-bold text-slate-500 hover:bg-slate-100">수정</button>
                    <button onClick={() => handleDelete(item.id)} className="rounded px-2 py-1 text-xs font-bold text-red-400 hover:bg-red-50">삭제</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ==================== 직원별 예상 인센티브 탭 ====================
function IncentiveSummaryTab({ month }) {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    getIncentiveSummary(month).then(setList).catch(console.error).finally(() => setLoading(false))
  }, [month])

  useEffect(() => { load() }, [load])

  async function handleStatusChange(id, status) {
    try {
      await patchIncentiveSummaryStatus(id, status)
      load()
    } catch (e) {
      alert('상태 변경 실패: ' + e.message)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-slate-600">{month} 직원별 예상 인센티브</p>
        <button onClick={load} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">
          <span className="material-symbols-outlined text-sm">refresh</span>재계산
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs font-bold text-slate-500">
            <tr>
              {['직원명', '온라인 인센티브', '거래처 인센티브', '총 예상 인센티브', '상태', '메모'].map(h => (
                <th key={h} className="px-4 py-3 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={6} className="py-10 text-center text-slate-400">계산 중...</td></tr>
            ) : list.length === 0 ? (
              <tr><td colSpan={6} className="py-10 text-center text-slate-400">이번 달 데이터가 없습니다.</td></tr>
            ) : list.map(item => (
              <tr key={item.id} className="hover:bg-slate-50">
                <td className="px-4 py-4 font-black text-slate-800">{item.employeeName}</td>
                <td className="px-4 py-4 text-right font-bold text-sky-600">{fmt(item.onlineIncentive)}</td>
                <td className="px-4 py-4 text-right font-bold text-purple-600">{fmt(item.clientIncentive)}</td>
                <td className="px-4 py-4 text-right text-xl font-black text-orange-600">{fmt(item.totalIncentive)}</td>
                <td className="px-4 py-4">
                  <select
                    value={item.status}
                    onChange={e => handleStatusChange(item.id, e.target.value)}
                    className="rounded-full border-0 bg-transparent text-xs font-bold focus:ring-0"
                  >
                    {INCENTIVE_STATUSES.map(s => (
                      <option key={s} value={s}>{INCENTIVE_STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                  <Badge status={item.status} map={INCENTIVE_STATUS_LABELS} colorMap={INCENTIVE_STATUS_COLORS} />
                </td>
                <td className="px-4 py-4 text-slate-500">{item.memo || '-'}</td>
              </tr>
            ))}
          </tbody>
          {list.length > 0 && (
            <tfoot className="bg-sky-50">
              <tr>
                <td className="px-4 py-3 font-black text-slate-800">합계</td>
                <td className="px-4 py-3 text-right font-bold text-sky-600">{fmt(list.reduce((s, i) => s + (i.onlineIncentive || 0), 0))}</td>
                <td className="px-4 py-3 text-right font-bold text-purple-600">{fmt(list.reduce((s, i) => s + (i.clientIncentive || 0), 0))}</td>
                <td className="px-4 py-3 text-right text-xl font-black text-orange-600">{fmt(list.reduce((s, i) => s + (i.totalIncentive || 0), 0))}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}

// ==================== 메인 페이지 ====================
export default function IncentiveManagementPage() {
  const [tab, setTab] = useState('online')
  const [month, setMonth] = useState(currentMonth)
  const [kpi, setKpi] = useState(null)
  const [kpiLoading, setKpiLoading] = useState(false)

  const loadKpi = useCallback(() => {
    setKpiLoading(true)
    getIncentiveKpi(month).then(setKpi).catch(console.error).finally(() => setKpiLoading(false))
  }, [month])

  useEffect(() => { loadKpi() }, [loadKpi])

  const tabs = [
    { id: 'online', label: '온라인 성과' },
    { id: 'clients', label: '거래처 성과' },
    { id: 'summary', label: '직원별 예상 인센티브' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900">성과 · 인센티브 관리</h2>
          <p className="mt-1 text-sm text-slate-500">온라인 채널 성과, 거래처 성과, 직원별 예상 인센티브를 관리합니다.</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm font-bold text-slate-600">월 선택</label>
          <input
            type="month"
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold"
          />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-7">
        <KpiCard label="이번달 온라인 매출" value={kpiLoading ? '...' : fmt(kpi?.monthlyOnlineSales)} icon="trending_up" color="text-sky-500" />
        <KpiCard label="이번달 온라인 영업이익" value={kpiLoading ? '...' : fmt(kpi?.monthlyOnlineOperatingProfit)} icon="analytics" color="text-green-500" />
        <KpiCard label="온라인 인센티브 풀" value={kpiLoading ? '...' : fmt(kpi?.onlineIncentivePool)} icon="monetization_on" color="text-blue-500" />
        <KpiCard label="신규 거래처 수" value={kpiLoading ? '...' : (kpi?.newClientCount ?? '-') + '개'} icon="store" color="text-purple-500" />
        <KpiCard label="첫 발주 발생" value={kpiLoading ? '...' : (kpi?.firstOrderClientCount ?? '-') + '개'} icon="shopping_cart" color="text-orange-500" />
        <KpiCard label="거래처 누적 매출" value={kpiLoading ? '...' : fmt(kpi?.clientCumulativeSales)} icon="account_balance" color="text-teal-500" />
        <KpiCard label="이번달 총 예상 인센티브" value={kpiLoading ? '...' : fmt(kpi?.totalExpectedIncentive)} icon="payments" color="text-rose-500" />
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <div className="flex gap-1">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-5 py-3 text-sm font-bold transition-colors ${tab === t.id ? 'border-b-2 border-sky-500 text-sky-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {tab === 'online' && <OnlinePerformanceTab month={month} />}
      {tab === 'clients' && <ClientPerformanceTab />}
      {tab === 'summary' && <IncentiveSummaryTab month={month} />}
    </div>
  )
}
