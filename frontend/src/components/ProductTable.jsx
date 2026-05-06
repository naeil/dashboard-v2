const KW = (n) => '₩' + Math.round(Number(n ?? 0)).toLocaleString('ko-KR')

export default function ProductTable({ data, loading }) {
  if (loading) return <div className="state-box"><div className="spinner" /></div>
  if (!data?.length) return <div className="state-box">데이터가 없습니다</div>

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>#</th>
            <th>상품명</th>
            <th>PlayAuto ID</th>
            <th style={{ textAlign: 'right' }}>실재고</th>
            <th style={{ textAlign: 'right' }}>총 매출</th>
            <th style={{ textAlign: 'right' }}>할인</th>
            <th style={{ textAlign: 'right' }}>순 매출</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={row.productId}>
              <td style={{ color: 'var(--on-surface-variant)', fontSize: '0.78rem' }}>{i + 1}</td>
              <td style={{ fontWeight: 500, maxWidth: 220 }}>{row.productName}</td>
              <td style={{ fontSize: '0.78rem', color: 'var(--on-surface-variant)', fontFamily: 'monospace' }}>
                {row.externalProductId ?? '—'}
              </td>
              <td style={{ textAlign: 'right' }}>
                {(row.currentRealStock ?? 0).toLocaleString('ko-KR')}
              </td>
              <td style={{ textAlign: 'right' }}>{KW(row.totalGrossAmount)}</td>
              <td style={{ textAlign: 'right' }} className="amount-discount">
                -{KW(row.totalDiscountAmount)}
              </td>
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
