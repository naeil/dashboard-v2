import { useEffect, useState } from 'react'
import { getExecutiveReceivables } from '../../api/executiveApi'
import { DataTable, PageHeader, Panel, StatusBadge } from './ExecutiveComponents'
import { pct, won } from './formatters'

export default function PartnerManagementPage() {
  const [rows, setRows] = useState([])

  useEffect(() => {
    getExecutiveReceivables().then((res) => setRows(res.data || []))
  }, [])

  return (
    <>
      <PageHeader title="거래처 관리" description="거래처별 결제 안정성, 담당자, 회수율과 위험도를 확인합니다." />
      <Panel title="거래처 리스크 보드">
        <DataTable
          rows={rows}
          columns={[
            { key: 'partner_name', label: '거래처명' },
            { key: 'manager_name', label: '담당자' },
            { key: 'contact', label: '연락처' },
            { key: 'remaining_amount', label: '미수 잔액', render: (row) => won(row.remaining_amount) },
            { key: 'recovery_rate', label: '회수율', render: (row) => pct(row.recovery_rate) },
            { key: 'overdue_days', label: '연체 일수', render: (row) => `${row.overdue_days}일` },
            { key: 'risk_level', label: '위험도', render: (row) => <StatusBadge value={row.risk_level} /> },
            { key: 'memo', label: '메모' },
          ]}
        />
      </Panel>
    </>
  )
}
