import { useEffect, useState } from 'react'
import { DataTable, EmptyState, Panel, StatusBadge } from '../ExecutiveComponents'
import { won, pct } from '../formatters'
import { fmtWon, fmtPct, fmtCount, signClass } from './cfoUtils'
import { LoadingBox, ErrorBox, StatCard } from './CfoShared'
import {
  getCfoProfitStatement,
  getCfoProductProfitability,
  getCfoChannelProfitability,
  addCfoFeeHistory,
} from '../../../api/cfoApi'

// ── 손익 분석 탭 ─────────────────────────────────────────────
export function ProfitTab({ month }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    getCfoProfitStatement({ month })
      .then((res) => setData(res.data))
      .catch((e) => setError(e?.response?.data?.message || e.message))
  }, [month])

  if (error) return <ErrorBox message={error} />
  if (!data) return <LoadingBox />

  const highlight = ['순매출', '매출총이익', '공헌이익', '영업이익', '세전이익(추정)']
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="순매출" value={fmtWon(data.current?.netSales)} tooltip={data.current?.basis?.netSales} />
        <StatCard label="매출총이익률" value={fmtPct(data.current?.grossMarginPct)} tone="emerald" />
        <StatCard label="공헌이익률" value={fmtPct(data.current?.contributionMarginPct)} tone="emerald" />
        <StatCard
          label="영업이익"
          value={fmtWon(data.current?.operatingProfit)}
          tone={Number(data.current?.operatingProfit) < 0 ? 'rose' : 'sky'}
        />
      </div>
      <Panel title={`${data.month} 경영 손익계산서`} right={
        data.budgetAchievementPct != null && (
          <span className="text-xs font-black text-sky-700">매출 예산 달성률 {fmtPct(data.budgetAchievementPct)}</span>
        )
      }>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-xs font-black text-slate-500">구분</th>
                <th className="px-4 py-3 text-xs font-black text-slate-500">항목</th>
                <th className="px-4 py-3 text-right text-xs font-black text-slate-500">당월</th>
                <th className="px-4 py-3 text-right text-xs font-black text-slate-500">전월</th>
                <th className="px-4 py-3 text-right text-xs font-black text-slate-500">증감률</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(data.lines || []).map((line, index) => (
                <tr key={index} className={highlight.includes(line.label) ? 'bg-sky-50/50 font-black' : ''}>
                  <td className="px-4 py-2.5 text-xs font-bold text-slate-400">{line.section}</td>
                  <td className="px-4 py-2.5 text-sm font-bold text-slate-800">
                    {line.label}
                    {line.note && <span className="ml-2 text-[11px] font-medium text-slate-400">{line.note}</span>}
                  </td>
                  <td className={`px-4 py-2.5 text-right text-sm font-black ${signClass(line.amount)}`}>{fmtWon(line.amount)}</td>
                  <td className="px-4 py-2.5 text-right text-sm font-medium text-slate-500">{line.prevAmount == null ? '—' : won(line.prevAmount)}</td>
                  <td className={`px-4 py-2.5 text-right text-xs font-bold ${line.changePct == null ? 'text-slate-400' : Number(line.changePct) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {line.changePct == null ? '—' : `${Number(line.changePct) >= 0 ? '+' : ''}${pct(line.changePct)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-xs font-medium text-slate-400">
          원가 매칭 커버리지 {fmtPct(data.current?.costCoveragePct)} — 100% 미만이면 원가 미등록 상품이 있어 이익이 과대 표시될 수 있습니다.
        </p>
      </Panel>
    </div>
  )
}

// ── 상품별 수익성 탭 ─────────────────────────────────────────
export function ProductTab({ from, to }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    getCfoProductProfitability({ from, to })
      .then((res) => setData(res.data))
      .catch((e) => setError(e?.response?.data?.message || e.message))
  }, [from, to])

  if (error) return <ErrorBox message={error} />
  if (!data) return <LoadingBox />

  let rows = data.rows || []
  if (filter === 'loss') rows = rows.filter((r) => r.classification === '적자 상품')
  if (filter === 'unmatched') rows = rows.filter((r) => r.classification === '원가 미등록')
  if (filter === 'star') rows = rows.filter((r) => r.classification === '스타 상품')

  const clsTone = (value) => {
    if (value === '적자 상품') return 'border-rose-200 bg-rose-50 text-rose-700'
    if (value === '원가 미등록' || value === '개선 필요' || value === '매출형 상품') return 'border-amber-200 bg-amber-50 text-amber-700'
    if (value === '스타 상품' || value === '효자 상품') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
    return 'border-slate-200 bg-slate-50 text-slate-600'
  }

  return (
    <Panel
      title="상품 × 채널 공헌이익"
      right={
        <select value={filter} onChange={(e) => setFilter(e.target.value)}
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 outline-none focus:border-sky-400">
          <option value="all">전체 보기</option>
          <option value="loss">적자 상품만</option>
          <option value="star">스타 상품만</option>
          <option value="unmatched">원가 미등록만</option>
        </select>
      }
    >
      {rows.length === 0 ? <EmptyState message="조건에 맞는 상품 데이터가 없습니다." /> : (
        <DataTable
          columns={[
            { key: 'product_name', label: '상품명' },
            { key: 'channel_name', label: '채널' },
            { key: 'quantity', label: '판매수량', render: (r) => <span className="block text-right">{fmtCount(r.quantity)}</span> },
            { key: 'revenue', label: '순매출', render: (r) => <span className="block text-right font-black">{won(r.revenue)}</span> },
            { key: 'cogs', label: '원가', render: (r) => <span className="block text-right">{won(r.cogs)}</span> },
            { key: 'channel_fee', label: '채널수수료', render: (r) => <span className="block text-right">{won(r.channel_fee)}</span> },
            { key: 'adCostAllocated', label: '광고비 배부', render: (r) => <span className="block text-right">{won(r.adCostAllocated)}</span> },
            { key: 'contributionProfit', label: '공헌이익', render: (r) => <span className={`block text-right font-black ${signClass(r.contributionProfit)}`}>{fmtWon(r.contributionProfit)}</span> },
            { key: 'contributionMarginPct', label: '공헌이익률', render: (r) => <span className="block text-right">{fmtPct(r.contributionMarginPct)}</span> },
            { key: 'unitContribution', label: '개당 공헌이익', render: (r) => <span className={`block text-right ${signClass(r.unitContribution)}`}>{fmtWon(r.unitContribution)}</span> },
            {
              key: 'classification', label: '분류',
              render: (r) => (
                <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black ${clsTone(r.classification)}`}>
                  {r.classification}
                </span>
              ),
            },
          ]}
          rows={rows}
          rowKey={(r) => `${r.channel_name}-${r.product_code}`}
          searchPlaceholder="상품명·채널 검색"
          sortOptions={[
            { id: 'revenue', label: '매출순', key: 'revenue' },
            { id: 'contribution', label: '공헌이익순', key: 'contributionProfit' },
            { id: 'marginPct', label: '공헌이익률순', key: 'contributionMarginPct' },
            { id: 'quantity', label: '판매량순', key: 'quantity' },
          ]}
        />
      )}
      <p className="mt-4 text-xs font-medium text-slate-400">{data.basis}</p>
    </Panel>
  )
}

// ── 채널별 수익성 탭 ─────────────────────────────────────────
export function ChannelTab({ from, to }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [feeForm, setFeeForm] = useState({ channelName: '', feeRatePct: '', paymentFeePct: '', effectiveFrom: '' })
  const [saving, setSaving] = useState(false)

  const load = () => {
    getCfoChannelProfitability({ from, to })
      .then((res) => setData(res.data))
      .catch((e) => setError(e?.response?.data?.message || e.message))
  }
  useEffect(load, [from, to])

  if (error) return <ErrorBox message={error} />
  if (!data) return <LoadingBox />

  const submitFee = async () => {
    if (!feeForm.channelName || !feeForm.feeRatePct) return
    setSaving(true)
    try {
      await addCfoFeeHistory({
        channelName: feeForm.channelName,
        feeRatePct: Number(feeForm.feeRatePct),
        paymentFeePct: feeForm.paymentFeePct ? Number(feeForm.paymentFeePct) : 0,
        effectiveFrom: feeForm.effectiveFrom || undefined,
      })
      setFeeForm({ channelName: '', feeRatePct: '', paymentFeePct: '', effectiveFrom: '' })
      load()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <Panel title="채널별 실질 수익성">
        {(data.rows || []).length === 0 ? <EmptyState /> : (
          <DataTable
            columns={[
              { key: 'channel_name', label: '채널' },
              { key: 'order_count', label: '주문수', render: (r) => <span className="block text-right">{fmtCount(r.order_count)}</span> },
              { key: 'net_revenue', label: '순매출', render: (r) => <span className="block text-right font-black">{won(r.net_revenue)}</span> },
              { key: 'avgOrderValue', label: '객단가', render: (r) => <span className="block text-right">{fmtWon(r.avgOrderValue)}</span> },
              { key: 'channel_fee', label: '채널수수료', render: (r) => <span className="block text-right">{won(r.channel_fee)}</span> },
              { key: 'adCost', label: '광고비', render: (r) => <span className="block text-right">{won(r.adCost)}</span> },
              { key: 'roas', label: 'ROAS', render: (r) => <span className="block text-right">{r.roas == null ? '—' : `${Number(r.roas).toFixed(1)}x`}</span> },
              { key: 'cogs', label: '원가', render: (r) => <span className="block text-right">{won(r.cogs)}</span> },
              { key: 'contributionProfit', label: '공헌이익', render: (r) => <span className={`block text-right font-black ${signClass(r.contributionProfit)}`}>{fmtWon(r.contributionProfit)}</span> },
              { key: 'contributionMarginPct', label: '공헌이익률', render: (r) => <span className="block text-right">{fmtPct(r.contributionMarginPct)}</span> },
              { key: 'costCoveragePct', label: '원가 매칭률', render: (r) => <span className="block text-right text-xs">{fmtPct(r.costCoveragePct)}</span> },
            ]}
            rows={data.rows}
            rowKey={(r) => r.channel_name}
            searchPlaceholder="채널 검색"
            sortOptions={[
              { id: 'revenue', label: '매출순', key: 'net_revenue' },
              { id: 'contribution', label: '공헌이익순', key: 'contributionProfit' },
              { id: 'marginPct', label: '공헌이익률순', key: 'contributionMarginPct' },
            ]}
          />
        )}
        <p className="mt-4 text-xs font-medium text-slate-400">{data.basis}</p>
      </Panel>

      <Panel title="채널 수수료 설정 (기간별 이력)">
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <input value={feeForm.channelName} onChange={(e) => setFeeForm({ ...feeForm, channelName: e.target.value })}
            placeholder="채널명" className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-bold outline-none focus:border-sky-400" />
          <input value={feeForm.feeRatePct} onChange={(e) => setFeeForm({ ...feeForm, feeRatePct: e.target.value })}
            placeholder="판매 수수료 %" type="number" step="0.01" className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-bold outline-none focus:border-sky-400" />
          <input value={feeForm.paymentFeePct} onChange={(e) => setFeeForm({ ...feeForm, paymentFeePct: e.target.value })}
            placeholder="결제 수수료 %" type="number" step="0.01" className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-bold outline-none focus:border-sky-400" />
          <input value={feeForm.effectiveFrom} onChange={(e) => setFeeForm({ ...feeForm, effectiveFrom: e.target.value })}
            type="date" className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-bold outline-none focus:border-sky-400" />
          <button type="button" onClick={submitFee} disabled={saving}
            className="h-10 rounded-lg bg-sky-600 px-4 text-sm font-black text-white hover:bg-sky-700 disabled:opacity-50">
            {saving ? '저장 중...' : '요율 변경 등록'}
          </button>
        </div>
        <p className="mb-4 text-xs font-medium text-slate-400">
          새 요율을 등록하면 기존 구간은 자동으로 마감됩니다. 과거 주문은 당시 요율로 계산되며, 과거 데이터는 덮어쓰지 않습니다.
        </p>
        {(data.feeSettings || []).length === 0 ? <EmptyState message="등록된 수수료 이력이 없습니다." /> : (
          <DataTable
            columns={[
              { key: 'channel_name', label: '채널' },
              { key: 'product_code', label: '상품코드', render: (r) => r.product_code || '채널 공통' },
              { key: 'fee_rate_pct', label: '판매 수수료', render: (r) => <span className="block text-right">{pct(r.fee_rate_pct)}</span> },
              { key: 'payment_fee_pct', label: '결제 수수료', render: (r) => <span className="block text-right">{pct(r.payment_fee_pct)}</span> },
              { key: 'effective_from', label: '적용 시작' },
              { key: 'effective_to', label: '적용 종료', render: (r) => r.effective_to || <StatusBadge value="ACTIVE" /> },
            ]}
            rows={data.feeSettings}
            rowKey={(r) => r.id}
            searchPlaceholder="채널·상품코드 검색"
          />
        )}
      </Panel>
    </div>
  )
}
