import { useEffect, useState } from 'react'
import { createExecutiveRecord, getExecutiveAdPerformance } from '../../api/executiveApi'
import { BarList, DataTable, PageHeader, Panel } from './ExecutiveComponents'
import RecordForm from './RecordForm'
import { count, pct, won } from './formatters'

export default function AdPerformancePage() {
  const [rows, setRows] = useState([])

  const load = () => getExecutiveAdPerformance().then((res) => setRows(res.data || []))

  useEffect(() => {
    load()
  }, [])

  return (
    <>
      <PageHeader title="광고 성과" description="광고비, CPA, ROAS, 전환율과 순이익을 채널별로 비교합니다." />
      <RecordForm
        title="광고 성과 입력"
        fields={[
          { name: 'ad_channel', label: '광고 채널', type: 'select', required: true, options: [
            '메타 광고', '네이버 광고', '구글 광고', '틱톡 광고',
          ].map((value) => ({ value, label: value })) },
          { name: 'report_month', label: '기준월', type: 'date', required: true },
          { name: 'ad_cost', label: '광고비', type: 'number', required: true },
          { name: 'click_count', label: '클릭 수', type: 'number' },
          { name: 'cpa', label: 'CPA', type: 'number' },
          { name: 'roas', label: 'ROAS', type: 'number' },
          { name: 'conversion_rate', label: '구매 전환율', type: 'number' },
          { name: 'sales_amount', label: '매출', type: 'number' },
          { name: 'net_profit', label: '순이익', type: 'number' },
        ]}
        onSubmit={async (values) => {
          await createExecutiveRecord('ad-performance', values)
          await load()
        }}
      />
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Panel title="광고 채널 ROAS 비교">
          <BarList rows={rows} labelKey="ad_channel" valueKey="sales_amount" meta={(row) => `광고비 ${won(row.ad_cost)} · ROAS ${pct(row.roas)}`} />
        </Panel>
        <Panel title="광고 성과 상세">
          <DataTable
            rows={rows}
            columns={[
              { key: 'ad_channel', label: '광고 채널' },
              { key: 'ad_cost', label: '광고비', render: (row) => won(row.ad_cost) },
              { key: 'click_count', label: '클릭 수', render: (row) => count(row.click_count) },
              { key: 'cpa', label: 'CPA', render: (row) => won(row.cpa) },
              { key: 'roas', label: 'ROAS', render: (row) => pct(row.roas) },
              { key: 'conversion_rate', label: '구매 전환율', render: (row) => pct(row.conversion_rate) },
              { key: 'sales_amount', label: '매출', render: (row) => won(row.sales_amount) },
              { key: 'net_profit', label: '순이익', render: (row) => won(row.net_profit) },
            ]}
          />
        </Panel>
      </section>
    </>
  )
}
