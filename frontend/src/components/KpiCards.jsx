const KW = (n) =>
  n == null ? '₩0' : '₩' + Math.round(Number(n)).toLocaleString('ko-KR')

function KpiCard({ label, value, sub, badge }) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{KW(value)}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
      {badge && <div className="kpi-badge">↑ {badge}</div>}
    </div>
  )
}

export default function KpiCards({ data, loading }) {
  if (loading) {
    return (
      <div className="kpi-grid">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="kpi-card" style={{ animation: 'none' }}>
            <div className="kpi-label" style={{ background: 'var(--surface-container)', borderRadius: 4, height: 12, width: 80 }} />
            <div className="kpi-value" style={{ background: 'var(--surface-container)', borderRadius: 4, height: 36, width: 140, marginTop: 12 }} />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="kpi-grid">
      <KpiCard
        label="총 매출 (Gross)"
        value={data?.totalGrossAmount}
        sub="할인 전 총 결제금액"
        badge="집계 기간"
      />
      <KpiCard
        label="순 매출 (Net Revenue)"
        value={data?.totalNetRevenue}
        sub="할인 차감 후 순수익"
      />
      <KpiCard
        label="총 할인 금액"
        value={data?.totalDiscountAmount}
        sub="적용된 할인 합계"
      />
      <KpiCard
        label="배송비 수익"
        value={data?.totalShippingFee}
        sub="고객 부담 배송비"
      />
    </div>
  )
}
