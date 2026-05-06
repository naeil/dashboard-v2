const KW = (n) => '₩' + Math.round(Number(n ?? 0)).toLocaleString('ko-KR')

export default function StoreTable({ data, loading }) {
  if (loading) return <div className="state-box"><div className="spinner" /></div>
  if (!data?.length) return <div className="state-box">데이터가 없습니다</div>

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>#</th>
            <th>스토어명</th>
            <th>샵코드</th>
            <th style={{ textAlign: 'right' }}>총 매출</th>
            <th style={{ textAlign: 'right' }}>할인</th>
            <th style={{ textAlign: 'right' }}>순 매출</th>
            <th style={{ textAlign: 'right' }}>배송비</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={row.shopId}>
              <td style={{ color: 'var(--on-surface-variant)', fontSize: '0.78rem' }}>{i + 1}</td>
              <td style={{ fontWeight: 500 }}>{row.shopName}</td>
              <td style={{ fontFamily: 'monospace', color: 'var(--on-surface-variant)' }}>{row.shopCode}</td>
              <td style={{ textAlign: 'right' }}>{KW(row.totalGrossAmount)}</td>
              <td style={{ textAlign: 'right' }} className="amount-discount">
                -{KW(row.totalDiscountAmount)}
              </td>
              <td style={{ textAlign: 'right' }} className="amount-positive">
                {KW(row.totalNetRevenue)}
              </td>
              <td style={{ textAlign: 'right', color: 'var(--on-surface-variant)', fontSize: '0.83rem' }}>
                {KW(row.totalShippingFee)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
