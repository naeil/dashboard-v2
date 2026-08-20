import { useEffect, useState } from 'react'
import { DataTable, EmptyState, Panel, StatusBadge } from '../ExecutiveComponents'
import { won } from '../formatters'
import { fmtWon, fmtPct, signClass } from './cfoUtils'
import { LoadingBox, ErrorBox, StatCard } from './CfoShared'
import { getCfoCashflowForecast, getCfoReceivablesPayables, getCfoDebts } from '../../../api/cfoApi'

// ── 13주 현금흐름 탭 ─────────────────────────────────────────
export function CashflowTab() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [scenario, setScenario] = useState('baseBalance')

  useEffect(() => {
    getCfoCashflowForecast()
      .then((res) => setData(res.data))
      .catch((e) => setError(e?.response?.data?.message || e.message))
  }, [])

  if (error) return <ErrorBox message={error} />
  if (!data) return <LoadingBox />

  const weeks = data.weeks || []
  const values = weeks.map((w) => Number(w[scenario] || 0))
  const maxAbs = Math.max(1, ...values.map((v) => Math.abs(v)))
  const firstNegative = weeks.find((w) => Number(w[scenario]) < 0)

  const scenarioLabels = {
    baseBalance: `기준 — ${data.scenarioBasis?.base || ''}`,
    optimisticBalance: `낙관 — ${data.scenarioBasis?.optimistic || ''}`,
    conservativeBalance: `보수 — ${data.scenarioBasis?.conservative || ''}`,
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <StatCard label="현재 현금·예금" value={fmtWon(data.baseCash)} tooltip="은행계좌 잔액 합계 (수기 등록 기준)" />
        <StatCard
          label="13주 후 예상 잔액 (기준)"
          value={fmtWon(weeks[12]?.baseBalance)}
          tone={Number(weeks[12]?.baseBalance) < 0 ? 'rose' : 'emerald'}
        />
        <StatCard
          label="현금 부족 예상 시점"
          value={firstNegative ? `${firstNegative.weekIndex}주차 (${firstNegative.weekStart})` : '13주 내 없음'}
          tone={firstNegative ? 'rose' : 'emerald'}
        />
      </div>

      <Panel
        title="13주 주별 예상 현금잔액"
        right={
          <select value={scenario} onChange={(e) => setScenario(e.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 outline-none focus:border-sky-400">
            <option value="baseBalance">기준 시나리오</option>
            <option value="optimisticBalance">낙관 시나리오</option>
            <option value="conservativeBalance">보수 시나리오</option>
          </select>
        }
      >
        <p className="mb-4 text-xs font-medium text-slate-400">{scenarioLabels[scenario]}</p>
        <div className="flex items-end gap-1.5" style={{ height: 160 }}>
          {weeks.map((week) => {
            const value = Number(week[scenario] || 0)
            const height = Math.max(6, (Math.abs(value) / maxAbs) * 140)
            return (
              <div key={week.weekIndex} className="group relative flex flex-1 flex-col items-center justify-end" style={{ height: 150 }}>
                <div
                  className={`w-full rounded-t ${value < 0 ? 'bg-rose-400' : 'bg-sky-500'}`}
                  style={{ height }}
                  title={`${week.weekStart} ~ ${week.weekEnd}\n잔액 ${won(value)}`}
                />
                <span className="mt-1 text-[10px] font-bold text-slate-400">{week.weekIndex}</span>
              </div>
            )
          })}
        </div>
        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-xs font-black text-slate-500">주차</th>
                <th className="px-3 py-2 text-right text-xs font-black text-slate-500">확정 유입</th>
                <th className="px-3 py-2 text-right text-xs font-black text-slate-500">미확정 유입</th>
                <th className="px-3 py-2 text-right text-xs font-black text-slate-500">유출</th>
                <th className="px-3 py-2 text-right text-xs font-black text-slate-500">기준 잔액</th>
                <th className="px-3 py-2 text-right text-xs font-black text-slate-500">보수 잔액</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {weeks.map((week) => (
                <tr key={week.weekIndex} className={Number(week.conservativeBalance) < 0 ? 'bg-rose-50/60' : ''}>
                  <td className="px-3 py-2 text-xs font-bold text-slate-600">{week.weekIndex}주차 ({week.weekStart})</td>
                  <td className="px-3 py-2 text-right text-sm font-medium text-emerald-700">{won(week.confirmedInflow)}</td>
                  <td className="px-3 py-2 text-right text-sm font-medium text-sky-600">{won(week.expectedInflow)}</td>
                  <td className="px-3 py-2 text-right text-sm font-medium text-rose-600">{won(week.outflow)}</td>
                  <td className={`px-3 py-2 text-right text-sm font-black ${signClass(week.baseBalance)}`}>{won(week.baseBalance)}</td>
                  <td className={`px-3 py-2 text-right text-sm font-black ${signClass(week.conservativeBalance)}`}>{won(week.conservativeBalance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-xs font-medium text-slate-400">{data.basis}</p>
      </Panel>
    </div>
  )
}

// ── 미수금·미지급금 탭 ───────────────────────────────────────
export function ReceivableTab() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    getCfoReceivablesPayables()
      .then((res) => setData(res.data))
      .catch((e) => setError(e?.response?.data?.message || e.message))
  }, [])

  if (error) return <ErrorBox message={error} />
  if (!data) return <LoadingBox />

  const agingEntries = Object.entries(data.aging || {})
  const agingTone = { '기한 전': 'sky', '0~30일': 'sky', '31~60일': 'amber', '61~90일': 'amber', '91~180일': 'rose', '181일 이상': 'rose' }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <StatCard label="총 미수금" value={fmtWon(data.totalReceivable)} tone="amber" tooltip="세금계산서 발행액 − 입금액 합계" />
        <StatCard label="총 미지급금" value={fmtWon(data.totalPayable)} tone="rose" tooltip="거래처 원장 PAYABLE 중 미지급 합계" />
        <StatCard
          label="91일 이상 연체"
          value={fmtWon(Number(data.aging?.['91~180일'] || 0) + Number(data.aging?.['181일 이상'] || 0))}
          tone="rose"
        />
      </div>

      <Panel title="미수금 연령 분석">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
          {agingEntries.map(([bucket, amount]) => (
            <StatCard key={bucket} label={bucket} value={won(amount)} tone={agingTone[bucket]} />
          ))}
        </div>
      </Panel>

      <Panel title="미수금 상세">
        {(data.receivables || []).length === 0 ? <EmptyState message="미수금이 없습니다." /> : (
          <DataTable
            columns={[
              { key: 'partner_name', label: '거래처' },
              { key: 'manager_name', label: '담당자' },
              { key: 'outstanding', label: '미수 잔액', render: (r) => <span className="block text-right font-black">{won(r.outstanding)}</span> },
              { key: 'due_date', label: '입금 예정일' },
              { key: 'agingBucket', label: '연령' },
              { key: 'risk_level', label: '위험도', render: (r) => <StatusBadge value={r.risk_level} /> },
            ]}
            rows={data.receivables}
            rowKey={(r) => r.id}
            searchPlaceholder="거래처 검색"
            sortOptions={[
              { id: 'due', label: '예정일순', key: 'due_date', type: 'date', direction: 'asc' },
              { id: 'amount', label: '금액순', key: 'outstanding' },
            ]}
          />
        )}
      </Panel>

      <Panel title="미지급금 상세">
        {(data.payables || []).length === 0 ? <EmptyState message="미지급금이 없습니다." /> : (
          <DataTable
            columns={[
              { key: 'partner_name', label: '공급업체' },
              { key: 'amount', label: '지급 예정액', render: (r) => <span className="block text-right font-black">{won(r.amount)}</span> },
              { key: 'due_date', label: '지급 예정일' },
              { key: 'tax_invoice_issued', label: '세금계산서', render: (r) => (r.tax_invoice_issued ? '발행' : '미발행') },
              { key: 'status', label: '상태', render: (r) => <StatusBadge value={r.status} /> },
            ]}
            rows={data.payables}
            rowKey={(r) => r.id}
            searchPlaceholder="업체 검색"
          />
        )}
      </Panel>
    </div>
  )
}

// ── 대출·부채 탭 ─────────────────────────────────────────────
export function DebtTab() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    getCfoDebts()
      .then((res) => setData(res.data))
      .catch((e) => setError(e?.response?.data?.message || e.message))
  }, [])

  if (error) return <ErrorBox message={error} />
  if (!data) return <LoadingBox />

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="총 대출 잔액" value={fmtWon(data.totalDebt)} tone="rose" />
        <StatCard label="월 원리금 상환액" value={fmtWon(data.totalMonthlyPayment)} />
        <StatCard label="월 이자 추정" value={fmtWon(data.totalMonthlyInterestEst)} tooltip="잔액 × 연이율 ÷ 12 추정치" />
        <StatCard label="월매출 대비 부채" value={fmtPct(data.debtToMonthlyRevenuePct)} tooltip="총부채 ÷ 최근 3개월 월평균 순매출" />
      </div>
      <Panel title="대출 목록">
        {(data.debts || []).length === 0 ? <EmptyState message="등록된 대출이 없습니다." /> : (
          <DataTable
            columns={[
              { key: 'lender', label: '금융기관' },
              { key: 'loan_name', label: '대출명' },
              { key: 'principal_balance', label: '잔액', render: (r) => <span className="block text-right font-black">{won(r.principal_balance)}</span> },
              { key: 'interest_rate', label: '금리', render: (r) => <span className="block text-right">{fmtPct(r.interest_rate)}</span> },
              { key: 'monthly_payment', label: '월 납입액', render: (r) => <span className="block text-right">{won(r.monthly_payment)}</span> },
              { key: 'monthlyInterestEst', label: '월 이자 추정', render: (r) => <span className="block text-right">{fmtWon(r.monthlyInterestEst)}</span> },
              { key: 'next_payment_date', label: '다음 납입일' },
              { key: 'maturity_date', label: '만기일' },
              {
                key: 'maturityAlert', label: '만기 경보',
                render: (r) => r.maturityAlert ? (
                  <span className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-black text-rose-700">
                    {r.maturityAlert}
                  </span>
                ) : '—',
              },
            ]}
            rows={data.debts}
            rowKey={(r) => r.id}
            searchPlaceholder="금융기관·대출명 검색"
          />
        )}
        <p className="mt-4 text-xs font-medium text-slate-400">{data.basis}</p>
      </Panel>
    </div>
  )
}
