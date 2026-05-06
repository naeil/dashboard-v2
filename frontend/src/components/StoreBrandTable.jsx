const KW = (n) => '₩' + Math.round(Number(n ?? 0)).toLocaleString('ko-KR')

export default function StoreBrandTable({ data, loading }) {
  if (loading) return <div className="state-box"><div className="spinner" /></div>
  if (!data?.length) return <div className="state-box">데이터가 없습니다</div>

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>스토어</th>
            <th>샵코드</th>
            <th>브랜드</th>
            <th style={{ textAlign: 'right' }}>총 매출</th>
            <th style={{ textAlign: 'right' }}>순 매출</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={`${row.shopId}-${row.brandId}-${i}`}>
              <td style={{ fontWeight: 500 }}>{row.shopName}</td>
              <td style={{ fontFamily: 'monospace', color: 'var(--on-surface-variant)' }}>{row.shopCode}</td>
              <td style={{ color: 'var(--secondary)', fontWeight: 500 }}>{row.brandName}</td>
              <td style={{ textAlign: 'right' }}>{KW(row.totalGrossAmount)}</td>
              <td style={{ textAlign: 'right' }} className="amount-positive">
                {KW(row.totalNetRevenue)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
