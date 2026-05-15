import { useEffect, useMemo, useState } from 'react'
import {
  createExecutiveRecord,
  getExecutiveChannelSalesAnalytics,
  importPlayAutoChannelSales,
} from '../../api/executiveApi'
import { BarList, DataTable, KpiCard, PageHeader, Panel } from './ExecutiveComponents'
import RecordForm from './RecordForm'
import { count, pct, won } from './formatters'

const today = new Date()
const toDateInput = (date) => date.toISOString().slice(0, 10)
const defaultEndDate = toDateInput(today)
const defaultStartDate = toDateInput(new Date(today.getFullYear(), today.getMonth(), 1))
const numberValue = (value) => Number(value || 0)

function SourceLabel({ value }) {
  const isPlayAuto = value === 'PLAYAUTO'
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black ${
      isPlayAuto
        ? 'border-sky-400/30 bg-sky-400/15 text-sky-100'
        : 'border-emerald-400/30 bg-emerald-400/15 text-emerald-100'
    }`}
    >
      {isPlayAuto ? 'PlayAuto' : '직접 입력'}
    </span>
  )
}

export default function ChannelSalesPage() {
  const [analytics, setAnalytics] = useState({ summary: {}, channels: [], products: [] })
  const [startDate, setStartDate] = useState(defaultStartDate)
  const [endDate, setEndDate] = useState(defaultEndDate)
  const [selectedChannel, setSelectedChannel] = useState('전체')
  const [importing, setImporting] = useState(false)
  const [message, setMessage] = useState('')

  const load = () => getExecutiveChannelSalesAnalytics({ startDate, endDate })
    .then((res) => setAnalytics(res.data || { summary: {}, channels: [], products: [] }))

  useEffect(() => {
    load()
  }, [])

  const channels = analytics.channels || []
  const products = analytics.products || []
  const summary = analytics.summary || {}

  const channelOptions = useMemo(() => (
    ['전체', ...Array.from(new Set(products.map((row) => row.channel_name).filter(Boolean)))]
  ), [products])

  const filteredProducts = useMemo(() => (
    selectedChannel === '전체'
      ? products
      : products.filter((row) => row.channel_name === selectedChannel)
  ), [products, selectedChannel])

  const selectedProductSummary = useMemo(() => {
    const salesAmount = filteredProducts.reduce((sum, row) => sum + numberValue(row.sales_amount), 0)
    const orderCount = filteredProducts.reduce((sum, row) => sum + numberValue(row.order_count), 0)
    const estimatedOperatingProfit = filteredProducts.reduce((sum, row) => sum + numberValue(row.estimated_operating_profit), 0)
    return {
      salesAmount,
      orderCount,
      estimatedOperatingProfit,
      estimatedOperatingMargin: salesAmount > 0 ? (estimatedOperatingProfit / salesAmount) * 100 : 0,
    }
  }, [filteredProducts])

  const handleApplyPeriod = async (event) => {
    event.preventDefault()
    setSelectedChannel('전체')
    await load()
  }

  const handleImport = async () => {
    setImporting(true)
    setMessage('')
    try {
      const response = await importPlayAutoChannelSales({ startDate, endDate })
      await load()
      const result = response.data || {}
      setMessage(`PlayAuto 채널 매출 ${count(result.upsertedCount || 0, '건')} 반영 완료`)
    } catch (error) {
      setMessage(error?.response?.data?.message || error.message || 'PlayAuto 채널 매출 반영에 실패했습니다.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <>
      <PageHeader
        title="채널 매출"
        description="기간을 선택해 온라인 채널별 매출, 판매 제품, 객단가, 추정 영업이익을 확인합니다."
      />

      <div className="mb-6 rounded-lg border border-white/10 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/20">
        <form className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between" onSubmit={handleApplyPeriod}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[180px_180px_auto]">
            <label>
              <span className="mb-1 block text-xs font-bold text-slate-400">시작일</span>
              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="h-10 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-sm font-bold text-white outline-none focus:border-sky-400"
              />
            </label>
            <label>
              <span className="mb-1 block text-xs font-bold text-slate-400">종료일</span>
              <input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                className="h-10 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-sm font-bold text-white outline-none focus:border-sky-400"
              />
            </label>
            <button
              type="submit"
              className="h-10 rounded-lg bg-sky-400 px-4 text-sm font-black text-slate-950 transition-colors hover:bg-sky-300 sm:self-end"
            >
              기간 적용
            </button>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {message && <span className="text-xs font-black text-sky-100">{message}</span>}
            <button
              type="button"
              onClick={handleImport}
              disabled={importing}
              className="h-10 rounded-lg border border-sky-400/30 bg-sky-400/10 px-4 text-sm font-black text-sky-100 transition-colors hover:bg-sky-400/20 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-slate-800 disabled:text-slate-500"
            >
              {importing ? '가져오는 중...' : 'PlayAuto 채널 매출 갱신'}
            </button>
          </div>
        </form>
      </div>

      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="선택 기간 매출" value={won(summary.salesAmount)} tone="sky" icon="storefront" />
        <KpiCard label="주문 수" value={count(summary.orderCount, '건')} tone="emerald" icon="shopping_bag" />
        <KpiCard label="객단가" value={won(summary.averageOrderValue)} tone="sky" icon="receipt_long" />
        <KpiCard label="추정 영업이익" value={won(summary.estimatedOperatingProfit)} tone={numberValue(summary.estimatedOperatingProfit) >= 0 ? 'emerald' : 'rose'} icon="payments" />
        <KpiCard label="추정 영업이익률" value={pct(summary.estimatedOperatingMargin)} tone={numberValue(summary.estimatedOperatingMargin) >= 10 ? 'emerald' : 'amber'} icon="percent" />
      </section>

      <section className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Panel title="채널별 매출 비교">
          <BarList
            rows={channels}
            labelKey="channel_name"
            valueKey="sales_amount"
            meta={(row) => `주문 ${count(row.order_count, '건')} · 영업이익 ${won(row.estimated_operating_profit)}`}
          />
        </Panel>
        <Panel title="채널별 손익 상세">
          <DataTable
            rows={channels}
            rowKey={(row) => `${row.source_type}-${row.channel_name}`}
            columns={[
              { key: 'channel_name', label: '채널' },
              { key: 'source_type', label: '출처', render: (row) => <SourceLabel value={row.source_type} /> },
              { key: 'sales_amount', label: '매출', render: (row) => won(row.sales_amount) },
              { key: 'order_count', label: '주문 수', render: (row) => count(row.order_count, '건') },
              { key: 'average_order_value', label: '객단가', render: (row) => won(row.average_order_value) },
              { key: 'ad_cost', label: '광고비', render: (row) => won(row.ad_cost) },
              { key: 'estimated_operating_profit', label: '추정 영업이익', render: (row) => won(row.estimated_operating_profit) },
              { key: 'estimated_operating_margin', label: '추정 이익률', render: (row) => pct(row.estimated_operating_margin) },
            ]}
          />
        </Panel>
      </section>

      <div className="mb-6 flex flex-col gap-3 rounded-lg border border-white/10 bg-slate-900/70 p-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="text-lg font-black text-white">판매 제품 확인</h2>
          <p className="mt-1 text-xs font-bold text-slate-400">선택 기간에 실제 판매된 제품을 채널별로 확인합니다. 원가는 최소 판매가의 40% 기준 추정치입니다.</p>
        </div>
        <label className="w-full xl:w-64">
          <span className="mb-1 block text-xs font-bold text-slate-400">채널 선택</span>
          <select
            value={selectedChannel}
            onChange={(event) => setSelectedChannel(event.target.value)}
            className="h-10 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-sm font-bold text-white outline-none focus:border-sky-400"
          >
            {channelOptions.map((channel) => (
              <option key={channel} value={channel}>{channel}</option>
            ))}
          </select>
        </label>
      </div>

      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <KpiCard label="제품 기준 매출" value={won(selectedProductSummary.salesAmount)} tone="sky" icon="inventory_2" />
        <KpiCard label="제품 주문 수" value={count(selectedProductSummary.orderCount, '건')} tone="emerald" icon="sell" />
        <KpiCard label="제품 추정 영업이익" value={won(selectedProductSummary.estimatedOperatingProfit)} tone="emerald" icon="trending_up" />
        <KpiCard label="제품 추정 이익률" value={pct(selectedProductSummary.estimatedOperatingMargin)} tone="amber" icon="percent" />
      </section>

      <Panel
        title="제품별 판매 상세"
        right={<span className="text-xs font-black text-slate-400">{selectedChannel} / {filteredProducts.length}개 제품</span>}
      >
        <DataTable
          rows={filteredProducts}
          rowKey={(row) => `${row.channel_name}-${row.sku}`}
          columns={[
            { key: 'channel_name', label: '채널' },
            { key: 'brand_name', label: '브랜드' },
            { key: 'product_name', label: '제품명', render: (row) => <span className="font-black text-white">{row.product_name}</span> },
            { key: 'sku', label: 'SKU' },
            { key: 'sales_amount', label: '매출', render: (row) => won(row.sales_amount) },
            { key: 'order_count', label: '주문 수', render: (row) => count(row.order_count, '건') },
            { key: 'unit_cost', label: '단위 원가', render: (row) => won(row.unit_cost) },
            { key: 'estimated_cost', label: '추정 원가', render: (row) => won(row.estimated_cost) },
            { key: 'ad_cost', label: '광고비 10%', render: (row) => won(row.ad_cost) },
            { key: 'estimated_operating_profit', label: '추정 영업이익', render: (row) => won(row.estimated_operating_profit) },
            { key: 'estimated_operating_margin', label: '추정 이익률', render: (row) => pct(row.estimated_operating_margin) },
          ]}
        />
      </Panel>

      <div className="mt-6">
        <RecordForm
          title="오프라인 / 수출 / B2B 채널 직접 입력"
          fields={[
            { name: 'channel_name', label: '채널명', type: 'select', required: true, options: [
              { value: '스마트스토어', label: '스마트스토어' },
              { value: '자사몰', label: '자사몰' },
              { value: '쿠팡', label: '쿠팡' },
              { value: '오프라인', label: '오프라인' },
              { value: '수출', label: '수출' },
              { value: 'B2B 납품', label: 'B2B 납품' },
            ] },
            { name: 'report_month', label: '기준월', type: 'date', required: true },
            { name: 'sales_amount', label: '매출', type: 'number', required: true },
            { name: 'ad_cost', label: '광고비', type: 'number' },
            { name: 'roas', label: 'ROAS', type: 'number' },
            { name: 'margin_rate', label: '마진율', type: 'number' },
            { name: 'order_count', label: '주문 수', type: 'number' },
            { name: 'average_order_value', label: '객단가', type: 'number' },
            { name: 'net_profit', label: '영업이익', type: 'number' },
          ]}
          initialValues={{ source_type: 'MANUAL' }}
          onSubmit={async (values) => {
            await createExecutiveRecord('channel-sales', { source_type: 'MANUAL', ...values })
            await load()
          }}
        />
      </div>
    </>
  )
}
